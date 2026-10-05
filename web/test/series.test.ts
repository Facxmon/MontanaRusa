import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analizarLayout } from '../src/contrato/cargar';
import {
  acompanantesDe,
  columna,
  curvaDelRecorrido,
  figurasDeDuracion,
  esSobreElRecorrido,
  estadisticaDeRango,
  extraerColumnas,
  figurasDePestana,
  indiceDeNodo,
  iniciosDeElemento,
  nodoGlobalDe,
  sinHuecosEnX,
  ubicacionDeNodo,
  PESTANAS,
} from '../src/graficos/series';

const cargar = (caso: string) =>
  analizarLayout(readFileSync(fileURLToPath(new URL(`../../golden/${caso}.json`, import.meta.url)), 'utf8'));
const circuito = cargar('circuito-demolayout');

const creciente = (xs: (number | null)[]) => xs.every((v, i) => i === 0 || (v !== null && xs[i - 1] !== null && v > xs[i - 1]!));

describe('extraerColumnas', () => {
  it('sobre el layout entero descarta los nodos repetidos y acumula el tiempo', () => {
    const c = extraerColumnas(circuito, null);
    const total = circuito.elementos.reduce((s, e) => s + e.nodos.numeroDeNodos, 0);
    expect(c.cantidad).toBe(total - 3);
    expect(creciente(c.x.arco)).toBe(true);
    expect(creciente(c.x.tiempo)).toBe(true);
    expect(creciente(c.x.tiempoPrototipo)).toBe(true);
    const ultimo = c.x.tiempo[c.cantidad - 1]!;
    expect(ultimo).toBeCloseTo(circuito.resumenLayout.tiempoTotal!, 3);
    expect(c.franjas.arco.map((f) => f.etiqueta)).toEqual(['1. LoopVertical', '2. OverBankedTurn', '3. Helice', '4. DiveLoop']);
  });

  it('sobre un elemento usa todos sus nodos y sus subtramos como franjas', () => {
    const c = extraerColumnas(circuito, 1);
    expect(c.cantidad).toBe(circuito.elementos[1]!.nodos.numeroDeNodos);
    expect(c.x.tiempo[0]).toBe(0);
    expect(c.franjas.arco.map((f) => f.etiqueta)).toEqual(circuito.elementos[1]!.subtramos.map((s) => s.nombre));
  });

  it('el tiempo del prototipo es el del modelo por sqrt(lambda)', () => {
    const c = extraerColumnas(circuito, 0);
    const factor = Math.sqrt(circuito.elementos[0]!.resumen.lambdaLoop!);
    expect(c.x.tiempoPrototipo[100]).toBeCloseTo(c.x.tiempo[100]! * factor, 5); // lambdaLoop y factorTiempo vienen redondeados a 6 cifras
  });

  it('columna respeta los null', () => {
    const conNull = structuredClone(circuito);
    conNull.elementos[2]!.nodos.gz[7] = null;
    const c = extraerColumnas(conNull, 2);
    expect(columna(c, 'gz')[7]).toBeNull();
    expect(columna(c, 'gz')[8]).toBe(circuito.elementos[2]!.nodos.gz[8]);
  });
});

