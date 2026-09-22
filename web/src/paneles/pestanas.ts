// Una barra de pestanas (role="tablist"): los botones se crean una sola vez
// y lo que cambia es cual esta activa. Asi el subrayado puede DESLIZARSE de
// una opcion a la otra (un solo elemento que se mueve con transform, en vez
// de un borde que aparece y desaparece) y el foco del teclado no se pierde
// al elegir. La usan el selector de vista, el del panel lateral y las
// pestanas de los graficos.

import { el } from './dom';

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
): Pestanas<T> {
  contenedor.classList.add('pestanas');
  contenedor.setAttribute('role', 'tablist');
  const indicador = el('span', { class: 'pestanas-indicador', 'aria-hidden': 'true' });
  const botones = opciones.map((o) =>
    el('button', { type: 'button', role: 'tab', class: 'pestana', 'data-clave': o.clave, onClick: () => alElegir(o.clave) }, o.etiqueta),
  );
  contenedor.replaceChildren(...botones, indicador);

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
