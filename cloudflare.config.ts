import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "cf-migrate-headlesswp",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-10-30",
    compatibilityFlags: ["nodejs_compat"],
    assets: { notFoundHandling: "none" },
    env: {
      ASSETS: bindings.assets(),
      IMAGES: bindings.images(),
    },
  }),
});
