// Tema de la interfaz (fase 4.5): tres estados, persistidos en localStorage.
//
//   auto    sigue prefers-color-scheme del sistema, y lo sigue en vivo
//   claro   interfaz y graficos 2D claros (el viewport 3D queda oscuro)
//   oscuro  el default del proyecto, si nunca se eligio nada
//
// El atributo que manda es data-tema en <html>. Para que la pagina no
// parpadee en oscuro antes de aplicar la preferencia, index.html y
// visualizador.html traen un script en linea en el <head> que hace lo mismo
// que temaEfectivo() con la misma clave; si se cambia la clave o el
// default, hay que cambiarlo tambien ahi.
//
// Quien necesita reaccionar al cambio (los graficos de uPlot, que congelan
// los colores en sus opciones) se suscribe con alCambiarTema() de tema.ts,
// que observa este atributo.

import { escribirAlmacen, leerAlmacen } from './paneles/almacen';

export type PreferenciaDeTema = 'auto' | 'claro' | 'oscuro';
export type TemaEfectivo = 'claro' | 'oscuro';

/** Clave en el almacen (con prefijo: montanarusa.tema). */
export const CLAVE_DE_TEMA = 'tema';
export const PREFERENCIA_POR_DEFECTO: PreferenciaDeTema = 'oscuro';

export function esPreferencia(valor: unknown): valor is PreferenciaDeTema {
  return valor === 'auto' || valor === 'claro' || valor === 'oscuro';
}

/** El tema que se dibuja para una preferencia y lo que pide el sistema. */
export function temaEfectivo(preferencia: PreferenciaDeTema, sistemaPrefiereOscuro: boolean): TemaEfectivo {
  if (preferencia === 'auto') return sistemaPrefiereOscuro ? 'oscuro' : 'claro';
  return preferencia;
}

export function leerPreferencia(): PreferenciaDeTema {
  const guardada = leerAlmacen(CLAVE_DE_TEMA);
  return esPreferencia(guardada) ? guardada : PREFERENCIA_POR_DEFECTO;
}

const consultaOscuro = () => (typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null);

/** Pone data-tema segun la preferencia (sin guardarla). */
export function aplicarPreferencia(preferencia: PreferenciaDeTema): void {
  const tema = temaEfectivo(preferencia, consultaOscuro()?.matches ?? true);
  if (document.documentElement.dataset.tema !== tema) document.documentElement.dataset.tema = tema;
}

/** Guarda y aplica. */
export function elegirPreferencia(preferencia: PreferenciaDeTema): void {
  escribirAlmacen(CLAVE_DE_TEMA, preferencia);
  aplicarPreferencia(preferencia);
}

/**
 * Con la preferencia en auto, un cambio del tema del sistema cambia la
 * pagina en vivo. Devuelve como dejar de escuchar.
 */
export function seguirAlSistema(): () => void {
  const consulta = consultaOscuro();
  if (!consulta) return () => {};
  const alCambiar = () => {
    if (leerPreferencia() === 'auto') aplicarPreferencia('auto');
  };
  consulta.addEventListener('change', alCambiar);
  return () => consulta.removeEventListener('change', alCambiar);
}
