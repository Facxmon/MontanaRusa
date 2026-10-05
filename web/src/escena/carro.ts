// El carro sobre la via: una caja con las dimensiones del carro del modelo
// (LargoCarro x AnchoVia x AltoCarro), orientada con el marco del carro (T,
// L, U) del nodo, mas una esfera en la heartline (el centro de masa del
// pasajero, d*U por encima del riel). Se ubica por tiempo: el eje del boton
// play es nodos.tiempo, que arranca en 0 en cada elemento y aca se acumula.
//
// Tren (NumeroDeCarros > 1): se dibujan todos los carros, uno detras del
// otro sobre el riel, cada uno con su propio marco. El modelo es una masa
// puntual y calcula UNA posicion por instante; esa posicion es la del
// primer carro (el que se dibujaba siempre, que queda donde estaba) y los
// demas van atras, a (largo + separacion) de arco de riel cada uno. Antes
// del inicio de la via siguen en linea recta por la tangente del primer
// nodo (la estacion). Cada carro lleva en el frente una placa de color
// (--escena-frente-carro) que dice hacia donde apunta.
//
// TODO(decision de diseno): que la posicion del modelo sea la del PRIMER
// carro es una eleccion de esta vista; con la masa puntual como centro de
// masa del tren, lo coherente seria centrar el tren en ella. Queda abierto
// junto con el diseno definitivo del carro.

import * as THREE from 'three';
import type { Layout } from '../contrato/tipos';
import { tema } from '../tema';

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
  /**
   * Los dos nodos consecutivos de la tabla entre los que esta el carro y
   * cuanto avanzo de uno al otro (0..1): el marcador de los graficos
   * interpola la abscisa con esto.
   */
  entre: { anterior: { elemento: number; nodo: number }; posterior: { elemento: number; nodo: number }; fraccion: number };
}

/**
 * Separacion entre carros (de paragolpe a paragolpe) como fraccion del
 * largo del carro.
 * TODO(decision de diseno): el modelo no tiene un parametro de separacion
 * entre carros (ParametrosPorDefecto.m declara NumeroDeCarros y LargoCarro,
 * nada mas) y agregarlo es un cambio del MATLAB. Mientras tanto es solo
 * visual: no entra en ningun calculo.
 */
export const SEPARACION_ENTRE_CARROS_RELATIVA = 0.15;
/** Mas carros que esto no se dibujan (el panel sugiere 1 a 10). */
const MAXIMO_DE_CARROS = 30;
/** Espesor de la placa del frente, como fraccion del largo. */
const ESPESOR_DEL_FRENTE = 0.12;

export interface Tabla {
  tiempo: Float64Array;
  /** Arco del riel acumulado sobre el layout (nodos.arco), m. */
  arco: Float64Array;
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

/** Distancia de arco de cada carro detras del primero (el 0 es el primero). Puro. */
export function distanciasDelTren(cantidad: number, largo: number, separacion: number): number[] {
  return Array.from({ length: cantidad }, (_, i) => i * (largo + separacion));
}

/** Posicion sobre el riel y marco (T, U) a un arco dado. */
export interface MarcoEnArco {
  posicion: [number, number, number];
  t: [number, number, number];
  u: [number, number, number];
}

/**
 * Donde esta el riel a arco s, con el marco del carro. Dentro de la tabla
 * interpola entre los dos nodos que rodean a s; antes del primero (o despues
 * del ultimo) sigue en recta por la tangente del extremo, con su marco. Puro.
 */
export function marcoEnArco(tabla: Pick<Tabla, 'arco' | 'riel' | 't' | 'u' | 'cantidad'>, s: number): MarcoEnArco {
  const n = tabla.cantidad;
  const nodo = (k: number, a: Float64Array): [number, number, number] => [a[3 * k]!, a[3 * k + 1]!, a[3 * k + 2]!];
  const fuera = (k: number, ds: number): MarcoEnArco => {
    const t = nodo(k, tabla.t);
    const p = nodo(k, tabla.riel);
    return { posicion: [p[0] + t[0] * ds, p[1] + t[1] * ds, p[2] + t[2] * ds], t, u: nodo(k, tabla.u) };
  };
  if (s <= tabla.arco[0]!) return fuera(0, s - tabla.arco[0]!);
  if (s >= tabla.arco[n - 1]!) return fuera(n - 1, s - tabla.arco[n - 1]!);
  let k = buscar(tabla.arco, n, s);
  if (k >= n - 1) k = n - 2;
  const ds = tabla.arco[k + 1]! - tabla.arco[k]!;
  const a = ds > 0 ? Math.min(Math.max((s - tabla.arco[k]!) / ds, 0), 1) : 0;
  const mezcla = (arreglo: Float64Array): [number, number, number] => [
    arreglo[3 * k]! * (1 - a) + arreglo[3 * (k + 1)]! * a,
    arreglo[3 * k + 1]! * (1 - a) + arreglo[3 * (k + 1) + 1]! * a,
    arreglo[3 * k + 2]! * (1 - a) + arreglo[3 * (k + 1) + 2]! * a,
  ];
  return { posicion: mezcla(tabla.riel), t: mezcla(tabla.t), u: mezcla(tabla.u) };
}

export class Carro {
  private readonly grupo = new THREE.Group();
  /** Un carro por elemento del tren; el 0 es el que ubica el modelo. */
  private cajas: THREE.Mesh[] = [];
  /** Geometrias y materiales compartidos por todos los carros: se liberan una sola vez. */
  private recursos: { dispose(): void }[] = [];
  /** Arco detras del primero de cada carro, m. */
  private distancias: number[] = [0];
  private tabla: Tabla | null = null;

