// Grafico y veredicto dicen lo mismo: un punto del grafico de G queda por
// encima del "Limite aplicable" si y solo si la verificacion falla por ese
// evento. Vale porque los dos usan el mismo criterio: eventos de corrido en
// toda la linea de tiempo del layout, en tiempo del prototipo; los de menos
// de 0.2 s contra el limite de 200 ms; nada por debajo de G_MIN_EVALUABLE.
//
// Se comprueba en el caso de prueba (el DemoLayout recalculado por el port,
// que es el guardado {"p":{"RadioDelLoop":0.3}} con los cuatro elementos) y en
// dos golden de MATLAB, elemento por elemento y lado por lado, tanto con el
// layout entero a la vista como con cada elemento elegido solo.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analizarLayout } from '../src/contrato/cargar';
import type * as Contrato from '../src/contrato/tipos';
import type { DatosDeFigura } from '../src/graficos/figura';
import { extraerColumnas, figurasDePestana, lineaNormativa } from '../src/graficos/series';
import { G_MIN_EVALUABLE } from '../src/nucleo/norma';
import { reconstruirCircuito } from './arnes';

const cargar = (caso: string) =>
  analizarLayout(readFileSync(fileURLToPath(new URL(`../../golden/${caso}.json`, import.meta.url)), 'utf8'));

const LADOS = [
  { criterio: '+Gz (Fig. 10)', figura: 2, arriba: true, abajo: false },
  { criterio: '-Gz (Fig. 9)', figura: 2, arriba: false, abajo: true },
  { criterio: 'Gy (Fig. 8)', figura: 1, arriba: true, abajo: true },
  { criterio: '+Gx (Fig. 6)', figura: 0, arriba: true, abajo: false },
  { criterio: '-Gx (Fig. 7)', figura: 0, arriba: false, abajo: true },
] as const;

/** true si algun punto de la figura (en los nodos dados) queda del lado de afuera del limite aplicable. */
function superaElLimite(figura: DatosDeFigura, nodos: Set<number>, arriba: boolean, abajo: boolean): boolean {
  const g = figura.series[0]!.valores;
  const sup = figura.series.find((s) => s.etiqueta.startsWith('Límite aplicable'))!.valores;
  const inf = figura.series.find((s) => s.etiqueta === 'aplicable, inferior')!.valores;
  return g.some((v, i) => {
    if (v === null || !nodos.has(figura.nodos![i]!)) return false;
    return (arriba && sup[i] !== null && v > sup[i]!) || (abajo && inf[i] !== null && v < inf[i]!);
  });
}

function comprobar(layout: Contrato.Layout): string[] {
  const discrepancias: string[] = [];
  const linea = lineaNormativa(layout);
  const todo = figurasDePestana('g', extraerColumnas(layout, null), 'tiempo');
  layout.elementos.forEach((elemento, i) => {
    const [desde, hasta] = linea.rangos[i]!;
    const nodos = new Set(Array.from({ length: hasta - desde + 1 }, (_, k) => desde + k));
    const solo = figurasDePestana('g', extraerColumnas(layout, i), 'tiempo');
    for (const lado of LADOS) {
      const criterio = elemento.criterios.posteriores.find((c) => c.nombre === lado.criterio)!;
      const falla = !criterio.pasa;
      const enElLayout = superaElLimite(todo[lado.figura]!, nodos, lado.arriba, lado.abajo);
      const elegido = superaElLimite(solo[lado.figura]!, nodos, lado.arriba, lado.abajo);
      if (enElLayout !== falla || elegido !== falla) {
        discrepancias.push(`${i + 1}. ${elemento.tipo} ${lado.criterio}: falla=${falla}, por encima (layout)=${enElLayout}, por encima (solo)=${elegido}`);
      }
    }
  });
  return discrepancias;
}

describe('consistencia grafico-veredicto', () => {
  it('caso de prueba (DemoLayout recalculado en el navegador)', () => {
    const layout = reconstruirCircuito();
    expect(comprobar(layout)).toEqual([]);
    // Y el caso tiene un criterio que falla por +Gz: la comprobacion no es vacia.
    const loop = layout.elementos[0]!.criterios.posteriores.find((c) => c.nombre === '+Gz (Fig. 10)')!;
    expect(loop.pasa).toBe(false);
    expect(loop.valor!).toBeCloseTo(0.4224, 3);
  }, 120000);

  it.each(['circuito-demolayout', 'loop-arcocircular', 'diveloop-normativa'])('golden %s', (caso) => {
    expect(comprobar(cargar(caso))).toEqual([]);
  });
});

describe('ruido numerico fuera de los limites (caso de prueba)', () => {
  const layout = cargar('circuito-demolayout');

  it('el DiveLoop no tiene limite +Gy dibujado (sin peine sobre Gy de 1e-13 G)', () => {
    const gy = figurasDePestana('g', extraerColumnas(layout, 3), 'tiempo')[1]!;
    const aplicable = gy.series.find((s) => s.etiqueta.startsWith('Límite aplicable'))!.valores;
    expect(aplicable.every((v) => v === null)).toBe(true);
  });

  it('ningun nivel critico por debajo de G_MIN_EVALUABLE (el LoopVertical reportaba 0.0014 G de Gy)', () => {
    for (const elemento of layout.elementos) {
      const normativo = elemento.criterios.normativo as Record<string, { nivelCritico: number; exceso: number | null }>;
      for (const lado of ['masGz', 'menosGz', 'gy', 'masGx', 'menosGx']) {
        const evento = normativo[lado]!;
        if (evento.exceso !== null) expect(Math.abs(evento.nivelCritico)).toBeGreaterThanOrEqual(G_MIN_EVALUABLE - 1e-9);
      }
    }
  });
});
