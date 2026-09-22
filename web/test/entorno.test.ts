import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analizarLayout } from '../src/contrato/cargar';
import { cabe, extremosDeGrilla, rotuloDeMetros } from '../src/escena/entorno';

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
    for (const caso of ['loop-normativa', 'circuito-demolayout', 'helice-clotoide']) {
      const layout = cargar(caso);
      const disponible = layout.parametros.valores.boundingBoxDisponible as [[number, number], [number, number], [number, number]];
      const criterios = layout.elementos.flatMap((e) => [...e.criterios.previos, ...e.criterios.posteriores]).filter((c) => /bounding box/i.test(c.nombre));
      const pasanTodos = criterios.every((c) => c.pasa);
      expect(cabe(layout.resumenLayout.boundingBox, disponible), caso).toBe(pasanTodos);
    }
  });
});
