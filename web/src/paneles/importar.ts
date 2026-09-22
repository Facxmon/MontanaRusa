// Importar, en la barra (zona izquierda): boton con un <input type="file">
// escondido, y arrastrar-y-soltar sobre toda la ventana, con un velo que
// avisa donde soltar. Lee un archivo de texto y se lo pasa a
// nucleo/importar.ts, que decide el formato y da el mensaje de error
// concreto; aca solo se agrega el nombre del archivo.

import type { Estado } from '../estado';
import { importarDiseno, type DisenoImportado } from '../nucleo/importar';
import { botonDeBarra } from './barra';
import { el } from './dom';

/** Que hacer con un diseno que entra de afuera (lo abre y lo calcula). */
export type AlImportar = (importado: DisenoImportado, nombre: string) => void;

const MAXIMO_BYTES = 64 * 1024 * 1024;

/** Devuelve la funcion que saca los listeners de arrastre de la ventana. */
export function montarImportar(contenedor: HTMLElement, raiz: HTMLElement, estado: Estado, alImportar: AlImportar): () => void {
  const entrada = el('input', { type: 'file', accept: '.json,application/json', hidden: true });
  const boton = botonDeBarra({
    icono: 'importar',
    etiqueta: 'Importar un diseño (.json) o un layout del contrato',
    texto: 'Importar',
    alHacer: () => entrada.click(),
  });
  contenedor.append(boton, entrada);

  async function leer(archivo: File): Promise<void> {
    if (archivo.size > MAXIMO_BYTES) {
      estado.set({ error: `${archivo.name} pesa ${(archivo.size / 1024 / 1024).toFixed(0)} MB: el límite para importar es ${MAXIMO_BYTES / 1024 / 1024} MB.` });
      return;
    }
    try {
      const texto = await archivo.text();
      const importado = importarDiseno(texto, archivo.name);
      estado.set({ error: null });
      alImportar(importado, archivo.name);
    } catch (error) {
      estado.set({ error: (error as Error).message });
    }
  }

  entrada.addEventListener('change', () => {
    const archivo = entrada.files?.[0];
    if (archivo) void leer(archivo);
    entrada.value = ''; // asi se puede volver a elegir el mismo archivo
  });

  // --- arrastrar y soltar sobre toda la ventana ---
  const velo = el('div', { class: 'velo-de-arrastre', hidden: true }, el('span', {}, 'Soltá el archivo para importarlo'));
  raiz.append(velo);
  // dragenter / dragleave se disparan al pasar de un hijo a otro: se cuentan.
  let profundidad = 0;
  const traeArchivos = (evento: DragEvent) => Array.from(evento.dataTransfer?.types ?? []).includes('Files');
  const alEntrar = (evento: DragEvent) => {
    if (!traeArchivos(evento)) return;
    profundidad++;
    velo.hidden = false;
  };
  const alSalir = (evento: DragEvent) => {
    if (!traeArchivos(evento)) return;
    profundidad = Math.max(0, profundidad - 1);
    if (profundidad === 0) velo.hidden = true;
  };
  const alArrastrar = (evento: DragEvent) => {
    if (!traeArchivos(evento)) return;
    evento.preventDefault(); // sin esto el navegador no deja soltar
    if (evento.dataTransfer) evento.dataTransfer.dropEffect = 'copy';
  };
  const alSoltar = (evento: DragEvent) => {
    if (!traeArchivos(evento)) return;
    evento.preventDefault();
    profundidad = 0;
    velo.hidden = true;
    const archivo = evento.dataTransfer?.files?.[0];
    if (archivo) void leer(archivo);
  };
  window.addEventListener('dragenter', alEntrar);
  window.addEventListener('dragleave', alSalir);
  window.addEventListener('dragover', alArrastrar);
  window.addEventListener('drop', alSoltar);

  return () => {
    window.removeEventListener('dragenter', alEntrar);
    window.removeEventListener('dragleave', alSalir);
    window.removeEventListener('dragover', alArrastrar);
    window.removeEventListener('drop', alSoltar);
    velo.remove();
  };
}
