// Carga de un layout del contrato: fetch, parse y rechazo de un MAJOR distinto.
// No valida la estructura entera (eso lo hace esquema/validar-layout.js sobre
// los golden files antes de commitearlos): solo lo que hace falta para no
// dibujar basura con un mensaje incomprensible.

import type { Layout } from './tipos';

/** MAJOR de versionContrato que esta pagina entiende (CONTRATO_VISUALIZADOR.md, seccion 3). */
export const MAJOR_SOPORTADO = 1;

export function analizarLayout(texto: string): Layout {
  let documento: unknown;
  try {
    documento = JSON.parse(texto);
  } catch (error) {
    throw new Error(`El archivo no es JSON válido: ${(error as Error).message}`);
  }
  if (typeof documento !== 'object' || documento === null) {
    throw new Error('El archivo no es un objeto JSON.');
  }
  const meta = (documento as { meta?: { versionContrato?: unknown } }).meta;
  const version = meta?.versionContrato;
  if (typeof version !== 'string') {
    throw new Error('El archivo no trae meta.versionContrato: no es un layout del contrato.');
  }
  const major = Number(version.split('.')[0]);
  if (major !== MAJOR_SOPORTADO) {
    throw new Error(
      `El layout es de la versión ${version} del contrato y esta página entiende la ${MAJOR_SOPORTADO}.x.x.`,
    );
  }
  const minor = Number(version.split('.')[1]);
  if (minor < 2) migrarModoClotoide(documento as Layout);
  return documento as Layout;
}

/**
 * Antes de la 1.2.0 del contrato el modo 'Clotoide' era el arco de radio
 * constante, que ahora se llama 'ArcoCircular' ('Clotoide' es la clotoide
 * simetrica de verdad). Un layout viejo se lee con el nombre nuevo.
 */
function migrarModoClotoide(layout: Layout): void {
  const renombrar = (valor: unknown) => (valor === 'Clotoide' ? 'ArcoCircular' : valor);
  const p = layout.parametros as unknown as {
    valores?: Record<string, unknown>; defaults?: Record<string, unknown>; esquema?: { modo?: { nombre?: unknown; opciones?: unknown[] } };
  };
  if (p.valores) p.valores.modoCurvatura = renombrar(p.valores.modoCurvatura);
  if (p.defaults) p.defaults.modoCurvatura = renombrar(p.defaults.modoCurvatura);
  if (p.esquema?.modo) {
    p.esquema.modo.nombre = renombrar(p.esquema.modo.nombre);
    if (Array.isArray(p.esquema.modo.opciones)) p.esquema.modo.opciones = p.esquema.modo.opciones.map(renombrar);
  }
  for (const e of layout.elementos) {
    const ajustes = (e as unknown as { ajustes?: Record<string, unknown> }).ajustes;
    if (ajustes && 'modoCurvatura' in ajustes) ajustes.modoCurvatura = renombrar(ajustes.modoCurvatura);
  }
}

export async function cargarLayout(url: string): Promise<Layout> {
  const respuesta = await fetch(url);
  if (!respuesta.ok) {
    throw new Error(`No se pudo cargar ${url}: ${respuesta.status} ${respuesta.statusText}`);
  }
  return analizarLayout(await respuesta.text());
}

export interface Indice {
  casos: string[];
}

export async function cargarIndice(url: string): Promise<Indice> {
  const respuesta = await fetch(url);
  if (!respuesta.ok) {
    throw new Error(`No se pudo cargar el índice de casos ${url}: ${respuesta.status} ${respuesta.statusText}`);
  }
  const indice = (await respuesta.json()) as Partial<Indice>;
  if (!Array.isArray(indice.casos)) {
    throw new Error(`El índice de casos ${url} no tiene la clave "casos".`);
  }
  return { casos: indice.casos };
}