describe('figurasDePestana', () => {
  it('toda figura tiene series del largo de x, sin NaN en x', () => {
    for (const elegido of [null, 0, 3]) {
      const c = extraerColumnas(circuito, elegido);
      for (const ejeX of ['arco', 'tiempo', 'tiempoPrototipo'] as const) {
        for (const { clave } of PESTANAS.filter((p) => esSobreElRecorrido(p.clave))) {
          for (const figura of figurasDePestana(clave, c, ejeX)) {
            expect(figura.x.length).toBe(c.cantidad);
            expect(figura.x.every((v) => Number.isFinite(v))).toBe(true);
            for (const s of figura.series) expect(s.valores.length, `${clave}/${s.etiqueta}`).toBe(figura.x.length);
          }
        }
      }
    }
  });

  it('en G el limite aplicable de Gz queda dentro de la tabla y por encima del evento largo', () => {
    const c = extraerColumnas(circuito, 0);
    const gz = figurasDePestana('g', c, 'arco')[2]!;
    const aplicable = gz.series.find((s) => s.etiqueta.startsWith('Límite aplicable'))!.valores;
    const largo = gz.series.find((s) => s.etiqueta.startsWith('Admisible'))!.valores;
    const definidos = aplicable.filter((v): v is number => v !== null);
    expect(definidos.length).toBeGreaterThan(0);
    for (const v of definidos) {
      expect(v).toBeGreaterThanOrEqual(largo[0]! - 1e-12);
      expect(v).toBeLessThanOrEqual(6);
    }
  });

  it('el jerk contra tiempo del prototipo va dividido por sqrt(lambda) y contra la norma literal', () => {
    const c = extraerColumnas(circuito, 0);
    const modelo = figurasDePestana('jerk', c, 'arco')[2]!;
    const prototipo = figurasDePestana('jerk', c, 'tiempoPrototipo')[2]!;
    const factor = Math.sqrt(circuito.elementos[0]!.resumen.lambdaLoop!);
    expect(prototipo.series[0]!.valores[500]).toBeCloseTo(modelo.series[0]!.valores[500]! / factor, 4);
    expect(prototipo.series[1]!.valores[0]).toBe(15);
    expect(modelo.series[1]!.valores[0]).toBeCloseTo(15 * factor, 3);
  });

  it('la aceleracion normal es v^2 * kappa de la heartline, en m/s^2', () => {
    const c = extraerColumnas(circuito, 0);
    const figura = figurasDePestana('cinematica', c, 'arco').find((f) => f.clave === 'aceleracionNormal')!;
    expect(figura.etiquetaY).toBe('a_n [m/s²]');
    const v = columna(c, 'velocidad');
    const k = columna(c, 'curvatura');
    for (const i of [0, 250, 700]) expect(figura.series[0]!.valores[i]).toBeCloseTo(v[i]! ** 2 * k[i]!, 12);
  });

  it('arco y altura van contra el tiempo: del modelo si el eje elegido es el arco', () => {
    const c = extraerColumnas(circuito, null);
    for (const [ejeX, eje] of [['arco', 'tiempo'], ['tiempo', 'tiempo'], ['tiempoPrototipo', 'tiempoPrototipo']] as const) {
      const figuras = figurasDePestana('cinematica', c, ejeX);
      for (const clave of ['arcoContraTiempo', 'alturaContraTiempo']) {
        const f = figuras.find((d) => d.clave === clave)!;
        expect(f.x).toEqual(c.x[eje]);
        // Con otra abscisa que el resto de la pestana, el cursor de uPlot va aparte.
        expect(f.grupoDeCursor).toBe(ejeX === 'arco' ? 'tiempo' : undefined);
      }
    }
    const arco = figurasDePestana('cinematica', c, 'tiempo').find((d) => d.clave === 'arcoContraTiempo')!;
    expect(arco.series[0]!.valores).toEqual(c.x.arco);
    const altura = figurasDePestana('cinematica', c, 'tiempo').find((d) => d.clave === 'alturaContraTiempo')!;
    expect(altura.series.map((s) => s.valores[10])).toEqual([columna(c, 'z')[10], columna(c, 'zRiel')[10]]);
  });

  it('sinHuecosEnX saca los nodos con tiempo null (despues de una parada)', () => {
    const figura = sinHuecosEnX({
      titulo: '',
      etiquetaX: '',
      etiquetaY: '',
      x: [0, 1, null as unknown as number, 3],
      decimales: 2,
      decimalesX: 3,
      series: [{ etiqueta: 'a', valores: [1, 2, 3, 4], color: 'serie1' }],
      franjas: [],
    });
    expect(figura.x).toEqual([0, 1, 3]);
    expect(figura.series[0]!.valores).toEqual([1, 2, 4]);
  });
});

