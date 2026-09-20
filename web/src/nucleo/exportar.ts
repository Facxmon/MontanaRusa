// Equivalente en TypeScript de Salida/LayoutAJson.m: convierte el Layout del
// nucleo (structs en PascalCase) al objeto del contrato v1 (camelCase, null
// donde hay NaN/Inf, indices base 0, vectoriales como tripletes). Es el
// mismo objeto que MATLAB escribe en golden/*.json, y por eso el visualizador
// no distingue de donde vino.

import type * as Contrato from '../contrato/tipos';
import type { Vec3 } from './matematica';
import { CATALOGO_DE_ELEMENTOS, DECLARACIONES_DE_ELEMENTOS, ParametrosDeAceptacion, ParametrosDelModo, ParametrosGenerales, ParametrosPorDefecto } from './parametros';
import type { Criterio, Declaracion, Estado, Layout, NombreDeParametro, Parametros, RegistroDeLayout } from './tipos';

/** Lo que una instancia de elemento piso sobre los globales y que de eso no consumio (AjustarParametros). */
export interface InstanciaExportada {
  ajustes: Partial<Parametros>;
  inertes: NombreDeParametro[];
}

export interface OpcionesDeExportacion {
  /** Texto para meta.versionGenerador (hash del build, p. ej.). */
  versionGenerador?: string;
  /** Redondear a 6 cifras significativas como el exportador de MATLAB. */
  redondear?: boolean;
  /**
   * Ajustes e inertes de cada instancia, en el orden de Layout.Elementos.
   * Solo JS los conoce: MATLAB construye con parametros globales y no los emite.
   */
  instancias?: InstanciaExportada[];
}

const VERSION_DEL_CONTRATO = '1.0.0';

function camel(Nombre: string): string {
  return Nombre[0]!.toLowerCase() + Nombre.slice(1);
}

function numero(v: number): number | null {
  return Number.isFinite(v) ? v : null;
}

function seis(v: number): number {
  return v === 0 ? 0 : Number(v.toPrecision(6));
}

/** Como jsonencode sobre un struct: camelCase recursivo; [] de MATLAB (null aca) queda como []. */
function aCamelCase(valor: unknown): unknown {
  if (valor === null || valor === undefined) return [];
  if (valor instanceof Float64Array) return Array.from(valor, (v) => numero(v));
  if (Array.isArray(valor)) return valor.map((v) => (typeof v === 'number' ? numero(v) : aCamelCase(v)));
  if (typeof valor === 'number') return numero(valor);
  if (typeof valor === 'object') {
    const salida: Record<string, unknown> = {};
    for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) salida[camel(clave)] = aCamelCase(v);
    return salida;
  }
  return valor;
}

function declaraciones(lista: Declaracion[]): Contrato.DeclaracionDeParametro[] {
  return lista.map((d) => ({ clave: camel(d.Nombre), unidad: d.Unidad, descripcion: d.Descripcion }));
}

function estadoAJson(E: Estado): Contrato.Estado {
  return aCamelCase(E) as Contrato.Estado;
}

function columna(valores: ArrayLike<number>): Contrato.ArrayDeNumeros {
  return Array.from(valores, (v) => numero(v));
}

function tripletes(valores: Vec3[]): Contrato.ArrayDeVectores3 {
  return valores.map((v) => [v[0], v[1], v[2]] as Contrato.Vector3);
}

function elementoAJson(R: RegistroDeLayout, indice: number): Contrato.Elemento {
  const E = R.Elemento;
  const T = E.Track;
  const S = E.Sim;
  const parametrosUsados: Record<string, unknown> = {};
  for (const d of DECLARACIONES_DE_ELEMENTOS[E.Receta.Nombre]) parametrosUsados[camel(d.Nombre)] = aCamelCase(E.Parametros[d.Nombre]);

  const nodos: Contrato.Nodos = {
    numeroDeNodos: T.PuntosRiel.length,
    arco: columna(T.LongitudArco),
    tiempo: columna(S.Tiempo),
    x: T.PuntosHeartline.map((p) => p[0]),
    y: T.PuntosHeartline.map((p) => p[1]),
    z: T.PuntosHeartline.map((p) => p[2]),
    xRiel: T.PuntosRiel.map((p) => p[0]),
    yRiel: T.PuntosRiel.map((p) => p[1]),
    zRiel: T.PuntosRiel.map((p) => p[2]),
    versorTangente: tripletes(T.VersorTangente),
    versorArribaCarro: tripletes(T.VersorArribaCarro),
    versorLateral: tripletes(T.VersorLateral),
    velocidad: columna(S.VelocidadCentroDeMasa),
    velocidadRiel: columna(S.Velocidad),
    aceleracionTangencial: columna(S.AceleracionTangencial),
    gx: columna(S.Gx),
    gy: columna(S.Gy),
    gz: columna(S.Gz),
    jerkGx: columna(S.JerkGx),
    jerkGy: columna(S.JerkGy),
    jerkGz: columna(S.JerkGz),
    gyCabeza: columna(S.GyCabeza),
    gzCabeza: columna(S.GzCabeza),
    curvatura: columna(T.CurvaturaHeartline),
    curvaturaRiel: columna(T.Curvatura),
    anguloRoll: columna(T.AnguloRoll),
    anguloPeralte: columna(T.AnguloPeralte),
    fuerzaNormal: columna(S.FuerzaNormal),
    energiaTotal: columna(S.EnergiaTotal),
    puntoDeParada: S.PuntoDeParada,
  };

  const criterios = (lista: Criterio[]): Contrato.Criterio[] =>
    lista.map((c) => ({
      nombre: c.Nombre,
      sentido: c.Sentido,
      pasa: c.Pasa,
      valor: numero(c.Valor),
      limite: numero(c.Limite),
      margen: numero(c.Margen),
      unidad: c.Unidad,
      detalle: c.Detalle,
    }));

  return {
    indice,
    tipo: E.Receta.Nombre,
    parametrosUsados,
    nodos,
    subtramos: T.SubTramos.map((s) => ({ nombre: s.Nombre, indiceInicio: s.IndiceInicio, indiceFin: s.IndiceFin })),
    resumen: aCamelCase(R.Reporte.Resumen) as Contrato.ResumenElemento,
    criterios: {
      previos: criterios(R.Reporte.Previos),
      posteriores: criterios(R.Reporte.Posteriores),
      normativo: aCamelCase(R.Reporte.Normativo) as Record<string, unknown>,
      todosPasan: R.Reporte.Previos.every((c) => c.Pasa) && R.Reporte.Posteriores.every((c) => c.Pasa),
    },
    estadoSalida: estadoAJson(R.EstadoSalida),
  };
}

