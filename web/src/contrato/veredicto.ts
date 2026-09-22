// El veredicto de un layout: pasa o no pasa, los extremos de G con el lugar
// donde ocurren, el criterio peor y los ajustes inertes. Todo sale del JSON
// del contrato (resumenLayout, elementos[].criterios y elementos[].inertes):
// aca no se calcula fisica, se elige que mirar primero.
//
// Puro, sin DOM: se testea en Node con los golden.

import type { Criterio, Layout } from './tipos';

export interface UbicacionDeExtremo {
  elemento: number;
  tipo: string;
  nodoLocal: number;
  subtramo: string | null;
  arco: number | null;
  /** Tiempo acumulado sobre todo el layout, no el del elemento. */
  tiempo: number | null;
}

export interface CriterioDestacado {
  criterio: Criterio;
  elemento: number;
  tipo: string;
  momento: 'previos' | 'posteriores';
  /**
   * Margen relativo al limite, para poder comparar criterios de unidades
   * distintas (metros contra G contra radianes). Cuando el limite es 0 o no
   * es finito se usa el margen tal cual.
   */
  peso: number;
}

export interface InertesDeElemento {
  elemento: number;
  tipo: string;
  /** Claves camelCase, como las escribe el contrato. */
  nombres: string[];
}

export interface Veredicto {
  pasa: boolean;
  criteriosQueNoPasan: number;
  criteriosEvaluados: number;
  gzMaxima: number | null;
  dondeGzMaxima: UbicacionDeExtremo | null;
  gzMinima: number | null;
  dondeGzMinima: UbicacionDeExtremo | null;
  gyMaximaAbsoluta: number | null;
  dondeGyMaxima: UbicacionDeExtremo | null;
  /** El que peor esta: el mas negativo si alguno falla, el mas ajustado si todos pasan. */
  peorCriterio: CriterioDestacado | null;
  inertes: InertesDeElemento[];
}

function pesoDe(criterio: Criterio): number {
  const margen = criterio.margen;
  if (margen === null || margen === undefined || !Number.isFinite(margen)) return Infinity;
  const limite = criterio.limite;
  return typeof limite === 'number' && Number.isFinite(limite) && limite !== 0 ? margen / Math.abs(limite) : margen;
}

/** Recorre los nodos buscando el extremo de una columna, con `mejor` decidiendo. */
function extremo(layout: Layout, clave: 'gz' | 'gy', mejor: (candidato: number, actual: number) => boolean): { valor: number | null; donde: UbicacionDeExtremo | null } {
  let valor: number | null = null;
  let donde: UbicacionDeExtremo | null = null;
  let desfase = 0;
  layout.elementos.forEach((elemento, indice) => {
    const nodos = elemento.nodos;
    const columna = nodos[clave];
    for (let i = 0; i < nodos.numeroDeNodos; i++) {
      const v = columna?.[i];
      if (v === null || v === undefined || !Number.isFinite(v)) continue;
      if (valor !== null && !mejor(v, valor)) continue;
      valor = v;
      const t = nodos.tiempo[i];
      donde = {
        elemento: indice,
        tipo: elemento.tipo,
        nodoLocal: i,
        subtramo: elemento.subtramos.find((s) => i >= s.indiceInicio && i <= s.indiceFin)?.nombre ?? null,
        arco: nodos.arco[i] ?? null,
        tiempo: typeof t === 'number' ? t + desfase : null,
      };
    }
    desfase += elemento.resumen.tiempoDeRecorrido ?? 0;
  });
  return { valor, donde };
}

export function veredictoDelLayout(layout: Layout): Veredicto {
  let noPasan = 0;
  let evaluados = 0;
  let peorCriterio: CriterioDestacado | null = null;

  layout.elementos.forEach((elemento, indice) => {
    for (const momento of ['previos', 'posteriores'] as const) {
      for (const criterio of elemento.criterios[momento]) {
        if (criterio.sentido === 'Informativo') continue;
        evaluados++;
        if (!criterio.pasa) noPasan++;
        const candidato: CriterioDestacado = { criterio, elemento: indice, tipo: elemento.tipo, momento, peso: pesoDe(criterio) };
        if (!Number.isFinite(candidato.peso)) continue;
        // Gana el que falla; entre dos que fallan (o dos que pasan), el de menor margen relativo.
        const mejor =
          peorCriterio === null ||
          (!criterio.pasa && peorCriterio.criterio.pasa) ||
          (criterio.pasa === peorCriterio.criterio.pasa && candidato.peso < peorCriterio.peso);
        if (mejor) peorCriterio = candidato;
      }
    }
  });

  const gzMaxima = extremo(layout, 'gz', (c, a) => c > a);
  const gzMinima = extremo(layout, 'gz', (c, a) => c < a);
  const gyMaxima = extremo(layout, 'gy', (c, a) => Math.abs(c) > Math.abs(a));

  const inertes = layout.elementos
    .map((elemento, indice) => ({ elemento: indice, tipo: elemento.tipo, nombres: elemento.inertes ?? [] }))
    .filter((e) => e.nombres.length > 0);

  const resumen = layout.resumenLayout;
  return {
    pasa: resumen.todosLosCriteriosPasan,
    criteriosQueNoPasan: noPasan,
    criteriosEvaluados: evaluados,
    // Los numeros son los del contrato (resumenLayout); los nodos solo dicen DONDE.
    gzMaxima: resumen.gzMaximaGlobal ?? gzMaxima.valor,
    dondeGzMaxima: gzMaxima.donde,
    gzMinima: resumen.gzMinimaGlobal ?? gzMinima.valor,
    dondeGzMinima: gzMinima.donde,
    gyMaximaAbsoluta: resumen.gyMaximaAbsolutaGlobal ?? (gyMaxima.valor === null ? null : Math.abs(gyMaxima.valor)),
    dondeGyMaxima: gyMaxima.donde,
    peorCriterio,
    inertes,
  };
}
