<?php
/**
 * Plugin Name: PINCODE WordPress Control API
 * Description: Administrator-only theme/plugin inventory and staging-gated activation for the Next.js console.
 * Version: 1.0.0
 * Requires PHP: 8.1
 */
declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

function pincode_remote_admin_allowed(): bool
{
    return current_user_can('manage_options');
}

function pincode_remote_mutations_allowed(): bool
{
    // Staging is mandatory. Never allow remote theme/plugin toggles on production.
    return wp_get_environment_type() === 'staging'
        && defined('PINCODE_ENABLE_STAGING_MANAGEMENT')
        && PINCODE_ENABLE_STAGING_MANAGEMENT === true;
}

add_action('rest_api_init', static function (): void {
    register_rest_route('pincode/v1', '/status', array(
        'methods' => 'GET',
        'permission_callback' => 'pincode_remote_admin_allowed',
        'callback' => static function (): WP_REST_Response {
            return rest_ensure_response(array(
                'site' => get_bloginfo('name'),
                'wordpress' => get_bloginfo('version'),
                'origin' => home_url('/'),
                'environment' => wp_get_environment_type(),
                'canManageStaging' => pincode_remote_mutations_allowed(),
                'adminUrl' => admin_url(),
                'canEditPages' => current_user_can('edit_pages'),
                'canInstallPlugins' => current_user_can('install_plugins'),
                'canInstallThemes' => current_user_can('install_themes'),
            ));
        },
    ));
    register_rest_route('pincode/v1', '/themes', array(
        'methods' => 'GET',
        'permission_callback' => 'pincode_remote_admin_allowed',
        'callback' => static function (): WP_REST_Response {
            $items = array();
            foreach (wp_get_themes() as $slug => $theme) {
                $items[] = array(
                    'stylesheet' => (string) $slug,
                    'name' => $theme->get('Name'),
                    'version' => $theme->get('Version'),
                    'description' => $theme->get('Description'),
                    'active' => $slug === get_stylesheet(),
                );
            }
            return rest_ensure_response($items);
        },
    ));
    register_rest_route('pincode/v1', '/plugins', array(
        'methods' => 'GET',
        'permission_callback' => 'pincode_remote_admin_allowed',
        'callback' => static function (): WP_REST_Response {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
            $items = array();
            foreach (get_plugins() as $file => $plugin) {
                $items[] = array(
                    'file' => $file,
                    'name' => $plugin['Name'],
                    'version' => $plugin['Version'],
                    'description' => wp_strip_all_tags($plugin['Description']),
                    'active' => is_plugin_active($file),
                );
            }
            return rest_ensure_response($items);
        },
    ));
    register_rest_route('pincode/v1', '/themes/activate', array(
        'methods' => 'POST',
        'permission_callback' => static function () {
            return pincode_remote_mutations_allowed() && current_user_can('switch_themes');
        },
        'callback' => static function (WP_REST_Request $request) {
            $slug = (string) $request->get_param('stylesheet');
            if (!preg_match('/^[a-zA-Z0-9_-]{1,100}$/', $slug) || !wp_get_theme($slug)->exists()) {
                return new WP_Error('invalid_theme', 'Theme not installed.', array('status' => 422));
            }
            switch_theme($slug);
            return rest_ensure_response(array('ok' => true, 'active' => get_stylesheet()));
        },
    ));
    register_rest_route('pincode/v1', '/plugins/toggle', array(
        'methods' => 'POST',
        'permission_callback' => static function () {
            return pincode_remote_mutations_allowed() && current_user_can('activate_plugins');
        },
        'callback' => static function (WP_REST_Request $request) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
            $file = (string) $request->get_param('plugin');
            $active = $request->get_param('active');
            if (!is_bool($active) || validate_file($file) !== 0 || !array_key_exists($file, get_plugins())) {
                return new WP_Error('invalid_plugin', 'Plugin not installed or action invalid.', array('status' => 422));
            }
            if ($active) {
                $result = activate_plugin($file);
                if (is_wp_error($result)) return $result;
            } else {
                deactivate_plugins($file);
            }
            return rest_ensure_response(array('ok' => true, 'active' => is_plugin_active($file)));
        },
    ));
});
