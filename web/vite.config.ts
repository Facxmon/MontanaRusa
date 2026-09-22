import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { pluginCssEnLinea } from './plugins/cssEnLinea';
import { pluginGolden } from './plugins/golden';

// Los golden files los genera MATLAB (GenerarGoldenFiles.m) en ../golden.
const CARPETA_GOLDEN = fileURLToPath(new URL('../golden', import.meta.url));

export default defineConfig({
  // El sitio se publica como GitHub Pages de proyecto: https://<usuario>.github.io/MontanaRusa/
  base: '/MontanaRusa/',
  // La portada lleva su CSS dentro del HTML: pinta con un solo viaje (plugins/cssEnLinea.ts).
  plugins: [pluginGolden(CARPETA_GOLDEN), pluginCssEnLinea(['index.html'])],
  build: {
    // Dos paginas: la portada (sin Three.js ni uPlot) y el visualizador.
    rollupOptions: {
      input: {
        portada: fileURLToPath(new URL('index.html', import.meta.url)),
        visualizador: fileURLToPath(new URL('visualizador.html', import.meta.url)),
      },
    },
    target: 'es2022',
    sourcemap: true,
    // Three.js + uPlot + la app van en un solo chunk (~655 kB minificado, 187 kB gzip): es esperable.
    chunkSizeWarningLimit: 700,
  },
});
