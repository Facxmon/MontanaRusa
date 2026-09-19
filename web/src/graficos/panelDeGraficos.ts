// El area de graficos: barra de pestanas (G, jerk, cinematica, roll,
// curvatura), selector del eje horizontal y las figuras de la pestana
// activa, una debajo de la otra con el cursor sincronizado.

import type { Estado } from '../estado';
import { el, vaciar } from '../paneles/dom';
import { Figura } from './figura';
import { ETIQUETA_DE_EJE, PESTANAS, extraerColumnas, figurasDePestana, type EjeX, type Pestana } from './series';

export function montarPanelDeGraficos(contenedor: HTMLElement, estado: Estado): void {
  const barra = el('div', { class: 'graficos-barra' });
  const cuerpo = el('div', { class: 'graficos-cuerpo' });
  contenedor.append(barra, cuerpo);
  let figuras: Figura[] = [];

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
      { id: 'ejeX', onChange: (evento: Event) => estado.set({ ejeX: (evento.target as HTMLSelectElement).value as EjeX }) },
      (Object.keys(ETIQUETA_DE_EJE) as EjeX[]).map((clave) => {
        const opcion = el('option', { value: clave }, ETIQUETA_DE_EJE[clave]);
        if (clave === ejeX) opcion.selected = true;
        return opcion;
      }),
    );
    barra.append(pestanas, el('label', { class: 'graficos-eje' }, 'Eje horizontal ', selector));
  };

  const dibujarFiguras = () => {
    const { layout, elemento, pestana, ejeX, vista } = estado.get();
    for (const f of figuras) f.destruir();
    figuras = [];
    vaciar(cuerpo);
    if (vista !== 'graficos' || !layout) return;
    const columnas = extraerColumnas(layout, elemento);
    const datos = figurasDePestana(pestana as Pestana, columnas, ejeX);
    cuerpo.append(
      el(
        'p',
        { class: 'ayuda graficos-ayuda' },
        elemento === null
          ? 'Todo el layout: las franjas son los elementos. Elegir un elemento en el panel para ver sus subtramos.'
          : `Elemento ${elemento + 1}: ${layout.elementos[elemento]?.tipo ?? ''}. Las franjas son los subtramos.`,
      ),
    );
    for (const d of datos) {
      const caja = el('div', { class: 'figura' });
      cuerpo.append(caja);
      const figura = new Figura(caja, `graficos-${pestana}`);
      figura.mostrar(d);
      figuras.push(figura);
    }
  };

  dibujarBarra();
  dibujarFiguras();
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.pestana !== anterior.pestana || nuevo.ejeX !== anterior.ejeX) dibujarBarra();
    if (
      nuevo.layout !== anterior.layout ||
      nuevo.elemento !== anterior.elemento ||
      nuevo.pestana !== anterior.pestana ||
      nuevo.ejeX !== anterior.ejeX ||
      nuevo.vista !== anterior.vista
    ) {
      dibujarFiguras();
    }
  });
}
