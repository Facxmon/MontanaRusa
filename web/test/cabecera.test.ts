import { describe, expect, it } from 'vitest';
import { estadoDePildora } from '../src/paneles/cabecera';
import type { EntradaDeDiseno } from '../src/nucleo/calcular';

const diseno = {} as EntradaDeDiseno;
const otro = {} as EntradaDeDiseno;

describe('pildora de estado de la cabecera', () => {
  it('golden, propio, pendiente, calculando y cargando', () => {
    const base = { fuente: 'golden' as const, diseno: null, disenoCalculado: null, calculando: false, cargando: false };
    expect(estadoDePildora(base)).toBe('golden');
    expect(estadoDePildora({ ...base, cargando: true })).toBe('cargando');
    expect(estadoDePildora({ ...base, fuente: 'diseno', diseno, disenoCalculado: diseno })).toBe('propio');
    expect(estadoDePildora({ ...base, fuente: 'diseno', diseno: otro, disenoCalculado: diseno })).toBe('pendiente');
    // Calcular le gana a todo: es lo que esta pasando ahora.
    expect(estadoDePildora({ ...base, fuente: 'diseno', diseno: otro, disenoCalculado: diseno, calculando: true })).toBe('calculando');
  });
});
