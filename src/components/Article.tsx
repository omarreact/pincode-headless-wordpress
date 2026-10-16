import Link from 'next/link';
import CloudinaryImage from '@/components/CloudinaryImage';
import GutenbergContent from '@/components/GutenbergContent';
import type { WPContentNode } from '@/types/wordpress';

export interface ArticleProps {
  post: WPContentNode;
  isPreview?: boolean;
}

export default function Article({ post, isPreview = false }: ArticleProps) {
  const image = post.featuredImage?.node;
  return (
    <article className="mx-auto max-w-3xl px-5 pb-20 pt-12">
      {isPreview && (
        <div className="mb-8 flex items-center justify-between gap-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-950">
          <span>Private editorial preview — not indexed</span>
          <Link href="/api/exit-preview" className="underline">Exit preview</Link>
        </div>
      )}
      <header>
        {post.date && <time dateTime={post.date} className="text-sm text-slate-500">{new Date(post.date).toLocaleDateString('en-US', { dateStyle: 'long' })}</time>}
        <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-slate-950 md:text-5xl">{post.title || 'Untitled'}</h1>
      </header>
      {image?.sourceUrl && (
        <figure className="mt-9">
          <CloudinaryImage
            src={image.sourceUrl}
            alt={image.altText ?? post.title ?? ''}
            width={image.mediaDetails?.width ?? 1280}
            height={image.mediaDetails?.height ?? 720}
            priority
            sizes="(max-width: 768px) 100vw, 768px"
            className="h-auto w-full rounded-xl object-cover"
          />
        </figure>
      )}
      <GutenbergContent html={post.content ?? ''} className="gutenberg-content mt-10" />
    </article>
  );
}
