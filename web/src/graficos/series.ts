// Que series lleva cada grafico, calculadas desde el layout: es el espejo
// de GraficarElemento.m (G con banda normativa, jerk con presupuesto de
// onset, cinematica, roll, curvatura). Sin DOM ni uPlot: se testea en Node.
//
// Convencion de ejes, una sola por figura y sin mezclar (igual que en
// MATLAB): contra arco o tiempo del modelo se dibuja el jerk DEL MODELO
// contra el presupuesto del modelo (sqrt(lambda) x norma); contra tiempo
// del prototipo se dibuja el jerk DEL PROTOTIPO contra el numero literal de
// la norma. Las bandas de G se evaluan siempre sobre la linea de tiempo
// continua del LAYOUT, en tiempo del prototipo (lineaNormativa): un evento que
// cruza un empalme es uno solo, igual que en la verificacion
// (VerificarLayoutNormativo.m). Con un elemento elegido se recorta ese calculo
// global: el elemento muestra el mismo limite que acompanado.

import { magnitudPorClave, type ClaveDeMagnitud } from '../contrato/magnitudes';
import type { Elemento, Layout } from '../contrato/tipos';
import {
  algunoEntre, G_MIN_EVALUABLE, limiteNormativo, limitePorPunto, limitesDelEvento, tablaNormativa, tramosContiguos, ventanasMasGzReducido, type CurvaNormativa,
} from '../nucleo/norma';
import type { BandaEntreSeries, DatosDeFigura, Franja, SerieDeFigura } from './figura';

export type EjeX = 'arco' | 'tiempo' | 'tiempoPrototipo';
export type Pestana = 'g' | 'jerk' | 'cinematica' | 'roll' | 'curvatura' | 'duracion';

export const ETIQUETA_DE_EJE: Record<EjeX, string> = {
  arco: 'Arco recorrido sobre el riel [m]',
  tiempo: 'Tiempo del modelo [s]',
  tiempoPrototipo: 'Tiempo del prototipo [s]',
};

/** Decimales del valor de x en la leyenda: los de arco y tiempo del contrato. */
export const DECIMALES_DE_EJE: Record<EjeX, number> = {
  arco: magnitudPorClave('arco').decimales,
  tiempo: magnitudPorClave('tiempo').decimales,
  tiempoPrototipo: magnitudPorClave('tiempo').decimales,
};

/** Decimales y notacion de la leyenda, tomados de la magnitud que grafica la figura. */
function formatoDe(clave: ClaveDeMagnitud): Pick<DatosDeFigura, 'decimales' | 'notacion'> {
  const m = magnitudPorClave(clave);
  return { decimales: m.decimales, notacion: m.notacion };
}

export const PESTANAS: { clave: Pestana; etiqueta: string }[] = [
  { clave: 'g', etiqueta: 'G' },
  { clave: 'jerk', etiqueta: 'Jerk' },
  { clave: 'cinematica', etiqueta: 'Cinemática' },
  { clave: 'roll', etiqueta: 'Roll' },
  { clave: 'curvatura', etiqueta: 'Curvatura' },
  { clave: 'duracion', etiqueta: 'G vs duración' },
];

/** Pestanas cuyo eje x es el recorrido (arco o tiempo); la de G contra duracion no lo es. */
export const esSobreElRecorrido = (pestana: Pestana): boolean => pestana !== 'duracion';

// Colores simbolicos (figura.ts los resuelve con el tema): series 1-3 y estados.
const SERIE = ['serie1', 'serie2', 'serie3'] as const;
const LIMITE = 'limite';
const ADMISIBLE_TRAZO = 'admisibleTrazo';
const ADMISIBLE_RELLENO = 'admisibleRelleno';
const COLOR_CERO = 'cero';
const NIVELES_PARA_GRAFICAR = 400;
const RAD_A_GRADOS = 180 / Math.PI;

/** Un tramo de nodos consecutivos de un elemento, con lo que hace falta para las referencias. */
interface Tramo {
  elemento: Elemento;
  indice: number;
  /** Primer nodo local incluido (1 si se descarta el nodo repetido del empalme). */
  desde: number;
  factorTiempo: number;
  curvaMasGz: CurvaNormativa;
  onsetModelo: [number, number, number];
  /** Tiempo acumulado del modelo y del prototipo al entrar al elemento. */
  desfaseTiempo: number;
  desfaseTiempoPrototipo: number;
  /**
   * Masa y gravedad con que se simulo el elemento: las de sus ajustes si la
   * instancia las pisa, si no las globales (la misma regla que el modo de
   * curvatura, CONTRATO seccion 6). Con ellas se separa la energia en
   * cinetica y potencial igual que SimularSobreTrack.m.
   */
  masa: number;
  gravedad: number;
}

export interface Columnas {
  tramos: Tramo[];
  cantidad: number;
  x: Record<EjeX, (number | null)[]>;
  franjas: Record<EjeX, Franja[]>;
  onsetNormativo: [number, number, number];
  radioMinimoFabricable: number | null;
  /**
   * Indice de nodo GLOBAL de cada columna: el mismo que usa la via 3D
   * (geometriaDeVia.aplanarNodos), o sea todo el layout sin los nodos
   * repetidos de los empalmes. Es el estado que comparten los graficos, el
   * 3D y el reproductor.
   */
  nodos: Int32Array;
  /** Linea de tiempo normativa de TODO el layout (indexada por nodo global). */
  linea: LineaNormativa;
  /** Elemento elegido, o null para todo el layout. */
  elemento: number | null;
  /**
   * E0: la energia mecanica con que arranca el LAYOUT (estadoInicial), en J.
   * Con un elemento elegido sigue siendo la del inicio del recorrido: la
   * perdida acumulada se cuenta desde ahi. null si el contrato no la trae.
   */
  energiaInicial: number | null;
}

/**
 * Las G de todo el layout sin repetir los nodos de los empalmes, indexadas
 * por nodo global, con el tiempo del prototipo acumulado y las ventanas de
 * 7.1.7.1. Es la misma serie que verifica SerieNormativaDelLayout.m (con los
 * valores del contrato, redondeados a 6 cifras).
 */
export interface LineaNormativa {
  tiempoPrototipo: Float64Array;
  gx: Float64Array;
  gy: Float64Array;
  gz: Float64Array;
  /** Nodos donde rige MasGzReducido (7.1.7.1). */
  reducida: boolean[];
  /** [primero, ultimo] nodo global de cada elemento, con el nodo del empalme de entrada. */
  rangos: Array<[number, number]>;
}

const LINEAS = new WeakMap<Layout, LineaNormativa>();

