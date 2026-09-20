// De parametros.valores (o elementos[].ajustes) del contrato (camelCase, []
// donde MATLAB tenia vacio) a los Parametros del nucleo (PascalCase, null).
// Es la inversa de aCamelCase en nucleo/exportar.ts y sirve para arrancar un
// diseno a partir de un golden file.
//
// El export redondea a 6 cifras significativas (CONTRATO_VISUALIZADOR.md,
// 1.8), asi que un default como deg2rad(55) vuelve como 0.959931. Si el
// valor del JSON coincide a 6 cifras con el default, se toma el default
// exacto: es la inversa del redondeo, deja al diseno "a partir de este
// caso" igual al de MATLAB y evita que serializar.ts guarde treinta globales
// que solo difieren en la septima cifra.

import { PARAMETROS_ANULABLES, ParametrosPorDefecto } from '../nucleo/parametros';
import { igualProfundo } from '../nucleo/serializar';
import type { NombreDeParametro, Parametros } from '../nucleo/tipos';

function pascal(clave: string): string {
  return clave[0]!.toUpperCase() + clave.slice(1);
}

function seis(v: unknown): unknown {
  if (typeof v === 'number') return v === 0 ? 0 : Number(v.toPrecision(6));
  if (Array.isArray(v)) return v.map(seis);
  return v;
}

/** Un valor del contrato al del nucleo, para el parametro `nombre`. */
function valorDesdeContrato(nombre: NombreDeParametro, valor: unknown, defaults: Parametros): unknown {
  const porDefecto = defaults[nombre];
  if (PARAMETROS_ANULABLES.includes(nombre) && (valor === null || (Array.isArray(valor) && valor.length === 0))) return null;
  if (igualProfundo(seis(valor), seis(porDefecto))) return porDefecto;
  return valor;
}

/** elementos[].ajustes del contrato → ajustes de una instancia. Una clave desconocida es un error claro. */
export function ajustesDesdeContrato(ajustes: Record<string, unknown>, donde = 'ajustes'): Partial<Parametros> {
  const defaults = ParametrosPorDefecto();
  const salida: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(ajustes)) {
    const nombre = pascal(clave) as NombreDeParametro;
    if (!(nombre in defaults)) throw new Error(`${donde}.${clave} no corresponde a ningun parametro de ParametrosPorDefecto().`);
    salida[nombre] = valorDesdeContrato(nombre, valor, defaults);
  }
  return salida as Partial<Parametros>;
}

export function parametrosDesdeContrato(valores: Record<string, unknown>): Parametros {
  const defaults = ParametrosPorDefecto();
  const salida = { ...defaults } as Record<string, unknown>;
  for (const nombre of Object.keys(defaults) as NombreDeParametro[]) {
    const clave = nombre[0]!.toLowerCase() + nombre.slice(1);
    if (!(clave in valores)) continue;
    salida[nombre] = valorDesdeContrato(nombre, valores[clave], defaults);
  }
  return salida as unknown as Parametros;
}
