// Resaltar un elemento del layout: la via se atenua salvo ese elemento y la
// camara vuela a encuadrarlo (visualizador.ts reacciona a estado.elemento).
// Es la UNICA forma de elegir un elemento: la usan la lista de Resultados >
// Elementos y la secuencia de Diseno, para que las dos hagan exactamente lo
// mismo.

import type { EntradaDeDiseno } from '../nucleo/calcular';
import type { Estado } from '../estado';

/** Resalta el elemento `indice` del layout en pantalla (null = todo el layout). */
export function resaltarElemento(estado: Estado, indice: number | null): void {
  const { layout } = estado.get();
  if (indice !== null && !layout?.elementos[indice]) return;
  estado.set({ elemento: indice });
}

/**
 * El indice en el layout en pantalla de una instancia de la secuencia, o
 * null si ese layout no la tiene: con cambios sin generar (una instancia
 * nueva, la secuencia reordenada) la fila i del borrador no es el elemento i
 * del layout. Se busca por id en el diseno que produjo el layout.
 */
export function elementoDeInstancia(disenoCalculado: EntradaDeDiseno | null, id: string): number | null {
  const indice = disenoCalculado?.secuencia.findIndex((inst) => inst.id === id) ?? -1;
  return indice >= 0 ? indice : null;
}
