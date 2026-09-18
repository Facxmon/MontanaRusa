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

/** Fila etiqueta / valor para las tablas de resumen. */
export function fila(etiqueta: string, valor: string, clase?: string): HTMLTableRowElement {
  return el('tr', { class: clase }, el('th', { scope: 'row' }, etiqueta), el('td', {}, valor));
}
