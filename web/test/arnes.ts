// Arnes de comparacion port contra golden: reconstruye los casos canonicos
// con el nucleo en TypeScript, con el mismo setup que GenerarGoldenFiles.m,
// y mide las diferencias campo por campo.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { analizarLayout } from '../src/contrato/cargar';
import type * as Contrato from '../src/contrato/tipos';
import { EstadoInicial } from '../src/nucleo/basicos';
import { CONSTRUCTORES, LayoutAgregarElemento, LayoutNuevo } from '../src/nucleo/elementos';
import { exportarLayout } from '../src/nucleo/exportar';
import { AjustarParametros, ParametrosPorDefecto } from '../src/nucleo/parametros';
import type { ModoCurvatura, NombreDeElemento, Parametros } from '../src/nucleo/tipos';

export const CASOS: Record<string, { elemento: NombreDeElemento; modo: ModoCurvatura; ajustes: Partial<Parametros> }> = {
  'loop-clotoide': { elemento: 'LoopVertical', modo: 'Clotoide', ajustes: {} },
  'loop-gconstante': { elemento: 'LoopVertical', modo: 'FuerzaGConstante', ajustes: {} },
  'loop-normativa': { elemento: 'LoopVertical', modo: 'GNormativaMaxima', ajustes: {} },
  'loop-anconstante': { elemento: 'LoopVertical', modo: 'AceleracionNormalConstante', ajustes: {} },
  'helice-clotoide': { elemento: 'Helice', modo: 'Clotoide', ajustes: {} },
  'helice-normativa': { elemento: 'Helice', modo: 'GNormativaMaxima', ajustes: {} },
  'obt-clotoide': { elemento: 'OverBankedTurn', modo: 'Clotoide', ajustes: { AnguloDelGiro: (240 * Math.PI) / 180 } },
  'obt-normativa': { elemento: 'OverBankedTurn', modo: 'GNormativaMaxima', ajustes: { AnguloDelGiro: (240 * Math.PI) / 180 } },
  'diveloop-clotoide': { elemento: 'DiveLoop', modo: 'Clotoide', ajustes: {} },
  'diveloop-normativa': { elemento: 'DiveLoop', modo: 'GNormativaMaxima', ajustes: {} },
};

export function cargarGolden(caso: string): Contrato.Layout {
  return analizarLayout(readFileSync(fileURLToPath(new URL(`../../golden/${caso}.json`, import.meta.url)), 'utf8'));
}

/** Reconstruye un caso de un elemento con el setup de GenerarGoldenFiles.m. */
export function reconstruirCaso(caso: string): Contrato.Layout {
  const definicion = CASOS[caso];
  if (!definicion) throw new Error(`Caso desconocido: ${caso}`);
  let Parametros = ParametrosPorDefecto();
  Parametros.RadioDelLoop = 0.3;
  Parametros.MetodoDeAcoplamiento = 'A';
  Parametros.CalcularVelocidadMinima = false;
  Parametros.ModoCurvatura = definicion.modo;
  Parametros = AjustarParametros(Parametros, definicion.ajustes, definicion.elemento).Parametros;

  let Estado = EstadoInicial([0, 0, 1.0], [1, 0, 0], [0, 0, 1], 5.0, Parametros);
  let Layout = LayoutNuevo(Estado, Parametros);
  const [Salida, Elemento, Reporte] = CONSTRUCTORES[definicion.elemento](Estado, Parametros, Layout);
  Estado = Salida;
  Layout = LayoutAgregarElemento(Layout, Elemento, Estado, Reporte);
  return exportarLayout(Layout, { versionGenerador: 'port' });
}

/** Reconstruye el circuito de DemoLayout.m. */
export function reconstruirCircuito(): Contrato.Layout {
  const Parametros = ParametrosPorDefecto();
  Parametros.ModoCurvatura = 'Clotoide';
  Parametros.MetodoDeAcoplamiento = 'A';
  Parametros.CalcularVelocidadMinima = false;
  Parametros.RadioDelLoop = 0.3;
  Parametros.RadioDelGiro = 0.8;
  Parametros.RadioDeLaHelice = 0.7;
  Parametros.RadioDelDiveLoop = 0.45;
  const Secuencia: NombreDeElemento[] = ['LoopVertical', 'OverBankedTurn', 'Helice', 'DiveLoop'];
  let Estado = EstadoInicial([0, 0, 1.0], [1, 0, 0], [0, 0, 1], 4.5, Parametros);
  let Layout = LayoutNuevo(Estado, Parametros);
  for (const nombre of Secuencia) {
    const [Salida, Elemento, Reporte] = CONSTRUCTORES[nombre](Estado, Parametros, Layout);
    Estado = Salida;
    Layout = LayoutAgregarElemento(Layout, Elemento, Estado, Reporte);
  }
  return exportarLayout(Layout, { versionGenerador: 'port' });
}

