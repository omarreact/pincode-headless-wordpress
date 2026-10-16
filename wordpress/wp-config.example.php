<?php
/**
 * Copy these declarations inside your existing wp-config.php before
 * `require_once ABSPATH . 'wp-settings.php';`.
 * They are NOT a standalone replacement wp-config.php.
 * Inject all values via the server/VPS environment or secret manager.
 */
$hvb_names = array(
    'VERCEL_REVALIDATE_URL',
    'VERCEL_WEBHOOK_SECRET',
    'VERCEL_PREVIEW_SECRET',
    'FRONTEND_ORIGIN_URL',
    'CLOUDINARY_URL',
);
foreach ($hvb_names as $hvb_name) {
    $hvb_value = getenv($hvb_name);
    if ($hvb_value === false || trim($hvb_value) === '') {
        throw new RuntimeException('Missing WordPress environment variable: ' . $hvb_name);
    }
    define($hvb_name, $hvb_value);
}
unset($hvb_names, $hvb_name, $hvb_value);
