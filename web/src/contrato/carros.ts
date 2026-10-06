// El tren de varios carros visto desde el contrato (1.3.0). Puro: se testea
// en Node.
//
// Con numeroDeCarros > 1, cada elemento trae en `carros[]` las columnas
// dinamicas de cada carro calculado sobre los MISMOS nodos (el nodo k es ese
// carro parado en el nodo k, con su propio reloj) y sus lineas de criterio
// que dependen de la dinamica. Las columnas base de `nodos` son las del
// carro 1, y en `criterios.posteriores` cada linea dinamica es la del peor
// carro.
//
// layoutDelCarro(layout, n) arma la vista de un carro: el mismo layout con
// las columnas y los criterios de ese carro en lugar de los del 1. Asi los
// graficos, los valores en el cursor, el color de la via y el veredicto por
// elemento muestran el carro que se esta analizando sin saber nada de trenes.

import type { Criterio, Elemento, Layout } from './tipos';

/** Columnas de nodos que cambian de carro a carro (las de la tabla carros[].nodos). */
export const COLUMNAS_DEL_CARRO = [
  'tiempo', 'velocidad', 'velocidadRiel', 'aceleracionTangencial', 'gx', 'gy', 'gz',
  'jerkGx', 'jerkGy', 'jerkGz', 'gyCabeza', 'gzCabeza', 'fuerzaNormal',
] as const;

/** Carros del tren (1 si el layout es de un carro o anterior a 1.3.0). */
export function numeroDeCarros(layout: Layout): number {
  const n = layout.resumenLayout.tren?.numeroDeCarros ?? Number(layout.parametros.valores.numeroDeCarros ?? 1);
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : 1;
}

/** Numeros (1 = el primero) de los carros con datos propios en el layout. */
export function carrosCalculados(layout: Layout): number[] {
  const lista = layout.resumenLayout.tren?.carrosCalculados;
  return lista && lista.length > 0 ? [...lista] : [1];
}

/**
 * El carro que se muestra al abrir un layout: el peor entre el primero y el
 * ultimo (los extremos del tren suelen ser los mas exigidos), medido por la
 * mayor utilizacion de la norma de cada uno en todo el recorrido
 * (resumen.utilizacionPorCarro). Si el ultimo no se calculo, el primero.
 */
export function carroPorDefecto(layout: Layout): number {
  const calculados = carrosCalculados(layout);
  const ultimo = numeroDeCarros(layout);
  if (ultimo === 1 || !calculados.includes(ultimo)) return 1;
  const peorDe = (numero: number) =>
    layout.elementos.reduce((m, e) => {
      const u = e.resumen.utilizacionPorCarro?.[numero - 1];
      return typeof u === 'number' && Number.isFinite(u) ? Math.max(m, u) : m;
    }, -Infinity);
  return peorDe(ultimo) > peorDe(1) ? ultimo : 1;
}

const VISTAS = new WeakMap<Layout, Map<number, Layout>>();

/**
 * El layout visto desde el carro `numero`: columnas dinamicas, lineas de
 * criterio dinamicas (por nombre), bloque normativo y tiempo de recorrido
 * de ese carro. Con el carro 1, o si el carro no tiene datos, el mismo
 * layout (las columnas base ya son las del 1). Se cachea por layout.
 */
export function layoutDelCarro(layout: Layout, numero: number): Layout {
  if (numero === 1 || !layout.elementos.some((e) => e.carros?.some((c) => c.numero === numero))) return layout;
  let porCarro = VISTAS.get(layout);
  if (!porCarro) VISTAS.set(layout, (porCarro = new Map()));
  const guardada = porCarro.get(numero);
  if (guardada) return guardada;
  const vista: Layout = { ...layout, elementos: layout.elementos.map((e) => elementoDelCarro(e, numero)) as Layout['elementos'] };
  porCarro.set(numero, vista);
  return vista;
}

function elementoDelCarro(elemento: Elemento, numero: number): Elemento {
  const carro = elemento.carros?.find((c) => c.numero === numero);
  if (!carro) return elemento;
  const nodos = { ...elemento.nodos };
  for (const clave of COLUMNAS_DEL_CARRO) {
    const columna = carro.nodos[clave];
    if (columna) (nodos as Record<string, unknown>)[clave] = columna;
  }
  nodos.puntoDeParada = carro.nodos.puntoDeParada ?? null;

  const propias = new Map<string, Criterio>(carro.criterios.posteriores.map((c) => [c.nombre, c]));
  const posteriores = elemento.criterios.posteriores.map((c) => propias.get(c.nombre) ?? c);
  const todosPasan = [...elemento.criterios.previos, ...posteriores].every((c) => c.pasa);

  let tiempoDeRecorrido = elemento.resumen.tiempoDeRecorrido;
  for (let i = carro.nodos.tiempo.length - 1; i >= 0; i--) {
    const t = carro.nodos.tiempo[i];
    if (typeof t === 'number' && Number.isFinite(t)) {
      tiempoDeRecorrido = t;
      break;
    }
  }
  return {
    ...elemento,
    nodos,
    criterios: { ...elemento.criterios, posteriores, normativo: carro.criterios.normativo ?? elemento.criterios.normativo, todosPasan },
    resumen: { ...elemento.resumen, tiempoDeRecorrido },
  };
}
