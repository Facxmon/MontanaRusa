// Menu con las magnitudes coloreables (contrato/magnitudes.ts).

import { MAGNITUDES, type ClaveDeMagnitud } from '../contrato/magnitudes';
import type { Estado } from '../estado';
import { el, vaciar } from './dom';

export function montarSelectorDeMagnitud(contenedor: HTMLElement, estado: Estado): void {
  const dibujar = () => {
    const { magnitud } = estado.get();
    vaciar(contenedor);
    const selector = el('select', {
      onChange: (evento: Event) => estado.set({ magnitud: (evento.target as HTMLSelectElement).value as ClaveDeMagnitud }),
    });
    for (const m of MAGNITUDES) {
      const opcion = el('option', { value: m.clave }, `${m.etiqueta} [${m.unidad === 'rad' ? '°' : m.unidad}]`);
      if (m.clave === magnitud) opcion.selected = true;
      selector.append(opcion);
    }
    contenedor.append(el('label', {}, el('span', { class: 'etiqueta' }, 'Colorear la vía por'), selector));
  };
  dibujar();
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.magnitud !== anterior.magnitud) dibujar();
  });
}
