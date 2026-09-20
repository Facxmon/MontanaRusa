// La serializacion unica (nucleo/serializar.ts): ida y vuelta exacta para
// los once golden, por objeto y por texto compacto; solo lo que difiere del
// default; errores con el campo y lo esperado en el mensaje.

import { describe, expect, it } from 'vitest';
import { disenoDesdeLayout } from '../src/contrato/disenoDesdeLayout';
import { instanciasDesdeTipos, type EntradaDeDiseno } from '../src/nucleo/calcular';
import { ParametrosPorDefecto } from '../src/nucleo/parametros';
import { aTextoCompacto, desdeTextoCompacto, deserializarDiseno, igualProfundo, serializarDiseno } from '../src/nucleo/serializar';
import { CASOS, cargarGolden } from './arnes';

const TODOS = [...Object.keys(CASOS), 'circuito-demolayout'];

function disenoBase(): EntradaDeDiseno {
  return { parametros: ParametrosPorDefecto(), posicion: [0, 0, 1], tangente: [1, 0, 0], arriba: [0, 0, 1], velocidad: 5, secuencia: instanciasDesdeTipos(['LoopVertical']) };
}

describe('ida y vuelta por objeto', () => {
  for (const caso of TODOS) {
    it(caso, () => {
      const d = disenoDesdeLayout(cargarGolden(caso));
      expect(deserializarDiseno(serializarDiseno(d))).toEqual(d);
    });
  }

  it('conserva los ajustes por instancia y regenera los ids e1..eN', () => {
    const d = disenoBase();
    d.secuencia = [
      { id: 'e1', tipo: 'Helice', ajustes: { RadioDeLaHelice: 0.5, OnsetMaximoModelo: null } },
      { id: 'e7', tipo: 'Helice', ajustes: {} },
      { id: 'e3', tipo: 'DiveLoop', ajustes: { BoundingBoxDisponible: [[-1, 1], [-1, 1], [0, 2]], SentidoDelGiro: 'Izquierda' } },
    ];
    const vuelta = deserializarDiseno(serializarDiseno(d));
    expect(vuelta.secuencia.map((i) => i.id)).toEqual(['e1', 'e2', 'e3']);
    expect(vuelta.secuencia.map((i) => i.ajustes)).toEqual(d.secuencia.map((i) => i.ajustes));
    expect(vuelta.secuencia[2]!.ajustes).not.toBe(d.secuencia[2]!.ajustes); // copia, no referencia
  });
});

describe('ida y vuelta por texto compacto', () => {
  for (const caso of TODOS) {
    it(caso, () => {
      const d = disenoDesdeLayout(cargarGolden(caso));
      const texto = aTextoCompacto(serializarDiseno(d));
      expect(texto).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(deserializarDiseno(desdeTextoCompacto(texto))).toEqual(d);
    });
  }
});

