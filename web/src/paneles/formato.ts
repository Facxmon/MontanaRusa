// Formato de numeros con unidad para los paneles. El contrato manda SI y
// radianes; la conversion a grados es de presentacion y vive aca.
//
// Decimales fijos, no cifras significativas: un valor que cambia (el HUD
// del reproductor, la leyenda de un grafico) tiene que ocupar siempre el
// mismo ancho, y toPrecision borra los ceros a la derecha ("1 G" al lado
// de "0.0002815 G"). Cada magnitud del contrato declara sus decimales en
// MAGNITUDES; para las unidades sueltas del JSON (resumenes, criterios)
// esta la tabla por unidad de aca abajo.

import { magnitudPorClave, type ClaveDeMagnitud } from '../contrato/magnitudes';

export type Notacion = 'fija' | 'cientifica';

/** Valor sin dato (null en el JSON). Los contenedores le reservan el ancho de un numero. */
export const SIN_DATO = '—';

/** Decimales por unidad del contrato, para lo que no pasa por una clave de magnitud. */
export const DECIMALES_POR_UNIDAD: Readonly<Record<string, number>> = {
  G: 2,
  'm/s': 2,
  'm/s^2': 2,
  'm/s²': 2,
  m: 3,
  'm^2': 4,
  rad: 1,
  grados: 1,
  'G/s': 1,
  '1/m': 2,
  s: 3,
  N: 2,
  J: 3,
  kg: 3,
  '-': 3,
};
const DECIMALES_POR_DEFECTO = 3;

/** Con notacion cientifica, a partir de este modulo se pasa a exponente. */
const UMBRAL_CIENTIFICO = 1e4;

/** Numero con decimales fijos; en notacion cientifica el exponente aparece solo desde 1e4. */
export function formatearNumero(valor: number, decimales: number, notacion: Notacion = 'fija'): string {
  if (!Number.isFinite(valor)) return SIN_DATO;
  if (notacion === 'cientifica' && Math.abs(valor) >= UMBRAL_CIENTIFICO) {
    return valor.toExponential(decimales).replace('e+', 'e');
  }
  const texto = valor.toFixed(decimales);
  // toFixed puede dar "-0.00": el signo de un cero no aporta y mueve la columna.
  return Number(texto) === 0 ? (0).toFixed(decimales) : texto;
}

export function decimalesDeUnidad(unidad: string): number {
  return DECIMALES_POR_UNIDAD[unidad] ?? DECIMALES_POR_DEFECTO;
}

/** Valor con su unidad; null es "sin dato"; los radianes se muestran en grados. */
export function formatear(valor: number | null | undefined, unidad: string, decimales = decimalesDeUnidad(unidad), notacion: Notacion = 'fija'): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return SIN_DATO;
  if (unidad === 'rad') return `${formatearNumero((valor * 180) / Math.PI, decimales, notacion)}°`;
  if (unidad === '-' || unidad === '') return formatearNumero(valor, decimales, notacion);
  return `${formatearNumero(valor, decimales, notacion)} ${unidad}`;
}

/** Valor de una columna de nodos, con los decimales y la unidad declarados en MAGNITUDES. */
export function formatearMagnitud(valor: number | null | undefined, clave: ClaveDeMagnitud): string {
  const m = magnitudPorClave(clave);
  return formatear(valor, m.unidad, m.decimales, m.notacion);
}

/** Solo el numero de una magnitud (sin unidad), para armar columnas de ancho fijo. */
export function numeroDeMagnitud(valor: number | null | undefined, clave: ClaveDeMagnitud): string {
  const m = magnitudPorClave(clave);
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return SIN_DATO;
  const v = m.unidad === 'rad' ? (valor * 180) / Math.PI : valor;
  return formatearNumero(v, m.decimales, m.notacion);
}
