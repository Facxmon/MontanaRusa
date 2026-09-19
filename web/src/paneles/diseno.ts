// Panel de diseno: de donde sale el layout (golden o diseno propio), el
// estado inicial, la secuencia de elementos y las acciones (recalcular,
// descargar el JSON del contrato). El formulario de parametros esta aparte
// (parametros.ts). Editar cualquier cosa dispara el recalculo en el worker.

import type { Estado } from '../estado';
import type { EntradaDeDiseno } from '../nucleo/calcular';
import { textoDelLayout } from '../nucleo/descargar';
import { CATALOGO_DE_ELEMENTOS } from '../nucleo/parametros';
import type { NombreDeElemento } from '../nucleo/tipos';
import { el, vaciar } from './dom';

export function montarDiseno(contenedor: HTMLElement, estado: Estado, abrirDiseno: () => void): void {
  const dibujar = () => {
    const { layout, diseno, fuente, caso, calculando, ultimoCalculoMs } = estado.get();
    vaciar(contenedor);
    if (!layout) return;

    const actualizar = (parcial: Partial<EntradaDeDiseno>) => {
      const actual = estado.get().diseno;
      if (!actual) return;
      estado.set({ diseno: { ...actual, ...parcial } });
    };

    // --- fuente ---
    const origen = el('section', {},
      el('h2', {}, 'Origen del layout'),
      fuente === 'golden'
        ? el('div', {},
            el('p', { class: 'ayuda' }, `Golden file ${caso ?? ''}, calculado por MATLAB. Editar sus parámetros crea un diseño propio que se recalcula en el navegador.`),
            el('button', { type: 'button', class: 'boton primario', onClick: abrirDiseno }, 'Diseñar a partir de este caso'),
          )
        : el('div', {},
            el('p', { class: 'ayuda' },
              calculando ? 'Calculando…' : `Diseño propio calculado en el navegador${ultimoCalculoMs !== null ? ` en ${(ultimoCalculoMs / 1000).toFixed(2)} s` : ''}. Cada cambio recalcula.`,
            ),
            el('div', { class: 'botonera' },
              el('button', { type: 'button', class: 'boton', onClick: () => descargar(estado) }, 'Descargar JSON'),
            ),
          ),
    );
    contenedor.append(origen);
    if (!diseno) return;

    // --- estado inicial ---
    const numero = (valor: number, alCambiar: (v: number) => void) =>
      el('input', {
        type: 'number', step: 'any', value: String(Number(valor.toPrecision(10))),
        onChange: (e: Event) => {
          const v = Number((e.target as HTMLInputElement).value);
          if (Number.isFinite(v)) alCambiar(v);
        },
      });
    const posicion = [...diseno.posicion] as [number, number, number];
    contenedor.append(
      el('section', {},
        el('h2', {}, 'Estado inicial'),
        el('div', { class: 'campos' },
          el('label', { class: 'campo' }, el('span', { class: 'campo-etiqueta', title: 'Posicion del RIEL al arrancar; el pasajero va DistanciaHeartline mas arriba.' }, 'posición [m]'),
            el('span', { class: 'campo-vector' }, posicion.map((v, i) => numero(v, (nuevo) => { posicion[i] = nuevo; actualizar({ posicion: [...posicion] }); }))),
          ),
          el('label', { class: 'campo' }, el('span', { class: 'campo-etiqueta', title: 'Velocidad del centro de masa a la entrada.' }, 'velocidad [m/s]'),
            numero(diseno.velocidad, (v) => actualizar({ velocidad: v })),
          ),
          el('p', { class: 'ayuda' }, `Tangente [${diseno.tangente.join(', ')}], arriba [${diseno.arriba.join(', ')}]: vía a nivel, carro derecho.`),
        ),
      ),
    );

    // --- secuencia ---
    const filas = diseno.secuencia.map((tipo, i) => {
      const selector = el('select', {
        onChange: (e: Event) => {
          const nueva = [...diseno.secuencia];
          nueva[i] = (e.target as HTMLSelectElement).value as NombreDeElemento;
          actualizar({ secuencia: nueva });
        },
      });
      for (const nombre of CATALOGO_DE_ELEMENTOS) {
        const o = el('option', { value: nombre }, nombre);
        if (nombre === tipo) o.selected = true;
        selector.append(o);
      }
      const mover = (desde: number, hasta: number) => {
        if (hasta < 0 || hasta >= diseno.secuencia.length) return;
        const nueva = [...diseno.secuencia];
        [nueva[desde], nueva[hasta]] = [nueva[hasta]!, nueva[desde]!];
        actualizar({ secuencia: nueva });
      };
      return el('div', { class: 'secuencia-fila' },
        el('span', { class: 'secuencia-numero' }, `${i + 1}.`),
        selector,
        el('button', { type: 'button', class: 'boton chico', title: 'Subir', onClick: () => mover(i, i - 1) }, '↑'),
        el('button', { type: 'button', class: 'boton chico', title: 'Bajar', onClick: () => mover(i, i + 1) }, '↓'),
        el('button', { type: 'button', class: 'boton chico', title: 'Quitar', onClick: () => actualizar({ secuencia: diseno.secuencia.filter((_, k) => k !== i) }) }, '✕'),
      );
    });
    contenedor.append(
      el('section', {},
        el('h2', {}, 'Secuencia de elementos'),
        el('div', { class: 'secuencia' }, filas),
        el('button', { type: 'button', class: 'boton', onClick: () => actualizar({ secuencia: [...diseno.secuencia, 'LoopVertical'] }) }, '+ Agregar elemento'),
      ),
    );
  };
  dibujar();
  estado.suscribir((nuevo, anterior) => {
    if (
      nuevo.layout !== anterior.layout || nuevo.diseno !== anterior.diseno || nuevo.fuente !== anterior.fuente ||
      nuevo.calculando !== anterior.calculando || nuevo.caso !== anterior.caso
    ) dibujar();
  });
}

function descargar(estado: Estado): void {
  const { layout } = estado.get();
  if (!layout) return;
  const texto = textoDelLayout(layout);
  const blob = new Blob([texto], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const enlace = el('a', { href: url, download: 'layout.json' });
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
