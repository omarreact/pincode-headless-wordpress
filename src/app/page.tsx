import type { Metadata } from 'next';
import PostCard from '@/components/PostCard';
import { homeMetadata } from '@/lib/seo';
import { getAllPosts } from '@/lib/wordpress';

export const revalidate = 3600;
export const metadata: Metadata = homeMetadata();

export default async function HomePage() {
  const configured = Boolean(process.env.WORDPRESS_GRAPHQL_URL);
  const posts = configured ? await getAllPosts(24) : [];
  return (
    <>
      <section className="editorial-hero">
        <div className="editorial-halo" aria-hidden="true" />
        <div className="editorial-hero-inner">
          <div className="editorial-topline"><span>PINCODE IT / INSIGHTS</span><span>THOUGHTFUL ENGINEERING ↗</span></div>
          <div className="editorial-headline">
            <p className="editorial-eyebrow">Perspective · Engineering · Operations</p>
            <h1>Better digital systems begin with <em>clear thinking.</em></h1>
            <p className="editorial-lead">Technical notes, ideas and practical perspectives on building software that lasts.</p>
            <a className="editorial-button" href="#latest">Explore insights <span aria-hidden="true">↓</span></a>
          </div>
          <div className="editorial-bottomline"><span>BUILD · IMPROVE · PROTECT · SUPPORT</span><span>SCROLL TO EXPLORE ↓</span></div>
        </div>
      </section>
      <section id="latest" className="editorial-feed">
        <div className="editorial-feed-title"><div><p className="editorial-eyebrow">FIELD NOTES / PINCODE IT</p><h2>Latest perspectives.</h2></div><p>Meaningful ideas for teams building dependable digital experiences.</p></div>
        {posts.length ? <div className="editorial-grid">
          {posts.map((post, index) => <PostCard key={post.id} post={post} priority={index === 0} />)}
        </div> : <div className="editorial-empty" role="status">{configured ? 'No published articles yet.' : 'Editorial articles will appear after WordPress is connected.'}</div>}
      </section>
    </>
  );
}
