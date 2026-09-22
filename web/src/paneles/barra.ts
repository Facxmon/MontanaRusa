// Barra de aplicacion: cruza todo el ancho arriba de todo, en tres zonas.
// Izquierda: archivo (deshacer, rehacer, importar, guardar). Centro: el
// selector de vista. Derecha: Generar / Detener. La barra solo arma las
// zonas y da los helpers de boton e icono; cada grupo de botones lo monta
// su propio modulo (historial, guardar, importar, generar) en la zona que
// le toca, asi cada uno se puede probar y quitar por separado.
//
// Los iconos son SVG en linea (trazo con currentColor): no hay libreria de
// iconos y Plex no trae glifos de flechas. Todo boton con icono lleva
// aria-label y un title que incluye el atajo de teclado.

import { el } from './dom';

export interface ZonasDeBarra {
  izquierda: HTMLElement;
  centro: HTMLElement;
  derecha: HTMLElement;
}

/** Arma las tres zonas dentro del contenedor y las devuelve para que cada modulo monte lo suyo. */
export function montarBarra(contenedor: HTMLElement): ZonasDeBarra {
  const izquierda = el('div', { class: 'barra-zona izquierda', role: 'group', 'aria-label': 'Archivo y edición' });
  const centro = el('div', { class: 'barra-zona centro' });
  const derecha = el('div', { class: 'barra-zona derecha', role: 'group', 'aria-label': 'Cálculo' });
  contenedor.append(izquierda, centro, derecha);
  return { izquierda, centro, derecha };
}

export type NombreDeIcono = 'deshacer' | 'rehacer' | 'importar' | 'guardar' | 'menu' | 'generar' | 'detener' | 'link' | 'paquete' | 'cerrar' | 'sol' | 'luna' | 'auto' | 'comparar';

const SVG = 'http://www.w3.org/2000/svg';

/** Trazos de cada icono en un viewBox de 24 x 24; los rellenos van aparte. */
const TRAZOS: Record<NombreDeIcono, { trazos?: string[]; rellenos?: string[] }> = {
  deshacer: { trazos: ['M9 14 4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11'] },
  rehacer: { trazos: ['m15 14 5-5-5-5', 'M20 9H9.5a5.5 5.5 0 0 0 0 11H13'] },
  importar: { trazos: ['M12 3v12', 'm7 8 5-5 5 5', 'M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2'] },
  guardar: { trazos: ['M12 3v12', 'm7 10 5 5 5-5', 'M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2'] },
  menu: { trazos: ['m6 9 6 6 6-6'] },
  generar: { rellenos: ['M7 4.5v15a1 1 0 0 0 1.5.87l13-7.5a1 1 0 0 0 0-1.74l-13-7.5A1 1 0 0 0 7 4.5z'] },
  detener: { rellenos: ['M6 6h12v12H6z'] },
  link: { trazos: ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'] },
  paquete: { trazos: ['M21 8 12 3 3 8v8l9 5 9-5z', 'M3 8l9 5 9-5', 'M12 13v8'] },
  cerrar: { trazos: ['M6 6l12 12', 'M18 6 6 18'] },
  comparar: { trazos: ['M3 17l5-6 4 3 5-7 4 4', 'M3 20l5-4 4 2 5-5 4 2'] },
  sol: { trazos: ['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M12 2v2', 'M12 20v2', 'm4.93 4.93 1.41 1.41', 'm17.66 17.66 1.41 1.41', 'M2 12h2', 'M20 12h2', 'm6.34 17.66-1.41 1.41', 'm19.07 4.93-1.41 1.41'] },
  luna: { trazos: ['M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z'] },
  auto: { trazos: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z'], rellenos: ['M12 3a9 9 0 0 0 0 18z'] },
};

export function icono(nombre: NombreDeIcono): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icono');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const { trazos = [], rellenos = [] } = TRAZOS[nombre];
  for (const d of trazos) {
    const camino = document.createElementNS(SVG, 'path');
    camino.setAttribute('d', d);
    camino.setAttribute('fill', 'none');
    camino.setAttribute('stroke', 'currentColor');
    camino.setAttribute('stroke-width', '1.75');
    camino.setAttribute('stroke-linecap', 'round');
    camino.setAttribute('stroke-linejoin', 'round');
    svg.append(camino);
  }
  for (const d of rellenos) {
    const camino = document.createElementNS(SVG, 'path');
    camino.setAttribute('d', d);
    camino.setAttribute('fill', 'currentColor');
    svg.append(camino);
  }
  return svg;
}

export interface OpcionesDeBoton {
  icono: NombreDeIcono;
  /** Nombre accesible (aria-label) y primera parte del tooltip. */
  etiqueta: string;
  /** Atajo de teclado, se muestra en el tooltip: "Deshacer (Ctrl+Z)". */
  atajo?: string;
  /** Texto visible al lado del icono; si falta, el boton es solo icono. */
  texto?: string;
  clase?: string;
  alHacer?: () => void;
}

/** Boton de la barra: icono, etiqueta accesible y tooltip con el atajo. */
export function botonDeBarra(opciones: OpcionesDeBoton): HTMLButtonElement {
  const boton = el('button', {
    type: 'button',
    class: `boton-barra${opciones.clase ? ` ${opciones.clase}` : ''}${opciones.texto ? '' : ' solo-icono'}`,
    'aria-label': opciones.etiqueta,
    onClick: opciones.alHacer,
  }, icono(opciones.icono), opciones.texto ? el('span', { class: 'boton-barra-texto' }, opciones.texto) : null);
  ponerTooltip(boton, opciones.etiqueta, opciones.atajo);
  return boton;
}

/** Tooltip "Etiqueta (Atajo)"; se reusa cuando cambia la etiqueta (p. ej. que se va a deshacer). */
export function ponerTooltip(boton: HTMLElement, etiqueta: string, atajo?: string): void {
  boton.title = atajo ? `${etiqueta} (${atajo})` : etiqueta;
}
