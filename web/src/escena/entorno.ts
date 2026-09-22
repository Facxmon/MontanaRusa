// Lo que rodea a la via en la escena y sirve para LEERLA, no para adornarla:
//
//  - El piso con una grilla de escala legible: lineas finas cada 10 cm,
//    mayores cada 0,5 m y rotuladas en dos bordes. Antes era un
//    GridHelper(4, 40) fijo de 4 m sin rotulos: no se podia leer una medida.
//    Ahora cubre la via y la caja disponible, redondeado a 0,5 m.
//  - La caja disponible (BoundingBoxDisponible) en wireframe, en verde si la
//    via entra y en rojo si se sale: conecta la vista con un criterio de
//    aceptacion real ("Dentro del bounding box disponible").
//  - La proyeccion del riel sobre el piso (z = 0): la huella que ocupa.
//
// Todo se reconstruye con cada layout (construir) y los colores salen de
// tokens.css por tema.ts, como el resto de la escena.

import * as THREE from 'three';
import type { Layout } from '../contrato/tipos';
import { tema } from '../tema';
import { aplanarNodos } from './geometriaDeVia';

type Caja = [[number, number], [number, number], [number, number]];

/** Paso de las lineas finas y de las mayores (rotuladas), en m. */
const PASO_FINO = 0.1;
const PASO_MAYOR = 0.5;
/** Alto de los rotulos, en m: una fraccion del lado mayor del piso, con un piso minimo. */
function altoDeRotulo(extremos: { x: [number, number]; y: [number, number] }): number {
  return Math.max(0.04, Math.max(extremos.x[1] - extremos.x[0], extremos.y[1] - extremos.y[0]) / 45);
}
/** La proyeccion va apenas sobre el piso para que no parpadee con la grilla. */
const ALTURA_DE_LA_PROYECCION = 0.002;

/** Extremos de la grilla: cubre las cajas dadas y se redondea a PASO_MAYOR hacia afuera (un borde justo sobre una linea mayor deja otro PASO_MAYOR de margen: la via nunca queda pegada al borde del piso). */
export function extremosDeGrilla(cajas: Caja[]): { x: [number, number]; y: [number, number] } {
  let x: [number, number] = [Infinity, -Infinity];
  let y: [number, number] = [Infinity, -Infinity];
  for (const c of cajas) {
    x = [Math.min(x[0], c[0][0]), Math.max(x[1], c[0][1])];
    y = [Math.min(y[0], c[1][0]), Math.max(y[1], c[1][1])];
  }
  if (!Number.isFinite(x[0]) || !Number.isFinite(y[0])) return { x: [-2, 2], y: [-2, 2] };
  const abajo = (v: number) => Math.floor(v / PASO_MAYOR - 1e-9) * PASO_MAYOR;
  const arriba = (v: number) => Math.ceil(v / PASO_MAYOR + 1e-9) * PASO_MAYOR;
  return { x: [abajo(x[0]), arriba(x[1])], y: [abajo(y[0]), arriba(y[1])] };
}

/** true si la caja `dentro` cabe en `fuera` (con tolerancia de un milimetro). */
export function cabe(dentro: Caja, fuera: Caja): boolean {
  return dentro.every(([a, b], i) => a >= fuera[i]![0] - 1e-3 && b <= fuera[i]![1] + 1e-3);
}

/** "0,5 m", "-1 m", "1,5 m": el rotulo de una linea mayor, con coma decimal. */
export function rotuloDeMetros(v: number): string {
  const redondeado = Math.round(v * 10) / 10;
  return `${String(redondeado === 0 ? 0 : redondeado).replace('.', ',')} m`;
}

function segmentos(puntos: number[], color: string, opacidad = 1): THREE.LineSegments {
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute('position', new THREE.Float32BufferAttribute(puntos, 3));
  return new THREE.LineSegments(
    geometria,
    new THREE.LineBasicMaterial({ color: new THREE.Color(color), transparent: opacidad < 1, opacity: opacidad }),
  );
}

/** Un texto como sprite: siempre de frente a la camara. */
function rotulo(texto: string, color: string, altoEnMetros: number): THREE.Sprite {
  const t = tema();
  const escala = 4;
  const lienzo = document.createElement('canvas');
  const contexto = lienzo.getContext('2d')!;
  const fuente = `${parseFloat(t.textoXs) * escala}px ${t.mono}`;
  contexto.font = fuente;
  const ancho = Math.ceil(contexto.measureText(texto).width) + 4 * escala;
  const alto = Math.ceil(parseFloat(t.textoXs) * escala * 1.4);
  lienzo.width = ancho;
  lienzo.height = alto;
  contexto.font = fuente;
  contexto.fillStyle = color;
  contexto.textBaseline = 'middle';
  contexto.fillText(texto, 2 * escala, alto / 2);
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textura, transparent: true, depthWrite: false }));
  sprite.scale.set((altoEnMetros * ancho) / alto, altoEnMetros, 1);
  return sprite;
}

