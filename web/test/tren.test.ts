import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analizarLayout } from '../src/contrato/cargar';
import { distanciasDelTren, marcoEnArco, tablaDeTiempos } from '../src/escena/carro';

const cargar = (caso: string) =>
  analizarLayout(readFileSync(fileURLToPath(new URL(`../../golden/${caso}.json`, import.meta.url)), 'utf8'));

describe('tren de varios carros', () => {
  const tabla = tablaDeTiempos(cargar('circuito-demolayout'));

  it('cada carro va (largo + separacion) detras del anterior; el primero en 0', () => {
    expect(distanciasDelTren(1, 0.1, 0.015)).toEqual([0]);
    const d = distanciasDelTren(3, 0.1, 0.015);
    expect(d[0]).toBe(0);
    expect(d[1]).toBeCloseTo(0.115, 12);
    expect(d[2]).toBeCloseTo(0.23, 12);
  });

  it('la tabla lleva el arco del riel creciente', () => {
    for (let k = 1; k < tabla.cantidad; k++) expect(tabla.arco[k]!).toBeGreaterThanOrEqual(tabla.arco[k - 1]!);
  });

  it('sobre un nodo, el marco es el del nodo; entre dos, interpolado', () => {
    const k = 300;
    const enNodo = marcoEnArco(tabla, tabla.arco[k]!);
    expect(enNodo.posicion[0]).toBeCloseTo(tabla.riel[3 * k]!, 12);
    expect(enNodo.t[2]).toBeCloseTo(tabla.t[3 * k + 2]!, 12);
    const medio = marcoEnArco(tabla, (tabla.arco[k]! + tabla.arco[k + 1]!) / 2);
    expect(medio.posicion[2]).toBeCloseTo((tabla.riel[3 * k + 2]! + tabla.riel[3 * (k + 1) + 2]!) / 2, 9);
  });

  it('antes del inicio de la via el carro sigue en recta por la tangente del primer nodo', () => {
    const atras = 0.25;
    const marco = marcoEnArco(tabla, tabla.arco[0]! - atras);
    for (let c = 0; c < 3; c++) {
      expect(marco.posicion[c]).toBeCloseTo(tabla.riel[c]! - atras * tabla.t[c]!, 12);
      expect(marco.u[c]).toBe(tabla.u[c]);
    }
  });
});