export interface Diferencia {
  campo: string;
  maxAbs: number;
  maxRel: number;
  indice: number;
  golden: number | null;
  port: number | null;
}

/** Diferencia maxima entre dos columnas (null cuenta como coincidencia solo si los dos son null). */
export function compararColumnas(campo: string, golden: (number | null)[], port: (number | null)[]): Diferencia {
  const d: Diferencia = { campo, maxAbs: 0, maxRel: 0, indice: -1, golden: null, port: null };
  if (golden.length !== port.length) {
    return { ...d, maxAbs: Infinity, maxRel: Infinity, indice: -1, golden: golden.length, port: port.length };
  }
  for (let i = 0; i < golden.length; i++) {
    const a = golden[i] ?? null;
    const b = port[i] ?? null;
    if (a === null || b === null) {
      if (a !== b) return { ...d, maxAbs: Infinity, maxRel: Infinity, indice: i, golden: a, port: b };
      continue;
    }
    const abs = Math.abs(a - b);
    const rel = abs / Math.max(Math.abs(a), Math.abs(b), 1e-300);
    if (abs > d.maxAbs) {
      d.maxAbs = abs;
      d.indice = i;
      d.golden = a;
      d.port = b;
    }
    if (rel > d.maxRel) d.maxRel = rel;
  }
  return d;
}

export function compararLayouts(golden: Contrato.Layout, port: Contrato.Layout): Diferencia[] {
  const diferencias: Diferencia[] = [];
  if (golden.elementos.length !== port.elementos.length) {
    diferencias.push({ campo: 'elementos.length', maxAbs: Infinity, maxRel: Infinity, indice: -1, golden: golden.elementos.length, port: port.elementos.length });
    return diferencias;
  }
  golden.elementos.forEach((eg, i) => {
    const ep = port.elementos[i]!;
    const prefijo = `elementos[${i}].`;
    if (eg.nodos.numeroDeNodos !== ep.nodos.numeroDeNodos) {
      diferencias.push({ campo: `${prefijo}nodos.numeroDeNodos`, maxAbs: Infinity, maxRel: Infinity, indice: -1, golden: eg.nodos.numeroDeNodos, port: ep.nodos.numeroDeNodos });
    }
    for (const clave of Object.keys(eg.nodos) as (keyof Contrato.Nodos)[]) {
      const g = eg.nodos[clave];
      const p = ep.nodos[clave];
      if (!Array.isArray(g)) continue;
      if (Array.isArray(g[0])) {
        for (let c = 0; c < 3; c++) {
          diferencias.push(compararColumnas(`${prefijo}nodos.${clave}[${c}]`, (g as Contrato.Vector3[]).map((v) => v[c]!), (p as Contrato.Vector3[]).map((v) => v[c]!)));
        }
      } else {
        diferencias.push(compararColumnas(`${prefijo}nodos.${clave}`, g as (number | null)[], p as (number | null)[]));
      }
    }
    for (const [clave, valor] of Object.entries(eg.resumen)) {
      const otro = (ep.resumen as Record<string, unknown>)[clave];
      if (typeof valor === 'number' || valor === null) {
        diferencias.push(compararColumnas(`${prefijo}resumen.${clave}`, [valor], [otro as number | null]));
      } else if (Array.isArray(valor)) {
        diferencias.push(compararColumnas(`${prefijo}resumen.${clave}`, valor as number[], otro as number[]));
      }
    }
    for (const grupo of ['previos', 'posteriores'] as const) {
      eg.criterios[grupo].forEach((cg, k) => {
        const cp = ep.criterios[grupo][k];
        if (!cp || cp.nombre !== cg.nombre || cp.pasa !== cg.pasa) {
          diferencias.push({ campo: `${prefijo}criterios.${grupo}[${k}].pasa (${cg.nombre})`, maxAbs: Infinity, maxRel: Infinity, indice: k, golden: cg.pasa ? 1 : 0, port: cp ? (cp.pasa ? 1 : 0) : null });
        } else {
          diferencias.push(compararColumnas(`${prefijo}criterios.${grupo}[${k}].valor (${cg.nombre})`, [cg.valor, cg.margen], [cp.valor, cp.margen]));
        }
      });
    }
    for (const [clave, valor] of Object.entries(eg.estadoSalida)) {
      const otro = (ep.estadoSalida as unknown as Record<string, unknown>)[clave];
      diferencias.push(compararColumnas(`${prefijo}estadoSalida.${clave}`, ([] as (number | null)[]).concat(valor as number), ([] as (number | null)[]).concat(otro as number)));
    }
  });
  for (const [clave, valor] of Object.entries(golden.resumenLayout)) {
    if (typeof valor === 'boolean') continue;
    const otro = (port.resumenLayout as unknown as Record<string, unknown>)[clave];
    diferencias.push(compararColumnas(`resumenLayout.${clave}`, ([] as (number | null)[]).concat(valor as number), ([] as (number | null)[]).concat(otro as number)));
  }
  return diferencias;
}
