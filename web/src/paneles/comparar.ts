// Comparar dos disenos (fase 4.8): "Fijar como A" guarda el layout en
// pantalla y desde ahi los graficos superponen sus curvas, en tono mas
// claro, sobre las del diseno vivo (B). Es como se toman decisiones de
// diseno de verdad: "si subo el radio, cuanto baja la Gz".
//
// La foto es el layout (las curvas) mas el diseno: se reusa la idea del
// historial de la fase 2 (un diseno es un objeto inmutable que se guarda
// por referencia) y nada se recalcula. La leyenda de cada figura marca A y
// B, y una franja arriba de los graficos dice que es A y permite
// descartarla.

import type { DatosDeEstado, Estado } from '../estado';
import { botonDeBarra, ponerTooltip } from './barra';
import { el } from './dom';

/** Como se nombra lo que esta en pantalla si se lo fija como A. */
export function etiquetaDeComparacion(e: Pick<DatosDeEstado, 'fuente' | 'caso' | 'origen'>, ahora = new Date()): string {
  const hora = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
  if (e.fuente === 'golden') return e.caso ?? 'golden';
  return `diseño propio${e.origen ? ` (de ${e.origen})` : ''}, ${hora}`;
}

/** Fija el layout en pantalla como A. */
export function fijarComoA(estado: Estado): void {
  const e = estado.get();
  if (!e.layout) return;
  estado.set({ comparacion: { layout: e.layout, diseno: e.diseno, etiqueta: etiquetaDeComparacion(e) } });
}

/** Boton de la barra: fija A o, si ya hay una, la descarta. */
export function montarBotonComparar(contenedor: HTMLElement, estado: Estado): void {
  const boton = botonDeBarra({
    icono: 'comparar',
    etiqueta: 'Fijar como A para comparar',
    texto: 'Comparar',
    alHacer: () => (estado.get().comparacion ? estado.set({ comparacion: null }) : fijarComoA(estado)),
  });
  contenedor.append(boton);
  const dibujar = (e: DatosDeEstado) => {
    const activa = e.comparacion !== null;
    boton.classList.toggle('activo', activa);
    boton.setAttribute('aria-pressed', activa ? 'true' : 'false');
    boton.disabled = !e.layout;
    ponerTooltip(boton, activa ? `Quitar la comparación con A (${e.comparacion!.etiqueta})` : 'Fijar lo que está en pantalla como A: los gráficos lo superponen al diseño que sigas editando (B)');
  };
  dibujar(estado.get());
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.comparacion !== anterior.comparacion || nuevo.layout !== anterior.layout) dibujar(nuevo);
  });
}

/** La franja arriba de los graficos: que es A, que es B, y como descartarla. */
export function franjaDeComparacion(estado: Estado): HTMLElement | null {
  const { comparacion, layout, elemento } = estado.get();
  if (!comparacion) return null;
  const sinElemento = elemento !== null && !comparacion.layout.elementos[elemento];
  return el(
    'div',
    { class: 'comparacion', role: 'status' },
    el('span', { class: 'comparacion-muestra comparacion-a', 'aria-hidden': 'true' }),
    el('span', {}, el('strong', {}, 'A'), ` ${comparacion.etiqueta} (tono claro)`),
    el('span', { class: 'comparacion-muestra comparacion-b', 'aria-hidden': 'true' }),
    el('span', {}, el('strong', {}, 'B'), comparacion.layout === layout ? ' lo mismo que A: editá y generá para ver la diferencia' : ' lo que está en pantalla'),
    sinElemento ? el('span', { class: 'ayuda' }, ` · A no tiene elemento ${elemento! + 1}`) : null,
    el('span', { class: 'comparacion-acciones' },
      el('button', { type: 'button', class: 'boton chico', title: 'Reemplazar A por lo que está en pantalla', onClick: () => fijarComoA(estado) }, 'Fijar B como A'),
      el('button', { type: 'button', class: 'boton chico', onClick: () => estado.set({ comparacion: null }) }, 'Descartar A'),
    ),
  );
}
