// Pestanas del panel lateral: resultados (lo que muestra el layout) o diseno
// (lo que se edita para recalcularlo).

import type { DatosDeEstado, Estado, PanelLateral } from '../estado';
import { montarPestanas } from './pestanas';

const PANELES: { clave: PanelLateral; etiqueta: string }[] = [
  { clave: 'resultados', etiqueta: 'Resultados' },
  { clave: 'diseno', etiqueta: 'Diseño' },
];

export function montarSelectorDePanel(contenedor: HTMLElement, estado: Estado, paneles: Record<PanelLateral, HTMLElement>): void {
  const pestanas = montarPestanas(contenedor, PANELES, estado.get().panel, (panel) => estado.set({ panel }), {
    resultados: [paneles.resultados],
    diseno: [paneles.diseno],
  });
  // El nivel mas alto del icono de error (tarea 3.7): si el ultimo calculo
  // fallo en un campo o en una instancia, la pestana Diseno lo avisa aunque se
  // este mirando Resultados. Adentro, cada seccion plegada lo repite.
  const marcar = (diagnostico: DatosDeEstado['diagnostico']) => {
    const hayAlgoQueMarcar = diagnostico !== null && (diagnostico.parametros.length > 0 || diagnostico.instancia !== null);
    pestanas.marcarError('diseno', hayAlgoQueMarcar ? 'El cálculo falló: hay un campo o un elemento con error en Diseño' : null);
  };
  marcar(estado.get().diagnostico);
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.panel !== anterior.panel) pestanas.activar(nuevo.panel);
    if (nuevo.diagnostico !== anterior.diagnostico) marcar(nuevo.diagnostico);
  });
}
