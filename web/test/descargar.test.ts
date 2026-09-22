// Los textos que se guardan a archivo (nucleo/descargar.ts): el CSV de
// series, el LEEME del paquete y el .json de solo parametros.

import { describe, expect, it } from 'vitest';
import { instanciasDesdeTipos, type EntradaDeDiseno } from '../src/nucleo/calcular';
import { COLUMNAS_DEL_CSV, csvDeFigura, csvDeSeries, textoDeParametros, textoDelLayout, textoLeeme } from '../src/nucleo/descargar';
import { extraerColumnas, figurasDePestana } from '../src/graficos/series';
import { ParametrosPorDefecto } from '../src/nucleo/parametros';
import { deserializarDiseno } from '../src/nucleo/serializar';
import { cargarGolden } from './arnes';

const golden = cargarGolden('circuito-demolayout');

describe('csvDeSeries', () => {
  const csv = csvDeSeries(golden);
  const lineas = csv.trimEnd().split('\n');
  const cabecera = lineas[0]!.split(',');
  const indice = (columna: string) => cabecera.indexOf(columna);

  it('la cabecera es la del contrato, con los versores por componente', () => {
    expect(cabecera).toEqual(COLUMNAS_DEL_CSV);
    expect(cabecera.slice(0, 4)).toEqual(['elemento', 'tipo', 'nodo', 'tiempoAcumulado']);
    expect(cabecera).toContain('gz');
    expect(cabecera.slice(-3)).toEqual(['lx', 'ly', 'lz']);
  });

  it('una fila por nodo de cada elemento, todas del mismo ancho', () => {
    const nodos = golden.elementos.reduce((suma, e) => suma + e.nodos.numeroDeNodos, 0);
    expect(lineas.length - 1).toBe(nodos);
    for (const linea of lineas) expect(linea.split(',').length).toBe(cabecera.length);
  });

  it('los valores son los del layout, a 6 cifras, y el tiempo acumulado suma los elementos anteriores', () => {
    const primera = lineas[1]!.split(',');
    expect(primera[0]).toBe('1');
    expect(primera[1]).toBe(golden.elementos[0]!.tipo);
    expect(Number(primera[indice('gz')])).toBeCloseTo(golden.elementos[0]!.nodos.gz[0] as number, 9);
    // Primer nodo del segundo elemento: tiempo local 0, acumulado = duracion del primero.
    const inicioDelSegundo = 1 + golden.elementos[0]!.nodos.numeroDeNodos;
    const fila = lineas[inicioDelSegundo]!.split(',');
    expect(fila[0]).toBe('2');
    expect(Number(fila[indice('tiempo')])).toBe(0);
    expect(Number(fila[indice('tiempoAcumulado')])).toBeCloseTo(golden.elementos[0]!.resumen.tiempoDeRecorrido as number, 6);
    const versor = golden.elementos[0]!.nodos.versorTangente[0] as number[];
    expect(Number(primera[indice('tx')])).toBeCloseTo(versor[0]!, 9);
  });

  it('las columnas que el layout no trae quedan vacias, nunca "null" ni "NaN"', () => {
    expect(csv).not.toContain('NaN');
    expect(csv).not.toContain('null');
    expect(csv).not.toContain('undefined');
  });
});

describe('textoLeeme', () => {
  it('trae fecha, version del contrato, generador, caso de origen y los archivos', () => {
    const texto = textoLeeme({
      layout: golden,
      origen: 'circuito-demolayout',
      fecha: new Date('2026-09-20T12:00:00Z'),
      archivos: ['layout.json', 'series.csv'],
    });
    expect(texto).toContain('2026-09-20T12:00:00.000Z');
    expect(texto).toContain(`Version del contrato: ${golden.meta.versionContrato}`);
    expect(texto).toContain('Caso de origen: circuito-demolayout');
    expect(texto).toContain('1. LoopVertical');
    expect(texto).toContain('  layout.json');
    expect(texto).toContain('  series.csv');
    expect(texto).toContain('longitud: m');
  });

  it('sin origen dice que es un diseno propio', () => {
    expect(textoLeeme({ layout: golden, origen: null, fecha: new Date(), archivos: [] })).toContain('Caso de origen: diseno propio');
  });
});

describe('textoDeParametros', () => {
  const diseno: EntradaDeDiseno = {
    parametros: { ...ParametrosPorDefecto(), RadioDelLoop: 0.3 },
    posicion: [0, 0, 1], tangente: [1, 0, 0], arriba: [0, 0, 1], velocidad: 4.5,
    secuencia: instanciasDesdeTipos(['LoopVertical', 'Helice']),
  };

  it('es el diseno serializado, legible, y vuelve exacto', () => {
    const texto = textoDeParametros(diseno);
    expect(texto).toContain('\n  "v": 1');
    expect(deserializarDiseno(JSON.parse(texto))).toEqual(diseno);
    expect(texto.length).toBeLessThan(2000);
  });
});

describe('textoDelLayout', () => {
  it('sigue siendo el contrato entero redondeado, en una linea', () => {
    const texto = textoDelLayout(golden);
    expect(texto.trimEnd().split('\n')).toHaveLength(1);
    expect(JSON.parse(texto).meta.versionContrato).toBe(golden.meta.versionContrato);
  });
});

describe('csvDeFigura', () => {
  const columnas = extraerColumnas(golden, null);
  const [figura] = figurasDePestana('cinematica', columnas, 'arco');
  const csv = csvDeFigura(figura!);
  const lineas = csv.trimEnd().split('\n');

  it('la cabecera es el eje x mas las series visibles, entrecomilladas', () => {
    const visibles = figura!.series.filter((s) => !s.ocultarEnLeyenda);
    expect(lineas[0]).toBe([figura!.etiquetaX, ...visibles.map((s) => s.etiqueta)].map((t) => `"${t}"`).join(','));
  });

  it('una fila por punto de la figura', () => {
    expect(lineas.length).toBe(figura!.x.length + 1);
  });

  it('la primera fila son los valores del primer punto', () => {
    const celdas = lineas[1]!.split(',');
    expect(Number(celdas[0])).toBeCloseTo(figura!.x[0] as number, 5);
    expect(Number(celdas[1])).toBeCloseTo(figura!.series[0]!.valores[0] as number, 5);
  });

  it('las series ocultas (bordes de banda, referencias repetidas) no van', () => {
    const [g] = figurasDePestana('g', columnas, 'arco');
    const visibles = g!.series.filter((s) => !s.ocultarEnLeyenda).length;
    expect(csvDeFigura(g!).split('\n')[0]!.split('","').length).toBe(visibles + 1);
  });
});
