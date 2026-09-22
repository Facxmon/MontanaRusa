// El veredicto no calcula fisica: elige que mirar primero de lo que ya trae
// el JSON del contrato. Se verifica contra los golden.

import { describe, expect, it } from 'vitest';
import { veredictoDelLayout } from '../src/contrato/veredicto';
import { cargarGolden } from './arnes';

const circuito = cargarGolden('circuito-demolayout');
const loop = cargarGolden('loop-clotoide');

describe('veredictoDelLayout', () => {
  it('el pasa / no pasa es el del contrato', () => {
    for (const layout of [circuito, loop]) {
      expect(veredictoDelLayout(layout).pasa).toBe(layout.resumenLayout.todosLosCriteriosPasan);
    }
  });

  it('cuenta los criterios evaluables y los que no pasan, sin los informativos', () => {
    const v = veredictoDelLayout(circuito);
    const todos = circuito.elementos.flatMap((e) => [...e.criterios.previos, ...e.criterios.posteriores]).filter((c) => c.sentido !== 'Informativo');
    expect(v.criteriosEvaluados).toBe(todos.length);
    expect(v.criteriosQueNoPasan).toBe(todos.filter((c) => !c.pasa).length);
    expect(v.pasa).toBe(v.criteriosQueNoPasan === 0);
  });

  it('los numeros de G son los de resumenLayout', () => {
    const v = veredictoDelLayout(circuito);
    expect(v.gzMaxima).toBe(circuito.resumenLayout.gzMaximaGlobal);
    expect(v.gzMinima).toBe(circuito.resumenLayout.gzMinimaGlobal);
    expect(v.gyMaximaAbsoluta).toBe(circuito.resumenLayout.gyMaximaAbsolutaGlobal);
  });

  it('la ubicacion del extremo es un nodo que tiene ese valor', () => {
    const v = veredictoDelLayout(circuito);
    const donde = v.dondeGzMaxima!;
    const valor = circuito.elementos[donde.elemento]!.nodos.gz[donde.nodoLocal];
    expect(valor).toBeCloseTo(v.gzMaxima!, 5);
    const gy = v.dondeGyMaxima!;
    expect(Math.abs(circuito.elementos[gy.elemento]!.nodos.gy[gy.nodoLocal] as number)).toBeCloseTo(v.gyMaximaAbsoluta!, 5);
  });

  it('el subtramo y el tiempo acumulado del extremo son coherentes', () => {
    const donde = veredictoDelLayout(circuito).dondeGzMaxima!;
    const elemento = circuito.elementos[donde.elemento]!;
    expect(elemento.subtramos.some((s) => s.nombre === donde.subtramo && donde.nodoLocal >= s.indiceInicio && donde.nodoLocal <= s.indiceFin)).toBe(true);
    const anteriores = circuito.elementos.slice(0, donde.elemento).reduce((s, e) => s + (e.resumen.tiempoDeRecorrido ?? 0), 0);
    expect(donde.tiempo).toBeCloseTo((elemento.nodos.tiempo[donde.nodoLocal] as number) + anteriores, 9);
  });

  it('si algo falla, el criterio peor es uno que falla', () => {
    const v = veredictoDelLayout(circuito);
    if (v.criteriosQueNoPasan > 0) expect(v.peorCriterio?.criterio.pasa).toBe(false);
    else expect(v.peorCriterio?.criterio.pasa).toBe(true);
  });

  it('entre dos que fallan gana el de margen relativo mas negativo', () => {
    const v = veredictoDelLayout(circuito);
    const peor = v.peorCriterio!;
    const fallan = circuito.elementos.flatMap((e) => [...e.criterios.previos, ...e.criterios.posteriores]).filter((c) => c.sentido !== 'Informativo' && !c.pasa);
    for (const c of fallan) {
      const limite = typeof c.limite === 'number' && Number.isFinite(c.limite) && c.limite !== 0 ? Math.abs(c.limite) : 1;
      const peso = (c.margen ?? Infinity) / limite;
      if (Number.isFinite(peso)) expect(peor.peso).toBeLessThanOrEqual(peso + 1e-12);
    }
  });

  it('los golden de MATLAB no traen inertes (los emite solo el port)', () => {
    expect(veredictoDelLayout(circuito).inertes).toEqual([]);
  });
});
