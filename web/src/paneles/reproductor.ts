// Controles de reproduccion sobre la vista 3D: play/pausa, barra de tiempo,
// velocidad de reproduccion, seguir al carro (mueve el centro de la orbita,
// la camara sigue afuera) y un HUD con el instante, el elemento, la
// velocidad y la G. El estado de la animacion vive aca, no en el store:
// cambia en cada cuadro y no le interesa a ningun otro panel. Lo unico que
// se publica es si esta corriendo (estado.reproduciendo), para que los
// paneles de numeros se refresquen a ~8 Hz mientras tanto (refresco.ts).

import type { Carro } from '../escena/carro';
import type { Escena } from '../escena/escena';
import type { Estado } from '../estado';
import { nodoGlobalDe, ubicacionDeNodo } from '../graficos/series';
import { el } from './dom';
import { numeroDeMagnitud, SIN_DATO } from './formato';
import { LimitadorDeRefresco } from './refresco';

const VELOCIDADES = [0.1, 0.25, 0.5, 1, 2];

export interface Reproductor {
  /** Suelta el listener de teclado de document y el callback por cuadro. */
  destruir(): void;
  /** Lleva el carro al instante en que pasa por ese nodo global (clic en un grafico). */
  irANodo(nodo: number): void;
}

/**
 * El reproductor es el otro extremo del cursor ligado (fase 3.6): mientras
 * corre publica en estado.nodo el nodo global por el que va pasando, que es
 * lo que mueve el cursor de los graficos y el marcador del 3D; y irANodo()
 * hace el camino inverso cuando se hace clic en un punto de un grafico.
 */
