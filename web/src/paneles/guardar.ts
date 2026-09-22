// Guardar, en la barra (zona izquierda): tres salidas construidas sobre
// serializarDiseno (fase 1).
//  1. Solo parametros (.json, ~2 kB): boton propio y visible; es lo que se
//     versiona en git y se comparte.
//  2. Paquete completo (.zip, con fflate): layout.json, parametros.json,
//     graficos/<pestana>-<figura>.png (las cinco pestanas, PNG a 2x),
//     vista-3d.png, series.csv y LEEME.txt.
//  3. Copiar link: el diseno en el hash de la URL (#d=<aTextoCompacto>);
//     al cargar la pagina con hash se abre ese diseno (visualizador.ts).
// El menu "Guardar" agrupa las tres; el .json ademas tiene su boton.
//
// Con un golden en pantalla (sin diseno abierto) el diseno se deriva del
// layout con disenoDesdeLayout: guardar y compartir funcionan igual.

import { strToU8, zipSync, type Zippable } from 'fflate';
import { disenoDesdeLayout } from '../contrato/disenoDesdeLayout';
import type { Layout } from '../contrato/tipos';
import type { Escena } from '../escena/escena';
import type { Estado } from '../estado';
import { figuraAPng, nombreDeFigura } from '../graficos/exportarFigura';
import { extraerColumnas, figurasDePestana, PESTANAS } from '../graficos/series';
import type { EntradaDeDiseno } from '../nucleo/calcular';
import { csvDeSeries, textoDeParametros, textoDelLayout, textoLeeme } from '../nucleo/descargar';
import { aTextoCompacto, serializarDiseno } from '../nucleo/serializar';
import type { Aviso } from './aviso';
import { botonDeBarra, icono } from './barra';
import { el } from './dom';

export interface DependenciasDeGuardar {
  escena: Escena;
  aviso: Aviso;
}

/** Nombre apto para archivo: minusculas, sin acentos ni simbolos. */
export function slug(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'diseno';
}

function marcaDeTiempo(fecha: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}${dos(fecha.getMonth() + 1)}${dos(fecha.getDate())}-${dos(fecha.getHours())}${dos(fecha.getMinutes())}`;
}

export function descargarArchivo(nombre: string, contenido: Blob): void {
  const url = URL.createObjectURL(contenido);
  const enlace = el('a', { href: url, download: nombre });
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  // El navegador ya tomo el blob; se libera despues de que arranque la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** El diseno a guardar: el abierto, o el derivado del layout en pantalla. */
function disenoParaGuardar(estado: Estado): { diseno: EntradaDeDiseno; layout: Layout | null } | null {
  const { diseno, layout } = estado.get();
  if (diseno) return { diseno, layout };
  if (layout) return { diseno: disenoDesdeLayout(layout), layout };
  return null;
}

/** URL para compartir: la pagina actual sin query ni hash, con el diseno comprimido en el hash. */
export function urlDelDiseno(diseno: EntradaDeDiseno): string {
  const base = location.href.split('#')[0]!.split('?')[0]!;
  return `${base}#d=${aTextoCompacto(serializarDiseno(diseno))}`;
}

async function bytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/** Arma el .zip completo; las PNG ya vienen comprimidas y van sin recomprimir. */
export async function armarPaquete(estado: Estado, escena: Escena, fecha = new Date()): Promise<Uint8Array> {
  const entrada = disenoParaGuardar(estado);
  if (!entrada || !entrada.layout) throw new Error('No hay un layout en pantalla para empaquetar.');
  const { diseno, layout } = entrada;
  const { origen, caso, ejeX } = estado.get();
  const archivos: Zippable = {};
  archivos['layout.json'] = strToU8(textoDelLayout(layout));
  archivos['parametros.json'] = strToU8(textoDeParametros(diseno));
  archivos['series.csv'] = strToU8(csvDeSeries(layout));
  const columnas = extraerColumnas(layout, null);
  for (const pestana of PESTANAS) {
    const figuras = figurasDePestana(pestana.clave, columnas, ejeX);
    for (const [i, datos] of figuras.entries()) {
      archivos[`graficos/${nombreDeFigura(pestana.clave, datos, i)}`] = [await bytes(await figuraAPng(datos)), { level: 0 }];
    }
  }
  archivos['vista-3d.png'] = [await bytes(await escena.capturar()), { level: 0 }];
  archivos['LEEME.txt'] = strToU8(textoLeeme({ layout, origen: origen ?? caso, fecha, archivos: Object.keys(archivos) }));
  return zipSync(archivos, { level: 6 });
}

