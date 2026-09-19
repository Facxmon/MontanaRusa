// Menu con los casos del indice (golden/indice.json). Elegir uno cambia estado.caso.

import type { Estado } from '../estado';
import { el, vaciar } from './dom';

export function montarSelectorDeCaso(contenedor: HTMLElement, estado: Estado): void {
  const dibujar = () => {
    const { casos, caso, cargando } = estado.get();
    vaciar(contenedor);
    const selector = el('select', {
      id: 'caso',
      disabled: cargando,
      onChange: (evento: Event) => estado.set({ caso: (evento.target as HTMLSelectElement).value, elemento: null, fuente: 'golden' }),
    });
    if (caso === null) {
      const propio = el('option', { value: '' }, 'Diseño propio');
      propio.selected = true;
      propio.disabled = true;
      selector.append(propio);
    }
    for (const nombre of casos) {
      const opcion = el('option', { value: nombre }, nombre);
      if (nombre === caso) opcion.selected = true;
      selector.append(opcion);
    }
    contenedor.append(
      el('label', { for: 'caso', class: 'etiqueta' }, 'Caso'),
      selector,
      el('p', { class: 'ayuda' }, cargando ? 'Cargando…' : 'Golden files generados por MATLAB (GenerarGoldenFiles.m).'),
    );
  };
  dibujar();
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.casos !== anterior.casos || nuevo.caso !== anterior.caso || nuevo.cargando !== anterior.cargando) dibujar();
  });
}
