// Pestanas del area principal: via 3D, graficos, o las dos partiendo el area
// (que es como se ve el cursor ligado de la fase 3.6).

import type { Estado, Vista } from '../estado';
import { el, vaciar } from './dom';

const VISTAS: { clave: Vista; etiqueta: string }[] = [
  { clave: 'via3d', etiqueta: 'Vía 3D' },
  { clave: 'graficos', etiqueta: 'Gráficos' },
  { clave: 'ambos', etiqueta: 'Ambos' },
];

export function montarSelectorDeVista(contenedor: HTMLElement, estado: Estado): void {
  const dibujar = () => {
    const { vista } = estado.get();
    vaciar(contenedor);
    contenedor.append(
      ...VISTAS.map((v) =>
        el(
          'button',
          {
            type: 'button',
            role: 'tab',
            class: v.clave === vista ? 'pestana activa' : 'pestana',
            'aria-selected': v.clave === vista ? 'true' : 'false',
            onClick: () => estado.set({ vista: v.clave }),
          },
          v.etiqueta,
        ),
      ),
    );
  };
  dibujar();
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.vista !== anterior.vista) dibujar();
  });
}
