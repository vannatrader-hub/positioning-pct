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
        vaultPortfolio: resolve(root, "vault/portfolio/index.html"),
        vaultArchive: resolve(root, "vault/archive/index.html"),
        insight: resolve(root, "insight/index.html"),
        privateEntry: resolve(root, "m4c8q/index.html"),
        privateFlow: resolve(root, "m4c8q/options-flow/index.html"),
        privateFlowDollar: resolve(root, "m4c8q/options-flow/dollar/index.html"),
        privateFlowSpotlights: resolve(root, "m4c8q/options-flow/spotlights/index.html"),
        privateFlowScorecard: resolve(root, "m4c8q/options-flow/scorecard/index.html"),
        privateNewToday: resolve(root, "m4c8q/new-today/index.html"),
        comingSoon: resolve(root, "coming-soon/index.html"),
        notFound: resolve(root, "404.html"),
      },
    },
  },
});
