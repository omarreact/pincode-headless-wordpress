import 'server-only';

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) throw new Error(`Missing required environment variable: ${name}`);
  return value.trim();
}

export function siteOrigin(): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const vercelHostname = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const computed = configured || (vercelHostname ? `https://${vercelHostname}` : 'http://localhost:3000');
  const origin = new URL(computed);
  if (origin.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_SITE_URL must use HTTPS in production');
  }
  return origin;
}

export function cmsOrigin(): URL {
  return new URL(requireEnv('WORDPRESS_GRAPHQL_URL'));
}

export function frontendUrl(path: string): string {
  return new URL(path.startsWith('/') ? path : `/${path}`, siteOrigin()).toString();
}

export function canonicalFrontendUrl(candidate: string | null | undefined, fallbackPath: string): string {
  if (!candidate) return frontendUrl(fallbackPath);
  try {
    const parsed = new URL(candidate, cmsOrigin());
    if (parsed.host === cmsOrigin().host || parsed.host === siteOrigin().host) {
      return frontendUrl(parsed.pathname + parsed.search);
    }
    return parsed.protocol === 'https:' ? parsed.toString() : frontendUrl(fallbackPath);
  } catch {
    return frontendUrl(fallbackPath);
  }
}
