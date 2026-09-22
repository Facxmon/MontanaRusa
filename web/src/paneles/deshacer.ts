// Botones deshacer / rehacer de la barra (zona izquierda). Se deshabilitan
// con la pila vacia y el tooltip dice que se va a deshacer:
// "Deshacer: radioDeLaHelice de 2. Helice (Ctrl+Z)". Quien mantiene el
// historial llama a actualizar() despues de cada paso.

import type { Historial } from '../historial';
import { botonDeBarra, ponerTooltip } from './barra';

export interface AccionesDeDeshacer {
  deshacer: () => void;
  rehacer: () => void;
}

export function montarDeshacer(contenedor: HTMLElement, historial: Historial, acciones: AccionesDeDeshacer): { actualizar: () => void } {
  const deshacer = botonDeBarra({ icono: 'deshacer', etiqueta: 'Deshacer', atajo: 'Ctrl+Z', alHacer: acciones.deshacer });
  const rehacer = botonDeBarra({ icono: 'rehacer', etiqueta: 'Rehacer', atajo: 'Ctrl+Shift+Z / Ctrl+Y', alHacer: acciones.rehacer });
  contenedor.append(deshacer, rehacer);

  const actualizar = () => {
    deshacer.disabled = !historial.puedeDeshacer;
    rehacer.disabled = !historial.puedeRehacer;
    const que = historial.etiquetaDeDeshacer;
    ponerTooltip(deshacer, que ? `Deshacer: ${que}` : 'Nada que deshacer', 'Ctrl+Z');
    deshacer.setAttribute('aria-label', que ? `Deshacer: ${que}` : 'Deshacer');
    const re = historial.etiquetaDeRehacer;
    ponerTooltip(rehacer, re ? `Rehacer: ${re}` : 'Nada que rehacer', 'Ctrl+Shift+Z / Ctrl+Y');
    rehacer.setAttribute('aria-label', re ? `Rehacer: ${re}` : 'Rehacer');
  };
  actualizar();
  return { actualizar };
}