export function montarReproductor(contenedor: HTMLElement, estado: Estado, escena: Escena, carro: Carro): Reproductor {
  let reproduciendo = false;
  let tiempo = 0;
  let factor = 0.5;
  let seguir = false;
  let mostrarCarro = true;

  const botonPlay = el('button', { type: 'button', class: 'boton chico', title: 'Reproducir / pausar (barra espaciadora)', onClick: () => alternar() }, '▶');
  const barra = el('input', { type: 'range', min: '0', max: '1', step: '0.001', value: '0', class: 'reproductor-barra' });
  barra.addEventListener('input', () => {
    tiempo = Number(barra.value);
    actualizar(0, true);
  });
  const selectorDeVelocidad = el('select', { class: 'reproductor-velocidad', title: 'Velocidad de reproducción' });
  for (const v of VELOCIDADES) {
    const o = el('option', { value: String(v) }, `${v}×`);
    if (v === factor) o.selected = true;
    selectorDeVelocidad.append(o);
  }
  selectorDeVelocidad.addEventListener('change', () => {
    factor = Number(selectorDeVelocidad.value);
  });
  const casillaSeguir = el('input', { type: 'checkbox' });
  casillaSeguir.addEventListener('change', () => {
    seguir = casillaSeguir.checked;
  });
  const casillaCarro = el('input', { type: 'checkbox' });
  casillaCarro.checked = true;
  casillaCarro.addEventListener('change', () => {
    mostrarCarro = casillaCarro.checked;
    carro.mostrar(mostrarCarro);
  });
  // HUD: un span por campo dentro de una grilla de columnas fijas, para que un
  // valor que cambia de ancho no mueva lo que tiene a la derecha. Los numeros
  // van con decimales fijos (formato.ts) y cifras tabulares (CSS).
  const hudTiempo = el('span', { class: 'hud-valor' }, SIN_DATO);
  const hudElemento = el('span', { class: 'hud-elemento' });
  const hudVelocidad = el('span', { class: 'hud-valor' }, SIN_DATO);
  const hudGz = el('span', { class: 'hud-valor' }, SIN_DATO);
  const hudGy = el('span', { class: 'hud-valor' }, SIN_DATO);
  const hud = el(
    'span',
    { class: 'reproductor-hud' },
    el('span', {}, 't ='),
    hudTiempo,
    el('span', {}, 's ·'),
    hudElemento,
    el('span', {}, '· v ='),
    hudVelocidad,
    el('span', {}, 'm/s · Gz ='),
    hudGz,
    el('span', {}, 'G · Gy ='),
    hudGy,
    el('span', {}, 'G'),
  );

  contenedor.append(
    botonPlay,
    barra,
    selectorDeVelocidad,
    el('label', { class: 'reproductor-opcion' }, casillaSeguir, ' seguir'),
    el('label', { class: 'reproductor-opcion' }, casillaCarro, ' carro'),
    hud,
  );

  // Mientras corre, los numeros del HUD se reescriben a ~8 Hz (refresco.ts);
  // el carro se mueve en cada cuadro. Pausado, cada actualizacion escribe
  // el valor exacto del instante.
  const limitador = new LimitadorDeRefresco();

  /** Cambia entre reproduciendo y pausado, y lo publica (los paneles de numeros lo leen). */
  function ponerReproduciendo(valor: boolean): void {
    reproduciendo = valor;
    botonPlay.textContent = valor ? '❚❚' : '▶';
    if (valor) limitador.reiniciar();
    if (estado.get().reproduciendo !== valor) estado.set({ reproduciendo: valor });
  }

  function alternar(): void {
    if (carro.duracion <= 0) return;
    if (!reproduciendo && tiempo >= carro.duracion) tiempo = 0;
    ponerReproduciendo(!reproduciendo);
    // Al pausar: los valores del instante exacto, no los del ultimo refresco.
    if (!reproduciendo) actualizar(0, true);
  }

  function actualizar(dt: number, forzar = false): void {
    if (carro.duracion <= 0) return;
    if (!reproduciendo && !forzar) return;
    if (reproduciendo) {
      tiempo += dt * factor;
      if (tiempo >= carro.duracion) {
        tiempo = carro.duracion;
        ponerReproduciendo(false);
      }
      barra.value = String(tiempo);
    }
    const donde = carro.ubicar(tiempo);
    if (!donde) return;
    const { layout } = estado.get();
    if (!reproduciendo || forzar || limitador.toca(performance.now())) {
      const tipo = layout?.elementos[donde.elemento]?.tipo ?? '';
      hudTiempo.textContent = numeroDeMagnitud(tiempo, 'tiempo');
      const nombre = `${donde.elemento + 1}. ${tipo}`;
      hudElemento.textContent = nombre;
      hudElemento.title = nombre;
      hudVelocidad.textContent = numeroDeMagnitud(donde.velocidad, 'velocidad');
      hudGz.textContent = numeroDeMagnitud(donde.gz, 'gz');
      hudGy.textContent = numeroDeMagnitud(donde.gy, 'gy');
    }
    if (seguir) escena.centrarEn(donde.posicion);
    // Cursor ligado: el nodo por el que va el carro es el que resalta el 3D y
    // el que marcan los graficos. Se publica solo cuando cambia de nodo.
    if (layout) {
      const nodo = nodoGlobalDe(layout, donde.elemento, donde.nodo);
      if (estado.get().nodo !== nodo) estado.set({ nodo });
    }
  }

  const sacarDelCuadro = escena.enCadaCuadro((dt) => actualizar(dt));

  // La barra espaciadora se escucha en document (el foco puede estar en
  // cualquier lado); se guarda la referencia para poder sacarlo al destruir.
  const alTeclear = (evento: KeyboardEvent) => {
    if (evento.code !== 'Space') return;
    // Con el foco en un control, la barra espaciadora es de ese control
    // (activar un boton, una pestana, abrir un <details>, tildar): play/pausa
    // solo cuando el foco no esta en nada interactivo (fase 4.9).
    const objetivo = evento.target as HTMLElement | null;
    if (objetivo?.closest?.('input, select, textarea, button, a[href], summary, [role="tab"], [role="radio"], [contenteditable="true"], dialog')) return;
    evento.preventDefault();
    alternar();
  };
  document.addEventListener('keydown', alTeclear);

  const reiniciar = () => {
    const { layout } = estado.get();
    ponerReproduciendo(false);
    tiempo = 0;
    if (layout) {
      carro.construir(layout);
      carro.mostrar(mostrarCarro);
    }
    barra.max = String(Math.max(carro.duracion, 0.001));
    barra.value = '0';
    contenedor.hidden = !layout || carro.duracion <= 0;
    actualizar(0, true);
  };
  reiniciar();
  const cancelar = estado.suscribir((nuevo, anterior) => {
    if (nuevo.layout !== anterior.layout) reiniciar();
  });
  return {
    destruir() {
      document.removeEventListener('keydown', alTeclear);
      sacarDelCuadro();
      cancelar();
    },
    irANodo(nodo: number) {
      const { layout } = estado.get();
      if (!layout) return;
      const ubicacion = ubicacionDeNodo(layout, nodo);
      if (!ubicacion) return;
      const instante = carro.tiempoDelNodo(ubicacion.elemento, ubicacion.nodoLocal);
      if (instante === null) return;
      ponerReproduciendo(false);
      tiempo = instante;
      barra.value = String(tiempo);
      actualizar(0, true);
    },
  };
}
