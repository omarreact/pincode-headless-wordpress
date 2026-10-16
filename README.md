# PINCODE IT Headless WordPress — Independent Project

**Independent repository:** `omarreact/pincode-headless-wordpress`. This project does not alter the existing `omarreact/pincode` source, its Vercel configuration, or its production domain.

# Headless WordPress + Next.js + Cloudinary + Cloudflare + Vercel

This repository implements a five-tier headless WordPress publishing stack. Next.js 16 App Router renders WordPress posts and pages, the official Cloudinary WordPress plugin synchronizes editor-uploaded media, Cloudflare protects the CMS origin, and GitHub Actions ships the must-use WordPress bridge over SSH. Editors write in Gutenberg, publish, and preview from the ordinary WordPress editor.

## Requirements and operational truth

- A real domain and administrator access to DNS, GitHub, Vercel, Cloudinary, and the non-cPanel WordPress host are required; no example hostname, password, Cloudinary account, or VPS address can be a working production value.
- WordPress 6.4+ on current supported PHP (8.2+ recommended), a TLS-enabled public `/graphql`, WPGraphQL, and the **official** Cloudinary WordPress plugin.
- WordPress **Application Passwords** with server-to-server Basic Authentication over HTTPS. `WORDPRESS_AUTH_REFRESH_TOKEN` is an inherited variable name, not an OAuth refresh token. Its value is the Base64 encoding of `username:application-password` (without the literal `Basic ` prefix).
- Node.js 22 recommended (20.9+ minimum), Next.js 16.3.7, React 19.2, Tailwind CSS 4, and a Vercel account with GitHub integration.
- The **same WordPress must-use plugin in this repository must be installed before the first Next.js build** because the WPGraphQL queries reference its `headlessSeo` fields.
- Cloudinary remote-fetch delivery for non-Cloudinary image URLs must be explicitly allowed in the Cloudinary account; the default path is offloaded WordPress media with normal Cloudinary public IDs.
- Most Gutenberg core blocks render from WPGraphQL's `content` HTML. Custom dynamic blocks may need their rendering plugins installed on the WordPress origin and must allow safe output through the HTML sanitizer. JavaScript-dependent blocks do not automatically acquire their browser-side WordPress runtime.
- On-demand ISR requests acknowledge **invalidation**, not immediate global regeneration. `revalidateTag(..., 'max')` is stale-while-revalidate; `revalidatePath` marks the affected URLs to re-render. For hard deletes/unpublishes where even one stale view is unacceptable, use a separate uncached entitlement or editorial-gating architecture.

## System topology

```text
Visitor -> Cloudflare DNS-only apex/www -> Vercel edge/Next.js App Router
                                                   |
                                           server-only WPGraphQL
                                                   |
Editor -> Cloudflare WAF (orange cloud) -> cms domain -> managed WordPress/PHP
             |                                     |
       /wp-admin, /graphql                    Cloudinary WordPress plugin
                                                   |
                                            res.cloudinary.com CDN

Gutenberg Publish -> mu-plugin async webhook -> Vercel /api/revalidate
Gutenberg Preview -> signed short-lived link -> Vercel /api/preview
GitHub main -> Vercel auto deploy + SSH action -> WordPress mu-plugin
```

## Repository structure

```text
headless-wordpress-vercel/
├── .env.example
├── .gitignore
├── .github/workflows/
│   ├── ci.yml
│   └── deploy-wordpress.yml
├── README.md
├── eslint.config.mjs
├── next-env.d.ts
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tsconfig.json
├── src/
│   ├── app/
│   │   ├── [slug]/page.tsx
│   │   ├── api/
│   │   │   ├── exit-preview/route.ts
│   │   │   ├── preview/route.ts
│   │   │   └── revalidate/route.ts
│   │   ├── preview/[id]/page.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── Article.tsx
│   │   ├── CloudinaryImage.tsx
│   │   ├── GutenbergContent.tsx
│   │   └── PostCard.tsx
│   ├── lib/
│   │   ├── cloudinary.ts
│   │   ├── env.ts
│   │   ├── preview.ts
│   │   ├── seo.ts
│   │   └── wordpress.ts
│   └── types/wordpress.ts
├── tests/cloudinary.test.mjs
└── wordpress/
    ├── mu-plugins/headless-vercel-bridge.php
    └── wp-config.example.php
```

