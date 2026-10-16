import parse, { Element, type HTMLReactParserOptions } from 'html-react-parser';
import sanitizeHtml from 'sanitize-html';
import CloudinaryImage from '@/components/CloudinaryImage';
import { cmsOrigin } from '@/lib/env';

export interface GutenbergContentProps {
  html: string;
  className?: string;
}

const allowedTags = [
  ...sanitizeHtml.defaults.allowedTags,
  'img', 'figure', 'figcaption', 'picture', 'source', 'video', 'iframe',
  'div', 'span', 'section', 'details', 'summary', 'button', 'time',
];

function dimension(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 && parsed < 20000 ? parsed : fallback;
}

export default function GutenbergContent({ html, className }: GutenbergContentProps) {
  const safe = sanitizeHtml(html, {
    allowedTags,
    allowedAttributes: {
      '*': ['class', 'id', 'title', 'role', 'dir', 'lang', 'aria-*', 'data-*', 'style'],
      a: ['href', 'target', 'rel', 'download', 'class', 'title', 'id'],
      img: ['src', 'alt', 'width', 'height', 'loading', 'decoding', 'class', 'title'],
      source: ['src', 'srcset', 'type', 'media', 'sizes'],
      video: ['src', 'controls', 'poster', 'preload', 'autoplay', 'muted', 'loop', 'width', 'height'],
      iframe: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'title', 'loading'],
      time: ['datetime'],
    },
    allowedSchemes: ['https', 'http', 'mailto', 'tel'],
    allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      a: (_tagName, attrs) => ({
        tagName: 'a',
        attribs: attrs.target === '_blank'
          ? { ...attrs, rel: 'noopener noreferrer' }
          : attrs,
      }),
    },
  });
  const options: HTMLReactParserOptions = {
    replace(node) {
      if (!(node instanceof Element) || node.name !== 'img') return;
      const attrs = node.attribs;
      const src = attrs.src;
      if (!src) return;
      let resolvedSrc: string;
      try {
        const imageUrl = new URL(src, cmsOrigin());
        if (!['https:', 'http:'].includes(imageUrl.protocol)) return;
        resolvedSrc = imageUrl.toString();
      } catch {
        return;
      }
      return (
        <CloudinaryImage
          src={resolvedSrc}
          alt={attrs.alt ?? ''}
          width={dimension(attrs.width, 960)}
          height={dimension(attrs.height, 540)}
          loading={attrs.loading === 'eager' ? 'eager' : 'lazy'}
          title={attrs.title}
          className={attrs.class}
          sizes="(max-width: 800px) 100vw, 800px"
        />
      );
    },
  };
  return <div className={className ?? 'gutenberg-content'}>{parse(safe, options)}</div>;
}
