// Deshacer / rehacer (historial.ts): pilas con tope, coalescencia por campo
// dentro de la ventana, etiquetas de que se deshace, y que nunca se guarda
// otra cosa que el diseno.

import { describe, expect, it } from 'vitest';
import { describirCambio, Historial, TOPE_DE_ENTRADAS } from '../src/historial';
import { instanciasDesdeTipos, type EntradaDeDiseno } from '../src/nucleo/calcular';
import { ParametrosPorDefecto } from '../src/nucleo/parametros';

function base(): EntradaDeDiseno {
  return { parametros: ParametrosPorDefecto(), posicion: [0, 0, 1], tangente: [1, 0, 0], arriba: [0, 0, 1], velocidad: 5, secuencia: instanciasDesdeTipos(['LoopVertical', 'Helice']) };
}

function conGlobal(d: EntradaDeDiseno, nombre: 'RadioDelLoop' | 'RadioDelGiro', valor: number): EntradaDeDiseno {
  return { ...d, parametros: { ...d.parametros, [nombre]: valor } };
}

function conAjuste(d: EntradaDeDiseno, id: string, ajustes: EntradaDeDiseno['secuencia'][number]['ajustes']): EntradaDeDiseno {
  return { ...d, secuencia: d.secuencia.map((i) => (i.id === id ? { ...i, ajustes } : i)) };
}

describe('describirCambio', () => {
  const d = base();

  it('un global: campo global:Nombre y etiqueta en camelCase', () => {
    expect(describirCambio(d, conGlobal(d, 'RadioDelLoop', 0.4))).toEqual({ campo: 'global:RadioDelLoop', etiqueta: 'radioDelLoop (global)', instancia: null });
  });

  it('un ajuste de una instancia: campo id:Nombre, etiqueta con el numero y el tipo, instancia para volver a elegirla', () => {
    expect(describirCambio(d, conAjuste(d, 'e2', { RadioDeLaHelice: 0.5 }))).toEqual({ campo: 'e2:RadioDeLaHelice', etiqueta: 'radioDeLaHelice de 2. Helice', instancia: 'e2' });
    const pisada = conAjuste(d, 'e2', { RadioDeLaHelice: 0.5 });
    expect(describirCambio(pisada, d).etiqueta).toBe('radioDeLaHelice de 2. Helice (vuelve al global)');
  });

  it('estado inicial', () => {
    expect(describirCambio(d, { ...d, velocidad: 6 })).toEqual({ campo: 'ei:velocidad', etiqueta: 'velocidad inicial', instancia: null });
    expect(describirCambio(d, { ...d, posicion: [1, 0, 1] }).campo).toBe('ei:posicion');
  });

  it('secuencia: agregar, quitar, mover, cambiar el tipo (sin campo: no se coalescen)', () => {
    const agregada = { ...d, secuencia: [...d.secuencia, { id: 'e3', tipo: 'DiveLoop' as const, ajustes: {} }] };
    expect(describirCambio(d, agregada)).toEqual({ campo: null, etiqueta: 'agregar 3. DiveLoop', instancia: 'e3' });
    expect(describirCambio(agregada, d)).toEqual({ campo: null, etiqueta: 'quitar 3. DiveLoop', instancia: null });
    const movida = { ...d, secuencia: [d.secuencia[1]!, d.secuencia[0]!] };
    expect(describirCambio(d, movida).etiqueta).toBe('mover 1. Helice');
    const otroTipo = { ...d, secuencia: [d.secuencia[0]!, { ...d.secuencia[1]!, tipo: 'DiveLoop' as const }] };
    expect(describirCambio(d, otroTipo)).toEqual({ campo: 'e2:tipo', etiqueta: 'tipo de 2: Helice → DiveLoop', instancia: 'e2' });
  });

  it('varios globales a la vez (reset) y varios cambios de distinta clase', () => {
    expect(describirCambio(d, conGlobal(conGlobal(d, 'RadioDelLoop', 0.4), 'RadioDelGiro', 0.9)).etiqueta).toBe('parámetros globales (2)');
    const mixto = describirCambio(d, { ...conGlobal(d, 'RadioDelLoop', 0.4), velocidad: 6 });
    expect(mixto.campo).toBeNull();
    expect(mixto.etiqueta).toMatch(/^varios cambios/);
    expect(describirCambio(d, { ...d }).etiqueta).toBe('sin cambios');
  });
});

