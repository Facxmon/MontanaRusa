// Resumen numerico: el del layout entero (resumenLayout) y, si hay un
// elemento elegido, el de ese elemento (resumen). Las unidades son las del
// contrato; formatear() pasa los radianes a grados.

import type { Layout, ResumenElemento, ResumenLayout } from '../contrato/tipos';
import { esRecalculo, type Estado } from '../estado';
import { destellarCambios, el, fila, tarjeta, vaciar, valoresPorClave } from './dom';
import { decimalesDeUnidad, formatear, formatearNumero } from './formato';
import { textoDeInerte } from './parametros';
import { elementosConModoPropio, modoDelElemento } from '../contrato/modo';
import type { NombreDeParametro } from '../nucleo/tipos';

function tablaDelLayout(resumen: ResumenLayout, layout: Layout): HTMLElement {
  const filas = [
    fila('Elementos', String(resumen.numeroDeElementos)),
    fila('Longitud total', formatear(resumen.longitudTotal, 'm')),
    fila('Tiempo total', formatear(resumen.tiempoTotal, 's')),
    fila('Velocidad inicial', formatear(layout.estadoInicial.velocidad, 'm/s')),
    fila('Velocidad final', formatear(resumen.velocidadFinal, 'm/s')),
    fila('Gz máxima / mínima', `${formatear(resumen.gzMaximaGlobal, 'G')} / ${formatear(resumen.gzMinimaGlobal, 'G')}`),
    fila('|Gy| máxima', formatear(resumen.gyMaximaAbsolutaGlobal, 'G')),
    fila('Altura del riel (máx / mín)', `${formatear(resumen.alturaMaxima, 'm')} / ${formatear(resumen.alturaMinima, 'm')}`),
    fila(
      'Criterios',
      resumen.todosLosCriteriosPasan ? 'todos pasan' : 'hay criterios que no pasan',
      resumen.todosLosCriteriosPasan ? 'pasa' : 'falla',
    ),
  ];
  return el('table', { class: 'tabla' }, el('tbody', {}, filas));
}

function tablaDelElemento(resumen: ResumenElemento, modo: string): HTMLElement {
  const filas = [
    fila('Modo de curvatura', modo),
    fila('Método', resumen.metodo ?? '—'),
    fila('Longitud recorrida', formatear(resumen.longitudRecorrida, 'm')),
    fila('Altura sobre la entrada', formatear(resumen.alturaMaxima, 'm')),
    fila('Radio mínimo heartline / riel', `${formatear(resumen.radioMinimo, 'm')} / ${formatear(resumen.radioMinimoRiel, 'm')}`),
    fila('Velocidad mínima', formatear(resumen.velocidadMinima, 'm/s')),
    fila('Tiempo de recorrido', formatear(resumen.tiempoDeRecorrido, 's')),
    fila('Gz máxima / mínima', `${formatear(resumen.gzMaxima, 'G')} / ${formatear(resumen.gzMinima, 'G')}`),
    fila('|Gy| máxima', formatear(resumen.gyMaximaAbsoluta, 'G')),
    fila('Fuerza normal máxima', formatear(resumen.fuerzaNormalMaxima, 'N')),
    fila('Peralte máximo', formatear(resumen.peralteMaximo, 'rad')),
    fila('Inclinación helicoidal (tan α)', formatear(resumen.inclinacionHelicoidal, '-')),
    fila(
      'Avance sobre el eje (medido / objetivo)',
      `${formatear(resumen.desplazamientoLateral, 'm')} / ${formatear(resumen.desplazamientoLateralObjetivo, 'm')}`,
    ),
    fila('λ loop / λ carro', `${formatear(resumen.lambdaLoop, '-')} / ${formatear(resumen.lambdaCarro, '-')}`),
    fila('Velocidad inicial mínima', formatear(resumen.velocidadInicialMinima, 'm/s')),
  ];
  // Los saltos del empalme son la razon de ser de la continuidad: destacados.
  const saltos = [
    fila('Salto de posición en el empalme', formatearSalto(resumen.saltoDePosicion, 'm'), 'salto'),
    fila('Salto de tangente en el empalme', formatearSalto(resumen.saltoDeTangente, '-'), 'salto'),
    fila('Salto de curvatura en el empalme', formatearSalto(resumen.saltoDeCurvatura, '1/m'), 'salto'),
    fila('Residual de cierre del giro', formatearSalto(resumen.residualCierrePitch, 'rad'), 'salto'),
  ];
  return el('table', { class: 'tabla' }, el('tbody', {}, filas, saltos));
}

