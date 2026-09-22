// Hoja de atajos (fase 4.9): la tecla "?" (o el boton de la barra) abre un
// <dialog> modal con los atajos de las fases 2 y 3. El <dialog> nativo trae
// el foco atrapado, Esc para cerrar y la devolucion del foco a donde
// estaba; no hace falta nada mas. Desde aca tambien se vuelve a mostrar la
// bienvenida de la fase 4.7.

import { ponerTooltip } from './barra';
import { el } from './dom';

/** Los atajos, en el orden en que se muestran. Las teclas son las que se ven. */
export const ATAJOS: { teclas: string[][]; que: string }[] = [
  { teclas: [['Ctrl', 'Enter']], que: 'Generar: calcular el diseño con los cambios' },
  { teclas: [['Esc']], que: 'Detener el cálculo · cerrar una figura expandida o un menú' },
  { teclas: [['Ctrl', 'Z']], que: 'Deshacer el último cambio del diseño (con un campo a medio tipear, deshace el texto)' },
  { teclas: [['Ctrl', 'Shift', 'Z'], ['Ctrl', 'Y']], que: 'Rehacer' },
  { teclas: [['Espacio']], que: 'Reproducir / pausar el carro (con el foco fuera de un control)' },
  { teclas: [['←'], ['→'], ['Inicio'], ['Fin']], que: 'Moverse entre pestañas (vista, panel, gráficos) y entre opciones del tema' },
  { teclas: [['?']], que: 'Esta hoja' },
];

/** true si la tecla la esta escribiendo el usuario en un campo, y no es un atajo. */
function escribiendo(objetivo: EventTarget | null): boolean {
  const nodo = objetivo as HTMLElement | null;
  return !!nodo?.closest?.('input, textarea, select, [contenteditable="true"]');
}

export interface HojaDeAtajos {
  abrir(): void;
  destruir(): void;
}

export function montarHojaDeAtajos(raiz: HTMLElement, botonDestino: HTMLElement, mostrarBienvenida: () => void): HojaDeAtajos {
  const dialogo = el(
    'dialog',
    { class: 'hoja-atajos', 'aria-labelledby': 'hoja-atajos-titulo' },
    el(
      'div',
      { class: 'hoja-atajos-cabecera' },
      el('h2', { id: 'hoja-atajos-titulo' }, 'Atajos de teclado'),
      el('button', { type: 'button', class: 'boton chico', onClick: () => dialogo.close() }, 'Cerrar'),
    ),
    el(
      'dl',
      { class: 'hoja-atajos-lista' },
      ATAJOS.flatMap((a) => [
        el('dt', {}, a.teclas.map((combinacion, i) => el('span', {}, i > 0 ? ' o ' : '', ...combinacion.flatMap((t, j) => [j > 0 ? '+' : '', el('kbd', {}, t)])))),
        el('dd', {}, a.que),
      ]),
    ),
    el(
      'p',
      { class: 'ayuda' },
      'En Mac, Cmd en lugar de Ctrl. ',
      el('button', { type: 'button', class: 'boton chico', onClick: () => { mostrarBienvenida(); dialogo.close(); } }, 'Volver a ver la bienvenida'),
    ),
  );
  raiz.append(dialogo);
  // Clic en el fondo (fuera de la hoja) cierra.
  dialogo.addEventListener('click', (evento) => {
    if (evento.target === dialogo) dialogo.close();
  });

  const abrir = () => {
    if (!dialogo.open) dialogo.showModal();
  };
  botonDestino.addEventListener('click', abrir);
  ponerTooltip(botonDestino, 'Atajos de teclado', '?');

  const alTeclear = (evento: KeyboardEvent) => {
    if (evento.key !== '?' || evento.ctrlKey || evento.metaKey || evento.altKey || escribiendo(evento.target)) return;
    evento.preventDefault();
    abrir();
  };
  document.addEventListener('keydown', alTeclear);
  return {
    abrir,
    destruir() {
      document.removeEventListener('keydown', alTeclear);
      dialogo.remove();
    },
  };
}
