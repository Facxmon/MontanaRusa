// Wrapper de uPlot con el tema de la pagina: una figura = un eje x compartido
// y varias series, con franjas verticales (subtramos o elementos), lineas de
// referencia y bandas entre dos series. Lo que se dibuja lo describe
// series.ts; aca solo se traduce a opciones de uPlot.
//
// Navegacion (fase 3, revisada en la tarea 3 de interfaz). En un plugin y sin
// cambiar de libreria (uPlot es mas chica y mas rapida que las alternativas y
// nada de esto la necesita):
//  - arrastrar selecciona un RANGO DEL EJE X, con un rectangulo visible de
//    todo el alto, y al soltar hace zoom a ese rango (antes el arrastre podia
//    ser horizontal, vertical o de caja y no se entendia que hacia);
//  - doble clic, o el boton de reset de la figura (verTodo), vuelve a la
//    vista completa;
//  - la rueda SOLA scrollea la pagina; Ctrl + rueda hace zoom (Ctrl + Shift =
//    eje Y), centrado donde esta el puntero. La primera vez que se usa la
//    rueda sobre una figura aparece una pista breve ("Ctrl + rueda para
//    zoom"), una sola vez por navegador (almacen.ts);
//  - arrastre para desplazarse con la rueda apretada o con Shift.
// El mousedown del arrastre se escucha en u.root EN FASE DE CAPTURA: uPlot
// registra el suyo sobre u.over en el constructor, o sea antes que cualquier
// listener que se agregue en el hook `ready`, y desde un ancestro en captura
// es la unica forma de ganarle y que no arranque una seleccion.

import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { escribirAlmacen, leerAlmacen } from '../paneles/almacen';
import { formatearNumero, SIN_DATO, type Notacion } from '../paneles/formato';
import { fuenteDeCanvas, tema } from '../tema';
import { acompanantesDe, rangoConValores, valorEnElCursor } from './series';

/**
 * Colores simbolicos de las series: series.ts no toca el DOM (se testea en
 * Node), asi que describe QUE color lleva cada serie y aca se resuelve al
 * valor del tema (tokens.css) en el momento de dibujar.
 */
export type ColorDeSerie = 'serie1' | 'serie2' | 'serie3' | 'comparacion1' | 'comparacion2' | 'comparacion3' | 'limite' | 'admisibleTrazo' | 'admisibleRelleno' | 'cero';

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
  /**
   * Indice (base 0 dentro de `series`) de la serie de la leyenda a la que
   * acompana: la mitad inferior de una referencia simetrica. Prender o
   * apagar esa serie en la leyenda prende o apaga tambien esta, y ninguna
   * otra: cada toggle controla solo sus lineas.
   */
  acompanaA?: number;
  /** Aclaracion de la serie: se ve al pasar el puntero por su fila de la leyenda. */
  ayuda?: string;
  /** Dibuja los puntos (p. ej. un punto marcado solo, sin linea). */
  puntos?: boolean;
  /** Siempre visible: la leyenda no la apaga (E0 en el grafico de energia). */
  fija?: boolean;
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
  /**
   * Indice de nodo GLOBAL de cada punto de x (series.ts). Es lo que liga el
   * cursor del grafico con la via 3D y con el reproductor; se filtra junto
   * con x cuando sinHuecosEnX saca nodos sin tiempo.
   */
  nodos?: number[];
  /** Con la comparacion A/B cada serie tiene huecos donde el otro diseno tiene puntos: se unen. */
  unirHuecos?: boolean;
  /**
   * Una figura cuya abscisa no es la del resto de la pestana (arco y altura
   * contra el tiempo con el eje en arco) no comparte el cursor de uPlot, que
   * sincroniza por VALOR de x: lleva su propio grupo. El cursor ligado por
   * nodo (estado.nodo) y el marcador del carro la siguen igual.
   */
  grupoDeCursor?: string;
  /**
   * Valores que el eje y incluye siempre al autoescalar (el 0 y E0 en el de
   * energia), ademas del rango de los datos. Un zoom explicito en y manda.
   */
  incluirEnY?: number[];
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
    case 'comparacion1':
      return t.serieComparacion1;
    case 'comparacion2':
      return t.serieComparacion2;
    case 'comparacion3':
      return t.serieComparacion3;
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
      ? {
          sync: { key: claveDeSincronizacion, setSeries: false },
          points: { size: 6 },
          // Solo rangos del eje X: la seleccion ocupa todo el alto del
          // grafico. dist: con menos de eso es un clic (elegir un punto),
          // no una seleccion.
          drag: { x: true, y: false, setScale: true, dist: DISTANCIA_MINIMA_DE_ARRASTRE },
        }
      : { show: false },
    legend: { show: claveDeSincronizacion !== null, live: true },
    scales: datos.incluirEnY
      ? { x: { time: false }, y: { range: (_u, minimo, maximo) => rangoConValores(minimo, maximo, datos.incluirEnY!) } }
      : { x: { time: false } },
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
        spanGaps: datos.unirHuecos ?? false,
        points: s.puntos ? { show: true, size: 9 * escala, fill: colorDeSerie(s.color) } : { show: false },
        // Con A/B, el valor de la serie en la abscisa del cursor aunque el punto sea del otro diseno.
        value: (_u: uPlot, v: number | null, _serie: number, indice: number | null) => {
          const valor = indice === null || indice === undefined ? v : valorEnElCursor(datos, s.valores, indice);
          return valor === null ? SIN_DATO : formatearNumero(valor, datos.decimales, datos.notacion);
        },
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

