// El diseno actual en localStorage: se guarda con debounce de 1 s en cada
// cambio y se restaura al abrir, para que recargar la pagina (o cerrarla
// sin querer) no borre veinte minutos de trabajo. Se guarda el diseno
// serializado (serializar.ts, del orden de 1 kB), nunca el layout.
//
// Lo que se restaura es un borrador: se recalcula al abrir, igual que un
// diseno que llega por link o por archivo.

import type { EntradaDeDiseno } from '../nucleo/calcular';
import { deserializarDiseno, serializarDiseno } from '../nucleo/serializar';
import { borrarAlmacen, escribirAlmacen, leerAlmacen } from './almacen';

export const CLAVE_DEL_DISENO = 'diseno';
export const ESPERA_MS = 1000;

interface Guardado {
  /** Diseno serializado (DisenoSerializado). */
  d: unknown;
  /** De donde salio (caso, archivo, link), para el LEEME y los nombres de archivo. */
  origen: string | null;
  /** ISO de cuando se guardo, para el aviso. */
  fecha: string;
}

export interface DisenoRestaurado {
  diseno: EntradaDeDiseno;
  origen: string | null;
  fecha: Date | null;
}

/** Guarda ya, sin esperar (la version con debounce es `guardadorDeDiseno`). */
export function guardarDiseno(diseno: EntradaDeDiseno, origen: string | null): void {
  try {
    const guardado: Guardado = { d: serializarDiseno(diseno), origen, fecha: new Date().toISOString() };
    escribirAlmacen(CLAVE_DEL_DISENO, JSON.stringify(guardado));
  } catch {
    // Un diseno que no se puede serializar no rompe la sesion: se pierde el respaldo, nada mas.
  }
}

export function olvidarDiseno(): void {
  borrarAlmacen(CLAVE_DEL_DISENO);
}

/** El ultimo diseno guardado, o null si no hay o quedo ilegible (una version vieja del formato). */
export function restaurarDiseno(): DisenoRestaurado | null {
  const texto = leerAlmacen(CLAVE_DEL_DISENO);
  if (!texto) return null;
  try {
    const guardado = JSON.parse(texto) as Guardado;
    const diseno = deserializarDiseno(guardado.d);
    const fecha = guardado.fecha ? new Date(guardado.fecha) : null;
    return { diseno, origen: guardado.origen ?? null, fecha: fecha && !Number.isNaN(fecha.getTime()) ? fecha : null };
  } catch {
    // Guardado por una version anterior del formato: se descarta en silencio.
    olvidarDiseno();
    return null;
  }
}

/** Guardador con debounce; devuelve `guardar` y `cancelar` (para destruir()). */
export function guardadorDeDiseno(esperaMs = ESPERA_MS): { guardar: (diseno: EntradaDeDiseno, origen: string | null) => void; cancelar: () => void } {
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  return {
    guardar(diseno, origen) {
      if (temporizador) clearTimeout(temporizador);
      temporizador = setTimeout(() => guardarDiseno(diseno, origen), esperaMs);
    },
    cancelar() {
      if (temporizador) clearTimeout(temporizador);
      temporizador = null;
    },
  };
}

/** "hace un rato", "hace 3 minutos", "el 19/9 a las 22:10": para el aviso de restauracion. */
export function haceCuanto(fecha: Date | null, ahora = new Date()): string {
  if (!fecha) return '';
  const minutos = Math.round((ahora.getTime() - fecha.getTime()) / 60000);
  if (minutos < 1) return ' (de recién)';
  if (minutos < 60) return ` (de hace ${minutos} minuto${minutos === 1 ? '' : 's'})`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return ` (de hace ${horas} hora${horas === 1 ? '' : 's'})`;
  return ` (del ${fecha.getDate()}/${fecha.getMonth() + 1} a las ${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')})`;
}
