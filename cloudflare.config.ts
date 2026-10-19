import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "shieldsplit",
    compatibilityDate: "2026-10-01",
    // LAB-DOMAIN: domains: ["shieldsplit.<lab domain>"] once it's picked
    workersDev: true,
    previewUrls: false,
    observability: { enabled: true, issues: { enabled: true } },
  },
});
