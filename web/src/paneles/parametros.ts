// Formulario de parametros generado desde parametros.esquema del layout
// (CONTRATO_VISUALIZADOR.md, 1.9): los grupos, las etiquetas, las unidades
// y los tooltips salen del JSON, nunca de una lista escrita aca. Edita
// estado.diseno.parametros (los Parametros del nucleo, en PascalCase).

import type { DeclaracionDeParametro, Layout } from '../contrato/tipos';
import type { Estado } from '../estado';
import { instanciasDesdeTipos, type EntradaDeDiseno } from '../nucleo/calcular';
import { ParametrosPorDefecto } from '../nucleo/parametros';
import type { NombreDeParametro, Parametros } from '../nucleo/tipos';
import { el } from './dom';

const RAD_A_GRADOS = 180 / Math.PI;

/** Enumeraciones que el esquema no distingue de un texto libre. */
const OPCIONES: Partial<Record<NombreDeParametro, string[]>> = {
  SentidoDelGiro: ['Derecha', 'Izquierda'],
  PuntoDeVerificacionNormativa: ['Heartline', 'Cabeza'],
  MetodoDeAcoplamiento: ['A', 'B', 'Ambos'],
};

/** Los que en MATLAB admiten [] (vacio = derivar). */
const ANULABLES: NombreDeParametro[] = ['OnsetMaximoModelo', 'InclinacionHelicoidalImpuesta'];

function pascal(clave: string): NombreDeParametro {
  return (clave[0]!.toUpperCase() + clave.slice(1)) as NombreDeParametro;
}

type Actualizar = (nombre: NombreDeParametro, valor: unknown) => void;

function entradaNumerica(valor: number, unidad: string, alCambiar: (v: number) => void): HTMLInputElement {
  const enGrados = unidad === 'rad';
  const entrada = el('input', {
    type: 'number',
    step: 'any',
    value: String(enGrados ? Number((valor * RAD_A_GRADOS).toPrecision(10)) : Number(valor.toPrecision(10))),
    onChange: (evento: Event) => {
      const texto = (evento.target as HTMLInputElement).value;
      const numero = Number(texto);
      if (texto.trim() === '' || !Number.isFinite(numero)) return;
      alCambiar(enGrados ? numero / RAD_A_GRADOS : numero);
    },
  });
  return entrada;
}

function campo(declaracion: DeclaracionDeParametro, valor: unknown, actualizar: Actualizar): HTMLElement {
  const nombre = pascal(declaracion.clave);
  const unidad = declaracion.unidad === 'rad' ? '°' : declaracion.unidad;
  const etiqueta = el('span', { class: 'campo-etiqueta', title: declaracion.descripcion }, declaracion.clave, unidad !== '-' ? el('small', {}, ` [${unidad}]`) : null);
  let control: HTMLElement;

  const opciones = OPCIONES[nombre];
  if (opciones) {
    const selector = el('select', { onChange: (e: Event) => actualizar(nombre, (e.target as HTMLSelectElement).value) });
    for (const opcion of opciones) {
      const o = el('option', { value: opcion }, opcion);
      if (opcion === valor) o.selected = true;
      selector.append(o);
    }
    control = selector;
  } else if (typeof valor === 'boolean') {
    const casilla = el('input', { type: 'checkbox', onChange: (e: Event) => actualizar(nombre, (e.target as HTMLInputElement).checked) });
    casilla.checked = valor;
    control = casilla;
  } else if (ANULABLES.includes(nombre)) {
    control = campoAnulable(nombre, declaracion, valor, actualizar);
  } else if (typeof valor === 'number') {
    control = entradaNumerica(valor, declaracion.unidad, (v) => actualizar(nombre, v));
  } else if (Array.isArray(valor) && valor.length === 3 && valor.every((v) => typeof v === 'number')) {
    const vector = [...(valor as number[])];
    control = el('span', { class: 'campo-vector' }, vector.map((v, i) =>
      entradaNumerica(v, declaracion.unidad, (nuevo) => {
        vector[i] = nuevo;
        actualizar(nombre, [...vector]);
      }),
    ));
  } else if (Array.isArray(valor) && valor.length === 3 && valor.every((fila) => Array.isArray(fila) && fila.length === 2)) {
    const caja = (valor as number[][]).map((fila) => [...fila]);
    control = el('span', { class: 'campo-caja' }, ['x', 'y', 'z'].map((eje, i) =>
      el('span', { class: 'campo-fila' }, `${eje}: `, ...caja[i]!.map((v, j) =>
        entradaNumerica(v, declaracion.unidad, (nuevo) => {
          caja[i]![j] = nuevo;
          actualizar(nombre, caja.map((f) => [...f]));
        }),
      )),
    ));
  } else if (typeof valor === 'string') {
    control = el('input', { type: 'text', value: valor, onChange: (e: Event) => actualizar(nombre, (e.target as HTMLInputElement).value) });
  } else {
    control = el('span', { class: 'ayuda' }, String(valor));
  }
  return el('label', { class: 'campo' }, etiqueta, control);
}

