// Modo de curvatura por instancia (fase 4, despues de la 4.10): una
// instancia puede pisar el modo global en sus ajustes, como un radio. El
// nucleo ya lo admitia; esto verifica que el resultado es el mismo que con
// el modo global, que los inertes se evaluan contra el modo PISADO, que el
// layout exportado lo dice (ajustes.modoCurvatura) y que la serializacion
// lo conserva.

import { describe, expect, it } from 'vitest';
import { modoDelElemento, modoEfectivo, elementosConModoPropio } from '../src/contrato/modo';
import { disenoDesdeLayout } from '../src/contrato/disenoDesdeLayout';
import { calcularLayout, type EntradaDeDiseno } from '../src/nucleo/calcular';
import { AjustarParametros, ParametrosPorDefecto } from '../src/nucleo/parametros';
import { deserializarDiseno, serializarDiseno } from '../src/nucleo/serializar';

function disenoRapido(): EntradaDeDiseno {
  const parametros = ParametrosPorDefecto();
  parametros.PasoGeneracion = 0.01;
  parametros.PasoSimulacion = 0.01;
  parametros.RadioDelLoop = 0.3;
  return { parametros, posicion: [0, 0, 1], tangente: [1, 0, 0], arriba: [0, 0, 1], velocidad: 5, secuencia: [] };
}

describe('modo de curvatura por instancia', () => {
  it('modoEfectivo: el de la instancia si lo pisa, si no el global', () => {
    expect(modoEfectivo({ ModoCurvatura: 'Clotoide' }, {})).toBe('Clotoide');
    expect(modoEfectivo({ ModoCurvatura: 'Clotoide' }, { ModoCurvatura: 'FuerzaGConstante' })).toBe('FuerzaGConstante');
  });

  it('pisar el modo en la instancia da lo mismo que ponerlo global', () => {
    const pisado = disenoRapido();
    pisado.secuencia = [{ id: 'e1', tipo: 'LoopVertical', ajustes: { ModoCurvatura: 'FuerzaGConstante' } }];
    const global = disenoRapido();
    global.parametros.ModoCurvatura = 'FuerzaGConstante';
    global.secuencia = [{ id: 'e1', tipo: 'LoopVertical', ajustes: {} }];
    const a = calcularLayout(pisado, 'test').elementos[0]!;
    const b = calcularLayout(global, 'test').elementos[0]!;
    expect(a.nodos).toEqual(b.nodos);
    expect(a.resumen).toEqual(b.resumen);
    expect(a.criterios).toEqual(b.criterios);
  });

  it('dos modos en el mismo circuito: el layout dice cual uso cada elemento', () => {
    const d = disenoRapido();
    d.secuencia = [
      { id: 'e1', tipo: 'LoopVertical', ajustes: { ModoCurvatura: 'FuerzaGConstante' } },
      { id: 'e2', tipo: 'LoopVertical', ajustes: {} },
    ];
    const layout = calcularLayout(d, 'test');
    expect(layout.parametros.valores.modoCurvatura).toBe('Clotoide');
    expect(layout.elementos[0]!.ajustes).toEqual({ modoCurvatura: 'FuerzaGConstante' });
    expect(modoDelElemento(layout, 0)).toBe('FuerzaGConstante');
    expect(modoDelElemento(layout, 1)).toBe('Clotoide');
    expect(elementosConModoPropio(layout)).toBe(1);
    // G constante deja la Gz del arco casi plana; la clotoide no.
    expect(layout.elementos[0]!.resumen.gzMaxima).not.toBeCloseTo(layout.elementos[1]!.resumen.gzMaxima!, 1);
    // Y la ida y vuelta por el contrato conserva el modo de la instancia.
    const reconstruido = disenoDesdeLayout(layout);
    expect(reconstruido.secuencia[0]!.ajustes.ModoCurvatura).toBe('FuerzaGConstante');
    expect(reconstruido.secuencia[1]!.ajustes.ModoCurvatura).toBeUndefined();
  });

  it('los inertes se evaluan contra el modo pisado', () => {
    const globales = ParametrosPorDefecto(); // Clotoide
    // FuerzaGObjetivo lo consume FuerzaGConstante, no Clotoide.
    expect(AjustarParametros(globales, { FuerzaGObjetivo: 3 }, 'LoopVertical').Inertes).toContain('FuerzaGObjetivo');
    expect(AjustarParametros(globales, { FuerzaGObjetivo: 3, ModoCurvatura: 'FuerzaGConstante' }, 'LoopVertical').Inertes).not.toContain('FuerzaGObjetivo');
  });

  it('la serializacion conserva el modo de cada instancia y rechaza uno inexistente', () => {
    const d = disenoRapido();
    d.secuencia = [{ id: 'e1', tipo: 'Helice', ajustes: { ModoCurvatura: 'GNormativaMaxima' } }];
    const vuelta = deserializarDiseno(JSON.parse(JSON.stringify(serializarDiseno(d))));
    expect(vuelta.secuencia[0]!.ajustes.ModoCurvatura).toBe('GNormativaMaxima');
    const malo = serializarDiseno(d) as unknown as { s: { a: Record<string, unknown> }[] };
    malo.s[0]!.a.ModoCurvatura = 'Parabolico';
    expect(() => deserializarDiseno(malo)).toThrow(/ModoCurvatura/);
  });
});
