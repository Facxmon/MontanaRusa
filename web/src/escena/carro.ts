// El tren sobre la via. Cada carro es uno de los tres diseños de
// disenosDeCarro.ts escalado a las dimensiones del modelo (LargoCarro x
// AnchoVia x AltoCarro, ruedas de DiametroRueda), orientado con el marco
// del carro (T, L, U) de su posicion, con una esfera en la heartline (el
// centro de masa del pasajero, d*U por encima del riel) y una marca de
// color en el frente que dice hacia donde apunta.
//
// Reloj. El tiempo del reproductor es el del TREN: arranca cuando el primer
// carro entra a la via y termina cuando sale el ultimo
// (resumenLayout.tren.tiempoDeSalida; con un carro, cuando el carro llega al
// final). Del reloj sale el arco del primer carro: mientras esta en la via,
// con su propia tabla de tiempos (columnas base); despues, con la del ultimo
// carro mas su distancia. Cada carro va a su distancia de arco detras del
// primero (resumenLayout.tren.distancias, o LargoCarro + Separacion), con
// el marco de la via en esa posicion; antes del inicio y despues del final
// sigue en recta por la tangente del extremo (la estacion y la salida), que
// es lo mismo que supone el modelo (GeometriaDelTren.m).
//
// Carro analizado. Uno de los carros es el que se esta mirando: lo que
// devuelve ubicar() (nodo, velocidad, G) es de ese carro, y los demas se
// dibujan atenuados. Se elige con un clic sobre el carro (carroEn).

import * as THREE from 'three';
import { layoutDelCarro } from '../contrato/carros';
import type { Layout } from '../contrato/tipos';
import { ParametrosPorDefecto } from '../nucleo/parametros';
import { tema } from '../tema';
import { armarCarro, DISENO_POR_DEFECTO, type DisenoDeCarro, type RolDePieza } from './disenosDeCarro';

export interface PosicionDelCarro {
  /** Tiempo del tren, s. */
  tiempo: number;
  /** Elemento y nodo local mas cercano del carro analizado. */
  elemento: number;
  nodo: number;
  velocidad: number | null;
  gz: number | null;
  gy: number | null;
  /** Posicion sobre el riel del carro analizado. */
  posicion: THREE.Vector3;
  /**
   * Los dos nodos consecutivos entre los que esta el carro analizado y
   * cuanto avanzo de uno al otro (0..1): el marcador de los graficos
   * interpola la abscisa con esto.
   */
  entre: { anterior: { elemento: number; nodo: number }; posterior: { elemento: number; nodo: number }; fraccion: number };
}

/** Como se ve el tren: preferencia de la vista, no del diseno. */
export interface AparienciaDelCarro {
  diseno: DisenoDeCarro;
  /** Color de la carroceria, como lo da un <input type="color"> (#rrggbb). */
  color: string;
}

export const APARIENCIA_POR_DEFECTO = (): AparienciaDelCarro => ({ diseno: DISENO_POR_DEFECTO, color: tema().carroColor1 });

/** Opacidad de los carros que no se estan analizando. */
const OPACIDAD_ATENUADA = 0.28;
/** Mas carros que esto no se dibujan (el panel sugiere 1 a 10). */
const MAXIMO_DE_CARROS = 30;

/** La via por arco, nodo global por nodo global (sin repetir los empalmes). */
export interface GeometriaPorArco {
  arco: Float64Array;
  riel: Float64Array;
  t: Float64Array;
  u: Float64Array;
  elemento: Uint16Array;
  nodoLocal: Uint32Array;
  cantidad: number;
}

/** Reloj de un carro: en que instante del tren pasa por cada nodo (solo los nodos con tiempo). */
export interface RelojDelCarro {
  tiempo: Float64Array;
  arco: Float64Array;
  cantidad: number;
}

/** Lo que hace falta del tren para animarlo. */
export interface DatosDelTren {
  cantidad: number;
  distancias: number[];
  /** Cuando llega cada carro al inicio de la via, desde que llega el primero (NaN si no se sabe). */
  desfases: number[];
  tiempoDeSalida: number;
}

