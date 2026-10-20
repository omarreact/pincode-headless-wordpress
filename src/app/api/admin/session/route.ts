import { NextRequest, NextResponse } from 'next/server';
import {
  CMSRequestError, cmsRequest, sameOrigin, sealSession, sessionCookieName,
  sessionMaxAge, sessionReady,
} from '@/lib/wp-control';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface WPUser { id: number; name: string; roles?: string[] }

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'JSON required' }, { status: 415 });
  }
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid input' }, { status: 400 }); }

  if (body.action === 'logout') {
    const reply = NextResponse.json({ ok: true });
    reply.cookies.delete(sessionCookieName());
    return reply;
  }
  if (!sessionReady()) {
    return NextResponse.json({ error: 'Administrator setup is incomplete: configure the WordPress URL and session secret' }, { status: 503 });
  }
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const applicationPassword = typeof body.applicationPassword === 'string' ? body.applicationPassword.trim() : '';
  if (!username || username.length > 120 || !applicationPassword || applicationPassword.length > 255) {
    return NextResponse.json({ error: 'Enter your WordPress username and application password' }, { status: 400 });
  }
  const basicAuth = Buffer.from(username + ':' + applicationPassword).toString('base64');
  try {
    const user = await cmsRequest<WPUser>('/wp-json/wp/v2/users/me?context=edit', basicAuth);
    if (!Number.isSafeInteger(user.id) || !user.roles?.includes('administrator')) {
      return NextResponse.json({ error: 'An administrator-level WordPress account is required' }, { status: 403 });
    }
    const reply = NextResponse.json({ ok: true, username: user.name });
    reply.cookies.set(sessionCookieName(), sealSession({
      basicAuth, username: user.name || username, expires: Date.now() + sessionMaxAge() * 1000,
    }), {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict',
      path: '/', maxAge: sessionMaxAge(),
    });
    return reply;
  } catch (error) {
    const status = error instanceof CMSRequestError ? error.status : 502;
    return NextResponse.json({ error: error instanceof CMSRequestError ? error.message : 'Administrator login is unavailable' }, { status });
  }
}