/** Cuanto se acerca o se aleja un "click" de la rueda. */
const FACTOR_DE_RUEDA = 1.25;
/** Px que hay que arrastrar para que sea una seleccion y no un clic. */
const DISTANCIA_MINIMA_DE_ARRASTRE = 5;
/** La pista "Ctrl + rueda para zoom" se muestra una sola vez por navegador. */
const CLAVE_DE_PISTA = 'pista-ctrl-rueda';
const DURACION_DE_PISTA_MS = 2500;

/**
 * Zoom con Ctrl + rueda y desplazamiento arrastrando. Va como plugin para que
 * la exportacion a PNG (que arma su propio uPlot sin cursor) no lo cargue.
 * `alRuedaSinCtrl` avisa que se uso la rueda sola (la pagina scrollea).
 */
function zoomYDesplazamiento(alRuedaSinCtrl: () => void): uPlot.Plugin {
  return {
    hooks: {
      ready: [
        (u: uPlot) => {
          const over = u.over;

          over.addEventListener(
            'wheel',
            (evento: WheelEvent) => {
              // Sin Ctrl la rueda es de la pagina: no se toca el evento.
              // (El gesto de pellizco de un trackpad llega como Ctrl + rueda.)
              if (!evento.ctrlKey) {
                alRuedaSinCtrl();
                return;
              }
              // Con Ctrl, sin esto el navegador haria zoom de la pagina entera.
              evento.preventDefault();
              const eje = evento.shiftKey ? 'y' : 'x';
              const escala = u.scales[eje];
              if (!escala || escala.min === undefined || escala.max === undefined) return;
              const caja = over.getBoundingClientRect();
              // Fraccion del eje donde esta el puntero: el zoom deja ese punto quieto.
              const fraccion =
                eje === 'x' ? (evento.clientX - caja.left) / caja.width : 1 - (evento.clientY - caja.top) / caja.height;
              // Con Shift, algunos navegadores mandan el giro en deltaX.
              const giro = evento.deltaY !== 0 ? evento.deltaY : evento.deltaX;
              if (giro === 0) return;
              const factor = giro < 0 ? 1 / FACTOR_DE_RUEDA : FACTOR_DE_RUEDA;
              const centro = escala.min + (escala.max - escala.min) * Math.min(Math.max(fraccion, 0), 1);
              u.setScale(eje, {
                min: centro - (centro - escala.min) * factor,
                max: centro + (escala.max - centro) * factor,
              });
            },
            { passive: false },
          );

          // Arrastre con la rueda apretada o con Shift: desplaza los dos ejes.
          let desde: { x: number; y: number; ejeX: [number, number]; ejeY: [number, number] } | null = null;
          const alApretar = (evento: MouseEvent) => {
            const conRueda = evento.button === 1;
            const conShift = evento.button === 0 && evento.shiftKey;
            if (!conRueda && !conShift) return;
            const ex = u.scales.x;
            const ey = u.scales.y;
            if (ex?.min === undefined || ex.max === undefined || ey?.min === undefined || ey.max === undefined) return;
            evento.preventDefault();
            evento.stopPropagation();
            desde = { x: evento.clientX, y: evento.clientY, ejeX: [ex.min, ex.max], ejeY: [ey.min, ey.max] };
          };
          const alMover = (evento: MouseEvent) => {
            if (!desde) return;
            const caja = over.getBoundingClientRect();
            const dx = ((evento.clientX - desde.x) / caja.width) * (desde.ejeX[1] - desde.ejeX[0]);
            const dy = ((evento.clientY - desde.y) / caja.height) * (desde.ejeY[1] - desde.ejeY[0]);
            u.setScale('x', { min: desde.ejeX[0] - dx, max: desde.ejeX[1] - dx });
            u.setScale('y', { min: desde.ejeY[0] + dy, max: desde.ejeY[1] + dy });
          };
          const alSoltar = () => {
            desde = null;
          };
          // Captura desde la raiz: si no, uPlot ya arranco su propia seleccion.
          u.root.addEventListener('mousedown', alApretar, true);
          window.addEventListener('mousemove', alMover);
          window.addEventListener('mouseup', alSoltar);
          u.hooks.destroy = [
            ...(u.hooks.destroy ?? []),
            () => {
              window.removeEventListener('mousemove', alMover);
              window.removeEventListener('mouseup', alSoltar);
            },
          ];
        },
      ],
    },
  };
}

