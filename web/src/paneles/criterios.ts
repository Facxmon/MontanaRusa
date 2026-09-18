// Criterios de aceptacion del elemento elegido: previos y posteriores, con
// semaforo, valor / limite / margen y el detalle como tooltip. Es la
// estructura de AgregarCriterio.m tal cual viene en el JSON.

import type { Criterio } from '../contrato/tipos';
import type { Estado } from '../estado';
import { el, vaciar } from './dom';
import { formatear } from './formato';

function itemDeCriterio(c: Criterio): HTMLElement {
  const informativo = c.sentido === 'Informativo';
  const clase = informativo ? 'informativo' : c.pasa ? 'pasa' : 'falla';
  const simbolo = informativo ? '·' : c.pasa ? '✓' : '✗';
  const sentido = c.sentido === 'MenorOIgual' ? '≤' : c.sentido === 'MayorOIgual' ? '≥' : '';
  const detalle = informativo
    ? formatear(c.valor, c.unidad)
    : `${formatear(c.valor, c.unidad)} ${sentido} ${formatear(c.limite, c.unidad)} · margen ${formatear(c.margen, c.unidad)}`;
  return el(
    'li',
    { class: `criterio ${clase}`, title: c.detalle ?? '' },
    el('span', { class: `semaforo ${clase}` }, simbolo),
    el('span', { class: 'criterio-nombre' }, c.nombre),
    el('span', { class: 'criterio-detalle' }, detalle),
  );
}

function lista(titulo: string, criterios: Criterio[]): HTMLElement {
  const noPasan = criterios.filter((c) => !c.pasa).length;
  return el(
    'details',
    { open: noPasan > 0 },
    el('summary', {}, `${titulo} (${criterios.length}${noPasan ? `, ${noPasan} no pasan` : ''})`),
    el('ul', { class: 'criterios' }, criterios.map(itemDeCriterio)),
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
      lista('Chequeos previos', e.criterios.previos),
      lista('Chequeos posteriores', e.criterios.posteriores),
    );
  };
  dibujar();
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.layout !== anterior.layout || nuevo.elemento !== anterior.elemento) dibujar();
  });
}