describe('Historial', () => {
  it('deshacer devuelve el diseno anterior y rehacer el posterior; los botones saben que hay', () => {
    const h = new Historial();
    const d0 = base();
    const d1 = conGlobal(d0, 'RadioDelLoop', 0.4);
    expect(h.puedeDeshacer).toBe(false);
    h.registrar(d0, d1, 1000);
    expect(h.puedeDeshacer).toBe(true);
    expect(h.etiquetaDeDeshacer).toBe('radioDelLoop (global)');
    expect(h.etiquetaDeRehacer).toBeNull();
    const atras = h.deshacer(d1);
    expect(atras?.diseno).toBe(d0);
    expect(h.puedeDeshacer).toBe(false);
    expect(h.etiquetaDeRehacer).toBe('radioDelLoop (global)');
    const adelante = h.rehacer(d0);
    expect(adelante?.diseno).toBe(d1);
    expect(h.puedeRehacer).toBe(false);
    expect(h.deshacer(d1)?.diseno).toBe(d0);
  });

  it('coalesce ediciones consecutivas al mismo campo dentro de 500 ms: tipear 0.75 en cuatro pasos es un solo deshacer', () => {
    const h = new Historial();
    const d0 = base();
    let actual = d0;
    let t = 1000;
    for (const valor of [0, 0.7, 0.75, 0.751]) {
      const siguiente = conGlobal(actual, 'RadioDelLoop', valor);
      h.registrar(actual, siguiente, (t += 100));
      actual = siguiente;
    }
    expect(h.largo.pasado).toBe(1);
    expect(h.deshacer(actual)?.diseno).toBe(d0);
  });

  it('no coalesce si paso la ventana, si es otro campo, o si el cambio no es de un solo campo', () => {
    const h = new Historial();
    const d0 = base();
    const d1 = conGlobal(d0, 'RadioDelLoop', 0.4);
    const d2 = conGlobal(d1, 'RadioDelLoop', 0.5);
    const d3 = conGlobal(d2, 'RadioDelGiro', 0.9);
    const d4 = conAjuste(d3, 'e2', { RadioDeLaHelice: 0.5 });
    const d5 = conAjuste(d4, 'e2', { RadioDeLaHelice: 0.6 });
    h.registrar(d0, d1, 1000);
    h.registrar(d1, d2, 1600); // 600 ms despues: entrada nueva
    h.registrar(d2, d3, 1700); // otro campo
    h.registrar(d3, d4, 1800); // ajuste de instancia
    h.registrar(d4, d5, 1900); // mismo ajuste, se funde
    expect(h.largo.pasado).toBe(4);
    const agregada = { ...d5, secuencia: [...d5.secuencia, { id: 'e3', tipo: 'DiveLoop' as const, ajustes: {} }] };
    const agregada2 = { ...agregada, secuencia: [...agregada.secuencia, { id: 'e4', tipo: 'DiveLoop' as const, ajustes: {} }] };
    h.registrar(d5, agregada, 1950);
    h.registrar(agregada, agregada2, 1960);
    expect(h.largo.pasado).toBe(6);
  });

  it('una edicion nueva vacia el futuro', () => {
    const h = new Historial();
    const d0 = base();
    const d1 = conGlobal(d0, 'RadioDelLoop', 0.4);
    h.registrar(d0, d1, 1000);
    h.deshacer(d1);
    expect(h.puedeRehacer).toBe(true);
    h.registrar(d0, conGlobal(d0, 'RadioDelGiro', 0.9), 5000);
    expect(h.puedeRehacer).toBe(false);
  });

  it('tope de 50 entradas: se descartan las mas viejas', () => {
    const h = new Historial();
    let actual = base();
    for (let i = 0; i < TOPE_DE_ENTRADAS + 10; i++) {
      const siguiente = conGlobal(actual, 'RadioDelLoop', 0.3 + i * 0.001);
      h.registrar(actual, siguiente, i * 1000);
      actual = siguiente;
    }
    expect(h.largo.pasado).toBe(TOPE_DE_ENTRADAS);
  });

  it('las entradas son referencias al diseno, sin layout ni copia', () => {
    const h = new Historial();
    const d0 = base();
    const d1 = conGlobal(d0, 'RadioDelLoop', 0.4);
    h.registrar(d0, d1, 1000);
    const entrada = h.deshacer(d1)!;
    expect(entrada.diseno).toBe(d0);
    expect(Object.keys(entrada).sort()).toEqual(['campo', 'diseno', 'etiqueta', 'instancia', 'instante']);
  });
});
