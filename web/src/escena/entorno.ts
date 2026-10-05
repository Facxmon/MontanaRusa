// Lo que rodea a la via en la escena y sirve para LEERLA, no para adornarla:
//
//  - El piso con una grilla de escala legible: lineas finas cada 10 cm,
//    mayores cada 0,5 m, y rotulos en dos bordes. Antes era un
//    GridHelper(4, 40) fijo de 4 m sin rotulos: no se podia leer una medida.
//    Los rotulos van cada metro y con tamano fijo en pantalla.
//    Ahora cubre la via y la caja disponible, redondeado a 0,5 m.
//  - La caja disponible (BoundingBoxDisponible) en wireframe, en verde si la
//    via entra y en rojo si se sale: conecta la vista con un criterio de
//    aceptacion real ("Dentro del bounding box disponible").
//  - La proyeccion del riel sobre el piso (z = 0): la huella que ocupa.
//  - Un eje vertical graduado (z) en la esquina de x e y minimos de la caja
//    disponible (o de la del layout si no hay disponible): la referencia de
//    alturas. Va de la z mas baja a la mas alta de las dos cajas y el paso
//    de las marcas sale de ese alto (1, 2, 2,5 o 5 por potencia de 10), asi
//    se rehace con cada layout y acompana la escala del diseno.
//
// La caja y la proyeccion se prenden y apagan desde los controles de la
// vista 3D (paneles/controles3d.ts): la caja arranca visible (su tamano es
// el de BoundingBoxDisponible, no se toca) y la proyeccion apagada. La
// visibilidad sobrevive a cada construir(): es una preferencia de la vista,
// no del layout.
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
/**
 * Alto de los rotulos EN PANTALLA (fraccion del alto del viewport): los
 * sprites no se achican con la distancia (sizeAttenuation: false), asi un
 * "2 m" cerca de la camara no tapa la vista y uno lejano se sigue leyendo.
 */
const ALTO_DEL_ROTULO_EN_PANTALLA = 0.018;
/** Cada cuanto se rotula: las lineas mayores van cada 0,5 m, los rotulos cada metro (a 0,5 m se amontonan en la vista general). */
const PASO_DEL_ROTULO = 1;
/** Separacion de un rotulo respecto de su linea, en m: una fraccion del piso. */
function separacionDeRotulo(extremos: { x: [number, number]; y: [number, number] }): number {
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

/** Cuantos intervalos se buscan como maximo en el eje z (con el paso redondo quedan entre 2 y 5). */
const MARCAS_DEL_EJE_Z = 5;

/**
 * Paso "redondo" (1, 2, 2,5 o 5 por una potencia de 10) para graduar un
 * alto: el menor que deja a lo sumo MARCAS_DEL_EJE_Z intervalos. Puro.
 */
export function pasoDeGraduacion(alto: number, marcas = MARCAS_DEL_EJE_Z): number {
  if (!(alto > 0) || !Number.isFinite(alto)) return 0.1;
  const crudo = alto / marcas;
  const potencia = 10 ** Math.floor(Math.log10(crudo));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * potencia >= crudo) return m * potencia;
  }
  return 10 * potencia;
}

/** Marcas del eje z: multiplos del paso que cubren [desde, hasta] hacia afuera. Puro. */
export function marcasDelEjeZ(desde: number, hasta: number): { paso: number; marcas: number[] } {
  const paso = pasoDeGraduacion(hasta - desde);
  const primera = Math.floor(desde / paso + 1e-9);
  const ultima = Math.ceil(hasta / paso - 1e-9);
  const marcas: number[] = [];
  for (let i = primera; i <= ultima; i++) marcas.push(Number((i * paso).toPrecision(12)));
  return { paso, marcas };
}

/** "0,25 m", "-0,1 m": el rotulo de una marca del eje z, con los decimales del paso. */
export function rotuloDeAltura(v: number, paso: number): string {
  // Los decimales justos para escribir el paso (0,25 -> 2; 0,5 -> 1; 2 -> 0).
  let decimales = 0;
  while (decimales < 6 && Math.abs(Math.round(paso * 10 ** decimales) - paso * 10 ** decimales) > 1e-6) decimales++;
  const texto = (Math.abs(v) < paso * 1e-6 ? 0 : v).toFixed(decimales);
  return `${texto.replace('.', ',')} m`;
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
function rotulo(texto: string, color: string): THREE.Sprite {
  const t = tema();
  const escala = 4;
  const lienzo = document.createElement('canvas');
  const contexto = lienzo.getContext('2d')!;
  const fuente = `${parseFloat(t.textoXs) * escala}px ${t.fuente}`;
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
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textura, transparent: true, depthWrite: false, sizeAttenuation: false }));
  sprite.scale.set((ALTO_DEL_ROTULO_EN_PANTALLA * ancho) / alto, ALTO_DEL_ROTULO_EN_PANTALLA, 1);
  return sprite;
}

export class Entorno {
  private readonly grupo = new THREE.Group();
  /** La caja disponible con su rotulo: un grupo aparte para poder ocultarla. */
  private readonly grupoDeCaja = new THREE.Group();
  /** La proyeccion del riel sobre el piso (plano XY). */
  private readonly grupoDeProyeccion = new THREE.Group();

  constructor(scene: THREE.Scene) {
    scene.add(this.grupo, this.grupoDeCaja, this.grupoDeProyeccion);
    this.grupoDeProyeccion.visible = false;
    this.construir(null);
  }

