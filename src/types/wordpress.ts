export interface GraphQLErrorDetail {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
}

export interface GraphQLPayload<T> {
  data?: T | null;
  errors?: GraphQLErrorDetail[];
}

export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface Connection<T> {
  nodes: T[];
  pageInfo: PageInfo;
}

export interface WPImage {
  sourceUrl: string;
  altText: string | null;
  mediaDetails: { width: number | null; height: number | null } | null;
}

export interface WPAuthor {
  name: string;
  slug: string | null;
}

export interface WPCategory {
  id: string;
  name: string;
  slug: string;
}

export interface WPSEO {
  title: string | null;
  description: string | null;
  canonical: string | null;
  openGraphTitle: string | null;
  openGraphDescription: string | null;
  openGraphImage: string | null;
  noindex: boolean;
  nofollow: boolean;
}

export interface WPContentNode {
  id: string;
  databaseId: number;
  slug: string;
  uri: string | null;
  status: string;
  title: string | null;
  content: string | null;
  excerpt: string | null;
  date: string | null;
  modified: string | null;
  isPreview: boolean | null;
  featuredImage: { node: WPImage } | null;
  headlessSeo: WPSEO | null;
}

export interface WPPost extends WPContentNode {
  author: { node: WPAuthor } | null;
  categories: { nodes: WPCategory[] } | null;
}

export interface WPPostSummary {
  id: string;
  slug: string;
  title: string | null;
  excerpt: string | null;
  date: string | null;
  featuredImage: { node: WPImage } | null;
}

export interface WPMenuItem {
  id: string;
  label: string | null;
  path: string | null;
  url: string | null;
  parentId: string | null;
  target: string | null;
}

export interface WPPostsResponse {
  posts: Connection<WPPostSummary>;
}

export interface WPPostResponse {
  post: WPPost | null;
}

export interface WPPageResponse {
  page: WPContentNode | null;
}

export interface WPPostSlugResponse {
  posts: Connection<{ slug: string }>;
}

export interface WPMenuResponse {
  menuItems: { nodes: WPMenuItem[] };
}

export interface WPPreviewTarget {
  id: string;
  databaseId: number;
  slug: string;
  status: string;
}

export interface WPPreviewTargetResponse {
  post: WPPreviewTarget | null;
  page: WPPreviewTarget | null;
}

export type PublishedContent = WPPost | WPContentNode;
