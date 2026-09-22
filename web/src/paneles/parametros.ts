// Formulario de parametros. Arriba, la ficha de la instancia de elemento
// elegida en la secuencia (diseno.ts): sus parametros geometricos, cada uno
// heredado del global o pisado por la instancia, con boton para volver al
// global, y las advertencias de los ajustes inertes. Abajo, los grupos
// globales: modo de curvatura, criterios de aceptacion y generales.
//
// Las cuatro listas (que consume el modo, que declara cada elemento,
// aceptacion, generales) salen del nucleo, que es el mismo port que las
// declara para el contrato y que parametros.test.ts verifica identicas al
// esquema de los golden: por eso al cambiar de modo los parametros del modo
// nuevo aparecen al instante, sin esperar el recalculo. Las etiquetas, las
// unidades y los tooltips siguen siendo las ternas de MATLAB.
//
// Edita estado.diseno (los Parametros del nucleo, en PascalCase, y los
// ajustes de cada instancia).

import type { DeclaracionDeParametro } from '../contrato/tipos';
import type { Diagnostico } from '../diagnostico';
import type { Estado } from '../estado';
import type { EntradaDeDiseno, InstanciaDeElemento } from '../nucleo/calcular';
import {
  AjustarParametros,
  DECLARACIONES_DE_ELEMENTOS,
  MODOS_DE_CURVATURA,
  OPCIONES_DE_PARAMETRO,
  PARAMETROS_ANULABLES,
  ParametrosDeAceptacion,
  ParametrosDelModo,
  ParametrosGenerales,
  ParametrosPorDefecto,
} from '../nucleo/parametros';
import type { Declaracion, ModoCurvatura, NombreDeParametro, Parametros } from '../nucleo/tipos';
import { el } from './dom';

const RAD_A_GRADOS = 180 / Math.PI;

function pascal(clave: string): NombreDeParametro {
  return (clave[0]!.toUpperCase() + clave.slice(1)) as NombreDeParametro;
}

/** Las ternas del nucleo con la clave en camelCase, como las escribe el contrato. */
function declaraciones(lista: Declaracion[]): DeclaracionDeParametro[] {
  return lista.map((d) => ({ clave: d.Nombre[0]!.toLowerCase() + d.Nombre.slice(1), unidad: d.Unidad, descripcion: d.Descripcion }));
}

type Actualizar = (nombre: NombreDeParametro, valor: unknown) => void;

function entradaNumerica(valor: number, unidad: string, alCambiar: (v: number) => void): HTMLInputElement {
  const enGrados = unidad === 'rad';
  const entrada = el('input', {
    type: 'number',
    step: 'any',
    value: String(enGrados ? Number((valor * RAD_A_GRADOS).toPrecision(10)) : Number(valor.toPrecision(10))),
    onChange: (evento: Event) => {
      const campo = evento.target as HTMLInputElement;
      const texto = campo.value;
      const numero = Number(texto);
      if (texto.trim() === '' || !Number.isFinite(numero)) return;
      // Confirmado: defaultValue marca lo que ya esta en el diseno (atajos.ts decide con eso a quien va Ctrl+Z).
      campo.defaultValue = texto;
      alCambiar(enGrados ? numero / RAD_A_GRADOS : numero);
    },
  });
  return entrada;
}

function campo(declaracion: DeclaracionDeParametro, valor: unknown, actualizar: Actualizar, diagnostico?: Diagnostico | null): HTMLElement {
  const nombre = pascal(declaracion.clave);
  const unidad = declaracion.unidad === 'rad' ? '°' : declaracion.unidad;
  const etiqueta = el('span', { class: 'campo-etiqueta', title: declaracion.descripcion }, declaracion.clave, unidad !== '-' ? el('small', {}, ` [${unidad}]`) : null);
  let control: HTMLElement;

  const opciones = nombre === 'ModoCurvatura' ? undefined : OPCIONES_DE_PARAMETRO[nombre];
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
  } else if (PARAMETROS_ANULABLES.includes(nombre)) {
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
    control = el('input', {
      type: 'text', value: valor,
      onChange: (e: Event) => {
        const campo = e.target as HTMLInputElement;
        campo.defaultValue = campo.value;
        actualizar(nombre, campo.value);
      },
    });
  } else {
    control = el('span', { class: 'ayuda' }, String(valor));
  }
  return marcarSiTieneError(el('label', { class: 'campo' }, etiqueta, control), nombre, diagnostico);
}

/**
 * Si el ultimo error del nucleo nombra este parametro, se resalta el campo y
 * el mensaje va debajo, ademas del banner: que se vea que campo hay que
 * tocar y no solo que algo fallo.
 */
