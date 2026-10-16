import Link from 'next/link';
import type { Metadata } from 'next';
import { getNavigationMenu } from '@/lib/wordpress';
import { siteOrigin } from '@/lib/env';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: siteOrigin(),
  title: { default: 'PINCODE IT — Insights', template: '%s | PINCODE IT' },
  description: 'Ideas and technical perspectives on engineered software, cloud platforms and reliable digital systems.',
};
export interface RootLayoutProps { children: React.ReactNode }
export default async function RootLayout({ children }: RootLayoutProps) {
  let menu: Awaited<ReturnType<typeof getNavigationMenu>> = [];
  if (process.env.WORDPRESS_GRAPHQL_URL) {
    try { menu = await getNavigationMenu('PRIMARY'); }
    catch (error: unknown) { console.error('Primary WordPress menu unavailable', error instanceof Error ? error.message : error); }
  }
  return (
    <html lang="en"><body className="min-h-screen antialiased">
      <a className="skip-to-content" href="#main-content">Skip to content</a>
      <div className="site-announcement">PINCODE IT <span aria-hidden="true">/</span> Ideas built on engineering</div>
      <header className="site-header"><nav className="site-nav" aria-label="Main navigation">
        <Link href="/" className="site-logo" aria-label="PINCODE IT insights home"><span className="site-logo-mark" aria-hidden="true">P</span><span>PINCODE <b>IT</b></span></Link>
        <div className="site-nav-links"><Link href="/">Insights</Link>
          {menu.filter(item => !item.parentId && item.label).map(item => (
            <Link key={item.id} href={item.path?.startsWith('/') ? item.path : '/'}>{item.label}</Link>
          ))}
          <a href="https://www.pincodeit.com" className="site-back-link">Agency site <span aria-hidden="true">↗</span></a>
        </div>
      </nav></header>
      <main id="main-content">{children}</main>
      <footer className="site-footer">
        <div><strong>PINCODE IT</strong><p>Build. Improve. Protect. Support.</p></div>
        <div><a href="https://www.pincodeit.com">Agency website ↗</a><p>© {new Date().getFullYear()} PINCODE IT. All rights reserved.</p></div>
      </footer>
    </body></html>
  );
}
