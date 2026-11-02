import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { ALLOWED_PATHS, RESPONSE_SCHEMA, sanitizeReply, systemPrompt, type DesignerReply } from '@/lib/designer/knowledge';
import { declineReply, demoReply } from '@/lib/designer/demo';

/**
 * Avivi Designer on the server.
 * Provider order: Claude (ANTHROPIC_API_KEY), then OpenAI (OPENAI_API_KEY), then demo mode.
 * Any failure falls back to the grounded demo answers, so a visitor never sees a raw error.
 * Conversation text is processed in memory only and is never logged or stored here.
 */

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export type Provider = 'anthropic' | 'openai' | 'demo';

export function designerConfig() {
  const anthropicKey = process.env.ANTHROPIC_API_KEY || '';
  const openaiKey = process.env.OPENAI_API_KEY || '';
  const provider: Provider = anthropicKey ? 'anthropic' : openaiKey ? 'openai' : 'demo';
  return {
    provider,
    anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-opus-5-5',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-5-mini',
    openaiBase: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    openaiKey,
  };
}

const MAX_TURNS = 12;
const MAX_CHARS = 1500;

/** Keep the last turns, strip control characters, start with the visitor, alternate roles. */
export function normaliseTurns(input: unknown): ChatTurn[] {
  if (!Array.isArray(input)) return [];
  const turns: ChatTurn[] = [];
  for (const raw of input.slice(-MAX_TURNS * 2)) {
    if (!raw || typeof raw !== 'object') continue;
    const role = (raw as { role?: unknown }).role;
    const content = (raw as { content?: unknown }).content;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') continue;
    const text = content.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').trim().slice(0, MAX_CHARS);
    if (!text) continue;
    const prev = turns[turns.length - 1];
    if (prev && prev.role === role) prev.content = `${prev.content}\n\n${text}`.slice(0, MAX_CHARS * 2);
    else turns.push({ role, content: text });
  }
  while (turns.length && turns[0].role !== 'user') turns.shift();
  while (turns.length && turns[turns.length - 1].role !== 'user') turns.pop();
  return turns.slice(-MAX_TURNS);
}

/** Where the visitor is on the site, so answers can refer to what they are looking at. */
function pageContext(page: unknown): string {
  if (typeof page !== 'string') return '';
  const path = page.replace(/^\/(he|en|ru|fr)(?=\/|$)/, '') || '/';
  if (!ALLOWED_PATHS.includes(path)) return '';
  return `Visitor context: the visitor is currently on the page ${path}.`;
}

function parseReply(text: string): DesignerReply | null {
  try {
    const data = JSON.parse(text) as Partial<DesignerReply>;
    if (typeof data.reply !== 'string' || !data.reply.trim()) return null;
    return sanitizeReply({
      reply: data.reply,
      cards: Array.isArray(data.cards) ? data.cards : [],
      suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
      handoff: !!data.handoff,
    });
  } catch {
    return null;
  }
}

let anthropicClient: Anthropic | null = null;
function anthropic(): Anthropic {
  anthropicClient ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 35_000 });
  return anthropicClient;
}

/**
 * Claude with structured output (JSON schema) and low effort for chat latency.
 * Server-side refusal fallbacks are enabled: if a request is declined by the safety
 * classifiers, the API retries it on Anthropic's recommended fallback model in the same call.
 */
async function askClaude(turns: ChatTurn[], locale: string, context: string, model: string): Promise<DesignerReply | null> {
  try {
    const response = await anthropic().beta.messages.create({
      model,
      max_tokens: 6000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [
        { type: 'text', text: systemPrompt(locale), cache_control: { type: 'ephemeral' } },
        ...(context ? [{ type: 'text' as const, text: context }] : []),
      ],
      messages: turns.map((t) => ({ role: t.role, content: t.content })),
      output_config: { effort: 'low', format: { type: 'json_schema', schema: RESPONSE_SCHEMA } },
    });
    // The whole fallback chain declined: hand over to a person instead of showing a refusal.
    if (response.stop_reason === 'refusal') return declineReply(locale);
    const text = response.content
      .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
      .map((block) => block.text)
      .join('');
    return parseReply(text);
  } catch (err) {
    if (err instanceof Anthropic.APIError) console.warn(`[designer] Claude request failed (${err.status ?? 'connection'})`);
    else console.warn('[designer] Claude request failed');
    return null;
  }
}

/** OpenAI Chat Completions with a strict JSON schema, for teams that use OPENAI_API_KEY. */
async function askOpenAI(turns: ChatTurn[], locale: string, context: string, cfg: ReturnType<typeof designerConfig>): Promise<DesignerReply | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 35_000);
  try {
    const res = await fetch(`${cfg.openaiBase}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.openaiKey}` },
      body: JSON.stringify({
        model: cfg.openaiModel,
        max_completion_tokens: 4000,
        messages: [{ role: 'system', content: context ? `${systemPrompt(locale)}\n\n${context}` : systemPrompt(locale) }, ...turns],
        response_format: { type: 'json_schema', json_schema: { name: 'designer_reply', strict: true, schema: RESPONSE_SCHEMA } },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.warn(`[designer] OpenAI request failed (${res.status})`);
      return null;
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string | null; refusal?: string | null } }[] };
    const message = json.choices?.[0]?.message;
    if (message?.refusal) return declineReply(locale);
    return message?.content ? parseReply(message.content) : null;
  } catch {
    console.warn('[designer] OpenAI request failed');
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function answer(input: { messages: unknown; locale: string; page?: unknown; demoOnly?: boolean }): Promise<DesignerReply> {
  const { locale } = input;
  const turns = normaliseTurns(input.messages);
  const last = turns[turns.length - 1]?.content ?? '';
  if (!last) return demoReply('', locale);
  const cfg = designerConfig();
  if (!input.demoOnly) {
    const context = pageContext(input.page);
    const live =
      cfg.provider === 'anthropic'
        ? await askClaude(turns, locale, context, cfg.anthropicModel)
        : cfg.provider === 'openai'
          ? await askOpenAI(turns, locale, context, cfg)
          : null;
    if (live) return { ...live, mode: 'live' };
  }
  return demoReply(last, locale);
}
