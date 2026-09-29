// Tiempos del recalculo completo (calcularLayout) contra el incremental
// (CalculadorIncremental) al editar un elemento del DemoLayout. Correr con
//   npx vite-node scripts/medir-incremental.ts
// Cada medicion es la mediana de REPETICIONES. El incremental se mide con la
// cache caliente: se calcula el diseno original y despues la edicion, que es
// lo que pasa en el worker al tocar un parametro de una fila.

import { calcularLayout, instanciasDesdeTipos, type EntradaDeDiseno } from '../src/nucleo/calcular';
import { CalculadorIncremental } from '../src/nucleo/calculoIncremental';
import { ParametrosPorDefecto } from '../src/nucleo/parametros';
import type { Parametros } from '../src/nucleo/tipos';

const REPETICIONES = 5;

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

function editar(entrada: EntradaDeDiseno, indice: number, ajustes: Partial<Parametros>): EntradaDeDiseno {
  return { ...entrada, secuencia: entrada.secuencia.map((inst, k) => (k === indice ? { ...inst, ajustes } : inst)) };
}

function mediana(valores: number[]): number {
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.floor(orden.length / 2)]!;
}

function medir(fn: () => void): number {
  const tiempos: number[] = [];
  for (let r = 0; r < REPETICIONES; r++) {
    const inicio = performance.now();
    fn();
    tiempos.push(performance.now() - inicio);
  }
  return mediana(tiempos);
}

const base = demoLayout();
const casos: [string, EntradaDeDiseno][] = [
  ['primero (LoopVertical, RadioDelLoop)', editar(base, 0, { RadioDelLoop: 0.31 })],
  ['medio (OverBankedTurn, RadioDelGiro)', editar(base, 1, { RadioDelGiro: 0.78 })],
  ['medio (Helice, RadioDeLaHelice)', editar(base, 2, { RadioDeLaHelice: 0.68 })],
  ['ultimo (DiveLoop, RadioDelDiveLoop)', editar(base, 3, { RadioDelDiveLoop: 0.47 })],
  ['primero, sin cambiar su salida (AlturaMaximaDelElemento)', editar(base, 0, { AlturaMaximaDelElemento: 0.9 })],
];

calcularLayout(base, 'medicion'); // calentamiento del JIT
console.log(`DemoLayout, mediana de ${REPETICIONES} corridas (ms)`);
console.log('edicion | completo | incremental | reutilizados/recalculados');
for (const [nombre, editada] of casos) {
  const completo = medir(() => calcularLayout(editada, 'medicion'));
  const tiempos: number[] = [];
  let estadistica = '';
  for (let r = 0; r < REPETICIONES; r++) {
    const calculador = new CalculadorIncremental();
    calculador.calcular(base, 'medicion'); // llena la cache; no se cuenta
    const inicio = performance.now();
    calculador.calcular(editada, 'medicion');
    tiempos.push(performance.now() - inicio);
    estadistica = `${calculador.estadistica.reutilizados}/${calculador.estadistica.recalculados}`;
  }
  const incremental = mediana(tiempos);
  console.log(`${nombre} | ${completo.toFixed(0)} | ${incremental.toFixed(0)} | ${estadistica}`);
}

