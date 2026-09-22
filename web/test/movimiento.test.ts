import { describe, expect, it } from 'vitest';
import { curvaCubica, milisegundos } from '../src/tema';

describe('tokens de movimiento leidos desde JS', () => {
  it('milisegundos de un token de duracion', () => {
    expect(milisegundos('400ms')).toBe(400);
    expect(milisegundos(' 0.2s')).toBe(200);
  });

  it('cubic-bezier como el de CSS: extremos, monotona y desacelerada', () => {
    const f = curvaCubica('cubic-bezier(0.2, 0, 0, 1)');
    expect(f(0)).toBe(0);
    expect(f(1)).toBe(1);
    let previo = 0;
    for (let t = 0.05; t < 1; t += 0.05) {
      const v = f(t);
      expect(v).toBeGreaterThanOrEqual(previo);
      previo = v;
    }
    // Desacelerada: a mitad de tiempo ya recorrio bastante mas de la mitad.
    expect(f(0.5)).toBeGreaterThan(0.75);
    // La lineal es la identidad; algo que no es cubic-bezier cae a lineal.
    expect(curvaCubica('cubic-bezier(0, 0, 1, 1)')(0.3)).toBeCloseTo(0.3, 5);
    expect(curvaCubica('ease')(0.3)).toBe(0.3);
  });
});
