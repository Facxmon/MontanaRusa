// Pestanas del panel lateral: resultados (lo que muestra el layout) o diseno
// (lo que se edita para recalcularlo).

import type { Estado, PanelLateral } from '../estado';
import { montarPestanas } from './pestanas';

const PANELES: { clave: PanelLateral; etiqueta: string }[] = [
  { clave: 'resultados', etiqueta: 'Resultados' },
  { clave: 'diseno', etiqueta: 'Diseño' },
];

export function montarSelectorDePanel(contenedor: HTMLElement, estado: Estado, paneles: Record<PanelLateral, HTMLElement>): void {
  const pestanas = montarPestanas(contenedor, PANELES, estado.get().panel, (panel) => estado.set({ panel }), {
    resultados: [paneles.resultados],
    diseno: [paneles.diseno],
  });
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.panel !== anterior.panel) pestanas.activar(nuevo.panel);
  });
}
