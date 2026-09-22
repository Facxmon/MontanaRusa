// Wrapper de uPlot con el tema de la pagina: una figura = un eje x compartido
// y varias series, con franjas verticales (subtramos o elementos), lineas de
// referencia y bandas entre dos series. Lo que se dibuja lo describe
// series.ts; aca solo se traduce a opciones de uPlot.

import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { formatearNumero, SIN_DATO, type Notacion } from '../paneles/formato';
import { fuenteDeCanvas, tema } from '../tema';

/**
 * Colores simbolicos de las series: series.ts no toca el DOM (se testea en
 * Node), asi que describe QUE color lleva cada serie y aca se resuelve al
 * valor del tema (tokens.css) en el momento de dibujar.
 */
export type ColorDeSerie = 'serie1' | 'serie2' | 'serie3' | 'limite' | 'admisibleTrazo' | 'admisibleRelleno' | 'cero';

export interface SerieDeFigura {
  etiqueta: string;
  valores: (number | null)[];
  color: ColorDeSerie;
  /** Ancho de trazo en px; las referencias van finas. */
  ancho?: number;
  /** Patron de trazos, p. ej. [6, 4] para las lineas de referencia. */
  trazos?: number[];
  /** No aparece en la leyenda (referencias repetidas, bordes de bandas). */
  ocultarEnLeyenda?: boolean;
}

export interface Franja {
  desde: number;
  hasta: number;
  etiqueta: string;
}

export interface BandaEntreSeries {
  /** Indices (base 0 dentro de `series`) de la serie superior e inferior. */
  superior: number;
  inferior: number;
  color: ColorDeSerie;
}

export interface DatosDeFigura {
  /** Nombre corto para el archivo al exportar (`gx`, `velocidad`); si falta se usa el indice. */
  clave?: string;
  titulo: string;
  etiquetaX: string;
  etiquetaY: string;
  x: number[];
  /** Decimales fijos de la leyenda (los de la magnitud graficada), para que no salte. */
  decimales: number;
  notacion?: Notacion;
  /** Decimales del valor de x en la leyenda. */
  decimalesX: number;
  series: SerieDeFigura[];
  franjas: Franja[];
  bandas?: BandaEntreSeries[];
}

function colorDeSerie(color: ColorDeSerie): string {
  const t = tema();
  switch (color) {
    case 'serie1':
      return t.serie1;
    case 'serie2':
      return t.serie2;
    case 'serie3':
      return t.serie3;
    case 'limite':
      return t.serieLimite;
    case 'admisibleTrazo':
      return t.serieAdmisibleTrazo;
    case 'admisibleRelleno':
      return t.serieAdmisibleRelleno;
    case 'cero':
      return t.serieCero;
  }
}

/** Tamano en px CSS de una figura; la exportacion pasa uno fijo. */
export interface TamanoDeFigura {
  width: number;
  height: number;
}

/**
 * Opciones de uPlot para unos datos. `escala` multiplica anchos de trazo,
 * fuentes y tamanos de eje: uPlot dibuja siempre al devicePixelRatio de la
 * ventana, asi que para exportar a 2x se dibuja la figura al doble de
 * tamano CSS con todo escalado al doble (exportarFigura.ts).
 */
export function opcionesDeFigura(datos: DatosDeFigura, tamano: TamanoDeFigura, claveDeSincronizacion: string | null, escala = 1): uPlot.Options {
  const t = tema();
  const fuente = fuenteDeCanvas(escala);
  const grilla = { stroke: t.graficoGrilla, width: escala };
  const ejeComun = {
    stroke: t.graficoTexto,
    labelFont: fuente,
    font: fuente,
    grid: grilla,
    ticks: { ...grilla, size: 10 * escala },
    labelSize: 30 * escala,
    labelGap: 0,
    gap: 5 * escala,
  };
  return {
    ...tamano,
    title: datos.titulo,
    cursor: claveDeSincronizacion
      ? { sync: { key: claveDeSincronizacion, setSeries: false }, points: { size: 6 } }
      : { show: false },
    legend: { show: claveDeSincronizacion !== null, live: true },
    scales: { x: { time: false } },
    axes: [
      { ...ejeComun, label: datos.etiquetaX, size: 50 * escala },
      { ...ejeComun, label: datos.etiquetaY, size: 60 * escala },
    ],
    series: [
      { label: datos.etiquetaX, value: (_u: uPlot, v: number | null) => (v === null ? SIN_DATO : formatearNumero(v, datos.decimalesX)) },
      ...datos.series.map((s) => ({
        label: s.etiqueta,
        stroke: colorDeSerie(s.color),
        width: (s.ancho ?? 1.6) * escala,
        dash: s.trazos?.map((d) => d * escala),
        spanGaps: false,
        points: { show: false },
        value: (_u: uPlot, v: number | null) => (v === null ? SIN_DATO : formatearNumero(v, datos.decimales, datos.notacion)),
      })),
    ],
    bands: (datos.bandas ?? []).map((b) => ({ series: [b.superior + 1, b.inferior + 1] as [number, number], fill: colorDeSerie(b.color) })),
    hooks: {
      drawClear: [(u) => dibujarFranjas(u, datos.franjas, escala)],
    },
  };
}

