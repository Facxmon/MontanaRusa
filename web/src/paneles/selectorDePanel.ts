// Pestanas del panel lateral: resultados (lo que muestra el layout) o diseno
// (lo que se edita para recalcularlo).

import type { Estado, PanelLateral } from '../estado';
import { el, vaciar } from './dom';

const PANELES: { clave: PanelLateral; etiqueta: string }[] = [
  { clave: 'resultados', etiqueta: 'Resultados' },
  { clave: 'diseno', etiqueta: 'Diseño' },
];

export function montarSelectorDePanel(contenedor: HTMLElement, estado: Estado): void {
  const dibujar = () => {
    const { panel } = estado.get();
    vaciar(contenedor);
    contenedor.append(
      ...PANELES.map((p) =>
        el('button', {
          type: 'button', role: 'tab', class: p.clave === panel ? 'pestana activa' : 'pestana',
          'aria-selected': p.clave === panel ? 'true' : 'false', onClick: () => estado.set({ panel: p.clave }),
        }, p.etiqueta),
      ),
    );
  };
  dibujar();
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.panel !== anterior.panel) dibujar();
  });
}
