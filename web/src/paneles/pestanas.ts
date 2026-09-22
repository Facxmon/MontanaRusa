// Una barra de pestanas (role="tablist"): los botones se crean una sola vez
// y lo que cambia es cual esta activa. Asi el subrayado puede DESLIZARSE de
// una opcion a la otra (un solo elemento que se mueve con transform, en vez
// de un borde que aparece y desaparece) y el foco del teclado no se pierde
// al elegir. La usan el selector de vista, el del panel lateral y las
// pestanas de los graficos.
//
// Accesibilidad (fase 4.9), el patron "tabs" de WAI-ARIA: cada pestana
// tiene aria-selected y aria-controls hacia su panel (role="tabpanel",
// aria-labelledby de vuelta); solo la activa entra en el orden de Tab
// (tabindex rotativo) y las flechas, Inicio y Fin se mueven entre pestanas
// y las activan.

import { el, idUnico } from './dom';

export interface OpcionDePestana<T extends string> {
  clave: T;
  etiqueta: string;
}

export interface Pestanas<T extends string> {
  /** Marca la activa (sin avisar a alElegir). */
  activar(clave: T): void;
}

export function montarPestanas<T extends string>(
  contenedor: HTMLElement,
  opciones: readonly OpcionDePestana<T>[],
  activa: T,
  alElegir: (clave: T) => void,
  /** Que paneles controla cada pestana (la vista "Ambos" controla dos). */
  paneles: Partial<Record<T, HTMLElement[]>> = {},
): Pestanas<T> {
  contenedor.classList.add('pestanas');
  contenedor.setAttribute('role', 'tablist');
  const indicador = el('span', { class: 'pestanas-indicador', 'aria-hidden': 'true' });
  const botones = opciones.map((o) => {
    const boton = el('button', { type: 'button', role: 'tab', class: 'pestana', id: idUnico('pestana'), 'data-clave': o.clave, onClick: () => alElegir(o.clave) }, o.etiqueta);
    const controlados = paneles[o.clave] ?? [];
    for (const panel of controlados) {
      if (!panel.id) panel.id = idUnico('panel');
      panel.setAttribute('role', 'tabpanel');
    }
    if (controlados.length > 0) boton.setAttribute('aria-controls', controlados.map((p) => p.id).join(' '));
    return boton;
  });
  contenedor.replaceChildren(...botones, indicador);
  // Un panel lo nombra la pestana que lo controla sola (la de "Ambos" no).
  opciones.forEach((o, i) => {
    const controlados = paneles[o.clave] ?? [];
    if (controlados.length === 1) controlados[0]!.setAttribute('aria-labelledby', botones[i]!.id);
  });

  contenedor.addEventListener('keydown', (evento) => {
    const actualIndice = opciones.findIndex((o) => o.clave === actual);
    const destino =
      evento.key === 'ArrowRight' ? (actualIndice + 1) % opciones.length
      : evento.key === 'ArrowLeft' ? (actualIndice - 1 + opciones.length) % opciones.length
      : evento.key === 'Home' ? 0
      : evento.key === 'End' ? opciones.length - 1
      : null;
    if (destino === null) return;
    evento.preventDefault();
    alElegir(opciones[destino]!.clave);
    botones[destino]!.focus();
  });

  let actual = activa;
  const ubicarIndicador = () => {
    const boton = botones[opciones.findIndex((o) => o.clave === actual)];
    if (!boton || boton.offsetWidth === 0) return;
    indicador.style.width = `${boton.offsetWidth}px`;
    indicador.style.transform = `translateX(${boton.offsetLeft}px)`;
  };
  const activar = (clave: T) => {
    actual = clave;
    botones.forEach((b, i) => {
      const es = opciones[i]!.clave === clave;
      b.classList.toggle('activa', es);
      b.setAttribute('aria-selected', es ? 'true' : 'false');
      b.tabIndex = es ? 0 : -1;
    });
    ubicarIndicador();
  };
  activar(activa);
  // La fuente o el ancho del contenedor pueden cambiar despues de montar
  // (Plex carga tarde, el panel se muestra): se vuelve a ubicar sin animar.
  const observador = new ResizeObserver(() => {
    indicador.classList.add('sin-transicion');
    ubicarIndicador();
    requestAnimationFrame(() => indicador.classList.remove('sin-transicion'));
  });
  observador.observe(contenedor);
  return { activar };
}
