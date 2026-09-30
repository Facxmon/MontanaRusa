// El recalculo incremental (calculoIncremental.ts) es una optimizacion sin
// cambio de comportamiento: despues de cualquier edicion, su resultado tiene
// que ser identico (toStrictEqual, sin tolerancia) al de calcularLayout, que
// recalcula todo. Lo unico que se excluye es meta.generadoEn, la hora.

import { afterEach, describe, expect, it } from 'vitest';
import type * as Contrato from '../src/contrato/tipos';
import { calcularLayout, instanciasDesdeTipos, nuevoIdDeInstancia, type EntradaDeDiseno, type InstanciaDeElemento } from '../src/nucleo/calcular';
import { CalculadorIncremental, claveExacta, conInterferencia } from '../src/nucleo/calculoIncremental';
import { EstadoInicial } from '../src/nucleo/basicos';
import { CONSTRUCTORES, LayoutAgregarElemento, LayoutNuevo } from '../src/nucleo/elementos';
import { ParametrosPorDefecto } from '../src/nucleo/parametros';
import type { NombreDeElemento, Parametros } from '../src/nucleo/tipos';

/** El diseno de DemoLayout.m (el mismo que reconstruirCircuito en arnes.ts). */
function demoLayout(): EntradaDeDiseno {
  const parametros = ParametrosPorDefecto();
  parametros.ModoCurvatura = 'ArcoCircular';
  parametros.MetodoDeAcoplamiento = 'A';
  parametros.CalcularVelocidadMinima = false;
  parametros.RadioDelLoop = 0.3;
  parametros.RadioDelGiro = 0.8;
  parametros.RadioDeLaHelice = 0.7;
  parametros.RadioDelDiveLoop = 0.45;
  return {
    parametros, posicion: [0, 0, 1], tangente: [1, 0, 0], arriba: [0, 0, 1], velocidad: 4.5,
    secuencia: instanciasDesdeTipos(['LoopVertical', 'OverBankedTurn', 'Helice', 'DiveLoop']),
  };
}

function sinFecha(layout: Contrato.Layout): Contrato.Layout {
  return { ...layout, meta: { ...layout.meta, generadoEn: '' } };
}

type Resultado = { layout: Contrato.Layout } | { error: string };

