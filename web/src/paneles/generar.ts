// Boton Generar / Detener de la barra (zona derecha) y la casilla
// "auto-generar". El calculo es explicito: editar no calcula nada, el
// boton se habilita cuando el diseno difiere del que produjo el layout en
// pantalla (estado.disenoCalculado) y muestra un punto de acento con los
// cambios pendientes. Mientras calcula pasa a "Detener" con el progreso
// determinado (elementos hechos / total) como relleno del boton.
//
// La casilla restaura el comportamiento anterior (recalcular con debounce
// en cada edicion); esta apagada por defecto y se persiste en localStorage.

import type { DatosDeEstado, Estado } from '../estado';
import { escribirAlmacen, leerAlmacen } from './almacen';
import { icono, ponerTooltip } from './barra';
import { el } from './dom';

export const CLAVE_AUTO_GENERAR = 'autoGenerar';

export interface AccionesDeGenerar {
  generar: () => void;
  detener: () => void;
}

/** Lee la preferencia persistida (apagado por defecto). */
export function leerAutoGenerar(): boolean {
  return leerAlmacen(CLAVE_AUTO_GENERAR) === '1';
}

export function montarGenerar(contenedor: HTMLElement, estado: Estado, acciones: AccionesDeGenerar): void {
  const relleno = el('span', { class: 'generar-progreso', 'aria-hidden': 'true' });
  const simbolo = el('span', { class: 'generar-icono' });
  const texto = el('span', { class: 'boton-barra-texto' });
  const punto = el('span', { class: 'generar-punto', 'aria-hidden': 'true' });
  const contador = el('span', { class: 'generar-contador' });
  const boton = el('button', {
    type: 'button',
    class: 'boton-barra boton-generar',
    onClick: () => {
      if (estado.get().calculando) acciones.detener();
      else acciones.generar();
    },
  }, relleno, simbolo, texto, punto, contador);

  const casilla = el('input', { type: 'checkbox' });
  casilla.checked = estado.get().autoGenerar;
  casilla.addEventListener('change', () => {
    estado.set({ autoGenerar: casilla.checked });
    escribirAlmacen(CLAVE_AUTO_GENERAR, casilla.checked ? '1' : '0');
  });
  const opcion = el('label', { class: 'barra-opcion', title: 'Recalcular solo con cada edición, como antes; apagado, se calcula con Generar' }, casilla, ' auto-generar');

  contenedor.append(opcion, boton);
  // La misma fraccion, en una linea fina a lo ancho de la barra: se ve desde
  // cualquier lado de la pantalla, no solo mirando el boton. Es determinada
  // (elementos hechos / total), nunca un spinner.
  const progreso = el('div', { class: 'barra-progreso', role: 'progressbar', 'aria-label': 'Progreso del cálculo', 'aria-valuemin': '0', 'aria-valuemax': '100', hidden: true },
    el('span', { class: 'barra-progreso-relleno' }));
  contenedor.closest('.barra')?.append(progreso);

  const dibujar = (e: DatosDeEstado) => {
    const pendiente = e.diseno !== null && e.diseno !== e.disenoCalculado;
    boton.classList.toggle('calculando', e.calculando);
    boton.classList.toggle('pendiente', pendiente && !e.calculando);
    simbolo.replaceChildren(icono(e.calculando ? 'detener' : 'generar'));
    if (e.calculando) {
      const p = e.progreso;
      const fraccion = p && p.total > 0 ? p.hecho / p.total : 0;
      relleno.style.width = `${Math.round(fraccion * 100)}%`;
      progreso.hidden = false;
      progreso.style.setProperty('--avance', String(fraccion));
      progreso.setAttribute('aria-valuenow', String(Math.round(fraccion * 100)));
      texto.textContent = 'Detener';
      contador.textContent = p ? `${p.hecho}/${p.total}` : '';
      contador.hidden = !p;
      boton.disabled = false;
      boton.setAttribute('aria-label', 'Detener el cálculo');
      ponerTooltip(boton, p ? `Detener: ${p.hecho} de ${p.total} elementos calculados` : 'Detener el cálculo', 'Esc');
    } else {
      relleno.style.width = '0%';
      progreso.hidden = true;
      progreso.style.setProperty('--avance', '0');
      texto.textContent = 'Generar';
      contador.textContent = '';
      contador.hidden = true;
      boton.disabled = !pendiente;
      boton.setAttribute('aria-label', 'Generar');
      ponerTooltip(
        boton,
        e.diseno === null
          ? 'Generar: primero abrí un diseño ("Diseñar a partir de este caso")'
          : pendiente
            ? 'Generar: hay cambios sin calcular'
            : 'Generar: el layout en pantalla ya corresponde a este diseño',
        'Ctrl+Enter',
      );
    }
    if (casilla.checked !== e.autoGenerar) casilla.checked = e.autoGenerar;
  };
  dibujar(estado.get());
  estado.suscribir((nuevo, anterior) => {
    if (
      nuevo.diseno !== anterior.diseno || nuevo.disenoCalculado !== anterior.disenoCalculado || nuevo.calculando !== anterior.calculando ||
      nuevo.progreso !== anterior.progreso || nuevo.autoGenerar !== anterior.autoGenerar
    ) dibujar(nuevo);
  });
}