export function geometriaPorArco(layout: Layout): GeometriaPorArco {
  const total = layout.elementos.reduce((s, e) => s + e.nodos.numeroDeNodos, 0);
  const arco = new Float64Array(total);
  const riel = new Float64Array(total * 3);
  const t = new Float64Array(total * 3);
  const u = new Float64Array(total * 3);
  const elemento = new Uint16Array(total);
  const nodoLocal = new Uint32Array(total);
  let k = 0;
  layout.elementos.forEach((e, indice) => {
    const n = e.nodos;
    for (let i = indice === 0 ? 0 : 1; i < n.numeroDeNodos; i++) {
      arco[k] = n.arco[i] ?? NaN;
      for (let c = 0; c < 3; c++) {
        riel[3 * k + c] = [n.xRiel, n.yRiel, n.zRiel][c]![i] ?? NaN;
        t[3 * k + c] = n.versorTangente[i]![c]!;
        u[3 * k + c] = n.versorArribaCarro[i]![c]!;
      }
      elemento[k] = indice;
      nodoLocal[k] = i;
      k++;
    }
  });
  return { arco, riel, t, u, elemento, nodoLocal, cantidad: k };
}

/**
 * Reloj del carro `numero` (1 = el primero) en el tiempo del tren: sus
 * tiempos por elemento (columnas base para el 1, carros[] para los demas)
 * acumulados, mas su desfase. Se corta en el primer nodo sin tiempo (el
 * tren se paro) y se saltean los nodos que no avanzan el reloj.
 */
export function relojDelCarro(layout: Layout, numero: number, desfase: number): RelojDelCarro {
  const vista = layoutDelCarro(layout, numero);
  const total = vista.elementos.reduce((s, e) => s + e.nodos.numeroDeNodos, 0);
  const tiempo = new Float64Array(total);
  const arco = new Float64Array(total);
  let k = 0;
  let acumulado = desfase;
  for (const [indice, e] of vista.elementos.entries()) {
    const n = e.nodos;
    let ultimo = 0;
    for (let i = indice === 0 ? 0 : 1; i < n.numeroDeNodos; i++) {
      const ti = n.tiempo[i];
      if (ti === null || ti === undefined || !Number.isFinite(ti)) return { tiempo, arco, cantidad: Math.max(k, 1) };
      const tg = ti + acumulado;
      ultimo = ti;
      if (k > 0 && tg <= tiempo[k - 1]!) continue;
      tiempo[k] = tg;
      arco[k] = n.arco[i] ?? NaN;
      k++;
    }
    acumulado += ultimo;
  }
  return { tiempo, arco, cantidad: Math.max(k, 1) };
}

export function datosDelTren(layout: Layout): DatosDelTren {
  const tren = layout.resumenLayout.tren;
  if (tren) {
    return {
      cantidad: tren.numeroDeCarros,
      distancias: tren.distancias.map((d) => d ?? NaN),
      desfases: tren.desfasesDeTiempo.map((d) => d ?? NaN),
      tiempoDeSalida: tren.tiempoDeSalida ?? NaN,
    };
  }
  // Layout de un carro (o anterior a 1.3.0): la separacion sale de los parametros.
  const valores = layout.parametros.valores as Record<string, unknown>;
  const defaults = ParametrosPorDefecto();
  const cantidad = Math.min(MAXIMO_DE_CARROS, Math.max(1, Math.round(positivo(valores.numeroDeCarros, 1))));
  const paso = positivo(valores.largoCarro, defaults.LargoCarro) + noNegativo(valores.separacionEntreCarros, defaults.SeparacionEntreCarros);
  return { cantidad, distancias: Array.from({ length: cantidad }, (_, i) => i * paso), desfases: [0, ...new Array<number>(cantidad - 1).fill(NaN)], tiempoDeSalida: NaN };
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
  /** Nodos (indices de la tabla) entre los que cae y fraccion; -1 fuera de la via. */
  k: number;
  fraccion: number;
}

