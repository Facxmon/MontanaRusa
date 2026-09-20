// Escena Three.js: renderer, camara orbital, luces, piso y encuadre. Lo que
// se dibuja adentro (la via) lo maneja Via; esta clase no sabe del contrato.
//
// El contrato usa z hacia arriba (SI, como el MATLAB); Three.js por defecto
// usa y. Se pone la camara con up = z y se acuesta la grilla en el plano xy,
// asi las coordenadas del JSON se usan tal cual, sin permutar ejes.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { tema } from '../tema';

export type BoundingBox = [[number, number], [number, number], [number, number]];

export class Escena {
  readonly scene = new THREE.Scene();
  readonly camara: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controles: OrbitControls;
  private readonly contenedor: HTMLElement;
  private readonly grilla: THREE.GridHelper;
  private readonly reloj = new THREE.Clock();
  private readonly porCuadro: ((dt: number) => void)[] = [];
  private readonly observador: ResizeObserver;

  constructor(contenedor: HTMLElement) {
    this.contenedor = contenedor;
    const t = tema();
    this.scene.background = new THREE.Color(t.escenaFondo);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    contenedor.appendChild(this.renderer.domElement);

    this.camara = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
    this.camara.up.set(0, 0, 1);
    this.camara.position.set(3, -3, 2);

    this.controles = new OrbitControls(this.camara, this.renderer.domElement);
    this.controles.enableDamping = true;
    this.controles.dampingFactor = 0.08;

    this.scene.add(new THREE.HemisphereLight(new THREE.Color(t.escenaCielo), new THREE.Color(t.escenaSuelo), 1.1));
    const sol = new THREE.DirectionalLight(new THREE.Color(t.escenaSol), 1.4);
    sol.position.set(2, -3, 5);
    this.scene.add(sol);
    const contraluz = new THREE.DirectionalLight(new THREE.Color(t.escenaContraluz), 0.5);
    contraluz.position.set(-3, 2, 1);
    this.scene.add(contraluz);

    // Piso en z = 0: cuadricula de 10 cm sobre 4 x 4 m. Si la via lo cruza, se ve.
    this.grilla = new THREE.GridHelper(4, 40, new THREE.Color(t.escenaGrillaFuerte), new THREE.Color(t.escenaGrilla));
    this.grilla.rotation.x = Math.PI / 2;
    this.scene.add(this.grilla);
    this.scene.add(new THREE.AxesHelper(0.25));

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
        this.controles.update();
        this.renderer.render(this.scene, this.camara);
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

  /** Encuadra la caja [[xmin,xmax],[ymin,ymax],[zmin,zmax]] desde una diagonal. */
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
    this.camara.position.copy(centro).addScaledVector(direccion, distancia * 1.1);
    this.camara.near = distancia / 100;
    this.camara.far = distancia * 20;
    this.camara.updateProjectionMatrix();
    this.controles.target.copy(centro);
    this.controles.update();
  }
}
