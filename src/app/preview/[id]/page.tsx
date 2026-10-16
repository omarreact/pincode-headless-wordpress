import type { Metadata } from 'next';
import { cookies, draftMode } from 'next/headers';
import { notFound } from 'next/navigation';
import Article from '@/components/Article';
import { validScopeCookie } from '@/lib/preview';
import { getPostById } from '@/lib/wordpress';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Editorial preview',
  robots: { index: false, follow: false, nocache: true },
};

export interface PreviewPageProps { params: Promise<{ id: string }> }

export default async function PreviewPage({ params }: PreviewPageProps) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  const mode = await draftMode();
  const cookieStore = await cookies();
  if (!mode.isEnabled || !Number.isSafeInteger(id) || id <= 0 ||
      !validScopeCookie(cookieStore.get('wp-preview-scope')?.value, id)) notFound();
  const post = await getPostById(id, true);
  if (!post) notFound();
  return <Article post={post} isPreview />;
}
