// Controles de reproduccion sobre la vista 3D: play/pausa, barra de tiempo,
// velocidad de reproduccion, seguir al carro (mueve el centro de la orbita,
// la camara sigue afuera) y un HUD con el instante, el elemento, la
// velocidad y la G. El estado de la animacion vive aca, no en el store:
// cambia en cada cuadro y no le interesa a ningun otro panel.

import type { Carro } from '../escena/carro';
import type { Escena } from '../escena/escena';
import type { Estado } from '../estado';
import { el } from './dom';
import { numeroDeMagnitud, SIN_DATO } from './formato';

const VELOCIDADES = [0.1, 0.25, 0.5, 1, 2];

export function montarReproductor(contenedor: HTMLElement, estado: Estado, escena: Escena, carro: Carro): void {
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

  function alternar(): void {
    if (carro.duracion <= 0) return;
    if (!reproduciendo && tiempo >= carro.duracion) tiempo = 0;
    reproduciendo = !reproduciendo;
    botonPlay.textContent = reproduciendo ? '❚❚' : '▶';
  }

  function actualizar(dt: number, forzar = false): void {
    if (carro.duracion <= 0) return;
    if (!reproduciendo && !forzar) return;
    if (reproduciendo) {
      tiempo += dt * factor;
      if (tiempo >= carro.duracion) {
        tiempo = carro.duracion;
        reproduciendo = false;
        botonPlay.textContent = '▶';
      }
      barra.value = String(tiempo);
    }
    const donde = carro.ubicar(tiempo);
    if (!donde) return;
    const { layout } = estado.get();
    const tipo = layout?.elementos[donde.elemento]?.tipo ?? '';
    hudTiempo.textContent = numeroDeMagnitud(tiempo, 'tiempo');
    const nombre = `${donde.elemento + 1}. ${tipo}`;
    hudElemento.textContent = nombre;
    hudElemento.title = nombre;
    hudVelocidad.textContent = numeroDeMagnitud(donde.velocidad, 'velocidad');
    hudGz.textContent = numeroDeMagnitud(donde.gz, 'gz');
    hudGy.textContent = numeroDeMagnitud(donde.gy, 'gy');
    if (seguir) escena.centrarEn(donde.posicion);
  }

  escena.enCadaCuadro((dt) => actualizar(dt));

  document.addEventListener('keydown', (evento) => {
    if (evento.code !== 'Space' || evento.target instanceof HTMLInputElement || evento.target instanceof HTMLSelectElement) return;
    evento.preventDefault();
    alternar();
  });

  const reiniciar = () => {
    const { layout } = estado.get();
    reproduciendo = false;
    botonPlay.textContent = '▶';
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
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.layout !== anterior.layout) reiniciar();
  });
}
