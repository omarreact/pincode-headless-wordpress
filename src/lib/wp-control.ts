import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'pincode_wp_control';
const MAX_AGE_SECONDS = 60 * 60 * 4;

export interface AdminSession {
  basicAuth: string;
  username: string;
  expires: number;
}

export class CMSRequestError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'CMSRequestError';
  }
}

export function cmsBaseUrl(): string | null {
  const input = process.env.WORDPRESS_CMS_URL?.trim();
  if (!input) return null;
  let url: URL;
  try { url = new URL(input); }
  catch { throw new Error('WORDPRESS_CMS_URL must be a valid URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('WORDPRESS_CMS_URL must be a clean HTTPS origin');
  }
  return url.toString().replace(/\/$/, '');
}

function encryptionKey(): Buffer {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('ADMIN_SESSION_SECRET must be at least 32 characters');
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function sessionReady(): boolean {
  return Boolean(cmsBaseUrl() && process.env.ADMIN_SESSION_SECRET && process.env.ADMIN_SESSION_SECRET.length >= 32);
}

export function sealSession(session: AdminSession): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
}

export function openSession(raw: string): AdminSession | null {
  try {
    const parts = raw.split('.');
    if (parts.length !== 3) return null;
    const [iv, tag, encrypted] = parts.map((part) => Buffer.from(part, 'base64url'));
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
    decipher.setAuthTag(tag);
    const value = JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')) as AdminSession;
    if (typeof value.basicAuth !== 'string' || typeof value.username !== 'string' ||
        !Number.isFinite(value.expires) || value.expires <= Date.now()) return null;
    return value;
  } catch { return null; }
}

export async function currentSession(): Promise<AdminSession | null> {
  const cookie = (await cookies()).get(COOKIE_NAME)?.value;
  return cookie ? openSession(cookie) : null;
}

export function sessionCookieName(): string { return COOKIE_NAME; }
export function sessionMaxAge(): number { return MAX_AGE_SECONDS; }

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}

export async function cmsRequest<T>(
  path: string,
  basicAuth: string,
  options: { method?: 'GET' | 'POST'; json?: unknown } = {},
): Promise<T> {
  const base = cmsBaseUrl();
  if (!base) throw new CMSRequestError('WordPress has not been connected', 503);
  if (!path.startsWith('/wp-json/') || path.startsWith('//') || path.includes('..')) {
    throw new CMSRequestError('Invalid CMS API path', 400);
  }
  const response = await fetch(base + path, {
    method: options.method ?? 'GET',
    cache: 'no-store',
    headers: {
      Authorization: 'Basic ' + basicAuth,
      Accept: 'application/json',
      ...(options.json === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(options.json === undefined ? {} : { body: JSON.stringify(options.json) }),
    signal: AbortSignal.timeout(12000),
    redirect: 'error',
  }).catch(() => { throw new CMSRequestError('Cannot reach the WordPress server', 502); });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new CMSRequestError('WordPress rejected this account or its permissions', response.status);
    }
    if (response.status === 404) throw new CMSRequestError('WordPress endpoint not found: install the companion must-use plugin', 404);
    throw new CMSRequestError('WordPress request failed with HTTP ' + response.status, response.status);
  }
  try { return (await response.json()) as T; }
  catch { throw new CMSRequestError('WordPress returned invalid JSON', 502); }
}