describe('nodos globales: el estado que comparten graficos, via 3D y reproductor', () => {
  it('el indice global coincide con el de aplanarNodos (contrato, seccion 6)', () => {
    const inicios = iniciosDeElemento(circuito);
    expect(inicios[0]).toBe(0);
    circuito.elementos.forEach((e, i) => {
      // El nodo 0 de un elemento es el ultimo del anterior: mismo indice global.
      if (i > 0) expect(nodoGlobalDe(circuito, i, 0)).toBe(nodoGlobalDe(circuito, i - 1, circuito.elementos[i - 1]!.nodos.numeroDeNodos - 1));
      expect(nodoGlobalDe(circuito, i, 0)).toBe(inicios[i]! - (i > 0 ? 1 : 0));
    });
  });

  it('ubicacionDeNodo es la inversa de nodoGlobalDe', () => {
    circuito.elementos.forEach((e, i) => {
      for (const local of [1, 5, e.nodos.numeroDeNodos - 1]) {
        const global = nodoGlobalDe(circuito, i, local);
        expect(ubicacionDeNodo(circuito, global), `${i}/${local}`).toMatchObject({ elemento: i, nodoLocal: local });
      }
    });
  });

  it('cada nodo global cae en un subtramo del elemento', () => {
    const u = ubicacionDeNodo(circuito, nodoGlobalDe(circuito, 2, 10));
    expect(u?.subtramo).toBeTruthy();
  });

  it('las columnas traen un nodo global por punto, creciente, y se puede buscar', () => {
    const c = extraerColumnas(circuito, null);
    expect(c.nodos.length).toBe(c.cantidad);
    expect(c.nodos[0]).toBe(0);
    for (let i = 1; i < c.nodos.length; i++) expect(c.nodos[i]!).toBeGreaterThan(c.nodos[i - 1]!);
    expect(indiceDeNodo(c.nodos, c.nodos[123]!)).toBe(123);
    expect(indiceDeNodo(c.nodos, -1)).toBeNull();
  });

  it('las figuras llevan el indice global filtrado igual que la x', () => {
    for (const pestana of PESTANAS.filter((p) => esSobreElRecorrido(p.clave))) {
      const c = extraerColumnas(circuito, 1);
      for (const figura of figurasDePestana(pestana.clave, c, 'tiempo')) {
        expect(figura.nodos?.length, pestana.clave).toBe(figura.x.length);
      }
    }
  });
});

describe('estadisticaDeRango', () => {
  const c = extraerColumnas(circuito, null);
  const [figura] = figurasDePestana('cinematica', c, 'arco');

  it('el rango completo da el maximo, el minimo y el promedio de la serie entera', () => {
    const x = figura!.x as number[];
    const [velocidad] = estadisticaDeRango(figura!, x[0]!, x[x.length - 1]!);
    const valores = figura!.series[0]!.valores.filter((v): v is number => v !== null);
    expect(velocidad!.maximo).toBeCloseTo(Math.max(...valores), 12);
    expect(velocidad!.minimo).toBeCloseTo(Math.min(...valores), 12);
    expect(velocidad!.promedio).toBeCloseTo(valores.reduce((a, b) => a + b, 0) / valores.length, 12);
    expect(velocidad!.cantidad).toBe(valores.length);
  });

  it('dice DONDE ocurre el maximo, que es lo que se quiere saber de un pico', () => {
    const x = figura!.x as number[];
    const [velocidad] = estadisticaDeRango(figura!, x[0]!, x[x.length - 1]!);
    const donde = figura!.series[0]!.valores.indexOf(velocidad!.maximo);
    expect(velocidad!.xDelMaximo).toBe(x[donde]);
  });

  it('un rango vacio no inventa numeros', () => {
    const [velocidad] = estadisticaDeRango(figura!, -100, -99);
    expect(velocidad).toMatchObject({ maximo: null, minimo: null, promedio: null, cantidad: 0 });
  });

  it('no lista las series ocultas en la leyenda', () => {
    const [g] = figurasDePestana('g', c, 'arco');
    const visibles = g!.series.filter((s) => !s.ocultarEnLeyenda).length;
    expect(estadisticaDeRango(g!, 0, 1).length).toBe(visibles);
  });
});

