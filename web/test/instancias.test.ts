// Parametros por instancia (fase 1): dos helices distintas en la misma
// secuencia, los campos ajustes/inertes del contrato, y la reduccion a
// MATLAB: con ajustes vacios en todas las instancias, calcularLayout da
// el mismo layout que el arnes de golden-port.test.ts, dentro de la misma
// tolerancia contra el golden.

import { describe, expect, it } from 'vitest';
import { disenoDesdeLayout } from '../src/contrato/disenoDesdeLayout';
import { calcularLayout, instanciasDesdeTipos, type EntradaDeDiseno } from '../src/nucleo/calcular';
import { AjustarParametros, ParametrosPorDefecto } from '../src/nucleo/parametros';
import { textoDeInerte } from '../src/paneles/parametros';
import { CASOS, cargarGolden, compararLayouts, reconstruirCaso } from './arnes';

const TOLERANCIA_RELATIVA = 6e-6;
const TOLERANCIA_ABSOLUTA = 1e-9;

/** Paso grueso para que el test sea rapido: la geometria no importa aca, importa que sea distinta. */
function disenoRapido(): EntradaDeDiseno {
  const parametros = ParametrosPorDefecto();
  parametros.PasoGeneracion = 0.01;
  parametros.PasoSimulacion = 0.01;
  return { parametros, posicion: [0, 0, 1], tangente: [1, 0, 0], arriba: [0, 0, 1], velocidad: 5, secuencia: [] };
}

describe('dos helices distintas en la misma secuencia', () => {
  const d = disenoRapido();
  d.secuencia = [
    { id: 'e1', tipo: 'Helice', ajustes: { RadioDeLaHelice: 0.5 } },
    { id: 'e2', tipo: 'Helice', ajustes: {} },
  ];
  const layout = calcularLayout(d, 'test');

  it('cada elemento usa su radio y la geometria es distinta', () => {
    const [a, b] = layout.elementos;
    expect(a!.parametrosUsados.radioDeLaHelice).toBe(0.5);
    expect(b!.parametrosUsados.radioDeLaHelice).toBe(0.7);
    expect(a!.resumen.radioMinimo).not.toBeCloseTo(b!.resumen.radioMinimo!, 3);
    expect(a!.nodos.numeroDeNodos).not.toBe(b!.nodos.numeroDeNodos);
  });

  it('el contrato lleva ajustes solo en la instancia que piso algo, y version 1.1.0', () => {
    expect(layout.meta.versionContrato).toBe('1.1.0');
    expect(layout.elementos[0]!.ajustes).toEqual({ radioDeLaHelice: 0.5 });
    expect(layout.elementos[0]!.inertes).toBeUndefined();
    expect(layout.elementos[1]!.ajustes).toBeUndefined();
    expect(layout.elementos[1]!.inertes).toBeUndefined();
  });

  it('disenoDesdeLayout recupera los ajustes del layout exportado', () => {
    const vuelta = disenoDesdeLayout(layout);
    expect(vuelta.secuencia).toEqual(d.secuencia);
    expect(vuelta.parametros).toEqual(d.parametros);
  });
});

describe('inertes', () => {
  it('un ajuste que el tipo no consume llega al contrato como inerte', () => {
    const d = disenoRapido();
    d.secuencia = [{ id: 'e1', tipo: 'LoopVertical', ajustes: { RadioDeLaHelice: 0.5, FuerzaGObjetivo: 2.5 } }];
    const layout = calcularLayout(d, 'test');
    expect(layout.elementos[0]!.ajustes).toEqual({ radioDeLaHelice: 0.5, fuerzaGObjetivo: 2.5 });
    expect(layout.elementos[0]!.inertes).toEqual(['radioDeLaHelice', 'fuerzaGObjetivo']);
    // Leido de vuelta, el panel los detecta con la misma funcion y arma el texto concreto.
    const { Inertes } = AjustarParametros(d.parametros, d.secuencia[0]!.ajustes, 'LoopVertical');
    expect(Inertes.map((n) => textoDeInerte(n, d.parametros.ModoCurvatura, 'LoopVertical'))).toEqual([
      'ajustaste RadioDeLaHelice pero el elemento LoopVertical no lo consume',
      'ajustaste FuerzaGObjetivo pero el modo Clotoide no lo consume',
    ]);
  });

  it('SeparacionDePatas: gana el ajuste si viene, si no el derivado', () => {
    const d = disenoRapido();
    d.secuencia = [
      { id: 'e1', tipo: 'LoopVertical', ajustes: { SeparacionDePatas: 0.25 } },
      { id: 'e2', tipo: 'LoopVertical', ajustes: {} },
    ];
    const layout = calcularLayout(d, 'test');
    expect(layout.elementos[0]!.parametrosUsados.separacionDePatas).toBe(0.25);
    expect(layout.elementos[1]!.parametrosUsados.separacionDePatas).toBe(ParametrosPorDefecto().SeparacionDePatas);
  });

  it('un ajuste con nombre inexistente es un error claro', () => {
    const d = disenoRapido();
    d.secuencia = [{ id: 'e1', tipo: 'Helice', ajustes: { RadioHelice: 0.5 } as never }];
    expect(() => calcularLayout(d, 'test')).toThrowError(/RadioHelice no existe en ParametrosPorDefecto/);
  });
});

