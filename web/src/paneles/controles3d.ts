// Controles flotantes de la vista 3D, arriba a la derecha (arriba a la
// izquierda esta el gizmo de ejes y abajo el reproductor):
//
//  - Reiniciar vista: des-selecciona el elemento y vuelve la camara (zoom y posicion) al encuadre inicial
//    de la via entera, el mismo que se hace al cargar un layout.
//  - Caja: muestra u oculta la caja disponible (BoundingBoxDisponible). Su
//    tamano no se toca, solo si se dibuja.
//  - Proyección XY: la huella del riel sobre el piso. Apagada por defecto.
//  - Límites: puntos rojos donde la via cambia de elemento.
//
//  - Carro: el diseño (Clásico, Aerodinámico, Vagoneta) y el color del tren.
//    Los colores ofrecidos salen de tokens.css (--carro-color-N); el ultimo
//    boton abre el selector de color del sistema.
//
// Las casillas, el diseño y el color son preferencias de la vista, no del
// diseno: se recuerdan en localStorage (almacen.ts) y no pasan por el estado.

import { DISENOS_DE_CARRO, esDisenoDeCarro } from '../escena/disenosDeCarro';
import type { AparienciaDelCarro } from '../escena/carro';
import { tema } from '../tema';
import { escribirAlmacen, leerAlmacen } from './almacen';
import { el } from './dom';

export interface AccionesDe3d {
  reiniciarVista(): void;
  mostrarCaja(visible: boolean): void;
  mostrarProyeccion(visible: boolean): void;
  mostrarLimites(visible: boolean): void;
  /** Diseño y color del tren. */
  cambiarApariencia(apariencia: AparienciaDelCarro): void;
}

/** Cada casilla: clave en localStorage, texto, ayuda y valor por defecto. */
const CASILLAS = [
  { clave: 'vista3d-caja', texto: 'Caja', ayuda: 'Mostrar la caja disponible (BoundingBoxDisponible)', porDefecto: true, accion: 'mostrarCaja' },
  { clave: 'vista3d-proyeccion', texto: 'Proyección XY', ayuda: 'Mostrar la proyección de la vía sobre el piso (plano XY)', porDefecto: false, accion: 'mostrarProyeccion' },
  { clave: 'vista3d-limites', texto: 'Límites', ayuda: 'Marcar en rojo los puntos donde la vía pasa de un elemento al siguiente', porDefecto: false, accion: 'mostrarLimites' },
] as const;

export function montarControles3d(contenedor: HTMLElement, acciones: AccionesDe3d): void {
  const reiniciar = el(
    'button',
    { type: 'button', class: 'boton chico', title: 'Volver la cámara al encuadre inicial de la vía', onClick: () => acciones.reiniciarVista() },
    '⟲ Reiniciar vista',
  );
  const casillas = CASILLAS.map((c) => {
    const guardado = leerAlmacen(c.clave);
    const activa = guardado === null ? c.porDefecto : guardado === '1';
    const casilla = el('input', { type: 'checkbox' });
    casilla.checked = activa;
    casilla.addEventListener('change', () => {
      escribirAlmacen(c.clave, casilla.checked ? '1' : '0');
      acciones[c.accion](casilla.checked);
    });
    acciones[c.accion](activa);
    return el('label', { class: 'controles-3d-opcion', title: c.ayuda }, casilla, ` ${c.texto}`);
  });
  contenedor.append(reiniciar, ...casillas, controlesDelCarro(acciones));
}

const CLAVE_DE_DISENO = 'vista3d-carro-diseno';
const CLAVE_DE_COLOR = 'vista3d-carro-color';

/** Colores ofrecidos para el carro, de los tokens. */
export function coloresDelCarro(): string[] {
  const t = tema();
  return [t.carroColor1, t.carroColor2, t.carroColor3, t.carroColor4, t.carroColor5, t.carroColor6];
}

/** La apariencia guardada, o la de siempre (diseño clásico, primer color). */
export function aparienciaGuardada(): AparienciaDelCarro {
  const diseno = leerAlmacen(CLAVE_DE_DISENO);
  const color = leerAlmacen(CLAVE_DE_COLOR);
  return {
    diseno: esDisenoDeCarro(diseno) ? diseno : DISENOS_DE_CARRO[0]!.clave,
    color: color && /^#[0-9a-f]{6}$/i.test(color) ? color : coloresDelCarro()[0]!,
  };
}

/** Selector de diseño, muestras de color y selector libre. Aplica la apariencia guardada al montar. */
function controlesDelCarro(acciones: AccionesDe3d): HTMLElement {
  let apariencia = aparienciaGuardada();
  const aplicar = () => {
    escribirAlmacen(CLAVE_DE_DISENO, apariencia.diseno);
    escribirAlmacen(CLAVE_DE_COLOR, apariencia.color);
    marcarMuestra();
    acciones.cambiarApariencia(apariencia);
  };
  const selector = el('select', { class: 'controles-3d-diseno', title: 'Diseño del carro', 'aria-label': 'Diseño del carro' },
    DISENOS_DE_CARRO.map((d) => {
      const opcion = el('option', { value: d.clave, title: d.descripcion }, d.nombre);
      if (d.clave === apariencia.diseno) opcion.selected = true;
      return opcion;
    }),
  );
  selector.addEventListener('change', () => {
    apariencia = { ...apariencia, diseno: selector.value as AparienciaDelCarro['diseno'] };
    aplicar();
  });
  const libre = el('input', { type: 'color', class: 'controles-3d-color-libre', title: 'Otro color', 'aria-label': 'Otro color para el carro' });
  libre.value = apariencia.color;
  libre.addEventListener('input', () => {
    apariencia = { ...apariencia, color: libre.value };
    aplicar();
  });
  const muestras = coloresDelCarro().map((color, i) => {
    const boton = el('button', {
      type: 'button',
      class: 'controles-3d-muestra',
      title: `Color ${i + 1}`,
      'aria-label': `Color ${i + 1} para el carro`,
      onClick: () => {
        apariencia = { ...apariencia, color: aHex(color) };
        libre.value = apariencia.color;
        aplicar();
      },
    });
    boton.style.background = color;
    return boton;
  });
  function marcarMuestra(): void {
    muestras.forEach((m, i) => m.setAttribute('aria-pressed', String(aHex(coloresDelCarro()[i]!) === apariencia.color.toLowerCase())));
  }
  marcarMuestra();
  acciones.cambiarApariencia(apariencia);
  return el('div', { class: 'controles-3d-carro' },
    el('label', { class: 'controles-3d-opcion' }, 'Carro ', selector),
    el('div', { class: 'controles-3d-colores', role: 'group', 'aria-label': 'Color del carro' }, ...muestras, libre),
  );
}

/** #rrggbb en minusculas a partir de lo que devuelve un token (hex o rgb()). */
function aHex(color: string): string {
  const texto = color.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(texto)) return texto;
  const m = /rgba?\(([^)]+)\)/.exec(texto);
  if (!m) return texto;
  const [r, g, b] = m[1]!.split(',').map((v) => Math.round(Number(v)));
  return '#' + [r, g, b].map((v) => (v ?? 0).toString(16).padStart(2, '0')).join('');
}