describe('toggles de las lineas de limite (cada uno controla solo sus lineas)', () => {
  it('la mitad inferior de cada referencia acompana a su superior y a ninguna otra', () => {
    const c = extraerColumnas(circuito, null);
    for (const pestana of ['g', 'jerk'] as const) {
      for (const f of figurasDePestana(pestana, c, 'tiempo')) {
        f.series.forEach((s, i) => {
          if (!s.ocultarEnLeyenda) return;
          // Toda serie oculta en la leyenda tiene un lider visible, y es una sola.
          expect(s.acompanaA, `${f.titulo}: ${s.etiqueta}`).toBeDefined();
          const lider = f.series[s.acompanaA!]!;
          expect(lider.ocultarEnLeyenda).toBeFalsy();
          expect(acompanantesDe(f.series, s.acompanaA!)).toContain(i);
        });
      }
    }
    const [, , gz] = figurasDePestana('g', c, 'tiempo');
    const indice = (etiqueta: string) => gz!.series.findIndex((s) => s.etiqueta === etiqueta);
    // El limite de 200 ms y el aplicable no se mezclan.
    expect(acompanantesDe(gz!.series, indice('Límite a 200 ms')).map((j) => gz!.series[j]!.etiqueta)).toEqual(['200 ms, inferior']);
    expect(acompanantesDe(gz!.series, indice('Límite aplicable (duración del evento sostenido)')).map((j) => gz!.series[j]!.etiqueta)).toEqual(['aplicable, inferior']);
    expect(acompanantesDe(gz!.series, indice('Admisible dure lo que dure (evento largo)')).map((j) => gz!.series[j]!.etiqueta)).toEqual(['evento largo, inferior']);
    expect(acompanantesDe(gz!.series, 0)).toEqual([]);
  });
});

describe('G contra duracion sostenida (Figs. 6-10)', () => {
  it('cinco figuras (+Gz, -Gz, Gy, +Gx, -Gx) con la curva de la norma, la del recorrido y el punto critico', () => {
    const figuras = figurasDeDuracion(extraerColumnas(circuito, null));
    expect(figuras.map((f) => f.clave)).toEqual(['duracion-masgz', 'duracion-menosgz', 'duracion-gy', 'duracion-masgx', 'duracion-menosgx']);
    for (const f of figuras) {
      for (let i = 1; i < f.x.length; i++) expect(f.x[i]!).toBeGreaterThanOrEqual(f.x[i - 1]!);
      for (const s of f.series) expect(s.valores.length).toBe(f.x.length);
      // Nada por debajo de 0.2 s: los eventos mas cortos se llevan a 0.2 s.
      expect(Math.min(...f.x)).toBeCloseTo(0.2, 12);
      expect(f.nodos).toBeUndefined();
    }
    // +Gz: la curva de la norma arranca en 6 G a 0.2 s y el critico es el pico del loop contra 6 G.
    const masGz = figuras[0]!;
    const norma = masGz.series[0]!.valores;
    expect(norma[masGz.x.indexOf(0.2)]).toBe(6);
    const critico = masGz.series.find((s) => s.puntos)!;
    expect(critico.etiqueta).toMatch(/^Punto crítico: 6\.42 G a 0\.20 s, límite 6\.00 G, margen -0\.42 G$/);
    // -Gz va con signo, como la Fig. 9.
    expect(figuras[1]!.series[0]!.valores.filter((v): v is number => v !== null).every((v) => v < 0)).toBe(true);
  });

  it('la curva del recorrido es la duracion del evento MAS LARGO a cada nivel, de corrido en el layout', () => {
    // Meseta de 1.5 G partida en dos tramos del layout: a 1.5 G el evento dura 4 s.
    const t = Array.from({ length: 401 }, (_, i) => i * 0.01);
    const h = t.map((x) => (x < 0.5 ? 1 : 1.5));
    const { puntos, critico } = curvaDelRecorrido(h, t, [0, 400], 'MasGzTodas', null, 3);
    expect(puntos.map((p) => p.nivel)).toEqual([0.5, 1, 1.5]);
    expect(puntos[2]!.duracion).toBeCloseTo(3.5, 12);
    expect(puntos[0]!.duracion).toBeCloseTo(4, 12);
    expect(critico!.nivel).toBe(1.5);
    expect(critico!.limite).toBe(4);
  });

  it('con un elemento elegido se consideran los eventos que tocan sus nodos', () => {
    const figuras = figurasDeDuracion(extraerColumnas(circuito, 2));
    expect(figuras[0]!.series.find((s) => s.puntos)!.etiqueta).not.toMatch(/6\.42/);
  });
});
