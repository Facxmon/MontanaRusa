// De un mensaje del nucleo a que campo resaltar (diagnostico.ts). Los
// mensajes de prueba son los literales del nucleo, no inventados: si
// alguno cambia y deja de nombrar el parametro, el test lo dice.

import { describe, expect, it } from 'vitest';
import { diagnosticar, parametrosMencionados } from '../src/diagnostico';
import { calcularLayout, ErrorDeElemento, instanciasDesdeTipos } from '../src/nucleo/calcular';
import { ParametrosPorDefecto } from '../src/nucleo/parametros';

describe('parametrosMencionados', () => {
  it('encuentra el parametro que nombra el mensaje', () => {
    expect(parametrosMencionados("PuntoDeVerificacionNormativa tiene que ser 'Heartline' o 'Cabeza', no 'Rodilla'.")).toEqual(['PuntoDeVerificacionNormativa']);
  });

  it('los mensajes del modo nombran el valor y no el parametro: igual marcan ModoCurvatura', () => {
    expect(parametrosMencionados('El modo GNormativaMaxima pide +Gz pero la curvatura forma 90 grados con el eje arriba del carro.')).toEqual(['ModoCurvatura']);
    expect(parametrosMencionados('Modo de curvatura no reconocido: Raro. Los modos son: AceleracionNormalConstante, Clotoide, FuerzaGConstante, GNormativaMaxima.')).toEqual(['ModoCurvatura']);
    // El valor tiene que estar completo, como los nombres.
    expect(parametrosMencionados('ClotoideDoble no existe')).toEqual([]);
  });

  it('devuelve varios en el orden en que aparecen, sin repetir', () => {
    const mensaje = 'FactorDeSeguridadNormativo y SemianchoDeSuavizadoNormativo se usan juntos; FactorDeSeguridadNormativo tiene que ser mayor que 0.';
    expect(parametrosMencionados(mensaje)).toEqual(['FactorDeSeguridadNormativo', 'SemianchoDeSuavizadoNormativo']);
    // Con el nombre del modo adelante, ModoCurvatura va primero (aparece antes).
    expect(parametrosMencionados(`El modo GNormativaMaxima usa ${mensaje}`)).toEqual(['ModoCurvatura', 'FactorDeSeguridadNormativo', 'SemianchoDeSuavizadoNormativo']);
  });

  it('no marca nada cuando el mensaje no nombra ningun parametro', () => {
    expect(parametrosMencionados('La secuencia no tiene elementos: agregar al menos uno.')).toEqual([]);
    expect(parametrosMencionados('')).toEqual([]);
  });

  it('exige el nombre completo: no confunde un parametro con otro mas largo que lo contiene', () => {
    expect(parametrosMencionados('RadioDelLoopDeMentira anda mal')).toEqual([]);
    expect(parametrosMencionados('elRadioDelLoop')).toEqual([]);
    expect(parametrosMencionados('el RadioDelLoop, sí')).toEqual(['RadioDelLoop']);
  });

  it('el mensaje real de un calculo que falla nombra el parametro que hay que tocar', () => {
    const parametros = ParametrosPorDefecto();
    parametros.PasoGeneracion = 0.01;
    parametros.PasoSimulacion = 0.01;
    parametros.PuntoDeVerificacionNormativa = 'Rodilla' as never;
    let error: unknown;
    try {
      calcularLayout({ parametros, posicion: [0, 0, 1], tangente: [1, 0, 0], arriba: [0, 0, 1], velocidad: 5, secuencia: instanciasDesdeTipos(['LoopVertical']) }, 'test');
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ErrorDeElemento);
    const d = diagnosticar((error as Error).message, 'e1');
    expect(d.parametros).toContain('PuntoDeVerificacionNormativa');
    expect(d.instancia).toBe('e1');
    expect(d.mensaje).toBe((error as Error).message);
  });
});
