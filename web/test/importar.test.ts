// Importar (nucleo/importar.ts): los dos formatos que se aceptan y, sobre
// todo, que cada fallo tenga un mensaje concreto y no un banner generico.

import { describe, expect, it } from 'vitest';
import { instanciasDesdeTipos, type EntradaDeDiseno } from '../src/nucleo/calcular';
import { textoDeParametros } from '../src/nucleo/descargar';
import { importarDiseno } from '../src/nucleo/importar';
import { ParametrosPorDefecto } from '../src/nucleo/parametros';
import { serializarDiseno } from '../src/nucleo/serializar';
import { cargarGolden } from './arnes';

const golden = cargarGolden('circuito-demolayout');

function disenoDePrueba(): EntradaDeDiseno {
  return {
    parametros: { ...ParametrosPorDefecto(), RadioDelLoop: 0.3 },
    posicion: [0, 0, 1], tangente: [1, 0, 0], arriba: [0, 0, 1], velocidad: 4.5,
    secuencia: [
      { id: 'e1', tipo: 'LoopVertical', ajustes: {} },
      { id: 'e2', tipo: 'Helice', ajustes: { RadioDeLaHelice: 0.5 } },
    ],
  };
}

describe('los dos formatos', () => {
  it('el .json de solo parametros vuelve exacto', () => {
    const diseno = disenoDePrueba();
    const { diseno: vuelta, formato } = importarDiseno(textoDeParametros(diseno));
    expect(formato).toBe('parametros');
    expect(vuelta).toEqual(diseno);
  });

  it('un layout completo del contrato se reconstruye como diseno', () => {
    const { diseno, formato } = importarDiseno(JSON.stringify(golden));
    expect(formato).toBe('layout');
    expect(diseno.secuencia.map((i) => i.tipo)).toEqual(golden.elementos.map((e) => e.tipo));
    expect(diseno.parametros.RadioDelLoop).toBe(golden.parametros.valores.radioDelLoop);
    expect(diseno.velocidad).toBe(golden.estadoInicial.velocidad);
    // Y serializa a lo mismo que el .json de parametros de ese caso.
    expect(serializarDiseno(diseno).s.map((i) => i.t)).toEqual(golden.elementos.map((e) => e.tipo));
  });
});

describe('mensajes de error concretos', () => {
  it('JSON invalido: dice que no es JSON y por que', () => {
    expect(() => importarDiseno('{ "v": 1, ', 'parametros.json')).toThrowError(/^parametros\.json no es JSON válido: /);
  });

  it('no es un objeto', () => {
    expect(() => importarDiseno('[1, 2, 3]', 'lista.json')).toThrowError(/lista\.json no es un objeto JSON: arranca con una lista/);
  });

  it('layout con MAJOR incompatible: el mensaje del contrato', () => {
    const otro = { ...golden, meta: { ...golden.meta, versionContrato: '2.0.0' } };
    expect(() => importarDiseno(JSON.stringify(otro), 'layout.json')).toThrowError(/versión 2\.0\.0 del contrato y esta página entiende la 1\.x\.x/);
  });

  it('parametro desconocido: dice cual y que revisar', () => {
    const d = serializarDiseno(disenoDePrueba()) as unknown as Record<string, unknown>;
    (d.p as Record<string, unknown>).RadioHelice = 0.5;
    expect(() => importarDiseno(JSON.stringify(d), 'mio.json')).toThrowError(/p\.RadioHelice no existe en ParametrosPorDefecto\(\)/);
  });

  it('tipo de elemento desconocido: dice cual y lista los validos', () => {
    const d = serializarDiseno(disenoDePrueba());
    d.s[1]!.t = 'LoopInvertido';
    expect(() => importarDiseno(JSON.stringify(d), 'mio.json')).toThrowError(/s\[1\]\.t vale "LoopInvertido" y tiene que ser un tipo de CATALOGO_DE_ELEMENTOS: LoopVertical, DiveLoop, Helice, OverBankedTurn/);
  });

  it('valor de forma equivocada: dice que se esperaba', () => {
    const d = serializarDiseno(disenoDePrueba()) as unknown as Record<string, unknown>;
    (d.p as Record<string, unknown>).RadioDelLoop = 'grande';
    expect(() => importarDiseno(JSON.stringify(d))).toThrowError(/p\.RadioDelLoop vale "grande" y se esperaba un numero finito/);
  });

  it('version del formato desconocida', () => {
    const d = { ...serializarDiseno(disenoDePrueba()), v: 7 };
    expect(() => importarDiseno(JSON.stringify(d), 'viejo.json')).toThrowError(/tiene v = 7 y esta version del visualizador entiende v = 1/);
  });

  it('un layout sin elementos o sin parametros.valores', () => {
    expect(() => importarDiseno(JSON.stringify({ ...golden, elementos: [] }), 'vacio.json')).toThrowError(/no trae elementos/);
    expect(() => importarDiseno(JSON.stringify({ ...golden, parametros: {} }), 'raro.json')).toThrowError(/le falta parametros\.valores/);
  });

  it('un JSON que no es ninguno de los dos formatos: dice que claves tiene y que se esperaba', () => {
    const mensaje = /no es ninguno de los dos formatos que se importan\. Sus claves son: nombre, valor\..*v, p, ei y s.*meta, parametros, estadoInicial y elementos/s;
    expect(() => importarDiseno('{"nombre": "x", "valor": 2}', 'otro.json')).toThrowError(mensaje);
  });
});
