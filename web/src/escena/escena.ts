// Escena Three.js: renderer, camara orbital, luces, piso y encuadre. Lo que
// se dibuja adentro (la via) lo maneja Via; esta clase no sabe del contrato.
//
// El contrato usa z hacia arriba (SI, como el MATLAB); Three.js por defecto
// usa y. Se pone la camara con up = z y se acuesta la grilla en el plano xy,
// asi las coordenadas del JSON se usan tal cual, sin permutar ejes.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { curvaCubica, milisegundos, movimientoReducido, tema, type Tema } from '../tema';

export type BoundingBox = [[number, number], [number, number], [number, number]];

export class Escena {
  readonly scene = new THREE.Scene();
  readonly camara: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controles: OrbitControls;
  private readonly contenedor: HTMLElement;
  /** Gizmo de ejes: una escena y una camara propias, dibujadas en una esquina. */
  private readonly gizmo = new THREE.Scene();
  private readonly camaraDelGizmo = new THREE.OrthographicCamera(-1.4, 1.4, 1.4, -1.4, 0.1, 10);
  private readonly reloj = new THREE.Clock();
  private readonly porCuadro: ((dt: number) => void)[] = [];
  private readonly observador: ResizeObserver;
  /** Encuadre en curso: la camara vuela de una vista a otra en vez de saltar. */
  private vuelo: {
    desdePosicion: THREE.Vector3;
    desdeObjetivo: THREE.Vector3;
    haciaPosicion: THREE.Vector3;
    haciaObjetivo: THREE.Vector3;
    inicio: number;
    duracion: number;
    curva: (t: number) => number;
  } | null = null;
  private yaEncuadro = false;

  constructor(contenedor: HTMLElement) {
    this.contenedor = contenedor;
    const t = tema();
    this.scene.background = fondoEnGradiente(t.escenaFondoArriba, t.escenaFondo);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // ACES + salida sRGB: el tubo coloreado por magnitud se lee mejor que con
    // los defaults (los extremos de la escala no se queman). Los colores de
    // vertice van en lineal (colores.bufferALineal) para que coincidan con la
    // barra de la leyenda.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.autoClear = false;
    contenedor.appendChild(this.renderer.domElement);

    this.camara = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
    this.camara.up.set(0, 0, 1);
    this.camara.position.set(3, -3, 2);

    this.controles = new OrbitControls(this.camara, this.renderer.domElement);
    this.controles.enableDamping = true;
    this.controles.dampingFactor = 0.08;
    // Si el usuario agarra la camara a mitad de un vuelo, gana el usuario.
    this.controles.addEventListener('start', () => (this.vuelo = null));

    this.scene.add(new THREE.HemisphereLight(new THREE.Color(t.escenaCielo), new THREE.Color(t.escenaSuelo), 1.1));
    const sol = new THREE.DirectionalLight(new THREE.Color(t.escenaSol), 1.4);
    sol.position.set(2, -3, 5);
    this.scene.add(sol);
    const contraluz = new THREE.DirectionalLight(new THREE.Color(t.escenaContraluz), 0.5);
    contraluz.position.set(-3, 2, 1);
    this.scene.add(contraluz);

    // El piso, la grilla rotulada y la caja disponible los dibuja Entorno.
    armarGizmo(this.gizmo, t);

    this.ajustarTamano();
    this.observador = new ResizeObserver(() => this.ajustarTamano());
    this.observador.observe(contenedor);
    this.activar(true);
  }

