// Curvas limite de ASTM F2291-06a, seccion 7. Port literal de
// Verificacion/LimiteNormativo.m, Fisica/LimiteDeDiseno.m y
// Verificacion/LimitePorPunto.m. Las tablas tienen que coincidir fila por
// fila con memoria_de_calculo.md, seccion 5, igual que en MATLAB.
//
// La duracion que entra aca es la del PROTOTIPO: la del modelo hay que
// multiplicarla antes por sqrt(lambda) (factorTiempo).

export type CurvaNormativa =
  | 'MasGzTodas' | 'MasGzReducido'
  | 'MenosGzBase' | 'MenosGzExtendido'
  | 'GyBase'
  | 'MasGxBase'
  | 'MenosGxBase' | 'MenosGxOTS' | 'MenosGxProne';

type Fila = readonly [number, number];

/** Filas [duracion s, limite G] de cada curva. */
const TABLAS: Record<CurvaNormativa, readonly Fila[]> = {
  MasGzTodas:       [[0.2, 6.0], [1.0, 6.0], [1.5, 5.0], [2.0, 4.0], [2.5, 4.0], [4.0, 4.0], [5.0, 3.0], [11.8, 3.0], [12.0, 2.0], [40, 2.0]],
  MasGzReducido:    [[0.2, 5.0], [1.0, 5.0], [1.5, 5.0], [2.0, 4.0], [2.5, 2.0], [4.0, 2.0], [5.0, 2.0], [11.8, 2.0], [12.0, 2.0], [40, 2.0]],
  MenosGzBase:      [[0.2, -2.0], [0.5, -1.5], [1.0, -1.5], [3.0, -1.5], [4.0, -1.5], [7.0, -1.1], [40, -1.1]],
  MenosGzExtendido: [[0.2, -2.8], [0.5, -2.5], [1.0, -2.2], [3.0, -1.5], [4.0, -1.5], [7.0, -1.1], [40, -1.1]],
  GyBase:           [[0.2, 3.0], [1.0, 3.0], [2.0, 2.0], [40, 2.0]],
  MasGxBase:        [[0.2, 6.0], [1.0, 6.0], [2.0, 4.0], [4.0, 4.0], [5.0, 3.0], [11.8, 3.0], [12.0, 2.5], [40, 2.5]],
  MenosGxBase:      [[0.2, -2.0], [0.5, -1.5], [12.0, -1.5], [40, -1.5]],
  MenosGxOTS:       [[0.2, -2.0], [12.0, -2.0], [40, -2.0]],
  MenosGxProne:     [[0.2, -3.5], [2.0, -3.5], [3.0, -2.5], [4.0, -2.5], [5.0, -2.0], [40, -2.0]],
};

export const CURVAS_NORMATIVAS = Object.keys(TABLAS) as CurvaNormativa[];

export function tablaNormativa(curva: CurvaNormativa): readonly Fila[] {
  const tabla = TABLAS[curva];
  if (!tabla) throw new Error(`Curva normativa no reconocida: ${curva}`);
  return tabla;
}

