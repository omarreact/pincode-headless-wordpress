import { draftMode } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  (await draftMode()).disable();
  const response = NextResponse.redirect(new URL('/', request.url), { status: 307 });
  response.cookies.set('wp-preview-scope', '', { path: '/preview', maxAge: 0 });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
