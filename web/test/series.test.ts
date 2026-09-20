import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analizarLayout } from '../src/contrato/cargar';
import { columna, extraerColumnas, figurasDePestana, sinHuecosEnX, PESTANAS } from '../src/graficos/series';

const cargar = (caso: string) =>
  analizarLayout(readFileSync(fileURLToPath(new URL(`../../golden/${caso}.json`, import.meta.url)), 'utf8'));
const circuito = cargar('circuito-demolayout');

const creciente = (xs: (number | null)[]) => xs.every((v, i) => i === 0 || (v !== null && xs[i - 1] !== null && v > xs[i - 1]!));

describe('extraerColumnas', () => {
  it('sobre el layout entero descarta los nodos repetidos y acumula el tiempo', () => {
    const c = extraerColumnas(circuito, null);
    const total = circuito.elementos.reduce((s, e) => s + e.nodos.numeroDeNodos, 0);
    expect(c.cantidad).toBe(total - 3);
    expect(creciente(c.x.arco)).toBe(true);
    expect(creciente(c.x.tiempo)).toBe(true);
    expect(creciente(c.x.tiempoPrototipo)).toBe(true);
    const ultimo = c.x.tiempo[c.cantidad - 1]!;
    expect(ultimo).toBeCloseTo(circuito.resumenLayout.tiempoTotal!, 3);
    expect(c.franjas.arco.map((f) => f.etiqueta)).toEqual(['1. LoopVertical', '2. OverBankedTurn', '3. Helice', '4. DiveLoop']);
  });

  it('sobre un elemento usa todos sus nodos y sus subtramos como franjas', () => {
    const c = extraerColumnas(circuito, 1);
    expect(c.cantidad).toBe(circuito.elementos[1]!.nodos.numeroDeNodos);
    expect(c.x.tiempo[0]).toBe(0);
    expect(c.franjas.arco.map((f) => f.etiqueta)).toEqual(circuito.elementos[1]!.subtramos.map((s) => s.nombre));
  });

  it('el tiempo del prototipo es el del modelo por sqrt(lambda)', () => {
    const c = extraerColumnas(circuito, 0);
    const factor = Math.sqrt(circuito.elementos[0]!.resumen.lambdaLoop!);
    expect(c.x.tiempoPrototipo[100]).toBeCloseTo(c.x.tiempo[100]! * factor, 5); // lambdaLoop y factorTiempo vienen redondeados a 6 cifras
  });

  it('columna respeta los null', () => {
    const conNull = structuredClone(circuito);
    conNull.elementos[2]!.nodos.gz[7] = null;
    const c = extraerColumnas(conNull, 2);
    expect(columna(c, 'gz')[7]).toBeNull();
    expect(columna(c, 'gz')[8]).toBe(circuito.elementos[2]!.nodos.gz[8]);
  });
});

describe('figurasDePestana', () => {
  it('toda figura tiene series del largo de x, sin NaN en x', () => {
    for (const elegido of [null, 0, 3]) {
      const c = extraerColumnas(circuito, elegido);
      for (const ejeX of ['arco', 'tiempo', 'tiempoPrototipo'] as const) {
        for (const { clave } of PESTANAS) {
          for (const figura of figurasDePestana(clave, c, ejeX)) {
            expect(figura.x.length).toBe(c.cantidad);
            expect(figura.x.every((v) => Number.isFinite(v))).toBe(true);
            for (const s of figura.series) expect(s.valores.length, `${clave}/${s.etiqueta}`).toBe(figura.x.length);
          }
        }
      }
    }
  });

  it('en G el limite aplicable de Gz queda dentro de la tabla y por encima del evento largo', () => {
    const c = extraerColumnas(circuito, 0);
    const gz = figurasDePestana('g', c, 'arco')[2]!;
    const aplicable = gz.series.find((s) => s.etiqueta.startsWith('Límite aplicable'))!.valores;
    const largo = gz.series.find((s) => s.etiqueta.startsWith('Admisible'))!.valores;
    const definidos = aplicable.filter((v): v is number => v !== null);
    expect(definidos.length).toBeGreaterThan(0);
    for (const v of definidos) {
      expect(v).toBeGreaterThanOrEqual(largo[0]! - 1e-12);
      expect(v).toBeLessThanOrEqual(6);
    }
  });

  it('el jerk contra tiempo del prototipo va dividido por sqrt(lambda) y contra la norma literal', () => {
    const c = extraerColumnas(circuito, 0);
    const modelo = figurasDePestana('jerk', c, 'arco')[2]!;
    const prototipo = figurasDePestana('jerk', c, 'tiempoPrototipo')[2]!;
    const factor = Math.sqrt(circuito.elementos[0]!.resumen.lambdaLoop!);
    expect(prototipo.series[0]!.valores[500]).toBeCloseTo(modelo.series[0]!.valores[500]! / factor, 4);
    expect(prototipo.series[1]!.valores[0]).toBe(15);
    expect(modelo.series[1]!.valores[0]).toBeCloseTo(15 * factor, 3);
  });

  it('sinHuecosEnX saca los nodos con tiempo null (despues de una parada)', () => {
    const figura = sinHuecosEnX({
      titulo: '',
      etiquetaX: '',
      etiquetaY: '',
      x: [0, 1, null as unknown as number, 3],
      series: [{ etiqueta: 'a', valores: [1, 2, 3, 4], color: 'serie1' }],
      franjas: [],
    });
    expect(figura.x).toEqual([0, 1, 3]);
    expect(figura.series[0]!.valores).toEqual([1, 2, 4]);
  });
});
