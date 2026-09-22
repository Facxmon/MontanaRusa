// Que series lleva cada grafico, calculadas desde el layout: es el espejo
// de GraficarElemento.m (G con banda normativa, jerk con presupuesto de
// onset, cinematica, roll, curvatura). Sin DOM ni uPlot: se testea en Node.
//
// Convencion de ejes, una sola por figura y sin mezclar (igual que en
// MATLAB): contra arco o tiempo del modelo se dibuja el jerk DEL MODELO
// contra el presupuesto del modelo (sqrt(lambda) x norma); contra tiempo
// del prototipo se dibuja el jerk DEL PROTOTIPO contra el numero literal de
// la norma. Las bandas de G se evaluan siempre con el tiempo del modelo,
// que es lo que fija la duracion de los eventos.

import { magnitudPorClave, type ClaveDeMagnitud } from '../contrato/magnitudes';
import type { Elemento, Layout } from '../contrato/tipos';
import { limiteNormativo, limitePorPunto, type CurvaNormativa } from '../nucleo/norma';
import type { BandaEntreSeries, DatosDeFigura, Franja, SerieDeFigura } from './figura';

export type EjeX = 'arco' | 'tiempo' | 'tiempoPrototipo';
export type Pestana = 'g' | 'jerk' | 'cinematica' | 'roll' | 'curvatura';

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
];

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
    const factorTiempo =
      typeof normativo.factorTiempo === 'number' ? normativo.factorTiempo : Math.sqrt(elemento.resumen.lambdaLoop ?? 1);
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
  };
}

/** Columna de nodos concatenada, con null donde el JSON trae null. */
export function columna(columnas: Columnas, clave: ClaveDeMagnitud, escala = 1): (number | null)[] {
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

/** Limite aplicable nodo a nodo (LimitePorPunto), calculado por elemento con su tiempo del modelo. */
function limiteAplicable(tramo: Tramo, clave: ClaveDeMagnitud, curva: CurvaNormativa, signo: 1 | -1): (number | null)[] {
  const n = tramo.elemento.nodos;
  const g = Float64Array.from(n[clave] ?? [], (v) => (v === null ? NaN : v));
  const t = Float64Array.from(n.tiempo, (v) => (v === null ? NaN : v));
  const limite = limitePorPunto(g, t, curva, tramo.factorTiempo, signo, NIVELES_PARA_GRAFICAR);
  const salida: (number | null)[] = [];
  for (let i = tramo.desde; i < n.numeroDeNodos; i++) salida.push(Number.isNaN(limite[i]!) ? null : limite[i]!);
  return salida;
}

function figuraDeG(
  columnas: Columnas,
  ejeX: EjeX,
  nombre: string,
  titulo: string,
  clave: ClaveDeMagnitud,
  claveCabeza: ClaveDeMagnitud | null,
  curvaPositiva: (tramo: Tramo) => CurvaNormativa,
  curvaNegativa: CurvaNormativa,
): DatosDeFigura {
  const series: SerieDeFigura[] = [
    { etiqueta: `${nombre} en el punto de verificación`, valores: columna(columnas, clave), color: SERIE[0], ancho: 1.8 },
  ];
  if (claveCabeza) {
    series.push({ etiqueta: `${nombre} en la cabeza`, valores: columna(columnas, claveCabeza), color: SERIE[1], ancho: 1, trazos: [3, 3] });
  }
  const largoSup = porTramo(columnas, (t, c) => constante(Math.abs(limiteNormativo(curvaPositiva(t), 40)), c));
  const largoInf = porTramo(columnas, (t, c) => constante(-Math.abs(limiteNormativo(curvaNegativa, 40)), c));
  const cortoSup = porTramo(columnas, (t, c) => constante(Math.abs(limiteNormativo(curvaPositiva(t), 0.2)), c));
  const cortoInf = porTramo(columnas, (t, c) => constante(-Math.abs(limiteNormativo(curvaNegativa, 0.2)), c));
  const aplicableSup = porTramo(columnas, (t) => limiteAplicable(t, clave, curvaPositiva(t), 1));
  const aplicableInf = porTramo(columnas, (t) => limiteAplicable(t, clave, curvaNegativa, -1));

  const inicio = series.length;
  series.push(
    { etiqueta: 'Admisible dure lo que dure (evento largo)', valores: largoSup, color: ADMISIBLE_TRAZO, ancho: 1 },
    { etiqueta: 'evento largo, inferior', valores: largoInf, color: ADMISIBLE_TRAZO, ancho: 1, ocultarEnLeyenda: true },
    { etiqueta: 'Límite a 200 ms', valores: cortoSup, color: LIMITE, ancho: 1.2, trazos: [6, 4] },
    { etiqueta: '200 ms, inferior', valores: cortoInf, color: LIMITE, ancho: 1.2, trazos: [6, 4], ocultarEnLeyenda: true },
    { etiqueta: 'Límite aplicable (duración del evento sostenido)', valores: aplicableSup, color: LIMITE, ancho: 1.6 },
    { etiqueta: 'aplicable, inferior', valores: aplicableInf, color: LIMITE, ancho: 1.6, ocultarEnLeyenda: true },
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
    figuraDeG(columnas, ejeX, 'Gx', 'Gx — límites Figs. 6 y 7', 'gx', null, () => 'MasGxBase', 'MenosGxBase'),
    figuraDeG(columnas, ejeX, 'Gy', 'Gy — límite Fig. 8', 'gy', 'gyCabeza', () => 'GyBase', 'GyBase'),
    figuraDeG(columnas, ejeX, 'Gz', 'Gz — límites Figs. 9 y 10', 'gz', 'gzCabeza', (t) => t.curvaMasGz, 'MenosGzBase'),
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
        { etiqueta: 'presupuesto, inferior', valores: presupuesto.map((v) => (v === null ? null : -v)), color: LIMITE, ancho: 1.2, trazos: [6, 4], ocultarEnLeyenda: true },
      ],
      franjas: columnas.franjas[ejeX],
    };
  });
}

export function figurasDeCinematica(columnas: Columnas, ejeX: EjeX): DatosDeFigura[] {
  const x = columnas.x[ejeX] as number[];
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
      clave: 'energia',
      titulo: 'Energía mecánica total del centro de masa',
      etiquetaX: ETIQUETA_DE_EJE[ejeX],
      etiquetaY: 'E [J]',
      x,
      decimalesX: DECIMALES_DE_EJE[ejeX],
      ...formatoDe('energiaTotal'),
      series: [{ etiqueta: 'Energía total', valores: columna(columnas, 'energiaTotal'), color: SERIE[0], ancho: 1.6 }],
      franjas: columnas.franjas[ejeX],
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
    }
  })();
  // El indice de nodo global viaja con cada figura: es lo que hace que el
  // cursor del grafico, el marcador del 3D y el reproductor hablen de lo mismo.
  const nodos = Array.from(columnas.nodos);
  return figuras.map((figura) => sinHuecosEnX({ ...figura, nodos }));
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
