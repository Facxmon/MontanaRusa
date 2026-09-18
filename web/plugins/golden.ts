// Plugin de Vite que sirve los golden files del contrato.
//
// Los archivos viven en ../golden (los genera GenerarGoldenFiles.m) y no se
// copian a mano: en desarrollo se sirven desde ahi en /golden/<caso>.json y
// en build se emiten dentro de dist/golden/. Ademas se sirve y emite
// /golden/indice.json con la lista de casos, leida del disco, para que la
// pagina nunca tenga una lista de casos escrita a mano.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

export const NOMBRE_DEL_INDICE = 'indice.json';

/** Nombres de caso (sin .json), con los circuitos primero y el resto alfabetico. */
export function listarCasos(carpeta: string): string[] {
  const nombres = readdirSync(carpeta)
    .filter((archivo) => archivo.endsWith('.json') && archivo !== NOMBRE_DEL_INDICE)
    .map((archivo) => archivo.slice(0, -'.json'.length));
  const esCircuito = (nombre: string) => nombre.startsWith('circuito-');
  return nombres.sort((a, b) => {
    if (esCircuito(a) !== esCircuito(b)) return esCircuito(a) ? -1 : 1;
    return a.localeCompare(b);
  });
}

export function textoDelIndice(carpeta: string): string {
  return JSON.stringify({ casos: listarCasos(carpeta) });
}

export function pluginGolden(carpeta: string): Plugin {
  let base = '/';
  return {
    name: 'montanarusa-golden',
    configResolved(config) {
      base = config.base;
    },
    configureServer(servidor) {
      servidor.middlewares.use((peticion, respuesta, siguiente) => {
        const url = peticion.url ?? '';
        const prefijo = `${base}golden/`;
        if (!url.startsWith(prefijo)) return siguiente();
        const nombre = decodeURIComponent(url.slice(prefijo.length).split('?')[0] ?? '');
        if (!/^[\w.-]+\.json$/.test(nombre)) return siguiente();

        respuesta.setHeader('Content-Type', 'application/json; charset=utf-8');
        respuesta.setHeader('Cache-Control', 'no-store');
        if (nombre === NOMBRE_DEL_INDICE) {
          respuesta.end(textoDelIndice(carpeta));
          return;
        }
        const ruta = join(carpeta, nombre);
        if (!existsSync(ruta)) {
          respuesta.statusCode = 404;
          respuesta.end(JSON.stringify({ error: `No existe golden/${nombre}` }));
          return;
        }
        respuesta.end(readFileSync(ruta));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: `golden/${NOMBRE_DEL_INDICE}`, source: textoDelIndice(carpeta) });
      for (const caso of listarCasos(carpeta)) {
        this.emitFile({
          type: 'asset',
          fileName: `golden/${caso}.json`,
          source: readFileSync(join(carpeta, `${caso}.json`)),
        });
      }
    },
  };
}
