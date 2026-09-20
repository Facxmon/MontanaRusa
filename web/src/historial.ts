// Deshacer / rehacer del diseno. Es barato porque estado.diseno es un objeto
// plano que se reemplaza entero en cada edicion: alcanza con guardar la
// referencia anterior. Se guarda SOLO el diseno (del orden de 1 kB), nunca
// el layout calculado (megabytes, se recalcula con Generar).
//
// Coalescer: ediciones consecutivas al mismo campo dentro de VENTANA_MS se
// funden en una sola entrada, para que tipear un valor en varios pasos no
// sean varios "deshacer". El campo se identifica por instancia + nombre de
// parametro (o global + nombre, o el campo del estado inicial). Que cambio
// se deduce comparando los dos disenos, asi los paneles no tienen que
// avisar que tocaron: describirCambio da el campo (si fue uno solo) y la
// etiqueta para el tooltip ("deshacer: radioDeLaHelice de 2. Helice").
//
// Puro, sin DOM: se testea en Node.

import type { EntradaDeDiseno, InstanciaDeElemento } from './nucleo/calcular';
import { igualProfundo } from './nucleo/serializar';
import type { NombreDeParametro } from './nucleo/tipos';

export const TOPE_DE_ENTRADAS = 50;
export const VENTANA_MS = 500;

export interface Cambio {
  /** Identidad del campo editado si fue uno solo (`global:RadioDelLoop`, `e2:RadioDeLaHelice`, `ei:velocidad`); null si cambio mas de una cosa. */
  campo: string | null;
  /** Que se va a deshacer / rehacer, para el tooltip. */
  etiqueta: string;
  /** Instancia involucrada, si la hay: al deshacer se la vuelve a elegir para que se vea el campo volver. */
  instancia: string | null;
}

export interface EntradaDeHistorial extends Cambio {
  diseno: EntradaDeDiseno;
  instante: number;
}

function camel(nombre: string): string {
  return nombre[0]!.toLowerCase() + nombre.slice(1);
}

function nombreDeInstancia(inst: InstanciaDeElemento, secuencia: InstanciaDeElemento[]): string {
  const orden = secuencia.findIndex((i) => i.id === inst.id);
  return `${orden >= 0 ? `${orden + 1}. ` : ''}${inst.tipo}`;
}

function clavesDistintas(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  const claves = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...claves].filter((k) => !igualProfundo(a[k], b[k]));
}

/** Compara dos disenos y describe el paso de `a` a `b`. */
export function describirCambio(a: EntradaDeDiseno, b: EntradaDeDiseno): Cambio {
  const cambios: Cambio[] = [];

  // --- globales ---
  const globales = clavesDistintas(a.parametros as unknown as Record<string, unknown>, b.parametros as unknown as Record<string, unknown>);
  if (globales.length === 1) {
    const nombre = globales[0] as NombreDeParametro;
    cambios.push({ campo: `global:${nombre}`, etiqueta: `${camel(nombre)} (global)`, instancia: null });
  } else if (globales.length > 1) {
    cambios.push({ campo: null, etiqueta: `parámetros globales (${globales.length})`, instancia: null });
  }

  // --- estado inicial ---
  const ei: [keyof EntradaDeDiseno, string][] = [['posicion', 'posición inicial'], ['velocidad', 'velocidad inicial'], ['tangente', 'tangente inicial'], ['arriba', 'arriba inicial']];
  for (const [clave, etiqueta] of ei) {
    if (!igualProfundo(a[clave], b[clave])) cambios.push({ campo: `ei:${clave}`, etiqueta, instancia: null });
  }

  // --- secuencia ---
  const idsA = a.secuencia.map((i) => i.id);
  const idsB = b.secuencia.map((i) => i.id);
  if (idsA.length !== idsB.length) {
    const agregadas = b.secuencia.filter((i) => !idsA.includes(i.id));
    const quitadas = a.secuencia.filter((i) => !idsB.includes(i.id));
    if (agregadas.length === 1 && quitadas.length === 0) {
      const inst = agregadas[0]!;
      cambios.push({ campo: null, etiqueta: `agregar ${nombreDeInstancia(inst, b.secuencia)}`, instancia: inst.id });
    } else if (quitadas.length === 1 && agregadas.length === 0) {
      cambios.push({ campo: null, etiqueta: `quitar ${nombreDeInstancia(quitadas[0]!, a.secuencia)}`, instancia: null });
    } else {
      cambios.push({ campo: null, etiqueta: 'secuencia de elementos', instancia: null });
    }
  } else if (idsA.some((id, i) => id !== idsB[i])) {
    const movida = b.secuencia.find((inst, i) => inst.id !== idsA[i]);
    cambios.push({ campo: null, etiqueta: movida ? `mover ${nombreDeInstancia(movida, b.secuencia)}` : 'orden de la secuencia', instancia: movida?.id ?? null });
  } else {
    for (let i = 0; i < a.secuencia.length; i++) {
      const ia = a.secuencia[i]!;
      const ib = b.secuencia[i]!;
      const nombre = nombreDeInstancia(ib, b.secuencia);
      if (ia.tipo !== ib.tipo) cambios.push({ campo: `${ib.id}:tipo`, etiqueta: `tipo de ${i + 1}: ${ia.tipo} → ${ib.tipo}`, instancia: ib.id });
      const ajustes = clavesDistintas(ia.ajustes as Record<string, unknown>, ib.ajustes as Record<string, unknown>);
      if (ajustes.length === 1) {
        const parametro = ajustes[0]!;
        const quitado = !(parametro in ib.ajustes);
        cambios.push({ campo: `${ib.id}:${parametro}`, etiqueta: `${camel(parametro)} de ${nombre}${quitado ? ' (vuelve al global)' : ''}`, instancia: ib.id });
      } else if (ajustes.length > 1) {
        cambios.push({ campo: null, etiqueta: `ajustes de ${nombre} (${ajustes.length})`, instancia: ib.id });
      }
    }
  }

  if (cambios.length === 0) return { campo: null, etiqueta: 'sin cambios', instancia: null };
  if (cambios.length === 1) return cambios[0]!;
  return { campo: null, etiqueta: `varios cambios (${cambios.map((c) => c.etiqueta).join(', ')})`, instancia: null };
}

