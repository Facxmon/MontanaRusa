// Selector de tema de la barra: auto / claro / oscuro como un grupo de tres
// botones de radio con icono (sol, luna, mitad). La logica esta en
// preferenciaDeTema.ts; aca solo el control.

import { elegirPreferencia, leerPreferencia, seguirAlSistema, type PreferenciaDeTema } from '../preferenciaDeTema';
import { icono, type NombreDeIcono } from './barra';
import { el } from './dom';

const OPCIONES: { clave: PreferenciaDeTema; icono: NombreDeIcono; etiqueta: string }[] = [
  { clave: 'auto', icono: 'auto', etiqueta: 'Tema automático (el del sistema)' },
  { clave: 'claro', icono: 'sol', etiqueta: 'Tema claro (interfaz y gráficos; la vista 3D sigue oscura)' },
  { clave: 'oscuro', icono: 'luna', etiqueta: 'Tema oscuro' },
];

/** Monta el selector en el contenedor; devuelve como soltar el listener del sistema. */
export function montarSelectorDeTema(contenedor: HTMLElement): () => void {
  const grupo = el('div', { class: 'selector-de-tema', role: 'radiogroup', 'aria-label': 'Tema' });
  const botones = OPCIONES.map((o) =>
    el('button', {
      type: 'button',
      role: 'radio',
      class: 'boton-barra solo-icono boton-tema',
      'aria-label': o.etiqueta,
      title: o.etiqueta,
      onClick: () => elegir(o.clave),
    }, icono(o.icono)),
  );
  grupo.append(...botones);
  contenedor.append(grupo);

  const marcar = (actual: PreferenciaDeTema) => {
    botones.forEach((b, i) => {
      const es = OPCIONES[i]!.clave === actual;
      b.setAttribute('aria-checked', es ? 'true' : 'false');
      // Radio con flechas: solo la elegida entra en el orden de tabulacion.
      b.tabIndex = es ? 0 : -1;
    });
  };
  const elegir = (clave: PreferenciaDeTema) => {
    elegirPreferencia(clave);
    marcar(clave);
  };
  grupo.addEventListener('keydown', (evento) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(evento.key)) return;
    evento.preventDefault();
    const actual = OPCIONES.findIndex((o) => o.clave === leerPreferencia());
    const paso = evento.key === 'ArrowLeft' || evento.key === 'ArrowUp' ? -1 : 1;
    const siguiente = (actual + paso + OPCIONES.length) % OPCIONES.length;
    elegir(OPCIONES[siguiente]!.clave);
    botones[siguiente]!.focus();
  });
  marcar(leerPreferencia());
  return seguirAlSistema();
}