/** Franjas verticales alternadas con su etiqueta (subtramos o elementos), debajo de las series. */
export function dibujarFranjas(u: uPlot, franjas: Franja[], escala = 1): void {
  if (franjas.length === 0) return;
  const { ctx, bbox } = u;
  const t = tema();
  const fondos = [t.graficoFranjaA, t.graficoFranjaB];
  const razon = devicePixelRatio * escala;
  ctx.save();
  ctx.font = fuenteDeCanvas(razon);
  ctx.textBaseline = 'top';
  franjas.forEach((franja, i) => {
    const x0 = u.valToPos(franja.desde, 'x', true);
    const x1 = u.valToPos(franja.hasta, 'x', true);
    const izquierda = Math.max(bbox.left, Math.min(x0, x1));
    const derecha = Math.min(bbox.left + bbox.width, Math.max(x0, x1));
    if (derecha <= izquierda) return;
    ctx.fillStyle = fondos[i % 2]!;
    ctx.fillRect(izquierda, bbox.top, derecha - izquierda, bbox.height);
    ctx.fillStyle = t.graficoTexto;
    const texto = franja.etiqueta;
    if (ctx.measureText(texto).width < derecha - izquierda - 6 * razon) {
      ctx.fillText(texto, izquierda + 3 * razon, bbox.top + 3 * razon);
    }
  });
  ctx.restore();
}

export class Figura {
  private grafico: uPlot | null = null;
  private readonly contenedor: HTMLElement;
  private readonly claveDeSincronizacion: string;
  private readonly observador: ResizeObserver;

  constructor(contenedor: HTMLElement, claveDeSincronizacion: string) {
    this.contenedor = contenedor;
    this.claveDeSincronizacion = claveDeSincronizacion;
    this.observador = new ResizeObserver(() => this.ajustarTamano());
    this.observador.observe(contenedor);
  }

  private tamano(): TamanoDeFigura {
    return { width: Math.max(320, this.contenedor.clientWidth), height: 240 };
  }

  private ajustarTamano(): void {
    if (this.grafico) this.grafico.setSize(this.tamano());
  }

  /** Reemplaza el contenido entero (las series pueden cambiar de cantidad). */
  mostrar(datos: DatosDeFigura): void {
    this.destruir();
    const opciones = opcionesDeFigura(datos, this.tamano(), this.claveDeSincronizacion);
    this.grafico = new uPlot(opciones, [datos.x, ...datos.series.map((s) => s.valores)], this.contenedor);

    // Leyenda: las series marcadas como ocultas no se listan.
    const filas = this.contenedor.querySelectorAll<HTMLElement>('.u-legend .u-series');
    datos.series.forEach((s, i) => {
      const fila = filas[i + 1];
      if (fila && s.ocultarEnLeyenda) fila.style.display = 'none';
    });
  }

  /** Destruye el uPlot y vacia el contenedor; el ResizeObserver sigue hasta destruirDelTodo. */
  destruir(): void {
    this.grafico?.destroy();
    this.grafico = null;
    this.contenedor.replaceChildren();
  }

  /** destruir() mas soltar el ResizeObserver: la figura no se vuelve a usar. */
  destruirDelTodo(): void {
    this.destruir();
    this.observador.disconnect();
  }
}
