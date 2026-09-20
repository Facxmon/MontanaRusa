// Barra de color con el rango de la magnitud elegida sobre el layout cargado.

import { magnitudPorClave } from '../contrato/magnitudes';
import { gradienteCss, paradasDeLeyenda, rangoDeMagnitud } from '../escena/colores';
import type { Estado } from '../estado';
import { el, vaciar } from './dom';
import { formatearMagnitud } from './formato';

export function montarLeyenda(contenedor: HTMLElement, estado: Estado): void {
  const dibujar = () => {
    const { layout, magnitud } = estado.get();
    vaciar(contenedor);
    if (!layout) return;
    const m = magnitudPorClave(magnitud);
    const rango = rangoDeMagnitud(layout, magnitud);
    const paradas = paradasDeLeyenda(rango, 5);
    contenedor.append(
      el('div', { class: 'leyenda-barra', style: `background: ${gradienteCss(m.escala)}` }),
      el(
        'div',
        { class: 'leyenda-paradas' },
        paradas.map((p) => el('span', {}, formatearMagnitud(p, magnitud))),
      ),
      el('p', { class: 'ayuda' }, 'Gris: nodo sin dato (null en el JSON). El rango es el del layout entero.'),
    );
  };
  dibujar();
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.layout !== anterior.layout || nuevo.magnitud !== anterior.magnitud) dibujar();
  });
}
