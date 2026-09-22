// Bloque de veredicto, arriba del panel de resultados: pasa / no pasa en
// grande, los tres numeros que se miran siempre (Gz maxima, Gz minima, |Gy|
// maxima) con el lugar donde ocurren, el criterio que peor esta y los
// ajustes inertes.
//
// Los criterios de aceptacion son el diferencial del proyecto (aplican ASTM
// F2291) y hasta ahora eran una lista al final de un panel al que habia que
// scrollear, visible solo con un elemento elegido. Esto es presentacion: el
// calculo esta en contrato/veredicto.ts, que solo lee el JSON.

import type { UbicacionDeExtremo } from '../contrato/veredicto';
import { veredictoDelLayout } from '../contrato/veredicto';
import type { Estado } from '../estado';
import { el, vaciar } from './dom';
import { formatear } from './formato';
import { textoDeInerte } from './parametros';
import type { NombreDeParametro } from '../nucleo/tipos';

/** "3. Helice · ArcoPrincipal · arco 7.158 m" */
function textoDeUbicacion(donde: UbicacionDeExtremo | null): string {
  if (!donde) return '—';
  const partes = [`${donde.elemento + 1}. ${donde.tipo}`];
  if (donde.subtramo) partes.push(donde.subtramo);
  if (donde.arco !== null) partes.push(`arco ${formatear(donde.arco, 'm')}`);
  return partes.join(' · ');
}

function cifra(etiqueta: string, valor: string, donde: string): HTMLElement {
  return el(
    'div',
    { class: 'veredicto-cifra' },
    el('span', { class: 'veredicto-cifra-etiqueta' }, etiqueta),
    el('span', { class: 'veredicto-cifra-valor' }, valor),
    el('span', { class: 'veredicto-cifra-donde' }, donde),
  );
}

export function montarVeredicto(contenedor: HTMLElement, estado: Estado): void {
  const dibujar = () => {
    const { layout } = estado.get();
    vaciar(contenedor);
    if (!layout) return;
    const v = veredictoDelLayout(layout);
    const clase = v.pasa ? 'pasa' : 'falla';

    const peor = v.peorCriterio;
    const detalleDelPeor = peor
      ? `${peor.criterio.nombre} · ${peor.elemento + 1}. ${peor.tipo} · ${formatear(peor.criterio.valor, peor.criterio.unidad)} ${
          peor.criterio.sentido === 'MenorOIgual' ? '≤' : '≥'
        } ${formatear(peor.criterio.limite, peor.criterio.unidad)} · margen ${formatear(peor.criterio.margen, peor.criterio.unidad)}`
      : 'sin criterios evaluables';

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
          cifra('Gz máxima', formatear(v.gzMaxima, 'G'), textoDeUbicacion(v.dondeGzMaxima)),
          cifra('Gz mínima', formatear(v.gzMinima, 'G'), textoDeUbicacion(v.dondeGzMinima)),
          cifra('|Gy| máxima', formatear(v.gyMaximaAbsoluta, 'G'), textoDeUbicacion(v.dondeGyMaxima)),
        ),
        el(
          'p',
          { class: `veredicto-peor ${peor && !peor.criterio.pasa ? 'falla' : ''}` },
          el('span', { class: 'veredicto-cifra-etiqueta' }, peor && !peor.criterio.pasa ? 'Criterio peor: ' : 'Criterio más ajustado: '),
          detalleDelPeor,
        ),
        // Los inertes que la fase 1 dejo en el layout exportado: se aplicaron y no tuvieron efecto.
        v.inertes.map((i) =>
          el(
            'p',
            { class: 'advertencia' },
            `${i.elemento + 1}. ${i.tipo}: `,
            i.nombres
              .map((nombre) => textoDeInerte((nombre[0]!.toUpperCase() + nombre.slice(1)) as NombreDeParametro, layout.parametros.valores.modoCurvatura as never, i.tipo as never))
              .join('; '),
          ),
        ),
      ),
    );
  };
  dibujar();
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.layout !== anterior.layout) dibujar();
  });
}
