// Estado minimo de la pagina con suscripcion. No hay framework: cada panel se
// suscribe y se vuelve a dibujar cuando cambia lo que le importa.

import type { ClaveDeMagnitud } from './contrato/magnitudes';
import type { Layout } from './contrato/tipos';

export interface DatosDeEstado {
  /** Casos disponibles (nombres de golden/indice.json). */
  casos: string[];
  /** Caso elegido, o null antes de cargar el primero. */
  caso: string | null;
  /** Layout cargado, o null mientras carga o si fallo. */
  layout: Layout | null;
  /** Magnitud con la que se colorea la via. */
  magnitud: ClaveDeMagnitud;
  /** Indice del elemento elegido, o null si se mira el layout entero. */
  elemento: number | null;
  /** Mensaje de error a mostrar, o null. */
  error: string | null;
  /** true mientras se carga un caso. */
  cargando: boolean;
}

export type Suscriptor = (estado: DatosDeEstado, anterior: DatosDeEstado) => void;

export interface Estado {
  get(): DatosDeEstado;
  set(parcial: Partial<DatosDeEstado>): void;
  suscribir(fn: Suscriptor): () => void;
}

export function crearEstado(inicial: DatosDeEstado): Estado {
  let actual = inicial;
  const suscriptores = new Set<Suscriptor>();
  return {
    get: () => actual,
    set(parcial) {
      const anterior = actual;
      actual = { ...actual, ...parcial };
      for (const fn of suscriptores) fn(actual, anterior);
    },
    suscribir(fn) {
      suscriptores.add(fn);
      return () => {
        suscriptores.delete(fn);
      };
    },
  };
}
