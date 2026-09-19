// El arnes del contrato (CONTRATO_VISUALIZADOR.md, seccion 8): el nucleo en
// TypeScript reconstruye los once casos canonicos y tiene que coincidir con
// lo que exporto MATLAB. Tolerancias calibradas con la primera corrida real
// (2026-09-19): los golden vienen redondeados a 6 cifras significativas, asi
// que la diferencia admisible es media unidad de la sexta cifra (5e-6
// relativo) mas un margen chico; con eso las diferencias propias del port
// (orden de acumulacion en punto flotante) quedan muy por debajo. Los
// veredictos `pasa` y el numero de nodos se comparan exactos.

import { describe, expect, it } from 'vitest';
import { CASOS, cargarGolden, compararLayouts, reconstruirCaso, reconstruirCircuito } from './arnes';

const TOLERANCIA_RELATIVA = 6e-6;
const TOLERANCIA_ABSOLUTA = 1e-9;

describe('el port reproduce los golden files', () => {
  for (const caso of [...Object.keys(CASOS), 'circuito-demolayout']) {
    it(caso, () => {
      const port = caso === 'circuito-demolayout' ? reconstruirCircuito() : reconstruirCaso(caso);
      const golden = cargarGolden(caso);

      expect(port.elementos.map((e) => e.nodos.numeroDeNodos)).toEqual(golden.elementos.map((e) => e.nodos.numeroDeNodos));
      golden.elementos.forEach((eg, i) => {
        const ep = port.elementos[i]!;
        expect(ep.tipo).toBe(eg.tipo);
        expect(ep.subtramos).toEqual(eg.subtramos);
        expect(ep.criterios.previos.map((c) => [c.nombre, c.pasa])).toEqual(eg.criterios.previos.map((c) => [c.nombre, c.pasa]));
        expect(ep.criterios.posteriores.map((c) => [c.nombre, c.pasa])).toEqual(eg.criterios.posteriores.map((c) => [c.nombre, c.pasa]));
        expect(ep.criterios.todosPasan).toBe(eg.criterios.todosPasan);
        expect(ep.nodos.puntoDeParada ?? null).toBe(eg.nodos.puntoDeParada ?? null);
      });
      expect(port.resumenLayout.todosLosCriteriosPasan).toBe(golden.resumenLayout.todosLosCriteriosPasan);

      const fuera = compararLayouts(golden, port).filter((d) => {
        const escala = Math.max(Math.abs(d.golden ?? 0), Math.abs(d.port ?? 0));
        return !(d.maxAbs <= TOLERANCIA_RELATIVA * escala + TOLERANCIA_ABSOLUTA);
      });
      expect(
        fuera.map((d) => `${d.campo} en ${d.indice}: golden ${d.golden} port ${d.port} (abs ${d.maxAbs.toExponential(2)})`),
      ).toEqual([]);
    }, 120000);
  }
});
