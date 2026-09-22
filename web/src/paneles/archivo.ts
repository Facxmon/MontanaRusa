// Bajar un blob como archivo y armarle un nombre. Vive aparte de guardar.ts
// porque lo usan tambien los botones de exportar de cada figura, y que
// graficos/ importe guardar.ts (que importa graficos/series y
// graficos/exportarFigura) cerraria un ciclo entre los dos modulos.

import { el } from './dom';

/** Nombre apto para archivo: minusculas, sin acentos ni simbolos. */
export function slug(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'diseno';
}

export function descargarArchivo(nombre: string, contenido: Blob): void {
  const url = URL.createObjectURL(contenido);
  const enlace = el('a', { href: url, download: nombre });
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  // El navegador ya tomo el blob; se libera despues de que arranque la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