function probar(calcular: () => Contrato.Layout): Resultado {
  try {
    return { layout: sinFecha(calcular()) };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

/** Compara las dos rutas sobre la misma entrada (tambien cuando las dos fallan: mismo mensaje). */
function compararRutas(calculador: CalculadorIncremental, entrada: EntradaDeDiseno): void {
  const incremental = probar(() => calculador.calcular(entrada, 'test'));
  const completo = probar(() => calcularLayout(entrada, 'test'));
  expect(incremental).toStrictEqual(completo);
}

/** Generador pseudoaleatorio con semilla (mulberry32): la secuencia de ediciones es reproducible. */
function aleatorio(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RADIO_DEL_TIPO: Record<NombreDeElemento, [keyof Parametros, number, number]> = {
  LoopVertical: ['RadioDelLoop', 0.26, 0.34],
  OverBankedTurn: ['RadioDelGiro', 0.7, 0.9],
  Helice: ['RadioDeLaHelice', 0.6, 0.8],
  DiveLoop: ['RadioDelDiveLoop', 0.4, 0.5],
};

type Edicion = (e: EntradaDeDiseno, azar: () => number) => { entrada: EntradaDeDiseno; descripcion: string };

const conSecuencia = (e: EntradaDeDiseno, secuencia: InstanciaDeElemento[]): EntradaDeDiseno => ({ ...e, secuencia });
const conAjustes = (e: EntradaDeDiseno, i: number, ajustes: Partial<Parametros>): EntradaDeDiseno =>
  conSecuencia(e, e.secuencia.map((inst, k) => (k === i ? { ...inst, ajustes } : inst)));

const EDICIONES: Edicion[] = [
  // Radio propio de una instancia: cambia la geometria desde ahi.
  (e, azar) => {
    const i = Math.floor(azar() * e.secuencia.length);
    const [nombre, min, max] = RADIO_DEL_TIPO[e.secuencia[i]!.tipo];
    const valor = min + (max - min) * azar();
    return { entrada: conAjustes(e, i, { ...e.secuencia[i]!.ajustes, [nombre]: valor }), descripcion: `${nombre} = ${valor.toFixed(4)} en ${i}` };
  },
  // Un limite de aceptacion: no cambia la salida del elemento, los siguientes salen enteros de la cache.
  (e, azar) => {
    const i = Math.floor(azar() * e.secuencia.length);
    const valor = 1 + azar();
    return { entrada: conAjustes(e, i, { ...e.secuencia[i]!.ajustes, AlturaMaximaDelElemento: valor }), descripcion: `AlturaMaximaDelElemento en ${i}` };
  },
  // Sentido del giro (inerte en el loop vertical).
  (e, azar) => {
    const i = Math.floor(azar() * e.secuencia.length);
    const actual = e.secuencia[i]!.ajustes.SentidoDelGiro ?? e.parametros.SentidoDelGiro;
    const SentidoDelGiro = actual.toLowerCase() === 'izquierda' ? 'Derecha' : 'Izquierda';
    return { entrada: conAjustes(e, i, { ...e.secuencia[i]!.ajustes, SentidoDelGiro }), descripcion: `SentidoDelGiro = ${SentidoDelGiro} en ${i}` };
  },
  // Volver una instancia a los globales.
  (e, azar) => {
    const i = Math.floor(azar() * e.secuencia.length);
    return { entrada: conAjustes(e, i, {}), descripcion: `sin ajustes en ${i}` };
  },
  // Insertar o quitar un elemento.
  (e, azar) => {
    const tipos: NombreDeElemento[] = ['LoopVertical', 'OverBankedTurn', 'Helice', 'DiveLoop'];
    if (e.secuencia.length > 2 && (e.secuencia.length >= 5 || azar() < 0.5)) {
      const i = Math.floor(azar() * e.secuencia.length);
      return { entrada: conSecuencia(e, e.secuencia.filter((_, k) => k !== i)), descripcion: `quitar ${i}` };
    }
    const i = Math.floor(azar() * (e.secuencia.length + 1));
    const tipo = tipos[Math.floor(azar() * tipos.length)]!;
    const secuencia = [...e.secuencia];
    secuencia.splice(i, 0, { id: nuevoIdDeInstancia(e.secuencia), tipo, ajustes: {} });
    return { entrada: conSecuencia(e, secuencia), descripcion: `insertar ${tipo} en ${i}` };
  },
  // Velocidad inicial: cambia la entrada del primer elemento.
  (e, azar) => {
    const velocidad = 4.3 + 0.4 * azar();
    return { entrada: { ...e, velocidad }, descripcion: `velocidad = ${velocidad.toFixed(4)}` };
  },
  // Parametro general: invalida la cache entera.
  (e, azar) => {
    const parametros = { ...e.parametros, Masa: e.parametros.Masa * (0.9 + 0.2 * azar()) };
    return { entrada: { ...e, parametros }, descripcion: 'Masa (general)' };
  },
];

// Estos tests son sincronos y pesados: vitest los encadena solo con promesas, asi que el hilo nunca atiende
// los mensajes de vuelta del proceso principal y a los ~60 s vence "Timeout calling onTaskUpdate" (exit code 1
// aunque pasen todos). Ceder un turno del bucle de eventos entre tests lo evita.
afterEach(() => new Promise<void>((resolver) => setTimeout(resolver, 0)));

describe('recalculo incremental', () => {
  describe('ediciones aleatorias sobre el DemoLayout: identico al recalculo completo', () => {
    // Un it por edicion (en orden, compartiendo el calculador) para no bloquear el hilo de vitest minutos seguidos.
    const azar = aleatorio(20260929);
    const calculador = new CalculadorIncremental();
    let entrada = demoLayout();
    it('diseno inicial', () => compararRutas(calculador, entrada), 300000);
    for (let paso = 1; paso <= 12; paso++) {
      it(`edicion ${paso}`, () => {
        const edicion = EDICIONES[Math.floor(azar() * EDICIONES.length)]!(entrada, azar);
        entrada = edicion.entrada;
        compararRutas(calculador, entrada);
      }, 300000);
    }
  });

  it('editar el ultimo elemento reutiliza todos los anteriores', () => {
    const calculador = new CalculadorIncremental();
    const entrada = demoLayout();
    calculador.calcular(entrada, 'test');
    expect(calculador.estadistica).toEqual({ reutilizados: 0, recalculados: 4, interferenciasRehechas: 0 });
    const editada = conAjustes(entrada, 3, { RadioDelDiveLoop: 0.47 });
    const incremental = calculador.calcular(editada, 'test');
    expect(calculador.estadistica).toEqual({ reutilizados: 3, recalculados: 1, interferenciasRehechas: 0 });
    expect(sinFecha(incremental)).toStrictEqual(sinFecha(calcularLayout(editada, 'test')));
  }, 120000);

  it('si la edicion no cambia la salida del elemento, los siguientes salen enteros de la cache', () => {
    const calculador = new CalculadorIncremental();
    const entrada = demoLayout();
    calculador.calcular(entrada, 'test');
    // Un limite de aceptacion cambia el veredicto del elemento 0 pero no su geometria ni su estado de salida.
    const editada = conAjustes(entrada, 0, { AlturaMaximaDelElemento: 0.01 });
    const incremental = calculador.calcular(editada, 'test');
    expect(calculador.estadistica).toEqual({ reutilizados: 3, recalculados: 1, interferenciasRehechas: 0 });
    expect(incremental.elementos[0]!.criterios.posteriores.find((c) => c.nombre === 'Altura del loop')!.pasa).toBe(false);
    expect(sinFecha(incremental)).toStrictEqual(sinFecha(calcularLayout(editada, 'test')));
  }, 120000);

  it('deshacer vuelve a un diseno ya calculado sin reconstruir nada', () => {
    const calculador = new CalculadorIncremental();
    const entrada = demoLayout();
    const original = calculador.calcular(entrada, 'test');
    calculador.calcular(conAjustes(entrada, 1, { RadioDelGiro: 0.75 }), 'test');
    const deshecho = calculador.calcular(entrada, 'test');
    expect(calculador.estadistica.recalculados).toBe(0);
    expect(sinFecha(deshecho)).toStrictEqual(sinFecha(original));
  }, 120000);

  it('un cambio en los parametros generales invalida toda la cache', () => {
    const calculador = new CalculadorIncremental();
    const entrada = demoLayout();
    calculador.calcular(entrada, 'test');
    // AlturaMaximaDelElemento global no cambia ninguna salida, pero igual invalida: la regla es por parametro general, no por efecto.
    const editada = { ...entrada, parametros: { ...entrada.parametros, AlturaMaximaDelElemento: 0.9 } };
    calculador.calcular(editada, 'test');
    expect(calculador.estadistica).toEqual({ reutilizados: 0, recalculados: 4, interferenciasRehechas: 0 });
  }, 120000);

  it('un elemento reutilizado sobre otra via previa rehace la linea de interferencia', () => {
    const calculador = new CalculadorIncremental();
    const entrada = demoLayout();
    calculador.calcular(entrada, 'test');
    // El radio cambia el riel del elemento 0; despues, el radio original con otro ajuste inocuo vuelve al mismo
    // riel pero con una clave nueva, que no hereda la ficha (la corrida anterior tenia otro riel en esa posicion).
    calculador.calcular(conAjustes(entrada, 0, { RadioDelLoop: 0.31 }), 'test');
    const editada = conAjustes(entrada, 0, { AlturaMaximaDelElemento: 0.9 });
    const incremental = calculador.calcular(editada, 'test');
    expect(calculador.estadistica).toEqual({ reutilizados: 3, recalculados: 1, interferenciasRehechas: 3 });
    expect(sinFecha(incremental)).toStrictEqual(sinFecha(calcularLayout(editada, 'test')));
  }, 120000);

  it('conInterferencia da la misma linea que el constructor con esa via previa', () => {
    const parametros = { ...ParametrosPorDefecto(), PasoGeneracion: 0.01, PasoSimulacion: 0.01 };
    const Estado = EstadoInicial([0, 0, 1], [1, 0, 0], [0, 0, 1], 5, parametros);
    // Via previa: un loop vertical que termina donde arranca la helice.
    let Layout = LayoutNuevo(Estado, parametros);
    const [Salida, Loop, ReporteLoop] = CONSTRUCTORES.LoopVertical(Estado, parametros, Layout);
    Layout = LayoutAgregarElemento(Layout, Loop, Salida, ReporteLoop);
    const [, SinVia, ReporteSinVia] = CONSTRUCTORES.Helice(Salida, parametros, LayoutNuevo(Salida, parametros));
    const [, , ReporteConVia] = CONSTRUCTORES.Helice(Salida, parametros, Layout);
    const nombre = 'Interferencia con la via preexistente';
    const linea = (r: { Posteriores: { Nombre: string }[] }) => r.Posteriores.find((c) => c.Nombre === nombre);
    expect(linea(ReporteSinVia)).not.toStrictEqual(linea(ReporteConVia));
    expect(conInterferencia(ReporteSinVia, SinVia, Layout)).toStrictEqual({ ...ReporteSinVia, Posteriores: ReporteConVia.Posteriores });
  }, 120000);

  it('Detener no pierde la cache: un calculador nuevo sembrado con la copia de la pagina sigue igual', () => {
    // Lo que hace ClienteDeCalculo: cada entrada nueva se copia afuera (structuredClone = postMessage).
    const espejo = new Map<string, unknown>();
    let firmaDelEspejo = '';
    const copiar = (firma: string, clave: string, entrada: unknown) => {
      firmaDelEspejo = firma;
      espejo.set(clave, structuredClone(entrada));
    };
    const entrada = demoLayout();
    new CalculadorIncremental(undefined, copiar).calcular(entrada, 'test');
    expect(espejo.size).toBe(4);

    // Se edita el ultimo elemento, se toca Generar y se detiene: el worker se descarta sin terminar.
    // El worker nuevo arranca sembrado y, al volver a Generar, solo reconstruye el elemento editado.
    const nuevo = new CalculadorIncremental();
    nuevo.sembrar(firmaDelEspejo, [...espejo] as never);
    const editada = conAjustes(entrada, 3, { RadioDelDiveLoop: 0.47 });
    const incremental = nuevo.calcular(editada, 'test');
    expect(nuevo.estadistica).toEqual({ reutilizados: 3, recalculados: 1, interferenciasRehechas: 0 });
    expect(sinFecha(incremental)).toStrictEqual(sinFecha(calcularLayout(editada, 'test')));
  }, 120000);

  it('la cache tiene tope: el diseno actual mas ENTRADAS_EXTRA_EN_CACHE', () => {
    const calculador = new CalculadorIncremental(1);
    const parametros = { ...ParametrosPorDefecto(), PasoGeneracion: 0.01, PasoSimulacion: 0.01 };
    const entrada: EntradaDeDiseno = { parametros, posicion: [0, 0, 1], tangente: [1, 0, 0], arriba: [0, 0, 1], velocidad: 5, secuencia: instanciasDesdeTipos(['LoopVertical', 'Helice']) };
    calculador.calcular(entrada, 'test');
    calculador.calcular(conAjustes(entrada, 1, { RadioDeLaHelice: 0.65 }), 'test');
    calculador.calcular(conAjustes(entrada, 1, { RadioDeLaHelice: 0.6 }), 'test');
    expect(calculador.tamanoDeCache).toBe(3);
  }, 120000);
});

describe('claveExacta', () => {
  it('distingue numeros que difieren en el ultimo bit, -0 de 0 y NaN de Infinity', () => {
    expect(claveExacta(0.1 + 0.2)).not.toBe(claveExacta(0.3));
    expect(claveExacta(-0)).not.toBe(claveExacta(0));
    expect(claveExacta(NaN)).not.toBe(claveExacta(Infinity));
    expect(claveExacta(null)).not.toBe(claveExacta(NaN));
  });

  it('no depende del orden de las claves de un objeto', () => {
    expect(claveExacta({ a: 1, b: [2, 3] })).toBe(claveExacta({ b: [2, 3], a: 1 }));
    expect(claveExacta(Float64Array.from([1, 2]))).toBe(claveExacta([1, 2]));
  });
});