/** Linea normativa del layout; se calcula una vez por layout (los limites de las figuras la comparten). */
export function lineaNormativa(layout: Layout): LineaNormativa {
  const guardada = LINEAS.get(layout);
  if (guardada) return guardada;
  const tiempoPrototipo: number[] = [];
  const g: Record<'gx' | 'gy' | 'gz', number[]> = { gx: [], gy: [], gz: [] };
  const rangos: Array<[number, number]> = [];
  let desfase = 0;
  layout.elementos.forEach((elemento, i) => {
    const n = elemento.nodos;
    const factorTiempo = factorTiempoDe(elemento);
    const primero = i === 0 ? 0 : tiempoPrototipo.length - 1;
    for (let k = i === 0 ? 0 : 1; k < n.numeroDeNodos; k++) {
      const t = numero(n.tiempo[k]);
      tiempoPrototipo.push(t === null ? NaN : t * factorTiempo + desfase);
      for (const clave of ['gx', 'gy', 'gz'] as const) g[clave].push(numero(n[clave][k]) ?? NaN);
    }
    rangos.push([primero, tiempoPrototipo.length - 1]);
    desfase += (elemento.resumen.tiempoDeRecorrido ?? 0) * factorTiempo;
  });
  const linea: LineaNormativa = {
    tiempoPrototipo: Float64Array.from(tiempoPrototipo),
    gx: Float64Array.from(g.gx),
    gy: Float64Array.from(g.gy),
    gz: Float64Array.from(g.gz),
    reducida: ventanasMasGzReducido(g.gz, tiempoPrototipo).reducida,
    rangos,
  };
  LINEAS.set(layout, linea);
  return linea;
}

/** Un parametro numerico tal como lo uso el elemento: ajustes de la instancia ?? valor global. */
function parametroDelElemento(layout: Layout, elemento: Elemento, clave: string): number {
  const propio = (elemento.ajustes as Record<string, unknown> | undefined)?.[clave];
  const valor = typeof propio === 'number' ? propio : (layout.parametros.valores as Record<string, unknown>)[clave];
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : NaN;
}

function factorTiempoDe(elemento: Elemento): number {
  const normativo = (elemento.criterios.normativo ?? {}) as Record<string, unknown>;
  return typeof normativo.factorTiempo === 'number' ? normativo.factorTiempo : Math.sqrt(elemento.resumen.lambdaLoop ?? 1);
}

/** Primer nodo global de cada elemento; espejo de aplanarNodos (contrato, seccion 6). */
export function iniciosDeElemento(layout: Layout): number[] {
  const inicios: number[] = [];
  let acumulado = 0;
  layout.elementos.forEach((elemento, i) => {
    inicios.push(acumulado);
    acumulado += elemento.nodos.numeroDeNodos - (i > 0 ? 1 : 0);
  });
  return inicios;
}

/** Nodo global de un nodo local. El nodo 0 de un elemento es el ultimo del anterior. */
export function nodoGlobalDe(layout: Layout, elemento: number, nodoLocal: number): number {
  return iniciosDeElemento(layout)[elemento]! + nodoLocal - (elemento > 0 ? 1 : 0);
}

/** A que elemento, nodo local y subtramo corresponde un nodo global. */
export function ubicacionDeNodo(layout: Layout, nodoGlobal: number): { elemento: number; nodoLocal: number; subtramo: string | null } | null {
  const inicios = iniciosDeElemento(layout);
  for (let i = layout.elementos.length - 1; i >= 0; i--) {
    if (nodoGlobal < inicios[i]!) continue;
    const nodoLocal = nodoGlobal - inicios[i]! + (i > 0 ? 1 : 0);
    const elemento = layout.elementos[i]!;
    if (nodoLocal >= elemento.nodos.numeroDeNodos) return null;
    const sub = elemento.subtramos.find((t) => nodoLocal >= t.indiceInicio && nodoLocal <= t.indiceFin);
    return { elemento: i, nodoLocal, subtramo: sub?.nombre ?? null };
  }
  return null;
}

/**
 * Indice dentro de una lista CRECIENTE de nodos globales (columnas.nodos, o
 * el `nodos` ya filtrado de una figura), o null si ese nodo no esta. Binaria
 * porque se llama en cada movimiento del cursor y por figura.
 */
export function indiceDeNodo(nodos: ArrayLike<number>, nodoGlobal: number): number | null {
  let bajo = 0;
  let alto = nodos.length - 1;
  while (bajo <= alto) {
    const medio = (bajo + alto) >> 1;
    if (nodos[medio]! === nodoGlobal) return medio;
    if (nodos[medio]! < nodoGlobal) bajo = medio + 1;
    else alto = medio - 1;
  }
  return null;
}

function numero(v: number | null | undefined): number | null {
  return v === null || v === undefined || !Number.isFinite(v) ? null : v;
}

function tripleta(v: unknown, respaldo: [number, number, number]): [number, number, number] {
  return Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number') ? (v as [number, number, number]) : respaldo;
}

/** Prepara los nodos del elemento elegido, o de todo el layout sin los nodos repetidos de los empalmes. */
export function extraerColumnas(layout: Layout, elementoElegido: number | null): Columnas {
  const tramos: Tramo[] = [];
  let desfaseTiempo = 0;
  let desfaseTiempoPrototipo = 0;
  layout.elementos.forEach((elemento, indice) => {
    const normativo = (elemento.criterios.normativo ?? {}) as Record<string, unknown>;
    const factorTiempo = factorTiempoDe(elemento);
    const incluido = elementoElegido === null || elementoElegido === indice;
    if (incluido) {
      tramos.push({
        elemento,
        indice,
        desde: elementoElegido === null && indice > 0 ? 1 : 0,
        factorTiempo,
        curvaMasGz: (normativo.curvaMasGzAplicada as CurvaNormativa | undefined) ?? 'MasGzTodas',
        onsetModelo: tripleta(normativo.onsetPresupuestoModelo, tripleta(elemento.resumen.onsetMaximoModelo, [NaN, NaN, NaN])),
        desfaseTiempo: elementoElegido === null ? desfaseTiempo : 0,
        desfaseTiempoPrototipo: elementoElegido === null ? desfaseTiempoPrototipo : 0,
        masa: parametroDelElemento(layout, elemento, 'masa'),
        gravedad: parametroDelElemento(layout, elemento, 'gravedad'),
      });
    }
    const duracion = elemento.resumen.tiempoDeRecorrido ?? 0;
    desfaseTiempo += duracion;
    desfaseTiempoPrototipo += duracion * factorTiempo;
  });

  const arco: (number | null)[] = [];
  const tiempo: (number | null)[] = [];
  const tiempoPrototipo: (number | null)[] = [];
  const nodos: number[] = [];
  const inicios = iniciosDeElemento(layout);
  const franjas: Record<EjeX, Franja[]> = { arco: [], tiempo: [], tiempoPrototipo: [] };

  for (const tramo of tramos) {
    const n = tramo.elemento.nodos;
    const inicioGlobal = arco.length;
    const desplazamiento = inicios[tramo.indice]! - (tramo.indice > 0 ? 1 : 0);
    for (let i = tramo.desde; i < n.numeroDeNodos; i++) {
      const t = numero(n.tiempo[i]);
      arco.push(numero(n.arco[i]));
      tiempo.push(t === null ? null : t + tramo.desfaseTiempo);
      tiempoPrototipo.push(t === null ? null : t * tramo.factorTiempo + tramo.desfaseTiempoPrototipo);
      nodos.push(desplazamiento + i);
    }
    const finGlobal = arco.length - 1;
    const enX = (eje: EjeX, local: number): number | null => {
      const global = inicioGlobal + Math.max(local, tramo.desde) - tramo.desde;
      return { arco, tiempo, tiempoPrototipo }[eje][Math.min(global, finGlobal)] ?? null;
    };
    const agregarFranja = (etiqueta: string, desdeLocal: number, hastaLocal: number) => {
      for (const eje of ['arco', 'tiempo', 'tiempoPrototipo'] as EjeX[]) {
        const a = enX(eje, desdeLocal);
        const b = enX(eje, hastaLocal);
        if (a !== null && b !== null && b > a) franjas[eje].push({ desde: a, hasta: b, etiqueta });
      }
    };
    if (elementoElegido === null) {
      agregarFranja(`${tramo.indice + 1}. ${tramo.elemento.tipo}`, tramo.desde, n.numeroDeNodos - 1);
    } else {
      for (const sub of tramo.elemento.subtramos) {
        if (sub.indiceFin >= sub.indiceInicio) agregarFranja(sub.nombre, sub.indiceInicio, sub.indiceFin);
      }
    }
  }

  return {
    tramos,
    cantidad: arco.length,
    x: { arco, tiempo, tiempoPrototipo },
    franjas,
    onsetNormativo: tripleta(layout.parametros.valores.onsetNormativoPorEje, [NaN, NaN, NaN]),
    radioMinimoFabricable: numero(layout.parametros.valores.radioMinimoFabricable as number | undefined),
    nodos: Int32Array.from(nodos),
    linea: lineaNormativa(layout),
    elemento: elementoElegido,
    energiaInicial: numero(layout.estadoInicial.energiaTotal) ?? numero(layout.elementos[0]?.nodos.energiaTotal?.[0]),
  };
}

