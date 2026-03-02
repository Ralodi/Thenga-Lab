import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    watch: {
      usePolling: true
    }
  },
  plugins: [
    react(),
      VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'Thenga Bev',
        short_name: 'ThengaBev',
        description: 'Simple tavern stock ordering app',
        theme_color: '#FFA500',
        background_color: '#FFF8E1',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/public/icons/192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/public/icons/512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ],
        screenshots:[
          {
            src: '/public/screenshots/screenshot-narrow.png',
            sizes: '783x1701',
            type: 'image/png',
            form_factor: 'narrow'
          },
          {
            src: '/public/screenshots/screenshot-wide.png',
            sizes: '2966x1704',
            type: 'image/png',
            form_factor: 'wide'
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
