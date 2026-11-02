'use client';
import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLocale } from '@/components/providers/LocaleContext';
import { Icon } from '@/components/ui/Icon';
import { href, localeTag } from '@/lib/i18n';
import { site, waLink } from '@/lib/site';
import { submitLead, validPhone } from '@/lib/leads';
import { track } from '@/lib/analytics';
import { fmt } from '@/lib/fmt';
import { uid } from '@/lib/store';
import { isFinePointer, prefersReducedMotion } from '@/lib/motion';
import type { DesignerCard } from '@/lib/designer/knowledge';
import s from './Designer.module.css';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  cards?: DesignerCard[];
  suggestions?: string[];
  handoff?: boolean;
  mode?: 'live' | 'demo';
  error?: boolean;
}

/* Minimal Web Speech API surface (not in every TypeScript DOM lib). */
interface SpeechResultList {
  length: number;
  [i: number]: { isFinal: boolean; 0: { transcript: string } };
}
interface SpeechRec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
function speechCtor(): (new () => SpeechRec) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const KEY = 'avivi-designer-v1';
function loadMsgs(): Msg[] {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as Msg[]) : [];
    return Array.isArray(v) ? v.slice(-40) : [];
  } catch {
    return [];
  }
}
function saveMsgs(m: Msg[]) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(m.slice(-40)));
  } catch {
    /* private mode: keep in memory */
  }
}

const cardIcon: Record<DesignerCard['type'], string> = { tool: 'sparkle', page: 'arrow', collection: 'arrow', checklist: 'check', handoff: 'calendar' };

/**
 * Avivi Designer conversation: used in the floating panel and on /designer.
 * Grounded answers with cards and follow-ups, voice input, and a human handoff
 * (call, WhatsApp, booking, or a callback request that carries the conversation).
 */