/** Devuelve la funcion que saca el listener de document que cierra el menu. */
export function montarGuardar(contenedor: HTMLElement, estado: Estado, { escena, aviso }: DependenciasDeGuardar): () => void {
  const nombreBase = () => slug(estado.get().origen ?? estado.get().caso ?? 'diseno');

  const guardarParametros = () => {
    const entrada = disenoParaGuardar(estado);
    if (!entrada) return;
    descargarArchivo(`parametros-${nombreBase()}.json`, new Blob([textoDeParametros(entrada.diseno)], { type: 'application/json' }));
  };

  let armando = false;
  const guardarPaquete = async () => {
    if (armando) return;
    armando = true;
    botonPaquete.disabled = true;
    aviso.mostrar('Armando el paquete: figuras y vista 3D…', undefined, 0);
    try {
      const fecha = new Date();
      const zip = await armarPaquete(estado, escena, fecha);
      descargarArchivo(`montanarusa-${nombreBase()}-${marcaDeTiempo(fecha)}.zip`, new Blob([zip as BlobPart], { type: 'application/zip' }));
      aviso.mostrar(`Paquete descargado (${(zip.length / 1024).toFixed(0)} kB).`);
    } catch (error) {
      estado.set({ error: `Paquete: ${(error as Error).message}` });
      aviso.ocultar();
    } finally {
      armando = false;
      botonPaquete.disabled = false;
    }
  };

  const copiarLink = async () => {
    const entrada = disenoParaGuardar(estado);
    if (!entrada) return;
    const url = urlDelDiseno(entrada.diseno);
    try {
      await navigator.clipboard.writeText(url);
      aviso.mostrar(`Link copiado (${url.length} caracteres): abre este diseño en cualquier navegador.`);
    } catch {
      // Sin permiso de portapapeles (o sin HTTPS): se muestra para copiar a mano.
      window.prompt('Copiá el link del diseño:', url);
    }
  };

  const botonJson = botonDeBarra({ icono: 'guardar', etiqueta: 'Guardar solo parámetros (.json)', texto: '.json', alHacer: guardarParametros });

  // Menu con las tres salidas: un <details> que se cierra al elegir.
  const menu = el('details', { class: 'menu-barra' });
  const resumen = el('summary', { class: 'boton-barra', title: 'Guardar: paquete .zip, solo parámetros .json o copiar link', 'aria-label': 'Menú guardar' },
    el('span', { class: 'boton-barra-texto' }, 'Guardar'), icono('menu'));
  const item = (nombre: 'paquete' | 'guardar' | 'link', texto: string, ayuda: string, alHacer: () => void) =>
    el('button', { type: 'button', class: 'menu-item', role: 'menuitem', onClick: () => { menu.open = false; alHacer(); } },
      icono(nombre), el('span', {}, el('span', { class: 'menu-item-texto' }, texto), el('span', { class: 'menu-item-ayuda' }, ayuda)));
  const botonPaquete = item('paquete', 'Descargar paquete .zip', 'layout, parámetros, gráficos PNG, vista 3D, CSV y LEEME', () => void guardarPaquete());
  menu.append(
    resumen,
    el('div', { class: 'menu-lista', role: 'menu' },
      botonPaquete,
      item('guardar', 'Solo parámetros .json', 'lo que se versiona y se comparte (~2 kB)', guardarParametros),
      item('link', 'Copiar link', 'el diseño en la URL, para abrirlo desde cualquier lado', () => void copiarLink()),
    ),
  );
  // Se cierra al hacer clic afuera o con Esc.
  const alClic = (e: MouseEvent) => {
    if (menu.open && !menu.contains(e.target as Node)) menu.open = false;
  };
  document.addEventListener('click', alClic);
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.open) {
      menu.open = false;
      resumen.focus();
    }
  });

  contenedor.append(botonJson, menu);

  const actualizar = () => {
    const hay = estado.get().layout !== null || estado.get().diseno !== null;
    botonJson.disabled = !hay;
    resumen.classList.toggle('deshabilitado', !hay);
  };
  actualizar();
  estado.suscribir((nuevo, anterior) => {
    if ((nuevo.layout === null) !== (anterior.layout === null) || (nuevo.diseno === null) !== (anterior.diseno === null)) actualizar();
  });
  return () => document.removeEventListener('click', alClic);
}
