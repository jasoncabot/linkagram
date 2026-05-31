import { defineConfig, type Plugin } from 'vite';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { VitePWA } from "vite-plugin-pwa"
import { version } from './package.json';

// The data JSON files live pretty-printed (one word per line) in public/ so words
// are easy to add with a clean diff. Vite copies public/ into the output dir before
// closeBundle runs, so we compact those copies here to keep the distribution small.
// This runs before VitePWA's post-enforced closeBundle, so Workbox precaches the
// compacted files.
const compactDataJson = (files: string[]): Plugin => ({
  name: 'compact-data-json',
  apply: 'build',
  closeBundle() {
    const outDir = resolve(__dirname, 'dist');
    for (const file of files) {
      const path = resolve(outDir, file);
      writeFileSync(path, JSON.stringify(JSON.parse(readFileSync(path, 'utf-8'))));
    }
  },
});

export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        stats: resolve(__dirname, 'stats.html'),
      },
    },
  },
  plugins: mode === 'capacitor' ? [
    compactDataJson(['data/small.json']),
  ] : [
    compactDataJson(['data/small.json']),
    VitePWA({
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
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,txt,xml,woff,woff2}'],
        ignoreURLParametersMatching: [/^native$/]
      }
    })
  ],
}));
