// Una figura como PNG para el paquete .zip. uPlot dibuja las series y los
// ejes en un canvas, pero el titulo y la leyenda son DOM: se dibuja la
// figura en un contenedor fuera de pantalla y se compone en un canvas
// propio con fondo (el de la pagina: sobre PNG transparente el texto claro
// del tema oscuro no se veria), el titulo arriba y una leyenda dibujada a
// mano abajo, con las mismas series y colores que en pantalla.
//
// Resolucion: 2x el devicePixelRatio, para que sirva impresa en la memoria
// de calculo. uPlot usa siempre el devicePixelRatio de la ventana, asi que
// el 2x se consigue dibujando al doble de tamano CSS con trazos, fuentes y
// ejes escalados al doble (opcionesDeFigura con escala = 2).
//
// PNG y no JPG: curvas finas sobre fondo oscuro es el peor caso para JPG
// (halos alrededor de cada trazo) y encima pesa mas que el PNG en este
// tipo de imagen.

import uPlot from 'uplot';
import { fuenteDeCanvas, tema } from '../tema';
import { opcionesDeFigura, type DatosDeFigura } from './figura';

export const ESCALA_DE_EXPORTACION = 2;
/** Tamano CSS de la figura exportada (antes de escalar). */
export const ANCHO_DE_EXPORTACION = 960;
export const ALTO_DE_EXPORTACION = 320;

function aBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolver, rechazar) => {
    canvas.toBlob((blob) => (blob ? resolver(blob) : rechazar(new Error('El navegador no pudo codificar el PNG.'))), 'image/png');
  });
}

/** Dibuja `datos` fuera de pantalla y devuelve el PNG compuesto (fondo, titulo, figura, leyenda). */
export async function figuraAPng(datos: DatosDeFigura): Promise<Blob> {
  const escala = ESCALA_DE_EXPORTACION;
  const razon = devicePixelRatio * escala; // px de canvas por px CSS "logico" de la figura
  const t = tema();
  const contenedor = document.createElement('div');
  contenedor.style.cssText = 'position:fixed;left:-100000px;top:0;';
  document.body.append(contenedor);
  try {
    const opciones = opcionesDeFigura(datos, { width: ANCHO_DE_EXPORTACION * escala, height: ALTO_DE_EXPORTACION * escala }, null, escala);
    opciones.title = undefined; // el titulo se dibuja aca, en el canvas compuesto
    const grafico = new uPlot(opciones, [datos.x, ...datos.series.map((s) => s.valores)], contenedor);
    // uPlot dimensiona y dibuja su canvas en un microtask (commit()), no en el
    // constructor: sin esperar un tick el canvas sigue en 300x150 sin dibujar.
    await new Promise((listo) => setTimeout(listo, 0));
    const lienzo = grafico.ctx.canvas;
    if (lienzo.width < opciones.width) throw new Error(`uPlot no dibujo la figura "${datos.titulo}" (canvas de ${lienzo.width} px).`);

    // Leyenda: una entrada por serie visible, en filas que entran en el ancho.
    const visibles = datos.series.filter((s) => !s.ocultarEnLeyenda);
    const fuenteLeyenda = fuenteDeCanvas(razon);
    const fuenteTitulo = `600 ${parseFloat(t.textoSm) * razon}px ${t.fuente}`;
    const margen = 12 * razon;
    const altoTitulo = 22 * razon;
    const altoFila = 18 * razon;
    const muestra = 22 * razon;
    const medidor = document.createElement('canvas').getContext('2d')!;
    medidor.font = fuenteLeyenda;
    const filas: { serie: (typeof visibles)[number]; x: number; fila: number; ancho: number }[] = [];
    let x = margen;
    let fila = 0;
    for (const serie of visibles) {
      const ancho = muestra + 6 * razon + medidor.measureText(serie.etiqueta).width + 16 * razon;
      if (x + ancho > lienzo.width - margen && x > margen) {
        x = margen;
        fila++;
      }
      filas.push({ serie, x, fila, ancho });
      x += ancho;
    }
    const altoLeyenda = (fila + 1) * altoFila + margen;

    const salida = document.createElement('canvas');
    salida.width = lienzo.width;
    salida.height = altoTitulo + lienzo.height + altoLeyenda;
    const ctx = salida.getContext('2d')!;
    ctx.fillStyle = t.superficie0;
    ctx.fillRect(0, 0, salida.width, salida.height);
    ctx.fillStyle = t.texto1;
    ctx.font = fuenteTitulo;
    ctx.textBaseline = 'middle';
    ctx.fillText(datos.titulo, margen, altoTitulo / 2);
    ctx.drawImage(lienzo, 0, altoTitulo);
    ctx.font = fuenteLeyenda;
    for (const { serie, x: x0, fila: f } of filas) {
      const y = altoTitulo + lienzo.height + margen / 2 + f * altoFila + altoFila / 2;
      const opcionesDeSerie = opciones.series[datos.series.indexOf(serie) + 1]!;
      ctx.strokeStyle = String(opcionesDeSerie.stroke);
      ctx.lineWidth = Number(opcionesDeSerie.width ?? 1.6 * escala) * devicePixelRatio;
      ctx.setLineDash((opcionesDeSerie.dash ?? []).map((d) => d * devicePixelRatio));
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + muestra, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = t.texto2;
      ctx.fillText(serie.etiqueta, x0 + muestra + 6 * razon, y);
    }
    grafico.destroy();
    return await aBlob(salida);
  } finally {
    contenedor.remove();
  }
}

/** Nombre de archivo de una figura dentro de graficos/: `<pestana>-<clave>.png`. */
export function nombreDeFigura(pestana: string, datos: DatosDeFigura, indice: number): string {
  return `${pestana}-${datos.clave ?? indice + 1}.png`;
}
