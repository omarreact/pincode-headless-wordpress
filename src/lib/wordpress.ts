import 'server-only';
import { requireEnv } from '@/lib/env';
import type {
  GraphQLPayload,
  WPMenuItem,
  WPMenuResponse,
  WPPageResponse,
  WPPost,
  WPPostResponse,
  WPPostsResponse,
  WPPostSlugResponse,
  WPPostSummary,
  WPPreviewTarget,
  WPPreviewTargetResponse,
  WPContentNode,
} from '@/types/wordpress';

export interface WPFetchOptions {
  isDraft?: boolean;
  tags?: string[];
  previewDatabaseId?: number;
  featuredImageDatabaseId?: number;
}

interface GraphQLRequestBody {
  query: string;
  variables: Record<string, unknown>;
}

export class WordPressRequestError extends Error {
  constructor(message: string, public readonly httpStatus: number | null) {
    super(message);
    this.name = 'WordPressRequestError';
  }
}

export async function wpFetch<T>(
  query: string,
  variables: Record<string, unknown> = {},
  options: WPFetchOptions = {},
): Promise<T> {
  const url = requireEnv('WORDPRESS_GRAPHQL_URL');
  if (new URL(url).protocol !== 'https:') {
    throw new WordPressRequestError('GraphQL origin must use HTTPS', null);
  }
  const body: GraphQLRequestBody = { query, variables };
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (options.isDraft) {
    headers.Authorization = `Basic ${requireEnv('WORDPRESS_AUTH_REFRESH_TOKEN')}`;
    if (options.previewDatabaseId !== undefined) {
      const extras = options.featuredImageDatabaseId !== undefined
        ? `, featured_image_database_id=${options.featuredImageDatabaseId}` : '';
      headers['X-GraphQL-Preview'] = `database_id=${options.previewDatabaseId}${extras}`;
    }
  }
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
      ...(options.isDraft
        ? { cache: 'no-store' as const }
        : { next: { revalidate: 3600, tags: ['wordpress', ...(options.tags ?? [])] } }),
    });
  } catch (error: unknown) {
    throw new WordPressRequestError(
      error instanceof Error ? `WordPress network failure: ${error.message}` : 'WordPress network failure',
      null,
    );
  }
  if (!response.ok) {
    throw new WordPressRequestError(`WPGraphQL returned HTTP ${response.status}`, response.status);
  }
  let payload: GraphQLPayload<T>;
  try {
    payload = (await response.json()) as GraphQLPayload<T>;
  } catch {
    throw new WordPressRequestError('WPGraphQL returned invalid JSON', response.status);
  }
  if (payload.errors?.length) {
    throw new WordPressRequestError(
      `WPGraphQL: ${payload.errors.map((entry) => entry.message).join('; ')}`,
      response.status,
    );
  }
  if (payload.data === undefined || payload.data === null) {
    throw new WordPressRequestError('WPGraphQL returned no data', response.status);
  }
  return payload.data;
}

const IMAGE_FIELDS = `
  featuredImage {
    node { sourceUrl altText mediaDetails { width height } }
  }
`;

const CONTENT_FIELDS = `
  id databaseId slug uri status title content excerpt date modified isPreview
  ${IMAGE_FIELDS}
  headlessSeo { title description canonical openGraphTitle openGraphDescription openGraphImage noindex nofollow }
`;

const POST_QUERY = `
  query PostBySlug($slug: ID!) {
    post(id: $slug, idType: SLUG) {
      ${CONTENT_FIELDS}
      author { node { name slug } }
      categories { nodes { id name slug } }
    }
  }
`;

const PAGE_QUERY = `
  query PageBySlug($slug: ID!) {
    page(id: $slug, idType: URI) { ${CONTENT_FIELDS} }
  }
`;

const POST_BY_ID_QUERY = `
  query PostById($id: ID!) {
    post(id: $id, idType: DATABASE_ID) {
      ${CONTENT_FIELDS}
      author { node { name slug } }
      categories { nodes { id name slug } }
    }
  }
`;

