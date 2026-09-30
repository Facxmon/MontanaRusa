// Web Worker que corre el nucleo fuera del hilo de la interfaz. Recibe una
// EntradaDeDiseno y responde con el layout del contrato o con el mensaje de
// error; en el medio postea el progreso despues de cada elemento. El id
// permite descartar respuestas de pedidos ya superados.
//
// No hay forma de interrumpirlo desde afuera (ver ClienteDeCalculo.abortar):
// el nucleo no chequea ninguna bandera, corre hasta el final o hasta que
// lo terminen.
//
// El calculo es incremental (calculoIncremental.ts): el worker conserva entre
// pedidos una cache por elemento y solo reconstruye los elementos cuya
// entrada cambio. El resultado es identico al de calcularLayout. Cada
// elemento nuevo se postea tambien a la pagina ({ cache }), que guarda una
// copia: si el calculo se detiene, el worker nuevo se siembra con ella
// ({ sembrar }) y lo ya calculado no se vuelve a calcular.

import { ErrorDeElemento, type EntradaDeDiseno } from './calcular';
import { CalculadorIncremental, type EntradaDeCache } from './calculoIncremental';

export interface PedidoDeCalculo {
  id: number;
  entrada: EntradaDeDiseno;
  versionGenerador: string;
}

/** Entradas de cache guardadas por la pagina, para un worker recien creado. */
export interface SiembraDeCache {
  sembrar: { firma: string; entradas: Array<[string, EntradaDeCache]> };
}

export type MensajeAlWorker = PedidoDeCalculo | SiembraDeCache;

/** Una entrada de cache nueva, copiada a la pagina. */
export interface CopiaDeCache {
  cache: { firma: string; clave: string; entrada: EntradaDeCache };
}

export interface ProgresoDeCalculo {
  hecho: number;
  total: number;
  tipo: string;
}

export type RespuestaDeCalculo =
  | { id: number; progreso: ProgresoDeCalculo }
  | { id: number; ok: true; layout: unknown; ms: number; clavesEnCache: string[] }
  | { id: number; ok: false; error: string; elemento: number | null };

const calculador = new CalculadorIncremental(undefined, (firma, clave, entrada) => {
  const copia: CopiaDeCache = { cache: { firma, clave, entrada } };
  self.postMessage(copia);
});

self.onmessage = (evento: MessageEvent<MensajeAlWorker>) => {
  if ('sembrar' in evento.data) {
    calculador.sembrar(evento.data.sembrar.firma, evento.data.sembrar.entradas);
    return;
  }
  const { id, entrada, versionGenerador } = evento.data;
  const inicio = performance.now();
  try {
    const layout = calculador.calcular(entrada, versionGenerador, (hecho, total, tipo) => {
      const progreso: RespuestaDeCalculo = { id, progreso: { hecho, total, tipo } };
      self.postMessage(progreso);
    });
    const respuesta: RespuestaDeCalculo = { id, ok: true, layout, ms: performance.now() - inicio, clavesEnCache: calculador.claves() };
    self.postMessage(respuesta);
  } catch (error) {
    const respuesta: RespuestaDeCalculo = {
      id, ok: false, error: (error as Error).message, elemento: error instanceof ErrorDeElemento ? error.indice : null,
    };
    self.postMessage(respuesta);
  }
};