function resumenLayoutAJson(L: Layout): Contrato.ResumenLayout {
  const resumenes = L.Elementos.map((r) => r.Reporte.Resumen);
  const heartline = L.Elementos.flatMap((r) => r.Elemento.Track.PuntosHeartline);
  const todos = [...L.PuntosRiel, ...heartline];
  const min = (c: number, puntos: Vec3[]) => puntos.reduce((m, p) => Math.min(m, p[c]!), Infinity);
  const max = (c: number, puntos: Vec3[]) => puntos.reduce((m, p) => Math.max(m, p[c]!), -Infinity);
  return {
    numeroDeElementos: L.Elementos.length,
    longitudTotal: numero(resumenes.reduce((s, r) => s + r.LongitudRecorrida, 0)),
    tiempoTotal: numero(resumenes.reduce((s, r) => s + r.TiempoDeRecorrido, 0)),
    velocidadFinal: numero(L.EstadoActual.Velocidad),
    gzMaximaGlobal: numero(Math.max(...resumenes.map((r) => r.GzMaxima))),
    gzMinimaGlobal: numero(Math.min(...resumenes.map((r) => r.GzMinima))),
    gyMaximaAbsolutaGlobal: numero(Math.max(...resumenes.map((r) => r.GyMaximaAbsoluta))),
    alturaMaxima: numero(max(2, L.PuntosRiel)),
    alturaMinima: numero(min(2, L.PuntosRiel)),
    boundingBox: [
      [min(0, todos), max(0, todos)],
      [min(1, todos), max(1, todos)],
      [min(2, todos), max(2, todos)],
    ],
    todosLosCriteriosPasan: L.Elementos.every((r) => r.Reporte.Previos.every((c) => c.Pasa) && r.Reporte.Posteriores.every((c) => c.Pasa)),
  };
}

function esquemaDeParametros(P: Parametros): Contrato.Parametros['esquema'] {
  const { Lista, Nota } = ParametrosDelModo(P.ModoCurvatura);
  const elementos: Record<string, Contrato.DeclaracionDeParametro[]> = {};
  for (const nombre of CATALOGO_DE_ELEMENTOS) elementos[nombre] = declaraciones(DECLARACIONES_DE_ELEMENTOS[nombre]);
  return {
    modo: { nombre: P.ModoCurvatura, opciones: ['AceleracionNormalConstante', 'Clotoide', 'FuerzaGConstante', 'GNormativaMaxima'], nota: Nota, parametros: declaraciones(Lista) },
    elementos,
    aceptacion: declaraciones(ParametrosDeAceptacion()),
    generales: declaraciones(ParametrosGenerales()),
  };
}

/** Redondeo recursivo a 6 cifras significativas de todos los numeros que no son indices ni conteos. */
export function redondearTodo(valor: unknown, clave = ''): unknown {
  if (typeof valor === 'number') {
    if (['numeroDeNodos', 'indice', 'indiceInicio', 'indiceFin', 'numeroDeElementos', 'puntoDeParada'].includes(clave)) return valor;
    return seis(valor);
  }
  if (Array.isArray(valor)) return valor.map((v) => redondearTodo(v, clave));
  if (valor && typeof valor === 'object') {
    const salida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) salida[k] = redondearTodo(v, k);
    return salida;
  }
  return valor;
}

export function exportarLayout(L: Layout, opciones: OpcionesDeExportacion = {}): Contrato.Layout {
  if (L.Elementos.length === 0) throw new Error('El layout no tiene elementos: el contrato exige al menos uno.');
  const documento: Contrato.Layout = {
    meta: {
      versionContrato: VERSION_DEL_CONTRATO,
      generadoPor: 'js',
      versionGenerador: opciones.versionGenerador ?? 'desconocido',
      generadoEn: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      unidades: {
        longitud: 'm', tiempo: 's', masa: 'kg', angulo: 'rad', velocidad: 'm/s', aceleracion: 'G', aceleracionLineal: 'm/s^2',
        curvatura: '1/m', jerk: 'G/s', fuerza: 'N', energia: 'J',
      },
    },
    parametros: {
      valores: aCamelCase(L.Parametros) as Contrato.Parametros['valores'],
      esquema: esquemaDeParametros(L.Parametros),
      defaults: aCamelCase(ParametrosPorDefecto()) as Record<string, unknown>,
    },
    estadoInicial: estadoAJson(L.EstadoInicial),
    elementos: L.Elementos.map(elementoAJson) as Contrato.Layout['elementos'],
    resumenLayout: resumenLayoutAJson(L),
  };
  return opciones.redondear ? (redondearTodo(documento) as Contrato.Layout) : documento;
}
