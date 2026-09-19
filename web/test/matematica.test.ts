import { describe, expect, it } from 'vitest';
import referencia from './fixtures/matlab-referencia.json';
import {
  coeficientesPchip,
  colon,
  cummax,
  gradiente,
  interp1Lineal,
  interp1Pchip,
  interpolantePchip,
  modulo,
  sprintfE,
  sprintfF,
  sprintfG,
  unico,
} from '../src/nucleo/matematica';

const cerca = (a: ArrayLike<number>, b: ArrayLike<number>, digitos = 12) => {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) expect(a[i], `indice ${i}`).toBeCloseTo(b[i]!, digitos);
};

describe('primitivas contra valores generados por MATLAB', () => {
  it('gradient con coordenadas', () => {
    cerca(gradiente(referencia.gradiente.y, referencia.gradiente.x), referencia.gradiente.dy);
  });

  it('interp1 lineal con extrapolacion y con valor de relleno', () => {
    const { x, y, xq, lineal, linealRelleno } = referencia.interp1;
    cerca(xq.map((q) => interp1Lineal(x, y, q, 'extrap')), lineal);
    cerca(xq.map((q) => interp1Lineal(x, y, q, -99)), linealRelleno);
  });

  it('pchip: coeficientes, ppval e interp1 pchip', () => {
    const { x, y, coefs, xq, yq, interp1: viaInterp1 } = referencia.pchip;
    const mios = coeficientesPchip(x, y);
    coefs.forEach((fila, i) => cerca(mios[i]!, fila));
    cerca(xq.map((q) => interp1Pchip(x, y, q)), yq);
    cerca(xq.map((q) => interp1Pchip(x, y, q)), viaInterp1);
  });

  it('pchip con dos puntos es lineal', () => {
    cerca(coeficientesPchip([1, 3], [2, 8])[0]!, referencia.pchip.dosPuntos.coefs);
    cerca([1, 2, 3].map((q) => interp1Pchip([1, 3], [2, 8], q)), referencia.pchip.dosPuntos.yq);
  });

  it('pchip monotono: pendientes con signos mezclados', () => {
    const { x, y, coefs } = referencia.pchip.monotono;
    const mios = coeficientesPchip(x, y);
    coefs.forEach((fila, i) => cerca(mios[i]!, fila));
  });

  it('griddedInterpolant pchip extrapola con la secante del segmento extremo', () => {
    const f = interpolantePchip(referencia.pchip.x, referencia.pchip.y);
    cerca(referencia.pchip.griddedFueraDeRango.xq.map(f), referencia.pchip.griddedFueraDeRango.yq);
    cerca(referencia.pchip.xq.map(f), referencia.pchip.yq);
  });

  it('operador dos puntos', () => {
    const a = colon(0, 0.002, 40);
    expect(a.length).toBe(referencia.colon.a.n);
    expect(a[a.length - 1]).toBe(referencia.colon.a.ultimo);
    expect(a[10000]).toBeCloseTo(referencia.colon.a.medio, 12);
    const b = colon(0.123, 0.0173, 2.5);
    expect(b.length).toBe(referencia.colon.b.n);
    expect(b[b.length - 1]).toBeCloseTo(referencia.colon.b.ultimo, 12);
    const c = colon(1.5, 0.1, 2.0);
    cerca(c, referencia.colon.c.valores);
  });

  it('mod con el signo del divisor', () => {
    expect(modulo(-4 + Math.PI, 2 * Math.PI) - Math.PI).toBeCloseTo(referencia.mod.a, 14);
    expect(modulo(7.5 + Math.PI, 2 * Math.PI) - Math.PI).toBeCloseTo(referencia.mod.b, 14);
    expect(modulo(-0, 2 * Math.PI)).toBe(0);
  });

  it('cummax y unique first/last (indices a base 0)', () => {
    cerca(cummax(referencia.unico.g), referencia.unico.cummax);
    const primero = unico(cummax(referencia.unico.g), 'first');
    expect(primero.valores).toEqual(referencia.unico.valoresPrimero);
    expect(primero.indices).toEqual(referencia.unico.indicePrimero.map((i) => i - 1));
    const ultimo = unico(cummax(referencia.unico.g), 'last');
    expect(ultimo.indices).toEqual(referencia.unico.indiceUltimo.map((i) => i - 1));
  });

  it('sprintf %g, %f y %e como C', () => {
    expect([0.30000000000000004, 123456.7, 0.0001234567, 2, 1e-7, 12345].map((v) => sprintfG(v, 4))).toEqual(referencia.sprintf.g4);
    expect([0.125, 2.675, -0.005].map((v) => sprintfF(v, 2))).toEqual(referencia.sprintf.f2);
    expect([sprintfE(0.000123456, 2), sprintfE(12345.678, 3)]).toEqual(referencia.sprintf.e2);
    expect([0.5, 1.5, 2.5].map((v) => sprintfF(v, 0))).toEqual(referencia.sprintf.f0);
  });
});
