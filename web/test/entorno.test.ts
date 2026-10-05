import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analizarLayout } from '../src/contrato/cargar';
import { cabe, extremosDeGrilla, marcasDelEjeZ, pasoDeGraduacion, rotuloDeAltura, rotuloDeMetros } from '../src/escena/entorno';

const cargar = (caso: string) =>
  analizarLayout(readFileSync(fileURLToPath(new URL(`../../golden/${caso}.json`, import.meta.url)), 'utf8'));

describe('entorno de la escena (piso, caja disponible)', () => {
  it('la grilla cubre las cajas y se redondea a 0,5 m hacia afuera', () => {
    // Un borde que cae justo sobre una linea mayor igual deja medio metro de margen.
    expect(extremosDeGrilla([[[0, 1.01], [-0.16, 0], [0, 1]]])).toEqual({ x: [-0.5, 1.5], y: [-0.5, 0.5] });
    expect(extremosDeGrilla([[[0.2, 1.01], [-0.16, 0.3], [0, 1]]])).toEqual({ x: [0, 1.5], y: [-0.5, 0.5] });
    expect(extremosDeGrilla([])).toEqual({ x: [-2, 2], y: [-2, 2] });
  });

  it('rotulos con coma decimal y sin -0', () => {
    expect(rotuloDeMetros(0.5)).toBe('0,5 m');
    expect(rotuloDeMetros(-1)).toBe('-1 m');
    expect(rotuloDeMetros(-0)).toBe('0 m');
  });

  it('la caja se pinta como falla exactamente cuando el criterio del JSON falla', () => {
    for (const caso of ['loop-normativa', 'circuito-demolayout', 'helice-arcocircular']) {
      const layout = cargar(caso);
      const disponible = layout.parametros.valores.boundingBoxDisponible as [[number, number], [number, number], [number, number]];
      const criterios = layout.elementos.flatMap((e) => [...e.criterios.previos, ...e.criterios.posteriores]).filter((c) => /bounding box/i.test(c.nombre));
      const pasanTodos = criterios.every((c) => c.pasa);
      expect(cabe(layout.resumenLayout.boundingBox, disponible), caso).toBe(pasanTodos);
    }
  });
});

describe('eje z graduado', () => {
  it('el paso es redondo (1, 2, 2,5, 5 x 10^n) y deja entre 5 y 10 marcas', () => {
    expect(pasoDeGraduacion(1.5)).toBe(0.5);
    expect(pasoDeGraduacion(1)).toBe(0.2);
    expect(pasoDeGraduacion(0.12)).toBeCloseTo(0.025, 12);
    expect(pasoDeGraduacion(40)).toBe(10);
    for (const alto of [0.07, 0.3, 1.2, 1.79, 3, 12]) {
      const n = alto / pasoDeGraduacion(alto);
      expect(n, String(alto)).toBeLessThanOrEqual(5 + 1e-9);
      expect(n, String(alto)).toBeGreaterThanOrEqual(2);
    }
  });

  it('las marcas cubren el rango hacia afuera, incluso por debajo del piso', () => {
    expect(marcasDelEjeZ(0, 1.5)).toEqual({ paso: 0.5, marcas: [0, 0.5, 1, 1.5] });
    const { paso, marcas } = marcasDelEjeZ(-0.275, 1.679);
    expect(paso).toBe(0.5);
    expect(marcas).toEqual([-0.5, 0, 0.5, 1, 1.5, 2]);
  });

  it('el rotulo lleva los decimales del paso, con coma', () => {
    expect(rotuloDeAltura(0.25, 0.25)).toBe('0,25 m');
    expect(rotuloDeAltura(1, 0.5)).toBe('1,0 m');
    expect(rotuloDeAltura(2, 1)).toBe('2 m');
    expect(rotuloDeAltura(-1e-17, 0.2)).toBe('0,0 m');
  });
});
