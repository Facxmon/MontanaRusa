// Bloque de veredicto, arriba del panel de resultados: pasa / no pasa en
// grande, los tres numeros que se miran siempre (Gz maxima, Gz minima, |Gy|
// maxima), el criterio que peor esta y los ajustes inertes.
//
// Resumido en la tarea 3 de interfaz (tenia demasiado texto):
//  - cada G es un valor grande y, en UNA linea debajo, su margen contra la
//    norma (el criterio normativo de ese eje, ver contrato/veredicto.ts);
//  - donde ocurre (elemento · subtramo · arco) pasa al tooltip del valor, y
//    clickear el valor ubica ese punto en el 3D (resalta el elemento, lleva
//    el carro y el marcador ahi y acerca la camara);
//  - el criterio peor va en una sola linea: nombre y margen; el detalle
//    (elemento, valor contra limite) queda en el tooltip.
//
// Esto es presentacion: el calculo esta en contrato/veredicto.ts, que solo
// lee el JSON.

import type { MargenNormativo, UbicacionDeExtremo } from '../contrato/veredicto';
import { veredictoDelLayout } from '../contrato/veredicto';
import { esRecalculo, type Estado } from '../estado';
import { destellarCambios, el, vaciar, valoresPorClave } from './dom';
import { formatear } from './formato';
import { textoDeInerte } from './parametros';
import { modoDelElemento } from '../contrato/modo';
import type { NombreDeParametro } from '../nucleo/tipos';

/** "3. Helice · ArcoPrincipal · arco 7.158 m" */
function textoDeUbicacion(donde: UbicacionDeExtremo | null): string {
  if (!donde) return '—';
  const partes = [`${donde.elemento + 1}. ${donde.tipo}`];
  if (donde.subtramo) partes.push(donde.subtramo);
  if (donde.arco !== null) partes.push(`arco ${formatear(donde.arco, 'm')}`);
  return partes.join(' · ');
}

/** Un margen con signo explicito: "+0.11 G", "−0.33 m". */
function conSigno(valor: number | null, unidad: string): string {
  if (valor === null || !Number.isFinite(valor)) return formatear(null, unidad);
  const signo = valor > 0 ? '+' : valor < 0 ? '−' : '±';
  return `${signo}${formatear(Math.abs(valor), unidad)}`;
}

/** La linea del margen contra la norma de un eje, con el detalle del criterio en el tooltip. */
function lineaDeMargen(margen: MargenNormativo | null): HTMLElement {
  if (!margen) {
    return el(
      'span',
      { class: 'veredicto-cifra-margen', title: 'El criterio normativo de este eje es informativo en todos los elementos: ningún evento sostenido supera los 200 ms (ASTM F2291, 7.1.4.2).' },
      'norma: sin evento sostenido',
    );
  }
  const { criterio } = margen;
  return el(
    'span',
    {
      class: `veredicto-cifra-margen${criterio.pasa ? '' : ' falla'}`,
      'data-clave': `margen-${criterio.nombre}`,
      title: `${criterio.nombre}, peor caso en ${margen.elemento + 1}. ${margen.tipo}${criterio.detalle ? `: ${criterio.detalle}` : ''}`,
    },
    `margen ${conSigno(margen.margen, criterio.unidad)}`,
  );
}

function cifra(
  etiqueta: string,
  valor: string,
  donde: UbicacionDeExtremo | null,
  margen: MargenNormativo | null,
  ubicar: ((donde: UbicacionDeExtremo) => void) | undefined,
  deA?: string,
): HTMLElement {
  const lugar = textoDeUbicacion(donde);
  // El valor es el boton que ubica el punto en el 3D; donde ocurre va en el tooltip.
  const numero =
    donde && ubicar
      ? el(
          'button',
          {
            type: 'button',
            class: 'veredicto-cifra-valor veredicto-ubicar',
            'data-clave': etiqueta,
            title: `${lugar}. Clic: verlo en el 3D.`,
            'aria-label': `${etiqueta} ${valor}, en ${lugar}. Ver en el 3D`,
            onClick: () => ubicar(donde),
          },
          valor,
          el('span', { class: 'veredicto-ubicar-icono', 'aria-hidden': 'true' }, '⌖'),
        )
      : el('span', { class: 'veredicto-cifra-valor', 'data-clave': etiqueta, title: lugar }, valor);
  return el(
    'div',
    { class: 'veredicto-cifra' },
    el('span', { class: 'veredicto-cifra-etiqueta' }, etiqueta),
    numero,
    lineaDeMargen(margen),
    // Con una comparacion A/B (fase 4.8): cuanto valia en A y la diferencia.
    deA ? el('span', { class: 'veredicto-cifra-a' }, deA) : null,
  );
}

