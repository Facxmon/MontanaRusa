// Geometria de la via a partir del contrato, sin Three.js ni DOM: arrays
// planos listos para BufferAttribute. Se testea en Node con los golden files.
//
// El tubo del riel se construye con los versores U (arriba del carro) y L
// (lateral) de cada nodo, no con un marco recalculado sobre la curva: el roll
// es un grado de libertad independiente de la geometria y el contrato manda
// los tres versores exactamente para esto (CONTRATO_VISUALIZADOR.md, 1.5).

import type { ClaveDeMagnitud, TipoDeEscala } from '../contrato/magnitudes';
import type { Layout } from '../contrato/tipos';
import { colorDe, type Rango } from './colores';

export interface NodosAplanados {
  /** Nodos de todo el layout, descartado el primero de cada elemento salvo el primero. */
  cantidad: number;
  /** [x y z] por nodo, sobre el riel. */
  riel: Float32Array;
  /** [x y z] por nodo, sobre la heartline. */
  heartline: Float32Array;
  /** Versor arriba del carro por nodo. */
  u: Float32Array;
  /** Versor lateral por nodo. */
  l: Float32Array;
  /** Indice del elemento al que pertenece cada nodo. */
  elemento: Uint16Array;
  /** Indice del nodo dentro de su elemento (base 0, el del JSON). */
  indiceLocal: Uint32Array;
  /** Primer nodo global de cada elemento. */
  inicioDeElemento: number[];
}

export interface Tubo {
  posiciones: Float32Array;
  normales: Float32Array;
  indices: Uint32Array;
  /** Nodo global al que pertenece cada vertice; con esto se colorea. */
  nodoDeVertice: Uint32Array;
}

/**
 * Concatena los nodos de todos los elementos. El primer nodo de cada elemento
 * coincide con el ultimo del anterior (contrato, seccion 6) y se descarta.
 */
export function aplanarNodos(layout: Layout): NodosAplanados {
  const total = layout.elementos.reduce((suma, e) => suma + e.nodos.numeroDeNodos, 0);
  const cantidad = total - (layout.elementos.length - 1);

  const riel = new Float32Array(cantidad * 3);
  const heartline = new Float32Array(cantidad * 3);
  const u = new Float32Array(cantidad * 3);
  const l = new Float32Array(cantidad * 3);
  const elemento = new Uint16Array(cantidad);
  const indiceLocal = new Uint32Array(cantidad);
  const inicioDeElemento: number[] = [];

  let k = 0;
  layout.elementos.forEach((e, indiceDeElemento) => {
    const n = e.nodos;
    const desde = indiceDeElemento === 0 ? 0 : 1;
    inicioDeElemento.push(k);
    for (let i = desde; i < n.numeroDeNodos; i++, k++) {
      riel[3 * k] = n.xRiel[i] ?? NaN;
      riel[3 * k + 1] = n.yRiel[i] ?? NaN;
      riel[3 * k + 2] = n.zRiel[i] ?? NaN;
      heartline[3 * k] = n.x[i] ?? NaN;
      heartline[3 * k + 1] = n.y[i] ?? NaN;
      heartline[3 * k + 2] = n.z[i] ?? NaN;
      const versorU = n.versorArribaCarro[i]!;
      const versorL = n.versorLateral[i]!;
      u[3 * k] = versorU[0];
      u[3 * k + 1] = versorU[1];
      u[3 * k + 2] = versorU[2];
      l[3 * k] = versorL[0];
      l[3 * k + 1] = versorL[1];
      l[3 * k + 2] = versorL[2];
      elemento[k] = indiceDeElemento;
      indiceLocal[k] = i;
    }
  });

  return { cantidad, riel, heartline, u, l, elemento, indiceLocal, inicioDeElemento };
}

/**
 * Tubo alrededor del riel: un anillo de `lados` vertices por nodo en el plano
 * (U, L), y dos triangulos por cara entre anillos consecutivos.
 */