## End-to-end deployment runbook

### 1. Create and secure the non-cPanel WordPress origin

1. Provision **Pressable / WP Cloud** (managed WordPress), or a supported Linux VPS at DigitalOcean / Hetzner with maintained PHP-FPM, MySQL/MariaDB, Nginx, backups, patches, and TLS. For a first production site, managed WordPress is preferable. Do not install cPanel.
2. Install WordPress at your real CMS hostname and ensure **Settings → General** WordPress Address and Site Address both use its HTTPS origin. Use a maintained theme to preserve admin and Gutenberg compatibility; the mu-plugin redirects anonymous public theme requests.
3. Install and activate plugins **WPGraphQL** and **Cloudinary – Image and Video Optimization, Manipulation, and Delivery** in Plugins → Add New. Optionally activate **Yoast SEO** or **Rank Math SEO** (do not activate both SEO plugins at once). WPGraphQL must return a JSON object from `/graphql` on authenticated **and** anonymous POST requests, with no HTML challenge injected by Cloudflare.
4. Copy `wordpress/mu-plugins/headless-vercel-bridge.php` to the **actual** `wp-content/mu-plugins/` folder, not the ordinary `plugins/` folder. Must-use plugins load automatically. Confirm in WordPress → Plugins → Must-Use.
5. Configure an HTTPS-enabled PHP-origin certificate signed by Let's Encrypt or Cloudflare Origin CA (Cloudflare Origin CA is valid only when connecting via Cloudflare). If running a VPS, close public MySQL, ensure port 443 and SSH are controlled, set least-privileged filesystem permissions, and enable daily offsite database backups.
6. Configure a cron job with a real system cron or managed host cron for `wp-cron.php` every minute if `DISABLE_WP_CRON` is enabled. This drives the 45-second fallback retry. Any retry webhook is idempotent.
7. Install required WordPress constants **before** WordPress loads. Inject variables from the host secret store. `wordpress/wp-config.example.php` shows the concrete declaration logic. Insert it near the beginning of your *existing* `wp-config.php` without duplicating the opening `<?php` tag and before the `wp-settings.php` require. Do not overwrite the real WordPress config.
8. In Appearance → Menus, create a menu and assign it to **Headless primary navigation**. Even if you have no menu, the Next.js header still displays a home link.

### 2. Configure secrets (actual account values only)

Set these in **Vercel → Project → Settings → Environment Variables**, with Production/Preview/Development scopes as appropriate:

| Key | Destination | Value / rule |
| --- | --- | --- |
| `WORDPRESS_GRAPHQL_URL` | Vercel | Real `https://` CMS GraphQL endpoint |
| `WORDPRESS_AUTH_REFRESH_TOKEN` | Vercel secret | Base64 of the WordPress editor service account's `username:application-password` |
| `WORDPRESS_WEBHOOK_SECRET` | Vercel secret | 32+ random bytes expressed in hex, shared with WordPress as `VERCEL_WEBHOOK_SECRET` |
| `WORDPRESS_PREVIEW_SECRET` | Vercel secret | Independent 32+ random bytes expressed in hex, shared with WordPress as `VERCEL_PREVIEW_SECRET` |
| `NEXT_PUBLIC_SITE_URL` | Vercel | Real canonical `https://` frontend origin, no trailing slash |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Vercel | Public Cloudinary cloud name, no API credentials |
| `VERCEL_REVALIDATE_URL` | WordPress origin | `NEXT_PUBLIC_SITE_URL` with `/api/revalidate` path |
| `FRONTEND_ORIGIN_URL` | WordPress origin | Same real canonical frontend origin |
| `VERCEL_WEBHOOK_SECRET` | WordPress origin | Identical value to `WORDPRESS_WEBHOOK_SECRET` |
| `VERCEL_PREVIEW_SECRET` | WordPress origin | Identical value to `WORDPRESS_PREVIEW_SECRET` |
| `CLOUDINARY_URL` | WordPress origin only | From Cloudinary Console; `cloudinary://API_KEY:API_SECRET@CLOUD_NAME` |

