// El carro sobre la via: una caja con las dimensiones del carro del modelo
// (LargoCarro x AnchoVia x AltoCarro), orientada con el marco del carro (T,
// L, U) del nodo, mas una esfera en la heartline (el centro de masa del
// pasajero, d*U por encima del riel). Se ubica por tiempo: el eje del boton
// play es nodos.tiempo, que arranca en 0 en cada elemento y aca se acumula.

import * as THREE from 'three';
import type { Layout } from '../contrato/tipos';

export interface PosicionDelCarro {
  /** Tiempo global (acumulado sobre los elementos), s. */
  tiempo: number;
  /** Indice del elemento en el que esta. */
  elemento: number;
  /** Nodo local mas cercano por debajo. */
  nodo: number;
  velocidad: number | null;
  gz: number | null;
  gy: number | null;
  posicion: THREE.Vector3;
}

interface Tabla {
  tiempo: Float64Array;
  riel: Float64Array;
  heartline: Float64Array;
  t: Float64Array;
  u: Float64Array;
  l: Float64Array;
  velocidad: Float64Array;
  gz: Float64Array;
  gy: Float64Array;
  elemento: Uint16Array;
  nodoLocal: Uint32Array;
  cantidad: number;
}

export class Carro {
  private readonly grupo = new THREE.Group();
  private caja: THREE.Mesh | null = null;
  private pasajero: THREE.Mesh | null = null;
  private tabla: Tabla | null = null;
  private readonly matriz = new THREE.Matrix4();

  constructor(scene: THREE.Scene) {
    scene.add(this.grupo);
    this.grupo.visible = false;
  }

  get duracion(): number {
    return this.tabla ? this.tabla.tiempo[this.tabla.cantidad - 1]! : 0;
  }

  construir(layout: Layout): void {
    this.vaciar();
    const valores = layout.parametros.valores as Record<string, unknown>;
    const largo = numero(valores.largoCarro, 0.1);
    const ancho = numero(valores.anchoVia, 0.06);
    const alto = numero(valores.altoCarro, 0.06);
    const d = numero(valores.distanciaHeartline, 0.03);

    // La caja se apoya sobre el riel: su centro queda alto/2 por encima, sobre U.
    const geometria = new THREE.BoxGeometry(largo, ancho, alto);
    geometria.translate(0, 0, alto / 2);
    this.caja = new THREE.Mesh(geometria, new THREE.MeshStandardMaterial({ color: 0xffb454, roughness: 0.5, metalness: 0.1 }));
    this.pasajero = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(d * 0.35, 0.006), 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xff5c5c, emissive: 0x551111, roughness: 0.4 }),
    );
    this.pasajero.position.set(0, 0, d);
    this.caja.add(this.pasajero);
    this.grupo.add(this.caja);

    this.tabla = tablaDeTiempos(layout);
    this.grupo.visible = true;
    this.ubicar(0);
  }

  /** Coloca el carro en el instante dado (se acota a la duracion) y devuelve donde quedo. */
  ubicar(tiempo: number): PosicionDelCarro | null {
    if (!this.tabla || !this.caja) return null;
    const tabla = this.tabla;
    const n = tabla.cantidad;
    const t = Math.min(Math.max(tiempo, 0), tabla.tiempo[n - 1]!);
    let k = buscar(tabla.tiempo, n, t);
    if (k >= n - 1) k = n - 2;
    const dt = tabla.tiempo[k + 1]! - tabla.tiempo[k]!;
    const a = dt > 0 ? Math.min(Math.max((t - tabla.tiempo[k]!) / dt, 0), 1) : 0;

    const mezcla = (arreglo: Float64Array, c: number) => arreglo[3 * k + c]! * (1 - a) + arreglo[3 * (k + 1) + c]! * a;
    const posicion = new THREE.Vector3(mezcla(tabla.riel, 0), mezcla(tabla.riel, 1), mezcla(tabla.riel, 2));
    const T = new THREE.Vector3(mezcla(tabla.t, 0), mezcla(tabla.t, 1), mezcla(tabla.t, 2)).normalize();
    const U = new THREE.Vector3(mezcla(tabla.u, 0), mezcla(tabla.u, 1), mezcla(tabla.u, 2));
    U.addScaledVector(T, -U.dot(T)).normalize();
    const L = new THREE.Vector3().crossVectors(T, U);

    // Columnas de la matriz: x local = T (largo), y local = L (ancho), z local = U (alto).
    this.matriz.makeBasis(T, L, U);
    this.matriz.setPosition(posicion);
    this.caja.matrixAutoUpdate = false;
    this.caja.matrix.copy(this.matriz);

    const cercano = a < 0.5 ? k : k + 1;
    const valor = (arreglo: Float64Array) => (Number.isNaN(arreglo[cercano]!) ? null : arreglo[cercano]!);
    return {
      tiempo: t,
      elemento: tabla.elemento[cercano]!,
      nodo: tabla.nodoLocal[cercano]!,
      velocidad: valor(tabla.velocidad),
      gz: valor(tabla.gz),
      gy: valor(tabla.gy),
      posicion,
    };
  }

  mostrar(visible: boolean): void {
    this.grupo.visible = visible && this.tabla !== null;
  }

  private vaciar(): void {
    if (this.caja) {
      this.grupo.remove(this.caja);
      this.caja.geometry.dispose();
      (this.caja.material as THREE.Material).dispose();
      this.pasajero?.geometry.dispose();
      (this.pasajero?.material as THREE.Material | undefined)?.dispose();
    }
    this.caja = null;
    this.pasajero = null;
    this.tabla = null;
    this.grupo.visible = false;
  }
}

