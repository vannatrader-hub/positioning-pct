import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: "/positioning-pct/",
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        positioning: resolve(root, "positioning/index.html"),
        positioningDesk: resolve(root, "positioning/desk/index.html"),
        positioningCharts: resolve(root, "positioning/charts/index.html"),
        spx: resolve(root, "spx-levels/index.html"),
        flow: resolve(root, "options-flow/index.html"),
        flowDollar: resolve(root, "options-flow/dollar/index.html"),
        flowSpotlights: resolve(root, "options-flow/spotlights/index.html"),
        flowScorecard: resolve(root, "options-flow/scorecard/index.html"),
        newToday: resolve(root, "new-today/index.html"),
        vault: resolve(root, "vault/index.html"),
        vaultSoftCrowded: resolve(root, "vault/soft-crowded/index.html"),
        vaultWall: resolve(root, "vault/vol-credit-momentum/index.html"),
        notFound: resolve(root, "404.html"),
      },
    },
  },
});