const PAGE_BY_ID_QUERY = `
  query PageById($id: ID!) {
    page(id: $id, idType: DATABASE_ID) { ${CONTENT_FIELDS} }
  }
`;

export async function getAllPosts(first = 12): Promise<WPPostSummary[]> {
  const limit = Math.min(Math.max(Math.floor(first), 1), 100);
  const data = await wpFetch<WPPostsResponse>(`
    query LatestPosts($first: Int!) {
      posts(first: $first, where: { status: PUBLISH }) {
        nodes { id slug title excerpt date ${IMAGE_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    }
  `, { first: limit }, { tags: ['posts'] });
  return data.posts.nodes;
}

export async function getPostBySlug(slug: string, isDraft = false): Promise<WPPost | WPContentNode | null> {
  if (!/^[\p{L}\p{N}_-]{1,200}$/u.test(slug)) return null;
  const options: WPFetchOptions = { isDraft, tags: ['posts', `post-${slug}`] };
  const postResult = await wpFetch<WPPostResponse>(POST_QUERY, { slug }, options);
  if (postResult.post) return isDraft ? getPostById(postResult.post.databaseId, true) : postResult.post;
  const pageResult = await wpFetch<WPPageResponse>(PAGE_QUERY, { slug: `/${slug}/` }, options);
  return isDraft && pageResult.page
    ? getPostById(pageResult.page.databaseId, true)
    : pageResult.page;
}

export async function getPostById(
  id: number,
  isDraft: boolean,
  featuredImageDatabaseId?: number,
): Promise<WPPost | WPContentNode | null> {
  if (!Number.isSafeInteger(id) || id < 1) return null;
  const options: WPFetchOptions = {
    isDraft,
    previewDatabaseId: isDraft ? id : undefined,
    featuredImageDatabaseId,
    tags: ['posts'],
  };
  const data = await wpFetch<WPPostResponse>(POST_BY_ID_QUERY, { id: String(id) }, options);
  if (data.post) return data.post;
  const page = await wpFetch<WPPageResponse>(PAGE_BY_ID_QUERY, { id: String(id) }, options);
  return page.page;
}

export async function getAllPostSlugs(): Promise<string[]> {
  const collected: string[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 100; page += 1) {
    const data: WPPostSlugResponse = await wpFetch<WPPostSlugResponse>(`
      query PostSlugs($after: String) {
        posts(first: 100, after: $after, where: { status: PUBLISH }) {
          nodes { slug }
          pageInfo { hasNextPage endCursor }
        }
      }
    `, { after: cursor }, { tags: ['posts'] });
    collected.push(...data.posts.nodes.map((post) => post.slug).filter(Boolean));
    if (!data.posts.pageInfo.hasNextPage) return [...new Set(collected)];
    cursor = data.posts.pageInfo.endCursor;
    if (!cursor) throw new WordPressRequestError('Cursor missing during post pagination', null);
  }
  throw new WordPressRequestError('Post pagination exceeded 10,000 entries; use a narrower build query', null);
}

export async function getNavigationMenu(location: string): Promise<WPMenuItem[]> {
  if (!/^[A-Z][A-Z0-9_]*$/.test(location)) {
    throw new Error('WordPress menu location must be a GraphQL enum identifier');
  }
  const data = await wpFetch<WPMenuResponse>(`
    query Navigation($location: MenuLocationEnum!) {
      menuItems(first: 100, where: { location: $location }) {
        nodes { id label path url parentId target }
      }
    }
  `, { location }, { tags: ['navigation'] });
  return data.menuItems.nodes;
}

export async function verifyPreviewTarget(id: number): Promise<WPPreviewTarget | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const result = await wpFetch<WPPreviewTargetResponse>(`
    query VerifyPreview($id: ID!) {
      post(id: $id, idType: DATABASE_ID) { id databaseId slug status }
      page(id: $id, idType: DATABASE_ID) { id databaseId slug status }
    }
  `, { id: String(id) }, { isDraft: true });
  return result.post ?? result.page;
}