describe('solo lo que difiere del default', () => {
  it('un diseno con los defaults serializa p vacio', () => {
    expect(serializarDiseno(disenoBase()).p).toEqual({});
  });

  it('el circuito de demo pesa menos de 5 kB (criterio de aceptacion) y solo lleva RadioDelLoop', () => {
    const s = serializarDiseno(disenoDesdeLayout(cargarGolden('circuito-demolayout')));
    expect(s.p).toEqual({ RadioDelLoop: 0.3 });
    const bytes = new TextEncoder().encode(JSON.stringify(s)).length;
    expect(bytes).toBeLessThan(5 * 1024);
  });

  it('compara vectores, matrices y anulables por valor, no por referencia', () => {
    const d = disenoBase();
    d.parametros.OnsetNormativoPorEje = [5, 5, 15]; // otro array, mismo valor
    d.parametros.BoundingBoxDisponible = [[-2, 2], [-2, 2], [0, 1.5]];
    d.parametros.OnsetMaximoModelo = null;
    expect(serializarDiseno(d).p).toEqual({});
    d.parametros.OnsetNormativoPorEje = [5, 5, 16];
    d.parametros.BoundingBoxDisponible = [[-2, 2], [-2, 2], [0, 1.6]];
    d.parametros.OnsetMaximoModelo = [1, 2, 3];
    d.parametros.InclinacionHelicoidalImpuesta = 0.5;
    d.parametros.ModelarArrastre = false;
    expect(serializarDiseno(d).p).toEqual({
      OnsetNormativoPorEje: [5, 5, 16],
      BoundingBoxDisponible: [[-2, 2], [-2, 2], [0, 1.6]],
      OnsetMaximoModelo: [1, 2, 3],
      InclinacionHelicoidalImpuesta: 0.5,
      ModelarArrastre: false,
    });
    expect(deserializarDiseno(serializarDiseno(d)).parametros).toEqual(d.parametros);
  });

  it('igualProfundo', () => {
    expect(igualProfundo([[1, 2]], [[1, 2]])).toBe(true);
    expect(igualProfundo([[1, 2]], [[1, 3]])).toBe(false);
    expect(igualProfundo(null, null)).toBe(true);
    expect(igualProfundo(null, [])).toBe(false);
    expect(igualProfundo({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
});

describe('deserializarDiseno rechaza con un mensaje que dice que campo y que se esperaba', () => {
  const ei = { pos: [0, 0, 1], tan: [1, 0, 0], arr: [0, 0, 1], vel: 5 };

  it('version desconocida', () => {
    expect(() => deserializarDiseno({ v: 2, p: {}, ei, s: [] })).toThrowError(/v = 2 .* v = 1/);
    expect(() => deserializarDiseno({ p: {}, ei, s: [] })).toThrowError(/v = nada/);
  });

  it('parametro inexistente', () => {
    expect(() => deserializarDiseno({ v: 1, p: { RadioDelLoopp: 0.3 }, ei, s: [] })).toThrowError(/p\.RadioDelLoopp no existe en ParametrosPorDefecto/);
    expect(() => deserializarDiseno({ v: 1, p: {}, ei, s: [{ t: 'Helice', a: { radioDeLaHelice: 0.3 } }] })).toThrowError(/s\[0\]\.a\.radioDeLaHelice no existe/);
  });

  it('tipo de elemento inexistente', () => {
    expect(() => deserializarDiseno({ v: 1, p: {}, ei, s: [{ t: 'Helice', a: {} }, { t: 'Loop', a: {} }] })).toThrowError(/s\[1\]\.t vale "Loop".*LoopVertical, DiveLoop, Helice, OverBankedTurn/);
  });

  it('valor del tipo equivocado', () => {
    expect(() => deserializarDiseno({ v: 1, p: { RadioDelLoop: '0.3' }, ei, s: [] })).toThrowError(/p\.RadioDelLoop vale "0\.3" y se esperaba un numero finito/);
    expect(() => deserializarDiseno({ v: 1, p: { RadioDelLoop: null }, ei, s: [] })).toThrowError(/p\.RadioDelLoop vale null/);
    expect(() => deserializarDiseno({ v: 1, p: { OnsetMaximoModelo: [1, 2] }, ei, s: [] })).toThrowError(/OnsetMaximoModelo vale \[1,2\] y se esperaba un vector de 3 numeros finitos o null/);
    expect(() => deserializarDiseno({ v: 1, p: { SentidoDelGiro: 'Arriba' }, ei, s: [] })).toThrowError(/SentidoDelGiro vale "Arriba" y se esperaba uno de: Derecha, Izquierda/);
    expect(() => deserializarDiseno({ v: 1, p: { ModoCurvatura: 'Lineal' }, ei, s: [] })).toThrowError(/ModoCurvatura .* AceleracionNormalConstante, Clotoide, FuerzaGConstante, GNormativaMaxima/);
    expect(() => deserializarDiseno({ v: 1, p: { BoundingBoxDisponible: [[1, 2], [1, 2]] }, ei, s: [] })).toThrowError(/BoundingBoxDisponible .* matriz 3x2/);
    expect(() => deserializarDiseno({ v: 1, p: { ModelarArrastre: 1 }, ei, s: [] })).toThrowError(/ModelarArrastre vale 1 y se esperaba true o false/);
  });

  it('estado inicial mal formado', () => {
    expect(() => deserializarDiseno({ v: 1, p: {}, ei: { ...ei, pos: [0, 0] }, s: [] })).toThrowError(/ei\.pos vale \[0,0\]/);
    expect(() => deserializarDiseno({ v: 1, p: {}, ei: { ...ei, vel: 'rapido' }, s: [] })).toThrowError(/ei\.vel vale "rapido" y se esperaba un numero finito/);
    expect(() => deserializarDiseno({ v: 1, p: {}, s: [] })).toThrowError(/falta el campo ei/);
  });

  it('texto compacto invalido', () => {
    expect(() => desdeTextoCompacto('abc$')).toThrowError(/base64url/);
    expect(() => desdeTextoCompacto('')).toThrowError(/vacio/);
    expect(() => desdeTextoCompacto('AAAA')).toThrowError(/descomprimir/);
    expect(() => desdeTextoCompacto(aTextoCompacto({ v: 2, p: {}, ei, s: [] } as never))).toThrowError(/v = 2/);
  });
});
