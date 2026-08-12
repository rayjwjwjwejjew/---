import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      injectRegister: null,
      includeAssets: ["ui/qa-corner.webp"],
      manifest: {
        name: "盛开在谎言之上",
        short_name: "谎言之上",
        description: "悬疑视觉小说",
        lang: "zh-CN",
        theme_color: "#11131b",
        background_color: "#05070c",
        display: "standalone",
        start_url: ".",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,webmanifest,ico,svg}"],
        globIgnores: ["**/vnBackup-*.js", "**/vnExtras-*.js", "**/vnOffline-*.js", "**/vnValidation-*.js", "**/vnPanels-*.js", "**/vnPlayingPanels-*.js", "**/browser-*.js"],
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === self.location.origin && /\/assets\/(vnBackup|vnExtras|vnOffline|vnValidation|vnPanels|vnPlayingPanels|browser)-.+\.js$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "soul-returns-tools-v3",
              expiration: { maxEntries: 12, maxAgeSeconds: 2592000 },
            },
          },
          {
            urlPattern: ({ url }) => /\/(scene-bg|characters|cg|ui)\//.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "soul-returns-media-v3",
              expiration: { maxEntries: 120, maxAgeSeconds: 7776000 },
            },
          },
          {
            urlPattern: ({ url }) => url.origin !== self.location.origin,
            handler: "NetworkFirst",
            options: {
              cacheName: "soul-returns-external-v3",
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 24, maxAgeSeconds: 2592000 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