export interface OpcionesDeLaFigura {
  claveDeSincronizacion: string;
  /** Alto del area de dibujo en px CSS. */
  alto: number;
  /** El cursor paso por este punto (indice dentro de datos.x), o salio de la figura. */
  alMoverCursor?: (indice: number | null) => void;
  /** Clic sobre un punto de la figura. */
  alElegirPunto?: (indice: number) => void;
  /** El rango visible en x cambio (zoom, desplazamiento o doble clic). */
  alCambiarRango?: (desde: number, hasta: number, completo: boolean) => void;
}

export class Figura {
  private grafico: uPlot | null = null;
  private datos: DatosDeFigura | null = null;
  private alto: number;
  private readonly contenedor: HTMLElement;
  private readonly opciones: OpcionesDeLaFigura;
  private readonly observador: ResizeObserver;
  /** Valores de todas las series en el punto del cursor, al lado del puntero. */
  private readonly tooltip: HTMLElement;
  /** "Ctrl + rueda para zoom", sobre la figura, la primera vez que se usa la rueda sola. */
  private readonly pista: HTMLElement;
  private temporizadorDePista: ReturnType<typeof setTimeout> | null = null;

  constructor(contenedor: HTMLElement, opciones: OpcionesDeLaFigura) {
    this.contenedor = contenedor;
    this.opciones = opciones;
    this.alto = opciones.alto;
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'figura-tooltip';
    this.tooltip.hidden = true;
    this.pista = document.createElement('div');
    this.pista.className = 'figura-pista';
    this.pista.setAttribute('role', 'status');
    this.pista.textContent = 'Ctrl + rueda para zoom';
    this.pista.hidden = true;
    this.observador = new ResizeObserver(() => this.ajustarTamano());
    this.observador.observe(contenedor);
  }

  private tamano(): TamanoDeFigura {
    return { width: Math.max(320, this.contenedor.clientWidth), height: this.alto };
  }

  private ajustarTamano(): void {
    if (this.grafico) this.grafico.setSize(this.tamano());
  }

  /** Cambia el alto del area de dibujo sin rehacer el uPlot. */
  cambiarAlto(alto: number): void {
    this.alto = alto;
    this.ajustarTamano();
  }

  /** Mueve el cursor al punto dado; no dispara alMoverCursor de vuelta. */
  ponerCursorEn(indice: number | null): void {
    const u = this.grafico;
    if (!u) return;
    this.deAfuera = true;
    if (indice === null) {
      u.setCursor({ left: -10, top: -10 });
      this.tooltip.hidden = true;
    } else {
      const x = u.data[0]![indice];
      if (typeof x === 'number') u.setCursor({ left: u.valToPos(x, 'x'), top: u.cursor.top ?? 0 });
    }
    this.deAfuera = false;
  }

  /** true mientras el cursor lo mueve otro panel: no se reenvia el aviso. */
  private deAfuera = false;

