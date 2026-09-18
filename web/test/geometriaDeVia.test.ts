import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analizarLayout } from '../src/contrato/cargar';
import { rangoDeMagnitud } from '../src/escena/colores';
import {
  aplanarNodos,
  coloresPorVertice,
  lineaHeartline,
  tubo,
  uniones,
  valoresPorNodo,
} from '../src/escena/geometriaDeVia';

const cargar = (caso: string) =>
  analizarLayout(readFileSync(fileURLToPath(new URL(`../../golden/${caso}.json`, import.meta.url)), 'utf8'));

const circuito = cargar('circuito-demolayout');
const sinNaN = (buffer: ArrayLike<number>) => {
  for (let i = 0; i < buffer.length; i++) if (!Number.isFinite(buffer[i]!)) return false;
  return true;
};

describe('aplanarNodos', () => {
  const nodos = aplanarNodos(circuito);

  it('descarta el primer nodo de cada elemento salvo el primero (contrato, seccion 6)', () => {
    const total = circuito.elementos.reduce((suma, e) => suma + e.nodos.numeroDeNodos, 0);
    expect(nodos.cantidad).toBe(total - (circuito.elementos.length - 1));
    expect(nodos.riel).toHaveLength(nodos.cantidad * 3);
    expect(nodos.heartline).toHaveLength(nodos.cantidad * 3);
  });

  it('recuerda a que elemento y a que nodo local pertenece cada nodo', () => {
    const primero = circuito.elementos[0].nodos.numeroDeNodos;
    expect(nodos.elemento[0]).toBe(0);
    expect(nodos.elemento[primero - 1]).toBe(0);
    expect(nodos.elemento[primero]).toBe(1);
    expect(nodos.indiceLocal[primero]).toBe(1); // el nodo 0 del elemento 1 se descarto
  });

  it('no tiene NaN y los versores son unitarios', () => {
    expect(sinNaN(nodos.riel)).toBe(true);
    expect(sinNaN(nodos.u)).toBe(true);
    const norma = Math.hypot(nodos.u[0]!, nodos.u[1]!, nodos.u[2]!);
    expect(norma).toBeCloseTo(1, 5);
  });

  it('el riel empieza en la posicion inicial del layout', () => {
    expect([nodos.riel[0], nodos.riel[1], nodos.riel[2]]).toEqual(circuito.estadoInicial.posicion);
  });
});

describe('tubo', () => {
  const nodos = aplanarNodos(circuito);
  const lados = 8;
  const geometria = tubo(nodos, 0.01, lados);

  it('tiene cantidad * lados vertices y 2 triangulos por cara', () => {
    expect(geometria.posiciones).toHaveLength(nodos.cantidad * lados * 3);
    expect(geometria.normales).toHaveLength(nodos.cantidad * lados * 3);
    expect(geometria.indices).toHaveLength((nodos.cantidad - 1) * lados * 6);
    expect(geometria.nodoDeVertice).toHaveLength(nodos.cantidad * lados);
  });

  it('no tiene NaN y los indices apuntan a vertices existentes', () => {
    expect(sinNaN(geometria.posiciones)).toBe(true);
    expect(sinNaN(geometria.normales)).toBe(true);
    let maximo = 0;
    for (let i = 0; i < geometria.indices.length; i++) maximo = Math.max(maximo, geometria.indices[i]!);
    expect(maximo).toBe(nodos.cantidad * lados - 1);
  });

  it('cada vertice esta a radio del punto del riel de su nodo', () => {
    const k = 1234;
    const nodo = geometria.nodoDeVertice[k]!;
    const distancia = Math.hypot(
      geometria.posiciones[3 * k]! - nodos.riel[3 * nodo]!,
      geometria.posiciones[3 * k + 1]! - nodos.riel[3 * nodo + 1]!,
      geometria.posiciones[3 * k + 2]! - nodos.riel[3 * nodo + 2]!,
    );
    expect(distancia).toBeCloseTo(0.01, 6); // los buffers son Float32
  });
});

describe('lineaHeartline y uniones', () => {
  const nodos = aplanarNodos(circuito);

  it('la heartline es una posicion por nodo', () => {
    expect(lineaHeartline(nodos)).toHaveLength(nodos.cantidad * 3);
  });

  it('las uniones van del riel a la heartline cada N nodos', () => {
    const segmentos = uniones(nodos, 25);
    const cantidad = Math.floor((nodos.cantidad - 1) / 25) + 1;
    expect(segmentos).toHaveLength(cantidad * 6);
    expect([segmentos[0], segmentos[1], segmentos[2]]).toEqual([nodos.riel[0], nodos.riel[1], nodos.riel[2]]);
    expect([segmentos[3], segmentos[4], segmentos[5]]).toEqual([
      nodos.heartline[0],
      nodos.heartline[1],
      nodos.heartline[2],
    ]);
  });
});

describe('valoresPorNodo y coloresPorVertice', () => {
  const nodos = aplanarNodos(circuito);

  it('toma la columna del elemento correcto y pone NaN donde hay null', () => {
    const conNull = structuredClone(circuito);
    conNull.elementos[1]!.nodos.gz[5] = null;
    const nodosConNull = aplanarNodos(conNull);
    const valores = valoresPorNodo(conNull, nodosConNull, 'gz');
    expect(valores).toHaveLength(nodosConNull.cantidad);
    const primero = conNull.elementos[0].nodos.numeroDeNodos;
    expect(valores[primero + 4]).toBeNaN(); // nodo local 5 del elemento 1 (el 0 se descarto)
    expect(valores[0]).toBe(circuito.elementos[0].nodos.gz[0]);
  });

  it('los colores no tienen NaN aunque haya null, y atenuar oscurece', () => {
    const conNull = structuredClone(circuito);
    conNull.elementos[0].nodos.gz[0] = null;
    const nodosConNull = aplanarNodos(conNull);
    const geometria = tubo(nodosConNull, 0.01, 6);
    const valores = valoresPorNodo(conNull, nodosConNull, 'gz');
    const rango = rangoDeMagnitud(conNull, 'gz');
    const colores = coloresPorVertice(valores, geometria.nodoDeVertice, rango, 'secuencial');
    expect(colores).toHaveLength(geometria.nodoDeVertice.length * 3);
    expect(sinNaN(colores)).toBe(true);

    const atenuados = coloresPorVertice(valores, geometria.nodoDeVertice, rango, 'secuencial', () => true);
    expect(atenuados[30]!).toBeLessThan(colores[30]!);
  });
});