  constructor(scene: THREE.Scene) {
    scene.add(this.grupo);
    this.grupo.visible = false;
  }

  /** Libera las geometrias y saca el grupo de la escena. */
  destruir(): void {
    this.vaciar();
    this.grupo.removeFromParent();
  }

  get duracion(): number {
    return this.tabla ? this.tabla.tiempo[this.tabla.cantidad - 1]! : 0;
  }

  /** Cuantos carros tiene el tren dibujado. */
  get cantidadDeCarros(): number {
    return this.cajas.length;
  }

  construir(layout: Layout): void {
    this.vaciar();
    const valores = layout.parametros.valores as Record<string, unknown>;
    const largo = numero(valores.largoCarro, 0.1);
    const ancho = numero(valores.anchoVia, 0.06);
    const alto = numero(valores.altoCarro, 0.06);
    const d = numero(valores.distanciaHeartline, 0.03);
    const cantidad = Math.min(MAXIMO_DE_CARROS, Math.max(1, Math.round(numero(valores.numeroDeCarros, 1))));
    this.distancias = distanciasDelTren(cantidad, largo, SEPARACION_ENTRE_CARROS_RELATIVA * largo);

    // La caja se apoya sobre el riel: su centro queda alto/2 por encima, sobre U.
    const geometria = new THREE.BoxGeometry(largo, ancho, alto);
    geometria.translate(0, 0, alto / 2);
    // La placa del frente, apenas mas grande que la cara +T (x local) de la caja para que se vea de costado.
    const espesor = ESPESOR_DEL_FRENTE * largo;
    const geometriaDelFrente = new THREE.BoxGeometry(espesor, ancho * 1.04, alto * 1.04);
    geometriaDelFrente.translate(largo / 2 - espesor / 2 + espesor * 0.05, 0, alto / 2);
    const geometriaDelPasajero = new THREE.SphereGeometry(Math.max(d * 0.35, 0.006), 16, 12);
    const t = tema();
    const materialDeLaCaja = new THREE.MeshStandardMaterial({ color: new THREE.Color(t.escenaCarro), roughness: 0.5, metalness: 0.1 });
    const materialDelFrente = new THREE.MeshStandardMaterial({
      color: new THREE.Color(t.escenaFrenteCarro),
      emissive: new THREE.Color(t.escenaFrenteCarro),
      emissiveIntensity: 0.35,
      roughness: 0.4,
    });
    const materialDelPasajero = new THREE.MeshStandardMaterial({
      color: new THREE.Color(t.escenaPasajero),
      emissive: new THREE.Color(t.escenaPasajeroBrillo),
      roughness: 0.4,
    });
    this.recursos = [geometria, geometriaDelFrente, geometriaDelPasajero, materialDeLaCaja, materialDelFrente, materialDelPasajero];
    this.cajas = this.distancias.map(() => {
      const caja = new THREE.Mesh(geometria, materialDeLaCaja);
      caja.matrixAutoUpdate = false;
      caja.add(new THREE.Mesh(geometriaDelFrente, materialDelFrente));
      const pasajero = new THREE.Mesh(geometriaDelPasajero, materialDelPasajero);
      pasajero.position.set(0, 0, d);
      caja.add(pasajero);
      this.grupo.add(caja);
      return caja;
    });

    this.tabla = tablaDeTiempos(layout);
    this.grupo.visible = true;
    this.ubicar(0);
  }

