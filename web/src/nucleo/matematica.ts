// Primitivas numericas con la semantica exacta de MATLAB, para que el port
// reproduzca los golden files: gradient con coordenadas, interp1 lineal,
// pchip (pendientes de Fritsch-Carlson con los extremos de pchip.m),
// griddedInterpolant pchip con extrapolacion lineal (secante del segmento
// extremo), el operador dos puntos, mod, cummax, unique y los formatos de
// sprintf que aparecen en los textos de los criterios. Cada una esta
// testeada contra valores generados por MATLAB (test/fixtures).

export type Vec3 = [number, number, number];

export const EPS = Number.EPSILON;

// ------------------------------------------------------------ vectores
export function punto(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cruz(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function norma(a: Vec3): number {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
}

export function escalar(k: number, a: Vec3): Vec3 {
  return [k * a[0], k * a[1], k * a[2]];
}

export function suma(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function resta(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function normalizar(a: Vec3): Vec3 {
  const n = norma(a);
  return [a[0] / n, a[1] / n, a[2] / n];
}

/** MATLAB norm(v(1:2)) y similares: norma euclidea de un vector cualquiera. */
export function normaDe(valores: ArrayLike<number>): number {
  let suma2 = 0;
  for (let i = 0; i < valores.length; i++) suma2 += valores[i]! * valores[i]!;
  return Math.sqrt(suma2);
}

// ------------------------------------------------------------ escalares
/** MATLAB mod(a, m): el resultado tiene el signo de m. */
export function modulo(a: number, m: number): number {
  if (m === 0) return a;
  const r = a - Math.floor(a / m) * m;
  // mod(x, m) con x multiplo exacto de m da 0, no m.
  return r === m ? 0 : r;
}

export function rad2deg(x: number): number {
  return (x * 180) / Math.PI;
}

export function deg2rad(x: number): number {
  return (x * Math.PI) / 180;
}

export function signo(x: number): number {
  return x > 0 ? 1 : x < 0 ? -1 : 0;
}

/** max/min de MATLAB sobre un vector: ignoran NaN; sobre todo NaN dan NaN. */
export function maximo(valores: ArrayLike<number>): number {
  let m = NaN;
  for (let i = 0; i < valores.length; i++) {
    const v = valores[i]!;
    if (Number.isNaN(v)) continue;
    if (Number.isNaN(m) || v > m) m = v;
  }
  return m;
}

export function minimo(valores: ArrayLike<number>): number {
  let m = NaN;
  for (let i = 0; i < valores.length; i++) {
    const v = valores[i]!;
    if (Number.isNaN(v)) continue;
    if (Number.isNaN(m) || v < m) m = v;
  }
  return m;
}

/** [valor, indice] del maximo, ignorando NaN (indice base 0). */
export function maximoConIndice(valores: ArrayLike<number>): [number, number] {
  let m = NaN;
  let k = -1;
  for (let i = 0; i < valores.length; i++) {
    const v = valores[i]!;
    if (Number.isNaN(v)) continue;
    if (k < 0 || v > m) {
      m = v;
      k = i;
    }
  }
  return [m, k];
}

export function minimoConIndice(valores: ArrayLike<number>): [number, number] {
  let m = NaN;
  let k = -1;
  for (let i = 0; i < valores.length; i++) {
    const v = valores[i]!;
    if (Number.isNaN(v)) continue;
    if (k < 0 || v < m) {
      m = v;
      k = i;
    }
  }
  return [m, k];
}

// ------------------------------------------------------------ secuencias
/** Operador dos puntos a:d:b de MATLAB: n = floor((b-a)/d + tol) + 1, ultimo ajustado a b si cae encima. */
export function colon(a: number, d: number, b: number): Float64Array {
  if (d === 0 || (d > 0 && a > b) || (d < 0 && a < b)) return new Float64Array(0);
  const n = Math.floor((b - a) / d + 1e-10) + 1;
  const salida = new Float64Array(n);
  for (let i = 0; i < n; i++) salida[i] = a + i * d;
  // MATLAB genera la secuencia de forma simetrica y el ultimo valor cae en b
  // cuando (b-a)/d es entero; se corrige el redondeo acumulado del extremo.
  if (Math.abs(salida[n - 1]! - b) < Math.abs(d) * 1e-9) salida[n - 1] = b;
  return salida;
}

export function linspace(a: number, b: number, n: number): Float64Array {
  const salida = new Float64Array(n);
  if (n === 1) {
    salida[0] = b;
    return salida;
  }
  for (let i = 0; i < n; i++) salida[i] = a + ((b - a) * i) / (n - 1);
  salida[n - 1] = b;
  return salida;
}

export function cumsum(valores: ArrayLike<number>): Float64Array {
  const salida = new Float64Array(valores.length);
  let acumulado = 0;
  for (let i = 0; i < valores.length; i++) {
    acumulado += valores[i]!;
    salida[i] = acumulado;
  }
  return salida;
}

export function cummax(valores: ArrayLike<number>): Float64Array {
  const salida = new Float64Array(valores.length);
  let m = -Infinity;
  for (let i = 0; i < valores.length; i++) {
    if (valores[i]! > m) m = valores[i]!;
    salida[i] = m;
  }
  return salida;
}

/** unique(v, 'first' | 'last'): valores ordenados y el indice (base 0) de la primera/ultima aparicion. */
export function unico(valores: ArrayLike<number>, cual: 'first' | 'last'): { valores: number[]; indices: number[] } {
  const porValor = new Map<number, number>();
  for (let i = 0; i < valores.length; i++) {
    const v = valores[i]!;
    if (!porValor.has(v) || cual === 'last') porValor.set(v, i);
  }
  const ordenados = [...porValor.keys()].sort((a, b) => a - b);
  return { valores: ordenados, indices: ordenados.map((v) => porValor.get(v)!) };
}

// ------------------------------------------------------------ derivadas e interpolacion
/** gradient(y, x) de MATLAB con coordenadas: centrada adentro, lateral en los bordes. */
export function gradiente(y: ArrayLike<number>, x: ArrayLike<number>): Float64Array {
  const n = y.length;
  const salida = new Float64Array(n);
  if (n < 2) return salida;
  salida[0] = (y[1]! - y[0]!) / (x[1]! - x[0]!);
  salida[n - 1] = (y[n - 1]! - y[n - 2]!) / (x[n - 1]! - x[n - 2]!);
  for (let i = 1; i < n - 1; i++) salida[i] = (y[i + 1]! - y[i - 1]!) / (x[i + 1]! - x[i - 1]!);
  return salida;
}

/** Indice i tal que x[i] <= xq < x[i+1], acotado a [0, n-2]. */
function intervalo(x: ArrayLike<number>, xq: number): number {
  const n = x.length;
  if (xq <= x[0]!) return 0;
  if (xq >= x[n - 1]!) return n - 2;
  let bajo = 0;
  let alto = n - 1;
  while (alto - bajo > 1) {
    const medio = (bajo + alto) >> 1;
    if (x[medio]! <= xq) bajo = medio;
    else alto = medio;
  }
  return bajo;
}

/** interp1(x, y, xq, 'linear', 'extrap') o con valor de relleno fuera de rango. */
export function interp1Lineal(x: ArrayLike<number>, y: ArrayLike<number>, xq: number, fueraDeRango: 'extrap' | number = 'extrap'): number {
  const n = x.length;
  if (n === 1) return y[0]!;
  if (fueraDeRango !== 'extrap' && (xq < x[0]! || xq > x[n - 1]!)) return fueraDeRango;
  const i = intervalo(x, xq);
  const t = (xq - x[i]!) / (x[i + 1]! - x[i]!);
  return y[i]! + t * (y[i + 1]! - y[i]!);
}

/** Pendientes de pchip.m (Fritsch-Carlson, con los extremos de pchipslopes). */
export function pendientesPchip(x: ArrayLike<number>, y: ArrayLike<number>): Float64Array {
  const n = x.length;
  const d = new Float64Array(n);
  if (n < 2) return d;
  const h = new Float64Array(n - 1);
  const del = new Float64Array(n - 1);
  for (let k = 0; k < n - 1; k++) {
    h[k] = x[k + 1]! - x[k]!;
    del[k] = (y[k + 1]! - y[k]!) / h[k]!;
  }
  if (n === 2) {
    d[0] = del[0]!;
    d[1] = del[0]!;
    return d;
  }
  for (let k = 1; k < n - 1; k++) {
    if (signo(del[k - 1]!) * signo(del[k]!) > 0) {
      const w1 = 2 * h[k]! + h[k - 1]!;
      const w2 = h[k]! + 2 * h[k - 1]!;
      d[k] = (w1 + w2) / (w1 / del[k - 1]! + w2 / del[k]!);
    } else {
      d[k] = 0;
    }
  }
  d[0] = extremoPchip(h[0]!, h[1]!, del[0]!, del[1]!);
  d[n - 1] = extremoPchip(h[n - 2]!, h[n - 3]!, del[n - 2]!, del[n - 3]!);
  return d;
}

function extremoPchip(h1: number, h2: number, del1: number, del2: number): number {
  let d = ((2 * h1 + h2) * del1 - h1 * del2) / (h1 + h2);
  if (signo(d) !== signo(del1)) {
    d = 0;
  } else if (signo(del1) !== signo(del2) && Math.abs(d) > Math.abs(3 * del1)) {
    d = 3 * del1;
  }
  return d;
}

/** Coeficientes [c3, c2, c1, c0] por intervalo, en potencias decrecientes de (t - x[i]), como pp.coefs. */
export function coeficientesPchip(x: ArrayLike<number>, y: ArrayLike<number>): Float64Array[] {
  const n = x.length;
  const d = pendientesPchip(x, y);
  const coefs: Float64Array[] = [];
  for (let k = 0; k < n - 1; k++) {
    const h = x[k + 1]! - x[k]!;
    const del = (y[k + 1]! - y[k]!) / h;
    coefs.push(Float64Array.from([(d[k]! + d[k + 1]! - 2 * del) / (h * h), (3 * del - 2 * d[k]! - d[k + 1]!) / h, d[k]!, y[k]!]));
  }
  return coefs;
}

export function evaluarCubica(coefs: Float64Array, local: number): number {
  return ((coefs[0]! * local + coefs[1]!) * local + coefs[2]!) * local + coefs[3]!;
}

/** ppval(pchip(x, y), xq): fuera de rango se extiende el polinomio del extremo, como ppval. */
export function interp1Pchip(x: ArrayLike<number>, y: ArrayLike<number>, xq: number): number {
  const coefs = coeficientesPchip(x, y);
  const i = intervalo(x, xq);
  return evaluarCubica(coefs[i]!, xq - x[i]!);
}

/**
 * griddedInterpolant(x, y, 'pchip', 'linear'): pchip adentro y, fuera de la
 * grilla, extrapolacion lineal con la secante del segmento extremo (medido
 * contra MATLAB, test/fixtures). Precompilado: se evalua miles de veces.
 */
export function interpolantePchip(x: ArrayLike<number>, y: ArrayLike<number>): (xq: number) => number {
  const n = x.length;
  const xs = Float64Array.from(x as ArrayLike<number>);
  const ys = Float64Array.from(y as ArrayLike<number>);
  if (n === 1) return () => ys[0]!;
  const coefs = coeficientesPchip(xs, ys);
  const pendienteInicio = (ys[1]! - ys[0]!) / (xs[1]! - xs[0]!);
  const pendienteFin = (ys[n - 1]! - ys[n - 2]!) / (xs[n - 1]! - xs[n - 2]!);
  return (xq: number) => {
    if (xq < xs[0]!) return ys[0]! + (xq - xs[0]!) * pendienteInicio;
    if (xq > xs[n - 1]!) return ys[n - 1]! + (xq - xs[n - 1]!) * pendienteFin;
    const i = intervalo(xs, xq);
    return evaluarCubica(coefs[i]!, xq - xs[i]!);
  };
}

// ------------------------------------------------------------ formatos de sprintf
// printf redondea sobre la expansion decimal EXACTA del double y lleva los
// empates exactos al digito par; toFixed/toExponential de JS llevan el empate
// hacia arriba. Se trabaja sobre la expansion exacta (toPrecision(100) la da
// entera para todo double de magnitud razonable).

interface Expansion {
  negativo: boolean;
  /** Digitos significativos exactos, sin ceros a la izquierda. */
  digitos: string;
  /** Exponente decimal del primer digito (x = 0.d1d2... x 10^(exponente+1)). */
  exponente: number;
}

function expansionExacta(x: number): Expansion {
  const negativo = x < 0 || Object.is(x, -0);
  const texto = Math.abs(x).toPrecision(100);
  const [mantisa, exp] = texto.split('e');
  let digitos = mantisa!.replace('.', '');
  const puntoEn = mantisa!.indexOf('.');
  let exponente = (puntoEn < 0 ? mantisa!.length : puntoEn) - 1 + (exp ? Number(exp) : 0);
  const primero = digitos.search(/[1-9]/);
  if (primero < 0) return { negativo, digitos: '0', exponente: 0 };
  digitos = digitos.slice(primero);
  exponente -= primero;
  return { negativo, digitos: digitos.replace(/0+$/, '') || '0', exponente };
}

/** Redondea la expansion a `cantidad` digitos significativos, al par en los empates exactos. */
function redondearDigitos(expansion: Expansion, cantidad: number): { digitos: string; exponente: number } {
  const { digitos, exponente } = expansion;
  if (cantidad <= 0) {
    // Redondeo a cero digitos: decide si el numero entero sube a 1 x 10^(exponente+1).
    const resto = digitos;
    const sube = resto[0]! > '5' || (resto[0] === '5' && resto.length > 1);
    return sube ? { digitos: '1', exponente: exponente + 1 } : { digitos: '0', exponente };
  }
  if (digitos.length <= cantidad) return { digitos: digitos.padEnd(cantidad, '0'), exponente };
  const cabeza = digitos.slice(0, cantidad);
  const resto = digitos.slice(cantidad);
  let sube = false;
  if (resto[0]! > '5') sube = true;
  else if (resto[0] === '5') {
    const empateExacto = resto.length === 1;
    sube = empateExacto ? Number(cabeza[cabeza.length - 1]) % 2 === 1 : true;
  }
  if (!sube) return { digitos: cabeza, exponente };
  let numero = (BigInt(cabeza) + 1n).toString();
  if (numero.length > cantidad) return { digitos: numero.slice(0, cantidad), exponente: exponente + 1 };
  return { digitos: numero, exponente };
}

/** sprintf('%.Nf'): como printf, los empates exactos redondean a par. */
export function sprintfF(x: number, decimales: number): string {
  if (!Number.isFinite(x)) return x > 0 ? 'Inf' : x < 0 ? '-Inf' : 'NaN';
  const expansion = expansionExacta(x);
  const cantidad = expansion.exponente + 1 + decimales;
  const { digitos, exponente } = redondearDigitos(expansion, cantidad);
  let entero: string;
  let fraccion: string;
  if (digitos === '0') {
    entero = '0';
    fraccion = '0'.repeat(decimales);
  } else if (exponente >= 0) {
    const relleno = digitos.padEnd(exponente + 1 + decimales, '0');
    entero = relleno.slice(0, exponente + 1);
    fraccion = relleno.slice(exponente + 1, exponente + 1 + decimales);
  } else {
    entero = '0';
    fraccion = ('0'.repeat(-exponente - 1) + digitos).padEnd(decimales, '0').slice(0, decimales);
  }
  const texto = decimales > 0 ? `${entero}.${fraccion}` : entero;
  const esCero = /^[0.]*$/.test(texto);
  return expansion.negativo && !esCero ? `-${texto}` : texto;
}

/** sprintf('%.Ne'): exponente de al menos dos digitos, como C. */
export function sprintfE(x: number, decimales: number): string {
  if (!Number.isFinite(x)) return x > 0 ? 'Inf' : x < 0 ? '-Inf' : 'NaN';
  const expansion = expansionExacta(x);
  const { digitos, exponente } = redondearDigitos(expansion, decimales + 1);
  const mantisa = decimales > 0 ? `${digitos[0]}.${digitos.slice(1)}` : digitos[0]!;
  const e = digitos === '0' ? 0 : exponente;
  const texto = `${mantisa}e${e < 0 ? '-' : '+'}${String(Math.abs(e)).padStart(2, '0')}`;
  return expansion.negativo && x !== 0 ? `-${texto}` : texto;
}

/** sprintf('%.Pg'): P cifras significativas, sin ceros de mas, exponencial si exp < -4 o exp >= P. */
export function sprintfG(x: number, precision: number): string {
  if (!Number.isFinite(x)) return x > 0 ? 'Inf' : x < 0 ? '-Inf' : 'NaN';
  if (x === 0) return '0';
  const p = Math.max(precision, 1);
  const expansion = expansionExacta(x);
  const { digitos, exponente } = redondearDigitos(expansion, p);
  const signoTexto = expansion.negativo ? '-' : '';
  if (exponente < -4 || exponente >= p) {
    const mantisa = quitarCeros(digitos.length > 1 ? `${digitos[0]}.${digitos.slice(1)}` : digitos);
    return `${signoTexto}${mantisa}e${exponente < 0 ? '-' : '+'}${String(Math.abs(exponente)).padStart(2, '0')}`;
  }
  let texto: string;
  if (exponente >= 0) {
    const relleno = digitos.padEnd(exponente + 1, '0');
    texto = `${relleno.slice(0, exponente + 1)}.${relleno.slice(exponente + 1)}`;
  } else {
    texto = `0.${'0'.repeat(-exponente - 1)}${digitos}`;
  }
  return signoTexto + quitarCeros(texto);
}

function quitarCeros(texto: string): string {
  if (!texto.includes('.')) return texto;
  return texto.replace(/0+$/, '').replace(/\.$/, '');
}
