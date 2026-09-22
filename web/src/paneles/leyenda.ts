// Tarjeta "Color de la vía": el selector de la magnitud con la que se
// colorea la via y la barra de color con su rango sobre el layout cargado.
// La tarjeta y el <select> se arman una vez (redibujarlos al elegir una
// magnitud le sacaria el foco al teclado); lo que cambia es la barra, las
// paradas y la linea de resumen.

import { magnitudPorClave } from '../contrato/magnitudes';
import { gradienteCss, paradasDeLeyenda, rangoDeMagnitud } from '../escena/colores';
import type { Estado } from '../estado';
import { el, resumirTarjeta, tarjeta, vaciar } from './dom';
import { formatearMagnitud } from './formato';
import { selectorDeMagnitud } from './selectorDeMagnitud';

export function montarLeyenda(contenedor: HTMLElement, estado: Estado): void {
  const cuerpo = el('div', { class: 'leyenda' });
  const caja = tarjeta(
    { clave: 'color', titulo: 'Color de la vía' },
    el('label', {}, el('span', { class: 'etiqueta' }, 'Colorear por'), selectorDeMagnitud(estado)),
    cuerpo,
  );

  const dibujar = () => {
    const { layout, magnitud } = estado.get();
    vaciar(cuerpo);
    if (!layout) {
      contenedor.replaceChildren();
      return;
    }
    if (!caja.isConnected) contenedor.replaceChildren(caja);
    const m = magnitudPorClave(magnitud);
    const rango = rangoDeMagnitud(layout, magnitud);
    const paradas = paradasDeLeyenda(rango, 5);
    cuerpo.append(
      el('div', { class: 'leyenda-barra', style: `background: ${gradienteCss(m.escala)}` }),
      el(
        'div',
        { class: 'leyenda-paradas' },
        paradas.map((p) => el('span', {}, formatearMagnitud(p, magnitud))),
      ),
      el('p', { class: 'ayuda' }, 'Gris: nodo sin dato (null en el JSON). El rango es el del layout entero.'),
    );
    resumirTarjeta(caja, `${m.etiqueta} · ${formatearMagnitud(rango.minimo, magnitud)} a ${formatearMagnitud(rango.maximo, magnitud)}`);
  };
  dibujar();
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.layout !== anterior.layout || nuevo.magnitud !== anterior.magnitud) dibujar();
  });
}
