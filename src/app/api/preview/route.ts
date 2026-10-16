import { draftMode } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { isValidPreviewSignature, scopeCookieValue } from '@/lib/preview';
import { verifyPreviewTarget } from '@/lib/wordpress';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface PreviewErrorPayload { ok: false; error: string }

export async function GET(request: NextRequest): Promise<NextResponse> {
  const values = request.nextUrl.searchParams;
  const id = Number(values.get('id'));
  const expires = Number(values.get('expires'));
  const signature = values.get('secret') ?? '';
  if (!isValidPreviewSignature({ id, expires }, signature)) {
    return NextResponse.json<PreviewErrorPayload>({ ok: false, error: 'Invalid or expired preview link' }, { status: 401 });
  }
  try {
    const target = await verifyPreviewTarget(id);
    if (!target || target.databaseId !== id || target.status.toLowerCase() === 'trash') {
      return NextResponse.json<PreviewErrorPayload>({ ok: false, error: 'Preview target not found' }, { status: 404 });
    }
    (await draftMode()).enable();
    const response = NextResponse.redirect(new URL(`/preview/${id}`, request.nextUrl.origin), { status: 307 });
    response.cookies.set('wp-preview-scope', scopeCookieValue(id, expires), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/preview',
      maxAge: Math.max(1, expires - Math.floor(Date.now() / 1000)),
    });
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch (error: unknown) {
    console.error('Preview verification failed', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json<PreviewErrorPayload>({ ok: false, error: 'CMS preview verification failed' }, { status: 502 });
  }
}
