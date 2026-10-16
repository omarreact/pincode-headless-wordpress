'use client';

import { CldImage } from 'next-cloudinary';
import { extractCloudinaryId } from '@/lib/cloudinary';

export interface CloudinaryImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes?: string;
  priority?: boolean;
  className?: string;
  loading?: 'lazy' | 'eager';
  title?: string;
}

export default function CloudinaryImage({
  src,
  alt,
  width,
  height,
  sizes = '(max-width: 768px) 100vw, 768px',
  priority = false,
  className,
  loading,
  title,
}: CloudinaryImageProps) {
  const id = extractCloudinaryId(src);
  if (!id) return null;
  const isRemote = /^https?:\/\//i.test(id);
  return (
    <CldImage
      src={id}
      deliveryType={isRemote ? 'fetch' : 'upload'}
      alt={alt}
      width={Math.max(1, Math.round(width))}
      height={Math.max(1, Math.round(height))}
      sizes={sizes}
      priority={priority}
      loading={priority ? undefined : loading ?? 'lazy'}
      format="auto"
      quality="auto"
      className={className}
      title={title}
    />
  );
}
