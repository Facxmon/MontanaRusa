import { describe, expect, it } from 'vitest';
import { MAGNITUDES } from '../src/contrato/magnitudes';
import { decimalesDeUnidad, formatear, formatearMagnitud, formatearNumero, numeroDeMagnitud, SIN_DATO } from '../src/paneles/formato';

describe('formatearNumero', () => {
  it('usa decimales fijos y conserva los ceros a la derecha', () => {
    expect(formatearNumero(3.14159, 2)).toBe('3.14');
    expect(formatearNumero(1, 2)).toBe('1.00');
    expect(formatearNumero(0.0002815, 2)).toBe('0.00');
    expect(formatearNumero(1234.5678, 3)).toBe('1234.568');
    expect(formatearNumero(0, 1)).toBe('0.0');
  });

  it('un cero negativo se muestra sin signo', () => {
    expect(formatearNumero(-0.0001, 2)).toBe('0.00');
    expect(formatearNumero(-0, 2)).toBe('0.00');
  });

  it('el signo menos se conserva en los negativos', () => {
    expect(formatearNumero(-1.352, 2)).toBe('-1.35');
  });

  it('la notacion cientifica solo aparece desde 1e4', () => {
    expect(formatearNumero(1234.5, 3, 'cientifica')).toBe('1234.500');
    expect(formatearNumero(25000, 3, 'cientifica')).toBe('2.500e4');
    expect(formatearNumero(-1.5e7, 2, 'cientifica')).toBe('-1.50e7');
  });

  it('lo no finito es sin dato', () => {
    expect(formatearNumero(NaN, 2)).toBe(SIN_DATO);
    expect(formatearNumero(Infinity, 2)).toBe(SIN_DATO);
  });
});

describe('formatear', () => {
  it('null es un guion largo', () => {
    expect(formatear(null, 'm')).toBe('—');
    expect(formatear(undefined, 'G')).toBe('—');
  });

  it('los radianes se muestran en grados con un decimal', () => {
    expect(formatear(Math.PI, 'rad')).toBe('180.0°');
    expect(formatear(-Math.PI / 2, 'rad')).toBe('-90.0°');
  });

  it('cada unidad tiene sus decimales y va con un espacio', () => {
    expect(formatear(0.0012346, 'm')).toBe('0.001 m');
    expect(formatear(5.95, 'G')).toBe('5.95 G');
    expect(formatear(4.5, 'm/s')).toBe('4.50 m/s');
    expect(formatear(1.23456, 'm^2')).toBe('1.2346 m^2');
    expect(formatear(4.0674, 's')).toBe('4.067 s');
  });

  it('adimensional ("-") no lleva unidad y tiene 3 decimales', () => {
    expect(formatear(0.825, '-')).toBe('0.825');
    expect(formatear(1, '-')).toBe('1.000');
  });

  it('una unidad desconocida cae en 3 decimales', () => {
    expect(decimalesDeUnidad('kg/m^3')).toBe(3);
  });

  it('acepta decimales explicitos', () => {
    expect(formatear(1.23456, 'm', 1)).toBe('1.2 m');
  });
});

describe('formatearMagnitud', () => {
  it('toda magnitud declara decimales', () => {
    for (const m of MAGNITUDES) expect(Number.isInteger(m.decimales), m.clave).toBe(true);
  });

  it('usa los decimales de la magnitud', () => {
    expect(formatearMagnitud(1, 'gz')).toBe('1.00 G');
    expect(formatearMagnitud(0.0002815, 'gy')).toBe('0.00 G');
    expect(formatearMagnitud(12.34, 'jerkGz')).toBe('12.3 G/s');
    expect(formatearMagnitud(Math.PI / 4, 'anguloRoll')).toBe('45.0°');
    expect(formatearMagnitud(0.123456, 'energiaTotal')).toBe('0.123 J');
    expect(formatearMagnitud(null, 'gz')).toBe('—');
  });

  it('el ancho no cambia entre valores del mismo orden', () => {
    const anchos = new Set([1, 1.5, 0.0002815, 9.99].map((v) => formatearMagnitud(v, 'gz').length));
    expect(anchos.size).toBe(1);
  });
});

describe('numeroDeMagnitud', () => {
  it('es solo el numero, convertido a grados si corresponde', () => {
    expect(numeroDeMagnitud(4.5, 'velocidad')).toBe('4.50');
    expect(numeroDeMagnitud(Math.PI, 'anguloPeralte')).toBe('180.0');
    expect(numeroDeMagnitud(null, 'gz')).toBe('—');
  });
});
