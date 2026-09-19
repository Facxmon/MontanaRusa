// Wrapper de uPlot con el tema de la pagina: una figura = un eje x compartido
// y varias series, con franjas verticales (subtramos o elementos), lineas de
// referencia y bandas entre dos series. Lo que se dibuja lo describe
// series.ts; aca solo se traduce a opciones de uPlot.

import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

export interface SerieDeFigura {
  etiqueta: string;
  valores: (number | null)[];
  color: string;
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
  color: string;
}

export interface DatosDeFigura {
  titulo: string;
  etiquetaX: string;
  etiquetaY: string;
  x: number[];
  series: SerieDeFigura[];
  franjas: Franja[];
  bandas?: BandaEntreSeries[];
}

const COLOR_TEXTO = '#9aa3b2';
const COLOR_GRILLA = 'rgba(154, 163, 178, 0.14)';
const COLOR_FRANJA = ['rgba(255, 255, 255, 0.025)', 'rgba(255, 255, 255, 0.06)'];
const FUENTE = '11px system-ui, sans-serif';

export class Figura {
  private grafico: uPlot | null = null;
  private readonly contenedor: HTMLElement;
  private franjas: Franja[] = [];
  private readonly claveDeSincronizacion: string;

  constructor(contenedor: HTMLElement, claveDeSincronizacion: string) {
    this.contenedor = contenedor;
    this.claveDeSincronizacion = claveDeSincronizacion;
    new ResizeObserver(() => this.ajustarTamano()).observe(contenedor);
  }

  private tamano(): { width: number; height: number } {
    return { width: Math.max(320, this.contenedor.clientWidth), height: 240 };
  }

  private ajustarTamano(): void {
    if (this.grafico) this.grafico.setSize(this.tamano());
  }

  /** Reemplaza el contenido entero (las series pueden cambiar de cantidad). */
  mostrar(datos: DatosDeFigura): void {
    this.destruir();
    this.franjas = datos.franjas;

    const opciones: uPlot.Options = {
      ...this.tamano(),
      title: datos.titulo,
      cursor: {
        sync: { key: this.claveDeSincronizacion, setSeries: false },
        points: { size: 6 },
      },
      legend: { show: true, live: true },
      scales: { x: { time: false } },
      axes: [
        {
          label: datos.etiquetaX,
          stroke: COLOR_TEXTO,
          labelFont: FUENTE,
          font: FUENTE,
          grid: { stroke: COLOR_GRILLA, width: 1 },
          ticks: { stroke: COLOR_GRILLA, width: 1 },
        },
        {
          label: datos.etiquetaY,
          stroke: COLOR_TEXTO,
          labelFont: FUENTE,
          font: FUENTE,
          size: 60,
          grid: { stroke: COLOR_GRILLA, width: 1 },
          ticks: { stroke: COLOR_GRILLA, width: 1 },
        },
      ],
      series: [
        { label: datos.etiquetaX },
        ...datos.series.map((s) => ({
          label: s.etiqueta,
          stroke: s.color,
          width: s.ancho ?? 1.6,
          dash: s.trazos,
          spanGaps: false,
          points: { show: false },
          value: (_u: uPlot, v: number | null) => (v === null ? '—' : formatearValor(v)),
        })),
      ],
      bands: (datos.bandas ?? []).map((b) => ({ series: [b.superior + 1, b.inferior + 1] as [number, number], fill: b.color })),
      hooks: {
        drawClear: [(u) => this.dibujarFranjas(u)],
      },
    };

    this.grafico = new uPlot(opciones, [datos.x, ...datos.series.map((s) => s.valores)], this.contenedor);

    // Leyenda: las series marcadas como ocultas no se listan.
    const filas = this.contenedor.querySelectorAll<HTMLElement>('.u-legend .u-series');
    datos.series.forEach((s, i) => {
      const fila = filas[i + 1];
      if (fila && s.ocultarEnLeyenda) fila.style.display = 'none';
    });
  }

  private dibujarFranjas(u: uPlot): void {
    if (this.franjas.length === 0) return;
    const { ctx, bbox } = u;
    ctx.save();
    ctx.font = `${10 * devicePixelRatio}px system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    this.franjas.forEach((franja, i) => {
      const x0 = u.valToPos(franja.desde, 'x', true);
      const x1 = u.valToPos(franja.hasta, 'x', true);
      const izquierda = Math.max(bbox.left, Math.min(x0, x1));
      const derecha = Math.min(bbox.left + bbox.width, Math.max(x0, x1));
      if (derecha <= izquierda) return;
      ctx.fillStyle = COLOR_FRANJA[i % 2]!;
      ctx.fillRect(izquierda, bbox.top, derecha - izquierda, bbox.height);
      ctx.fillStyle = COLOR_TEXTO;
      const texto = franja.etiqueta;
      if (ctx.measureText(texto).width < derecha - izquierda - 6) {
        ctx.fillText(texto, izquierda + 3 * devicePixelRatio, bbox.top + 3 * devicePixelRatio);
      }
    });
    ctx.restore();
  }

  destruir(): void {
    this.grafico?.destroy();
    this.grafico = null;
    this.contenedor.replaceChildren();
  }
}

function formatearValor(v: number): string {
  const magnitud = Math.abs(v);
  if (magnitud !== 0 && (magnitud < 1e-3 || magnitud >= 1e5)) return v.toExponential(2);
  return String(Number(v.toPrecision(4)));
}
