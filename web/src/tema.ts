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
} as const;

export type Tema = { readonly [K in keyof typeof TOKENS]: string };

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
