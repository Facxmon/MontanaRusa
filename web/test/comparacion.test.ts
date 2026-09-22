import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analizarLayout } from '../src/contrato/cargar';
import type { DatosDeFigura } from '../src/graficos/figura';
import { extraerColumnas, figurasDePestana, indiceDeNodo, superponerComparacion } from '../src/graficos/series';

const figura = (x: number[], valores: number[], nodos: number[]): DatosDeFigura => ({
  titulo: 'Gz', etiquetaX: 'x', etiquetaY: 'y', x, decimales: 2, decimalesX: 3, franjas: [], nodos,
  series: [
    { etiqueta: 'Gz', valores, color: 'serie1' },
    { etiqueta: 'Límite', valores: valores.map(() => 6), color: 'limite' },
  ],
});

describe('comparacion A/B (fase 4.8)', () => {
  it('une los ejes x, deja null donde cada diseno no tiene punto y marca A y B en la leyenda', () => {
    const b = figura([0, 1, 2], [1, 2, 3], [0, 1, 2]);
    const a = figura([0, 0.5, 2, 3], [10, 20, 30, 40], [0, 1, 2, 3]);
    const s = superponerComparacion(b, a);
    expect(s.x).toEqual([0, 0.5, 1, 2, 3]);
    expect(s.unirHuecos).toBe(true);
    expect(s.series.map((x) => x.etiqueta)).toEqual(['B · Gz', 'Límite', 'A · Gz']);
    expect(s.series[0]!.valores).toEqual([1, null, 2, 3, null]);
    expect(s.series[2]!.valores).toEqual([10, 20, null, 30, 40]);
    expect(s.series[2]!.color).toBe('comparacion1');
    // Los limites son los de B: A no aporta ninguna referencia.
    expect(s.series.filter((x) => x.color === 'limite')).toHaveLength(1);
    // Los nodos siguen crecientes: el cursor ligado sigue encontrando su punto.
    expect(s.nodos).toEqual([0, 0, 1, 2, 2]);
    expect(indiceDeNodo(s.nodos!, 1)).toBe(2);
  });

  it('sin A, la figura queda igual', () => {
    const b = figura([0, 1], [1, 2], [0, 1]);
    expect(superponerComparacion(b, undefined)).toBe(b);
  });

  it('con dos golden reales, todas las figuras de todas las pestanas se superponen sin perder puntos', () => {
    const leer = (c: string) => analizarLayout(readFileSync(fileURLToPath(new URL(`../../golden/${c}.json`, import.meta.url)), 'utf8'));
    const [b, a] = [leer('loop-clotoide'), leer('loop-gconstante')];
    for (const pestana of ['g', 'jerk', 'cinematica', 'roll', 'curvatura'] as const) {
      const fb = figurasDePestana(pestana, extraerColumnas(b, null), 'arco');
      const fa = figurasDePestana(pestana, extraerColumnas(a, null), 'arco');
      fb.forEach((d, i) => {
        const s = superponerComparacion(d, fa[i]);
        expect(s.x.length).toBeGreaterThanOrEqual(d.x.length);
        for (const serie of s.series) expect(serie.valores).toHaveLength(s.x.length);
        const deB = s.series[0]!.valores.filter((v) => v !== null).length;
        expect(deB).toBe(d.series[0]!.valores.filter((v) => v !== null).length);
      });
    }
  });
});
