// Pestanas del area principal: via 3D, graficos, o las dos partiendo el area
// (que es como se ve el cursor ligado de la fase 3.6).

import type { Estado, Vista } from '../estado';
import { montarPestanas } from './pestanas';

const VISTAS: { clave: Vista; etiqueta: string }[] = [
  { clave: 'via3d', etiqueta: 'Vía 3D' },
  { clave: 'graficos', etiqueta: 'Gráficos' },
  { clave: 'ambos', etiqueta: 'Ambos' },
];

export function montarSelectorDeVista(contenedor: HTMLElement, estado: Estado): void {
  const pestanas = montarPestanas(contenedor, VISTAS, estado.get().vista, (vista) => estado.set({ vista }));
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.vista !== anterior.vista) pestanas.activar(nuevo.vista);
  });
}
