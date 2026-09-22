// Cabecera fija del panel lateral: que se esta mirando (el nombre del caso o
// del diseno propio) y en que estado esta, en una pildora: golden de MATLAB,
// diseno propio calculado, con cambios sin calcular o calculando. Queda
// pegada arriba mientras el panel se scrollea, junto con las pestanas
// Resultados / Diseno, asi nunca hay que volver arriba para saber que layout
// es el de la pantalla.

import type { DatosDeEstado, Estado } from '../estado';
import { el } from './dom';

export type EstadoDePildora = 'golden' | 'propio' | 'pendiente' | 'calculando' | 'cargando';

/** Que dice la pildora, a partir del estado. Puro: lo usa el test. */
export function estadoDePildora(e: Pick<DatosDeEstado, 'fuente' | 'diseno' | 'disenoCalculado' | 'calculando' | 'cargando'>): EstadoDePildora {
  if (e.calculando) return 'calculando';
  if (e.cargando) return 'cargando';
  if (e.fuente === 'golden') return 'golden';
  return e.diseno !== null && e.diseno !== e.disenoCalculado ? 'pendiente' : 'propio';
}

const TEXTO: Record<EstadoDePildora, string> = {
  golden: 'golden · MATLAB',
  propio: 'diseño propio',
  pendiente: 'cambios sin generar',
  calculando: 'calculando',
  cargando: 'cargando',
};

const AYUDA: Record<EstadoDePildora, string> = {
  golden: 'Golden file generado por MATLAB (GenerarGoldenFiles.m): la referencia normativa.',
  propio: 'Diseño propio, calculado en el navegador con el port de la física.',
  pendiente: 'El diseño tiene cambios que todavía no se calcularon: Generar (Ctrl+Enter).',
  calculando: 'Calculando en segundo plano; Esc detiene.',
  cargando: 'Cargando el caso.',
};

export function montarCabecera(contenedor: HTMLElement, estado: Estado): void {
  const nombre = el('span', { class: 'cabecera-nombre' });
  const origen = el('span', { class: 'cabecera-origen' });
  const pildora = el('span', { class: 'pildora', role: 'status' });
  contenedor.append(
    el('p', { class: 'cabecera-marca' }, 'Montaña rusa en miniatura'),
    el('div', { class: 'cabecera-fila' }, el('h1', { class: 'cabecera-titulo' }, nombre, origen), pildora),
  );

  const dibujar = (e: DatosDeEstado) => {
    const tipo = estadoDePildora(e);
    nombre.textContent = e.fuente === 'diseno' ? 'Diseño propio' : e.caso ?? '—';
    origen.textContent = e.fuente === 'diseno' && e.origen ? ` · a partir de ${e.origen}` : '';
    const progreso = tipo === 'calculando' && e.progreso ? ` ${e.progreso.hecho}/${e.progreso.total}` : '';
    pildora.textContent = TEXTO[tipo] + progreso;
    pildora.className = `pildora pildora-${tipo}`;
    pildora.title = AYUDA[tipo];
  };
  dibujar(estado.get());
  estado.suscribir((nuevo, anterior) => {
    if (
      nuevo.fuente !== anterior.fuente || nuevo.caso !== anterior.caso || nuevo.origen !== anterior.origen || nuevo.diseno !== anterior.diseno ||
      nuevo.disenoCalculado !== anterior.disenoCalculado || nuevo.calculando !== anterior.calculando || nuevo.cargando !== anterior.cargando ||
      nuevo.progreso !== anterior.progreso
    ) dibujar(nuevo);
  });
}
