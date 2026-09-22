// El "?" al lado de cada parametro y su explicacion.
//
// Por que no `title=`, que era lo que habia: tarda cerca de un segundo en
// aparecer, no se puede estilar, no existe en tactil, y dentro del panel
// lateral (que tiene scroll propio) el navegador lo recorta.
//
// Por que el atributo nativo `popover` y no una libreria: el popover se
// renderiza en el TOP LAYER, arriba de todo y fuera del flujo, asi que el
// overflow del panel no lo puede recortar; ademas trae gratis el cierre por
// Esc y por clic afuera (light dismiss). Sin dependencias.
//
// Se abre de las tres maneras para que sirva con mouse, teclado y tactil:
// hover sobre el boton, foco de teclado sobre el boton, y clic (que ademas
// lo deja fijo). El input lleva aria-describedby apuntando al popover.
//
// La posicion se calcula a mano (getBoundingClientRect del boton, acotada a
// la ventana) y no con anchor positioning de CSS, que en 2026 sigue siendo
// solo de Chromium: un popover sin posicionar se dibuja centrado en la
// pantalla, que seria peor que lo de antes.

import { el } from './dom';

export interface ContenidoDeAyuda {
  /** Nombre humano del parametro. */
  titulo: string;
  /** Que es y que modifica (la descripcion del nucleo). */
  ayuda: string;
  /** Unidad de presentacion, como se muestra ("cm", "°", "-"). */
  unidad?: string;
  /** Valor por defecto ya formateado y con su unidad. */
  porDefecto?: string;
  /** Rango sugerido ya formateado. */
  rango?: string;
  /** Modos de curvatura que lo consumen (vacio = no es del modo). */
  modos?: string[];
  /** Elementos del catalogo que lo declaran (vacio = no es geometrico). */
  elementos?: string[];
  /** Nombre en el nucleo / el JSON, para poder buscarlo en el codigo o en el contrato. */
  clave?: string;
}

let contador = 0;

/** Distancia entre el boton y el popover, en px. Lo demas es de tokens.css. */
const SEPARACION = 6;
const MARGEN_DE_PANTALLA = 8;

function nativo(nodo: HTMLElement): boolean {
  return typeof (nodo as { showPopover?: unknown }).showPopover === 'function';
}

function abierto(nodo: HTMLElement): boolean {
  return nativo(nodo) ? nodo.matches(':popover-open') : !nodo.hidden;
}

function mostrar(nodo: HTMLElement, boton: HTMLElement): void {
  if (abierto(nodo)) return;
  if (nativo(nodo)) nodo.showPopover();
  else nodo.hidden = false;
  ubicar(nodo, boton);
}

function ocultar(nodo: HTMLElement): void {
  if (!abierto(nodo)) return;
  if (nativo(nodo)) nodo.hidePopover();
  else nodo.hidden = true;
}

/**
 * Debajo del boton y alineado a su izquierda; si no entra, se sube arriba
 * del boton y se corre para que no se salga por ningun lado. El panel esta
 * a la derecha de la pantalla, asi que el caso frecuente es correrlo a la
 * izquierda.
 */
function ubicar(nodo: HTMLElement, boton: HTMLElement): void {
  const caja = boton.getBoundingClientRect();
  const ancho = nodo.offsetWidth;
  const alto = nodo.offsetHeight;
  let izquierda = caja.left;
  if (izquierda + ancho > window.innerWidth - MARGEN_DE_PANTALLA) izquierda = window.innerWidth - ancho - MARGEN_DE_PANTALLA;
  if (izquierda < MARGEN_DE_PANTALLA) izquierda = MARGEN_DE_PANTALLA;
  let arriba = caja.bottom + SEPARACION;
  if (arriba + alto > window.innerHeight - MARGEN_DE_PANTALLA) arriba = Math.max(MARGEN_DE_PANTALLA, caja.top - alto - SEPARACION);
  nodo.style.left = `${Math.round(izquierda)}px`;
  nodo.style.top = `${Math.round(arriba)}px`;
}

function listaDeDatos(contenido: ContenidoDeAyuda): HTMLElement[] {
  const filas: [string, string][] = [];
  if (contenido.unidad && contenido.unidad !== '-') filas.push(['Unidad', contenido.unidad]);
  if (contenido.porDefecto) filas.push(['Por defecto', contenido.porDefecto]);
  if (contenido.rango) filas.push(['Rango sugerido', contenido.rango]);
  if (contenido.modos && contenido.modos.length > 0) filas.push(['Se consume en', contenido.modos.join(', ')]);
  if (contenido.elementos && contenido.elementos.length > 0) filas.push(['Lo declaran', contenido.elementos.join(', ')]);
  if (contenido.clave) filas.push(['En el JSON', contenido.clave]);
  if (filas.length === 0) return [];
  return [
    el(
      'dl',
      { class: 'ayuda-datos' },
      filas.flatMap(([clave, valor]) => [el('dt', {}, clave), el('dd', {}, valor)]),
    ),
  ];
}

export interface Ayuda {
  boton: HTMLButtonElement;
  popover: HTMLElement;
  id: string;
}

/**
 * Devuelve el boton "?" y el popover que explica el parametro. Los dos hay
 * que insertarlos en el DOM (el popover puede ir en cualquier lado: se
 * dibuja en el top layer igual).
 */
export function ayudaDeCampo(contenido: ContenidoDeAyuda): Ayuda {
  const id = `ayuda-${++contador}`;
  const popover = el(
    'div',
    { id, popover: 'auto', class: 'ayuda-popover', role: 'tooltip' },
    el('p', { class: 'ayuda-titulo' }, contenido.titulo),
    el('p', { class: 'ayuda-texto' }, contenido.ayuda),
    listaDeDatos(contenido),
  );
  if (!nativo(popover)) popover.hidden = true;

  const boton = el(
    'button',
    {
      type: 'button',
      class: 'campo-ayuda',
      'aria-label': `Qué es ${contenido.titulo}`,
      'aria-details': id,
    },
    '?',
  );

  // Hover y foco abren; salir del boton (y del propio popover) cierra, salvo
  // que se haya fijado con un clic.
  let fijado = false;
  // El clic lo maneja este listener y no el atributo popovertarget: con
  // popovertarget, hacer clic sobre un popover que el hover ya habia abierto
  // lo cerraria (el toggle nativo corre despues de los listeners).
  boton.addEventListener('click', () => {
    if (fijado) {
      fijado = false;
      ocultar(popover);
    } else {
      fijado = true;
      mostrar(popover, boton);
    }
  });
  boton.addEventListener('pointerenter', () => mostrar(popover, boton));
  boton.addEventListener('focus', () => mostrar(popover, boton));
  const cerrarSiNoEstaFijado = () => {
    if (!fijado) ocultar(popover);
  };
  boton.addEventListener('pointerleave', cerrarSiNoEstaFijado);
  boton.addEventListener('blur', cerrarSiNoEstaFijado);
  popover.addEventListener('toggle', (evento) => {
    if ((evento as ToggleEvent).newState === 'closed') fijado = false;
  });

  return { boton, popover, id };
}