Generate two separate secrets locally:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Encode the generated WordPress Application Password and its matching username locally:

```bash
read -r -p 'WordPress service username: ' WP_USER
read -r -s -p 'WordPress application password: ' WP_APP_PASSWORD
printf '\n'
printf '%s' "$WP_USER:$WP_APP_PASSWORD" | base64 | tr -d '\n'
printf '\n'
unset WP_USER WP_APP_PASSWORD
```

Do **not** store `CLOUDINARY_URL`, `WORDPRESS_AUTH_REFRESH_TOKEN`, the webhook secret, or preview secret in any `NEXT_PUBLIC_` value or in Git. Give the service account editor rights only to content it must preview. Revoke and rotate application passwords periodically. Ensure that Cloudflare allows the `Authorization` header on `/graphql` and that your WordPress authentication works with WPGraphQL for draft requests.

### 3. Configure Cloudinary sync and delivery

1. In Cloudinary Console, copy the `CLOUDINARY_URL` API Environment variable. Add it to the WordPress host's secret store and make it available as the constant `CLOUDINARY_URL` in `wp-config.php`, or enter it once in the Cloudinary WordPress plugin wizard (avoid contradictory credentials).
2. Finish the official plugin setup. Under **General Settings → Media Library Sync Settings**, enable **Auto-sync**. Choose **Cloudinary + WordPress (low resolution)** for lower origin storage with a recovery option, or **Cloudinary only** to remove original local uploads.
3. **Back up all media before switching to Cloudinary only**. Turning that mode off later requires syncing assets back from Cloudinary. Never delete/reorganize images directly in Cloudinary's library if WordPress is managing them.
4. Run a bulk media sync. Verify newly uploaded and existing media report **Synced**, and an image URL resolves under `res.cloudinary.com`. The `<CloudinaryImage />` component turns a delivered image URL into a public ID and applies `f_auto`, `q_auto`, responsive `sizes`, and priority preload for featured images.
5. For residual WordPress-hosted/external absolute image URLs, either resync those files through the plugin or permit Cloudinary remote `fetch` delivery under the account's security settings. Cloudinary Fetch may require enabling the feature; review your account's security settings before enabling arbitrary external sources.
6. Enable HTTPS for all media. If an image is `http://` on the editor side, migrate the URL to HTTPS rather than relying on mixed-content browser behavior.

### 4. Configure Cloudflare DNS, TLS, and WAF

