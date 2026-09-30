// Limites normativos de aceleracion (ASTM F2291-06a, seccion 7) con senales
// sinteticas de resultado conocido a mano, independientes de los golden:
//  - eventos de menos de 200 ms evaluados contra el limite de 200 ms;
//  - eventos contados de corrido a traves de los empalmes del layout;
//  - umbral contra ruido numerico (G_MIN_EVALUABLE);
//  - reversiones en X e Y (7.1.6);
//  - reduccion de +Gz despues de -Gz sostenido (7.1.7.1), literal.

import { describe, expect, it } from 'vitest';
import { G_MIN_EVALUABLE, limiteNormativo, limitePorPunto, ventanasMasGzReducido } from '../src/nucleo/norma';
import type { Sim } from '../src/nucleo/tipos';
import { PeorEventoSostenido, ReversionesSostenidas, SerieNormativaDelLayout } from '../src/nucleo/verificacion';

const PASO = 0.001;

/** Tiempos 0, PASO, ..., duracion (inclusive). */
function tiempos(duracion: number): number[] {
  return Array.from({ length: Math.round(duracion / PASO) + 1 }, (_, i) => i * PASO);
}

/** Interpolacion lineal por tramos entre puntos (t, g). */
function senal(t: number[], puntos: Array<[number, number]>): number[] {
  return t.map((x) => {
    if (x <= puntos[0]![0]) return puntos[0]![1];
    for (let k = 0; k < puntos.length - 1; k++) {
      const [x0, y0] = puntos[k]!;
      const [x1, y1] = puntos[k + 1]!;
      if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
    return puntos[puntos.length - 1]![1];
  });
}

const todo = (g: number[]): [number, number] => [0, g.length - 1];

/** Lo unico que lee SerieNormativaDelLayout de un Sim. */
const simDe = (tiempo: number[], gz: number[]): Sim =>
  ({ Tiempo: Float64Array.from(tiempo), Gx: new Float64Array(tiempo.length), Gy: new Float64Array(tiempo.length), Gz: Float64Array.from(gz) }) as unknown as Sim;

describe('eventos de menos de 200 ms: se evaluan contra el limite de 200 ms', () => {
  // Pulso trapezoidal de 6.5 G sobre 1 G: base de 0.15 s, meseta de 0.05 s.
  const t = tiempos(1);
  const gz = senal(t, [[0, 1], [0.4, 1], [0.45, 6.5], [0.5, 6.5], [0.55, 1], [1, 1]]);

  it('un pico de 6.5 G de 0.15 s falla contra 6.0 G', () => {
    const e = PeorEventoSostenido(gz, t, todo(gz), 'MasGzTodas', 1, null);
    expect(e.NivelCritico).toBeCloseTo(6.5, 12);
    expect(e.DuracionReal).toBe(0.2);
    expect(e.LimiteAplicado).toBe(6.0);
    expect(e.Exceso).toBeCloseTo(0.5, 12);
    // DuracionMasLarga sigue siendo la real: el evento a 1 G dura el segundo entero.
    expect(e.DuracionMasLarga).toBeCloseTo(1, 12);
  });

  it('la linea del grafico lo marca igual: el pico queda por encima de 6.0 G', () => {
    const limite = limitePorPunto(gz, t, 'MasGzTodas', 1, 1, 400);
    const pico = gz.indexOf(Math.max(...gz));
    expect(limite[pico]).toBe(6.0);
    expect(gz[pico]!).toBeGreaterThan(limite[pico]!);
  });
});

describe('eventos contados de corrido en el layout', () => {
  // Meseta de 1.5 G partida en dos elementos con distinto factorTiempo.
  const tA = tiempos(1);
  const tB = tiempos(0.5);
  const serie = SerieNormativaDelLayout([simDe(tA, tA.map(() => 1.5)), simDe(tB, tB.map(() => 1.5))], [2, 4]);

  it('el nodo del empalme se cuenta una sola vez y el tiempo del prototipo es continuo', () => {
    expect(serie.Gz.length).toBe(tA.length + tB.length - 1);
    expect(serie.Rango).toEqual([[0, tA.length - 1], [tA.length - 1, tA.length + tB.length - 2]]);
    expect(serie.TiempoPrototipo[tA.length - 1]).toBeCloseTo(2, 12);
    expect(serie.TiempoPrototipo[serie.TiempoPrototipo.length - 1]).toBeCloseTo(4, 12);
  });

  it('una sola duracion, igual a la suma escalada (1 s x 2 + 0.5 s x 4 = 4 s), vista desde los dos elementos', () => {
    for (const rango of serie.Rango) {
      const e = PeorEventoSostenido(serie.Gz, serie.TiempoPrototipo, rango, 'MasGzTodas', 1, null);
      expect(e.DuracionMasLarga).toBeCloseTo(4, 12);
      expect(e.DuracionReal).toBeCloseTo(4, 12);
      expect(e.LimiteAplicado).toBe(limiteNormativo('MasGzTodas', 4));
    }
  });

  it('cada elemento solo, sin el layout, veria solo su mitad', () => {
    const solo = SerieNormativaDelLayout([simDe(tB, tB.map(() => 1.5))], [4]);
    expect(PeorEventoSostenido(solo.Gz, solo.TiempoPrototipo, solo.Rango[0]!, 'MasGzTodas', 1, null).DuracionMasLarga).toBeCloseTo(2, 12);
  });
});

describe('umbral contra ruido numerico', () => {
  const t = tiempos(1);
  const ruido = t.map((_, i) => 1e-13 * Math.sin(i));

  it('G_MIN_EVALUABLE es 0.01 G', () => {
    expect(G_MIN_EVALUABLE).toBe(0.01);
  });

  it('una senal de 1e-13 G no tiene evento critico ni limite dibujado', () => {
    const e = PeorEventoSostenido(ruido, t, todo(ruido), 'GyBase', 1, null);
    expect(e.Exceso).toBe(-Infinity);
    expect(e.NivelCritico).toBe(0);
    expect(Array.from(limitePorPunto(ruido, t, 'GyBase', 1, 1, 400)).every(Number.isNaN)).toBe(true);
    expect(Array.from(limitePorPunto(ruido, t, 'GyBase', 1, -1, 400)).every(Number.isNaN)).toBe(true);
  });

  it('la grilla de niveles arranca en el umbral: nada por debajo de 0.01 G recibe limite', () => {
    const g = senal(t, [[0, 0.005], [0.5, 0.05], [1, 0.005]]);
    const limite = limitePorPunto(g, t, 'GyBase', 1, 1, 400);
    g.forEach((v, i) => expect(Number.isNaN(limite[i]!)).toBe(v < G_MIN_EVALUABLE));
  });
});

describe('reversiones en X e Y (7.1.6)', () => {
  const t = tiempos(0.8);
  // Dos eventos sostenidos de Gy de signo opuesto (0.3 s cada uno, pico 1.8 G).
  const conPicosA = (separacion: number) =>
    senal(t, [[0, 0], [0.05, 0], [0.275, 1.8], [0.35, 0], [0.275 + separacion, -1.8], [0.65, 0], [0.8, 0]]);

  it('con los picos a 0.15 s el limite cae al 50 %: 1.8 G contra 1.5 G falla', () => {
    const g = conPicosA(0.15);
    const r = ReversionesSostenidas(g, t, todo(g), 'GyBase', 'GyBase');
    expect(r.Reducida).toBe(true);
    expect(r.TiempoPicoAPicoMinimo).toBeCloseTo(0.15, 9);
    expect(Math.abs(r.LimiteReducido)).toBeCloseTo(0.5 * limiteNormativo('GyBase', 0.3), 2);
    expect(Math.abs(r.PicoG)).toBeCloseTo(1.8, 9);
    expect(r.Exceso).toBeGreaterThan(0.29);
  });

  it('con los picos a 0.3 s no hay reduccion', () => {
    const g = conPicosA(0.3);
    const r = ReversionesSostenidas(g, t, todo(g), 'GyBase', 'GyBase');
    expect(r.Reducida).toBe(false);
    expect(r.TiempoPicoAPicoMinimo).toBeCloseTo(0.3, 9);
    expect(r.Exceso).toBe(-Infinity);
  });

  it('un evento de menos de 0.2 s no es sostenido y no forma reversion', () => {
    const g = senal(t, [[0, 0], [0.05, 0], [0.1, 1.8], [0.15, 0], [0.225, -1.8], [0.5, 0], [0.8, 0]]);
    const r = ReversionesSostenidas(g, t, todo(g), 'GyBase', 'GyBase');
    expect(r.Reducida).toBe(false);
    expect(r.TiempoPicoAPicoMinimo).toBe(Infinity);
  });
});

describe('reduccion de +Gz despues de -Gz sostenido (7.1.7.1), literal', () => {
  // 3.5 s de -0.5 G, y despues +Gz: la curva reducida rige 6 s desde la transicion.
  const t = tiempos(14);
  const conMeseta = (desde: number) =>
    senal(t, [[0, -0.5], [3.5, -0.5], [3.6, 1], [desde, 1], [desde + 0.05, 2.5], [desde + 3, 2.5], [desde + 3.05, 1], [14, 1]]);

  it('marca la ventana de 6 s a partir de la transicion a +Gz', () => {
    const g = conMeseta(10);
    const { reducida, enAirtimeLargo } = ventanasMasGzReducido(g, t);
    const transicion = g.findIndex((v, i) => i > 0 && v >= G_MIN_EVALUABLE);
    expect(enAirtimeLargo[1000]).toBe(true);
    expect(reducida[transicion]).toBe(true);
    expect(reducida[transicion - 1]).toBe(false);
    expect(t[reducida.lastIndexOf(true)]! - t[transicion]!).toBeCloseTo(6, 2);
  });

  it('una meseta de 2.5 G por 3 s dentro de la ventana falla (MasGzReducido da 2 G) y fuera pasa (MasGzTodas da 4 G)', () => {
    const adentro = conMeseta(4);
    const ventanaAdentro = ventanasMasGzReducido(adentro, t).reducida;
    const eAdentro = PeorEventoSostenido(adentro, t, todo(adentro), 'MasGzTodas', 1, ventanaAdentro);
    expect(eAdentro.Curva).toBe('MasGzReducido');
    expect(eAdentro.Exceso).toBeGreaterThan(0);

    const afuera = conMeseta(10);
    const ventanaAfuera = ventanasMasGzReducido(afuera, t).reducida;
    const eAfuera = PeorEventoSostenido(afuera, t, [Math.round(9.9 / PASO), afuera.length - 1], 'MasGzTodas', 1, ventanaAfuera);
    expect(eAfuera.Exceso).toBeLessThan(0);
  });

  it('un -Gz de 3 s o menos no reduce nada', () => {
    const g = senal(t, [[0, -0.5], [2.9, -0.5], [3.0, 1], [14, 1]]);
    expect(ventanasMasGzReducido(g, t).reducida.some(Boolean)).toBe(false);
  });
});