/** Columna de nodos concatenada, con null donde el JSON trae null. */
export function columna(columnas: Columnas, clave: ClaveDeMagnitud | 'z' | 'zRiel', escala = 1): (number | null)[] {
  const valores: (number | null)[] = [];
  for (const tramo of columnas.tramos) {
    const datos = tramo.elemento.nodos[clave];
    for (let i = tramo.desde; i < tramo.elemento.nodos.numeroDeNodos; i++) {
      const v = numero(datos?.[i]);
      valores.push(v === null ? null : v * escala);
    }
  }
  return valores;
}

/** Aplica f a cada tramo y concatena: para referencias que dependen del elemento. */
function porTramo(columnas: Columnas, f: (tramo: Tramo, cantidad: number) => (number | null)[]): (number | null)[] {
  const valores: (number | null)[] = [];
  for (const tramo of columnas.tramos) {
    for (const v of f(tramo, tramo.elemento.nodos.numeroDeNodos - tramo.desde)) valores.push(v);
  }
  return valores;
}

function constante(valor: number, cantidad: number): (number | null)[] {
  return new Array<number | null>(cantidad).fill(Number.isFinite(valor) ? valor : null);
}

const APLICABLES = new WeakMap<LineaNormativa, Map<string, Float64Array>>();

/**
 * Limite aplicable nodo a nodo (limitePorPunto) sobre la linea de tiempo del
 * LAYOUT, en tiempo del prototipo: se calcula una sola vez por layout y lado,
 * y cada figura toma los nodos que muestra. Asi un elemento solo muestra el
 * mismo limite que acompanado, y un evento que cruza un empalme es uno solo.
 */
function limiteAplicableGlobal(linea: LineaNormativa, eje: 'gx' | 'gy' | 'gz', curva: CurvaNormativa, signo: 1 | -1): Float64Array {
  let porLado = APLICABLES.get(linea);
  if (!porLado) APLICABLES.set(linea, (porLado = new Map()));
  const clave = `${eje}/${curva}/${signo}`;
  let limite = porLado.get(clave);
  if (!limite) {
    limite = limitePorPunto(linea[eje], linea.tiempoPrototipo, curva, 1, signo, NIVELES_PARA_GRAFICAR, eje === 'gz' && signo > 0 ? linea.reducida : undefined);
    porLado.set(clave, limite);
  }
  return limite;
}

/** Los valores de un arreglo global en los nodos que muestran las columnas. */
function enLasColumnas(columnas: Columnas, global: ArrayLike<number>): (number | null)[] {
  return Array.from(columnas.nodos, (nodo) => {
    const v = global[nodo];
    return v === undefined || Number.isNaN(v) ? null : v;
  });
}

/** Aclaracion de la leyenda del limite aplicable (se ve al pasar el puntero). */
export const AYUDA_DEL_LIMITE_APLICABLE =
  'Límite del evento sostenido que contiene a este punto, evaluado a su propio nivel de G. No es un margen: si la G sube, el evento cambia de duración y el límite también.';

