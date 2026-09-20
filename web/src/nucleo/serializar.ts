// Serializacion unica del diseno: un solo formato para guardar a archivo,
// importar, compartir por el hash de la URL y deshacer/rehacer (fase 2).
// Guarda SOLO lo que difiere de ParametrosPorDefecto(): un diseno pesa del
// orden de 1 kB, no los 2 MB del layout completo, y deserializarDiseno
// completa el resto con los defaults. Los nombres son los del nucleo
// (PascalCase, los de ParametrosPorDefecto()): es un formato interno de la
// web, no el contrato del visualizador (ese es exportar.ts, en camelCase).
//
// Compresion: fflate y no CompressionStream nativo, por tres razones.
// 1. La API es sincronica (deflateSync / inflateSync); CompressionStream es
//    solo asincronica, y aTextoCompacto/desdeTextoCompacto tienen que poder
//    usarse en un handler de hashchange, en el deshacer/rehacer y en los tests
//    sin convertir todo a promesas.
// 2. deflate-raw nativo recien existe en Chrome 103, Firefox 113, Safari 16.4
//    y Node 21.2; fflate corre igual en el hilo principal, en el worker y en
//    Node 18, que es lo que tiene que soportar `npm test`.
// 3. Cuesta ~8 kB minificados con tree-shaking (solo deflate + inflate), que
//    es menos que un icono.
// El texto compacto es deflate crudo (sin cabecera zlib ni gzip) en base64url
// sin relleno: apto para el hash de la URL sin escapar nada.
//
// Errores: nunca silenciosos. deserializarDiseno y desdeTextoCompacto
// rechazan con un Error cuyo mensaje dice que campo fallo y que se esperaba.

import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import type { EntradaDeDiseno, InstanciaDeElemento } from './calcular';
import type { Vec3 } from './matematica';
import { CATALOGO_DE_ELEMENTOS, OPCIONES_DE_PARAMETRO, PARAMETROS_ANULABLES, ParametrosPorDefecto } from './parametros';
import type { NombreDeElemento, NombreDeParametro, Parametros } from './tipos';

export interface DisenoSerializado {
  v: 1;
  /** Solo los parametros globales que difieren de ParametrosPorDefecto(), por nombre del nucleo. */
  p: Record<string, unknown>;
  /** Estado inicial: posicion del riel, tangente, arriba, velocidad del centro de masa. */
  ei: { pos: Vec3; tan: Vec3; arr: Vec3; vel: number };
  /** Instancias en orden: tipo y ajustes propios (solo lo que pisa). */
  s: { t: string; a: Record<string, unknown> }[];
}

const VERSION = 1;

