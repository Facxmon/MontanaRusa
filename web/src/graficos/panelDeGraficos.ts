// El area de graficos: barra de pestanas (G, jerk, cinematica, roll,
// curvatura), selector del eje horizontal, alto de las figuras y las figuras
// de la pestana activa, una debajo de la otra con el cursor sincronizado.
//
// Cada figura trae su propia barra: expandir a todo el panel (Esc vuelve),
// PNG a 2x y CSV. Debajo, cuando hay un rango elegido (zoom o seleccion),
// la estadistica de ese rango: maximo, minimo, promedio y DONDE ocurre el
// maximo de cada serie, que es exactamente lo que se quiere saber cuando se
// lee una curva de G y hasta ahora habia que estimar a ojo.
//
// El cursor no se queda en el grafico: cada movimiento publica el indice de
// nodo GLOBAL en estado.nodo, que es lo que leen el marcador de la via 3D,
// el bloque de valores del panel lateral y el reproductor (fase 3.6).

import type { Estado } from '../estado';
import { leerAlmacen, escribirAlmacen } from '../paneles/almacen';
import { el, vaciar } from '../paneles/dom';
import { formatearNumero } from '../paneles/formato';
import { descargarArchivo, slug } from '../paneles/archivo';
import { csvDeFigura } from '../nucleo/descargar';
import { figuraAPng, nombreDeFigura } from './exportarFigura';
import { Figura, type DatosDeFigura } from './figura';
import {
  estadisticaDeRango,
  indiceDeNodo,
  ETIQUETA_DE_EJE,
  extraerColumnas,
  figurasDePestana,
  PESTANAS,
  type EjeX,
  type Pestana,
} from './series';

/** Altos ofrecidos, en px CSS. El elegido se recuerda en localStorage. */
const ALTOS = [240, 360, 480];
const CLAVE_DE_ALTO = 'alto-figura';
const CLAVE_DE_AYUDA = 'ayuda-zoom-vista';

function altoGuardado(): number {
  const guardado = Number(leerAlmacen(CLAVE_DE_ALTO));
  return ALTOS.includes(guardado) ? guardado : ALTOS[0]!;
}

