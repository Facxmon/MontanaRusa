// Los tres diseños del carro. Cada uno se modela UNA vez en unidades
// normalizadas (la caja del carro es x en [-0.5, 0.5] con el frente en +x,
// y en [-0.5, 0.5], z en [0, 1] desde el riel) y se escala a las
// dimensiones del modelo (LargoCarro x AnchoVia x AltoCarro) en vez de
// regenerarse: las geometrías se crean una sola vez por diseño y las
// comparten todos los carros del tren y todos los layouts.
//
// Escalar todo de forma no uniforme deformaría lo redondo (una rueda
// ovalada). Por eso cada pieza dice cómo se escala:
//   - 'cuerpo': se estira a largo x ancho x alto (carrocería, asientos,
//     barra, placa del frente);
//   - 'uniforme': conserva la forma; se escala por un tamaño propio (el
//     diámetro de rueda del modelo, o una fracción de la dimensión menor) y
//     se ubica en un punto de anclaje que sí se estira con la caja.
//
// Los colores no viven acá: cada pieza tiene un ROL (cuerpo, detalle,
// frente, rueda) y carro.ts le asigna el material del rol.

import * as THREE from 'three';

export type DisenoDeCarro = 'clasico' | 'aerodinamico' | 'vagoneta';

export const DISENOS_DE_CARRO: readonly { clave: DisenoDeCarro; nombre: string; descripcion: string }[] = [
  { clave: 'clasico', nombre: 'Clásico', descripcion: 'Abierto, con trompa redondeada, asientos y barra de seguridad' },
  { clave: 'aerodinamico', nombre: 'Aerodinámico', descripcion: 'Cápsula con nariz en punta, cabina y aleta' },
  { clave: 'vagoneta', nombre: 'Vagoneta', descripcion: 'Vagón minero de caja trapezoidal, con remaches y ruedas grandes' },
];

export const DISENO_POR_DEFECTO: DisenoDeCarro = 'clasico';

export type RolDePieza = 'cuerpo' | 'detalle' | 'frente' | 'rueda';

export interface Pieza {
  geometria: THREE.BufferGeometry;
  rol: RolDePieza;
  escala: 'cuerpo' | 'uniforme';
  /** Solo 'uniforme': punto de anclaje en unidades de la caja. */
  ancla?: [number, number, number];
  /** Solo 'uniforme': de qué depende su tamaño. */
  tamano?: { de: 'rueda'; factor: number } | { de: 'menor'; factor: number };
}

/** Dimensiones reales del carro, en m. */
export interface DimensionesDelCarro {
  largo: number;
  ancho: number;
  alto: number;
  diametroRueda: number;
}

const PLANTILLAS = new Map<DisenoDeCarro, Pieza[]>();

/** Las piezas del diseño, en unidades normalizadas. Se arman una sola vez. */
export function plantillaDe(diseno: DisenoDeCarro): Pieza[] {
  let plantilla = PLANTILLAS.get(diseno);
  if (!plantilla) {
    plantilla = diseno === 'aerodinamico' ? aerodinamico() : diseno === 'vagoneta' ? vagoneta() : clasico();
    PLANTILLAS.set(diseno, plantilla);
  }
  return plantilla;
}

export function esDisenoDeCarro(valor: unknown): valor is DisenoDeCarro {
  return DISENOS_DE_CARRO.some((d) => d.clave === valor);
}

/**
 * Un carro con esas dimensiones: un grupo cuyo marco local es el del carro
 * (x = T, y = L, z = U) con el origen sobre el riel, en el medio del largo.
 * `material` da el material de cada rol. Las geometrías son las de la
 * plantilla (compartidas): no hay que liberarlas por carro.
 */
export function armarCarro(diseno: DisenoDeCarro, dimensiones: DimensionesDelCarro, material: (rol: RolDePieza) => THREE.Material): THREE.Group {
  const grupo = new THREE.Group();
  const cuerpo = new THREE.Group();
  cuerpo.scale.set(dimensiones.largo, dimensiones.ancho, dimensiones.alto);
  grupo.add(cuerpo);
  const menor = Math.min(dimensiones.largo, dimensiones.ancho, dimensiones.alto);
  for (const pieza of plantillaDe(diseno)) {
    const malla = new THREE.Mesh(pieza.geometria, material(pieza.rol));
    malla.userData.rol = pieza.rol;
    if (pieza.escala === 'cuerpo') {
      cuerpo.add(malla);
      continue;
    }
    const [ax, ay, az] = pieza.ancla ?? [0, 0, 0];
    malla.position.set(ax * dimensiones.largo, ay * dimensiones.ancho, az * dimensiones.alto);
    const tamano = pieza.tamano?.de === 'rueda' ? dimensiones.diametroRueda * pieza.tamano.factor : menor * (pieza.tamano?.factor ?? 0.1);
    malla.scale.setScalar(tamano);
    grupo.add(malla);
  }
  return grupo;
}

