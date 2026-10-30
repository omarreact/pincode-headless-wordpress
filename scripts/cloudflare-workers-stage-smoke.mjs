// Read-only HTTP gate for the isolated Headless WordPress Cloudflare Worker.
const origin = new URL("https://cf-migrate-headlesswp.farukkhanone.workers.dev/");
const checks = [
  { path: "/", status: 200, kind: "html" },
  { path: "/admin", status: 200, kind: "html" },
  { path: "/api/preview", status: 401, kind: "json" },
  { path: "/api/revalidate", status: 405, kind: "method" },
];
let failures = 0;
for (const check of checks) {
  try {
    const response = await fetch(new URL(check.path, origin), {
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
      headers: { "user-agent": "Headless-WP-Cloudflare-Stage-ReadOnly/1.0" },
    });
    const body = (await response.text()).slice(0, 100000);
    const type = response.headers.get("content-type") || "";
    const goodBody = check.kind === "html"
      ? type.includes("text/html") && body.toLowerCase().includes("<html") && body.includes("PINCODE")
      : check.kind === "json"
        ? type.includes("application/json") && (() => { try { return JSON.parse(body).ok === false; } catch { return false; } })()
        : true;
    const pass = response.status === check.status && goodBody;
    console.log(`${pass ? "PASS" : "FAIL"} ${check.path}: HTTP ${response.status}, expected ${check.status}`);
    if (!pass) failures++;
  } catch (error) {
    console.error(`FAIL ${check.path}: ${error instanceof Error ? error.message : String(error)}`);
    failures++;
  }
}
if (failures) {
  console.error(`Headless WordPress is NOT approved for custom-domain cutover (${failures} failed checks).`);
  process.exitCode = 1;
}