// ------------------------------------------------------------ utilidades
/** Igualdad profunda para valores de parametro: numeros, logicos, textos, null, vectores y matrices. */
export function igualProfundo(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return Number.isNaN(a) && Number.isNaN(b);
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => igualProfundo(v, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ca = Object.keys(a as object);
    const cb = Object.keys(b as object);
    return ca.length === cb.length && ca.every((k) => k in (b as object) && igualProfundo((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

/** Copia sin referencias compartidas (los valores de parametro son JSON puro). */
function clonar<T>(valor: T): T {
  if (Array.isArray(valor)) return valor.map(clonar) as T;
  if (valor && typeof valor === 'object') {
    const salida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) salida[k] = clonar(v);
    return salida as T;
  }
  return valor;
}

function esObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function esVector3(valor: unknown): valor is Vec3 {
  return Array.isArray(valor) && valor.length === 3 && valor.every((v) => typeof v === 'number' && Number.isFinite(v));
}

function describir(valor: unknown): string {
  if (valor === undefined) return 'nada (undefined)';
  const texto = JSON.stringify(valor);
  return texto === undefined ? String(valor) : texto.length > 60 ? `${texto.slice(0, 57)}...` : texto;
}

// ------------------------------------------------------------ forma de cada parametro
type Forma = 'numero' | 'logico' | 'texto' | 'opcion' | 'vector3' | 'caja3x2';

/** Que forma tiene que tener el valor de un parametro, deducida del default (y de las tablas de opciones y anulables). */
function formaDe(nombre: NombreDeParametro, defaults: Parametros): { forma: Forma; anulable: boolean; opciones?: readonly string[] } {
  const anulable = PARAMETROS_ANULABLES.includes(nombre);
  const opciones = OPCIONES_DE_PARAMETRO[nombre];
  if (opciones) return { forma: 'opcion', anulable, opciones };
  // Los anulables valen null por defecto: su forma "llena" se fija a mano.
  if (nombre === 'OnsetMaximoModelo') return { forma: 'vector3', anulable };
  if (nombre === 'InclinacionHelicoidalImpuesta') return { forma: 'numero', anulable };
  const d = defaults[nombre];
  if (typeof d === 'number') return { forma: 'numero', anulable };
  if (typeof d === 'boolean') return { forma: 'logico', anulable };
  if (typeof d === 'string') return { forma: 'texto', anulable };
  if (Array.isArray(d) && d.length === 3 && Array.isArray(d[0])) return { forma: 'caja3x2', anulable };
  if (Array.isArray(d) && d.length === 3) return { forma: 'vector3', anulable };
  throw new Error(`serializar: no se que forma tiene el parametro ${nombre} (default ${describir(d)}).`);
}

function textoDeForma(forma: Forma, opciones?: readonly string[]): string {
  switch (forma) {
    case 'numero': return 'un numero finito';
    case 'logico': return 'true o false';
    case 'texto': return 'un texto';
    case 'opcion': return `uno de: ${(opciones ?? []).join(', ')}`;
    case 'vector3': return 'un vector de 3 numeros finitos';
    case 'caja3x2': return 'una matriz 3x2 [[xmin, xmax], [ymin, ymax], [zmin, zmax]] de numeros finitos';
  }
}

function tieneForma(valor: unknown, forma: Forma, opciones?: readonly string[]): boolean {
  switch (forma) {
    case 'numero': return typeof valor === 'number' && Number.isFinite(valor);
    case 'logico': return typeof valor === 'boolean';
    case 'texto': return typeof valor === 'string';
    case 'opcion': return typeof valor === 'string' && (opciones ?? []).includes(valor);
    case 'vector3': return esVector3(valor);
    case 'caja3x2': return Array.isArray(valor) && valor.length === 3 && valor.every((fila) => Array.isArray(fila) && fila.length === 2 && fila.every((v) => typeof v === 'number' && Number.isFinite(v)));
  }
}

/**
 * Valida un bloque {nombre: valor} contra ParametrosPorDefecto(): nombres
 * que existen y valores de la forma correcta. `donde` es el prefijo del
 * mensaje de error (`p` o `s[2].a`). Devuelve una copia con los mismos
 * nombres, tipada como Partial<Parametros>.
 */
function validarBloque(bloque: unknown, donde: string, defaults: Parametros): Partial<Parametros> {
  if (!esObjetoPlano(bloque)) throw new Error(`${donde} tiene que ser un objeto {nombre: valor} y es ${describir(bloque)}.`);
  const salida: Record<string, unknown> = {};
  for (const [nombre, valor] of Object.entries(bloque)) {
    if (!(nombre in defaults)) {
      throw new Error(`${donde}.${nombre} no existe en ParametrosPorDefecto(): revisar el nombre (son los de MATLAB, en PascalCase, p. ej. RadioDelLoop).`);
    }
    const { forma, anulable, opciones } = formaDe(nombre as NombreDeParametro, defaults);
    const vale = (anulable && valor === null) || tieneForma(valor, forma, opciones);
    if (!vale) {
      throw new Error(`${donde}.${nombre} vale ${describir(valor)} y se esperaba ${textoDeForma(forma, opciones)}${anulable ? ' o null' : ''}.`);
    }
    salida[nombre] = clonar(valor);
  }
  return salida as Partial<Parametros>;
}

// ------------------------------------------------------------ ida
export function serializarDiseno(e: EntradaDeDiseno): DisenoSerializado {
  const defaults = ParametrosPorDefecto();
  const p: Record<string, unknown> = {};
  for (const nombre of Object.keys(defaults) as NombreDeParametro[]) {
    const valor = e.parametros[nombre];
    if (!igualProfundo(valor, defaults[nombre])) p[nombre] = clonar(valor);
  }
  return {
    v: VERSION,
    p,
    ei: { pos: [...e.posicion] as Vec3, tan: [...e.tangente] as Vec3, arr: [...e.arriba] as Vec3, vel: e.velocidad },
    s: e.secuencia.map((inst) => ({ t: inst.tipo, a: clonar(inst.ajustes) as Record<string, unknown> })),
  };
}

// ------------------------------------------------------------ vuelta
interface Analizado {
  p: Partial<Parametros>;
  ei: DisenoSerializado['ei'];
  s: { tipo: NombreDeElemento; ajustes: Partial<Parametros> }[];
}

/** Valida campo por campo y devuelve copias ya tipadas; el mensaje de error dice que campo fallo y que se esperaba. */
function analizar(d: unknown): Analizado {
  if (!esObjetoPlano(d)) throw new Error(`El diseno serializado tiene que ser un objeto y es ${describir(d)}.`);
  if (d.v !== VERSION) {
    throw new Error(`El diseno serializado tiene v = ${describir(d.v)} y esta version del visualizador entiende v = ${VERSION}.`);
  }
  for (const campo of ['p', 'ei', 's'] as const) {
    if (!(campo in d)) throw new Error(`Al diseno serializado le falta el campo ${campo}.`);
  }
  const defaults = ParametrosPorDefecto();
  const p = validarBloque(d.p, 'p', defaults);

  const ei = d.ei;
  if (!esObjetoPlano(ei)) throw new Error(`ei tiene que ser un objeto {pos, tan, arr, vel} y es ${describir(ei)}.`);
  const vector = (campo: 'pos' | 'tan' | 'arr'): Vec3 => {
    const v = ei[campo];
    if (!esVector3(v)) throw new Error(`ei.${campo} vale ${describir(v)} y se esperaba un vector de 3 numeros finitos.`);
    return [...v] as Vec3;
  };
  const pos = vector('pos');
  const tan = vector('tan');
  const arr = vector('arr');
  const vel = ei.vel;
  if (typeof vel !== 'number' || !Number.isFinite(vel)) throw new Error(`ei.vel vale ${describir(vel)} y se esperaba un numero finito.`);

  if (!Array.isArray(d.s)) throw new Error(`s tiene que ser una lista de instancias {t, a} y es ${describir(d.s)}.`);
  const s = d.s.map((inst, i) => {
    if (!esObjetoPlano(inst)) throw new Error(`s[${i}] tiene que ser un objeto {t, a} y es ${describir(inst)}.`);
    if (typeof inst.t !== 'string' || !CATALOGO_DE_ELEMENTOS.includes(inst.t as NombreDeElemento)) {
      throw new Error(`s[${i}].t vale ${describir(inst.t)} y tiene que ser un tipo de CATALOGO_DE_ELEMENTOS: ${CATALOGO_DE_ELEMENTOS.join(', ')}.`);
    }
    return { tipo: inst.t as NombreDeElemento, ajustes: validarBloque(inst.a, `s[${i}].a`, defaults) };
  });
  return { p, ei: { pos, tan, arr, vel }, s };
}

/** Rechaza cualquier cosa que no sea un DisenoSerializado valido, con el campo y lo esperado en el mensaje. */
export function validarDisenoSerializado(d: unknown): DisenoSerializado {
  analizar(d);
  return d as DisenoSerializado;
}

/** Completa con ParametrosPorDefecto() lo que no viene; ids `e1..eN` en el orden de la secuencia. */
export function deserializarDiseno(d: unknown): EntradaDeDiseno {
  const { p, ei, s } = analizar(d);
  // Spread sobre los defaults: quedan todos los campos, en el orden de ParametrosPorDefecto().
  const parametros: Parametros = { ...ParametrosPorDefecto(), ...p };
  const secuencia: InstanciaDeElemento[] = s.map((inst, i) => ({ id: `e${i + 1}`, tipo: inst.tipo, ajustes: inst.ajustes }));
  return { parametros, posicion: ei.pos, tangente: ei.tan, arriba: ei.arr, velocidad: ei.vel, secuencia };
}

// ------------------------------------------------------------ texto compacto
function aBase64Url(bytes: Uint8Array): string {
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function desdeBase64Url(texto: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(texto)) throw new Error('El texto compacto tiene caracteres que no son base64url (A-Z, a-z, 0-9, -, _).');
  const base64 = texto.replace(/-/g, '+').replace(/_/g, '/');
  let binario: string;
  try {
    binario = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  } catch {
    throw new Error('El texto compacto no es base64url valido (largo incorrecto).');
  }
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/** JSON compacto → deflate crudo → base64url, para el hash de la URL. */
export function aTextoCompacto(d: DisenoSerializado): string {
  return aBase64Url(deflateSync(strToU8(JSON.stringify(d)), { level: 9 }));
}

/** Inversa de aTextoCompacto; valida el resultado como DisenoSerializado. */
export function desdeTextoCompacto(s: string): DisenoSerializado {
  const bytes = desdeBase64Url(s.trim());
  if (bytes.length === 0) throw new Error('El texto compacto esta vacio.');
  let json: string;
  try {
    json = strFromU8(inflateSync(bytes));
  } catch (error) {
    throw new Error(`El texto compacto no se pudo descomprimir (no es deflate crudo o esta truncado): ${(error as Error).message}`);
  }
  let objeto: unknown;
  try {
    objeto = JSON.parse(json);
  } catch (error) {
    throw new Error(`El texto compacto descomprime a algo que no es JSON: ${(error as Error).message}`);
  }
  return validarDisenoSerializado(objeto);
}