/** "A 7.23 G (−1.54)": el valor de A y cuanto cambio B respecto de A. */
function textoDeA(b: number | null, a: number | null): string | undefined {
  if (a === null || b === null) return undefined;
  return `A ${formatear(a, 'G')} (${conSigno(b - a, 'G').replace(' G', '')})`;
}

/** `ubicar` lleva el 3D al punto de un extremo (lo arma visualizador.ts). */
export function montarVeredicto(contenedor: HTMLElement, estado: Estado, ubicar?: (donde: UbicacionDeExtremo) => void): void {
  const dibujar = (destellar = false) => {
    const antes = destellar ? valoresPorClave(contenedor) : null;
    const { layout } = estado.get();
    vaciar(contenedor);
    if (!layout) return;
    const v = veredictoDelLayout(layout);
    const { comparacion } = estado.get();
    const a = comparacion && comparacion.layout !== layout ? veredictoDelLayout(comparacion.layout) : null;
    const clase = v.pasa ? 'pasa' : 'falla';

    const peor = v.peorCriterio;
    const falla = peor !== null && !peor.criterio.pasa;
    const lineaDelPeor = peor
      ? el(
          'p',
          {
            class: `veredicto-peor${falla ? ' falla' : ''}`,
            title: `${peor.criterio.nombre} · ${peor.elemento + 1}. ${peor.tipo} · ${formatear(peor.criterio.valor, peor.criterio.unidad)} ${
              peor.criterio.sentido === 'MenorOIgual' ? '≤' : '≥'
            } ${formatear(peor.criterio.limite, peor.criterio.unidad)}${peor.criterio.detalle ? ` · ${peor.criterio.detalle}` : ''}`,
          },
          el('span', { class: 'veredicto-cifra-etiqueta' }, falla ? 'Peor ' : 'Más ajustado '),
          el('span', { class: 'veredicto-peor-nombre' }, peor.criterio.nombre),
          el('span', { class: 'veredicto-peor-margen', 'data-clave': 'margen-peor' }, conSigno(peor.criterio.margen ?? null, peor.criterio.unidad)),
        )
      : el('p', { class: 'veredicto-peor' }, 'Sin criterios evaluables');

    contenedor.append(
      el(
        'div',
        { class: `veredicto ${clase}` },
        el(
          'div',
          { class: 'veredicto-cabecera' },
          el('span', { class: `veredicto-marca ${clase}` }, v.pasa ? '✓' : '✗'),
          el(
            'span',
            { class: 'veredicto-titulo' },
            v.pasa ? 'Pasa' : 'No pasa',
            el('small', {}, v.pasa ? ` los ${v.criteriosEvaluados} criterios` : ` ${v.criteriosQueNoPasan} de ${v.criteriosEvaluados} criterios`),
          ),
        ),
        el(
          'div',
          { class: 'veredicto-cifras' },
          cifra('Gz máx', formatear(v.gzMaxima, 'G'), v.dondeGzMaxima, v.margenGzMaxima, ubicar, a ? textoDeA(v.gzMaxima, a.gzMaxima) : undefined),
          cifra('Gz mín', formatear(v.gzMinima, 'G'), v.dondeGzMinima, v.margenGzMinima, ubicar, a ? textoDeA(v.gzMinima, a.gzMinima) : undefined),
          cifra('|Gy| máx', formatear(v.gyMaximaAbsoluta, 'G'), v.dondeGyMaxima, v.margenGyMaxima, ubicar, a ? textoDeA(v.gyMaximaAbsoluta, a.gyMaximaAbsoluta) : undefined),
        ),
        lineaDelPeor,
        // Los inertes que la fase 1 dejo en el layout exportado: se aplicaron y no tuvieron efecto.
        v.inertes.map((i) =>
          el(
            'p',
            { class: 'advertencia' },
            `${i.elemento + 1}. ${i.tipo}: `,
            i.nombres
              .map((nombre) => textoDeInerte((nombre[0]!.toUpperCase() + nombre.slice(1)) as NombreDeParametro, modoDelElemento(layout, i.elemento), i.tipo as never))
              .join('; '),
          ),
        ),
      ),
    );
    if (antes) destellarCambios(contenedor, antes);
  };
  dibujar();
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.layout !== anterior.layout || nuevo.comparacion !== anterior.comparacion) dibujar(esRecalculo(nuevo, anterior));
  });
}
