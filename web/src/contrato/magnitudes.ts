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
}

export const MAGNITUDES: readonly Magnitud[] = [
  { clave: 'gz', etiqueta: 'Gz (vertical del carro)', unidad: 'G', escala: 'secuencial' },
  { clave: 'gy', etiqueta: 'Gy (lateral)', unidad: 'G', escala: 'divergente' },
  { clave: 'gx', etiqueta: 'Gx (longitudinal)', unidad: 'G', escala: 'divergente' },
  { clave: 'gzCabeza', etiqueta: 'Gz en la cabeza', unidad: 'G', escala: 'secuencial' },
  { clave: 'gyCabeza', etiqueta: 'Gy en la cabeza', unidad: 'G', escala: 'divergente' },
  { clave: 'velocidad', etiqueta: 'Velocidad (centro de masa)', unidad: 'm/s', escala: 'secuencial' },
  { clave: 'velocidadRiel', etiqueta: 'Velocidad (punto del riel)', unidad: 'm/s', escala: 'secuencial' },
  { clave: 'aceleracionTangencial', etiqueta: 'Aceleración tangencial', unidad: 'm/s²', escala: 'divergente' },
  { clave: 'jerkGz', etiqueta: 'Jerk Gz', unidad: 'G/s', escala: 'divergente' },
  { clave: 'jerkGy', etiqueta: 'Jerk Gy', unidad: 'G/s', escala: 'divergente' },
  { clave: 'jerkGx', etiqueta: 'Jerk Gx', unidad: 'G/s', escala: 'divergente' },
  { clave: 'curvatura', etiqueta: 'Curvatura de la heartline', unidad: '1/m', escala: 'secuencial' },
  { clave: 'curvaturaRiel', etiqueta: 'Curvatura del riel', unidad: '1/m', escala: 'secuencial' },
  { clave: 'anguloRoll', etiqueta: 'Roll contra el transporte paralelo', unidad: 'rad', escala: 'divergente' },
  { clave: 'anguloPeralte', etiqueta: 'Peralte contra la vertical', unidad: 'rad', escala: 'divergente' },
  { clave: 'fuerzaNormal', etiqueta: 'Fuerza normal sobre la vía', unidad: 'N', escala: 'secuencial' },
  { clave: 'energiaTotal', etiqueta: 'Energía mecánica total', unidad: 'J', escala: 'secuencial' },
  { clave: 'arco', etiqueta: 'Arco recorrido', unidad: 'm', escala: 'secuencial' },
  { clave: 'tiempo', etiqueta: 'Tiempo dentro del elemento', unidad: 's', escala: 'secuencial' },
];

export const MAGNITUD_INICIAL: ClaveDeMagnitud = 'gz';

export function magnitudPorClave(clave: ClaveDeMagnitud): Magnitud {
  const magnitud = MAGNITUDES.find((m) => m.clave === clave);
  if (!magnitud) throw new Error(`Magnitud desconocida: ${clave}`);
  return magnitud;
}