describe('reduccion a MATLAB: con ajustes vacios, calcularLayout es el arnes', () => {
  /** El mismo setup que GenerarGoldenFiles.m / arnes.ts, expresado como EntradaDeDiseno. */
  function entradaDelCaso(caso: string): EntradaDeDiseno {
    if (caso === 'circuito-demolayout') {
      const parametros = ParametrosPorDefecto();
      parametros.ModoCurvatura = 'Clotoide';
      parametros.MetodoDeAcoplamiento = 'A';
      parametros.CalcularVelocidadMinima = false;
      parametros.RadioDelLoop = 0.3;
      parametros.RadioDelGiro = 0.8;
      parametros.RadioDeLaHelice = 0.7;
      parametros.RadioDelDiveLoop = 0.45;
      return { parametros, posicion: [0, 0, 1], tangente: [1, 0, 0], arriba: [0, 0, 1], velocidad: 4.5, secuencia: instanciasDesdeTipos(['LoopVertical', 'OverBankedTurn', 'Helice', 'DiveLoop']) };
    }
    const definicion = CASOS[caso]!;
    let parametros = ParametrosPorDefecto();
    parametros.RadioDelLoop = 0.3;
    parametros.MetodoDeAcoplamiento = 'A';
    parametros.CalcularVelocidadMinima = false;
    parametros.ModoCurvatura = definicion.modo;
    parametros = AjustarParametros(parametros, definicion.ajustes, definicion.elemento).Parametros;
    return { parametros, posicion: [0, 0, 1], tangente: [1, 0, 0], arriba: [0, 0, 1], velocidad: 5, secuencia: instanciasDesdeTipos([definicion.elemento]) };
  }

  for (const caso of [...Object.keys(CASOS), 'circuito-demolayout']) {
    it(caso, () => {
      const port = calcularLayout(entradaDelCaso(caso), 'port');
      const golden = cargarGolden(caso);
      expect(port.elementos.map((e) => e.nodos.numeroDeNodos)).toEqual(golden.elementos.map((e) => e.nodos.numeroDeNodos));
      expect(port.elementos.every((e) => e.ajustes === undefined && e.inertes === undefined)).toBe(true);
      golden.elementos.forEach((eg, i) => {
        const ep = port.elementos[i]!;
        expect(ep.criterios.previos.map((c) => [c.nombre, c.pasa])).toEqual(eg.criterios.previos.map((c) => [c.nombre, c.pasa]));
        expect(ep.criterios.posteriores.map((c) => [c.nombre, c.pasa])).toEqual(eg.criterios.posteriores.map((c) => [c.nombre, c.pasa]));
      });
      const fuera = compararLayouts(golden, port).filter((d) => {
        const escala = Math.max(Math.abs(d.golden ?? 0), Math.abs(d.port ?? 0));
        return !(d.maxAbs <= TOLERANCIA_RELATIVA * escala + TOLERANCIA_ABSOLUTA);
      });
      expect(fuera.map((d) => `${d.campo} en ${d.indice}: golden ${d.golden} port ${d.port}`)).toEqual([]);
    }, 120000);
  }

  it('loop-clotoide: bit a bit igual a lo que reconstruye el arnes (salvo la fecha de generacion)', () => {
    const sinFecha = (l: ReturnType<typeof reconstruirCaso>) => ({ ...l, meta: { ...l.meta, generadoEn: '' } });
    expect(sinFecha(calcularLayout(entradaDelCaso('loop-clotoide'), 'port'))).toEqual(sinFecha(reconstruirCaso('loop-clotoide')));
  });
});
