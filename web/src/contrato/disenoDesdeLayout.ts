// Un diseno editable a partir de un layout del contrato: sus parametros
// globales, su estado inicial y su secuencia como instancias con ids
// `e1..eN`. Los ajustes por instancia se leen de elementos[].ajustes si el
// layout los trae (contrato 1.1.0, solo los emite JS) y quedan vacios si no
// (MATLAB, golden files). Puro: lo usan el visualizador y los tests.

import type { EntradaDeDiseno } from '../nucleo/calcular';
import type { Parametros } from '../nucleo/tipos';
import { ajustesDesdeContrato, parametrosDesdeContrato } from './parametrosDesdeContrato';
import type { Layout } from './tipos';

export function disenoDesdeLayout(layout: Layout, parametros?: Parametros): EntradaDeDiseno {
  const e = layout.estadoInicial;
  return {
    parametros: parametros ?? parametrosDesdeContrato(layout.parametros.valores as Record<string, unknown>),
    posicion: [...e.posicion],
    tangente: [...e.versorTangente],
    arriba: [...e.versorArribaCarro],
    velocidad: e.velocidad,
    secuencia: layout.elementos.map((elemento, i) => ({
      id: `e${i + 1}`,
      tipo: elemento.tipo,
      ajustes: elemento.ajustes ? ajustesDesdeContrato(elemento.ajustes, `elementos[${i}].ajustes`) : {},
    })),
  };
}
