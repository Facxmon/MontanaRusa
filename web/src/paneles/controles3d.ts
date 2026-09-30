// Controles flotantes de la vista 3D, arriba a la derecha (arriba a la
// izquierda esta el gizmo de ejes y abajo el reproductor):
//
//  - Reiniciar vista: vuelve la camara (zoom y posicion) al encuadre inicial
//    de la via entera, el mismo que se hace al cargar un layout.
//  - Caja: muestra u oculta la caja disponible (BoundingBoxDisponible). Su
//    tamano no se toca, solo si se dibuja.
//  - Proyección XY: la huella del riel sobre el piso. Apagada por defecto.
//  - Límites: puntos rojos donde la via cambia de elemento.
//
// Las tres casillas son preferencias de la vista, no del diseno: se
// recuerdan en localStorage (almacen.ts) y no pasan por el estado.

import { escribirAlmacen, leerAlmacen } from './almacen';
import { el } from './dom';

export interface AccionesDe3d {
  reiniciarVista(): void;
  mostrarCaja(visible: boolean): void;
  mostrarProyeccion(visible: boolean): void;
  mostrarLimites(visible: boolean): void;
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
  contenedor.append(reiniciar, ...casillas);
}
