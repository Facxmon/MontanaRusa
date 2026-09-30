import { describe, expect, it } from 'vitest';
import { LimitadorDeRefresco, PERIODO_DE_REFRESCO_MS } from '../src/paneles/refresco';

describe('LimitadorDeRefresco', () => {
  it('refresca unas 12 veces por segundo', () => {
    expect(1000 / PERIODO_DE_REFRESCO_MS).toBeCloseTo(12.5, 5);
  });

  it('con cuadros a 60 Hz durante un segundo deja pasar 12 refrescos', () => {
    const limitador = new LimitadorDeRefresco();
    let refrescos = 0;
    for (let cuadro = 0; cuadro < 60; cuadro++) if (limitador.toca(cuadro * (1000 / 60))) refrescos++;
    expect(refrescos).toBe(12);
  });

  it('el primer pedido refresca enseguida, y despues de reiniciar tambien', () => {
    const limitador = new LimitadorDeRefresco(125);
    expect(limitador.toca(1000)).toBe(true);
    expect(limitador.toca(1010)).toBe(false);
    limitador.reiniciar();
    expect(limitador.toca(1020)).toBe(true);
  });
});
