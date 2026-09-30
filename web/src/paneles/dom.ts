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
  // El boton va dentro del <summary>, a la derecha del titulo: la activacion
  // de un control interactivo no abre ni cierra el <details> (la toma el
  // boton), y afuera quedaria recortado por la animacion de apertura.
  if (opciones.accion) detalles.querySelector('summary')!.append(el('span', { class: 'tarjeta-accion' }, opciones.accion));
  detalles.addEventListener('toggle', () => tarjetasAbiertas.set(opciones.clave, detalles.open));
  return detalles;
}

// ---------------------------------------------------------------- errores
// Un campo con error (.con-error) dentro de una seccion plegada no se ve: el
// icono de error se repite en el encabezado de cada <details> que lo
// contiene, del grupo a la tarjeta, para que se sepa donde entrar.

const CLASE_DEL_ICONO_DE_ERROR = 'summary-error';

/** Un "⚠" para el encabezado de una seccion o una pestana que esconde un error. */
export function iconoDeError(titulo = 'Hay un campo con error adentro'): HTMLElement {
  return el('span', { class: CLASE_DEL_ICONO_DE_ERROR, title: titulo, 'aria-label': titulo, role: 'img' }, '⚠');
}

/** Agrega el icono de error al <summary> de cada <details> de `raiz` que contiene un .con-error. */
export function marcarErroresEnSecciones(raiz: HTMLElement): void {
  for (const conError of raiz.querySelectorAll<HTMLElement>('.con-error')) {
    for (let nodo = conError.parentElement; nodo && raiz.contains(nodo); nodo = nodo.parentElement) {
      if (!(nodo instanceof HTMLDetailsElement)) continue;
      const resumen = nodo.querySelector<HTMLElement>(':scope > summary');
      if (!resumen || resumen.querySelector(`:scope > .${CLASE_DEL_ICONO_DE_ERROR}`)) continue;
      // En una tarjeta va pegado al titulo (antes de la linea de resumen); en un grupo, al final del texto.
      const titulo = resumen.querySelector(':scope > h2');
      if (titulo) titulo.after(iconoDeError());
      else resumen.append(iconoDeError());
    }
  }
}

/** Cambia la linea de resumen de una tarjeta ya armada (sin redibujarla). */
export function resumirTarjeta(detalles: HTMLDetailsElement, resumen: string): void {
  const linea = detalles.querySelector<HTMLElement>(':scope > summary .tarjeta-resumen');
  if (linea) linea.textContent = resumen;
}

// ---------------------------------------------------------------- destello
// Despues de un recalculo, las celdas cuyo valor cambio se tinen 400 ms:
// se ve de un vistazo QUE cambio al tocar un parametro. Nunca se mueve el
// numero (fase 0), solo el fondo de la celda.

/** Texto de cada [data-clave] del contenedor, para comparar despues de redibujar. */
export function valoresPorClave(contenedor: HTMLElement): Map<string, string> {
  const valores = new Map<string, string>();
  for (const nodo of contenedor.querySelectorAll<HTMLElement>('[data-clave]')) valores.set(nodo.dataset.clave!, nodo.textContent ?? '');
  return valores;
}

/** Destella las [data-clave] cuyo texto difiere del de antes; las nuevas no. */
export function destellarCambios(contenedor: HTMLElement, antes: Map<string, string>): void {
  if (antes.size === 0) return;
  for (const nodo of contenedor.querySelectorAll<HTMLElement>('[data-clave]')) {
    const previo = antes.get(nodo.dataset.clave!);
    if (previo === undefined || previo === nodo.textContent) continue;
    nodo.classList.remove('destello');
    // Forzar el reflow reinicia la animacion si el valor cambia dos veces seguidas.
    void nodo.offsetWidth;
    nodo.classList.add('destello');
    nodo.addEventListener('animationend', () => nodo.classList.remove('destello'), { once: true });
  }
}

let ultimoId = 0;
/** Un id unico en el documento (el visualizador se puede montar dos veces: nada de ids fijos). */
export function idUnico(prefijo: string): string {
  ultimoId += 1;
  return `${prefijo}-${ultimoId}`;
}
