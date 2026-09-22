// De un mensaje de error del nucleo a que campo del formulario resaltar.
//
// Los mensajes del nucleo nombran los parametros con el nombre de MATLAB
// ("PuntoDeVerificacionNormativa tiene que ser 'Heartline' o 'Cabeza'...",
// "El modo GNormativaMaxima pide +Gz pero..."), asi que alcanza con buscar
// los nombres de ParametrosPorDefecto() dentro del texto: no hace falta que
// cada sitio del nucleo devuelva un codigo, y si manana un mensaje nombra
// otro parametro, el resaltado aparece solo. Se exige que el nombre este
// completo (que no lo rodeen letras) para no confundir RadioDelLoop con
// RadioDelLoopInterior si alguna vez existe.
//
// Puro, sin DOM: se testea en Node.

import { MODOS_DE_CURVATURA, ParametrosPorDefecto } from './nucleo/parametros';
import type { NombreDeParametro } from './nucleo/tipos';

export interface Diagnostico {
  /** El mensaje tal cual, para el banner y para debajo del campo. */
  mensaje: string;
  /** Parametros nombrados en el mensaje, en el orden en que aparecen. */
  parametros: NombreDeParametro[];
  /** Id de la instancia donde fallo el calculo, si se sabe (ErrorDeCalculo.elemento). */
  instancia: string | null;
}

/**
 * Unica excepcion a "buscar el nombre": los mensajes del modo de curvatura
 * nombran el VALOR y no el parametro ("El modo GNormativaMaxima pide +Gz
 * pero..."), y son el fallo mas comun al editar. Los cuatro nombres de modo
 * no aparecen en ningun otro contexto, asi que se los trata como si
 * nombraran ModoCurvatura. No se hace con las demas opciones porque sus
 * valores (A, B, Derecha, Heartline) si aparecen hablando de otra cosa.
 */
const VALORES_QUE_NOMBRAN: { valores: readonly string[]; parametro: NombreDeParametro }[] = [
  { valores: MODOS_DE_CURVATURA, parametro: 'ModoCurvatura' },
];

/** Los parametros que el mensaje nombra, del mas largo al mas corto para que gane el nombre completo. */
export function parametrosMencionados(mensaje: string): NombreDeParametro[] {
  const nombres = (Object.keys(ParametrosPorDefecto()) as NombreDeParametro[]).sort((a, b) => b.length - a.length);
  const encontrados: { nombre: NombreDeParametro; posicion: number }[] = [];
  const ocupado: boolean[] = new Array(mensaje.length).fill(false);
  for (const nombre of nombres) {
    const patron = new RegExp(`(?<![A-Za-z])${nombre}(?![A-Za-z])`, 'g');
    let coincidencia: RegExpExecArray | null;
    while ((coincidencia = patron.exec(mensaje)) !== null) {
      const desde = coincidencia.index;
      if (ocupado[desde]) continue;
      for (let i = desde; i < desde + nombre.length; i++) ocupado[i] = true;
      encontrados.push({ nombre, posicion: desde });
    }
  }
  for (const { valores, parametro } of VALORES_QUE_NOMBRAN) {
    for (const valor of valores) {
      const posicion = mensaje.search(new RegExp(`(?<![A-Za-z])${valor}(?![A-Za-z])`));
      if (posicion >= 0) encontrados.push({ nombre: parametro, posicion });
    }
  }

  const unicos = new Map<NombreDeParametro, number>();
  for (const { nombre, posicion } of encontrados) {
    if (!unicos.has(nombre) || posicion < unicos.get(nombre)!) unicos.set(nombre, posicion);
  }
  return [...unicos.entries()].sort((a, b) => a[1] - b[1]).map(([nombre]) => nombre);
}

/** Arma el diagnostico de un error del nucleo; `instancia` viene del indice del elemento que fallo. */
export function diagnosticar(mensaje: string, instancia: string | null): Diagnostico {
  return { mensaje, parametros: parametrosMencionados(mensaje), instancia };
}