/** Devuelve la funcion que destruye las figuras (uPlot y sus ResizeObserver). */
export function montarPanelDeGraficos(contenedor: HTMLElement, estado: Estado): () => void {
  const barra = el('div', { class: 'graficos-barra' });
  const cuerpo = el('div', { class: 'graficos-cuerpo' });
  contenedor.append(barra, cuerpo);
  let figuras: Figura[] = [];
  let datosDeFiguras: DatosDeFigura[] = [];
  let alto = altoGuardado();
  let expandida: number | null = null;
  // true mientras el cursor lo mueve otro panel: no se reenvia al estado.
  let aplicandoCursor = false;

  const dibujarBarra = () => {
    const { pestana, ejeX } = estado.get();
    vaciar(barra);
    const pestanas = el(
      'div',
      { class: 'pestanas', role: 'tablist' },
      PESTANAS.map((p) =>
        el(
          'button',
          {
            type: 'button',
            role: 'tab',
            class: p.clave === pestana ? 'pestana activa' : 'pestana',
            'aria-selected': p.clave === pestana ? 'true' : 'false',
            onClick: () => estado.set({ pestana: p.clave }),
          },
          p.etiqueta,
        ),
      ),
    );
    const selector = el(
      'select',
      { onChange: (evento: Event) => estado.set({ ejeX: (evento.target as HTMLSelectElement).value as EjeX }) },
      (Object.keys(ETIQUETA_DE_EJE) as EjeX[]).map((clave) => {
        const opcion = el('option', { value: clave }, ETIQUETA_DE_EJE[clave]);
        if (clave === ejeX) opcion.selected = true;
        return opcion;
      }),
    );
    const selectorDeAlto = el(
      'select',
      {
        title: 'Alto de cada figura',
        onChange: (evento: Event) => {
          alto = Number((evento.target as HTMLSelectElement).value);
          escribirAlmacen(CLAVE_DE_ALTO, String(alto));
          for (const f of figuras) f.cambiarAlto(alto);
        },
      },
      ALTOS.map((v) => {
        const opcion = el('option', { value: String(v) }, `${v} px`);
        if (v === alto) opcion.selected = true;
        return opcion;
      }),
    );
    barra.append(
      pestanas,
      el(
        'div',
        { class: 'graficos-opciones' },
        el('label', { class: 'graficos-eje' }, 'Eje horizontal ', selector),
        el('label', { class: 'graficos-eje' }, 'Alto ', selectorDeAlto),
      ),
    );
  };

  /** El cartel que cuenta como se navega; se muestra una sola vez. */
  const ayudaDeNavegacion = (): HTMLElement | null => {
    if (leerAlmacen(CLAVE_DE_AYUDA) === 'visto') return null;
    const cartel = el(
      'p',
      { class: 'graficos-ayuda-zoom', role: 'note' },
      'Arrastrar hace zoom (horizontal, vertical o en caja), la rueda acerca y aleja (Shift = eje vertical), ',
      'arrastrar con Shift o con la rueda apretada desplaza y el doble clic vuelve a la vista completa. ',
      'Como la rueda queda tomada por el zoom, la lista de figuras se recorre con la barra de la derecha o con ⤢.',
      el(
        'button',
        {
          type: 'button',
          class: 'boton chico',
          onClick: () => {
            escribirAlmacen(CLAVE_DE_AYUDA, 'visto');
            cartel.remove();
          },
        },
        'Entendido',
      ),
    );
    return cartel;
  };

  const nombreBase = () => {
    const { origen, caso, pestana } = estado.get();
    return { fuente: slug(origen ?? caso ?? 'diseno'), pestana };
  };

  /** Expandir una figura a todo el panel; Esc (o el mismo boton) vuelve. */
  const expandir = (indice: number | null) => {
    expandida = indice;
    cuerpo.classList.toggle('expandido', indice !== null);
    const cajas = Array.from(cuerpo.querySelectorAll<HTMLElement>('.figura-caja'));
    cajas.forEach((caja, i) => {
      caja.hidden = indice !== null && i !== indice;
      caja.classList.toggle('expandida', indice === i);
    });
    figuras.forEach((f, i) => {
      // Al expandir, la figura ocupa el alto del panel menos la barra y la leyenda.
      f.cambiarAlto(indice === i ? Math.max(ALTOS[0]!, cuerpo.clientHeight - 140) : alto);
    });
  };

  const alTeclear = (evento: KeyboardEvent) => {
    if (evento.key === 'Escape' && expandida !== null) {
      evento.preventDefault();
      expandir(null);
    }
  };
  document.addEventListener('keydown', alTeclear);

  const dibujarFiguras = () => {
    const { layout, elemento, pestana, ejeX, vista } = estado.get();
    for (const f of figuras) f.destruirDelTodo();
    figuras = [];
    datosDeFiguras = [];
    expandida = null;
    cuerpo.classList.remove('expandido');
    vaciar(cuerpo);
    if (vista !== 'graficos' || !layout) return;
    const columnas = extraerColumnas(layout, elemento);
    const datos = figurasDePestana(pestana as Pestana, columnas, ejeX);
    datosDeFiguras = datos;
    cuerpo.append(
      el(
        'p',
        { class: 'ayuda graficos-ayuda' },
        elemento === null
          ? 'Todo el layout: las franjas son los elementos. Elegir un elemento en el panel para ver sus subtramos.'
          : `Elemento ${elemento + 1}: ${layout.elementos[elemento]?.tipo ?? ''}. Las franjas son los subtramos.`,
      ),
    );
    const cartel = ayudaDeNavegacion();
    if (cartel) cuerpo.append(cartel);

    datos.forEach((d, indice) => {
      const lienzo = el('div', { class: 'figura' });
      const rango = el('div', { class: 'figura-rango', hidden: true });
      const caja = el(
        'section',
        { class: 'figura-caja' },
        el(
          'div',
          { class: 'figura-acciones' },
          el('button', { type: 'button', class: 'boton chico', title: 'Expandir a todo el panel (Esc vuelve)', 'aria-label': `Expandir ${d.titulo}`, onClick: () => expandir(expandida === indice ? null : indice) }, '⤢'),
          el('button', { type: 'button', class: 'boton chico', title: 'Descargar esta figura en PNG a 2x', onClick: () => void exportarPng(d, indice) }, 'PNG'),
          el('button', { type: 'button', class: 'boton chico', title: 'Descargar los datos de esta figura en CSV', onClick: () => exportarCsv(d, indice) }, 'CSV'),
        ),
        lienzo,
        rango,
      );
      cuerpo.append(caja);
      const figura = new Figura(lienzo, {
        claveDeSincronizacion: `graficos-${pestana}`,
        alto,
        alMoverCursor: (punto) => {
          if (aplicandoCursor) return;
          const nodo = punto === null ? null : d.nodos?.[punto] ?? null;
          if (estado.get().nodo !== nodo) estado.set({ nodo });
        },
        alElegirPunto: (punto) => {
          const nodo = d.nodos?.[punto];
          if (nodo !== undefined) estado.set({ nodo });
        },
        alCambiarRango: (desde, hasta, completo) => mostrarRango(rango, d, desde, hasta, completo),
      });
      figura.mostrar(d);
      figuras.push(figura);
    });
  };

  async function exportarPng(datos: DatosDeFigura, indice: number): Promise<void> {
    const { fuente, pestana } = nombreBase();
    try {
      const png = await figuraAPng(datos);
      descargarArchivo(`${fuente}-${nombreDeFigura(pestana, datos, indice)}`, png);
    } catch (error) {
      estado.set({ error: `Exportar la figura: ${(error as Error).message}` });
    }
  }

  function exportarCsv(datos: DatosDeFigura, indice: number): void {
    const { fuente, pestana } = nombreBase();
    const nombre = `${fuente}-${pestana}-${datos.clave ?? indice + 1}.csv`;
    descargarArchivo(nombre, new Blob([csvDeFigura(datos)], { type: 'text/csv;charset=utf-8' }));
  }

  /** Estadistica del rango visible; con el rango completo no se muestra nada. */
  function mostrarRango(contenedorDeRango: HTMLElement, datos: DatosDeFigura, desde: number, hasta: number, completo: boolean): void {
    if (completo) {
      contenedorDeRango.hidden = true;
      vaciar(contenedorDeRango);
      return;
    }
    const numeroX = (v: number | null) => (v === null ? '—' : formatearNumero(v, datos.decimalesX));
    const numeroY = (v: number | null) => (v === null ? '—' : formatearNumero(v, datos.decimales, datos.notacion));
    const filas = estadisticaDeRango(datos, desde, hasta).map((e) =>
      el(
        'tr',
        {},
        el('th', { scope: 'row' }, e.etiqueta),
        el('td', {}, numeroY(e.maximo)),
        el('td', { class: 'figura-rango-donde' }, numeroX(e.xDelMaximo)),
        el('td', {}, numeroY(e.minimo)),
        el('td', {}, numeroY(e.promedio)),
      ),
    );
    vaciar(contenedorDeRango);
    contenedorDeRango.append(
      el('p', { class: 'ayuda' }, `Rango elegido: ${numeroX(desde)} a ${numeroX(hasta)} — doble clic vuelve a la vista completa.`),
      el(
        'table',
        { class: 'tabla figura-rango-tabla' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Serie'), el('th', {}, 'Máx'), el('th', {}, 'en'), el('th', {}, 'Mín'), el('th', {}, 'Promedio'))),
        el('tbody', {}, filas),
      ),
    );
    contenedorDeRango.hidden = false;
  }

  dibujarBarra();
  dibujarFiguras();
  const cancelar = estado.suscribir((nuevo, anterior) => {
    if (nuevo.pestana !== anterior.pestana || nuevo.ejeX !== anterior.ejeX) dibujarBarra();
    if (
      nuevo.layout !== anterior.layout ||
      nuevo.elemento !== anterior.elemento ||
      nuevo.pestana !== anterior.pestana ||
      nuevo.ejeX !== anterior.ejeX ||
      nuevo.vista !== anterior.vista
    ) {
      dibujarFiguras();
      return;
    }
    // Cursor movido desde afuera (el reproductor, otro panel): se refleja aca.
    if (nuevo.nodo !== anterior.nodo) {
      aplicandoCursor = true;
      figuras.forEach((f, i) => {
        const punto = nuevo.nodo === null ? null : puntoDeNodo(datosDeFiguras[i], nuevo.nodo);
        f.ponerCursorEn(punto);
      });
      aplicandoCursor = false;
    }
  });
  return () => {
    document.removeEventListener('keydown', alTeclear);
    cancelar();
    for (const f of figuras) f.destruirDelTodo();
    figuras = [];
  };
}

/** Indice del punto de una figura que corresponde a un nodo global. */
function puntoDeNodo(datos: DatosDeFigura | undefined, nodo: number): number | null {
  return datos?.nodos ? indiceDeNodo(datos.nodos, nodo) : null;
}
