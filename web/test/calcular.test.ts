import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analizarLayout } from '../src/contrato/cargar';
import { parametrosDesdeContrato } from '../src/contrato/parametrosDesdeContrato';
import { calcularLayout } from '../src/nucleo/calcular';
import { textoDelLayout } from '../src/nucleo/descargar';
import { ParametrosPorDefecto } from '../src/nucleo/parametros';

const golden = analizarLayout(readFileSync(fileURLToPath(new URL('../../golden/loop-clotoide.json', import.meta.url)), 'utf8'));

describe('parametrosDesdeContrato', () => {
  it('recupera los Parametros del nucleo desde parametros.valores (los vacios vuelven a null)', () => {
    const p = parametrosDesdeContrato(golden.parametros.valores as Record<string, unknown>);
    expect(p.RadioDelLoop).toBe(0.3);
    expect(p.ModoCurvatura).toBe('Clotoide');
    expect(p.OnsetMaximoModelo).toBeNull();
    expect(p.InclinacionHelicoidalImpuesta).toBeNull();
    expect(p.BoundingBoxDisponible).toEqual(ParametrosPorDefecto().BoundingBoxDisponible);
    expect(p.ModelarArrastre).toBe(true);
  });
});

describe('calcularLayout', () => {
  it('calcula un diseno de dos elementos con paso grueso y exporta al contrato', () => {
    const parametros = ParametrosPorDefecto();
    parametros.RadioDelLoop = 0.3;
    parametros.PasoGeneracion = 0.01;
    parametros.PasoSimulacion = 0.01;
    const layout = calcularLayout(
      { parametros, posicion: [0, 0, 1], tangente: [1, 0, 0], arriba: [0, 0, 1], velocidad: 5, secuencia: ['LoopVertical', 'OverBankedTurn'] },
      'test',
    );
    expect(layout.meta.generadoPor).toBe('js');
    expect(layout.elementos).toHaveLength(2);
    expect(layout.elementos[1]!.tipo).toBe('OverBankedTurn');
    expect(layout.elementos[1]!.nodos.arco[0]).toBeCloseTo(layout.elementos[0]!.nodos.arco.at(-1)!, 9);
    expect(layout.resumenLayout.numeroDeElementos).toBe(2);
    const texto = textoDelLayout(layout);
    expect(JSON.parse(texto).elementos[0].nodos.numeroDeNodos).toBe(layout.elementos[0]!.nodos.numeroDeNodos);
    expect(texto).not.toContain('NaN');
  });

  it('una secuencia vacia es un error claro', () => {
    expect(() =>
      calcularLayout({ parametros: ParametrosPorDefecto(), posicion: [0, 0, 1], tangente: [1, 0, 0], arriba: [0, 0, 1], velocidad: 5, secuencia: [] }),
    ).toThrowError(/secuencia/);
  });
});