function figuraDeG(
  columnas: Columnas,
  ejeX: EjeX,
  nombre: string,
  titulo: string,
  clave: 'gx' | 'gy' | 'gz',
  claveCabeza: ClaveDeMagnitud | null,
  curvaPositiva: CurvaNormativa,
  curvaNegativa: CurvaNormativa,
): DatosDeFigura {
  const series: SerieDeFigura[] = [
    { etiqueta: `${nombre} en el punto de verificación`, valores: columna(columnas, clave), color: SERIE[0], ancho: 1.8 },
  ];
  if (claveCabeza) {
    series.push({ etiqueta: `${nombre} en la cabeza`, valores: columna(columnas, claveCabeza), color: SERIE[1], ancho: 1, trazos: [3, 3] });
  }
  // +Gz: la curva reducida de 7.1.7.1 rige nodo a nodo, en las ventanas de la linea del layout.
  const linea = columnas.linea;
  const curvaSupEn = (nodo: number): CurvaNormativa => (clave === 'gz' && linea.reducida[nodo] ? 'MasGzReducido' : curvaPositiva);
  const largoSup = Array.from(columnas.nodos, (nodo) => Math.abs(limiteNormativo(curvaSupEn(nodo), 40)));
  const largoInf = constante(-Math.abs(limiteNormativo(curvaNegativa, 40)), columnas.cantidad);
  const cortoSup = Array.from(columnas.nodos, (nodo) => Math.abs(limiteNormativo(curvaSupEn(nodo), 0.2)));
  const cortoInf = constante(-Math.abs(limiteNormativo(curvaNegativa, 0.2)), columnas.cantidad);
  const aplicableSup = enLasColumnas(columnas, limiteAplicableGlobal(linea, clave, curvaPositiva, 1));
  const aplicableInf = enLasColumnas(columnas, limiteAplicableGlobal(linea, clave, curvaNegativa, -1));

  // Cada referencia es simetrica: la mitad inferior no va en la leyenda y
  // acompana a la superior (acompanaA), asi el toggle de la leyenda apaga
  // las dos y ninguna otra. Antes la inferior quedaba dibujada y se confundia
  // el limite de 200 ms con el aplicable.
  const inicio = series.length;
  series.push(
    { etiqueta: 'Admisible dure lo que dure (evento largo)', valores: largoSup, color: ADMISIBLE_TRAZO, ancho: 1 },
    { etiqueta: 'evento largo, inferior', valores: largoInf, color: ADMISIBLE_TRAZO, ancho: 1, ocultarEnLeyenda: true, acompanaA: inicio },
    { etiqueta: 'Límite a 200 ms', valores: cortoSup, color: LIMITE, ancho: 1.2, trazos: [6, 4] },
    { etiqueta: '200 ms, inferior', valores: cortoInf, color: LIMITE, ancho: 1.2, trazos: [6, 4], ocultarEnLeyenda: true, acompanaA: inicio + 2 },
    { etiqueta: 'Límite aplicable (duración del evento sostenido)', valores: aplicableSup, color: LIMITE, ancho: 1.6, ayuda: AYUDA_DEL_LIMITE_APLICABLE },
    { etiqueta: 'aplicable, inferior', valores: aplicableInf, color: LIMITE, ancho: 1.6, ocultarEnLeyenda: true, acompanaA: inicio + 4 },
  );
  const bandas: BandaEntreSeries[] = [{ superior: inicio, inferior: inicio + 1, color: ADMISIBLE_RELLENO }];
  return {
    clave,
    titulo,
    etiquetaX: ETIQUETA_DE_EJE[ejeX],
    etiquetaY: `${nombre} [G]`,
    x: columnas.x[ejeX] as number[],
    decimalesX: DECIMALES_DE_EJE[ejeX],
    ...formatoDe(clave),
    series,
    franjas: columnas.franjas[ejeX],
    bandas,
  };
}

export function figurasDeG(columnas: Columnas, ejeX: EjeX): DatosDeFigura[] {
  return [
    figuraDeG(columnas, ejeX, 'Gx', 'Gx — límites Figs. 6 y 7', 'gx', null, 'MasGxBase', 'MenosGxBase'),
    figuraDeG(columnas, ejeX, 'Gy', 'Gy — límite Fig. 8', 'gy', 'gyCabeza', 'GyBase', 'GyBase'),
    figuraDeG(columnas, ejeX, 'Gz', 'Gz — límites Figs. 9 y 10', 'gz', 'gzCabeza', 'MasGzTodas', 'MenosGzBase'),
  ];
}

export function figurasDeJerk(columnas: Columnas, ejeX: EjeX): DatosDeFigura[] {
  const prototipo = ejeX === 'tiempoPrototipo';
  const ejes: { clave: ClaveDeMagnitud; nombre: string; i: 0 | 1 | 2 }[] = [
    { clave: 'jerkGx', nombre: 'Gx', i: 0 },
    { clave: 'jerkGy', nombre: 'Gy', i: 1 },
    { clave: 'jerkGz', nombre: 'Gz', i: 2 },
  ];
  return ejes.map(({ clave, nombre, i }) => {
    const valores = prototipo
      ? porTramo(columnas, (t) => columna({ ...columnas, tramos: [t] }, clave, 1 / t.factorTiempo))
      : columna(columnas, clave);
    const presupuesto = prototipo
      ? constante(columnas.onsetNormativo[i], columnas.cantidad)
      : porTramo(columnas, (t, c) => constante(t.onsetModelo[i], c));
    const titulo = prototipo
      ? `Jerk de ${nombre} del prototipo — límite de la norma`
      : `Jerk de ${nombre} del modelo — presupuesto √λ × norma`;
    return {
      clave,
      titulo,
      etiquetaX: ETIQUETA_DE_EJE[ejeX],
      etiquetaY: `d${nombre}/dt [G/s]`,
      x: columnas.x[ejeX] as number[],
      decimalesX: DECIMALES_DE_EJE[ejeX],
      ...formatoDe(clave),
      series: [
        { etiqueta: `Jerk de ${nombre}`, valores, color: SERIE[0], ancho: 1.6 },
        { etiqueta: 'Presupuesto de onset', valores: presupuesto, color: LIMITE, ancho: 1.2, trazos: [6, 4] },
        { etiqueta: 'presupuesto, inferior', valores: presupuesto.map((v) => (v === null ? null : -v)), color: LIMITE, ancho: 1.2, trazos: [6, 4], ocultarEnLeyenda: true, acompanaA: 1 },
      ],
      franjas: columnas.franjas[ejeX],
    };
  });
}

/**
 * Eje de las figuras "contra el tiempo" (arco y altura): el tiempo que este
 * elegido; con el eje en arco, el del modelo (arco contra arco no dice nada).
 */
export function ejeDeTiempo(ejeX: EjeX): Exclude<EjeX, 'arco'> {
  return ejeX === 'arco' ? 'tiempo' : ejeX;
}

/** Energia cinetica, potencial, mecanica y perdida acumulada del centro de masa, en J (con masa, como el contrato). */
export interface ColumnasDeEnergia {
  cinetica: (number | null)[];
  potencial: (number | null)[];
  mecanica: (number | null)[];
  perdida: (number | null)[];
}

/**
 * La particion de SimularSobreTrack.m: Ec = m v^2 / 2 con la velocidad del
 * centro de masa y Ep = m g z con la z de la heartline; la mecanica es la
 * energiaTotal del contrato (Ec + Ep del modelo). La perdida acumulada es
 * E0 - E: el contrato no exporta la energia disipada por nodo (el resumen
 * del MATLAB la tiene, Sim.EnergiaDisipadaRodadura/Arrastre, pero el
 * exportador no la emite), y E0 - E es esa energia, la que se llevaron la
 * rodadura y el arrastre desde el inicio (salvo el error de integracion y
 * el redondeo a 6 cifras del contrato).
 */
export function columnasDeEnergia(columnas: Columnas): ColumnasDeEnergia {
  const cinetica: (number | null)[] = [];
  const potencial: (number | null)[] = [];
  for (const tramo of columnas.tramos) {
    const n = tramo.elemento.nodos;
    for (let i = tramo.desde; i < n.numeroDeNodos; i++) {
      const v = numero(n.velocidad[i]);
      const z = numero(n.z[i]);
      const ec = v === null ? null : 0.5 * tramo.masa * v * v;
      const ep = z === null ? null : tramo.masa * tramo.gravedad * z;
      cinetica.push(ec !== null && Number.isFinite(ec) ? ec : null);
      potencial.push(ep !== null && Number.isFinite(ep) ? ep : null);
    }
  }
  const mecanica = columna(columnas, 'energiaTotal');
  const e0 = columnas.energiaInicial;
  const perdida = mecanica.map((e) => (e === null || e0 === null ? null : e0 - e));
  return { cinetica, potencial, mecanica, perdida };
}

