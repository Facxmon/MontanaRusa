import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analizarLayout } from '../src/contrato/cargar';
import { MAGNITUDES, magnitudPorClave } from '../src/contrato/magnitudes';
import { GRIS, colorDe, paradasDeLeyenda, rangoDeMagnitud } from '../src/escena/colores';

const layout = analizarLayout(
  readFileSync(fileURLToPath(new URL('../../golden/loop-clotoide.json', import.meta.url)), 'utf8'),
);

describe('magnitudes', () => {
  it('toda magnitud declarada es una columna de nodos del golden', () => {
    const nodos = layout.elementos[0].nodos as unknown as Record<string, unknown>;
    for (const magnitud of MAGNITUDES) {
      expect(Array.isArray(nodos[magnitud.clave]), magnitud.clave).toBe(true);
    }
  });

  it('magnitudPorClave devuelve la etiqueta y la unidad', () => {
    expect(magnitudPorClave('gz').unidad).toBe('G');
    expect(magnitudPorClave('gz').escala).toBe('secuencial');
    expect(magnitudPorClave('gy').escala).toBe('divergente');
  });
});

describe('rangoDeMagnitud', () => {
  it('da un rango finito con maximo > minimo', () => {
    const rango = rangoDeMagnitud(layout, 'gz');
    expect(Number.isFinite(rango.minimo)).toBe(true);
    expect(rango.maximo).toBeGreaterThan(rango.minimo);
  });

  it('la divergente es simetrica alrededor de cero', () => {
    const rango = rangoDeMagnitud(layout, 'gy');
    expect(rango.minimo).toBeCloseTo(-rango.maximo, 12);
  });

  it('ignora los null', () => {
    const conNull = structuredClone(layout);
    conNull.elementos[0].nodos.gz[0] = null;
    const rango = rangoDeMagnitud(conNull, 'gz');
    expect(Number.isFinite(rango.minimo)).toBe(true);
  });
});

describe('colorDe', () => {
  const rango = { minimo: 0, maximo: 10 };

  it('null es gris', () => {
    expect(colorDe(null, rango, 'secuencial')).toEqual(GRIS);
  });

  it('el minimo y el maximo dan los extremos de la escala y son distintos', () => {
    const abajo = colorDe(0, rango, 'secuencial');
    const arriba = colorDe(10, rango, 'secuencial');
    expect(abajo).not.toEqual(arriba);
    expect(abajo.every((c) => c >= 0 && c <= 1)).toBe(true);
    expect(arriba.every((c) => c >= 0 && c <= 1)).toBe(true);
  });

  it('fuera de rango satura en los extremos', () => {
    expect(colorDe(-5, rango, 'secuencial')).toEqual(colorDe(0, rango, 'secuencial'));
    expect(colorDe(50, rango, 'secuencial')).toEqual(colorDe(10, rango, 'secuencial'));
  });

  it('un rango degenerado no produce NaN', () => {
    const color = colorDe(3, { minimo: 3, maximo: 3 }, 'divergente');
    expect(color.every((c) => Number.isFinite(c))).toBe(true);
  });
});

describe('paradasDeLeyenda', () => {
  it('devuelve n valores equiespaciados del minimo al maximo', () => {
    expect(paradasDeLeyenda({ minimo: 0, maximo: 4 }, 5)).toEqual([0, 1, 2, 3, 4]);
  });
});