  /** Reemplaza el contenido entero (las series pueden cambiar de cantidad). */
  mostrar(datos: DatosDeFigura): void {
    this.destruir();
    this.datos = datos;
    const opciones = opcionesDeFigura(datos, this.tamano(), this.opciones.claveDeSincronizacion);
    opciones.plugins = [zoomYDesplazamiento(() => this.mostrarPista())];
    opciones.hooks = {
      ...opciones.hooks,
      setCursor: [
        (u: uPlot) => {
          this.dibujarTooltip(u);
          this.dibujarBarrido(u);
        },
      ],
      // Barrido: mientras se arrastra, lo de afuera del rango se oscurece y el
      // rango se va "pintando" con el puntero, con sus extremos rotulados.
      setSelect: [(u: uPlot) => this.dibujarBarrido(u)],
      // La leyenda solo lista la mitad superior de cada referencia simetrica:
      // el toggle se propaga a sus acompanantes (series.ts, acompanantesDe).
      setSeries: [
        (u: uPlot, indice: number | null, opciones: uPlot.Series) => {
          if (indice === null || indice < 1 || opciones.show === undefined) return;
          // Una serie fija no se apaga: se vuelve a prender en el acto.
          if (!opciones.show && datos.series[indice - 1]?.fija) {
            u.setSeries(indice, { show: true });
            return;
          }
          for (const j of acompanantesDe(datos.series, indice - 1)) {
            if (u.series[j + 1]?.show !== opciones.show) u.setSeries(j + 1, { show: opciones.show });
          }
        },
      ],
      setScale: [
        (u: uPlot, clave: string) => {
          if (clave === 'x') this.avisarDelRango(u);
        },
      ],
    };
    this.grafico = new uPlot(opciones, [datos.x, ...datos.series.map((s) => s.valores)], this.contenedor);
    this.contenedor.append(this.tooltip, this.pista);
    this.veloIzquierdo = document.createElement('div');
    this.veloDerecho = document.createElement('div');
    this.rotuloDeRango = document.createElement('div');
    this.veloIzquierdo.className = this.veloDerecho.className = 'figura-velo';
    this.rotuloDeRango.className = 'figura-rango-barrido';
    for (const nodo of [this.veloIzquierdo, this.veloDerecho, this.rotuloDeRango]) {
      nodo.hidden = true;
      this.grafico.over.append(nodo);
    }

    // Leyenda: las series marcadas como ocultas no se listan, y las que
    // traen ayuda la muestran al pasar el puntero (el patron `title` de la UI).
    const filas = this.contenedor.querySelectorAll<HTMLElement>('.u-legend .u-series');
    datos.series.forEach((s, i) => {
      const fila = filas[i + 1];
      if (fila && s.ocultarEnLeyenda) fila.style.display = 'none';
      if (fila && s.ayuda) fila.title = s.ayuda;
    });

    const u = this.grafico;
    u.over.addEventListener('mouseleave', () => {
      this.tooltip.hidden = true;
      this.opciones.alMoverCursor?.(null);
    });
    // Un clic que termina un arrastre (seleccion de rango o desplazamiento) no elige nada.
    let desde: { x: number; y: number } | null = null;
    u.over.addEventListener('mousedown', (evento) => (desde = { x: evento.clientX, y: evento.clientY }));
    u.over.addEventListener('click', (evento) => {
      const arrastro = desde !== null && Math.hypot(evento.clientX - desde.x, evento.clientY - desde.y) >= DISTANCIA_MINIMA_DE_ARRASTRE;
      desde = null;
      if (arrastro || evento.shiftKey || u.cursor.idx === null || u.cursor.idx === undefined) return;
      this.opciones.alElegirPunto?.(u.cursor.idx);
    });
    this.avisarDelRango(u);
  }

  private veloIzquierdo: HTMLElement | null = null;
  private veloDerecho: HTMLElement | null = null;
  private rotuloDeRango: HTMLElement | null = null;

  /** El barrido de la seleccion: velos a los costados y los extremos del rango arriba. */
  private dibujarBarrido(u: uPlot): void {
    const { left, width } = u.select;
    const izquierdo = this.veloIzquierdo;
    const derecho = this.veloDerecho;
    const rotulo = this.rotuloDeRango;
    if (!izquierdo || !derecho || !rotulo) return;
    const activo = width > 0;
    izquierdo.hidden = derecho.hidden = rotulo.hidden = !activo;
    if (!activo || !this.datos) return;
    const total = u.over.clientWidth;
    izquierdo.style.left = '0px';
    izquierdo.style.width = `${left}px`;
    derecho.style.left = `${left + width}px`;
    derecho.style.width = `${Math.max(0, total - left - width)}px`;
    const desde = u.posToVal(left, 'x');
    const hasta = u.posToVal(left + width, 'x');
    rotulo.textContent = `${formatearNumero(desde, this.datos.decimalesX)} – ${formatearNumero(hasta, this.datos.decimalesX)}`;
    rotulo.style.left = `${left + width / 2}px`;
  }

