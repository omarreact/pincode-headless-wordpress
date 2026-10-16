import type { Metadata } from 'next';
import { canonicalFrontendUrl, frontendUrl } from '@/lib/env';
import type { WPContentNode } from '@/types/wordpress';

function plainText(value: string | null): string {
  return (value ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

export function postMetadata(post: WPContentNode): Metadata {
  const seo = post.headlessSeo;
  const title = seo?.title || plainText(post.title) || 'Article';
  const description = seo?.description || plainText(post.excerpt).slice(0, 160);
  const canonical = canonicalFrontendUrl(seo?.canonical, `/${post.slug}`);
  const image = seo?.openGraphImage || post.featuredImage?.node.sourceUrl;
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: !seo?.noindex, follow: !seo?.nofollow },
    openGraph: {
      title: seo?.openGraphTitle || title,
      description: seo?.openGraphDescription || description,
      url: canonical,
      type: 'article',
      images: image ? [{ url: image, alt: post.featuredImage?.node.altText ?? title }] : [],
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description, images: image ? [image] : [] },
  };
}

export function homeMetadata(): Metadata {
  return {
    title: 'Latest articles',
    description: 'Explore the latest published stories and updates.',
    alternates: { canonical: frontendUrl('/') },
  };
}
