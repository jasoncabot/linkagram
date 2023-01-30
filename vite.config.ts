import { defineConfig } from 'vite';
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  build: {
    rollupOptions: {
      plugins: VitePWA(
        {
          includeAssets: [
            "android-chrome-192x192.png",
            "android-chrome-512x512.png",
            "apple-touch-icon.png",
            "browserconfig.xml",
            "favicon-16x16.png",
            "favicon-32x32.png",
            "favicon.ico",
            "mstile-150x150.png",
            "safari-pinned-tab.svg",
            "data/letters.json",
            "data/small.json",
          ],
          manifest: {
            name: 'Linkagram',
            short_name: 'Linkagram',
            description: 'Find all the words on a 4x4 grid. A new puzzle is available each day.',
            theme_color: '#5bbad5',
            icons: [
              {
                "src": "/android-chrome-192x192.png",
                "sizes": "192x192",
                "type": "image/png"
              },
              {
                "src": "/android-chrome-512x512.png",
                "sizes": "512x512",
                "type": "image/png"
              }
            ],
            display: "standalone"
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,json,txt,xml}']
          }
        }
      )
    }
  }
});
