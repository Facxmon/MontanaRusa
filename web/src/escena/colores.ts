// Escalas de color para pintar la via por magnitud. Sin dependencias: se
// testea en Node y la escena solo consume los tripletes r,g,b en 0..1.

import type { ClaveDeMagnitud, TipoDeEscala } from '../contrato/magnitudes';
import { magnitudPorClave } from '../contrato/magnitudes';
import type { Layout } from '../contrato/tipos';

export type Color = [number, number, number];

/** Nodo sin dato (null en el JSON). */
export const GRIS: Color = [0.42, 0.44, 0.48];

export interface Rango {
  minimo: number;
  maximo: number;
}

// Paradas de la escala secuencial (una aproximacion de viridis en 6 puntos).
const SECUENCIAL: Color[] = [
  [0.267, 0.005, 0.329],
  [0.283, 0.141, 0.458],
  [0.254, 0.265, 0.530],
  [0.128, 0.567, 0.551],
  [0.369, 0.789, 0.383],
  [0.993, 0.906, 0.144],
];

// Divergente azul - gris claro - rojo, centrada en 0; el centro es claro para
// que "cero" se distinga del fondo oscuro sin llamar la atencion.
const DIVERGENTE: Color[] = [
  [0.230, 0.299, 0.754],
  [0.545, 0.627, 0.898],
  [0.865, 0.865, 0.865],
  [0.925, 0.545, 0.455],
  [0.706, 0.016, 0.150],
];

function interpolar(paradas: Color[], fraccion: number): Color {
  const f = Math.min(1, Math.max(0, fraccion));
  const escalado = f * (paradas.length - 1);
  const i = Math.min(paradas.length - 2, Math.floor(escalado));
  const t = escalado - i;
  const a = paradas[i]!;
  const b = paradas[i + 1]!;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Rango de una magnitud sobre todo el layout, ignorando null. La divergente queda simetrica. */
export function rangoDeMagnitud(layout: Layout, clave: ClaveDeMagnitud): Rango {
  let minimo = Number.POSITIVE_INFINITY;
  let maximo = Number.NEGATIVE_INFINITY;
  for (const elemento of layout.elementos) {
    const columna = elemento.nodos[clave];
    if (!columna) continue;
    for (const valor of columna) {
      if (valor === null || !Number.isFinite(valor)) continue;
      if (valor < minimo) minimo = valor;
      if (valor > maximo) maximo = valor;
    }
  }
  if (!Number.isFinite(minimo)) return { minimo: 0, maximo: 0 };
  if (magnitudPorClave(clave).escala === 'divergente') {
    const amplitud = Math.max(Math.abs(minimo), Math.abs(maximo));
    return { minimo: -amplitud, maximo: amplitud };
  }
  return { minimo, maximo };
}

export function colorDe(valor: number | null, rango: Rango, escala: TipoDeEscala): Color {
  if (valor === null || !Number.isFinite(valor)) return GRIS;
  const ancho = rango.maximo - rango.minimo;
  const fraccion = ancho > 0 ? (valor - rango.minimo) / ancho : 0.5;
  return interpolar(escala === 'divergente' ? DIVERGENTE : SECUENCIAL, fraccion);
}

/** Valores equiespaciados del minimo al maximo, para rotular la leyenda. */
export function paradasDeLeyenda(rango: Rango, cantidad: number): number[] {
  const paradas: number[] = [];
  for (let i = 0; i < cantidad; i++) {
    paradas.push(rango.minimo + ((rango.maximo - rango.minimo) * i) / (cantidad - 1));
  }
  return paradas;
}

/** CSS `linear-gradient` de la escala, para dibujar la barra de la leyenda. */
export function gradienteCss(escala: TipoDeEscala): string {
  const paradas = escala === 'divergente' ? DIVERGENTE : SECUENCIAL;
  const partes = paradas.map((c, i) => {
    const [r, g, b] = c.map((x) => Math.round(x * 255));
    return `rgb(${r} ${g} ${b}) ${(100 * i) / (paradas.length - 1)}%`;
  });
  return `linear-gradient(to right, ${partes.join(', ')})`;
}