// ------------------------------------------------------------ utilidades de modelado

/** Caja entre dos esquinas, en unidades de la caja del carro. */
function caja(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

/**
 * Perfil de costado (puntos x, z) extruido a lo ancho entre y0 e y1. Es la
 * forma barata de dar silueta: el perfil se dibuja una vez.
 */
function perfilExtruido(puntos: [number, number][], y0: number, y1: number, bisel = 0): THREE.BufferGeometry {
  const forma = new THREE.Shape(puntos.map(([x, z]) => new THREE.Vector2(x, z)));
  const profundidad = y1 - y0;
  const g = new THREE.ExtrudeGeometry(forma, {
    depth: profundidad,
    bevelEnabled: bisel > 0,
    bevelThickness: bisel,
    bevelSize: bisel,
    bevelSegments: 2,
    curveSegments: 12,
  });
  // La forma vive en (x, y) y se extruye en +z: z pasa a ser el ancho (y del carro) y y la altura.
  g.rotateX(Math.PI / 2);
  g.translate(0, y1, 0);
  return g;
}

/** Rueda de diámetro 1 con el eje sobre y (el lateral del carro). */
function rueda(): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(0.5, 0.5, 0.45, 18);
}

/** Cuatro ruedas en los costados, a la altura z y en +-x. */
function ruedas(x: number, y: number, z: number, factor: number): Pieza[] {
  const geometria = rueda();
  const piezas: Pieza[] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      piezas.push({ geometria, rol: 'rueda', escala: 'uniforme', ancla: [sx * x, sy * y, z], tamano: { de: 'rueda', factor } });
    }
  }
  return piezas;
}

// ------------------------------------------------------------ los tres diseños

/** Abierto, con trompa redondeada que sube adelante, respaldo atrás, dos asientos y barra. */
function clasico(): Pieza[] {
  const costado: [number, number][] = [
    [-0.5, 0.16], [-0.5, 0.8], [-0.44, 0.84], [-0.36, 0.56], [0.12, 0.52], [0.26, 0.64], [0.42, 0.6], [0.5, 0.42], [0.5, 0.16],
  ];
  const trompa: [number, number][] = [[0.1, 0.16], [0.1, 0.52], [0.26, 0.64], [0.42, 0.6], [0.5, 0.42], [0.5, 0.16]];
  const barra = new THREE.CylinderGeometry(0.035, 0.035, 0.84, 10);
  barra.translate(-0.02, 0, 0.6);
  const piezas: Pieza[] = [
    { geometria: caja(-0.5, 0.5, -0.5, 0.5, 0.0, 0.16), rol: 'detalle', escala: 'cuerpo' },
    { geometria: perfilExtruido(costado, -0.5, -0.4, 0.01), rol: 'cuerpo', escala: 'cuerpo' },
    { geometria: perfilExtruido(costado, 0.4, 0.5, 0.01), rol: 'cuerpo', escala: 'cuerpo' },
    { geometria: perfilExtruido(trompa, -0.4, 0.4), rol: 'cuerpo', escala: 'cuerpo' },
    { geometria: caja(-0.5, -0.42, -0.4, 0.4, 0.16, 0.8), rol: 'cuerpo', escala: 'cuerpo' },
    // Asientos: almohadón y respaldo, dos lugares.
    { geometria: caja(-0.4, -0.06, -0.38, -0.02, 0.16, 0.28), rol: 'detalle', escala: 'cuerpo' },
    { geometria: caja(-0.4, -0.06, 0.02, 0.38, 0.16, 0.28), rol: 'detalle', escala: 'cuerpo' },
    { geometria: caja(-0.42, -0.34, -0.38, 0.38, 0.28, 0.66), rol: 'detalle', escala: 'cuerpo' },
    // Barra de seguridad, de lado a lado.
    { geometria: barra, rol: 'detalle', escala: 'cuerpo' },
    // Placa del frente.
    { geometria: caja(0.48, 0.53, -0.36, 0.36, 0.2, 0.44), rol: 'frente', escala: 'cuerpo' },
    ...ruedas(0.32, 0.52, 0.05, 1),
  ];
  return piezas;
}

