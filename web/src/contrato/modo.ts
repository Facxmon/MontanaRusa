// El modo de curvatura con que se construyo cada elemento. Puro: se testea
// en Node.
//
// El modo es un parametro global que cada instancia puede pisar en sus
// ajustes, igual que un radio (fase 4, despues de la 4.10). El contrato 1.1.0
// ya lo trae sin cambios: ModoCurvatura esta en parametros.defaults, asi que
// va en elementos[].ajustes.modoCurvatura cuando una instancia lo pisa, y la
// regla para leerlo es
//
//     modo del elemento = ajustes.modoCurvatura ?? parametros.valores.modoCurvatura
//
// (CONTRATO_VISUALIZADOR.md, seccion 6). parametros.valores.modoCurvatura y
// esquema.modo describen el modo GLOBAL, no necesariamente el de cada
// elemento. MATLAB no emite ajustes: ahi el modo de todos es el global.

import type { Layout } from './tipos';
import type { ModoCurvatura, Parametros } from '../nucleo/tipos';

/** Modo efectivo de una instancia del diseno: el suyo si lo pisa, si no el global. */
export function modoEfectivo(globales: Pick<Parametros, 'ModoCurvatura'>, ajustes: Partial<Parametros>): ModoCurvatura {
  return ajustes.ModoCurvatura ?? globales.ModoCurvatura;
}

/** Modo con que se construyo el elemento `indice` de un layout del contrato. */
export function modoDelElemento(layout: Layout, indice: number): ModoCurvatura {
  const ajustes = layout.elementos[indice]?.ajustes as Record<string, unknown> | undefined;
  const propio = ajustes?.modoCurvatura;
  return (typeof propio === 'string' ? propio : layout.parametros.valores.modoCurvatura) as ModoCurvatura;
}

/** Cuantos elementos del layout usan un modo distinto del global (para avisarlo en el resumen). */
export function elementosConModoPropio(layout: Layout): number {
  const global = layout.parametros.valores.modoCurvatura;
  return layout.elementos.filter((_, i) => modoDelElemento(layout, i) !== global).length;
}
