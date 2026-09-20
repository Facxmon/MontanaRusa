// Entrada de un diseno (parametros, estado inicial, secuencia de instancias
// de elemento) y su calculo completo con el nucleo: el equivalente de
// DemoLayout.m, que devuelve directamente el objeto del contrato. Puro: lo
// usan el worker y los tests.
//
// Cada instancia de la secuencia lleva sus propios ajustes (solo los
// parametros que pisa) y se construye con AjustarParametros sobre los
// globales, como hace un script de MATLAB elemento por elemento. Con
// ajustes vacios en todas las instancias el resultado es identico al de
// MATLAB con parametros globales: JS es un superconjunto que se reduce
// exactamente a MATLAB (DISENO.md, fase 1).

import type * as Contrato from '../contrato/tipos';
import { EstadoInicial } from './basicos';
import { CONSTRUCTORES, LayoutAgregarElemento, LayoutNuevo } from './elementos';
import { exportarLayout, type InstanciaExportada } from './exportar';
import type { Vec3 } from './matematica';
import { AjustarParametros } from './parametros';
import type { NombreDeElemento, Parametros } from './tipos';

export interface InstanciaDeElemento {
  /** Identificador corto y estable dentro del diseno (`e1`, `e2`, ...): sirve para deshacer/rehacer y para el DOM. */
  id: string;
  tipo: NombreDeElemento;
  /** SOLO los parametros que esta instancia pisa sobre los globales. */
  ajustes: Partial<Parametros>;
}

export interface EntradaDeDiseno {
  /** Los globales, sin cambios. */
  parametros: Parametros;
  posicion: Vec3;
  tangente: Vec3;
  arriba: Vec3;
  velocidad: number;
  secuencia: InstanciaDeElemento[];
}

/** Siguiente id libre de la forma `eN`: uno mas que el mayor en uso, asi un id nunca se reutiliza dentro del diseno. */
export function nuevoIdDeInstancia(secuencia: InstanciaDeElemento[]): string {
  let mayor = 0;
  for (const inst of secuencia) {
    const numero = /^e(\d+)$/.exec(inst.id);
    if (numero) mayor = Math.max(mayor, Number(numero[1]));
  }
  return `e${mayor + 1}`;
}

/** Instancias sin ajustes a partir de una lista de tipos, con ids `e1..eN`: la secuencia "como MATLAB". */
export function instanciasDesdeTipos(tipos: NombreDeElemento[]): InstanciaDeElemento[] {
  return tipos.map((tipo, i) => ({ id: `e${i + 1}`, tipo, ajustes: {} }));
}

export function calcularLayout(entrada: EntradaDeDiseno, versionGenerador = 'js'): Contrato.Layout {
  if (entrada.secuencia.length === 0) throw new Error('La secuencia no tiene elementos: agregar al menos uno.');
  let Estado = EstadoInicial(entrada.posicion, entrada.tangente, entrada.arriba, entrada.velocidad, entrada.parametros);
  let Layout = LayoutNuevo(Estado, entrada.parametros);
  const instancias: InstanciaExportada[] = [];
  for (const inst of entrada.secuencia) {
    const constructor = CONSTRUCTORES[inst.tipo];
    if (!constructor) throw new Error(`Elemento desconocido: ${String(inst.tipo)}`);
    const { Parametros: P, Inertes } = AjustarParametros(entrada.parametros, inst.ajustes, inst.tipo);
    const [Salida, Elemento, Reporte] = constructor(Estado, P, Layout);
    Estado = Salida;
    Layout = LayoutAgregarElemento(Layout, Elemento, Estado, Reporte);
    instancias.push({ ajustes: inst.ajustes, inertes: Inertes });
  }
  return exportarLayout(Layout, { versionGenerador, instancias });
}
