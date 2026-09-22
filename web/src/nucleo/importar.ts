// Importar un archivo: acepta el .json de solo parametros (serializar.ts) y
// tambien un layout completo del contrato, del que se reconstruye el diseno
// con disenoDesdeLayout. Puro (no toca el DOM): se testea en Node.
//
// Los errores nunca son genericos. Se decide primero que clase de archivo
// es (por sus campos, no por el nombre) y despues se deja hablar al
// validador que corresponde, que ya dice campo y valor esperado:
//   - JSON invalido -> el mensaje del parser con la posicion
//   - layout con MAJOR distinto -> el de contrato/cargar.ts
//   - parametro o tipo de elemento desconocido, valor de forma equivocada
//     -> el de serializar.ts
//   - cualquier otra cosa -> se dice que campos se esperaban en cada formato

import { analizarLayout } from '../contrato/cargar';
import { disenoDesdeLayout } from '../contrato/disenoDesdeLayout';
import type { EntradaDeDiseno } from './calcular';
import { deserializarDiseno } from './serializar';

export type FormatoImportado = 'parametros' | 'layout';

export interface DisenoImportado {
  diseno: EntradaDeDiseno;
  formato: FormatoImportado;
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * Analiza el texto de un archivo y devuelve el diseno. `nombre` es solo para
 * el mensaje de error. Tira Error con un mensaje concreto si no se puede.
 */
export function importarDiseno(texto: string, nombre = 'el archivo'): DisenoImportado {
  let documento: unknown;
  try {
    documento = JSON.parse(texto);
  } catch (error) {
    throw new Error(`${nombre} no es JSON válido: ${(error as Error).message}`);
  }
  if (!esObjeto(documento)) {
    throw new Error(`${nombre} no es un objeto JSON: arranca con ${Array.isArray(documento) ? 'una lista' : typeof documento}.`);
  }

  // Solo parametros: { v, p, ei, s }.
  if ('v' in documento && 's' in documento && 'ei' in documento) {
    try {
      return { diseno: deserializarDiseno(documento), formato: 'parametros' };
    } catch (error) {
      throw new Error(`${nombre} es un archivo de parámetros pero no se pudo leer: ${(error as Error).message}`);
    }
  }

  // Layout completo del contrato: { meta, parametros, estadoInicial, elementos, ... }.
  if ('meta' in documento || 'elementos' in documento) {
    const layout = analizarLayout(texto); // rechaza MAJOR distinto con su mensaje
    if (!Array.isArray(layout.elementos) || layout.elementos.length === 0) {
      throw new Error(`${nombre} es un layout del contrato pero no trae elementos: no hay diseño que reconstruir.`);
    }
    if (!esObjeto(layout.parametros?.valores)) {
      throw new Error(`${nombre} es un layout del contrato pero le falta parametros.valores: sin eso no se puede reconstruir el diseño.`);
    }
    try {
      return { diseno: disenoDesdeLayout(layout), formato: 'layout' };
    } catch (error) {
      throw new Error(`${nombre} es un layout del contrato pero no se pudo reconstruir el diseño: ${(error as Error).message}`);
    }
  }

  const claves = Object.keys(documento).slice(0, 6).join(', ');
  throw new Error(
    `${nombre} no es ninguno de los dos formatos que se importan. Sus claves son: ${claves || '(ninguna)'}. ` +
      'Un archivo de parámetros tiene v, p, ei y s (el que descarga "Solo parámetros"); un layout del contrato tiene meta, parametros, estadoInicial y elementos.',
  );
}
