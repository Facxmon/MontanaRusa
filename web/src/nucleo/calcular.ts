// Entrada de un diseno (parametros, estado inicial, secuencia de elementos)
// y su calculo completo con el nucleo: el equivalente de DemoLayout.m, que
// devuelve directamente el objeto del contrato. Puro: lo usan el worker y
// los tests.

import type * as Contrato from '../contrato/tipos';
import { EstadoInicial } from './basicos';
import { CONSTRUCTORES, LayoutAgregarElemento, LayoutNuevo } from './elementos';
import { exportarLayout } from './exportar';
import type { Vec3 } from './matematica';
import type { NombreDeElemento, Parametros } from './tipos';

export interface EntradaDeDiseno {
  parametros: Parametros;
  posicion: Vec3;
  tangente: Vec3;
  arriba: Vec3;
  velocidad: number;
  secuencia: NombreDeElemento[];
}

export function calcularLayout(entrada: EntradaDeDiseno, versionGenerador = 'js'): Contrato.Layout {
  if (entrada.secuencia.length === 0) throw new Error('La secuencia no tiene elementos: agregar al menos uno.');
  let Estado = EstadoInicial(entrada.posicion, entrada.tangente, entrada.arriba, entrada.velocidad, entrada.parametros);
  let Layout = LayoutNuevo(Estado, entrada.parametros);
  for (const nombre of entrada.secuencia) {
    const constructor = CONSTRUCTORES[nombre];
    if (!constructor) throw new Error(`Elemento desconocido: ${nombre}`);
    const [Salida, Elemento, Reporte] = constructor(Estado, entrada.parametros, Layout);
    Estado = Salida;
    Layout = LayoutAgregarElemento(Layout, Elemento, Estado, Reporte);
  }
  return exportarLayout(Layout, { versionGenerador });
}