/**
 * Donde esta el riel a arco s, con el marco del carro. Dentro de la via
 * interpola entre los dos nodos que rodean a s; antes del primero (o despues
 * del ultimo) sigue en recta por la tangente del extremo, con su marco. Puro.
 */
export function marcoEnArco(tabla: Pick<GeometriaPorArco, 'arco' | 'riel' | 't' | 'u' | 'cantidad'>, s: number): MarcoEnArco {
  const n = tabla.cantidad;
  const nodo = (k: number, a: Float64Array): [number, number, number] => [a[3 * k]!, a[3 * k + 1]!, a[3 * k + 2]!];
  const fuera = (k: number, ds: number): MarcoEnArco => {
    const t = nodo(k, tabla.t);
    const p = nodo(k, tabla.riel);
    return { posicion: [p[0] + t[0] * ds, p[1] + t[1] * ds, p[2] + t[2] * ds], t, u: nodo(k, tabla.u), k: -1, fraccion: 0 };
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
  return { posicion: mezcla(tabla.riel), t: mezcla(tabla.t), u: mezcla(tabla.u), k, fraccion: a };
}

/** Arco que tiene un reloj en el instante t (interpolacion lineal), o null fuera de su rango. */
export function arcoEnElInstante(reloj: RelojDelCarro, t: number): number | null {
  const n = reloj.cantidad;
  if (n < 2 || t < reloj.tiempo[0]! || t > reloj.tiempo[n - 1]!) return null;
  let k = buscar(reloj.tiempo, n, t);
  if (k >= n - 1) k = n - 2;
  const dt = reloj.tiempo[k + 1]! - reloj.tiempo[k]!;
  const a = dt > 0 ? (t - reloj.tiempo[k]!) / dt : 0;
  return reloj.arco[k]! * (1 - a) + reloj.arco[k + 1]! * a;
}

interface Materiales {
  normal: Record<RolDePieza | 'pasajero', THREE.MeshStandardMaterial>;
  atenuado: Record<RolDePieza | 'pasajero', THREE.MeshStandardMaterial>;
}

export class Carro {
  private readonly grupo = new THREE.Group();
  /** Un grupo por carro del tren; el 0 es el primero. */
  private cajas: THREE.Group[] = [];
  private materiales: Materiales | null = null;
  private geometriaDelPasajero: THREE.SphereGeometry | null = null;
  private layout: Layout | null = null;
  private via: GeometriaPorArco | null = null;
  private tren: DatosDelTren | null = null;
  private relojDelPrimero: RelojDelCarro | null = null;
  private relojDelUltimo: RelojDelCarro | null = null;
  private relojAnalizado: RelojDelCarro | null = null;
  private vistaAnalizada: Layout | null = null;
  private analizado = 1;
  private apariencia: AparienciaDelCarro = APARIENCIA_POR_DEFECTO();
  private instante = 0;

  constructor(scene: THREE.Scene) {
    scene.add(this.grupo);
    this.grupo.visible = false;
  }

  /** Libera geometrias y materiales y saca el grupo de la escena. */
  destruir(): void {
    this.vaciar();
    this.grupo.removeFromParent();
  }

  /** Duracion de la animacion: hasta que sale el ultimo carro (o llega el unico). */
  get duracion(): number {
    const t = this.tren?.tiempoDeSalida;
    if (t !== undefined && Number.isFinite(t)) return t;
    const r = this.relojDelPrimero;
    return r ? r.tiempo[r.cantidad - 1]! : 0;
  }

  get cantidadDeCarros(): number {
    return this.cajas.length;
  }

  get carroAnalizado(): number {
    return this.analizado;
  }

  construir(layout: Layout, analizado = 1): void {
    this.layout = layout;
    this.via = geometriaPorArco(layout);
    this.tren = datosDelTren(layout);
    this.relojDelPrimero = relojDelCarro(layout, 1, 0);
    const ultimo = this.tren.cantidad;
    const desfaseDelUltimo = this.tren.desfases[ultimo - 1];
    const tieneUltimo = ultimo > 1 && desfaseDelUltimo !== undefined && Number.isFinite(desfaseDelUltimo) && layout.elementos[0]?.carros?.some((c) => c.numero === ultimo);
    this.relojDelUltimo = tieneUltimo ? relojDelCarro(layout, ultimo, desfaseDelUltimo!) : null;
    this.armar();
    this.analizar(analizado);
    this.grupo.visible = true;
  }

  /** Cambia diseño o color sin recalcular nada: rehace las mallas (las geometrias estan cacheadas). */
  cambiarApariencia(apariencia: AparienciaDelCarro): void {
    this.apariencia = apariencia;
    if (!this.layout) return;
    this.armar();
    this.analizar(this.analizado);
  }

  /** Elige el carro que se analiza (1 = el primero): los demas se atenuan. */
  analizar(numero: number): void {
    const layout = this.layout;
    if (!layout || !this.tren) return;
    const n = Math.min(Math.max(1, Math.round(numero)), this.cajas.length);
    this.analizado = n;
    this.vistaAnalizada = layoutDelCarro(layout, n);
    const desfase = this.tren.desfases[n - 1];
    this.relojAnalizado = n === 1 ? this.relojDelPrimero : desfase !== undefined && Number.isFinite(desfase) ? relojDelCarro(layout, n, desfase) : null;
    const materiales = this.materiales;
    if (materiales) {
      this.cajas.forEach((caja, i) => {
        const juego = this.cajas.length > 1 && i !== n - 1 ? materiales.atenuado : materiales.normal;
        caja.traverse((objeto) => {
          const malla = objeto as THREE.Mesh;
          const rol = malla.userData?.rol as RolDePieza | 'pasajero' | undefined;
          if (malla.isMesh && rol) malla.material = juego[rol];
        });
      });
    }
    this.ubicar(this.instante);
  }

  /** Numero del carro (1 = el primero) que corta el rayo, o null. */
  carroEn(rayo: THREE.Raycaster): number | null {
    if (!this.grupo.visible || this.cajas.length === 0) return null;
    this.grupo.updateMatrixWorld(true);
    const impactos = rayo.intersectObjects(this.cajas, true);
    for (const impacto of impactos) {
      let objeto: THREE.Object3D | null = impacto.object;
      while (objeto && !this.cajas.includes(objeto as THREE.Group)) objeto = objeto.parent;
      if (objeto) return this.cajas.indexOf(objeto as THREE.Group) + 1;
    }
    return null;
  }

  /** Arco del primer carro en el instante t del tren. */
  private arcoDelPrimero(t: number): number {
    const primero = this.relojDelPrimero!;
    const propio = arcoEnElInstante(primero, t);
    if (propio !== null) return propio;
    if (t < primero.tiempo[0]!) return primero.arco[0]!;
    const ultimo = this.relojDelUltimo;
    const distancia = this.tren!.distancias[this.tren!.cantidad - 1] ?? 0;
    if (ultimo) {
      const s = arcoEnElInstante(ultimo, t);
      if (s !== null) return s + distancia;
      if (t > ultimo.tiempo[ultimo.cantidad - 1]!) return ultimo.arco[ultimo.cantidad - 1]! + distancia;
    }
    return primero.arco[primero.cantidad - 1]!;
  }

  /** Coloca el tren en el instante dado (acotado a la duracion) y devuelve donde quedo el carro analizado. */
  ubicar(tiempo: number): PosicionDelCarro | null {
    const via = this.via;
    const tren = this.tren;
    if (!via || !tren || !this.relojDelPrimero || this.cajas.length === 0) return null;
    const t = Math.min(Math.max(tiempo, 0), this.duracion);
    this.instante = t;
    const s1 = this.arcoDelPrimero(t);
    let delAnalizado: MarcoEnArco | null = null;
    this.cajas.forEach((caja, i) => {
      const marco = marcoEnArco(via, s1 - (tren.distancias[i] ?? 0));
      ponerEnMarco(caja, marco);
      if (i === this.analizado - 1) delAnalizado = marco;
    });
    const marco = delAnalizado as MarcoEnArco | null;
    if (!marco) return null;

    // El nodo del carro analizado: el de la via donde esta (en la estacion o
    // la salida, el extremo). Las magnitudes son las de ESE carro.
    const k = marco.k < 0 ? (s1 - (tren.distancias[this.analizado - 1] ?? 0) <= via.arco[0]! ? 0 : via.cantidad - 2) : marco.k;
    const fraccion = marco.k < 0 ? (k === 0 ? 0 : 1) : marco.fraccion;
    const cercano = fraccion < 0.5 ? k : k + 1;
    const elemento = via.elemento[cercano]!;
    const nodo = via.nodoLocal[cercano]!;
    const columnas = this.vistaAnalizada?.elementos[elemento]?.nodos;
    const valor = (clave: 'velocidad' | 'gz' | 'gy') => {
      const v = columnas?.[clave]?.[nodo];
      return typeof v === 'number' && Number.isFinite(v) ? v : null;
    };
    return {
      tiempo: t,
      elemento,
      nodo,
      velocidad: valor('velocidad'),
      gz: valor('gz'),
      gy: valor('gy'),
      posicion: new THREE.Vector3(...marco.posicion),
      entre: {
        anterior: { elemento: via.elemento[k]!, nodo: via.nodoLocal[k]! },
        posterior: { elemento: via.elemento[k + 1]!, nodo: via.nodoLocal[k + 1]! },
        fraccion,
      },
    };
  }

  /**
   * Instante del tren en que el carro analizado pasa por un nodo, o null si
   * no pasa (despues de un punto de parada, o si de ese carro no hay datos).
   * Es lo que convierte un clic en un grafico en una posicion del reproductor.
   */
  tiempoDelNodo(elemento: number, nodoLocal: number): number | null {
    const layout = this.vistaAnalizada;
    const reloj = this.relojAnalizado;
    if (!layout || !reloj) return null;
    const arco = layout.elementos[elemento]?.nodos.arco[nodoLocal];
    if (arco === null || arco === undefined) return null;
    const n = reloj.cantidad;
    if (n < 2 || arco < reloj.arco[0]! - 1e-12 || arco > reloj.arco[n - 1]! + 1e-12) return null;
    let k = buscar(reloj.arco, n, arco);
    if (k >= n - 1) k = n - 2;
    const ds = reloj.arco[k + 1]! - reloj.arco[k]!;
    const a = ds > 0 ? Math.min(Math.max((arco - reloj.arco[k]!) / ds, 0), 1) : 0;
    return reloj.tiempo[k]! * (1 - a) + reloj.tiempo[k + 1]! * a;
  }

  mostrar(visible: boolean): void {
    this.grupo.visible = visible && this.layout !== null;
  }

  /** Arma las mallas de todos los carros con la apariencia actual. */
  private armar(): void {
    this.vaciarMallas();
    const layout = this.layout;
    const tren = this.tren;
    if (!layout || !tren) return;
    const valores = layout.parametros.valores as Record<string, unknown>;
    const dimensiones = {
      largo: positivo(valores.largoCarro, 0.1),
      ancho: positivo(valores.anchoVia, 0.06),
      alto: positivo(valores.altoCarro, 0.06),
      diametroRueda: positivo(valores.diametroRueda, 0.0136),
    };
    const d = positivo(valores.distanciaHeartline, 0.03);
    this.materiales = crearMateriales(this.apariencia.color);
    this.geometriaDelPasajero = new THREE.SphereGeometry(Math.max(d * 0.35, 0.006), 16, 12);
    const materiales = this.materiales;
    const cantidad = Math.min(MAXIMO_DE_CARROS, tren.cantidad);
    for (let i = 0; i < cantidad; i++) {
      const caja = armarCarro(this.apariencia.diseno, dimensiones, (rol) => materiales.normal[rol]);
      caja.matrixAutoUpdate = false;
      const pasajero = new THREE.Mesh(this.geometriaDelPasajero, materiales.normal.pasajero);
      pasajero.userData.rol = 'pasajero';
      pasajero.position.set(0, 0, d);
      caja.add(pasajero);
      this.grupo.add(caja);
      this.cajas.push(caja);
    }
  }

  private vaciarMallas(): void {
    this.grupo.clear();
    this.cajas = [];
    if (this.materiales) {
      for (const juego of [this.materiales.normal, this.materiales.atenuado]) for (const m of Object.values(juego)) m.dispose();
    }
    this.materiales = null;
    this.geometriaDelPasajero?.dispose();
    this.geometriaDelPasajero = null;
  }

  private vaciar(): void {
    this.vaciarMallas();
    this.layout = null;
    this.via = null;
    this.tren = null;
    this.relojDelPrimero = this.relojDelUltimo = this.relojAnalizado = null;
    this.vistaAnalizada = null;
    this.grupo.visible = false;
  }
}

/** Materiales por rol, normales y atenuados (los carros que no se analizan). */
function crearMateriales(color: string): Materiales {
  const t = tema();
  const cuerpo = new THREE.Color(color);
  const frente = colorDeFrente(cuerpo, new THREE.Color(t.escenaFrenteCarro), new THREE.Color(t.escenaFrenteCarroAlterno));
  const normal: Materiales['normal'] = {
    cuerpo: new THREE.MeshStandardMaterial({ color: cuerpo, roughness: 0.45, metalness: 0.15 }),
    detalle: new THREE.MeshStandardMaterial({ color: new THREE.Color(t.escenaCarroDetalle), roughness: 0.6, metalness: 0.3 }),
    rueda: new THREE.MeshStandardMaterial({ color: new THREE.Color(t.escenaCarroRueda), roughness: 0.7, metalness: 0.2 }),
    frente: new THREE.MeshStandardMaterial({ color: frente, emissive: frente, emissiveIntensity: 0.45, roughness: 0.4 }),
    pasajero: new THREE.MeshStandardMaterial({ color: new THREE.Color(t.escenaPasajero), emissive: new THREE.Color(t.escenaPasajeroBrillo), roughness: 0.4 }),
  };
  const atenuado = Object.fromEntries(
    Object.entries(normal).map(([rol, m]) => {
      const copia = m.clone();
      copia.transparent = true;
      copia.opacity = OPACIDAD_ATENUADA;
      copia.depthWrite = false;
      return [rol, copia];
    }),
  ) as Materiales['atenuado'];
  return { normal, atenuado };
}

/** El color de la marca del frente: el que mas se aleja del color elegido para la carroceria. */
export function colorDeFrente(cuerpo: THREE.Color, preferido: THREE.Color, alterno: THREE.Color): THREE.Color {
  const distancia = (a: THREE.Color, b: THREE.Color) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
  return distancia(cuerpo, preferido) >= 0.45 || distancia(cuerpo, preferido) >= distancia(cuerpo, alterno) ? preferido : alterno;
}

/**
 * Orienta un carro con el marco de la via. Columnas de la matriz: x local =
 * T (largo), y local = L (ancho), z local = U (alto); U se reortogonaliza
 * contra T porque la interpolacion entre nodos la saca de perpendicular.
 */
function ponerEnMarco(caja: THREE.Object3D, marco: MarcoEnArco): void {
  const T = new THREE.Vector3(...marco.t).normalize();
  const U = new THREE.Vector3(...marco.u);
  U.addScaledVector(T, -U.dot(T)).normalize();
  const L = new THREE.Vector3().crossVectors(T, U);
  caja.matrix.makeBasis(T, L, U).setPosition(...marco.posicion);
  caja.matrixWorldNeedsUpdate = true;
}

function positivo(v: unknown, respaldo: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : respaldo;
}

function noNegativo(v: unknown, respaldo: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : respaldo;
}

/** Primer indice k con valores[k] <= x < valores[k+1] (busqueda binaria sobre los n primeros). */
function buscar(valores: Float64Array, n: number, x: number): number {
  let bajo = 0;
  let alto = n - 1;
  while (alto - bajo > 1) {
    const medio = (bajo + alto) >> 1;
    if (valores[medio]! <= x) bajo = medio;
    else alto = medio;
  }
  return bajo;
}
