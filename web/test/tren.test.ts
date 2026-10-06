import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { carroPorDefecto, carrosCalculados, layoutDelCarro, numeroDeCarros } from '../src/contrato/carros';
import { analizarLayout } from '../src/contrato/cargar';
import { arcoEnElInstante, colorDeFrente, datosDelTren, distanciasDelTren, geometriaPorArco, marcoEnArco, relojDelCarro } from '../src/escena/carro';
import { armarCarro, DISENOS_DE_CARRO, plantillaDe } from '../src/escena/disenosDeCarro';

const cargar = (caso: string) =>
  analizarLayout(readFileSync(fileURLToPath(new URL(`../../golden/${caso}.json`, import.meta.url)), 'utf8'));

describe('tren en la vista 3D', () => {
  const circuito = cargar('circuito-demolayout');
  const via = geometriaPorArco(circuito);

  it('cada carro va (largo + separacion) detras del anterior; el primero en 0', () => {
    expect(distanciasDelTren(1, 0.1, 0.015)).toEqual([0]);
    const d = distanciasDelTren(3, 0.1, 0.015);
    expect(d[1]).toBeCloseTo(0.115, 12);
    expect(d[2]).toBeCloseTo(0.23, 12);
  });

  it('la via por arco tiene el arco del riel creciente y un nodo por nodo global', () => {
    const total = circuito.elementos.reduce((s, e) => s + e.nodos.numeroDeNodos, 0) - (circuito.elementos.length - 1);
    expect(via.cantidad).toBe(total);
    for (let k = 1; k < via.cantidad; k++) expect(via.arco[k]!).toBeGreaterThanOrEqual(via.arco[k - 1]!);
  });

  it('sobre un nodo, el marco es el del nodo; entre dos, interpolado', () => {
    const k = 300;
    const enNodo = marcoEnArco(via, via.arco[k]!);
    expect(enNodo.posicion[0]).toBeCloseTo(via.riel[3 * k]!, 12);
    const medio = marcoEnArco(via, (via.arco[k]! + via.arco[k + 1]!) / 2);
    expect(medio.posicion[2]).toBeCloseTo((via.riel[3 * k + 2]! + via.riel[3 * (k + 1) + 2]!) / 2, 9);
    expect(medio.k).toBe(k);
  });

  it('antes del inicio de la via el carro sigue en recta por la tangente del primer nodo (la estacion)', () => {
    const marco = marcoEnArco(via, via.arco[0]! - 0.25);
    for (let c = 0; c < 3; c++) expect(marco.posicion[c]).toBeCloseTo(via.riel[c]! - 0.25 * via.t[c]!, 12);
    expect(marco.k).toBe(-1);
  });

  it('con un carro, el reloj del tren es el del carro y la animacion dura el tiempo total', () => {
    const datos = datosDelTren(circuito);
    expect(datos.cantidad).toBe(1);
    const reloj = relojDelCarro(circuito, 1, 0);
    expect(reloj.tiempo[reloj.cantidad - 1]).toBeCloseTo(circuito.resumenLayout.tiempoTotal!, 3);
    expect(arcoEnElInstante(reloj, 0)).toBe(via.arco[0]);
  });

  it('la marca del frente contrasta con el color del carro', () => {
    const verde = new THREE.Color('#3ddc84');
    const magenta = new THREE.Color('#e24fd4');
    expect(colorDeFrente(new THREE.Color('#ffb454'), verde, magenta)).toBe(verde);
    expect(colorDeFrente(new THREE.Color('#40d880'), verde, magenta)).toBe(magenta);
  });
});

describe('disenos del carro escalados a las dimensiones', () => {
  it('cada diseño se modela una sola vez y lo comparten todos los carros', () => {
    for (const { clave } of DISENOS_DE_CARRO) expect(plantillaDe(clave)).toBe(plantillaDe(clave));
  });

  it('la carroceria se estira a largo x ancho x alto y las ruedas conservan la forma', () => {
    const material = () => new THREE.MeshBasicMaterial();
    for (const { clave } of DISENOS_DE_CARRO) {
      const carro = armarCarro(clave, { largo: 0.2, ancho: 0.08, alto: 0.05, diametroRueda: 0.02 }, material);
      carro.updateMatrixWorld(true);
      const caja = new THREE.Box3();
      carro.children[0]!.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) caja.expandByObject(o);
      });
      const tamano = caja.getSize(new THREE.Vector3());
      // La carroceria ocupa la caja del carro (con lo que sobresale: placa, aleta, borde).
      expect(tamano.x, clave).toBeGreaterThan(0.19);
      expect(tamano.x, clave).toBeLessThan(0.23);
      expect(tamano.y, clave).toBeGreaterThan(0.07);
      expect(tamano.y, clave).toBeLessThan(0.1);
      const ruedas = carro.children.filter((o) => o.userData.rol === 'rueda');
      expect(ruedas.length, clave).toBe(4);
      for (const r of ruedas) expect(r.scale.x).toBe(r.scale.z);
    }
  });
});

describe('el tren visto desde cada carro (contrato 1.3.0)', () => {
  const tren = cargar('tren-loop-gconstante');

  it('trae tres carros calculados y el carro de diseno en el resumen', () => {
    expect(numeroDeCarros(tren)).toBe(3);
    expect(carrosCalculados(tren)).toEqual([1, 2, 3]);
    expect(tren.elementos[0]!.resumen.carroDeDiseno).toBe(1);
  });

  it('el carro por defecto es el peor entre el primero y el ultimo', () => {
    const u = tren.elementos[0]!.resumen.utilizacionPorCarro!;
    expect(carroPorDefecto(tren)).toBe((u[2] ?? 0) > (u[0] ?? 0) ? 3 : 1);
  });

  it('la vista de un carro cambia sus columnas dinamicas y sus criterios, no la geometria', () => {
    const vista = layoutDelCarro(tren, 3);
    const e = vista.elementos[0]!;
    const propio = tren.elementos[0]!.carros!.find((c) => c.numero === 3)!;
    expect(e.nodos.gz).toBe(propio.nodos.gz);
    expect(e.nodos.xRiel).toBe(tren.elementos[0]!.nodos.xRiel);
    const linea = e.criterios.posteriores.find((c) => c.nombre === 'G minima sobre el eje vertical del carro')!;
    expect(linea.valor).toBe(propio.criterios.posteriores.find((c) => c.nombre === linea.nombre)!.valor);
    expect(layoutDelCarro(tren, 1)).toBe(tren);
    expect(layoutDelCarro(tren, 3)).toBe(vista);
  });

  it('el tren entero sale de la via: la animacion dura hasta que pasa el ultimo carro', () => {
    const datos = datosDelTren(tren);
    expect(datos.cantidad).toBe(3);
    expect(datos.tiempoDeSalida).toBeGreaterThan(tren.resumenLayout.tiempoTotal!);
    expect(datos.desfases[0]).toBe(0);
    expect(datos.desfases[2]!).toBeGreaterThan(datos.desfases[1]!);
  });
});
