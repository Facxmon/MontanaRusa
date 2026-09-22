// El diseno en localStorage (paneles/persistencia.ts): guardar con debounce,
// restaurar, descartar, y que nada rompa si el almacenamiento no esta o lo
// guardado quedo ilegible. El entorno de los tests es Node: se pone un
// localStorage de mentira, como el que tiene el navegador.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { instanciasDesdeTipos, type EntradaDeDiseno } from '../src/nucleo/calcular';
import { ParametrosPorDefecto } from '../src/nucleo/parametros';
import { guardadorDeDiseno, guardarDiseno, haceCuanto, olvidarDiseno, restaurarDiseno } from '../src/paneles/persistencia';

function almacenDeMentira(): Storage & { fallar?: boolean } {
  const datos = new Map<string, string>();
  return {
    get length() { return datos.size; },
    clear: () => datos.clear(),
    key: (i: number) => [...datos.keys()][i] ?? null,
    getItem(clave) { if ((this as { fallar?: boolean }).fallar) throw new Error('bloqueado'); return datos.get(clave) ?? null; },
    setItem(clave, valor) { if ((this as { fallar?: boolean }).fallar) throw new Error('lleno'); datos.set(clave, valor); },
    removeItem: (clave) => void datos.delete(clave),
  } as Storage & { fallar?: boolean };
}

function diseno(velocidad = 5): EntradaDeDiseno {
  return { parametros: { ...ParametrosPorDefecto(), RadioDelLoop: 0.3 }, posicion: [0, 0, 1], tangente: [1, 0, 0], arriba: [0, 0, 1], velocidad, secuencia: instanciasDesdeTipos(['LoopVertical', 'Helice']) };
}

let almacen: Storage & { fallar?: boolean };

beforeEach(() => {
  almacen = almacenDeMentira();
  vi.stubGlobal('localStorage', almacen);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('guardar y restaurar', () => {
  it('vuelve el mismo diseno, con su origen y su fecha', () => {
    guardarDiseno(diseno(4.5), 'circuito-demolayout');
    const restaurado = restaurarDiseno()!;
    expect(restaurado.diseno).toEqual(diseno(4.5));
    expect(restaurado.origen).toBe('circuito-demolayout');
    expect(restaurado.fecha).toBeInstanceOf(Date);
  });

  it('guarda el diseno serializado, del orden de 1 kB, y nunca el layout', () => {
    guardarDiseno(diseno(), null);
    const texto = almacen.getItem('montanarusa.diseno')!;
    expect(texto.length).toBeLessThan(2000);
    expect(texto).not.toContain('nodos');
    expect(JSON.parse(texto).d.v).toBe(1);
  });

  it('sin nada guardado devuelve null, y descartar lo borra', () => {
    expect(restaurarDiseno()).toBeNull();
    guardarDiseno(diseno(), null);
    expect(restaurarDiseno()).not.toBeNull();
    olvidarDiseno();
    expect(restaurarDiseno()).toBeNull();
  });

  it('lo guardado por una version vieja (ilegible) se descarta sin romper', () => {
    almacen.setItem('montanarusa.diseno', JSON.stringify({ d: { v: 99 }, origen: null, fecha: '' }));
    expect(restaurarDiseno()).toBeNull();
    expect(almacen.getItem('montanarusa.diseno')).toBeNull();
    almacen.setItem('montanarusa.diseno', 'no es json');
    expect(restaurarDiseno()).toBeNull();
  });

  it('si el almacenamiento tira (ventana privada, lleno), no rompe la sesion', () => {
    almacen.fallar = true;
    expect(() => guardarDiseno(diseno(), null)).not.toThrow();
    expect(restaurarDiseno()).toBeNull();
  });
});

describe('guardadorDeDiseno (debounce)', () => {
  it('guarda una sola vez despues de la espera, con el ultimo valor', () => {
    vi.useFakeTimers();
    const guardador = guardadorDeDiseno(1000);
    guardador.guardar(diseno(5), null);
    guardador.guardar(diseno(6), null);
    vi.advanceTimersByTime(900);
    expect(restaurarDiseno()).toBeNull();
    guardador.guardar(diseno(7), 'link');
    vi.advanceTimersByTime(1000);
    const restaurado = restaurarDiseno()!;
    expect(restaurado.diseno.velocidad).toBe(7);
    expect(restaurado.origen).toBe('link');
  });

  it('cancelar no guarda nada (destruir el visualizador)', () => {
    vi.useFakeTimers();
    const guardador = guardadorDeDiseno(1000);
    guardador.guardar(diseno(), null);
    guardador.cancelar();
    vi.advanceTimersByTime(5000);
    expect(restaurarDiseno()).toBeNull();
  });
});

describe('haceCuanto', () => {
  const ahora = new Date('2026-09-20T12:00:00');
  it('describe el hueco en minutos, horas o fecha', () => {
    expect(haceCuanto(new Date('2026-09-20T11:59:50'), ahora)).toBe(' (de recién)');
    expect(haceCuanto(new Date('2026-09-20T11:57:00'), ahora)).toBe(' (de hace 3 minutos)');
    expect(haceCuanto(new Date('2026-09-20T11:00:00'), ahora)).toBe(' (de hace 1 hora)');
    expect(haceCuanto(new Date('2026-09-18T22:10:00'), ahora)).toBe(' (del 18/9 a las 22:10)');
    expect(haceCuanto(null, ahora)).toBe('');
  });
});
