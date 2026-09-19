// Texto JSON del contrato para descargar: el layout ya calculado, redondeado
// a 6 cifras significativas como hace LayoutAJson.m, compacto.

import type * as Contrato from '../contrato/tipos';
import { redondearTodo } from './exportar';

export function textoDelLayout(layout: Contrato.Layout): string {
  return `${JSON.stringify(redondearTodo(layout))}\n`;
}