1. Delegate the intended domain's nameservers to Cloudflare **only after copying all existing DNS records, including MX/SPF/DKIM/DMARC**. If the domain is presently on Vercel nameservers, transferring nameservers is a separate, explicit migration; do not modify the existing zone blindly.
2. Add the frontend apex **A** record (`@`) to the IPv4 value **shown for your exact Vercel project** (Vercel's general-purpose IPv4 is `76.76.21.21` as of March 2026). Add `www` **CNAME** to the exact Vercel-provided alias (its general-purpose alias is `cname.vercel-dns-0.com`). Keep **both DNS-only / grey cloud** to avoid double-caching ISR and suppressing Vercel security signals. Vercel explicitly discourages a second reverse proxy in front of its CDN. If your organizational policy requires proxied frontend traffic, you must also implement Cloudflare cache purges and accept the traffic/security tradeoffs.
3. Add a `cms` **A** record targeting the **actual PHP-origin public IPv4**. Set **Proxied / orange cloud**. Do not use an unverified VPS IP.
4. Set **SSL/TLS → Full (strict)** only after confirming the CMS origin certificate covers your CMS hostname, is valid, and chains to a trusted CA or Cloudflare Origin CA. Enable Always Use HTTPS for CMS.
5. Create a **Cloudflare Custom WAF rule** targeting only your CMS hostname: block `http.request.uri.path eq "/xmlrpc.php"`. Another rule should apply a **managed challenge** or rate limit to `http.request.uri.path eq "/wp-login.php"`. Use a rate-limiting rule where available; the threshold depends on actual editorial traffic and plan features, not a universal number.
6. Allow `/graphql` **POST** from Vercel server-side infrastructure and logged-in administrative clients. Do not assume a stable public Vercel egress IP; Vercel IPs may change unless a static-egress product is configured. Prefer **path + method rules, bot-challenge exceptions where necessary, HTTPS, and WordPress authentication** over a fragile IP whitelist. If Cloudflare Bot Fight Mode/WAF challenges `/graphql`, create a tightly-scoped skip rule for bot challenges (not a wholesale bypass of the WAF's security controls).
7. Allow `/wp-json/*` endpoints used by WordPress and the Cloudinary plugin. Allow webhook traffic **to Vercel** on `/api/revalidate` through the frontend's native Vercel firewall; it does not enter the CMS's Cloudflare WAF. Authentication is the constant-time `x-webhook-secret` comparison. Never exempt the webhook path from auth.
8. Prefer Authenticated Origin Pulls, Cloudflare tunnel, or provider IP firewall rules to prevent direct-IP bypass of the CMS WAF. Cloudflare DNS proxy alone does not hide the backend origin if the IP is known.
9. Use standard Cloudflare caching for static CMS assets only. Do **not** cache `/graphql`, `/wp-admin/*`, `/wp-login.php`, `/wp-json/*`, or any authenticated response at Cloudflare.

### 5. GitHub → Vercel application deployment

1. Create a fresh GitHub repository or use an existing expressly designated repository. Do not deploy this to an unrelated project's `main` branch.
2. Run `npm install`, commit the **generated `package-lock.json`** and the implementation source. GitHub Actions will run lint, type checking, unit tests and PHP lint on `main` or a PR.
3. Import the repository into Vercel as **Next.js**. Set the environment variables first. Assign the canonical frontend domain in Vercel. Configure its production branch as `main` and leave the build command as `npm run build`.
4. Vercel then builds the latest 50 public post paths and generates any other `[slug]` page dynamically. If the CMS cannot be reached in eight seconds or the mu-plugin hasn't registered `headlessSeo`, the build correctly fails instead of silently publishing stale or empty content.
5. Optional GitHub WordPress deployment: in GitHub environment `production-wordpress`, set secret variables `WORDPRESS_SSH_HOST`, `WORDPRESS_SSH_USER`, `WORDPRESS_SSH_PORT`, `WORDPRESS_SSH_PRIVATE_KEY`, `WORDPRESS_SSH_KNOWN_HOST`, `WORDPRESS_MU_PLUGINS_PATH`. These are literal GitHub secret names, not repo contents. Set `WORDPRESS_MU_PLUGINS_PATH` to the absolute `wp-content/mu-plugins` directory of your live WordPress installation. Provide the actual SSH host public key via an independently verified host-key fingerprint. The workflow only syncs mu-plugin source (not WordPress core or the Cloudinary plugin).
6. For managed WordPress without SSH, deploy `wordpress/mu-plugins/headless-vercel-bridge.php` using a supported managed-host Git/SFTP path and skip the SSH workflow. Never expose FTP passwords in GitHub Actions logs.

### 6. Acceptance tests: Gutenberg, media, ISR, preview, security

Run locally after setting `.env.local` (start with `.env.example` and insert real account values):

```bash
npm install
npm run verify
npm run build
npm run dev
```

Check that the CMS is a functioning GraphQL origin:

```bash
: "${WORDPRESS_GRAPHQL_URL:?Set actual HTTPS GraphQL URL}"
curl --fail-with-body --silent --show-error "$WORDPRESS_GRAPHQL_URL" \
  -H 'Content-Type: application/json' \
  --data '{"query":"query SiteHealth { generalSettings { title } }"}'
```

Create a **test** post in wp-admin using Gutenberg with a heading, columns, image with caption, internal link, and featured image. Upload the image and verify Cloudinary sync. Publish it. Confirm that the browser displays the post, its `srcset` includes `res.cloudinary.com`, the metadata contains canonical/OG title/description, and the Home grid shows it.

To test a webhook manually, publish a test post with slug `headless-verification`, then run (using the actual deployed frontend origin and the actual shared secret):

```bash
: "${NEXT_PUBLIC_SITE_URL:?Set actual frontend origin}"
: "${WORDPRESS_WEBHOOK_SECRET:?Set actual webhook secret}"
curl --fail-with-body --silent --show-error \
  -X POST "$NEXT_PUBLIC_SITE_URL/api/revalidate" \
  -H 'Content-Type: application/json' \
  -H "x-webhook-secret: $WORDPRESS_WEBHOOK_SECRET" \
  --data '{"slug":"headless-verification","postType":"post"}'
```

Expect a JSON body with `ok: true` and the `posts`, `navigation`, and `post-headless-verification` tags. The endpoint may return before the next public request has regenerated the page. Change the post, click **Update**, then request the post until the new HTML is generated. Repeating a valid webhook is safe. Anonymous requests to the webhook must return `401`.

From Gutenberg, modify a published article **without publishing** and click **Preview**. It must open `/api/preview` with `id`, `expires` and an HMAC `secret`, then redirect to `/preview/{id}` without exposing the HMAC in the final address. The article should show the latest autosaved title/content through `X-GraphQL-Preview` and a private preview banner. A different numeric preview ID using the same browser cookie must return `404`. An expired signature must fail with `401`, and **Exit preview** must clear Draft Mode.

Move the test post to Trash and confirm the homepage loses it after revalidation. Confirm CMS public theme paths redirect to the frontend, but `/wp-admin`, `/graphql` and WordPress REST remain available. Verify anonymous GraphQL queries cannot access drafts, even if they guess database IDs. Confirm `xmlrpc.php` is blocked and `wp-login.php` is protected without locking editors out.

### 7. Operations and incident recovery

- Log webhook delivery failures on the WordPress origin and observe Next.js Function errors through Vercel Logs; note that nonblocking WordPress requests have no receipt confirmation. Configure real cron for the delayed retry and an uptime check for the CMS GraphQL endpoint.
- Track p95 WPGraphQL latency, Vercel ISR regeneration failures, Cloudinary sync errors, storage and bandwidth. The client times out GraphQL at eight seconds, so fix slow queries/plugins or downsize per-request workloads before increasing timeouts.
- Run database and wp-content backups, verify restore, and store encrypted copies separately from the VPS. For Cloudinary Only media, test Cloudinary re-sync/backfill as part of restore.
- Rotate independent webhook/preview secrets in both WordPress and Vercel in coordinated rollouts. Expire all preview links by rotating the preview secret. Rotate/revoke the WordPress application password when a service account is changed.
- Disable the WordPress Cloudinary Only storage option only **after** successfully restoring originals from Cloudinary; otherwise local media references may break.
- If the Vercel build fails due to schema mismatch, ensure WPGraphQL, `headlessSeo` mu-plugin and PHP constants are loaded and check for security plugin/graphql-blocking conflicts. Avoid automatically falling back to anonymous public content for draft previews.

## Security and correctness notes

- `WORDPRESS_AUTH_REFRESH_TOKEN` is an encoded Basic credential; encoded does not mean encrypted.
- Signed preview links expire in five minutes and are scoped to one database ID through an additional HTTP-only cookie; the editor must start a new preview session to preview a different draft. It is not an SSO system; previews are intended for trusted editors with signed WordPress-origin URLs.
- WordPress content is sanitized before the HTML parser replaces images. Allowed iframes are restricted to YouTube/Vimeo; unsanctioned third-party embedded scripts are intentionally not carried into the frontend.
- If editorial content includes complex custom blocks, register their server-side WordPress rendering and selectively extend the frontend sanitizer/component mapper after security review.
- Cloudflare must not cache GraphQL authentication responses, and Cloudflare DNS-only is a deliberate choice for the Vercel frontend even though the Cloudflare zone manages its DNS.
- Set distinct secrets for preview and revalidation, each at least 32 random bytes. Keep PHP-origin TLS under Full (strict).

## Verification limitations of the distributed source package

PHP syntax lint and local image-ID unit tests can run without external services. A full `npm install`, TypeScript check, actual WPGraphQL integration, real Gutenberg autosave and Vercel ISR propagation require network connectivity and the user's own configured accounts. Passing local checks alone is not proof that production is deployed or that vendor-specific extension compatibility has been verified.