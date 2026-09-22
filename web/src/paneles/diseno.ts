// Panel de diseno: de donde sale el layout (golden o diseno propio), el
// estado inicial y la secuencia de instancias de elemento, que es la
// navegacion principal: elegir una fila abre sus parametros en el
// formulario de al lado (parametros.ts). Editar cambia el borrador
// (estado.diseno); calcular es explicito, con Generar.

import type { Estado } from '../estado';
import { nuevoIdDeInstancia, type EntradaDeDiseno, type InstanciaDeElemento } from '../nucleo/calcular';
import { textoDelLayout } from '../nucleo/descargar';
import { CATALOGO_DE_ELEMENTOS } from '../nucleo/parametros';
import type { NombreDeElemento } from '../nucleo/tipos';
import { el, vaciar } from './dom';
import { descargarArchivo } from './guardar';

function contarAjustes(inst: InstanciaDeElemento): number {
  return Object.keys(inst.ajustes).length;
}

export function montarDiseno(contenedor: HTMLElement, estado: Estado, abrirDiseno: () => void): void {
  // Los cambios que salen de los campos del estado inicial no redibujan
  // el panel (se perderia el foco); los de la secuencia si, porque cambian
  // las filas. El estado del calculo ("Calculando...", duracion) se
  // actualiza en el lugar por el mismo motivo: llega mientras se tipea.
  let cambioPropio = false;
  let lineaDeEstado: HTMLElement | null = null;
  const textoDeEstado = ({ calculando, ultimoCalculoMs, autoGenerar }: { calculando: boolean; ultimoCalculoMs: number | null; autoGenerar: boolean }) =>
    calculando
      ? 'Calculando…'
      : `Diseño propio calculado en el navegador${ultimoCalculoMs !== null ? ` en ${(ultimoCalculoMs / 1000).toFixed(2)} s` : ''}. ${autoGenerar ? 'Cada cambio recalcula (auto-generar).' : 'Generar (Ctrl+Enter) calcula los cambios.'}`;

  const dibujar = () => {
    const { layout, diseno, fuente, caso, instancia, diagnostico } = estado.get();
    vaciar(contenedor);
    lineaDeEstado = null;
    if (!layout && !diseno) return;

    const actualizar = (parcial: Partial<EntradaDeDiseno>, extra: { instancia?: string | null } = {}) => {
      const actual = estado.get().diseno;
      if (!actual) return;
      estado.set({ diseno: { ...actual, ...parcial }, ...extra });
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
            (lineaDeEstado = el('p', { class: 'ayuda' }, textoDeEstado(estado.get()))),
            el('div', { class: 'botonera' },
              el('button', { type: 'button', class: 'boton', title: 'Solo el contrato entero (~2 MB); el paquete .zip de la barra trae ademas parámetros, gráficos y CSV', onClick: () => descargar(estado) }, 'Descargar layout.json'),
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
          const campo = e.target as HTMLInputElement;
          const v = Number(campo.value);
          if (!Number.isFinite(v)) return;
          campo.defaultValue = campo.value; // confirmado (ver atajos.ts)
          cambioPropio = true;
          alCambiar(v);
          cambioPropio = false;
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

    // --- secuencia: la navegacion principal ---
    const secuencia = diseno.secuencia;
    const filas = secuencia.map((inst, i) => {
      const selector = el('select', {
        title: 'Tipo de elemento; los ajustes se conservan (los que el tipo nuevo no consume quedan como inertes)',
        onChange: (e: Event) => {
          const nueva = [...secuencia];
          nueva[i] = { ...inst, tipo: (e.target as HTMLSelectElement).value as NombreDeElemento };
          actualizar({ secuencia: nueva }, { instancia: inst.id });
        },
      });
      for (const nombre of CATALOGO_DE_ELEMENTOS) {
        const o = el('option', { value: nombre }, nombre);
        if (nombre === inst.tipo) o.selected = true;
        selector.append(o);
      }
      const mover = (desde: number, hasta: number) => {
        if (hasta < 0 || hasta >= secuencia.length) return;
        const nueva = [...secuencia];
        [nueva[desde], nueva[hasta]] = [nueva[hasta]!, nueva[desde]!];
        actualizar({ secuencia: nueva }, { instancia: inst.id });
      };
      const duplicar = () => {
        const copia: InstanciaDeElemento = { id: nuevoIdDeInstancia(secuencia), tipo: inst.tipo, ajustes: structuredClone(inst.ajustes) };
        const nueva = [...secuencia.slice(0, i + 1), copia, ...secuencia.slice(i + 1)];
        actualizar({ secuencia: nueva }, { instancia: copia.id });
      };
      const quitar = () => {
        const nueva = secuencia.filter((_, k) => k !== i);
        // Si se quita la elegida, pasa a la que queda en su lugar (o la anterior, o ninguna).
        const siguiente = instancia === inst.id ? (nueva[Math.min(i, nueva.length - 1)]?.id ?? null) : instancia;
        actualizar({ secuencia: nueva }, { instancia: siguiente });
      };
      const ajustes = contarAjustes(inst);
      const conError = diagnostico?.instancia === inst.id;
      return el('div', {
          class: `secuencia-fila${inst.id === instancia ? ' elegida' : ''}${conError ? ' con-error' : ''}`,
          role: 'button',
          'aria-pressed': inst.id === instancia ? 'true' : 'false',
          title: 'Elegir para editar sus parámetros',
          onClick: (e: Event) => {
            // Los controles de la fila (tipo, mover, duplicar, quitar) eligen por su cuenta.
            if ((e.target as HTMLElement).closest('button, select')) return;
            estado.set({ instancia: inst.id });
          },
        },
        el('span', { class: 'secuencia-numero' }, `${i + 1}.`),
        conError ? el('span', { class: 'secuencia-error', title: `El cálculo falló en este elemento: ${diagnostico!.mensaje}` }, '⚠') : null,
        selector,
        el('span', { class: 'secuencia-ajustes', title: ajustes === 0 ? 'Todos los parámetros heredados de los globales' : 'Parámetros pisados por esta instancia' },
          ajustes === 0 ? '' : `${ajustes} ajuste${ajustes === 1 ? '' : 's'}`),
        el('button', { type: 'button', class: 'boton chico', title: 'Subir', onClick: () => mover(i, i - 1) }, '↑'),
        el('button', { type: 'button', class: 'boton chico', title: 'Bajar', onClick: () => mover(i, i + 1) }, '↓'),
        el('button', { type: 'button', class: 'boton chico', title: 'Duplicar (copia también los ajustes)', onClick: duplicar }, '⧉'),
        el('button', { type: 'button', class: 'boton chico', title: 'Quitar', onClick: quitar }, '✕'),
      );
    });
    contenedor.append(
      el('section', {},
        el('h2', {}, 'Secuencia de elementos'),
        el('p', { class: 'ayuda' }, 'Cada instancia hereda los parámetros globales y puede pisar los suyos: elegí una fila para editarlos.'),
        el('div', { class: 'secuencia' }, filas),
        el('button', {
          type: 'button', class: 'boton',
          onClick: () => {
            const nueva: InstanciaDeElemento = { id: nuevoIdDeInstancia(secuencia), tipo: 'LoopVertical', ajustes: {} };
            actualizar({ secuencia: [...secuencia, nueva] }, { instancia: nueva.id });
          },
        }, '+ Agregar elemento'),
      ),
    );
  };
  dibujar();
  estado.suscribir((nuevo, anterior) => {
    if (lineaDeEstado && (nuevo.calculando !== anterior.calculando || nuevo.ultimoCalculoMs !== anterior.ultimoCalculoMs || nuevo.autoGenerar !== anterior.autoGenerar)) {
      lineaDeEstado.textContent = textoDeEstado(nuevo);
    }
    if (cambioPropio) return;
    if (
      (nuevo.layout === null) !== (anterior.layout === null) || nuevo.diseno !== anterior.diseno || nuevo.fuente !== anterior.fuente ||
      nuevo.caso !== anterior.caso || nuevo.instancia !== anterior.instancia || nuevo.diagnostico !== anterior.diagnostico
    ) dibujar();
  });
}

function descargar(estado: Estado): void {
  const { layout } = estado.get();
  if (!layout) return;
  descargarArchivo('layout.json', new Blob([textoDelLayout(layout)], { type: 'application/json' }));
}
