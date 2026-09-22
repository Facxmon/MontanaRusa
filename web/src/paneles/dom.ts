// Helper minimo para armar DOM sin framework: el(etiqueta, atributos, hijos).

type Hijo = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
  etiqueta: K,
  atributos: Record<string, string | boolean | EventListener | undefined> = {},
  ...hijos: (Hijo | Hijo[])[]
): HTMLElementTagNameMap[K] {
  const nodo = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(atributos)) {
    if (valor === undefined || valor === false) continue;
    if (typeof valor === 'function') {
      nodo.addEventListener(clave.replace(/^on/, '').toLowerCase(), valor);
    } else if (valor === true) {
      nodo.setAttribute(clave, '');
    } else if (clave === 'class') {
      nodo.className = valor;
    } else {
      nodo.setAttribute(clave, valor);
    }
  }
  for (const hijo of hijos.flat()) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    nodo.append(typeof hijo === 'string' ? document.createTextNode(hijo) : hijo);
  }
  return nodo;
}

export function vaciar(contenedor: HTMLElement): void {
  contenedor.replaceChildren();
}

/**
 * Fila etiqueta / valor para las tablas de resumen. La celda lleva
 * data-clave con la etiqueta: es lo que destellarCambios usa para saber
 * que valor cambio despues de un recalculo.
 */
export function fila(etiqueta: string, valor: string, clase?: string): HTMLTableRowElement {
  return el('tr', { class: clase }, el('th', { scope: 'row' }, etiqueta), el('td', { 'data-clave': etiqueta }, valor));
}

// ---------------------------------------------------------------- tarjetas
// Cada seccion del panel lateral es una tarjeta colapsable: un <details>
// con el h2 dentro del <summary> y una linea de resumen que se ve cuando
// esta cerrada. Que tarjetas estan abiertas se recuerda por clave durante la
// sesion: los paneles se redibujan enteros con cada layout y sin esto cada
// recalculo volveria a abrir lo que el usuario cerro.

const tarjetasAbiertas = new Map<string, boolean>();

export interface OpcionesDeTarjeta {
  /** Identifica la tarjeta para recordar si esta abierta. */
  clave: string;
  titulo: string;
  /** Linea que se ve con la tarjeta cerrada: lo esencial de lo que hay adentro. */
  resumen?: string;
  /** Estado inicial si el usuario nunca la toco. */
  abierta?: boolean;
  /** Clase extra (p. ej. 'tarjeta-falla'). */
  clase?: string;
  /** Algo a la derecha del titulo que no abre ni cierra (un boton). */
  accion?: HTMLElement | null;
}

export function tarjeta(opciones: OpcionesDeTarjeta, ...hijos: (Hijo | Hijo[])[]): HTMLDetailsElement {
  const abierta = tarjetasAbiertas.get(opciones.clave) ?? opciones.abierta ?? true;
  const detalles = el(
    'details',
    { class: `tarjeta${opciones.clase ? ` ${opciones.clase}` : ''}`, open: abierta, 'data-tarjeta': opciones.clave },
    el(
      'summary',
      { class: 'tarjeta-cabecera' },
      el('h2', {}, opciones.titulo),
      el('span', { class: 'tarjeta-resumen' }, opciones.resumen ?? ''),
    ),
    el('div', { class: 'tarjeta-cuerpo' }, ...hijos),
  );
  // Un boton dentro del <summary> abriria y cerraria la tarjeta al tocarlo:
  // va al lado, en el <details>, y el CSS lo sube a la altura del titulo.
  if (opciones.accion) detalles.append(el('span', { class: 'tarjeta-accion' }, opciones.accion));
  detalles.addEventListener('toggle', () => tarjetasAbiertas.set(opciones.clave, detalles.open));
  return detalles;
}

/** Cambia la linea de resumen de una tarjeta ya armada (sin redibujarla). */
export function resumirTarjeta(detalles: HTMLDetailsElement, resumen: string): void {
  const linea = detalles.querySelector<HTMLElement>(':scope > summary .tarjeta-resumen');
  if (linea) linea.textContent = resumen;
}