  /** Para el loop, suelta el contexto WebGL y saca el canvas: no queda nada vivo. */
  destruir(): void {
    this.activar(false);
    this.porCuadro.length = 0;
    this.observador.disconnect();
    this.controles.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  /** Arranca o pausa el loop de render (pausado mientras la vista 3D esta oculta). */
  activar(activa: boolean): void {
    if (activa) {
      this.reloj.getDelta();
      this.renderer.setAnimationLoop(() => {
        const dt = this.reloj.getDelta();
        for (const fn of this.porCuadro) fn(dt);
        this.avanzarVuelo();
        this.controles.update();
        this.dibujar();
      });
    } else {
      this.renderer.setAnimationLoop(null);
    }
  }

  /** Registra algo que se actualiza en cada cuadro (dt en segundos); devuelve como sacarlo. */
  enCadaCuadro(fn: (dt: number) => void): () => void {
    this.porCuadro.push(fn);
    return () => {
      const i = this.porCuadro.indexOf(fn);
      if (i >= 0) this.porCuadro.splice(i, 1);
    };
  }

  /**
   * La vista (la camara donde este) como PNG de 2560 x 1440. Sin
   * preserveDrawingBuffer, que costaria rendimiento en cada cuadro: se hace
   * render() y toDataURL() en el mismo tick, antes de que el navegador
   * limpie el buffer. El tamano es fijo y no el del contenedor para que la
   * imagen sirva impresa aunque la ventana este chica o la vista 3D
   * escondida (con la pestana de graficos al frente el contenedor mide 0);
   * despues se restaura el tamano de pantalla.
   */
  async capturar(ancho = 1280, alto = 720, escala = 2): Promise<Blob> {
    const ratioDePantalla = this.renderer.getPixelRatio();
    const aspectoDePantalla = this.camara.aspect;
    let datos: string;
    try {
      this.renderer.setPixelRatio(escala);
      this.renderer.setSize(ancho, alto, false);
      this.camara.aspect = ancho / alto;
      this.camara.updateProjectionMatrix();
      this.dibujar();
      datos = this.renderer.domElement.toDataURL('image/png');
    } finally {
      this.renderer.setPixelRatio(ratioDePantalla);
      this.camara.aspect = aspectoDePantalla;
      this.ajustarTamano();
      this.dibujar();
    }
    const respuesta = await fetch(datos);
    return respuesta.blob();
  }

  /**
   * Un cuadro: la escena y, encima, el gizmo de ejes en la esquina superior
   * izquierda (abajo esta el reproductor), con la orientacion de la camara.
   */
  private dibujar(): void {
    const r = this.renderer;
    const tamano = r.getSize(new THREE.Vector2());
    r.setViewport(0, 0, tamano.x, tamano.y);
    r.setScissorTest(false);
    r.clear();
    r.render(this.scene, this.camara);
    const lado = Math.round(Math.min(96, tamano.x / 5, tamano.y / 4));
    if (lado < 40) return;
    const margen = 8;
    this.camaraDelGizmo.position.set(0, 0, 4).applyQuaternion(this.camara.quaternion);
    this.camaraDelGizmo.quaternion.copy(this.camara.quaternion);
    r.setViewport(margen, tamano.y - lado - margen, lado, lado);
    r.setScissor(margen, tamano.y - lado - margen, lado, lado);
    r.setScissorTest(true);
    r.clearDepth();
    r.render(this.gizmo, this.camaraDelGizmo);
    r.setScissorTest(false);
    r.setViewport(0, 0, tamano.x, tamano.y);
  }

  /** Mueve el centro de la orbita a un punto conservando la posicion relativa de la camara. */
  centrarEn(punto: THREE.Vector3): void {
    const desplazamiento = new THREE.Vector3().subVectors(this.camara.position, this.controles.target);
    this.controles.target.copy(punto);
    this.camara.position.copy(punto).add(desplazamiento);
  }

  private ajustarTamano(): void {
    const ancho = Math.max(1, this.contenedor.clientWidth);
    const alto = Math.max(1, this.contenedor.clientHeight);
    this.renderer.setSize(ancho, alto, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camara.aspect = ancho / alto;
    this.camara.updateProjectionMatrix();
  }

  /**
   * Encuadra la caja [[xmin,xmax],[ymin,ymax],[zmin,zmax]] desde una
   * diagonal. Salvo la primera vez (no hay de donde venir) o con movimiento
   * reducido, la camara interpola posicion y centro de la orbita en
   * --dur-lenta con --curva: el salto instantaneo desorientaba al elegir un
   * elemento, y es la mejora de calidad percibida mas barata de la fase 4.
   */
  encuadrar(caja: BoundingBox): void {
    const centro = new THREE.Vector3(
      (caja[0][0] + caja[0][1]) / 2,
      (caja[1][0] + caja[1][1]) / 2,
      (caja[2][0] + caja[2][1]) / 2,
    );
    const diagonal = Math.hypot(caja[0][1] - caja[0][0], caja[1][1] - caja[1][0], caja[2][1] - caja[2][0]);
    const radio = Math.max(diagonal / 2, 0.2);
    const distancia = radio / Math.sin(THREE.MathUtils.degToRad(this.camara.fov / 2));
    const direccion = new THREE.Vector3(1, -1.2, 0.7).normalize();
    const posicion = centro.clone().addScaledVector(direccion, distancia * 1.1);
    // near/far cubren las dos vistas durante el vuelo: nada se recorta en el camino.
    const distanciaActual = this.camara.position.distanceTo(this.controles.target);
    const animar = this.yaEncuadro && !movimientoReducido();
    this.camara.near = (animar ? Math.min(distancia, distanciaActual) : distancia) / 100;
    this.camara.far = (animar ? Math.max(distancia, distanciaActual) : distancia) * 20;
    this.camara.updateProjectionMatrix();
    this.yaEncuadro = true;
    if (!animar) {
      this.vuelo = null;
      this.camara.position.copy(posicion);
      this.controles.target.copy(centro);
      this.controles.update();
      return;
    }
    const t = tema();
    this.vuelo = {
      desdePosicion: this.camara.position.clone(),
      desdeObjetivo: this.controles.target.clone(),
      haciaPosicion: posicion,
      haciaObjetivo: centro,
      inicio: performance.now(),
      duracion: milisegundos(t.durLenta),
      curva: curvaCubica(t.curva),
    };
  }

  private avanzarVuelo(): void {
    const v = this.vuelo;
    if (!v) return;
    const avance = Math.min(1, (performance.now() - v.inicio) / v.duracion);
    const f = v.curva(avance);
    this.camara.position.lerpVectors(v.desdePosicion, v.haciaPosicion, f);
    this.controles.target.lerpVectors(v.desdeObjetivo, v.haciaObjetivo, f);
    if (avance >= 1) {
      this.vuelo = null;
      // Terminado el vuelo, near/far vuelven a los de la vista final.
      const distancia = v.haciaPosicion.distanceTo(v.haciaObjetivo) / 1.1;
      this.camara.near = distancia / 100;
      this.camara.far = distancia * 20;
      this.camara.updateProjectionMatrix();
    }
  }
}

/** Fondo con un gradiente vertical suave (arriba mas claro), como textura: sale igual en la captura PNG. */
function fondoEnGradiente(arriba: string, abajo: string): THREE.Texture {
  const lienzo = document.createElement('canvas');
  lienzo.width = 2;
  lienzo.height = 256;
  const contexto = lienzo.getContext('2d')!;
  const gradiente = contexto.createLinearGradient(0, 0, 0, lienzo.height);
  gradiente.addColorStop(0, arriba);
  gradiente.addColorStop(1, abajo);
  contexto.fillStyle = gradiente;
  contexto.fillRect(0, 0, lienzo.width, lienzo.height);
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

/** Tres flechas x, y, z con su letra, en los colores de los tokens (sin iluminacion: siempre legibles). */
function armarGizmo(escena: THREE.Scene, t: Tema): void {
  const ejes: [THREE.Vector3, string, string][] = [
    [new THREE.Vector3(1, 0, 0), t.escenaEjeX, 'x'],
    [new THREE.Vector3(0, 1, 0), t.escenaEjeY, 'y'],
    [new THREE.Vector3(0, 0, 1), t.escenaEjeZ, 'z'],
  ];
  for (const [direccion, color, letra] of ejes) {
    escena.add(new THREE.ArrowHelper(direccion, new THREE.Vector3(), 0.85, new THREE.Color(color), 0.25, 0.14));
    const lienzo = document.createElement('canvas');
    lienzo.width = lienzo.height = 64;
    const contexto = lienzo.getContext('2d')!;
    contexto.font = `600 44px ${t.fuente}`;
    contexto.fillStyle = color;
    contexto.textAlign = 'center';
    contexto.textBaseline = 'middle';
    contexto.fillText(letra, 32, 34);
    const textura = new THREE.CanvasTexture(lienzo);
    textura.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textura, depthTest: false }));
    sprite.position.copy(direccion).multiplyScalar(1.15);
    sprite.scale.set(0.45, 0.45, 1);
    escena.add(sprite);
  }
}
