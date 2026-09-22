// Textos que se guardan a archivo, todos puros (se testean en Node):
//  - textoDelLayout: el contrato entero, redondeado a 6 cifras como
//    LayoutAJson.m, compacto (layout.json del paquete).
//  - textoDeParametros: el diseno serializado (serializar.ts), legible
//    (parametros.json: lo que se versiona en git y se comparte).
//  - csvDeSeries: las columnas de nodos de todo el layout, una fila por
//    nodo, para re-graficar en cualquier lado (series.csv).
//  - textoLeeme: fecha, versiones, origen y el contenido del paquete
//    (LEEME.txt).
//  - csvDeFigura: una figura sola (eje x mas las series visibles), para el
//    boton de exportar de cada grafico.

import type { DatosDeFigura } from '../graficos/figura';
import type * as Contrato from '../contrato/tipos';
import type { EntradaDeDiseno } from './calcular';
import { redondearTodo } from './exportar';
import { serializarDiseno } from './serializar';

export function textoDelLayout(layout: Contrato.Layout): string {
  return `${JSON.stringify(redondearTodo(layout))}\n`;
}

/** Solo parametros: serializarDiseno tal cual, con sangria para que se pueda leer y diffear. */
export function textoDeParametros(diseno: EntradaDeDiseno): string {
  return `${JSON.stringify(serializarDiseno(diseno), null, 2)}\n`;
}

// ------------------------------------------------------------ CSV
/** Columnas escalares de nodos, en el orden del contrato; las que faltan en un elemento salen vacias. */
const ESCALARES: (keyof Contrato.Nodos)[] = [
  'arco', 'tiempo', 'x', 'y', 'z', 'xRiel', 'yRiel', 'zRiel',
  'velocidad', 'velocidadRiel', 'aceleracionTangencial',
  'gx', 'gy', 'gz', 'gyCabeza', 'gzCabeza', 'jerkGx', 'jerkGy', 'jerkGz',
  'curvatura', 'curvaturaRiel', 'anguloRoll', 'anguloPeralte', 'fuerzaNormal', 'energiaTotal',
];
const VERSORES: { clave: keyof Contrato.Nodos; prefijo: string }[] = [
  { clave: 'versorTangente', prefijo: 't' },
  { clave: 'versorArribaCarro', prefijo: 'u' },
  { clave: 'versorLateral', prefijo: 'l' },
];

/** Cabecera del CSV: elemento, tipo, nodo, tiempo acumulado, escalares y versores por componente. */
export const COLUMNAS_DEL_CSV: string[] = [
  'elemento', 'tipo', 'nodo', 'tiempoAcumulado',
  ...ESCALARES,
  ...VERSORES.flatMap((v) => [`${v.prefijo}x`, `${v.prefijo}y`, `${v.prefijo}z`]),
];

function celda(v: unknown): string {
  if (v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v))) return '';
  if (typeof v === 'number') return String(v === 0 ? 0 : Number(v.toPrecision(6)));
  return String(v);
}

/**
 * Una fila por nodo de cada elemento, con el nodo repetido del empalme
 * incluido (la columna `elemento` lo distingue). `tiempoAcumulado` suma el
 * tiempo de recorrido de los elementos anteriores: `tiempo` es relativo a
 * cada elemento en el contrato. Numeros a 6 cifras, como el JSON; null vacio.
 */
export function csvDeSeries(layout: Contrato.Layout): string {
  const filas: string[] = [COLUMNAS_DEL_CSV.join(',')];
  let desfase = 0;
  layout.elementos.forEach((elemento, i) => {
    const n = elemento.nodos;
    for (let k = 0; k < n.numeroDeNodos; k++) {
      const t = n.tiempo[k];
      const valores: unknown[] = [i + 1, elemento.tipo, k, typeof t === 'number' ? t + desfase : null];
      for (const clave of ESCALARES) valores.push((n[clave] as Contrato.ArrayDeNumeros | undefined)?.[k] ?? null);
      for (const v of VERSORES) {
        const vector = (n[v.clave] as Contrato.ArrayDeVectores3 | undefined)?.[k];
        valores.push(vector?.[0] ?? null, vector?.[1] ?? null, vector?.[2] ?? null);
      }
      filas.push(valores.map(celda).join(','));
    }
    desfase += elemento.resumen.tiempoDeRecorrido ?? 0;
  });
  return `${filas.join('\n')}\n`;
}

// ------------------------------------------------------------ LEEME
export interface DatosDelLeeme {
  layout: Contrato.Layout;
  /** Nombre del caso o archivo del que salio el diseno, o null si es propio desde cero. */
  origen: string | null;
  fecha: Date;
  /** Nombres de los archivos incluidos en el paquete, en orden. */
  archivos: string[];
}

export function textoLeeme({ layout, origen, fecha, archivos }: DatosDelLeeme): string {
  const unidades = Object.entries(layout.meta.unidades).map(([k, v]) => `  ${k}: ${v}`).join('\n');
  return [
    'Montana rusa en miniatura - paquete de resultados',
    '',
    `Fecha: ${fecha.toISOString()}`,
    `Version del contrato: ${layout.meta.versionContrato}`,
    `Generado por: ${layout.meta.generadoPor}${layout.meta.versionGenerador ? ` (${layout.meta.versionGenerador})` : ''}`,
    `Caso de origen: ${origen ?? 'diseno propio'}`,
    `Elementos: ${layout.elementos.map((e, i) => `${i + 1}. ${e.tipo}`).join(', ')}`,
    '',
    'Contenido:',
    '  layout.json      el contrato entero (CONTRATO_VISUALIZADOR.md), SI y radianes',
    '  parametros.json  solo el diseno: parametros que difieren del default, estado inicial y secuencia;',
    '                   se importa en el visualizador y se comparte por link',
    '  series.csv       una fila por nodo con las columnas del contrato (tiempoAcumulado suma los elementos anteriores)',
    '  graficos/        las figuras de cada pestana (G, jerk, cinematica, roll, curvatura) en PNG a 2x',
    '  vista-3d.png     la vista 3D tal como estaba en pantalla',
    '',
    'Unidades:',
    unidades,
    '',
    'Archivos:',
    ...archivos.map((a) => `  ${a}`),
    '',
  ].join('\n');
}

// ------------------------------------------------ CSV de una figura
/**
 * Una figura como CSV: la columna del eje x y una columna por serie visible,
 * con los nombres que se leen en la leyenda. Es la version por figura del
 * series.csv del paquete (fase 2): lo que hace que la curva que se esta
 * mirando se pueda re-graficar en cualquier lado sin bajar los 2 MB del
 * layout entero. Puro, como todo lo de este modulo.
 */
export function csvDeFigura(figura: DatosDeFigura): string {
  const series = figura.series.filter((s) => !s.ocultarEnLeyenda);
  const filas: string[] = [[figura.etiquetaX, ...series.map((s) => s.etiqueta)].map(entrecomillar).join(',')];
  figura.x.forEach((x, i) => {
    filas.push([celda(x), ...series.map((s) => celda(s.valores[i]))].join(','));
  });
  return `${filas.join('\n')}\n`;
}

/** Las etiquetas de las series traen comas y parentesis: van entre comillas. */
function entrecomillar(texto: string): string {
  return `"${texto.replace(/"/g, '""')}"`;
}