function marcarSiTieneError(fila: HTMLElement, nombre: NombreDeParametro, diagnostico?: Diagnostico | null): HTMLElement {
  if (diagnostico && diagnostico.parametros.includes(nombre)) {
    fila.classList.add('con-error');
    fila.append(el('span', { class: 'campo-error', role: 'alert' }, diagnostico.mensaje));
  }
  return fila;
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

function grupo(titulo: string, lista: DeclaracionDeParametro[], parametros: Parametros, actualizar: Actualizar, abierto: boolean, diagnostico: Diagnostico | null): HTMLElement {
  const conError = lista.some((d) => diagnostico?.parametros.includes(pascal(d.clave)));
  return el(
    'details',
    // Un grupo cerrado que esconde el campo con error se abre solo.
    { open: abierto || conError },
    el('summary', {}, `${titulo} (${lista.length})`, conError ? el('span', { class: 'summary-error', title: 'Hay un campo con error en este grupo' }, ' ⚠') : null),
    el('div', { class: 'campos' }, lista.map((d) => campo(d, (parametros as unknown as Record<string, unknown>)[pascal(d.clave)], actualizar, diagnostico))),
  );
}

/** Texto de la advertencia de un ajuste inerte: que lo pisaron y quien no lo consume (el modo o el elemento). */
export function textoDeInerte(nombre: NombreDeParametro, modo: ModoCurvatura, tipo: InstanciaDeElemento['tipo']): string {
  const esDelModo = MODOS_DE_CURVATURA.some((m) => ParametrosDelModo(m).Lista.some((d) => d.Nombre === nombre));
  return esDelModo
    ? `ajustaste ${nombre} pero el modo ${modo} no lo consume`
    : `ajustaste ${nombre} pero el elemento ${tipo} no lo consume`;
}

/** Cambio de los ajustes de una instancia: recibe los vigentes (no los del dibujo, que pueden estar viejos) y devuelve los nuevos. */
type Ajustar = (transformar: (ajustes: Partial<Parametros>) => Partial<Parametros>, enElLugar: boolean) => void;

function sinAjuste(ajustes: Partial<Parametros>, nombre: NombreDeParametro): Partial<Parametros> {
  const { [nombre]: _quitado, ...resto } = ajustes;
  return resto;
}

/** La ficha de la instancia elegida: sus parametros geometricos, heredados o pisados, y los inertes. */
function ficha(inst: InstanciaDeElemento, orden: number, diseno: EntradaDeDiseno, ajustar: Ajustar, diagnostico: Diagnostico | null): HTMLElement {
  // El diagnostico se aplica a la ficha solo si el calculo fallo en ESTA instancia (o no se sabe en cual).
  const propio = diagnostico && (diagnostico.instancia === null || diagnostico.instancia === inst.id) ? diagnostico : null;
  const globales = diseno.parametros;
  const estados = new Map<NombreDeParametro, { fila: HTMLElement; origen: HTMLElement; volver: HTMLButtonElement }>();

  const marcar = (nombre: NombreDeParametro, pisado: boolean) => {
    const e = estados.get(nombre);
    if (!e) return;
    e.fila.classList.toggle('pisado', pisado);
    e.fila.classList.toggle('heredado', !pisado);
    e.origen.textContent = pisado ? 'pisado' : 'heredado';
    e.origen.title = pisado ? 'Valor propio de esta instancia' : 'Valor de los parámetros globales';
    e.volver.hidden = !pisado;
  };

  // Editar un campo lo convierte en pisado sin redibujar la ficha (no se pierde el foco).
  const actualizar: Actualizar = (nombre, valor) => {
    ajustar((ajustes) => ({ ...ajustes, [nombre]: valor }), true);
    marcar(nombre, true);
  };

  const campos = DECLARACIONES_DE_ELEMENTOS[inst.tipo].map((d) => {
    const nombre = d.Nombre;
    const pisado = nombre in inst.ajustes;
    const valor = pisado ? inst.ajustes[nombre] : globales[nombre];
    const [declaracion] = declaraciones([d]);
    const fila = campo(declaracion!, valor, actualizar, propio);
    const origen = el('span', { class: 'campo-origen' });
    const volver = el('button', {
      type: 'button', class: 'boton chico', title: 'Volver al valor global',
      onClick: () => ajustar((ajustes) => sinAjuste(ajustes, nombre), false),
    }, '↺');
    fila.append(el('span', { class: 'campo-estado' }, origen, volver));
    estados.set(nombre, { fila, origen, volver });
    marcar(nombre, pisado);
    return fila;
  });

  const { Inertes } = AjustarParametros(globales, inst.ajustes, inst.tipo);
  const advertencias = Inertes.map((nombre) =>
    el('p', { class: 'advertencia' },
      textoDeInerte(nombre, globales.ModoCurvatura, inst.tipo),
      ' ',
      el('button', {
        type: 'button', class: 'boton chico', title: `Quitar el ajuste de ${nombre}`,
        onClick: () => ajustar((ajustes) => sinAjuste(ajustes, nombre), false),
      }, 'quitar'),
    ),
  );

  const cantidad = Object.keys(inst.ajustes).length;
  return el('section', { class: 'ficha' },
    el('div', { class: 'parametros-cabecera' },
      el('h2', {}, `${orden}. ${inst.tipo}`),
      cantidad > 0
        ? el('button', { type: 'button', class: 'boton chico', title: 'Quitar todos los ajustes de esta instancia', onClick: () => ajustar(() => ({}), false) }, 'Todo al global')
        : null,
    ),
    el('p', { class: 'ayuda' }, cantidad === 0 ? 'Hereda todos sus parámetros de los globales; editar uno lo pisa solo para esta instancia.' : `${cantidad} parámetro${cantidad === 1 ? '' : 's'} pisado${cantidad === 1 ? '' : 's'}; ↺ vuelve al global.`),
    el('div', { class: 'campos' }, campos),
    advertencias,
  );
}

export function montarParametros(contenedor: HTMLElement, estado: Estado): void {
  // Los cambios que salen de este formulario no lo redibujan (se perderia el
  // foco), salvo el modo de curvatura, que cambia que parametros se muestran,
  // y los que quitan ajustes (vuelven un campo al global y cambian su valor).
  let cambioPropio = false;

  const dibujar = () => {
    const { diseno, instancia, diagnostico } = estado.get();
    contenedor.replaceChildren();
    if (!diseno) return;
    const parametros = diseno.parametros;

    const actualizarGlobal: Actualizar = (nombre, valor) => {
      const actual = estado.get().diseno;
      if (!actual) return;
      cambioPropio = nombre !== 'ModoCurvatura';
      estado.set({ diseno: { ...actual, parametros: { ...actual.parametros, [nombre]: valor } } });
      cambioPropio = false;
    };

    // --- ficha de la instancia elegida ---
    const indice = diseno.secuencia.findIndex((i) => i.id === instancia);
    const inst = indice >= 0 ? diseno.secuencia[indice]! : null;
    if (inst) {
      const ajustar: Ajustar = (transformar, enElLugar) => {
        const actual = estado.get().diseno;
        if (!actual) return;
        const secuencia = actual.secuencia.map((i) => (i.id === inst.id ? { ...i, ajustes: transformar(i.ajustes) } : i));
        cambioPropio = enElLugar;
        estado.set({ diseno: { ...actual, secuencia } });
        cambioPropio = false;
      };
      contenedor.append(ficha(inst, indice + 1, diseno, ajustar, diagnostico));
    } else {
      contenedor.append(el('section', { class: 'ficha' }, el('p', { class: 'ayuda' }, 'Elegí un elemento de la secuencia para editar sus parámetros.')));
    }

    // --- globales ---
    const selectorDeModo = el('select', {
      onChange: (e: Event) => actualizarGlobal('ModoCurvatura', (e.target as HTMLSelectElement).value),
    });
    for (const opcion of MODOS_DE_CURVATURA) {
      const o = el('option', { value: opcion }, opcion);
      if (opcion === parametros.ModoCurvatura) o.selected = true;
      selectorDeModo.append(o);
    }
    const modo = ParametrosDelModo(parametros.ModoCurvatura);

    contenedor.append(
      el('div', { class: 'parametros-cabecera' },
        el('h2', {}, 'Parámetros globales'),
        el('button', { type: 'button', class: 'boton', title: 'Los globales vuelven a ParametrosPorDefecto(); los ajustes de las instancias se conservan', onClick: () => restablecer(estado) }, 'Resetear a default'),
      ),
      el('details', { open: true },
        el('summary', {}, 'Modo de curvatura'),
        el('div', { class: 'campos' },
          marcarSiTieneError(el('label', { class: 'campo' }, el('span', { class: 'campo-etiqueta' }, 'modoCurvatura'), selectorDeModo), 'ModoCurvatura', diagnostico),
          modo.Nota ? el('p', { class: 'ayuda' }, modo.Nota) : null,
          declaraciones(modo.Lista).map((d) => campo(d, (parametros as unknown as Record<string, unknown>)[pascal(d.clave)], actualizarGlobal, diagnostico)),
        ),
      ),
      grupo('Criterios de aceptación', declaraciones(ParametrosDeAceptacion()), parametros, actualizarGlobal, false, diagnostico),
      grupo('Generales', declaraciones(ParametrosGenerales()), parametros, actualizarGlobal, false, diagnostico),
    );
  };
  dibujar();
  estado.suscribir((nuevo, anterior) => {
    if (cambioPropio) return;
    // Se redibuja cuando cambia el diseno por fuera del formulario (reset, otro caso, secuencia), la instancia elegida o el diagnostico.
    if (nuevo.diseno !== anterior.diseno || nuevo.instancia !== anterior.instancia || nuevo.diagnostico !== anterior.diagnostico) dibujar();
  });
}

function restablecer(estado: Estado): void {
  const actual = estado.get().diseno;
  if (!actual) return;
  estado.set({ diseno: { ...actual, parametros: ParametrosPorDefecto() } });
}