  /** Coloca el tren en el instante dado (se acota a la duracion) y devuelve donde quedo el primer carro. */
  ubicar(tiempo: number): PosicionDelCarro | null {
    const primera = this.cajas[0];
    if (!this.tabla || !primera) return null;
    const tabla = this.tabla;
    const n = tabla.cantidad;
    const t = Math.min(Math.max(tiempo, 0), tabla.tiempo[n - 1]!);
    let k = buscar(tabla.tiempo, n, t);
    if (k >= n - 1) k = n - 2;
    const dt = tabla.tiempo[k + 1]! - tabla.tiempo[k]!;
    const a = dt > 0 ? Math.min(Math.max((t - tabla.tiempo[k]!) / dt, 0), 1) : 0;

    const mezcla = (arreglo: Float64Array, c: number) => arreglo[3 * k + c]! * (1 - a) + arreglo[3 * (k + 1) + c]! * a;
    const posicion = new THREE.Vector3(mezcla(tabla.riel, 0), mezcla(tabla.riel, 1), mezcla(tabla.riel, 2));
    ponerEnMarco(primera, {
      posicion: [posicion.x, posicion.y, posicion.z],
      t: [mezcla(tabla.t, 0), mezcla(tabla.t, 1), mezcla(tabla.t, 2)],
      u: [mezcla(tabla.u, 0), mezcla(tabla.u, 1), mezcla(tabla.u, 2)],
    });

    // Los carros de atras: por arco de riel desde el primero, cada uno con su marco.
    if (this.cajas.length > 1) {
      const arcoDelPrimero = tabla.arco[k]! * (1 - a) + tabla.arco[k + 1]! * a;
      for (let i = 1; i < this.cajas.length; i++) ponerEnMarco(this.cajas[i]!, marcoEnArco(tabla, arcoDelPrimero - this.distancias[i]!));
    }

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
      entre: {
        anterior: { elemento: tabla.elemento[k]!, nodo: tabla.nodoLocal[k]! },
        posterior: { elemento: tabla.elemento[k + 1]!, nodo: tabla.nodoLocal[k + 1]! },
        fraccion: a,
      },
    };
  }

  /**
   * Instante en el que el carro pasa por un nodo (elemento + nodo local), o
   * null si ese nodo no esta en la tabla (despues de un punto de parada). Es
   * lo que convierte un clic en un grafico en una posicion del reproductor.
   */
  tiempoDelNodo(elemento: number, nodoLocal: number): number | null {
    const tabla = this.tabla;
    if (!tabla) return null;
    for (let k = 0; k < tabla.cantidad; k++) {
      if (tabla.elemento[k] === elemento && tabla.nodoLocal[k] === nodoLocal) return tabla.tiempo[k]!;
    }
    return null;
  }

  mostrar(visible: boolean): void {
    this.grupo.visible = visible && this.tabla !== null;
  }

  private vaciar(): void {
    this.grupo.clear();
    for (const recurso of this.recursos) recurso.dispose();
    this.recursos = [];
    this.cajas = [];
    this.distancias = [0];
    this.tabla = null;
    this.grupo.visible = false;
  }
}

/**
 * Orienta una caja con el marco del carro. Columnas de la matriz: x local =
 * T (largo), y local = L (ancho), z local = U (alto); U se reortogonaliza
 * contra T porque la interpolacion entre nodos la saca de perpendicular.
 */
function ponerEnMarco(caja: THREE.Mesh, marco: MarcoEnArco): void {
  const T = new THREE.Vector3(...marco.t).normalize();
  const U = new THREE.Vector3(...marco.u);
  U.addScaledVector(T, -U.dot(T)).normalize();
  const L = new THREE.Vector3().crossVectors(T, U);
  caja.matrix.makeBasis(T, L, U).setPosition(...marco.posicion);
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
export function tablaDeTiempos(layout: Layout): Tabla {
  const total = layout.elementos.reduce((s, e) => s + e.nodos.numeroDeNodos, 0);
  const tiempo = new Float64Array(total);
  const arco = new Float64Array(total);
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
      arco[k] = n.arco[i] ?? NaN;
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
  return { tiempo, arco, riel, heartline, t, u, l, velocidad, gz, gy, elemento, nodoLocal, cantidad: Math.max(k, 2) };
}
