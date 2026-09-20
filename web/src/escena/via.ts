// La via dentro de la escena: tubo del riel, linea de la heartline y uniones
// d*U, con color por vertice segun la magnitud elegida. Toda la geometria la
// calcula geometriaDeVia.ts; aca solo se la sube a Three.js.

import * as THREE from 'three';
import type { ClaveDeMagnitud } from '../contrato/magnitudes';
import { magnitudPorClave } from '../contrato/magnitudes';
import type { Layout } from '../contrato/tipos';
import { tema } from '../tema';
import { rangoDeMagnitud } from './colores';
import {
  aplanarNodos,
  coloresPorVertice,
  lineaHeartline,
  tubo,
  uniones,
  valoresPorNodo,
  type NodosAplanados,
  type Tubo,
} from './geometriaDeVia';

/** Radio del tubo que representa el riel, en m. Chico frente a d = 0.03 m para que se vea el offset. */
const RADIO_DEL_RIEL = 0.008;
const LADOS_DEL_TUBO = 10;
const UNION_CADA_N_NODOS = 25;

export class Via {
  private readonly grupo = new THREE.Group();
  private layout: Layout | null = null;
  private nodos: NodosAplanados | null = null;
  private geometriaDelTubo: Tubo | null = null;
  private tuboMesh: THREE.Mesh | null = null;
  private heartline: THREE.Line | null = null;
  private unionesLineas: THREE.LineSegments | null = null;

  constructor(scene: THREE.Scene) {
    scene.add(this.grupo);
  }

  /** Reemplaza la via por la del layout dado y la pinta con la magnitud. */
  construir(layout: Layout, magnitud: ClaveDeMagnitud, elementoResaltado: number | null): void {
    this.vaciar();
    this.layout = layout;
    this.nodos = aplanarNodos(layout);
    this.geometriaDelTubo = tubo(this.nodos, RADIO_DEL_RIEL, LADOS_DEL_TUBO);

    const geometriaTubo = new THREE.BufferGeometry();
    geometriaTubo.setAttribute('position', new THREE.BufferAttribute(this.geometriaDelTubo.posiciones, 3));
    geometriaTubo.setAttribute('normal', new THREE.BufferAttribute(this.geometriaDelTubo.normales, 3));
    geometriaTubo.setAttribute(
      'color',
      new THREE.BufferAttribute(new Float32Array(this.geometriaDelTubo.posiciones.length), 3),
    );
    geometriaTubo.setIndex(new THREE.BufferAttribute(this.geometriaDelTubo.indices, 1));
    this.tuboMesh = new THREE.Mesh(
      geometriaTubo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15 }),
    );
    this.grupo.add(this.tuboMesh);

    const geometriaHeartline = new THREE.BufferGeometry();
    geometriaHeartline.setAttribute('position', new THREE.BufferAttribute(lineaHeartline(this.nodos), 3));
    geometriaHeartline.setAttribute(
      'color',
      new THREE.BufferAttribute(new Float32Array(this.nodos.cantidad * 3), 3),
    );
    this.heartline = new THREE.Line(
      geometriaHeartline,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 }),
    );
    this.grupo.add(this.heartline);

    const geometriaUniones = new THREE.BufferGeometry();
    geometriaUniones.setAttribute('position', new THREE.BufferAttribute(uniones(this.nodos, UNION_CADA_N_NODOS), 3));
    this.unionesLineas = new THREE.LineSegments(
      geometriaUniones,
      new THREE.LineBasicMaterial({ color: new THREE.Color(tema().escenaUniones), transparent: true, opacity: 0.6 }),
    );
    this.grupo.add(this.unionesLineas);

    this.recolorear(magnitud, elementoResaltado);
  }

  /** Solo reescribe los atributos de color; la geometria no se toca. */
  recolorear(magnitud: ClaveDeMagnitud, elementoResaltado: number | null): void {
    if (!this.layout || !this.nodos || !this.geometriaDelTubo || !this.tuboMesh || !this.heartline) return;
    const valores = valoresPorNodo(this.layout, this.nodos, magnitud);
    const rango = rangoDeMagnitud(this.layout, magnitud);
    const escala = magnitudPorClave(magnitud).escala;
    const nodos = this.nodos;
    const atenuar =
      elementoResaltado === null ? undefined : (nodo: number) => nodos.elemento[nodo] !== elementoResaltado;

    const coloresTubo = coloresPorVertice(valores, this.geometriaDelTubo.nodoDeVertice, rango, escala, atenuar);
    const atributoTubo = this.tuboMesh.geometry.getAttribute('color') as THREE.BufferAttribute;
    (atributoTubo.array as Float32Array).set(coloresTubo);
    atributoTubo.needsUpdate = true;

    const identidad = new Uint32Array(nodos.cantidad);
    for (let k = 0; k < nodos.cantidad; k++) identidad[k] = k;
    const coloresHeartline = coloresPorVertice(valores, identidad, rango, escala, atenuar);
    const atributoHeartline = this.heartline.geometry.getAttribute('color') as THREE.BufferAttribute;
    (atributoHeartline.array as Float32Array).set(coloresHeartline);
    atributoHeartline.needsUpdate = true;
  }

  /** Caja [[xmin,xmax],[ymin,ymax],[zmin,zmax]] del riel y la heartline de un elemento. */
  cajaDelElemento(indice: number): [[number, number], [number, number], [number, number]] | null {
    if (!this.nodos) return null;
    const minimo = [Infinity, Infinity, Infinity];
    const maximo = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < this.nodos.cantidad; k++) {
      if (this.nodos.elemento[k] !== indice) continue;
      for (const curva of [this.nodos.riel, this.nodos.heartline]) {
        for (let c = 0; c < 3; c++) {
          const v = curva[3 * k + c]!;
          if (v < minimo[c]!) minimo[c] = v;
          if (v > maximo[c]!) maximo[c] = v;
        }
      }
    }
    if (!Number.isFinite(minimo[0]!)) return null;
    return [
      [minimo[0]!, maximo[0]!],
      [minimo[1]!, maximo[1]!],
      [minimo[2]!, maximo[2]!],
    ];
  }

  private vaciar(): void {
    for (const objeto of [this.tuboMesh, this.heartline, this.unionesLineas]) {
      if (!objeto) continue;
      this.grupo.remove(objeto);
      objeto.geometry.dispose();
      (objeto.material as THREE.Material).dispose();
    }
    this.tuboMesh = null;
    this.heartline = null;
    this.unionesLineas = null;
    this.layout = null;
    this.nodos = null;
    this.geometriaDelTubo = null;
  }
}
