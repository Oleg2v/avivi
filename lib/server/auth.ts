import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Inbox protection. Password from INBOX_PASSWORD. Without it the inbox runs in demo mode:
 * the documented demo password works, and server-stored leads are never shown.
 */
export const INBOX_COOKIE = 'avivi_inbox';
export const passwordIsDefault = !process.env.INBOX_PASSWORD;
const PASSWORD = process.env.INBOX_PASSWORD || 'avivi-demo';
const SECRET = process.env.INBOX_SECRET || `avivi-inbox:${PASSWORD}`;

export function inboxToken(): string {
  return createHmac('sha256', SECRET).update('inbox-session-v1').digest('hex');
}

export function checkPassword(candidate: string): boolean {
  const a = Buffer.from(createHmac('sha256', SECRET).update(candidate).digest('hex'));
  const b = Buffer.from(createHmac('sha256', SECRET).update(PASSWORD).digest('hex'));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isAuthed(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  const a = Buffer.from(cookieValue);
  const b = Buffer.from(inboxToken());
  return a.length === b.length && timingSafeEqual(a, b);
}
