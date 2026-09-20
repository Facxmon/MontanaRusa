// Lado de la pagina del worker: un pedido a la vez, con id creciente; una
// respuesta (o un progreso) de un pedido viejo se descarta.
//
// Detener: abortar() hace worker.terminate() y crea un worker nuevo. Un Web
// Worker no se puede interrumpir de forma cooperativa salvo que el nucleo
// chequee una bandera en cada iteracion, lo que ensuciaria el port literal
// de MATLAB; la alternativa con SharedArrayBuffer + Atomics necesita los
// headers de aislamiento COOP/COEP, que GitHub Pages no permite configurar.
// terminate() es inmediato y garantizado, y recrear el worker cuesta
// decenas de milisegundos (el modulo ya esta cacheado). El layout que esta
// en pantalla no se toca: eso lo garantiza quien llama, que solo reemplaza
// estado.layout con una respuesta completa.

import type * as Contrato from '../contrato/tipos';
import type { EntradaDeDiseno } from './calcular';
import type { PedidoDeCalculo, ProgresoDeCalculo, RespuestaDeCalculo } from './worker';

export interface ResultadoDeCalculo {
  layout: Contrato.Layout;
  ms: number;
}

export type AlProgresar = (progreso: ProgresoDeCalculo) => void;

interface Pendiente {
  id: number;
  resolver: (r: ResultadoDeCalculo) => void;
  rechazar: (e: Error) => void;
  alProgresar?: AlProgresar;
}

export class ClienteDeCalculo {
  private worker: Worker;
  private ultimoId = 0;
  private pendiente: Pendiente | null = null;

  constructor(private readonly versionGenerador: string) {
    this.worker = this.crearWorker();
  }

  private crearWorker(): Worker {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (evento: MessageEvent<RespuestaDeCalculo>) => {
      const respuesta = evento.data;
      if (!this.pendiente || respuesta.id !== this.pendiente.id) return; // pedido superado
      if ('progreso' in respuesta) {
        this.pendiente.alProgresar?.(respuesta.progreso);
        return;
      }
      const { resolver, rechazar } = this.pendiente;
      this.pendiente = null;
      if (respuesta.ok) resolver({ layout: respuesta.layout as Contrato.Layout, ms: respuesta.ms });
      else rechazar(new ErrorDeCalculo(respuesta.error, respuesta.elemento));
    };
    worker.onerror = (evento) => {
      if (!this.pendiente) return;
      const { rechazar } = this.pendiente;
      this.pendiente = null;
      rechazar(new ErrorDeCalculo(evento.message || 'El calculo fallo en el worker.', null));
    };
    return worker;
  }

  /** true mientras hay un pedido en curso. */
  get ocupado(): boolean {
    return this.pendiente !== null;
  }

  /** Termina el worker; un pedido en curso se rechaza como superado. */
  terminar(): void {
    if (this.pendiente) this.pendiente.rechazar(new PedidoSuperado());
    this.pendiente = null;
    this.worker.terminate();
  }

  /**
   * Detiene el calculo en curso: termina el worker y levanta uno nuevo. La
   * promesa del pedido se rechaza con CalculoAbortado. Sin pedido en curso
   * no hace nada.
   */
  abortar(): void {
    if (!this.pendiente) return;
    const { rechazar } = this.pendiente;
    this.pendiente = null;
    this.worker.terminate();
    this.worker = this.crearWorker();
    rechazar(new CalculoAbortado());
  }

  /** Calcula; si habia un pedido en curso, su promesa se rechaza como superada. alProgresar recibe el avance elemento por elemento. */
  calcular(entrada: EntradaDeDiseno, alProgresar?: AlProgresar): Promise<ResultadoDeCalculo> {
    if (this.pendiente) this.pendiente.rechazar(new PedidoSuperado());
    const id = ++this.ultimoId;
    const pedido: PedidoDeCalculo = { id, entrada, versionGenerador: this.versionGenerador };
    return new Promise((resolver, rechazar) => {
      this.pendiente = { id, resolver, rechazar, alProgresar };
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

export class CalculoAbortado extends Error {
  constructor() {
    super('Calculo detenido por el usuario.');
    this.name = 'CalculoAbortado';
  }
}

/** Fallo del nucleo; `elemento` es el indice (base 0) de la instancia donde fallo, si se sabe. */
export class ErrorDeCalculo extends Error {
  constructor(mensaje: string, readonly elemento: number | null) {
    super(mensaje);
    this.name = 'ErrorDeCalculo';
  }
}
