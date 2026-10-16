import { timingSafeEqual } from 'node:crypto';
import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { requireEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface RevalidationPayload {
  slug: string;
  postType: 'post' | 'page';
  previousSlug?: string;
}
export interface RevalidationResult {
  ok: boolean;
  revalidated: string[];
  timestamp: string;
  error?: string;
}

function equalSecrets(received: string | null, expected: string): boolean {
  if (!received) return false;
  const a = Buffer.from(received, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

function validSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= 200 &&
    /^[\p{L}\p{N}_-]+$/u.test(value);
}

function json(ok: boolean, tags: string[], status: number, error?: string): NextResponse<RevalidationResult> {
  return NextResponse.json({ ok, revalidated: tags, timestamp: new Date().toISOString(), ...(error ? { error } : {}) }, { status });
}

export async function POST(request: NextRequest): Promise<NextResponse<RevalidationResult>> {
  if (!equalSecrets(request.headers.get('x-webhook-secret'), requireEnv('WORDPRESS_WEBHOOK_SECRET'))) {
    return json(false, [], 401, 'Unauthorized');
  }
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
    return json(false, [], 415, 'JSON content type required');
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(false, [], 400, 'Malformed JSON');
  }
  if (!body || typeof body !== 'object') return json(false, [], 400, 'Invalid payload');
  const payload = body as Partial<RevalidationPayload>;
  if (!validSlug(payload.slug) || !['post', 'page'].includes(payload.postType ?? '') ||
      (payload.previousSlug !== undefined && !validSlug(payload.previousSlug))) {
    return json(false, [], 422, 'Invalid slug, previousSlug, or postType');
  }
  const slugs = [...new Set([payload.slug, payload.previousSlug].filter(validSlug))];
  const tags = ['posts', 'navigation', ...slugs.map((slug) => `post-${slug}`)];
  try {
    for (const tag of tags) revalidateTag(tag, 'max');
    revalidatePath('/');
    for (const slug of slugs) revalidatePath(`/${encodeURIComponent(slug)}`);
    return json(true, tags, 200);
  } catch (error: unknown) {
    console.error('Revalidation failed', error instanceof Error ? error.message : error);
    return json(false, [], 500, 'Revalidation failed');
  }
}
