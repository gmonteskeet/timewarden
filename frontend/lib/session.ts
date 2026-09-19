// The light login from AGENTS.md section 4: a personal link sets a signed, http only cookie
// holding person_id and app_role. No passwords. Server only.
import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { AppRole, Uuid } from './contract';

export const SESSION_COOKIE = 'scout_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

// Used only when fixtures mode is on and no SESSION_SECRET is set, so a fresh clone builds and runs.
const FIXTURES_ONLY_FALLBACK_SECRET = 'fixtures-only-fallback-secret-never-use-with-real-data';

export interface Session {
  person_id: Uuid;
  app_role: AppRole;
}

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (value) return value;
  if (process.env.NEXT_PUBLIC_USE_FIXTURES === 'true') return FIXTURES_ONLY_FALLBACK_SECRET;
  throw new Error('SESSION_SECRET is not set. Add it to frontend/.env.local (or the Vercel settings) before running with real data.');
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function encodeSession(session: Session): string {
  const payload = Buffer.from(JSON.stringify({ ...session, iat: Math.floor(Date.now() / 1000) })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(value: string | undefined): Session | null {
  if (!value) return null;
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data.person_id !== 'string') return null;
    if (data.app_role !== 'manager' && data.app_role !== 'employee') return null;
    if (typeof data.iat !== 'number' || Date.now() / 1000 - data.iat > MAX_AGE_SECONDS) return null;
    return { person_id: data.person_id, app_role: data.app_role };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: MAX_AGE_SECONDS,
};

/** Accepts ?next= only when it is a path on this site: one leading slash, not two, no backslash. */
export function safeNextPath(next: string | null): string | null {
  if (!next) return null;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null;
  return next;
}

/** The signed in person, or null. Never throws for a missing or tampered cookie. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}

/** For pages: sends people who are not signed in to the home page. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect('/');
  return session;
}

/** For employee pages: not signed in goes home, a manager is refused. */
export async function requireEmployee(): Promise<Session> {
  const session = await requireSession();
  if (session.app_role !== 'employee') redirect('/not-allowed');
  return session;
}

/** For manager pages: not signed in goes home, an employee is refused. */
export async function requireManager(): Promise<Session> {
  const session = await requireSession();
  if (session.app_role !== 'manager') redirect('/not-allowed');
  return session;
}
