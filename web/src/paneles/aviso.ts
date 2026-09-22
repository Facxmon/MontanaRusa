// Aviso discreto (abajo del area principal, sobre el reproductor): "Link
// copiado", "Se restauro tu ultimo diseno" con un boton para descartarlo.
// Uno a la vez; se va solo a los segundos o al hacer la accion.

import { el } from './dom';

export interface Aviso {
  /** Muestra el texto; con `accion`, un boton al lado. `duracionMs` 0 lo deja hasta que se cierre. */
  mostrar(texto: string, accion?: { etiqueta: string; alHacer: () => void }, duracionMs?: number): void;
  ocultar(): void;
}

export function montarAviso(contenedor: HTMLElement): Aviso {
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  const ocultar = () => {
    if (temporizador) clearTimeout(temporizador);
    temporizador = null;
    contenedor.replaceChildren();
    contenedor.hidden = true;
  };
  const mostrar: Aviso['mostrar'] = (texto, accion, duracionMs = 6000) => {
    ocultar();
    contenedor.hidden = false;
    contenedor.append(el('span', {}, texto));
    if (accion) contenedor.append(el('button', { type: 'button', class: 'boton chico', onClick: () => { ocultar(); accion.alHacer(); } }, accion.etiqueta));
    contenedor.append(el('button', { type: 'button', class: 'boton chico aviso-cerrar', 'aria-label': 'Cerrar el aviso', title: 'Cerrar', onClick: ocultar }, '✕'));
    if (duracionMs > 0) temporizador = setTimeout(ocultar, duracionMs);
  };
  ocultar();
  return { mostrar, ocultar };
}
