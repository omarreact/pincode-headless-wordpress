import Link from 'next/link';
import CloudinaryImage from '@/components/CloudinaryImage';
import type { WPPostSummary } from '@/types/wordpress';

export interface PostCardProps {
  post: WPPostSummary;
  priority?: boolean;
}

export default function PostCard({ post, priority = false }: PostCardProps) {
  const image = post.featuredImage?.node;
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <Link href={`/${encodeURIComponent(post.slug)}`} className="group block">
        {image?.sourceUrl && (
          <div className="overflow-hidden bg-slate-100">
            <CloudinaryImage
              src={image.sourceUrl}
              alt={image.altText ?? post.title ?? ''}
              width={image.mediaDetails?.width ?? 1200}
              height={image.mediaDetails?.height ?? 675}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="aspect-video w-full object-cover transition group-hover:scale-[1.02]"
              priority={priority}
            />
          </div>
        )}
        <div className="p-6">
          {post.date && <time dateTime={post.date} className="text-xs font-semibold uppercase tracking-wider text-slate-500">{new Date(post.date).toLocaleDateString('en-US', { dateStyle: 'medium' })}</time>}
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">{post.title || 'Untitled'}</h2>
          <p className="mt-3 text-sm font-medium text-blue-700">Read article →</p>
        </div>
      </Link>
    </article>
  );
}
