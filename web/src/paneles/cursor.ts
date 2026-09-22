// "Valores en el cursor": todas las magnitudes del nodo que esta bajo el
// cursor de los graficos (o bajo el carro del reproductor), no solo las
// series de la pestana activa, con el elemento y el subtramo donde cae.
//
// El estado compartido es estado.nodo, el indice de nodo GLOBAL sobre todo
// el layout. La tabla se arma una sola vez por layout y despues solo se
// reescribe el texto de cada celda: estado.nodo cambia en cada movimiento
// del mouse y en cada cuadro de la reproduccion, y rehacer el DOM ahi seria
// tirar trabajo a la basura sesenta veces por segundo.

import { MAGNITUDES } from '../contrato/magnitudes';
import type { Estado } from '../estado';
import { ubicacionDeNodo } from '../graficos/series';
import { el, vaciar } from './dom';
import { formatearMagnitud, SIN_DATO } from './formato';

export function montarValoresDelCursor(contenedor: HTMLElement, estado: Estado): void {
  let celdas: HTMLElement[] = [];
  let donde: HTMLElement | null = null;

  const armar = () => {
    const { layout } = estado.get();
    vaciar(contenedor);
    celdas = [];
    donde = null;
    if (!layout) return;
    donde = el('p', { class: 'ayuda cursor-donde' }, 'Pasá el mouse por un gráfico o movés el carro.');
    const filas = MAGNITUDES.map((magnitud) => {
      const celda = el('td', {}, SIN_DATO);
      celdas.push(celda);
      return el('tr', {}, el('th', { scope: 'row' }, magnitud.etiqueta), celda);
    });
    contenedor.append(el('h2', {}, 'Valores en el cursor'), donde, el('table', { class: 'tabla' }, el('tbody', {}, filas)));
    escribir();
  };

  const escribir = () => {
    const { layout, nodo } = estado.get();
    if (!layout || celdas.length === 0) return;
    const ubicacion = nodo === null ? null : ubicacionDeNodo(layout, nodo);
    const elemento = ubicacion ? layout.elementos[ubicacion.elemento] : undefined;
    if (donde) {
      donde.textContent =
        ubicacion && elemento
          ? `Elemento ${ubicacion.elemento + 1}: ${elemento.tipo} · ${ubicacion.subtramo ?? 'sin subtramo'} · nodo ${ubicacion.nodoLocal} de ${elemento.nodos.numeroDeNodos - 1}`
          : 'Pasá el mouse por un gráfico o movés el carro.';
    }
    MAGNITUDES.forEach((magnitud, i) => {
      const columna = elemento?.nodos[magnitud.clave] as (number | null)[] | undefined;
      const valor = ubicacion && columna ? columna[ubicacion.nodoLocal] : null;
      celdas[i]!.textContent = formatearMagnitud(valor, magnitud.clave);
    });
  };

  armar();
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.layout !== anterior.layout) armar();
    else if (nuevo.nodo !== anterior.nodo) escribir();
  });
}
