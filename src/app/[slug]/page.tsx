import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Article from '@/components/Article';
import { postMetadata } from '@/lib/seo';
import { getAllPostSlugs, getPostBySlug } from '@/lib/wordpress';

export const dynamicParams = true;
export const revalidate = 3600;
export interface SlugPageProps { params: Promise<{ slug: string }> }

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  if (!process.env.WORDPRESS_GRAPHQL_URL) return [];
  const slugs = await getAllPostSlugs();
  return slugs.slice(0, 50).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: SlugPageProps): Promise<Metadata> {
  if (!process.env.WORDPRESS_GRAPHQL_URL) return { robots: { index: false } };
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post || post.status.toLowerCase() !== 'publish') return { robots: { index: false } };
  return postMetadata(post);
}

export default async function SlugPage({ params }: SlugPageProps) {
  if (!process.env.WORDPRESS_GRAPHQL_URL) notFound();
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post || post.status.toLowerCase() !== 'publish') notFound();
  return <Article post={post} />;
}