function numero(v: unknown, respaldo: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : respaldo;
}

/** Primer indice k con tiempo[k] <= t < tiempo[k+1] (busqueda binaria sobre los n primeros). */
function buscar(tiempo: Float64Array, n: number, t: number): number {
  let bajo = 0;
  let alto = n - 1;
  while (alto - bajo > 1) {
    const medio = (bajo + alto) >> 1;
    if (tiempo[medio]! <= t) bajo = medio;
    else alto = medio;
  }
  return bajo;
}

/**
 * Nodos de todo el layout con el tiempo acumulado. Se descarta el nodo
 * repetido de cada empalme y se corta en el primer nodo sin tiempo (despues
 * de un punto de parada el carro no sigue).
 */
function tablaDeTiempos(layout: Layout): Tabla {
  const total = layout.elementos.reduce((s, e) => s + e.nodos.numeroDeNodos, 0);
  const tiempo = new Float64Array(total);
  const riel = new Float64Array(total * 3);
  const heartline = new Float64Array(total * 3);
  const t = new Float64Array(total * 3);
  const u = new Float64Array(total * 3);
  const l = new Float64Array(total * 3);
  const velocidad = new Float64Array(total);
  const gz = new Float64Array(total);
  const gy = new Float64Array(total);
  const elemento = new Uint16Array(total);
  const nodoLocal = new Uint32Array(total);

  let k = 0;
  let desfase = 0;
  let cortado = false;
  layout.elementos.forEach((e, indiceDeElemento) => {
    if (cortado) return;
    const n = e.nodos;
    const desde = indiceDeElemento === 0 ? 0 : 1;
    for (let i = desde; i < n.numeroDeNodos; i++) {
      const ti = n.tiempo[i];
      if (ti === null || ti === undefined) {
        cortado = true;
        break;
      }
      const tg = ti + desfase;
      // El tiempo tiene que crecer estrictamente para poder buscar; un nodo repetido en arco se salta.
      if (k > 0 && tg <= tiempo[k - 1]!) continue;
      tiempo[k] = tg;
      for (let c = 0; c < 3; c++) {
        riel[3 * k + c] = [n.xRiel, n.yRiel, n.zRiel][c]![i] ?? NaN;
        heartline[3 * k + c] = [n.x, n.y, n.z][c]![i] ?? NaN;
        t[3 * k + c] = n.versorTangente[i]![c]!;
        u[3 * k + c] = n.versorArribaCarro[i]![c]!;
        l[3 * k + c] = n.versorLateral[i]![c]!;
      }
      velocidad[k] = n.velocidad[i] ?? NaN;
      gz[k] = n.gz[i] ?? NaN;
      gy[k] = n.gy[i] ?? NaN;
      elemento[k] = indiceDeElemento;
      nodoLocal[k] = i;
      k++;
    }
    desfase += e.resumen.tiempoDeRecorrido ?? 0;
  });
  return { tiempo, riel, heartline, t, u, l, velocidad, gz, gy, elemento, nodoLocal, cantidad: Math.max(k, 2) };
}
