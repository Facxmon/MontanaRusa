// Estado minimo de la pagina con suscripcion. No hay framework: cada panel se
// suscribe y se vuelve a dibujar cuando cambia lo que le importa.

import type { ClaveDeMagnitud } from './contrato/magnitudes';
import type { Diagnostico } from './diagnostico';
import type { Layout } from './contrato/tipos';
import type { EjeX, Pestana } from './graficos/series';
import type { EntradaDeDiseno } from './nucleo/calcular';

/** 'ambos' parte el area principal: sin eso, el cursor ligado grafico <-> 3D no se puede ver. */
export type Vista = 'via3d' | 'graficos' | 'ambos';
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
  /** Detalle del ultimo error del calculo: que campos nombra y en que instancia fallo, para resaltarlos en el formulario. */
  diagnostico: Diagnostico | null;
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
  /** Id de la instancia de elemento elegida en el panel de diseno, o null si ninguna. */
  instancia: string | null;
  /** De donde salio el diseno (nombre del golden, del archivo importado, "link"), para el LEEME y los nombres de archivo; null si no hay diseno. */
  origen: string | null;
  /**
   * El diseno al que corresponde el layout en pantalla, o null si el layout
   * no salio de un diseno. Generar esta habilitado cuando diseno !== disenoCalculado.
   */
  disenoCalculado: EntradaDeDiseno | null;
  /** true mientras el worker calcula. */
  calculando: boolean;
  /** Avance del calculo en curso (elementos hechos / total), o null. */
  progreso: { hecho: number; total: number; tipo: string } | null;
  /** Duracion del ultimo calculo, en ms, o null. */
  ultimoCalculoMs: number | null;
  /** Recalcular solo con cada edicion (debounce), como antes de la fase 2. Apagado por defecto. */
  autoGenerar: boolean;
  /** Pestana del panel lateral. */
  panel: PanelLateral;
  /**
   * Nodo bajo el cursor, como INDICE DE NODO GLOBAL sobre todo el layout
   * (el mismo que usa la via 3D). Es el estado que comparten los graficos,
   * el marcador de la via y el reproductor; null cuando no hay cursor.
   */
  nodo: number | null;
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

/**
 * true si el cambio de layout es un RECALCULO del diseno propio (y no abrir
 * otro caso o el primer layout): es cuando los paneles destellan los
 * valores que cambiaron (fase 4.3).
 */
export function esRecalculo(nuevo: DatosDeEstado, anterior: DatosDeEstado): boolean {
  return nuevo.layout !== anterior.layout && nuevo.layout !== null && anterior.layout !== null && nuevo.fuente === 'diseno' && anterior.fuente === 'diseno';
}
