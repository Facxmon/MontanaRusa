import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { pluginGolden } from './plugins/golden';

// Los golden files los genera MATLAB (GenerarGoldenFiles.m) en ../golden.
const CARPETA_GOLDEN = fileURLToPath(new URL('../golden', import.meta.url));

export default defineConfig({
  // El sitio se publica como GitHub Pages de proyecto: https://<usuario>.github.io/MontanaRusa/
  base: '/MontanaRusa/',
  plugins: [pluginGolden(CARPETA_GOLDEN)],
  build: {
    target: 'es2022',
    sourcemap: true,
    // Three.js entero va en un solo chunk (~500 kB minificado, 130 kB gzip): es esperable.
    chunkSizeWarningLimit: 600,
  },
});
