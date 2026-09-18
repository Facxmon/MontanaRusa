// Lista de elementos del layout: tipo, nodos, Gz maxima y si pasan sus
// criterios. Click elige (o des-elige) el elemento; "Todo el layout" vuelve
// a la vista completa.

import type { Estado } from '../estado';
import { el, vaciar } from './dom';
import { formatear } from './formato';

export function montarElementos(contenedor: HTMLElement, estado: Estado): void {
  const dibujar = () => {
    const { layout, elemento } = estado.get();
    vaciar(contenedor);
    if (!layout) return;

    const botonTodo = el(
      'button',
      {
        type: 'button',
        class: elemento === null ? 'elemento elegido' : 'elemento',
        onClick: () => estado.set({ elemento: null }),
      },
      el('span', { class: 'elemento-tipo' }, 'Todo el layout'),
      el('span', { class: 'elemento-datos' }, `${layout.elementos.length} elementos`),
    );

    const botones = layout.elementos.map((e, i) =>
      el(
        'button',
        {
          type: 'button',
          class: elemento === i ? 'elemento elegido' : 'elemento',
          onClick: () => estado.set({ elemento: elemento === i ? null : i }),
        },
        el('span', { class: `semaforo ${e.criterios.todosPasan ? 'pasa' : 'falla'}` }, e.criterios.todosPasan ? '✓' : '✗'),
        el('span', { class: 'elemento-tipo' }, `${i + 1}. ${e.tipo}`),
        el(
          'span',
          { class: 'elemento-datos' },
          `${e.nodos.numeroDeNodos} nodos · Gz máx ${formatear(e.resumen.gzMaxima, 'G')} · ${formatear(e.resumen.longitudRecorrida, 'm')}`,
        ),
      ),
    );

    contenedor.append(el('h2', {}, 'Elementos'), el('div', { class: 'lista' }, botonTodo, botones));
  };
  dibujar();
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.layout !== anterior.layout || nuevo.elemento !== anterior.elemento) dibujar();
  });
}