export function tubo(nodos: NodosAplanados, radio: number, lados: number): Tubo {
  const { cantidad } = nodos;
  const posiciones = new Float32Array(cantidad * lados * 3);
  const normales = new Float32Array(cantidad * lados * 3);
  const nodoDeVertice = new Uint32Array(cantidad * lados);
  const indices = new Uint32Array((cantidad - 1) * lados * 6);

  for (let k = 0; k < cantidad; k++) {
    const cx = nodos.riel[3 * k]!;
    const cy = nodos.riel[3 * k + 1]!;
    const cz = nodos.riel[3 * k + 2]!;
    const ux = nodos.u[3 * k]!;
    const uy = nodos.u[3 * k + 1]!;
    const uz = nodos.u[3 * k + 2]!;
    const lx = nodos.l[3 * k]!;
    const ly = nodos.l[3 * k + 1]!;
    const lz = nodos.l[3 * k + 2]!;
    for (let j = 0; j < lados; j++) {
      const angulo = (2 * Math.PI * j) / lados;
      const cu = Math.cos(angulo);
      const cl = Math.sin(angulo);
      const nx = cu * ux + cl * lx;
      const ny = cu * uy + cl * ly;
      const nz = cu * uz + cl * lz;
      const v = k * lados + j;
      posiciones[3 * v] = cx + radio * nx;
      posiciones[3 * v + 1] = cy + radio * ny;
      posiciones[3 * v + 2] = cz + radio * nz;
      normales[3 * v] = nx;
      normales[3 * v + 1] = ny;
      normales[3 * v + 2] = nz;
      nodoDeVertice[v] = k;
    }
  }

  let t = 0;
  for (let k = 0; k < cantidad - 1; k++) {
    for (let j = 0; j < lados; j++) {
      const a = k * lados + j;
      const b = k * lados + ((j + 1) % lados);
      const c = (k + 1) * lados + j;
      const d = (k + 1) * lados + ((j + 1) % lados);
      indices[t++] = a;
      indices[t++] = c;
      indices[t++] = b;
      indices[t++] = b;
      indices[t++] = c;
      indices[t++] = d;
    }
  }

  return { posiciones, normales, indices, nodoDeVertice };
}

/** Posiciones de la heartline, una por nodo, para dibujarla como linea. */
export function lineaHeartline(nodos: NodosAplanados): Float32Array {
  return nodos.heartline.slice();
}

/** Segmentos riel -> heartline cada `cadaN` nodos: muestran el offset d*U y el roll. */
export function uniones(nodos: NodosAplanados, cadaN: number): Float32Array {
  const cantidad = Math.floor((nodos.cantidad - 1) / cadaN) + 1;
  const segmentos = new Float32Array(cantidad * 6);
  for (let s = 0; s < cantidad; s++) {
    const k = s * cadaN;
    for (let c = 0; c < 3; c++) {
      segmentos[6 * s + c] = nodos.riel[3 * k + c]!;
      segmentos[6 * s + 3 + c] = nodos.heartline[3 * k + c]!;
    }
  }
  return segmentos;
}

/** Valor de una magnitud por nodo global; NaN donde el JSON trae null. */
export function valoresPorNodo(layout: Layout, nodos: NodosAplanados, clave: ClaveDeMagnitud): Float64Array {
  const valores = new Float64Array(nodos.cantidad);
  for (let k = 0; k < nodos.cantidad; k++) {
    const columna = layout.elementos[nodos.elemento[k]!]?.nodos[clave];
    const valor = columna?.[nodos.indiceLocal[k]!];
    valores[k] = valor === null || valor === undefined ? NaN : valor;
  }
  return valores;
}

const FACTOR_DE_ATENUACION = 0.28;

/**
 * Color r,g,b por vertice segun el valor de su nodo. `atenuar(nodo)` oscurece
 * los nodos que devuelven true (los elementos no elegidos).
 */
export function coloresPorVertice(
  valores: Float64Array,
  nodoDeVertice: Uint32Array,
  rango: Rango,
  escala: TipoDeEscala,
  atenuar?: (nodo: number) => boolean,
): Float32Array {
  const colores = new Float32Array(nodoDeVertice.length * 3);
  // Un color por nodo, no por vertice: el tubo tiene `lados` vertices por nodo.
  const porNodo = new Map<number, [number, number, number]>();
  for (let v = 0; v < nodoDeVertice.length; v++) {
    const nodo = nodoDeVertice[v]!;
    let color = porNodo.get(nodo);
    if (!color) {
      const valor = valores[nodo]!;
      color = colorDe(Number.isNaN(valor) ? null : valor, rango, escala);
      if (atenuar?.(nodo)) {
        color = [color[0] * FACTOR_DE_ATENUACION, color[1] * FACTOR_DE_ATENUACION, color[2] * FACTOR_DE_ATENUACION];
      }
      porNodo.set(nodo, color);
    }
    colores[3 * v] = color[0];
    colores[3 * v + 1] = color[1];
    colores[3 * v + 2] = color[2];
  }
  return colores;
}