function figuraDeEnergia(columnas: Columnas, ejeX: EjeX): DatosDeFigura {
  const { cinetica, potencial, mecanica, perdida } = columnasDeEnergia(columnas);
  const e0 = columnas.energiaInicial;
  const series: SerieDeFigura[] = [
    { etiqueta: 'Mecánica (cinética + potencial)', valores: mecanica, color: SERIE[0], ancho: 2 },
    { etiqueta: 'Cinética (½·m·v²)', valores: cinetica, color: SERIE[1], ancho: 1.4 },
    { etiqueta: 'Potencial (m·g·z de la heartline)', valores: potencial, color: SERIE[2], ancho: 1.4 },
    {
      etiqueta: 'Pérdida acumulada (E₀ − mecánica)',
      valores: perdida,
      color: SERIE[0],
      ancho: 1.4,
      trazos: [6, 3],
      ayuda: 'Lo que la rodadura y el arrastre se llevaron desde el inicio del recorrido: E₀ menos la energía mecánica en ese punto.',
    },
  ];
  if (e0 !== null) {
    series.push({
      etiqueta: 'E₀ (energía inicial)',
      valores: constante(e0, columnas.cantidad),
      color: COLOR_CERO,
      ancho: 1.2,
      trazos: [8, 4],
      fija: true,
      ayuda: 'Energía mecánica con que arranca el recorrido. Siempre visible: es la referencia de las otras curvas.',
    });
  }
  return {
    clave: 'energia',
    titulo: 'Energía del centro de masa — cinética, potencial, mecánica y pérdida',
    etiquetaX: ETIQUETA_DE_EJE[ejeX],
    etiquetaY: 'E [J]',
    x: columnas.x[ejeX] as number[],
    decimalesX: DECIMALES_DE_EJE[ejeX],
    ...formatoDe('energiaTotal'),
    series,
    franjas: columnas.franjas[ejeX],
    // El eje y siempre muestra el 0 y E0: la escala no depende del minimo que alcance la mecanica.
    incluirEnY: e0 === null ? [0] : [0, e0],
  };
}

/** a_n = v^2 * kappa de la heartline, nodo a nodo: v del centro de masa y curvatura de la heartline, las dos del contrato. */
export function aceleracionNormal(columnas: Columnas): (number | null)[] {
  const curvatura = columna(columnas, 'curvatura');
  return columna(columnas, 'velocidad').map((v, i) => {
    const k = curvatura[i];
    return v === null || k === null || k === undefined ? null : v * v * k;
  });
}

export function figurasDeCinematica(columnas: Columnas, ejeX: EjeX): DatosDeFigura[] {
  const x = columnas.x[ejeX] as number[];
  const enTiempo = ejeDeTiempo(ejeX);
  return [
    {
      clave: 'velocidad',
      titulo: 'Velocidad',
      etiquetaX: ETIQUETA_DE_EJE[ejeX],
      etiquetaY: 'v [m/s]',
      x,
      decimalesX: DECIMALES_DE_EJE[ejeX],
      ...formatoDe('velocidad'),
      series: [
        { etiqueta: 'Centro de masa (heartline)', valores: columna(columnas, 'velocidad'), color: SERIE[0], ancho: 1.8 },
        { etiqueta: 'Punto del riel', valores: columna(columnas, 'velocidadRiel'), color: SERIE[1], ancho: 1, trazos: [4, 3] },
      ],
      franjas: columnas.franjas[ejeX],
    },
    {
      clave: 'aceleracion',
      titulo: 'Aceleración tangencial del centro de masa',
      etiquetaX: ETIQUETA_DE_EJE[ejeX],
      etiquetaY: 'a_t [m/s²]',
      x,
      decimalesX: DECIMALES_DE_EJE[ejeX],
      ...formatoDe('aceleracionTangencial'),
      series: [
        { etiqueta: 'Aceleración tangencial', valores: columna(columnas, 'aceleracionTangencial'), color: SERIE[0], ancho: 1.6 },
        { etiqueta: 'cero', valores: constante(0, columnas.cantidad), color: COLOR_CERO, ancho: 1, trazos: [2, 4], ocultarEnLeyenda: true },
      ],
      franjas: columnas.franjas[ejeX],
    },
    {
      clave: 'aceleracionNormal',
      titulo: 'Aceleración normal de la heartline — a_n = v²·κ',
      etiquetaX: ETIQUETA_DE_EJE[ejeX],
      etiquetaY: 'a_n [m/s²]',
      x,
      decimalesX: DECIMALES_DE_EJE[ejeX],
      ...formatoDe('aceleracionTangencial'),
      series: [
        {
          etiqueta: 'Aceleración normal (v² · κ de la heartline)',
          valores: aceleracionNormal(columnas),
          color: SERIE[0],
          ancho: 1.6,
          ayuda: 'Velocidad del centro de masa al cuadrado por la curvatura de la heartline, nodo a nodo. Es la aceleración centrípeta de la trayectoria del pasajero, sin la gravedad.',
        },
      ],
      franjas: columnas.franjas[ejeX],
    },
    figuraDeEnergia(columnas, ejeX),
    {
      clave: 'arcoContraTiempo',
      titulo: 'Arco recorrido contra el tiempo',
      grupoDeCursor: enTiempo === ejeX ? undefined : enTiempo,
      etiquetaX: ETIQUETA_DE_EJE[enTiempo],
      etiquetaY: 's [m]',
      x: columnas.x[enTiempo] as number[],
      decimalesX: DECIMALES_DE_EJE[enTiempo],
      ...formatoDe('arco'),
      series: [{ etiqueta: 'Arco recorrido sobre el riel', valores: columnas.x.arco, color: SERIE[0], ancho: 1.8 }],
      franjas: columnas.franjas[enTiempo],
    },
    {
      clave: 'alturaContraTiempo',
      titulo: 'Altura contra el tiempo',
      grupoDeCursor: enTiempo === ejeX ? undefined : enTiempo,
      etiquetaX: ETIQUETA_DE_EJE[enTiempo],
      etiquetaY: 'z [m]',
      x: columnas.x[enTiempo] as number[],
      decimalesX: DECIMALES_DE_EJE[enTiempo],
      ...formatoDe('arco'),
      series: [
        { etiqueta: 'Centro de masa (heartline)', valores: columna(columnas, 'z'), color: SERIE[0], ancho: 1.8 },
        { etiqueta: 'Riel', valores: columna(columnas, 'zRiel'), color: SERIE[1], ancho: 1, trazos: [4, 3] },
      ],
      franjas: columnas.franjas[enTiempo],
    },
  ];
}


