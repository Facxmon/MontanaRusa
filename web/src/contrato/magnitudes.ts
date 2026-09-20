// Que columnas de nodos se pueden usar para colorear la via, con su etiqueta
// y su unidad para la leyenda. Las unidades son las del contrato (SI, G,
// radianes); el panel las convierte a grados si hace falta.

import type { Nodos } from './tipos';

/** Columnas escalares de nodos (las de tripletes no se colorean). */
export type ClaveDeMagnitud =
  | 'gz' | 'gy' | 'gx'
  | 'gzCabeza' | 'gyCabeza'
  | 'velocidad' | 'velocidadRiel' | 'aceleracionTangencial'
  | 'jerkGz' | 'jerkGy' | 'jerkGx'
  | 'curvatura' | 'curvaturaRiel'
  | 'anguloRoll' | 'anguloPeralte'
  | 'fuerzaNormal' | 'energiaTotal'
  | 'arco' | 'tiempo';

// Que cada clave sea de verdad una columna de Nodos lo verifica el compilador.
type ClaveValida = ClaveDeMagnitud & keyof Nodos;
const _verificacion: ClaveValida extends ClaveDeMagnitud ? true : never = true;
void _verificacion;

/**
 * secuencial: de menor a mayor (velocidad, Gz, curvatura).
 * divergente: con signo, centrada en 0 (Gy, Gx, jerk, angulos).
 */
export type TipoDeEscala = 'secuencial' | 'divergente';

export interface Magnitud {
  clave: ClaveDeMagnitud;
  etiqueta: string;
  unidad: string;
  escala: TipoDeEscala;
  /** Decimales fijos con los que se muestra (en grados si la unidad es rad). */
  decimales: number;
  /** 'cientifica': exponente a partir de 1e4 (energia); por defecto, fija. */
  notacion?: 'fija' | 'cientifica';
}

export const MAGNITUDES: readonly Magnitud[] = [
  { clave: 'gz', etiqueta: 'Gz (vertical del carro)', unidad: 'G', escala: 'secuencial', decimales: 2 },
  { clave: 'gy', etiqueta: 'Gy (lateral)', unidad: 'G', escala: 'divergente', decimales: 2 },
  { clave: 'gx', etiqueta: 'Gx (longitudinal)', unidad: 'G', escala: 'divergente', decimales: 2 },
  { clave: 'gzCabeza', etiqueta: 'Gz en la cabeza', unidad: 'G', escala: 'secuencial', decimales: 2 },
  { clave: 'gyCabeza', etiqueta: 'Gy en la cabeza', unidad: 'G', escala: 'divergente', decimales: 2 },
  { clave: 'velocidad', etiqueta: 'Velocidad (centro de masa)', unidad: 'm/s', escala: 'secuencial', decimales: 2 },
  { clave: 'velocidadRiel', etiqueta: 'Velocidad (punto del riel)', unidad: 'm/s', escala: 'secuencial', decimales: 2 },
  { clave: 'aceleracionTangencial', etiqueta: 'Aceleración tangencial', unidad: 'm/s²', escala: 'divergente', decimales: 2 },
  { clave: 'jerkGz', etiqueta: 'Jerk Gz', unidad: 'G/s', escala: 'divergente', decimales: 1 },
  { clave: 'jerkGy', etiqueta: 'Jerk Gy', unidad: 'G/s', escala: 'divergente', decimales: 1 },
  { clave: 'jerkGx', etiqueta: 'Jerk Gx', unidad: 'G/s', escala: 'divergente', decimales: 1 },
  { clave: 'curvatura', etiqueta: 'Curvatura de la heartline', unidad: '1/m', escala: 'secuencial', decimales: 2 },
  { clave: 'curvaturaRiel', etiqueta: 'Curvatura del riel', unidad: '1/m', escala: 'secuencial', decimales: 2 },
  { clave: 'anguloRoll', etiqueta: 'Roll contra el transporte paralelo', unidad: 'rad', escala: 'divergente', decimales: 1 },
  { clave: 'anguloPeralte', etiqueta: 'Peralte contra la vertical', unidad: 'rad', escala: 'divergente', decimales: 1 },
  { clave: 'fuerzaNormal', etiqueta: 'Fuerza normal sobre la vía', unidad: 'N', escala: 'secuencial', decimales: 2 },
  { clave: 'energiaTotal', etiqueta: 'Energía mecánica total', unidad: 'J', escala: 'secuencial', decimales: 3, notacion: 'cientifica' },
  { clave: 'arco', etiqueta: 'Arco recorrido', unidad: 'm', escala: 'secuencial', decimales: 3 },
  { clave: 'tiempo', etiqueta: 'Tiempo dentro del elemento', unidad: 's', escala: 'secuencial', decimales: 2 },
];

export const MAGNITUD_INICIAL: ClaveDeMagnitud = 'gz';

export function magnitudPorClave(clave: ClaveDeMagnitud): Magnitud {
  const magnitud = MAGNITUDES.find((m) => m.clave === clave);
  if (!magnitud) throw new Error(`Magnitud desconocida: ${clave}`);
  return magnitud;
}
