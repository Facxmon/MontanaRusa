// Banner de error. Nada falla en silencio: cualquier estado.error se muestra.

import type { Estado } from '../estado';
import { el, vaciar } from './dom';

export function montarErrores(contenedor: HTMLElement, estado: Estado): void {
  const dibujar = (error: string | null) => {
    vaciar(contenedor);
    if (error) contenedor.append(el('strong', {}, 'Error: '), error);
  };
  dibujar(estado.get().error);
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.error !== anterior.error) dibujar(nuevo.error);
  });
}
