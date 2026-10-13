import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      workbox: {
        // Make a newly-deployed service worker take over immediately instead
        // of waiting for every open tab/app instance to fully close first —
        // without this, a cold-launched PWA can briefly render against a
        // stale cached bundle from before the last deploy.
        skipWaiting: true,
        clientsClaim: true,
      },
      manifest: {
        name: "Home Biz CRM",
        short_name: "Home Biz",
        description: "Speak your orders and let the app keep track.",
        theme_color: "#c8703a",
        background_color: "#fdf8f3",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
});
