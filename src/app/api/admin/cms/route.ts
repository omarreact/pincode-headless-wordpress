import { NextRequest, NextResponse } from 'next/server';
import { CMSRequestError, cmsRequest, currentSession, sameOrigin } from '@/lib/wp-control';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorResponse(error: unknown) {
  const code = error instanceof CMSRequestError ? error.status : 502;
  return NextResponse.json({ error: error instanceof CMSRequestError ? error.message : 'CMS unavailable' }, { status: code });
}

const sourcePaths: Record<string, string> = {
  status: '/wp-json/pincode/v1/status',
  pages: '/wp-json/wp/v2/pages?context=edit&per_page=100&orderby=modified&order=desc&_fields=id,slug,status,title,content,modified,link',
  themes: '/wp-json/pincode/v1/themes',
  plugins: '/wp-json/pincode/v1/plugins',
};

export async function GET(request: NextRequest) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const type = request.nextUrl.searchParams.get('resource') ?? '';
  const path = sourcePaths[type];
  if (!path) return NextResponse.json({ error: 'Invalid resource' }, { status: 400 });
  try {
    return NextResponse.json(await cmsRequest<unknown>(path, session.basicAuth));
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'JSON required' }, { status: 415 });
  }
  let data: Record<string, unknown>;
  try { data = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const action = data.action;
  try {
    if (action === 'save-page') {
      const id = data.id;
      if (id !== 0 && (!Number.isSafeInteger(id) || typeof id !== 'number' || id < 1)) {
        return NextResponse.json({ error: 'Invalid page id' }, { status: 422 });
      }
      const title = typeof data.title === 'string' ? data.title.trim() : '';
      const content = typeof data.content === 'string' ? data.content : '';
      const status = data.status;
      if (!title || title.length > 250 || content.length > 150000 ||
          !['draft', 'publish', 'private', 'pending'].includes(String(status))) {
        return NextResponse.json({ error: 'Invalid page fields' }, { status: 422 });
      }
      const path = '/wp-json/wp/v2/pages' + (id === 0 ? '' : '/' + id);
      return NextResponse.json(await cmsRequest<unknown>(path, session.basicAuth, {
        method: 'POST', json: { title, content, status },
      }));
    }
    if (action === 'activate-theme' && typeof data.stylesheet === 'string' &&
        /^[a-zA-Z0-9_-]{1,100}$/.test(data.stylesheet)) {
      return NextResponse.json(await cmsRequest<unknown>('/wp-json/pincode/v1/themes/activate', session.basicAuth, {
        method: 'POST', json: { stylesheet: data.stylesheet },
      }));
    }
    if (action === 'toggle-plugin' && typeof data.plugin === 'string' &&
        /^[a-zA-Z0-9_./-]{1,200}$/.test(data.plugin) && !data.plugin.includes('..') &&
        typeof data.active === 'boolean') {
      return NextResponse.json(await cmsRequest<unknown>('/wp-json/pincode/v1/plugins/toggle', session.basicAuth, {
        method: 'POST', json: { plugin: data.plugin, active: data.active },
      }));
    }
    return NextResponse.json({ error: 'Unknown or invalid action' }, { status: 422 });
  } catch (error) { return errorResponse(error); }
}
