# Real WordPress CMS + Next.js control console

## This is a headless application, not a WordPress PHP installation

The existing Vercel site is the Next.js frontend. To log in and execute PHP themes/plugins, install a REAL WordPress CMS on a separate HTTPS PHP + MariaDB/MySQL host. No default admin account or password exists.

### 1. Prepare WordPress

- Install current WordPress on a managed WordPress host or on a PHP/MySQL VPS, with HTTPS and backups.
- Upload BOTH wordpress/mu-plugins/headless-vercel-bridge.php and wordpress/mu-plugins/pincode-control-api.php to the actual wp-content/mu-plugins directory. The GitHub SSH deployment workflow is also configured to upload both.
- Install and activate WPGraphQL for frontend posts/pages, and configure the companion preview/webhook secrets as explained in README.md.
- To test downloaded PHP theme and plugin ZIP files, use a separate STAGING WordPress installation; never run untrusted packages on production.

### 2. Configure Vercel environment

Configure and redeploy with:

| Variable | Value |
| --- | --- |
| WORDPRESS_CMS_URL | HTTPS CMS root origin, no trailing wp-admin or wp-json |
| ADMIN_SESSION_SECRET | 32+ random characters (generate with openssl rand -hex 32) |
| WORDPRESS_GRAPHQL_URL | HTTPS CMS /graphql endpoint |
| WORDPRESS_AUTH_REFRESH_TOKEN | Base64 username:application-password for server-only draft queries |
| WORDPRESS_WEBHOOK_SECRET | Independent server-only secret also provided to WordPress bridge |
| WORDPRESS_PREVIEW_SECRET | Independent server-only preview signing secret |
| NEXT_PUBLIC_SITE_URL | Canonical deployed Next.js URL |

Do not put passwords in Git or NEXT_PUBLIC_ variables.

### 3. Login

1. Open the REAL WordPress host's /wp-admin and log in with the WordPress administrator account you created during WordPress installation.
2. In Users -> Profile -> Application Passwords, generate one for PINCODE Next Console.
3. Open the Vercel site /admin and enter your administrator username and the new APPLICATION password (NOT the normal WordPress password).
4. Next.js validates this against the WordPress REST API, then issues a four-hour encrypted, HttpOnly SameSite=Strict session cookie.
5. The native WordPress Gutenberg/ZIP installer links will require WordPress browser sign-in separately, using your normal account password.

### 4. Workflows supported by /admin

- Pages: list the latest 100 pages; create/edit HTML and Gutenberg block source and change publication status with the authenticated WordPress REST API. Use the 'Blocks' link for the full native visual Gutenberg editor.
- Themes: inventory of actually installed WordPress themes; 'Upload theme ZIP' opens the native WordPress installer. Staging-only activation control is available after explicit opt-in.
- Plugins: inventory of actual WordPress plugins; 'Upload plugin ZIP' opens the native WordPress installer. Staging-only activation control is available after explicit opt-in.
- CMS status: WordPress version, origin and staging state.

Actual PHP themes apply to the WordPress server, NOT the Next.js frontend. Pixel-perfect previews of WordPress themes must run on the WordPress CMS itself. WordPress plugins requiring PHP, shortcodes, or their own JavaScript also cannot automatically run in React.

ZIP uploads use native WordPress admin rather than proxying arbitrary PHP through Vercel functions; this also avoids Vercel upload size limits.

### 5. Staging opt-in

On the STAGING WordPress host only, before wp-settings.php, set:

    define('WP_ENVIRONMENT_TYPE', 'staging');
    define('PINCODE_ENABLE_STAGING_MANAGEMENT', true);

Remote plugin/theme activation remains blocked in production even if this setting is accidentally copied there.

### 6. Verification before production

- Check CMS /wp-admin login, /wp-json/wp/v2 API and /graphql work over HTTPS.
- Verify both must-use companion plugins are loaded.
- Check Next.js /admin login, Pages inventory and saving a draft, visual Gutenberg, publishing and frontend cache revalidation.
- Upload and activate a harmless ZIP theme and ZIP plugin on staging through WordPress admin; verify PHP errors and restore from backup.
- Verify expired/missing sessions give HTTP 401 and cross-site requests fail origin checks.

Next.js deployment readiness alone does NOT mean these end-to-end WordPress tests passed. A real WordPress host and its owner-created credentials are prerequisites.