function campoAnulable(nombre: NombreDeParametro, declaracion: DeclaracionDeParametro, valor: unknown, actualizar: Actualizar): HTMLElement {
  const vacio = valor === null || valor === undefined || (Array.isArray(valor) && valor.length === 0);
  const esVector = nombre === 'OnsetMaximoModelo';
  const contenedor = el('span', { class: 'campo-anulable' });
  const casilla = el('input', { type: 'checkbox' });
  casilla.checked = vacio;
  const entradas = el('span', { class: esVector ? 'campo-vector' : '' });
  const valores: number[] = vacio ? (esVector ? [0, 0, 0] : [0]) : esVector ? [...(valor as number[])] : [valor as number];
  const emitir = () => actualizar(nombre, casilla.checked ? null : esVector ? [...valores] : valores[0]);
  valores.forEach((v, i) => {
    const entrada = entradaNumerica(v, declaracion.unidad, (nuevo) => {
      valores[i] = nuevo;
      emitir();
    });
    entrada.disabled = vacio;
    entradas.append(entrada);
  });
  casilla.addEventListener('change', () => {
    entradas.querySelectorAll('input').forEach((i) => (i.disabled = casilla.checked));
    emitir();
  });
  contenedor.append(el('span', { class: 'campo-vacio' }, casilla, ' vacío (derivar)'), entradas);
  return contenedor;
}

function grupo(titulo: string, lista: DeclaracionDeParametro[], parametros: Parametros, actualizar: Actualizar, abierto: boolean): HTMLElement {
  return el(
    'details',
    { open: abierto },
    el('summary', {}, `${titulo} (${lista.length})`),
    el('div', { class: 'campos' }, lista.map((d) => campo(d, (parametros as unknown as Record<string, unknown>)[pascal(d.clave)], actualizar))),
  );
}

export function montarParametros(contenedor: HTMLElement, estado: Estado): void {
  const dibujar = () => {
    const { layout, diseno } = estado.get();
    contenedor.replaceChildren();
    if (!layout || !diseno) return;
    const esquema = layout.parametros.esquema;
    const parametros = diseno.parametros;

    const actualizar: Actualizar = (nombre, valor) => {
      const actual = estado.get().diseno;
      if (!actual) return;
      // Los cambios que salen de este formulario no lo redibujan (se perderia el foco),
      // salvo el modo de curvatura, que cambia que parametros se muestran.
      cambioPropio = nombre !== 'ModoCurvatura';
      estado.set({ diseno: { ...actual, parametros: { ...actual.parametros, [nombre]: valor } } });
      cambioPropio = false;
    };

    const selectorDeModo = el('select', {
      onChange: (e: Event) => actualizar('ModoCurvatura', (e.target as HTMLSelectElement).value),
    });
    for (const opcion of esquema.modo.opciones) {
      const o = el('option', { value: opcion }, opcion);
      if (opcion === parametros.ModoCurvatura) o.selected = true;
      selectorDeModo.append(o);
    }

    const enSecuencia = new Set(diseno.secuencia.map((inst) => inst.tipo));
    contenedor.append(
      el('div', { class: 'parametros-cabecera' },
        el('h2', {}, 'Parámetros'),
        el('button', { type: 'button', class: 'boton', onClick: () => restablecer(estado) }, 'Resetear a default'),
      ),
      el('details', { open: true },
        el('summary', {}, 'Modo de curvatura'),
        el('div', { class: 'campos' },
          el('label', { class: 'campo' }, el('span', { class: 'campo-etiqueta' }, 'modoCurvatura'), selectorDeModo),
          esquema.modo.nota ? el('p', { class: 'ayuda' }, esquema.modo.nota) : null,
          esquema.modo.parametros.map((d) => campo(d, (parametros as unknown as Record<string, unknown>)[pascal(d.clave)], actualizar)),
        ),
      ),
      ...Object.entries(esquema.elementos).map(([tipo, lista]) => grupo(tipo, lista, parametros, actualizar, enSecuencia.has(tipo as never))),
      grupo('Criterios de aceptación', esquema.aceptacion, parametros, actualizar, false),
      grupo('Generales', esquema.generales, parametros, actualizar, false),
    );
  };
  let cambioPropio = false;
  dibujar();
  estado.suscribir((nuevo, anterior) => {
    if (cambioPropio) return;
    // Se redibuja cuando cambia el diseno por fuera del formulario (reset, otro caso, secuencia) o el esquema.
    if (nuevo.diseno !== anterior.diseno || nuevo.layout?.parametros.esquema !== anterior.layout?.parametros.esquema) dibujar();
  });
}

function restablecer(estado: Estado): void {
  const actual = estado.get().diseno;
  if (!actual) return;
  estado.set({ diseno: { ...actual, parametros: ParametrosPorDefecto() } });
}

/** Un diseno inicial a partir del layout cargado: sus parametros, su estado inicial y su secuencia. */
export function disenoDesdeLayout(layout: Layout, parametros: Parametros): EntradaDeDiseno {
  const e = layout.estadoInicial;
  return {
    parametros,
    posicion: [...e.posicion],
    tangente: [...e.versorTangente],
    arriba: [...e.versorArribaCarro],
    velocidad: e.velocidad,
    secuencia: instanciasDesdeTipos(layout.elementos.map((el) => el.tipo)),
  };
}
