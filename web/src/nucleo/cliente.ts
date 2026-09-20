// Lado de la pagina del worker: un pedido a la vez, con id creciente; una
// respuesta de un pedido viejo se descarta.

import type * as Contrato from '../contrato/tipos';
import type { EntradaDeDiseno } from './calcular';
import type { PedidoDeCalculo, RespuestaDeCalculo } from './worker';

export interface ResultadoDeCalculo {
  layout: Contrato.Layout;
  ms: number;
}

export class ClienteDeCalculo {
  private readonly worker: Worker;
  private ultimoId = 0;
  private pendiente: { id: number; resolver: (r: ResultadoDeCalculo) => void; rechazar: (e: Error) => void } | null = null;

  constructor(private readonly versionGenerador: string) {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (evento: MessageEvent<RespuestaDeCalculo>) => {
      const respuesta = evento.data;
      if (!this.pendiente || respuesta.id !== this.pendiente.id) return; // pedido superado
      const { resolver, rechazar } = this.pendiente;
      this.pendiente = null;
      if (respuesta.ok) resolver({ layout: respuesta.layout as Contrato.Layout, ms: respuesta.ms });
      else rechazar(new Error(respuesta.error));
    };
    this.worker.onerror = (evento) => {
      if (!this.pendiente) return;
      const { rechazar } = this.pendiente;
      this.pendiente = null;
      rechazar(new Error(evento.message || 'El calculo fallo en el worker.'));
    };
  }

  /** Termina el worker; un pedido en curso se rechaza como superado. */
  terminar(): void {
    if (this.pendiente) this.pendiente.rechazar(new PedidoSuperado());
    this.pendiente = null;
    this.worker.terminate();
  }

  /** Calcula; si habia un pedido en curso, su promesa se rechaza como superada. */
  calcular(entrada: EntradaDeDiseno): Promise<ResultadoDeCalculo> {
    if (this.pendiente) this.pendiente.rechazar(new PedidoSuperado());
    const id = ++this.ultimoId;
    const pedido: PedidoDeCalculo = { id, entrada, versionGenerador: this.versionGenerador };
    return new Promise((resolver, rechazar) => {
      this.pendiente = { id, resolver, rechazar };
      this.worker.postMessage(pedido);
    });
  }
}

export class PedidoSuperado extends Error {
  constructor() {
    super('Pedido superado por otro mas nuevo.');
    this.name = 'PedidoSuperado';
  }
}
