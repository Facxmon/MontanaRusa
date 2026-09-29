import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analizarLayout } from '../src/contrato/cargar';
import type { DatosDeFigura } from '../src/graficos/figura';
import { extraerColumnas, figurasDePestana, indiceDeNodo, superponerComparacion, valorEnElCursor } from '../src/graficos/series';

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

  it('el cursor muestra A y B en la misma abscisa: el que no tiene punto ahi se interpola', () => {
    const b = figura([0, 1, 2], [1, 2, 3], [0, 1, 2]);
    const a = figura([0, 0.5, 2, 3], [10, 20, 30, 40], [0, 1, 2, 3]);
    const s = superponerComparacion(b, a);
    const bGz = s.series[0]!.valores;
    const aGz = s.series[2]!.valores;
    // x = 0.5 es un punto de A: B vale lo que dibuja su linea entre x = 0 y x = 1.
    expect(valorEnElCursor(s, bGz, 1)).toBeCloseTo(1.5, 12);
    expect(valorEnElCursor(s, aGz, 1)).toBe(20);
    // x = 1 es un punto de B: A se interpola entre x = 0.5 (20) y x = 2 (30).
    expect(valorEnElCursor(s, bGz, 2)).toBe(2);
    expect(valorEnElCursor(s, aGz, 2)).toBeCloseTo(20 + (10 * 0.5) / 1.5, 12);
    // Fuera del rango de B (x = 3) no se inventa nada.
    expect(valorEnElCursor(s, bGz, 4)).toBeNull();
    // Sin comparacion (sin unirHuecos) un null sigue siendo null.
    expect(valorEnElCursor({ x: [0, 1, 2], unirHuecos: false }, [1, null, 3], 1)).toBeNull();
  });

  it('sin A, la figura queda igual', () => {
    const b = figura([0, 1], [1, 2], [0, 1]);
    expect(superponerComparacion(b, undefined)).toBe(b);
  });

  it('con dos golden reales, todas las figuras de todas las pestanas se superponen sin perder puntos', () => {
    const leer = (c: string) => analizarLayout(readFileSync(fileURLToPath(new URL(`../../golden/${c}.json`, import.meta.url)), 'utf8'));
    const [b, a] = [leer('loop-arcocircular'), leer('loop-gconstante')];
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
