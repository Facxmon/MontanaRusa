// Menu con las magnitudes coloreables (contrato/magnitudes.ts). Lo monta la
// tarjeta "Color de la vía" (leyenda.ts): el <select> se crea una sola vez y
// sigue al estado sin redibujarse, asi no pierde el foco.

import { MAGNITUDES, type ClaveDeMagnitud } from '../contrato/magnitudes';
import type { Estado } from '../estado';
import { el } from './dom';

export function selectorDeMagnitud(estado: Estado): HTMLSelectElement {
  const selector = el('select', {
    onChange: (evento: Event) => estado.set({ magnitud: (evento.target as HTMLSelectElement).value as ClaveDeMagnitud }),
  });
  for (const m of MAGNITUDES) {
    selector.append(el('option', { value: m.clave }, `${m.etiqueta} [${m.unidad === 'rad' ? '°' : m.unidad}]`));
  }
  selector.value = estado.get().magnitud;
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.magnitud !== anterior.magnitud && selector.value !== nuevo.magnitud) selector.value = nuevo.magnitud;
  });
  return selector;
}