function formatearSalto(valor: number | null | undefined, unidad: string): string {
  if (valor === null || valor === undefined) return '—';
  if (valor === 0) return unidad === '-' ? '0' : `0 ${unidad}`;
  const texto = Math.abs(valor) < 1e-4 ? valor.toExponential(2) : formatearNumero(valor, decimalesDeUnidad(unidad));
  if (unidad === 'rad') return `${texto} rad`;
  return unidad === '-' ? texto : `${texto} ${unidad}`;
}

export function montarResumenLayout(contenedor: HTMLElement, estado: Estado): void {
  const dibujar = (destellar = false) => {
    const antes = destellar ? valoresPorClave(contenedor) : null;
    const { layout, caso } = estado.get();
    vaciar(contenedor);
    if (!layout) return;
    const r = layout.resumenLayout;
    contenedor.append(tarjeta(
      {
        clave: 'layout',
        titulo: 'Layout',
        resumen: `${r.numeroDeElementos} elementos · ${formatear(r.longitudTotal, 'm')} · ${formatear(r.tiempoTotal, 's')}`,
      },
      el(
        'p',
        { class: 'ayuda' },
        `${caso ?? ''} · modo ${layout.parametros.valores.modoCurvatura}${elementosConModoPropio(layout) ? ` (global; ${elementosConModoPropio(layout)} con modo propio)` : ''} · método ${layout.parametros.valores.metodoDeAcoplamiento} · generado ${layout.meta.generadoEn ?? '?'} (${layout.meta.versionGenerador ?? '?'})`,
      ),
      tablaDelLayout(r, layout),
    ));
    if (antes) destellarCambios(contenedor, antes);
  };
  dibujar();
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.layout !== anterior.layout) dibujar(esRecalculo(nuevo, anterior));
  });
}

export function montarResumenElemento(contenedor: HTMLElement, estado: Estado): void {
  const dibujar = (destellar = false) => {
    const antes = destellar ? valoresPorClave(contenedor) : null;
    const { layout, elemento } = estado.get();
    vaciar(contenedor);
    if (!layout || elemento === null) return;
    const e = layout.elementos[elemento];
    if (!e) return;
    contenedor.append(tarjeta(
      {
        clave: 'elemento',
        titulo: `Elemento ${elemento + 1}: ${e.tipo}`,
        resumen: `Gz ${formatear(e.resumen.gzMaxima, 'G')} / ${formatear(e.resumen.gzMinima, 'G')} · |Gy| ${formatear(e.resumen.gyMaximaAbsoluta, 'G')}`,
      },
      el(
        'p',
        { class: 'ayuda' },
        `${e.nodos.numeroDeNodos} nodos · ${e.subtramos.map((s) => `${s.nombre} ${s.indiceInicio}–${s.indiceFin}`).join(' · ')}`,
      ),
      tablaDelElemento(e.resumen, modoDelElemento(layout, elemento)),
      // Los inertes viajan en el layout desde la fase 1: ajustes que se
      // aplicaron y que ni el modo ni el tipo de este elemento consumen.
      ...(e.inertes ?? []).map((nombre) =>
        el(
          'p',
          { class: 'advertencia' },
          textoDeInerte((nombre[0]!.toUpperCase() + nombre.slice(1)) as NombreDeParametro, modoDelElemento(layout, elemento), e.tipo as never),
        ),
      ),
    ));
    if (antes) destellarCambios(contenedor, antes);
  };
  dibujar();
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.layout !== anterior.layout || nuevo.elemento !== anterior.elemento) dibujar(nuevo.elemento === anterior.elemento && esRecalculo(nuevo, anterior));
  });
}
