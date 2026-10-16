import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { requireEnv } from '@/lib/env';

export interface PreviewClaim {
  id: number;
  expires: number;
}

function bytesEqual(a: string, b: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(a) || !/^[0-9a-f]{64}$/i.test(b)) return false;
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export function previewSignature(id: number, expires: number): string {
  return createHmac('sha256', requireEnv('WORDPRESS_PREVIEW_SECRET'))
    .update(`${id}:${expires}`)
    .digest('hex');
}

export function isValidPreviewSignature(claim: PreviewClaim, signature: string): boolean {
  if (!Number.isSafeInteger(claim.id) || claim.id <= 0) return false;
  if (!Number.isSafeInteger(claim.expires)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (claim.expires <= now || claim.expires > now + 600) return false;
  return bytesEqual(previewSignature(claim.id, claim.expires), signature);
}

export function scopeCookieValue(id: number, expires: number): string {
  return `${id}.${expires}.${previewSignature(id, expires)}`;
}

export function validScopeCookie(cookie: string | undefined, id: number): boolean {
  if (!cookie) return false;
  const parts = cookie.split('.');
  if (parts.length !== 3) return false;
  const cookieId = Number(parts[0]);
  const expires = Number(parts[1]);
  return cookieId === id && isValidPreviewSignature({ id, expires }, parts[2]);
}
