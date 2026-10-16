<?php
/**
 * Plugin Name: Headless Vercel Bridge
 * Description: Headless Gutenberg previews, SEO fields, and asynchronous Vercel cache invalidation.
 * Version: 1.0.0
 * Requires PHP: 8.1
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Required wp-config.php constants:
 * VERCEL_REVALIDATE_URL, VERCEL_WEBHOOK_SECRET, VERCEL_PREVIEW_SECRET, FRONTEND_ORIGIN_URL.
 */
function hvb_config(string $name): string
{
    return defined($name) && is_string(constant($name)) ? trim(constant($name)) : '';
}

function hvb_enabled(): bool
{
    return hvb_config('VERCEL_REVALIDATE_URL') !== ''
        && hvb_config('VERCEL_WEBHOOK_SECRET') !== ''
        && hvb_config('VERCEL_PREVIEW_SECRET') !== ''
        && hvb_config('FRONTEND_ORIGIN_URL') !== '';
}

function hvb_slug_valid(string $slug): bool
{
    return $slug !== '' && strlen($slug) <= 200 && preg_match('/^[\p{L}\p{N}_-]+$/u', $slug) === 1;
}

function hvb_slug_for_post(WP_Post $post): string
{
    $remembered = get_post_meta($post->ID, '_hvb_last_public_slug', true);
    $candidate = rawurldecode(sanitize_title((string) $post->post_name));
    if (str_ends_with($candidate, '__trashed')) {
        $candidate = (string) preg_replace('/__trashed$/', '', $candidate);
    }
    if (hvb_slug_valid($candidate) && $post->post_status !== 'trash') {
        return $candidate;
    }
    return is_string($remembered) && hvb_slug_valid($remembered) ? $remembered : '';
}

/**
 * Dispatch asynchronously: editorial save does not block on Vercel latency.
 * A second attempt is scheduled, since nonblocking calls have no delivery ACK.
 */
function hvb_send_webhook(array $body): void
{
    if (!hvb_enabled()) {
        error_log('Headless Vercel Bridge: required wp-config.php constants missing');
        return;
    }
    $url = hvb_config('VERCEL_REVALIDATE_URL');
    if (!str_starts_with($url, 'https://')) {
        error_log('Headless Vercel Bridge: webhook URL must use HTTPS');
        return;
    }
    wp_remote_post($url, array(
        'timeout' => 2,
        'blocking' => false,
        'redirection' => 0,
        'sslverify' => true,
        'headers' => array(
            'Content-Type' => 'application/json',
            'x-webhook-secret' => hvb_config('VERCEL_WEBHOOK_SECRET'),
        ),
        'body' => wp_json_encode($body),
    ));
}

function hvb_revalidate_post(int $post_id, WP_Post $post): void
{
    if (!in_array($post->post_type, array('post', 'page'), true)) {
        return;
    }
    if (wp_is_post_revision($post_id) || wp_is_post_autosave($post_id)) {
        return;
    }
    $status = (string) $post->post_status;
    $prior_slug = (string) get_post_meta($post_id, '_hvb_last_public_slug', true);
    $current_slug = hvb_slug_for_post($post);
    if ($status !== 'publish' && $status !== 'trash') {
        if ($prior_slug !== '') {
            // Unpublish or draft transition must invalidate the last public path.
            $current_slug = $prior_slug;
        } else {
            return;
        }
    }
    if (!hvb_slug_valid($current_slug)) {
        return;
    }
    $body = array('slug' => $current_slug, 'postType' => $post->post_type);
    if (hvb_slug_valid($prior_slug) && $prior_slug !== $current_slug) {
        $body['previousSlug'] = $prior_slug;
    }
    // Deduplicate save_post + transition_post_status in one PHP request.
    static $sent = array();
    $key = $post_id . ':' . $status . ':' . $current_slug . ':' . $prior_slug;
    if (isset($sent[$key])) {
        return;
    }
    $sent[$key] = true;
    hvb_send_webhook($body);
    // WP-Cron fallback: safe duplicate revalidation for transient network errors.
    if (!wp_next_scheduled('hvb_retry_revalidate', array($body))) {
        wp_schedule_single_event(time() + 45, 'hvb_retry_revalidate', array($body));
    }
    if ($status === 'publish') {
        update_post_meta($post_id, '_hvb_last_public_slug', $current_slug);
    } elseif ($status === 'trash' || $status === 'draft' || $status === 'private') {
        delete_post_meta($post_id, '_hvb_last_public_slug');
    }
}

add_action('save_post', static function (int $post_id, WP_Post $post, bool $update): void {
    hvb_revalidate_post($post_id, $post);
}, 20, 3);

add_action('transition_post_status', static function (string $new_status, string $old_status, WP_Post $post): void {
    if ($new_status !== $old_status) {
        hvb_revalidate_post((int) $post->ID, $post);
    }
}, 20, 3);

add_action('hvb_retry_revalidate', static function (array $body): void {
    hvb_send_webhook($body);
}, 10, 1);

/** Gutenberg's native Preview action uses WordPress's preview_post_link filter. */
add_filter('preview_post_link', static function (string $url, WP_Post $post): string {
    if (!hvb_enabled() || !in_array($post->post_type, array('post', 'page'), true)) {
        return $url;
    }
    $id = (int) $post->ID;
    $expires = time() + 300;
    $signature = hash_hmac('sha256', $id . ':' . $expires, hvb_config('VERCEL_PREVIEW_SECRET'));
    return add_query_arg(array(
        'id' => $id,
        'expires' => $expires,
        'secret' => $signature,
        'slug' => $post->post_name,
    ), trailingslashit(hvb_config('FRONTEND_ORIGIN_URL')) . 'api/preview');
}, 10, 2);