export function figurasDeRoll(columnas: Columnas, ejeX: EjeX): DatosDeFigura[] {
  return [
    {
      clave: 'roll',
      titulo: 'Roll contra el marco de transporte y |peralte| contra la vertical',
      etiquetaX: ETIQUETA_DE_EJE[ejeX],
      etiquetaY: 'ángulo [°]',
      x: columnas.x[ejeX] as number[],
      decimalesX: DECIMALES_DE_EJE[ejeX],
      ...formatoDe('anguloRoll'),
      series: [
        { etiqueta: 'φ: roll contra el marco de transporte', valores: columna(columnas, 'anguloRoll', RAD_A_GRADOS), color: SERIE[0], ancho: 1.8 },
        {
          etiqueta: '|peralte| contra la vertical',
          valores: columna(columnas, 'anguloPeralte', RAD_A_GRADOS).map((v) => (v === null ? null : Math.abs(v))),
          color: SERIE[1],
          ancho: 1.8,
        },
      ],
      franjas: columnas.franjas[ejeX],
    },
  ];
}

export function figurasDeCurvatura(columnas: Columnas, ejeX: EjeX): DatosDeFigura[] {
  const limite = columnas.radioMinimoFabricable && columnas.radioMinimoFabricable > 0 ? 1 / columnas.radioMinimoFabricable : NaN;
  return [
    {
      clave: 'curvatura',
      titulo: 'Curvatura del riel y de la heartline — el riel es el que limita la impresora',
      etiquetaX: ETIQUETA_DE_EJE[ejeX],
      etiquetaY: 'κ [1/m]',
      x: columnas.x[ejeX] as number[],
      decimalesX: DECIMALES_DE_EJE[ejeX],
      ...formatoDe('curvaturaRiel'),
      series: [
        { etiqueta: 'Riel (curvatura impuesta)', valores: columna(columnas, 'curvaturaRiel'), color: SERIE[0], ancho: 1.8 },
        { etiqueta: 'Heartline (derivada)', valores: columna(columnas, 'curvatura'), color: SERIE[1], ancho: 1.4 },
        { etiqueta: '1 / radio mínimo fabricable', valores: constante(limite, columnas.cantidad), color: LIMITE, ancho: 1.2, trazos: [6, 4] },
      ],
      franjas: columnas.franjas[ejeX],
    },
  ];
}

// ------------------------------------------------------------ G contra duracion (Figs. 6-10)
// El mismo plano de las Figs. 6-10 de la norma: nivel de G contra duracion
// del evento sostenido, en tiempo del prototipo. Sobre la curva de la norma se
// dibuja la del recorrido: para cada nivel, la duracion del evento continuo
// MAS LARGO con G >= nivel en todo el layout (o, con un elemento elegido,
// entre los eventos que tocan sus nodos, igual que la verificacion). Donde la
// curva del recorrido pasa por encima de la de la norma, el diseno no cumple.

/** Un punto de la curva del recorrido: a este nivel, el evento continuo mas largo. */
export interface PuntoDelRecorrido {
  nivel: number;
  /** Duracion de prototipo llevada a 0.2 s si es menor (criterio conservador). */
  duracion: number;
  duracionReal: number;
}

/** El punto de menor margen contra la curva, con el mismo criterio que la verificacion. */
export interface PuntoCritico {
  nivel: number;
  duracion: number;
  limite: number;
  margen: number;
  curva: CurvaNormativa;
}

/**
 * Curva del recorrido para un lado, con h = signo * G ya armado. Para cada
 * nivel (grilla de `niveles` desde max(G_MIN_EVALUABLE, maximo/niveles)), la
 * duracion del evento mas largo entre los que tocan `rango`, y el punto
 * critico sobre TODOS esos eventos. `reducida` (solo +Gz): ventanas de
 * 7.1.7.1, con la curva reducida adentro y la normal despues (limitesDelEvento). Puro.
 */
export function curvaDelRecorrido(
  h: ArrayLike<number>,
  tiempo: ArrayLike<number>,
  rango: [number, number],
  curva: CurvaNormativa,
  reducida: ArrayLike<boolean> | null,
  niveles = NIVELES_PARA_GRAFICAR,
): { puntos: PuntoDelRecorrido[]; critico: PuntoCritico | null } {
  let maximo = -Infinity;
  for (let i = rango[0]; i <= rango[1]; i++) if (Number.isFinite(h[i]!) && h[i]! > maximo) maximo = h[i]!;
  const puntos: PuntoDelRecorrido[] = [];
  let critico: PuntoCritico | null = null;
  if (!(maximo >= G_MIN_EVALUABLE)) return { puntos, critico };

  const primero = Math.max(G_MIN_EVALUABLE, maximo / niveles);
  const mascara = new Array<boolean>(h.length);
  for (let j = 0; j < niveles; j++) {
    const nivel = niveles === 1 ? maximo : primero + ((maximo - primero) * j) / (niveles - 1);
    for (let i = 0; i < h.length; i++) mascara[i] = h[i]! >= nivel;
    let masLarga = -Infinity;
    for (const [inicio, fin] of tramosContiguos(mascara)) {
      if (fin < rango[0] || inicio > rango[1]) continue;
      const real = tiempo[fin]! - tiempo[inicio]!;
      if (real > masLarga) masLarga = real;
      for (const t of limitesDelEvento(tiempo, inicio, fin, curva, reducida)) {
        if (!critico || t.limite - nivel < critico.margen) critico = { nivel, duracion: t.duracion, limite: t.limite, margen: t.limite - nivel, curva: t.curva };
      }
    }
    if (masLarga >= 0) puntos.push({ nivel, duracion: Math.max(masLarga, 0.2), duracionReal: masLarga });
  }
  return { puntos, critico };
}

interface LadoDeDuracion {
  clave: string;
  nombre: string;
  eje: 'gx' | 'gy' | 'gz';
  signo: 1 | -1;
  /** Gy se verifica sobre |Gy| (una sola curva para los dos lados). */
  absoluto?: boolean;
  curva: CurvaNormativa;
  figura: string;
}

const LADOS_DE_DURACION: LadoDeDuracion[] = [
  { clave: 'duracion-masgz', nombre: '+Gz', eje: 'gz', signo: 1, curva: 'MasGzTodas', figura: 'Fig. 10' },
  { clave: 'duracion-menosgz', nombre: '−Gz', eje: 'gz', signo: -1, curva: 'MenosGzBase', figura: 'Fig. 9' },
  { clave: 'duracion-gy', nombre: '±Gy', eje: 'gy', signo: 1, absoluto: true, curva: 'GyBase', figura: 'Fig. 8' },
  { clave: 'duracion-masgx', nombre: '+Gx', eje: 'gx', signo: 1, curva: 'MasGxBase', figura: 'Fig. 6' },
  { clave: 'duracion-menosgx', nombre: '−Gx', eje: 'gx', signo: -1, curva: 'MenosGxBase', figura: 'Fig. 7' },
];

/** Duracion minima del eje x: incluye el ultimo quiebre de las tablas (11.8-12 s). */
const DURACION_MINIMA_DEL_EJE = 12;

const conDosDecimales = (v: number) => (Math.abs(v) < 0.005 ? 0 : v).toFixed(2);