/** Cápsula con nariz en punta: un sólido de revolución sobre x, cabina oscura y aleta trasera. */
function aerodinamico(): Pieza[] {
  // Perfil (radio, posicion sobre el eje) de cola a nariz, radio 0.5 en la panza.
  const perfil: THREE.Vector2[] = [];
  const pasos = 24;
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos; // 0 = cola, 1 = nariz
    const x = -0.5 + t;
    const radio = t < 0.15 ? 0.5 * Math.sqrt(t / 0.15) * 0.9 + 0.05 : t > 0.55 ? 0.5 * Math.sqrt(Math.max(0, 1 - ((t - 0.55) / 0.45) ** 1.6)) : 0.5;
    perfil.push(new THREE.Vector2(Math.max(radio, 0.0005), x));
  }
  const cuerpo = new THREE.LatheGeometry(perfil, 28);
  // El torno gira alrededor de y: se acuesta sobre x y se sube medio alto.
  cuerpo.rotateZ(-Math.PI / 2);
  cuerpo.translate(0, 0, 0.5);

  // Media esfera (la de three tiene los polos sobre y): se la para sobre z.
  const cabina = new THREE.SphereGeometry(0.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  cabina.rotateX(Math.PI / 2);
  cabina.scale(0.42, 0.62, 0.42);
  cabina.translate(-0.05, 0, 0.78);

  const aleta = perfilExtruido([[-0.5, 0.82], [-0.46, 1.12], [-0.3, 1.12], [-0.18, 0.86]], -0.03, 0.03);

  return [
    { geometria: cuerpo, rol: 'cuerpo', escala: 'cuerpo' },
    { geometria: cabina, rol: 'detalle', escala: 'cuerpo' },
    { geometria: aleta, rol: 'cuerpo', escala: 'cuerpo' },
    // Punta de la nariz: la marca del frente, redonda.
    { geometria: new THREE.SphereGeometry(0.5, 16, 12), rol: 'frente', escala: 'uniforme', ancla: [0.47, 0, 0.5], tamano: { de: 'menor', factor: 0.32 } },
    ...ruedas(0.3, 0.42, 0.06, 1),
  ];
}

/** Vagón minero: caja trapezoidal (más ancha arriba), borde metálico, flejes, remaches y ruedas grandes. */
function vagoneta(): Pieza[] {
  // Seccion transversal (y, z) extruida a lo largo de x.
  const seccion = new THREE.Shape([
    new THREE.Vector2(-0.38, 0.1), new THREE.Vector2(0.38, 0.1), new THREE.Vector2(0.5, 0.82), new THREE.Vector2(-0.5, 0.82),
  ]);
  const tolva = new THREE.ExtrudeGeometry(seccion, { depth: 1, bevelEnabled: false });
  // La forma vive en (u, v) = (y, z) del carro y se extruye en w: se permutan
  // los ejes (x, y, z) <- (w, u, v), que es una rotacion propia, y se centra en x.
  tolva.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));
  tolva.translate(-0.5, 0, 0);

  const remache = new THREE.SphereGeometry(0.5, 8, 6);
  const remaches: Pieza[] = [];
  for (const x of [-0.36, -0.12, 0.12, 0.36]) {
    for (const lado of [-1, 1]) {
      remaches.push({ geometria: remache, rol: 'detalle', escala: 'uniforme', ancla: [x, lado * 0.47, 0.7], tamano: { de: 'menor', factor: 0.05 } });
    }
  }
  return [
    { geometria: tolva, rol: 'cuerpo', escala: 'cuerpo' },
    // Interior oscuro (la tolva vista desde arriba) y borde metálico.
    { geometria: caja(-0.45, 0.45, -0.44, 0.44, 0.78, 0.83), rol: 'rueda', escala: 'cuerpo' },
    { geometria: caja(-0.52, 0.52, -0.53, -0.47, 0.8, 0.88), rol: 'detalle', escala: 'cuerpo' },
    { geometria: caja(-0.52, 0.52, 0.47, 0.53, 0.8, 0.88), rol: 'detalle', escala: 'cuerpo' },
    { geometria: caja(-0.53, -0.47, -0.5, 0.5, 0.8, 0.88), rol: 'detalle', escala: 'cuerpo' },
    { geometria: caja(0.47, 0.53, -0.5, 0.5, 0.8, 0.88), rol: 'detalle', escala: 'cuerpo' },
    // Bastidor.
    { geometria: caja(-0.46, 0.46, -0.3, 0.3, 0.0, 0.12), rol: 'detalle', escala: 'cuerpo' },
    // Placa del frente, sobre la cara delantera.
    { geometria: caja(0.5, 0.54, -0.28, 0.28, 0.32, 0.62), rol: 'frente', escala: 'cuerpo' },
    ...remaches,
    ...ruedas(0.3, 0.42, 0.08, 1.6),
  ];
}

