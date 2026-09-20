// Web Worker que corre el nucleo fuera del hilo de la interfaz. Recibe una
// EntradaDeDiseno y responde con el layout del contrato o con el mensaje de
// error; en el medio postea el progreso despues de cada elemento. El id
// permite descartar respuestas de pedidos ya superados.
//
// No hay forma de interrumpirlo desde afuera (ver ClienteDeCalculo.abortar):
// el nucleo no chequea ninguna bandera, corre hasta el final o hasta que
// lo terminen.

import { calcularLayout, ErrorDeElemento, type EntradaDeDiseno } from './calcular';

export interface PedidoDeCalculo {
  id: number;
  entrada: EntradaDeDiseno;
  versionGenerador: string;
}

export interface ProgresoDeCalculo {
  hecho: number;
  total: number;
  tipo: string;
}

export type RespuestaDeCalculo =
  | { id: number; progreso: ProgresoDeCalculo }
  | { id: number; ok: true; layout: unknown; ms: number }
  | { id: number; ok: false; error: string; elemento: number | null };

self.onmessage = (evento: MessageEvent<PedidoDeCalculo>) => {
  const { id, entrada, versionGenerador } = evento.data;
  const inicio = performance.now();
  try {
    const layout = calcularLayout(entrada, versionGenerador, (hecho, total, tipo) => {
      const progreso: RespuestaDeCalculo = { id, progreso: { hecho, total, tipo } };
      self.postMessage(progreso);
    });
    const respuesta: RespuestaDeCalculo = { id, ok: true, layout, ms: performance.now() - inicio };
    self.postMessage(respuesta);
  } catch (error) {
    const respuesta: RespuestaDeCalculo = {
      id, ok: false, error: (error as Error).message, elemento: error instanceof ErrorDeElemento ? error.indice : null,
    };
    self.postMessage(respuesta);
  }
};