  destruir(): void {
    this.vaciar();
    for (const grupo of this.grupos()) grupo.removeFromParent();
  }

  /** Muestra u oculta la caja disponible (no cambia su tamano). */
  mostrarCaja(visible: boolean): void {
    this.grupoDeCaja.visible = visible;
  }

  /** Muestra u oculta la proyeccion del riel en el plano XY. */
  mostrarProyeccion(visible: boolean): void {
    this.grupoDeProyeccion.visible = visible;
  }

  private grupos(): THREE.Group[] {
    return [this.grupo, this.grupoDeCaja, this.grupoDeProyeccion];
  }

  /** Rehace piso, caja y proyeccion para el layout (o solo un piso de 4 x 4 m sin layout). */
  construir(layout: Layout | null): void {
    this.vaciar();
    const t = tema();
    const disponible = (layout?.parametros.valores.boundingBoxDisponible as Caja | undefined) ?? null;
    const delLayout = layout?.resumenLayout.boundingBox ?? null;
    const extremos = extremosDeGrilla([delLayout, disponible].filter((c): c is Caja => c !== null));
    const alto = separacionDeRotulo(extremos);
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
      this.grupoDeCaja.add(aristas);
      const nombre = rotulo(entra ? 'caja disponible' : 'caja disponible: la vía se sale', color);
      nombre.position.set(disponible[0][0], disponible[1][1], disponible[2][1] + alto / 2);
      nombre.center.set(0, 0);
      this.grupoDeCaja.add(nombre);
    }

    const cajaDelEje = disponible ?? delLayout;
    if (layout && cajaDelEje) {
      const abajo = Math.min(cajaDelEje[2][0], delLayout?.[2][0] ?? Infinity, 0);
      const arriba = Math.max(cajaDelEje[2][1], delLayout?.[2][1] ?? -Infinity);
      this.ejeZ(cajaDelEje[0][0], cajaDelEje[1][0], abajo, arriba, alto, t.escenaEjeZ, t.escenaRotulo);
    }

    if (layout) {
      // La proyeccion del riel sobre el piso: una polilinea por elemento (sin unir entre elementos no hace falta: son continuos).
      const nodos = aplanarNodos(layout);
      const puntos: number[] = [];
      for (let k = 0; k < nodos.cantidad; k++) puntos.push(nodos.riel[3 * k]!, nodos.riel[3 * k + 1]!, ALTURA_DE_LA_PROYECCION);
      const geometria = new THREE.BufferGeometry();
      geometria.setAttribute('position', new THREE.Float32BufferAttribute(puntos, 3));
      this.grupoDeProyeccion.add(new THREE.Line(geometria, new THREE.LineBasicMaterial({ color: new THREE.Color(t.escenaProyeccion), transparent: true, opacity: 0.45 })));
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

    // Rotulos cada metro sobre el borde de y minimo (las x) y el de x minimo (las y).
    const rotulada = (v: number) => Math.abs(v / PASO_DEL_ROTULO - Math.round(v / PASO_DEL_ROTULO)) < 1e-6;
    for (const vx of pasos(x[0], x[1]).filter(rotulada)) {
      const r = rotulo(rotuloDeMetros(vx), colorDeRotulo);
      r.position.set(vx, y[0] - alto, 0);
      this.grupo.add(r);
    }
    for (const vy of pasos(y[0], y[1]).filter(rotulada)) {
      if (Math.abs(vy - y[0]) < 1e-9) continue; // la esquina ya tiene el rotulo de x
      const r = rotulo(rotuloDeMetros(vy), colorDeRotulo);
      r.position.set(x[0] - alto / 2, vy, 0);
      r.center.set(1, 0.5);
      this.grupo.add(r);
    }
  }

  /**
   * Eje vertical graduado en (x, y): la linea, una marca por paso (hacia -x,
   * rotulada) y media marca sin rotulo entre dos, mas el nombre "z" arriba.
   */
  private ejeZ(x: number, y: number, desde: number, hasta: number, separacion: number, color: string, colorDeRotulo: string): void {
    const { paso, marcas } = marcasDelEjeZ(desde, hasta);
    const largo = separacion * 0.6;
    const linea: number[] = [x, y, marcas[0]!, x, y, marcas[marcas.length - 1]!];
    for (const [i, z] of marcas.entries()) {
      linea.push(x, y, z, x - largo, y, z);
      if (i < marcas.length - 1) linea.push(x, y, z + paso / 2, x - largo / 2, y, z + paso / 2);
      const r = rotulo(rotuloDeAltura(z, paso), colorDeRotulo);
      r.position.set(x - largo * 1.4, y, z);
      r.center.set(1, 0.5);
      this.grupo.add(r);
    }
    this.grupo.add(segmentos(linea, color));
    const nombre = rotulo('z', color);
    nombre.position.set(x, y, marcas[marcas.length - 1]! + separacion / 2);
    nombre.center.set(0.5, 0);
    this.grupo.add(nombre);
  }

  private vaciar(): void {
    for (const grupo of this.grupos()) {
      grupo.traverse((objeto) => {
        const conGeometria = objeto as THREE.Mesh;
        conGeometria.geometry?.dispose();
        const material = conGeometria.material as THREE.Material | undefined;
        if (material) {
          (material as THREE.SpriteMaterial).map?.dispose();
          material.dispose();
        }
      });
      grupo.clear();
    }
  }
}