/** Protect PHP-origin theme routes while retaining admin, REST, media, and GraphQL. */
add_action('template_redirect', static function (): void {
    if (is_admin() || is_user_logged_in() || wp_doing_ajax() || wp_doing_cron() ||
        (defined('REST_REQUEST') && REST_REQUEST) ||
        (defined('GRAPHQL_HTTP_REQUEST') && GRAPHQL_HTTP_REQUEST) || !hvb_enabled()) {
        return;
    }
    $path = (string) (wp_parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?: '/');
    if (preg_match('~^/(wp-admin|wp-json|graphql|wp-login\.php|wp-cron\.php|wp-content|wp-includes)(/|$)~i', $path) === 1) {
        return;
    }
    $origin = untrailingslashit(hvb_config('FRONTEND_ORIGIN_URL'));
    if (!str_starts_with($origin, 'https://')) {
        return;
    }
    $query = (string) (wp_parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_QUERY) ?: '');
    $destination = $origin . $path . ($query !== '' ? '?' . $query : '');
    wp_redirect($destination, 302, 'Headless Vercel Bridge');
    exit;
}, 1);

/** A predictable menu location for the Next.js header. */
add_action('after_setup_theme', static function (): void {
    register_nav_menus(array('primary' => 'Headless primary navigation'));
});

/**
 * Normalize metadata from active Yoast SEO or Rank Math to a stable schema.
 * WPGraphQL for Yoast / Rank Math extensions are not required for this field.
 */
function hvb_seo_for_post(int $id): array
{
    $post = get_post($id);
    if (!$post instanceof WP_Post) {
        return array();
    }
    $title = get_the_title($post);
    $description = wp_strip_all_tags((string) get_the_excerpt($post));
    $canonical = get_permalink($post);
    $og_title = $title;
    $og_description = $description;
    $og_image = get_the_post_thumbnail_url($post, 'full') ?: '';
    $noindex = false;
    $nofollow = false;

    if (function_exists('YoastSEO')) {
        try {
            $presentation = YoastSEO()->meta->for_post($id);
            if (is_object($presentation)) {
                $title = (string) ($presentation->title ?: $title);
                $description = (string) ($presentation->description ?: $description);
                $canonical = (string) ($presentation->canonical ?: $canonical);
                $og_title = (string) ($presentation->open_graph_title ?: $title);
                $og_description = (string) ($presentation->open_graph_description ?: $description);
                $og_image = (string) ($presentation->open_graph_image ?: $og_image);
                $robots = $presentation->robots ?? array();
                if (is_array($robots)) {
                    $noindex = isset($robots['index']) && $robots['index'] === 'noindex';
                    $nofollow = isset($robots['follow']) && $robots['follow'] === 'nofollow';
                }
            }
        } catch (Throwable $exception) {
            error_log('Headless Vercel Bridge: Yoast metadata unavailable');
        }
    } elseif (defined('RANK_MATH_VERSION')) {
        $custom_title = (string) get_post_meta($id, 'rank_math_title', true);
        $custom_description = (string) get_post_meta($id, 'rank_math_description', true);
        $custom_canonical = (string) get_post_meta($id, 'rank_math_canonical_url', true);
        $custom_og_title = (string) get_post_meta($id, 'rank_math_facebook_title', true);
        $custom_og_description = (string) get_post_meta($id, 'rank_math_facebook_description', true);
        $custom_image = (string) get_post_meta($id, 'rank_math_facebook_image', true);
        $robots = get_post_meta($id, 'rank_math_robots', true);
        $title = $custom_title !== '' ? $custom_title : $title;
        $description = $custom_description !== '' ? $custom_description : $description;
        $canonical = $custom_canonical !== '' ? $custom_canonical : $canonical;
        $og_title = $custom_og_title !== '' ? $custom_og_title : $title;
        $og_description = $custom_og_description !== '' ? $custom_og_description : $description;
        $og_image = $custom_image !== '' ? $custom_image : $og_image;
        $noindex = is_array($robots) && in_array('noindex', $robots, true);
        $nofollow = is_array($robots) && in_array('nofollow', $robots, true);
    }

    return array(
        'title' => wp_strip_all_tags($title),
        'description' => wp_strip_all_tags($description),
        'canonical' => esc_url_raw((string) $canonical),
        'openGraphTitle' => wp_strip_all_tags($og_title),
        'openGraphDescription' => wp_strip_all_tags($og_description),
        'openGraphImage' => esc_url_raw($og_image),
        'noindex' => (bool) $noindex,
        'nofollow' => (bool) $nofollow,
    );
}

add_action('graphql_register_types', static function (): void {
    if (!function_exists('register_graphql_object_type') || !function_exists('register_graphql_field')) {
        return;
    }
    register_graphql_object_type('HeadlessSeoData', array(
        'description' => 'Portable SEO metadata for headless frontends',
        'fields' => array(
            'title' => array('type' => 'String'),
            'description' => array('type' => 'String'),
            'canonical' => array('type' => 'String'),
            'openGraphTitle' => array('type' => 'String'),
            'openGraphDescription' => array('type' => 'String'),
            'openGraphImage' => array('type' => 'String'),
            'noindex' => array('type' => 'Boolean'),
            'nofollow' => array('type' => 'Boolean'),
        ),
    ));
    foreach (array('Post', 'Page') as $graphql_type) {
        register_graphql_field($graphql_type, 'headlessSeo', array(
            'type' => 'HeadlessSeoData',
            'description' => 'Yoast SEO / Rank Math SEO normalized metadata',
            'resolve' => static function ($source): ?array {
                $id = isset($source->databaseId) ? (int) $source->databaseId : 0;
                return $id > 0 ? hvb_seo_for_post($id) : null;
            },
        ));
    }
});
