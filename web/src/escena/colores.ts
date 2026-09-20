// Escalas de color para pintar la via por magnitud. Sin dependencias: se
// testea en Node y la escena solo consume los tripletes r,g,b en 0..1.
//
// COMO SE CALCULAN LOS COLORES. No hay una formula cerrada ni literales
// hexadecimales: cada escala es una lista de paradas RGB en 0..1 y el color
// de un valor sale de interpolar linealmente, en RGB, entre las dos paradas
// que lo rodean (fraccion = posicion del valor dentro del rango, saturada a
// [0, 1]). La secuencial es una aproximacion de viridis en seis paradas
// (violeta -> azul -> verde -> amarillo, monotona en luminancia, legible
// sobre fondo oscuro). La divergente es azul - gris claro - rojo en cinco
// paradas, centrada en 0, con el centro claro para que "cero" se distinga
// del fondo oscuro sin llamar la atencion. El gris de "sin dato" es un
// triplete aparte.
//
// Los extremos y las paradas son parametros nombrados (ESCALAS_OSCURO) y
// todas las funciones los reciben como argumento opcional: el tema claro
// (fase 4) va a pasar otras paradas, no a tocar la formula. Estos valores
// no viven en tokens.css porque van directo a un atributo de color de la
// GPU, no al CSS; son el unico color que no sale de ahi.

import type { ClaveDeMagnitud, TipoDeEscala } from '../contrato/magnitudes';
import { magnitudPorClave } from '../contrato/magnitudes';
import type { Layout } from '../contrato/tipos';

export type Color = [number, number, number];

/** Paradas de las dos escalas y el gris de "sin dato" de un tema. */
export interface ParadasDeEscalas {
  secuencial: Color[];
  divergente: Color[];
  sinDato: Color;
}

/** Escalas del tema oscuro (las de siempre). Extremos: violeta oscuro -> amarillo; azul -> rojo. */
export const ESCALAS_OSCURO: ParadasDeEscalas = {
  // Aproximacion de viridis en 6 paradas.
  secuencial: [
    [0.267, 0.005, 0.329],
    [0.283, 0.141, 0.458],
    [0.254, 0.265, 0.530],
    [0.128, 0.567, 0.551],
    [0.369, 0.789, 0.383],
    [0.993, 0.906, 0.144],
  ],
  // Azul - gris claro - rojo, centrada en 0.
  divergente: [
    [0.230, 0.299, 0.754],
    [0.545, 0.627, 0.898],
    [0.865, 0.865, 0.865],
    [0.925, 0.545, 0.455],
    [0.706, 0.016, 0.150],
  ],
  sinDato: [0.42, 0.44, 0.48],
};

/** Nodo sin dato (null en el JSON), en el tema oscuro. */
export const GRIS: Color = ESCALAS_OSCURO.sinDato;

export interface Rango {
  minimo: number;
  maximo: number;
}

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

export function colorDe(valor: number | null, rango: Rango, escala: TipoDeEscala, paradas: ParadasDeEscalas = ESCALAS_OSCURO): Color {
  if (valor === null || !Number.isFinite(valor)) return paradas.sinDato;
  const ancho = rango.maximo - rango.minimo;
  const fraccion = ancho > 0 ? (valor - rango.minimo) / ancho : 0.5;
  return interpolar(escala === 'divergente' ? paradas.divergente : paradas.secuencial, fraccion);
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
export function gradienteCss(escala: TipoDeEscala, paradas: ParadasDeEscalas = ESCALAS_OSCURO): string {
  const lista = escala === 'divergente' ? paradas.divergente : paradas.secuencial;
  const partes = lista.map((c, i) => {
    const [r, g, b] = c.map((x) => Math.round(x * 255));
    return `rgb(${r} ${g} ${b}) ${(100 * i) / (lista.length - 1)}%`;
  });
  return `linear-gradient(to right, ${partes.join(', ')})`;
}
