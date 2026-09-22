// Mete el CSS de una pagina dentro de su HTML en el build (fase 4.6).
//
// La portada tiene que pintar en menos de 1 s en 3G. En el preset "3G" de
// Chrome cada pedido cuesta ~560 ms de latencia, asi que HTML + un CSS
// aparte son dos viajes antes del primer pintado y ya pasan el segundo. El
// CSS de la portada pesa ~3 kB comprimido: va en un <style> dentro del
// HTML y el primer pintado sale con el HTML solo. En desarrollo no hace
// nada (Vite sirve el CSS con HMR).
//
// Solo se aplica a las paginas nombradas; el visualizador sigue con su CSS
// aparte (ahi manda el chunk de Three.js, no el CSS).

import type { Plugin } from 'vite';

export function pluginCssEnLinea(paginas: string[]): Plugin {
  return {
    name: 'css-en-linea',
    apply: 'build',
    enforce: 'post',
    generateBundle(_opciones, bundle) {
      for (const pagina of paginas) {
        const html = bundle[pagina];
        if (!html || html.type !== 'asset') continue;
        let texto = String(html.source);
        const enlaces = [...texto.matchAll(/<link rel="stylesheet"[^>]*href="[^"]*\/(assets\/[^"]+\.css)"[^>]*>/g)];
        for (const [enlace, archivo] of enlaces) {
          const css = bundle[archivo!];
          if (!css || css.type !== 'asset') continue;
          texto = texto.replace(enlace, `<style>${String(css.source)}</style>`);
          // Si otra pagina lo usa, se queda; si no, no hace falta publicarlo.
          const usadoEnOtra = Object.values(bundle).some((b) => b !== html && b.type === 'asset' && b.fileName.endsWith('.html') && String(b.source).includes(archivo!));
          if (!usadoEnOtra) delete bundle[archivo!];
        }
        html.source = texto;
      }
      // Una entrada que es solo CSS deja un .js vacio que Vite no emite, pero
      // si su .map: sin el .js no sirve para nada.
      for (const nombre of Object.keys(bundle)) {
        if (nombre.endsWith('.js.map') && !bundle[nombre.slice(0, -4)]) delete bundle[nombre];
      }
    },
  };
}
