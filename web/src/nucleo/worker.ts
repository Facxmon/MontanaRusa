// Web Worker que corre el nucleo fuera del hilo de la interfaz. Recibe una
// EntradaDeDiseno y responde con el layout del contrato o con el mensaje de
// error; el id permite descartar respuestas de pedidos ya superados.

import { calcularLayout, type EntradaDeDiseno } from './calcular';

export interface PedidoDeCalculo {
  id: number;
  entrada: EntradaDeDiseno;
  versionGenerador: string;
}

export type RespuestaDeCalculo =
  | { id: number; ok: true; layout: unknown; ms: number }
  | { id: number; ok: false; error: string };

self.onmessage = (evento: MessageEvent<PedidoDeCalculo>) => {
  const { id, entrada, versionGenerador } = evento.data;
  const inicio = performance.now();
  try {
    const layout = calcularLayout(entrada, versionGenerador);
    const respuesta: RespuestaDeCalculo = { id, ok: true, layout, ms: performance.now() - inicio };
    self.postMessage(respuesta);
  } catch (error) {
    const respuesta: RespuestaDeCalculo = { id, ok: false, error: (error as Error).message };
    self.postMessage(respuesta);
  }
};
