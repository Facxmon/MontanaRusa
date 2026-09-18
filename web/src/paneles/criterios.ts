// Criterios de aceptacion del elemento elegido: previos y posteriores, con
// semaforo, valor / limite / margen y el detalle como tooltip. Es la
// estructura de AgregarCriterio.m tal cual viene en el JSON.

import type { Criterio } from '../contrato/tipos';
import type { Estado } from '../estado';
import { el, vaciar } from './dom';
import { formatear } from './formato';

function filaDeCriterio(c: Criterio): HTMLTableRowElement {
  const informativo = c.sentido === 'Informativo';
  const clase = informativo ? 'informativo' : c.pasa ? 'pasa' : 'falla';
  const simbolo = informativo ? '·' : c.pasa ? '✓' : '✗';
  const sentido = c.sentido === 'MenorOIgual' ? '≤' : c.sentido === 'MayorOIgual' ? '≥' : '';
  return el(
    'tr',
    { class: clase, title: c.detalle ?? '' },
    el('td', { class: `semaforo ${clase}` }, simbolo),
    el('td', { class: 'criterio-nombre' }, c.nombre),
    el('td', { class: 'criterio-valor' }, formatear(c.valor, c.unidad)),
    el('td', { class: 'criterio-limite' }, informativo ? '' : `${sentido} ${formatear(c.limite, c.unidad)}`),
    el('td', { class: 'criterio-margen' }, informativo ? '' : formatear(c.margen, c.unidad)),
  );
}

function tabla(titulo: string, criterios: Criterio[]): HTMLElement {
  const noPasan = criterios.filter((c) => !c.pasa).length;
  return el(
    'details',
    { open: noPasan > 0 },
    el('summary', {}, `${titulo} (${criterios.length}${noPasan ? `, ${noPasan} no pasan` : ''})`),
    el(
      'table',
      { class: 'tabla criterios' },
      el('thead', {}, el('tr', {}, el('th'), el('th', {}, 'Criterio'), el('th', {}, 'Valor'), el('th', {}, 'Límite'), el('th', {}, 'Margen'))),
      el('tbody', {}, criterios.map(filaDeCriterio)),
    ),
  );
}

export function montarCriterios(contenedor: HTMLElement, estado: Estado): void {
  const dibujar = () => {
    const { layout, elemento } = estado.get();
    vaciar(contenedor);
    if (!layout || elemento === null) return;
    const e = layout.elementos[elemento];
    if (!e) return;
    contenedor.append(
      el('h2', {}, 'Criterios de aceptación'),
      el('p', { class: 'ayuda' }, 'Margen negativo = cuánto falta. Pasar el mouse muestra qué hacer si falla.'),
      tabla('Chequeos previos', e.criterios.previos),
      tabla('Chequeos posteriores', e.criterios.posteriores),
    );
  };
  dibujar();
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.layout !== anterior.layout || nuevo.elemento !== anterior.elemento) dibujar();
  });
}