export function figurasDeDuracion(columnas: Columnas): DatosDeFigura[] {
  const linea = columnas.linea;
  const rango: [number, number] = columnas.elemento === null ? [0, linea.tiempoPrototipo.length - 1] : linea.rangos[columnas.elemento]!;
  return LADOS_DE_DURACION.map((lado) => {
    const h = Array.from(linea[lado.eje], (g) => (lado.absoluto ? Math.abs(g) : lado.signo * g));
    const reducida = lado.eje === 'gz' && lado.signo > 0 ? linea.reducida : null;
    const { puntos, critico } = curvaDelRecorrido(h, linea.tiempoPrototipo, rango, lado.curva, reducida);
    const hayReducida = reducida !== null && algunoEntre(reducida, rango[0], rango[1]);
    const signoY = lado.absoluto ? 1 : lado.signo;

    const duracionMaxima = puntos.reduce((m, p) => Math.max(m, p.duracion), 0);
    const hasta = Math.min(40, Math.max(DURACION_MINIMA_DEL_EJE, 1.1 * duracionMaxima));
    const curvaDeLaNorma = (curva: CurvaNormativa): Array<[number, number]> => {
      const filas = tablaNormativa(curva).filter(([d]) => d <= hasta).map(([d, l]): [number, number] => [d, Math.abs(l)]);
      if (filas[filas.length - 1]![0] < hasta) filas.push([hasta, Math.abs(limiteNormativo(curva, hasta))]);
      return filas;
    };

    // Cada punto es de una sola serie; el eje x es la union ordenada (uPlot une los huecos).
    const entradas: Array<{ x: number; serie: number; y: number; orden: number }> = [];
    const series: SerieDeFigura[] = [];
    const agregarSerie = (serie: SerieDeFigura, puntosDeLaSerie: Array<[number, number]>) => {
      const indice = series.length;
      series.push(serie);
      for (const [x, magnitud] of puntosDeLaSerie) entradas.push({ x, serie: indice, y: signoY * magnitud, orden: -magnitud });
    };
    agregarSerie({ etiqueta: `Curva de la norma (${lado.figura}, ${lado.curva})`, valores: [], color: LIMITE, ancho: 1.6 }, curvaDeLaNorma(lado.curva));
    if (hayReducida) {
      agregarSerie({ etiqueta: 'Curva reducida de 7.1.7.1 (MasGzReducido)', valores: [], color: LIMITE, ancho: 1.2, trazos: [6, 4] }, curvaDeLaNorma('MasGzReducido'));
    }
    agregarSerie(
      {
        etiqueta: puntos.length > 0 ? 'Recorrido: evento continuo más largo a cada nivel' : 'Recorrido: sin G evaluable de este signo',
        valores: [],
        color: SERIE[0],
        ancho: 1.8,
        ayuda: 'Para cada nivel de G, la duración (prototipo) del evento continuo más largo con G al menos igual a ese nivel. Los eventos de menos de 0,2 s se dibujan en 0,2 s.',
      },
      puntos.map((p) => [p.duracion, p.nivel]),
    );
    if (critico) {
      const nivel = signoY * critico.nivel;
      const limite = signoY * critico.limite;
      agregarSerie(
        {
          etiqueta: `Punto crítico: ${conDosDecimales(nivel)} G a ${conDosDecimales(critico.duracion)} s, límite ${conDosDecimales(limite)} G, margen ${conDosDecimales(critico.margen)} G`,
          valores: [],
          color: SERIE[1],
          ancho: 1,
          puntos: true,
        },
        [[critico.duracion, critico.nivel]],
      );
    }

    entradas.sort((a, b) => a.x - b.x || a.serie - b.serie || a.orden - b.orden);
    const x = entradas.map((e) => e.x);
    for (const [k, serie] of series.entries()) serie.valores = entradas.map((e) => (e.serie === k ? e.y : null));

    return {
      clave: lado.clave,
      titulo: `${lado.nombre} — nivel contra duración del evento sostenido (${lado.figura})`,
      etiquetaX: 'Duración del evento sostenido, tiempo del prototipo [s]',
      etiquetaY: `${lado.nombre} [G]`,
      x,
      decimalesX: 2,
      ...formatoDe(lado.eje),
      series,
      franjas: [],
      unirHuecos: true,
    };
  });
}

/**
 * uPlot exige un eje x numerico y creciente. Despues de un punto de parada
 * el tiempo es null: esos nodos se sacan de todas las series de la figura.
 */
export function sinHuecosEnX(figura: DatosDeFigura): DatosDeFigura {
  const conservar: number[] = [];
  figura.x.forEach((v, i) => {
    if (v !== null && v !== undefined && Number.isFinite(v)) conservar.push(i);
  });
  if (conservar.length === figura.x.length) return figura;
  return {
    ...figura,
    x: conservar.map((i) => figura.x[i]!),
    nodos: figura.nodos ? conservar.map((i) => figura.nodos![i]!) : undefined,
    series: figura.series.map((s) => ({ ...s, valores: conservar.map((i) => s.valores[i] ?? null) })),
  };
}

export function figurasDePestana(pestana: Pestana, columnas: Columnas, ejeX: EjeX): DatosDeFigura[] {
  const figuras = (() => {
    switch (pestana) {
      case 'g':
        return figurasDeG(columnas, ejeX);
      case 'jerk':
        return figurasDeJerk(columnas, ejeX);
      case 'cinematica':
        return figurasDeCinematica(columnas, ejeX);
      case 'roll':
        return figurasDeRoll(columnas, ejeX);
      case 'curvatura':
        return figurasDeCurvatura(columnas, ejeX);
      case 'duracion':
        return figurasDeDuracion(columnas);
    }
  })();
  // G contra duracion no tiene un punto por nodo: no se liga al cursor del 3D.
  if (!esSobreElRecorrido(pestana)) return figuras;
  // El indice de nodo global viaja con cada figura: es lo que hace que el
  // cursor del grafico, el marcador del 3D y el reproductor hablen de lo mismo.
  const nodos = Array.from(columnas.nodos);
  return figuras.map((figura) => sinHuecosEnX({ ...figura, nodos }));
}

/**
 * Rango del eje y que cubre los datos y los valores obligatorios, con un
 * margen del 5 % arriba y abajo (abajo no si el extremo es un valor
 * obligatorio que acota los datos: el 0 queda pegado al eje). Puro.
 */
export function rangoConValores(minimo: number | null, maximo: number | null, obligatorios: readonly number[]): [number, number] {
  const valores = [...obligatorios, ...[minimo, maximo].filter((v): v is number => v !== null && Number.isFinite(v))];
  let bajo = Math.min(...valores);
  let alto = Math.max(...valores);
  if (!Number.isFinite(bajo) || !Number.isFinite(alto)) return [0, 1];
  const margen = (alto - bajo || Math.abs(alto) || 1) * 0.05;
  const datosPorDebajo = minimo !== null && Number.isFinite(minimo) && minimo < Math.min(...obligatorios);
  if (datosPorDebajo || obligatorios.length === 0) bajo -= margen;
  alto += margen;
  return [bajo, alto];
}

