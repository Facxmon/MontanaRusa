import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analizarLayout } from '../src/contrato/cargar';
import {
  CURVAS_NORMATIVAS,
  limiteDeDiseno,
  limiteNormativo,
  limitePorPunto,
  tramosContiguos,
  type CurvaNormativa,
} from '../src/nucleo/norma';

const CASOS = ['loop-clotoide', 'loop-normativa', 'helice-normativa', 'obt-normativa', 'diveloop-normativa', 'circuito-demolayout'];
const cargar = (caso: string) =>
  analizarLayout(readFileSync(fileURLToPath(new URL(`../../golden/${caso}.json`, import.meta.url)), 'utf8'));

interface Evento {
  curva: CurvaNormativa;
  duracionReal: number;
  limiteAplicado: number | null;
}
interface Normativo {
  curvaMasGzAplicada: CurvaNormativa;
  elipse: { semiejes: [number, number, number] };
  masGz: Evento;
  menosGz: Evento;
  gy: Evento;
  masGx: Evento;
  menosGx: Evento;
}

describe('limiteNormativo contra los golden files', () => {
  it('los semiejes de la elipse son 1.1 x el limite a 200 ms', () => {
    for (const caso of CASOS) {
      for (const elemento of cargar(caso).elementos) {
        const normativo = elemento.criterios.normativo as unknown as Normativo;
        expect(normativo.elipse.semiejes[0]).toBeCloseTo(1.1 * limiteNormativo('MasGxBase', 0.2), 6);
        expect(normativo.elipse.semiejes[1]).toBeCloseTo(1.1 * limiteNormativo('GyBase', 0.2), 6);
        expect(normativo.elipse.semiejes[2]).toBeCloseTo(1.1 * limiteNormativo(normativo.curvaMasGzAplicada, 0.2), 6);
      }
    }
  });

  it('el limite aplicado de cada evento sostenido es la curva evaluada en su duracion real', () => {
    let comparados = 0;
    for (const caso of CASOS) {
      for (const elemento of cargar(caso).elementos) {
        const normativo = elemento.criterios.normativo as unknown as Normativo;
        for (const evento of [normativo.masGz, normativo.menosGz, normativo.gy, normativo.masGx, normativo.menosGx]) {
          if (evento.limiteAplicado === null) continue;
          // duracionReal viene redondeada a 6 cifras: tolerancia acorde a la pendiente maxima (2 G/s)
          expect(evento.limiteAplicado).toBeCloseTo(limiteNormativo(evento.curva, evento.duracionReal), 4);
          comparados++;
        }
      }
    }
    expect(comparados).toBeGreaterThan(10);
  });

  it('es constante fuera de la tabla y lineal adentro', () => {
    expect(limiteNormativo('MasGzTodas', 0.05)).toBe(6);
    expect(limiteNormativo('MasGzTodas', 100)).toBe(2);
    expect(limiteNormativo('MasGzTodas', 1.25)).toBeCloseTo(5.5, 12);
    expect(limiteNormativo('MenosGzBase', 0.35)).toBeCloseTo(-1.75, 12);
  });
});

describe('limiteDeDiseno', () => {
  it('con semiancho 0 es la tabla literal, y nunca la supera en modulo', () => {
    for (const curva of CURVAS_NORMATIVAS) {
      for (let d = 0; d <= 14; d += 0.0137) {
        const literal = limiteNormativo(curva, d);
        expect(limiteDeDiseno(curva, d, 0)).toBe(literal);
        expect(Math.abs(limiteDeDiseno(curva, d, 0.05))).toBeLessThanOrEqual(Math.abs(literal) + 1e-12);
      }
    }
  });

  it('en el quiebre de 1.0 s de la Fig. 10 baja |Dm| w / 4 = 0.025 G con w = 0.05 s', () => {
    expect(limiteDeDiseno('MasGzTodas', 1.0, 0.05)).toBeCloseTo(6 - 0.025, 9);
  });
});

describe('limitePorPunto', () => {
  it('sobre una meseta constante devuelve el limite de la duracion entera', () => {
    const n = 61;
    const g = new Float64Array(n).fill(5);
    const tiempo = Float64Array.from({ length: n }, (_, i) => i * 0.05); // 3 s de modelo
    const limite = limitePorPunto(g, tiempo, 'MasGzTodas', 1, 1, 40);
    for (let i = 0; i < n; i++) expect(limite[i]).toBeCloseTo(limiteNormativo('MasGzTodas', 3.0), 12);
  });

  it('es NaN donde la G no tiene el signo evaluado', () => {
    const g = Float64Array.from([1, 1, -0.5, -0.5, 1]);
    const tiempo = Float64Array.from([0, 0.1, 0.2, 0.3, 0.4]);
    const limite = limitePorPunto(g, tiempo, 'MenosGzBase', 1, -1);
    expect(Number.isNaN(limite[0]!)).toBe(true);
    expect(limite[2]).toBeCloseTo(-2.0, 12); // evento corto: 200 ms
    expect(Number.isNaN(limite[4]!)).toBe(true);
  });

  it('tramosContiguos cierra la ultima corrida', () => {
    expect(tramosContiguos([true, true, false, true])).toEqual([
      [0, 1],
      [3, 3],
    ]);
    expect(tramosContiguos([false, false])).toEqual([]);
  });
});
