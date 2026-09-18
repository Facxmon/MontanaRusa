// Escena Three.js: renderer, camara orbital, luces, piso y encuadre. Lo que
// se dibuja adentro (la via) lo maneja Via; esta clase no sabe del contrato.
//
// El contrato usa z hacia arriba (SI, como el MATLAB); Three.js por defecto
// usa y. Se pone la camara con up = z y se acuesta la grilla en el plano xy,
// asi las coordenadas del JSON se usan tal cual, sin permutar ejes.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type BoundingBox = [[number, number], [number, number], [number, number]];

export class Escena {
  readonly scene = new THREE.Scene();
  readonly camara: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controles: OrbitControls;
  private readonly contenedor: HTMLElement;
  private readonly grilla: THREE.GridHelper;

  constructor(contenedor: HTMLElement) {
    this.contenedor = contenedor;
    this.scene.background = new THREE.Color(0x0f1115);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    contenedor.appendChild(this.renderer.domElement);

    this.camara = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
    this.camara.up.set(0, 0, 1);
    this.camara.position.set(3, -3, 2);

    this.controles = new OrbitControls(this.camara, this.renderer.domElement);
    this.controles.enableDamping = true;
    this.controles.dampingFactor = 0.08;

    this.scene.add(new THREE.HemisphereLight(0xdfe6f2, 0x1a1d24, 1.1));
    const sol = new THREE.DirectionalLight(0xffffff, 1.4);
    sol.position.set(2, -3, 5);
    this.scene.add(sol);
    const contraluz = new THREE.DirectionalLight(0x8aa4c8, 0.5);
    contraluz.position.set(-3, 2, 1);
    this.scene.add(contraluz);

    // Piso en z = 0: cuadricula de 10 cm sobre 4 x 4 m. Si la via lo cruza, se ve.
    this.grilla = new THREE.GridHelper(4, 40, 0x3a4150, 0x232833);
    this.grilla.rotation.x = Math.PI / 2;
    this.scene.add(this.grilla);
    this.scene.add(new THREE.AxesHelper(0.25));

    this.ajustarTamano();
    new ResizeObserver(() => this.ajustarTamano()).observe(contenedor);
    this.renderer.setAnimationLoop(() => {
      this.controles.update();
      this.renderer.render(this.scene, this.camara);
    });
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
