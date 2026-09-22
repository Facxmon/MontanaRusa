// Los colores y las fuentes que necesita JavaScript (la escena Three.js, el
// canvas de uPlot) se leen de las custom properties de tokens.css, no se
// escriben aca: tokens.css es la unica fuente de color de la web. Se leen
// una vez con getComputedStyle y se cachean; si cambia data-tema en <html>
// se vuelven a leer y se avisa a quien se haya suscrito con alCambiarTema.
//
// Los tokens que se leen aca tienen que resolver a hex o rgba(r, g, b, a):
// THREE.Color y el canvas no parsean color-mix() ni rgb(r g b / a).

const TOKENS = {
  fuente: '--fuente',
  mono: '--mono',
  textoXs: '--texto-xs',
  textoSm: '--texto-sm',
  superficie0: '--superficie-0',
  texto1: '--texto-1',
  texto2: '--texto-2',

  // Movimiento: la escena anima el encuadre con los mismos tokens que el CSS.
  durLenta: '--dur-lenta',
  curva: '--curva',

  graficoTexto: '--grafico-texto',
  graficoGrilla: '--grafico-grilla',
  graficoFranjaA: '--grafico-franja-a',
  graficoFranjaB: '--grafico-franja-b',
  serie1: '--serie-1',
  serie2: '--serie-2',
  serie3: '--serie-3',
  serieLimite: '--serie-limite',
  serieAdmisibleTrazo: '--serie-admisible-trazo',
  serieAdmisibleRelleno: '--serie-admisible-relleno',
  serieCero: '--serie-cero',

  escenaFondo: '--escena-fondo',
  escenaCielo: '--escena-cielo',
  escenaSuelo: '--escena-suelo',
  escenaSol: '--escena-sol',
  escenaContraluz: '--escena-contraluz',
  escenaGrillaFuerte: '--escena-grilla-fuerte',
  escenaGrilla: '--escena-grilla',
  escenaUniones: '--escena-uniones',
  escenaCarro: '--escena-carro',
  escenaPasajero: '--escena-pasajero',
  escenaPasajeroBrillo: '--escena-pasajero-brillo',
  escenaMarcador: '--escena-marcador',
} as const;

export type Tema = { readonly [K in keyof typeof TOKENS]: string };

/** Milisegundos de un token de duracion ("400ms" o "0.4s"). */
export function milisegundos(valor: string): number {
  const numero = parseFloat(valor);
  return valor.trim().endsWith('ms') ? numero : numero * 1000;
}

/**
 * La funcion de easing de un cubic-bezier(x1, y1, x2, y2) de CSS: dado el
 * avance en tiempo (0..1) devuelve el avance del valor. Se resuelve x(s) = t
 * por Newton con biseccion de respaldo, como hacen los navegadores. Un
 * token que no sea cubic-bezier cae a lineal.
 */
export function curvaCubica(token: string): (t: number) => number {
  const m = /cubic-bezier\(([^)]+)\)/.exec(token);
  const p = m ? m[1]!.split(',').map(Number) : [];
  if (p.length !== 4 || p.some((v) => !Number.isFinite(v))) return (t) => t;
  const [x1, y1, x2, y2] = p as [number, number, number, number];
  const bezier = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  const derivada = (a: number, b: number, s: number) => 3 * a * (1 - s) ** 2 + 6 * (b - a) * s * (1 - s) + 3 * (1 - b) * s * s;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let s = t;
    for (let i = 0; i < 8; i++) {
      const error = bezier(x1, x2, s) - t;
      const d = derivada(x1, x2, s);
      if (Math.abs(error) < 1e-6) break;
      if (Math.abs(d) < 1e-6) break;
      s = Math.min(1, Math.max(0, s - error / d));
    }
    let bajo = 0;
    let alto = 1;
    for (let i = 0; i < 30 && Math.abs(bezier(x1, x2, s) - t) > 1e-6; i++) {
      if (bezier(x1, x2, s) < t) bajo = s;
      else alto = s;
      s = (bajo + alto) / 2;
    }
    return bezier(y1, y2, s);
  };
}

/** true si el sistema pide movimiento reducido: no se anima nada (fase 4.3). */
export function movimientoReducido(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

let cache: Tema | null = null;
const suscriptores = new Set<(tema: Tema) => void>();
let observador: MutationObserver | null = null;

function leer(): Tema {
  const estilo = getComputedStyle(document.documentElement);
  const tema: Record<string, string> = {};
  for (const [clave, propiedad] of Object.entries(TOKENS)) {
    const valor = estilo.getPropertyValue(propiedad).trim();
    if (!valor) throw new Error(`tokens.css no define ${propiedad} para el tema actual`);
    tema[clave] = valor;
  }
  return tema as Tema;
}

/** Los tokens del tema actual, leidos del CSS y cacheados. */
export function tema(): Tema {
  if (!cache) cache = leer();
  return cache;
}

/** Fuente para un canvas: tamano del token mas la familia (p. ej. "11px IBM Plex Sans, ..."). */
export function fuenteDeCanvas(escala = 1): string {
  const t = tema();
  return `${parseFloat(t.textoXs) * escala}px ${t.fuente}`;
}

/**
 * Avisa cuando cambia data-tema en <html>. Devuelve la funcion para
 * desuscribirse; el observador del atributo vive solo mientras haya alguien
 * suscripto, asi destruir el visualizador no deja nada global.
 */
export function alCambiarTema(fn: (tema: Tema) => void): () => void {
  suscriptores.add(fn);
  if (!observador) {
    observador = new MutationObserver(() => {
      cache = null;
      const actual = tema();
      for (const suscriptor of suscriptores) suscriptor(actual);
    });
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] });
  }
  return () => {
    suscriptores.delete(fn);
    if (suscriptores.size === 0 && observador) {
      observador.disconnect();
      observador = null;
    }
  };
}
