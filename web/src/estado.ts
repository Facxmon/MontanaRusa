// Estado minimo de la pagina con suscripcion. No hay framework: cada panel se
// suscribe y se vuelve a dibujar cuando cambia lo que le importa.

import type { ClaveDeMagnitud } from './contrato/magnitudes';
import type { Layout } from './contrato/tipos';
import type { EjeX, Pestana } from './graficos/series';
import type { EntradaDeDiseno } from './nucleo/calcular';

export type Vista = 'via3d' | 'graficos';
export type Fuente = 'golden' | 'diseno';
export type PanelLateral = 'resultados' | 'diseno';

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
  /** Que ocupa el area principal: la via en 3D o los graficos. */
  vista: Vista;
  /** Pestana de graficos activa. */
  pestana: Pestana;
  /** Eje horizontal de los graficos. */
  ejeX: EjeX;
  /** De donde salio el layout: un golden file o un diseno calculado en el navegador. */
  fuente: Fuente;
  /** El diseno editable (parametros, estado inicial, secuencia), o null si nunca se abrio uno. */
  diseno: EntradaDeDiseno | null;
  /** true mientras el worker calcula. */
  calculando: boolean;
  /** Duracion del ultimo calculo, en ms, o null. */
  ultimoCalculoMs: number | null;
  /** Pestana del panel lateral. */
  panel: PanelLateral;
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
