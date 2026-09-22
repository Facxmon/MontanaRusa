// Criterios de aceptacion del elemento elegido: previos y posteriores, con
// semaforo, valor / limite / margen y el detalle como tooltip. Es la
// estructura de AgregarCriterio.m tal cual viene en el JSON.
//
// Un criterio que falla tiene que verse sin leer: regla roja a la
// izquierda, fondo tenido y el margen (cuanto falta) destacado. Solo texto
// rojo, como antes, se perdia entre los que pasan.

import type { Criterio } from '../contrato/tipos';
import type { Estado } from '../estado';
import { el, tarjeta, vaciar } from './dom';
import { formatear } from './formato';

function itemDeCriterio(c: Criterio): HTMLElement {
  const informativo = c.sentido === 'Informativo';
  const clase = informativo ? 'informativo' : c.pasa ? 'pasa' : 'falla';
  const simbolo = informativo ? '·' : c.pasa ? '✓' : '✗';
  const sentido = c.sentido === 'MenorOIgual' ? '≤' : c.sentido === 'MayorOIgual' ? '≥' : '';
  const detalle = informativo
    ? [formatear(c.valor, c.unidad)]
    : [
        `${formatear(c.valor, c.unidad)} ${sentido} ${formatear(c.limite, c.unidad)} · `,
        el('span', { class: 'criterio-margen' }, `margen ${formatear(c.margen, c.unidad)}`),
      ];
  return el(
    'li',
    { class: `criterio ${clase}`, title: c.detalle ?? '' },
    el('span', { class: `semaforo ${clase}`, 'aria-label': informativo ? 'informativo' : c.pasa ? 'pasa' : 'no pasa' }, simbolo),
    el('span', { class: 'criterio-nombre' }, c.nombre),
    el('span', { class: 'criterio-detalle' }, ...detalle),
  );
}

function lista(titulo: string, criterios: Criterio[]): HTMLElement {
  const noPasan = criterios.filter((c) => !c.pasa && c.sentido !== 'Informativo').length;
  // Los que fallan van primero: son los que hay que mirar.
  const ordenados = [...criterios].sort((a, b) => Number(a.pasa || a.sentido === 'Informativo') - Number(b.pasa || b.sentido === 'Informativo'));
  return el(
    'details',
    { open: noPasan > 0, class: 'criterios-grupo' },
    el('summary', {}, `${titulo} (${criterios.length}`, noPasan ? el('span', { class: 'cuenta-falla' }, `, ${noPasan} no pasan`) : null, ')'),
    el('ul', { class: 'criterios' }, ordenados.map(itemDeCriterio)),
  );
}

export function montarCriterios(contenedor: HTMLElement, estado: Estado): void {
  const dibujar = () => {
    const { layout, elemento } = estado.get();
    vaciar(contenedor);
    if (!layout || elemento === null) return;
    const e = layout.elementos[elemento];
    if (!e) return;
    const todos = [...e.criterios.previos, ...e.criterios.posteriores];
    const noPasan = todos.filter((c) => !c.pasa && c.sentido !== 'Informativo').length;
    contenedor.append(tarjeta(
      {
        clave: 'criterios',
        titulo: 'Criterios de aceptación',
        resumen: noPasan ? `${noPasan} de ${todos.length} no pasan` : `los ${todos.length} pasan`,
        clase: noPasan ? 'tarjeta-falla' : undefined,
      },
      el('p', { class: 'ayuda' }, 'Margen negativo = cuánto falta. Pasar el mouse muestra qué hacer si falla.'),
      lista('Chequeos previos', e.criterios.previos),
      lista('Chequeos posteriores', e.criterios.posteriores),
    ));
  };
  dibujar();
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.layout !== anterior.layout || nuevo.elemento !== anterior.elemento) dibujar();
  });
}