export class Entorno {
  private readonly grupo = new THREE.Group();

  constructor(scene: THREE.Scene) {
    scene.add(this.grupo);
    this.construir(null);
  }

  destruir(): void {
    this.vaciar();
    this.grupo.removeFromParent();
  }

  /** Rehace piso, caja y proyeccion para el layout (o solo un piso de 4 x 4 m sin layout). */
  construir(layout: Layout | null): void {
    this.vaciar();
    const t = tema();
    const disponible = (layout?.parametros.valores.boundingBoxDisponible as Caja | undefined) ?? null;
    const delLayout = layout?.resumenLayout.boundingBox ?? null;
    const extremos = extremosDeGrilla([delLayout, disponible].filter((c): c is Caja => c !== null));
    const alto = altoDeRotulo(extremos);
    this.grilla(extremos, alto, t.escenaGrilla, t.escenaGrillaFuerte, t.escenaRotulo);

    if (layout && disponible) {
      const entra = delLayout ? cabe(delLayout, disponible) : true;
      const caja = new THREE.Box3(
        new THREE.Vector3(disponible[0][0], disponible[1][0], disponible[2][0]),
        new THREE.Vector3(disponible[0][1], disponible[1][1], disponible[2][1]),
      );
      const color = entra ? t.escenaCaja : t.escenaCajaFuera;
      const aristas = new THREE.Box3Helper(caja, new THREE.Color(color));
      (aristas.material as THREE.LineBasicMaterial).transparent = true;
      (aristas.material as THREE.LineBasicMaterial).opacity = 0.7;
      this.grupo.add(aristas);
      const nombre = rotulo(entra ? 'caja disponible' : 'caja disponible: la vía se sale', color, alto);
      nombre.position.set(disponible[0][0], disponible[1][1], disponible[2][1] + alto / 2);
      nombre.center.set(0, 0);
      this.grupo.add(nombre);
    }

    if (layout) {
      // La proyeccion del riel sobre el piso: una polilinea por elemento (sin unir entre elementos no hace falta: son continuos).
      const nodos = aplanarNodos(layout);
      const puntos: number[] = [];
      for (let k = 0; k < nodos.cantidad; k++) puntos.push(nodos.riel[3 * k]!, nodos.riel[3 * k + 1]!, ALTURA_DE_LA_PROYECCION);
      const geometria = new THREE.BufferGeometry();
      geometria.setAttribute('position', new THREE.Float32BufferAttribute(puntos, 3));
      this.grupo.add(new THREE.Line(geometria, new THREE.LineBasicMaterial({ color: new THREE.Color(t.escenaProyeccion), transparent: true, opacity: 0.45 })));
    }
  }

  private grilla(extremos: { x: [number, number]; y: [number, number] }, alto: number, fina: string, mayor: string, colorDeRotulo: string): void {
    const { x, y } = extremos;
    const finas: number[] = [];
    const mayores: number[] = [];
    const esMayor = (v: number) => Math.abs(v / PASO_MAYOR - Math.round(v / PASO_MAYOR)) < 1e-6;
    const pasos = (desde: number, hasta: number) => {
      const lista: number[] = [];
      for (let i = 0; desde + i * PASO_FINO <= hasta + 1e-9; i++) lista.push(desde + i * PASO_FINO);
      return lista;
    };
    for (const vx of pasos(x[0], x[1])) (esMayor(vx) ? mayores : finas).push(vx, y[0], 0, vx, y[1], 0);
    for (const vy of pasos(y[0], y[1])) (esMayor(vy) ? mayores : finas).push(x[0], vy, 0, x[1], vy, 0);
    this.grupo.add(segmentos(finas, fina));
    this.grupo.add(segmentos(mayores, mayor));

    // Rotulos de las lineas mayores sobre el borde de y minimo (las x) y el de x minimo (las y).
    for (const vx of pasos(x[0], x[1]).filter(esMayor)) {
      const r = rotulo(rotuloDeMetros(vx), colorDeRotulo, alto);
      r.position.set(vx, y[0] - alto, 0);
      this.grupo.add(r);
    }
    for (const vy of pasos(y[0], y[1]).filter(esMayor)) {
      if (Math.abs(vy - y[0]) < 1e-9) continue; // la esquina ya tiene el rotulo de x
      const r = rotulo(rotuloDeMetros(vy), colorDeRotulo, alto);
      r.position.set(x[0] - alto / 2, vy, 0);
      r.center.set(1, 0.5);
      this.grupo.add(r);
    }
  }

  private vaciar(): void {
    this.grupo.traverse((objeto) => {
      const conGeometria = objeto as THREE.Mesh;
      conGeometria.geometry?.dispose();
      const material = conGeometria.material as THREE.Material | undefined;
      if (material) {
        (material as THREE.SpriteMaterial).map?.dispose();
        material.dispose();
      }
    });
    this.grupo.clear();
  }
}