/** Series que acompanan a la de indice `lider` (base 0 en `series`): se prenden y apagan con ella. */
export function acompanantesDe(series: readonly SerieDeFigura[], lider: number): number[] {
  const indices: number[] = [];
  series.forEach((s, j) => {
    if (s.acompanaA === lider && j !== lider) indices.push(j);
  });
  return indices;
}

/**
 * Valor de una serie en el punto `indice` del cursor, para el tooltip y la
 * leyenda. Con la comparacion A/B el eje x es la union de los dos y cada
 * serie tiene null en los puntos del otro diseno: sin esto, el cursor
 * mostraba A o B segun a cual perteneciera el punto, nunca los dos. Si la
 * figura une huecos (unirHuecos), el valor que falta se interpola
 * linealmente en x entre los puntos vecinos de la MISMA serie, que es lo que
 * la linea dibujada muestra en esa abscisa. Fuera del rango de la serie
 * (antes de su primer punto o despues del ultimo) no hay valor.
 */
export function valorEnElCursor(figura: Pick<DatosDeFigura, 'x' | 'unirHuecos'>, valores: readonly (number | null)[], indice: number): number | null {
  const propio = valores[indice];
  if (propio !== null && propio !== undefined) return propio;
  if (!figura.unirHuecos) return null;
  let antes = indice - 1;
  while (antes >= 0 && (valores[antes] === null || valores[antes] === undefined)) antes--;
  let despues = indice + 1;
  while (despues < valores.length && (valores[despues] === null || valores[despues] === undefined)) despues++;
  if (antes < 0 || despues >= valores.length) return null;
  const x = figura.x[indice]!;
  const x0 = figura.x[antes]!;
  const x1 = figura.x[despues]!;
  const y0 = valores[antes]!;
  const y1 = valores[despues]!;
  return x1 === x0 ? y0 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}

/** Lo que se muestra de una serie cuando se mira un rango del grafico. */
export interface EstadisticaDeSerie {
  etiqueta: string;
  maximo: number | null;
  /** Valor de x donde ocurre el maximo: leer un pico de G es querer saber DONDE. */
  xDelMaximo: number | null;
  minimo: number | null;
  xDelMinimo: number | null;
  promedio: number | null;
  /** Nodos con dato dentro del rango. */
  cantidad: number;
}

/**
 * Maximo, minimo, promedio y donde ocurre el maximo de cada serie visible,
 * sobre el rango [desde, hasta] del eje x. Puro: se testea en Node.
 */
export function estadisticaDeRango(figura: DatosDeFigura, desde: number, hasta: number): EstadisticaDeSerie[] {
  const dentro: number[] = [];
  figura.x.forEach((v, i) => {
    if (typeof v === 'number' && v >= desde && v <= hasta) dentro.push(i);
  });
  return figura.series
    .filter((s) => !s.ocultarEnLeyenda)
    .map((serie) => {
      let maximo: number | null = null;
      let minimo: number | null = null;
      let xDelMaximo: number | null = null;
      let xDelMinimo: number | null = null;
      let suma = 0;
      let cantidad = 0;
      for (const i of dentro) {
        const v = serie.valores[i];
        if (v === null || v === undefined || !Number.isFinite(v)) continue;
        if (maximo === null || v > maximo) {
          maximo = v;
          xDelMaximo = figura.x[i] ?? null;
        }
        if (minimo === null || v < minimo) {
          minimo = v;
          xDelMinimo = figura.x[i] ?? null;
        }
        suma += v;
        cantidad++;
      }
      return { etiqueta: serie.etiqueta, maximo, xDelMaximo, minimo, xDelMinimo, promedio: cantidad > 0 ? suma / cantidad : null, cantidad };
    });
}

// ------------------------------------------------------------ comparacion A/B
// (fase 4.8) Un layout fijado como A se superpone al vivo (B): mismas
// figuras, las series de DATOS de A en tono mas claro. Los limites, bandas y
// franjas son los de B (son los que se estan verificando). Como A y B tienen
// sus propios nodos, el eje x es la union ordenada de los dos y cada serie
// lleva null donde no tiene punto; la figura une esos huecos (unirHuecos).

const COLOR_DE_A: Partial<Record<SerieDeFigura['color'], SerieDeFigura['color']>> = {
  serie1: 'comparacion1',
  serie2: 'comparacion2',
  serie3: 'comparacion3',
};

/** Etiqueta de una serie con la letra del diseno delante: la leyenda dice cual es cual. */
export const conLetra = (letra: 'A' | 'B', etiqueta: string) => `${letra} · ${etiqueta}`;

/** Superpone a la figura viva (B) las series de datos de la misma figura de A. Puro. */
export function superponerComparacion(b: DatosDeFigura, a: DatosDeFigura | undefined): DatosDeFigura {
  if (!a) return b;
  const deA = a.series.filter((s) => COLOR_DE_A[s.color] !== undefined && !s.ocultarEnLeyenda);
  if (deA.length === 0) return b;

  // Union ordenada de los dos ejes x; un x que esta en los dos es un solo punto.
  const x: number[] = [];
  const indiceB: number[] = [];
  const indiceA: number[] = [];
  let i = 0;
  let j = 0;
  while (i < b.x.length || j < a.x.length) {
    const xb = b.x[i];
    const xa = a.x[j];
    if (xa === undefined || (xb !== undefined && xb < xa)) {
      x.push(xb!);
      indiceB.push(i++);
      indiceA.push(-1);
    } else if (xb === undefined || xa < xb) {
      x.push(xa);
      indiceB.push(-1);
      indiceA.push(j++);
    } else {
      x.push(xb);
      indiceB.push(i++);
      indiceA.push(j++);
    }
  }
  const tomar = (valores: (number | null)[], indices: number[]) => indices.map((k) => (k < 0 ? null : valores[k] ?? null));
  // El nodo global de un punto que solo tiene A es el ultimo de B visto: la
  // lista queda creciente (la busqueda binaria del cursor la necesita asi).
  let nodos: number[] | undefined;
  if (b.nodos) {
    nodos = [];
    let ultimo = b.nodos[0] ?? 0;
    for (const k of indiceB) {
      if (k >= 0) ultimo = b.nodos[k]!;
      nodos.push(ultimo);
    }
  }
  return {
    ...b,
    x,
    nodos,
    unirHuecos: true,
    series: [
      ...b.series.map((s) => ({ ...s, etiqueta: COLOR_DE_A[s.color] ? conLetra('B', s.etiqueta) : s.etiqueta, valores: tomar(s.valores, indiceB) })),
      ...deA.map((s) => ({ ...s, etiqueta: conLetra('A', s.etiqueta), color: COLOR_DE_A[s.color]!, ancho: 1.4, valores: tomar(s.valores, indiceA) })),
    ],
  };
}
