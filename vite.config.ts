import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  build: {
    rollupOptions: {
      plugins: []
    }
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@resvg/resvg-wasm/index_bg.wasm',
          dest: 'wasm',
          rename: "resvg.wasm"
        }
      ]
    })
  ]
});
