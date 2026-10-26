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
        spx: resolve(root, "spx-levels/index.html"),
        flow: resolve(root, "options-flow/index.html"),
        notFound: resolve(root, "404.html"),
      },
    },
  },
});