export function DesignerChat({ variant, onClose, active = true, titleId }: { variant: 'panel' | 'page'; onClose?: () => void; active?: boolean; titleId?: string }) {
  const { t, locale } = useLocale();
  const d = t.designer;
  const pathname = usePathname() || '/';
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'live' | 'demo' | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceNote, setVoiceNote] = useState('');
  const [handoffOpen, setHandoffOpen] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const busyRef = useRef(false);
  const msgsRef = useRef<Msg[]>([]);
  const autoId = useId();
  const headingId = titleId || `${autoId}-title`;

  useEffect(() => {
    const stored = loadMsgs();
    msgsRef.current = stored;
    setMsgs(stored);
    setHydrated(true);
    let alive = true;
    fetch('/api/designer', { method: 'GET' })
      .then((r) => r.json())
      .then((j: { mode?: 'live' | 'demo' }) => alive && j.mode && setMode(j.mode))
      .catch(() => undefined);
    return () => {
      alive = false;
      recRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    msgsRef.current = msgs;
    if (hydrated) saveMsgs(msgs);
  }, [msgs, hydrated]);

  // New question: follow to the bottom. New answer: show where it starts, so it reads from the top.
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
    const last = msgs[msgs.length - 1];
    if (!busy && last?.role === 'assistant' && !handoffOpen) {
      const node = el.querySelector<HTMLElement>(`[data-msg="${last.id}"]`);
      const prev = node?.previousElementSibling as HTMLElement | null;
      const anchor = prev && prev.dataset.role === 'user' ? prev : node;
      if (anchor) {
        el.scrollTo({ top: Math.max(0, anchor.offsetTop - 16), behavior });
        return;
      }
    }
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, [msgs, busy, handoffOpen]);

  // Focus moves into the panel when it opens. Touch devices get the heading, so the keyboard does not jump up.
  useEffect(() => {
    if (!active || variant !== 'panel') return;
    const id = window.setTimeout(() => {
      if (isFinePointer()) inputRef.current?.focus({ preventScroll: true });
      else headingRef.current?.focus({ preventScroll: true });
    }, 60);
    return () => window.clearTimeout(id);
  }, [active, variant]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim().slice(0, 1200);
      if (!text || busyRef.current) return;
      busyRef.current = true;
      const next: Msg[] = [...msgsRef.current, { id: uid(), role: 'user', text }];
      msgsRef.current = next;
      setMsgs(next);
      setInput('');
      setBusy(true);
      setHandoffOpen(false);
      track('designer_ask', { locale, variant });
      try {
        const ctrl = new AbortController();
        const timer = window.setTimeout(() => ctrl.abort(), 45_000);
        const res = await fetch('/api/designer', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            locale,
            page: pathname,
            messages: next.filter((m) => !m.error).slice(-12).map((m) => ({ role: m.role, content: m.text })),
          }),
          signal: ctrl.signal,
        });
        window.clearTimeout(timer);
        const j = (await res.json()) as { reply?: string; cards?: DesignerCard[]; suggestions?: string[]; handoff?: boolean; mode?: 'live' | 'demo' };
        if (typeof j.reply !== 'string' || !j.reply) throw new Error('empty');
        if (j.mode) setMode(j.mode);
        setMsgs((m) => [...m, { id: uid(), role: 'assistant', text: j.reply!, cards: j.cards || [], suggestions: j.suggestions || [], handoff: !!j.handoff, mode: j.mode }]);
        if (j.handoff) track('designer_handoff_offer', { locale });
      } catch {
        setMsgs((m) => [...m, { id: uid(), role: 'assistant', text: d.errorReply, error: true, handoff: true }]);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [locale, pathname, variant, d.errorReply],
  );

  // Questions sent from elsewhere on the site ("Ask Avivi Designer" buttons, example lists).
  useEffect(() => {
    const onAsk = (e: Event) => {
      const q = (e as CustomEvent<{ q?: string }>).detail?.q;
      if (q) void send(q);
    };
    window.addEventListener('avivi:designer-ask', onAsk);
    return () => window.removeEventListener('avivi:designer-ask', onAsk);
  }, [send]);

  const reset = () => {
    recRef.current?.abort();
    setMsgs([]);
    setInput('');
    setHandoffOpen(false);
    inputRef.current?.focus();
  };

  const toggleVoice = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = speechCtor();
    if (!Ctor) {
      setVoiceNote(d.voiceUnsupported);
      window.setTimeout(() => setVoiceNote(''), 5000);
      return;
    }
    try {
      const rec = new Ctor();
      rec.lang = localeTag[locale] === 'en-IL' ? 'en-US' : localeTag[locale];
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      let finalText = '';
      rec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        setInput((finalText + interim).trim());
      };
      rec.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setVoiceNote(d.voiceUnsupported);
      };
      rec.onend = () => {
        setListening(false);
        recRef.current = null;
        if (finalText.trim()) void send(finalText);
      };
      recRef.current = rec;
      rec.start();
      setListening(true);
      setVoiceNote(d.listening);
      track('designer_voice', { locale });
    } catch {
      setListening(false);
      setVoiceNote(d.voiceUnsupported);
    }
  };

  useEffect(() => {
    if (!listening && voiceNote === d.listening) setVoiceNote('');
  }, [listening, voiceNote, d.listening]);

  const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant');
  const chips = msgs.length === 0 ? d.suggestions : busy ? [] : lastAssistant?.suggestions || [];
  const showHandoff = !busy && (handoffOpen || !!lastAssistant?.handoff);
  const transcript = msgs
    .filter((m) => !m.error)
    .slice(-10)
    .map((m) => `${m.role === 'user' ? d.you : d.name}: ${m.text}`)
    .join('\n');
  const userLines = msgs.filter((m) => m.role === 'user').slice(-3).map((m) => `• ${m.text}`);

  return (
    <section className={`${s.chat} ${variant === 'page' ? s.isPage : s.isPanel}`} aria-labelledby={headingId}>
      <header className={s.head}>
        <div className={s.headTitle}>
          <span className={s.mark} aria-hidden="true">
            <Icon name="sparkle" size={16} />
          </span>
          <h2 id={headingId} className={s.title} ref={headingRef} tabIndex={-1}>
            {d.name}
          </h2>
          {mode === 'demo' ? <span className={s.badge}>{d.demo}</span> : null}
        </div>
        <div className={s.headActions}>
          {msgs.length ? (
            <button type="button" className={s.iconBtn} onClick={reset} aria-label={d.reset} title={d.reset}>
              <Icon name="rotate" size={18} />
            </button>
          ) : null}
          {onClose ? (
            <button type="button" className={s.iconBtn} onClick={onClose} aria-label={t.common.close} title={t.common.close}>
              <Icon name="close" size={20} />
            </button>
          ) : null}
        </div>
      </header>

      <div className={s.log} ref={logRef} role="log" aria-live="polite" aria-relevant="additions" data-lenis-prevent>
        <div className={`${s.msg} ${s.bot}`}>
          <p className={s.text}>{d.greeting}</p>
          <p className={s.notice}>
            {d.disclaimer} {d.privacy}
          </p>
        </div>

        {msgs.map((m) => (
          <div key={m.id} data-msg={m.id} data-role={m.role} className={`${s.msg} ${m.role === 'user' ? s.user : s.bot}`}>
            <span className="visually-hidden">{m.role === 'user' ? d.you : d.name}: </span>
            <div className={s.text}>
              {m.text.split(/\n{2,}/).map((para, i) => (
                <p key={i}>
                  {para.split('\n').map((line, j, arr) => (
                    <span key={j}>
                      {line}
                      {j < arr.length - 1 ? <br /> : null}
                    </span>
                  ))}
                </p>
              ))}
            </div>
            {m.cards?.length ? (
              <ul className={s.cards}>
                {m.cards.map((c, i) =>
                  c.type === 'checklist' ? (
                    <li key={i} className={s.checklist}>
                      <p className={s.cardTitle}>{c.title}</p>
                      <ul>
                        {c.items.map((it) => (
                          <li key={it}>
                            <Icon name="check" size={16} />
                            <span>{it}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ) : (
                    <li key={i}>
                      <Link
                        className={s.card}
                        href={href(locale, c.path || '/')}
                        onClick={() => {
                          track('designer_card', { type: c.type, path: c.path });
                          onClose?.();
                        }}
                      >
                        <Icon name={cardIcon[c.type]} size={18} className={c.type === 'page' || c.type === 'collection' ? 'flip-rtl' : undefined} />
                        <span className={s.cardBody}>
                          <span className={s.cardTitle}>{c.title}</span>
                          {c.text ? <span className={s.cardText}>{c.text}</span> : null}
                        </span>
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            ) : null}
          </div>
        ))}

        {busy ? (
          <div className={`${s.msg} ${s.bot}`} aria-label={d.thinking}>
            <span className={s.dots} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="visually-hidden">{d.thinking}</span>
          </div>
        ) : null}

        {showHandoff ? <Handoff transcript={transcript} userLines={userLines} onNavigate={onClose} /> : null}
      </div>

      <div className={s.foot}>
        {chips.length ? (
          <div className={s.chips} role="group" aria-label={d.tryTitle}>
            {chips.map((q) => (
              <button key={q} type="button" className={s.chip} onClick={() => void send(q)} disabled={busy}>
                {q}
              </button>
            ))}
          </div>
        ) : null}

        <form
          className={s.composer}
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <label className="visually-hidden" htmlFor={`${autoId}-q`}>
            {d.placeholder}
          </label>
          <textarea
            id={`${autoId}-q`}
            ref={inputRef}
            className={s.input}
            rows={1}
            value={input}
            maxLength={1200}
            placeholder={listening ? d.listening : d.placeholder}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send(input);
              }
            }}
          />
          <button type="button" className={`${s.iconBtn} ${s.voice}`} data-on={listening ? '1' : undefined} onClick={toggleVoice} aria-pressed={listening} aria-label={listening ? d.listening : d.voice} title={d.voice}>
            <Icon name="mic" size={20} />
          </button>
          <button type="submit" className={s.send} disabled={busy || !input.trim()} aria-label={d.send}>
            <Icon name="send" size={20} className="flip-rtl" />
          </button>
        </form>
        <p className={s.voiceNote} aria-live="polite">
          {voiceNote}
        </p>

        <div className={s.meta}>
          <button type="button" className={s.humanBtn} onClick={() => setHandoffOpen(true)} aria-expanded={showHandoff}>
            <Icon name="person" size={16} />
            {d.human}
          </button>
        </div>
      </div>
    </section>
  );
}

/** A person, at any moment: call, WhatsApp with the question, booking, or a callback request. */
function Handoff({ transcript, userLines, onNavigate }: { transcript: string; userLines: string[]; onNavigate?: () => void }) {
  const { t, locale } = useLocale();
  const d = t.designer;
  const id = useId();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; consent?: string }>({});
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [ref, setRef] = useState('');
  const wa = waLink([d.waIntro, ...userLines].join('\n'));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = t.common.invalidName;
    if (!validPhone(phone)) errs.phone = t.common.invalidPhone;
    if (!consent) errs.consent = t.common.consentRequired;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setState('sending');
    const res = await submitLead('designer', { locale, name: name.trim(), phone: phone.trim(), notes: transcript, extra: { channel: 'designer-callback' } });
    setRef(res.ref);
    setState(res.ok ? 'done' : 'error');
  };

  return (
    <div className={s.handoff}>
      <p className={s.handoffTitle}>{d.human}</p>
      <p className={s.handoffText}>{d.humanText}</p>
      <div className={s.handoffActions}>
        <a className="btn btn-small" href={`tel:${site.phone.tel}`} onClick={() => track('designer_call', { locale })}>
          <Icon name="phone" size={16} />
          {t.common.callNow}
        </a>
        <a className="btn btn-small btn-ghost" href={wa} target="_blank" rel="noopener noreferrer" onClick={() => track('designer_whatsapp', { locale })}>
          <Icon name="chat" size={16} />
          WhatsApp
        </a>
        <Link className="btn btn-small btn-ghost" href={href(locale, '/book')} onClick={() => onNavigate?.()}>
          <Icon name="calendar" size={16} />
          {t.common.bookVisit}
        </Link>
      </div>
      {site.phone.example ? (
        <p className={s.exampleNote}>
          {site.phone.display} · {t.common.exampleNumber}
        </p>
      ) : null}

      {state === 'done' ? (
        <p className={s.done} role="status">
          <Icon name="check" size={18} />
          {fmt(d.callbackDone, { ref })}
        </p>
      ) : (
        <form className={s.callback} onSubmit={submit} noValidate>
          <p className={s.handoffTitle}>{d.callbackTitle}</p>
          <p className={s.handoffText}>{d.callbackText}</p>
          <div className={s.callbackRow}>
            <div className="field">
              <label htmlFor={`${id}-n`}>{t.common.name}</label>
              <input id={`${id}-n`} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? `${id}-ne` : undefined} />
              {errors.name ? (
                <span className="error" id={`${id}-ne`}>
                  {errors.name}
                </span>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor={`${id}-p`}>{t.common.phone}</label>
              <input id={`${id}-p`} type="tel" inputMode="tel" autoComplete="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? `${id}-pe` : undefined} />
              {errors.phone ? (
                <span className="error" id={`${id}-pe`}>
                  {errors.phone}
                </span>
              ) : null}
            </div>
          </div>
          <label className="check">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-invalid={!!errors.consent} />
            <span>
              {t.common.consent}{' '}
              <Link href={href(locale, '/privacy')} onClick={() => onNavigate?.()}>
                {t.common.privacyLink}
              </Link>
            </span>
          </label>
          {errors.consent ? <span className={`error ${s.err}`}>{errors.consent}</span> : null}
          {state === 'error' ? (
            <p className={s.err} role="alert">
              {t.common.friendlyError}{' '}
              <a href={waLink([d.waIntro, ...userLines, `${t.common.name}: ${name}`, `${t.common.phone}: ${phone}`].join('\n'))} target="_blank" rel="noopener noreferrer">
                {t.common.whatsappSend}
              </a>
            </p>
          ) : null}
          <button type="submit" className="btn btn-small" disabled={state === 'sending'}>
            {state === 'sending' ? t.common.sending : d.callbackSend}
          </button>
        </form>
      )}
    </div>
  );
}