  /** Vuelve a la vista completa en X (el eje Y se reajusta solo), como el doble clic. */
  verTodo(): void {
    const u = this.grafico;
    const x = u?.data[0] as number[] | undefined;
    if (!u || !x || x.length === 0) return;
    u.setScale('x', { min: x[0]!, max: x[x.length - 1]! });
  }

  /** La pista de Ctrl + rueda: una sola vez por navegador, unos segundos. */
  private mostrarPista(): void {
    if (leerAlmacen(CLAVE_DE_PISTA) === 'vista') return;
    escribirAlmacen(CLAVE_DE_PISTA, 'vista');
    this.pista.hidden = false;
    this.temporizadorDePista = setTimeout(() => (this.pista.hidden = true), DURACION_DE_PISTA_MS);
  }

  private avisarDelRango(u: uPlot): void {
    if (!this.opciones.alCambiarRango) return;
    const escala = u.scales.x;
    const x = u.data[0] as number[];
    if (!escala || escala.min === undefined || escala.max === undefined || x.length === 0) return;
    const completo = escala.min <= x[0]! && escala.max >= x[x.length - 1]!;
    this.opciones.alCambiarRango(escala.min, escala.max, completo);
  }

  /**
   * El tooltip del cursor: los valores de TODAS las series de la figura en
   * ese punto, al lado del puntero, en vez de obligar a bajar a la leyenda.
   */
  private dibujarTooltip(u: uPlot): void {
    const datos = this.datos;
    const indice = u.cursor.idx;
    if (!datos || indice === null || indice === undefined || (u.cursor.left ?? -1) < 0) {
      this.tooltip.hidden = true;
      if (!this.deAfuera) this.opciones.alMoverCursor?.(null);
      return;
    }
    const x = datos.x[indice];
    this.tooltip.replaceChildren(
      filaDeTooltip(`${datos.etiquetaX}: ${typeof x === 'number' ? formatearNumero(x, datos.decimalesX) : SIN_DATO}`),
      ...datos.series.flatMap((serie) => {
        if (serie.ocultarEnLeyenda) return [];
        const valor = valorEnElCursor(datos, serie.valores, indice);
        return [filaDeSerie(serie, valor === null ? SIN_DATO : formatearNumero(valor, datos.decimales, datos.notacion))];
      }),
    );
    this.tooltip.hidden = false;
    // Del lado del cursor donde haya lugar, para no tapar lo que se esta mirando.
    const izquierda = (u.cursor.left ?? 0) + u.bbox.left / devicePixelRatio;
    const aLaDerecha = izquierda + this.tooltip.offsetWidth + 16 < this.contenedor.clientWidth;
    this.tooltip.style.left = `${Math.round(aLaDerecha ? izquierda + 12 : izquierda - this.tooltip.offsetWidth - 12)}px`;
    this.tooltip.style.top = `${Math.round((u.cursor.top ?? 0) + u.bbox.top / devicePixelRatio)}px`;
    if (!this.deAfuera) this.opciones.alMoverCursor?.(indice);
  }

  /** Destruye el uPlot y vacia el contenedor; el ResizeObserver sigue hasta destruirDelTodo. */
  destruir(): void {
    this.grafico?.destroy();
    this.grafico = null;
    this.datos = null;
    this.contenedor.replaceChildren();
    this.tooltip.hidden = true;
  }

  /** destruir() mas soltar el ResizeObserver: la figura no se vuelve a usar. */
  destruirDelTodo(): void {
    this.destruir();
    if (this.temporizadorDePista) clearTimeout(this.temporizadorDePista);
    this.observador.disconnect();
  }
}

function filaDeTooltip(texto: string): HTMLElement {
  const fila = document.createElement('div');
  fila.className = 'figura-tooltip-x';
  fila.textContent = texto;
  return fila;
}

function filaDeSerie(serie: SerieDeFigura, valor: string): HTMLElement {
  const fila = document.createElement('div');
  fila.className = 'figura-tooltip-serie';
  const muestra = document.createElement('span');
  muestra.className = 'figura-tooltip-muestra';
  muestra.style.background = colorDeSerie(serie.color);
  const nombre = document.createElement('span');
  nombre.className = 'figura-tooltip-nombre';
  nombre.textContent = serie.etiqueta;
  const numero = document.createElement('span');
  numero.className = 'figura-tooltip-valor';
  numero.textContent = valor;
  fila.append(muestra, nombre, numero);
  return fila;
}