/** interp1 lineal de MATLAB sobre una tabla creciente en x; x ya acotado a la tabla. */
function interpolarLineal(tabla: readonly Fila[], x: number): number {
  const ultimo = tabla[tabla.length - 1]!;
  if (x >= ultimo[0]) return ultimo[1];
  for (let i = 0; i < tabla.length - 1; i++) {
    const [x0, y0] = tabla[i]!;
    const [x1, y1] = tabla[i + 1]!;
    if (x >= x0 && x <= x1) {
      return x1 === x0 ? y0 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return tabla[0]![1];
}

/** Limite de la curva a esa duracion del prototipo: lineal por tramos, constante fuera de la tabla. */
export function limiteNormativo(curva: CurvaNormativa, duracion: number): number {
  const tabla = tablaNormativa(curva);
  const acotada = Math.min(Math.max(duracion, tabla[0]![0]), tabla[tabla.length - 1]![0]);
  return interpolarLineal(tabla, acotada);
}

/**
 * Curva de la norma con las esquinas redondeadas por debajo (C1): el
 * objetivo del modo GNormativaMaxima. Con semiancho 0 es la tabla literal.
 */
export function limiteDeDiseno(curva: CurvaNormativa, duracion: number, semiancho: number): number {
  const literal = limiteNormativo(curva, duracion);
  if (!(semiancho > 0)) return literal;

  const tabla = tablaNormativa(curva);
  const signo = Math.sign(tabla[0]![1]) || 1;
  const tiempos = tabla.map((fila) => fila[0]);
  const magnitudes = tabla.map((fila) => Math.abs(fila[1]));

  // Pendientes de cada tramo, con la extension constante a los dos lados.
  const pendientes = [0];
  const longitudes = [Infinity];
  for (let i = 0; i < tiempos.length - 1; i++) {
    const dt = tiempos[i + 1]! - tiempos[i]!;
    pendientes.push((magnitudes[i + 1]! - magnitudes[i]!) / dt);
    longitudes.push(dt);
  }
  pendientes.push(0);
  longitudes.push(Infinity);

  let correccion = 0;
  for (let k = 0; k < tiempos.length; k++) {
    const deltaPendiente = pendientes[k + 1]! - pendientes[k]!;
    if (Math.abs(deltaPendiente) < 1e-12) continue;
    const w = Math.min(semiancho, 0.5 * longitudes[k]!, 0.5 * longitudes[k + 1]!);
    const t = Math.abs(duracion - tiempos[k]!);
    if (!(t < w)) continue;
    const h =
      deltaPendiente < 0
        ? ((Math.abs(deltaPendiente) / 4) * (w - t) ** 2) / w
        : (Math.abs(deltaPendiente) / (2 * w * w)) * (w - t) ** 2 * t;
    correccion += h;
  }
  return signo * (Math.abs(literal) - correccion);
}

/** Indices [inicio, fin] (inclusivos) de cada corrida de true. */
export function tramosContiguos(mascara: ArrayLike<boolean>): Array<[number, number]> {
  const tramos: Array<[number, number]> = [];
  let inicio = -1;
  for (let i = 0; i < mascara.length; i++) {
    const activo = mascara[i] === true;
    if (activo && inicio < 0) inicio = i;
    if (!activo && inicio >= 0) {
      tramos.push([inicio, i - 1]);
      inicio = -1;
    }
  }
  if (inicio >= 0) tramos.push([inicio, mascara.length - 1]);
  return tramos;
}

/**
 * Limite normativo aplicable en cada nodo: la duracion del evento sostenido
 * que lo contiene a su nivel de G (cuantizado en `niveles` escalones), por
 * sqrt(lambda), evaluada en la curva. NaN donde la G no tiene ese signo.
 * Port de LimitePorPunto.m; `signo` es +1 o -1 segun el lado evaluado.
 */
export function limitePorPunto(
  g: ArrayLike<number>,
  tiempo: ArrayLike<number>,
  curva: CurvaNormativa,
  factorTiempo: number,
  signo: 1 | -1,
  niveles = 40,
): Float64Array {
  const n = g.length;
  const h = new Float64Array(n);
  let maximo = -Infinity;
  for (let i = 0; i < n; i++) {
    h[i] = signo * g[i]!;
    if (Number.isFinite(h[i]!) && h[i]! > maximo) maximo = h[i]!;
  }
  const limite = new Float64Array(n).fill(NaN);
  if (!(maximo > 0)) return limite;

  // linspace(maximo/niveles, maximo, niveles), de menor a mayor: cada nodo
  // termina con el limite del nivel mas alto que alcanza.
  for (let j = 0; j < niveles; j++) {
    const nivel = niveles === 1 ? maximo : maximo / niveles + ((maximo - maximo / niveles) * j) / (niveles - 1);
    const mascara = new Array<boolean>(n);
    for (let i = 0; i < n; i++) mascara[i] = h[i]! >= nivel;
    for (const [inicio, fin] of tramosContiguos(mascara)) {
      const duracion = Math.max((tiempo[fin]! - tiempo[inicio]!) * factorTiempo, 0.2);
      const valor = signo * Math.abs(limiteNormativo(curva, duracion));
      for (let i = inicio; i <= fin; i++) limite[i] = valor;
    }
  }
  return limite;
}