export class Historial {
  private pasado: EntradaDeHistorial[] = [];
  private futuro: EntradaDeHistorial[] = [];

  constructor(private readonly tope = TOPE_DE_ENTRADAS, private readonly ventanaMs = VENTANA_MS) {}

  /**
   * Registra el paso de `anterior` a `nuevo` (el diseno anterior queda en la
   * pila para volver a el). Coalesce con la entrada de arriba si es el mismo
   * campo dentro de la ventana: se conserva el diseno de antes de la primera
   * edicion. Cualquier edicion vacia el futuro.
   */
  registrar(anterior: EntradaDeDiseno, nuevo: EntradaDeDiseno, ahora = Date.now()): void {
    if (anterior === nuevo) return;
    const cambio = describirCambio(anterior, nuevo);
    this.futuro = [];
    const arriba = this.pasado[this.pasado.length - 1];
    if (cambio.campo !== null && arriba && arriba.campo === cambio.campo && ahora - arriba.instante < this.ventanaMs) {
      arriba.instante = ahora;
      return;
    }
    this.pasado.push({ ...cambio, diseno: anterior, instante: ahora });
    if (this.pasado.length > this.tope) this.pasado.shift();
  }

  /** Vuelve una entrada atras: devuelve el diseno a aplicar (y su cambio), o null si no hay. `actual` pasa al futuro. */
  deshacer(actual: EntradaDeDiseno): EntradaDeHistorial | null {
    const entrada = this.pasado.pop();
    if (!entrada) return null;
    this.futuro.push({ ...entrada, diseno: actual });
    return entrada;
  }

  /** Inversa de deshacer. */
  rehacer(actual: EntradaDeDiseno): EntradaDeHistorial | null {
    const entrada = this.futuro.pop();
    if (!entrada) return null;
    this.pasado.push({ ...entrada, diseno: actual });
    return entrada;
  }

  /** Etiqueta de lo que se deshace / rehace con el proximo paso, o null si la pila esta vacia. */
  get etiquetaDeDeshacer(): string | null {
    return this.pasado[this.pasado.length - 1]?.etiqueta ?? null;
  }

  get etiquetaDeRehacer(): string | null {
    return this.futuro[this.futuro.length - 1]?.etiqueta ?? null;
  }

  get puedeDeshacer(): boolean {
    return this.pasado.length > 0;
  }

  get puedeRehacer(): boolean {
    return this.futuro.length > 0;
  }

  get largo(): { pasado: number; futuro: number } {
    return { pasado: this.pasado.length, futuro: this.futuro.length };
  }

  vaciar(): void {
    this.pasado = [];
    this.futuro = [];
  }
}
