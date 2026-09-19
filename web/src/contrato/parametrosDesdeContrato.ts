// De parametros.valores del contrato (camelCase, [] donde MATLAB tenia
// vacio) a los Parametros del nucleo (PascalCase, null). Es la inversa de
// aCamelCase en nucleo/exportar.ts y sirve para arrancar un diseno a partir
// de un golden file.

import { ParametrosPorDefecto } from '../nucleo/parametros';
import type { NombreDeParametro, Parametros } from '../nucleo/tipos';

export function parametrosDesdeContrato(valores: Record<string, unknown>): Parametros {
  const base = ParametrosPorDefecto();
  const salida = { ...base } as Record<string, unknown>;
  for (const nombre of Object.keys(base) as NombreDeParametro[]) {
    const clave = nombre[0]!.toLowerCase() + nombre.slice(1);
    if (!(clave in valores)) continue;
    const valor = valores[clave];
    const anulable = nombre === 'OnsetMaximoModelo' || nombre === 'InclinacionHelicoidalImpuesta';
    if (anulable && (valor === null || (Array.isArray(valor) && valor.length === 0))) {
      salida[nombre] = null;
    } else {
      salida[nombre] = valor;
    }
  }
  return salida as unknown as Parametros;
}
