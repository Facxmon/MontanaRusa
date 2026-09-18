import { describe, expect, it } from 'vitest';
import { formatear, formatearNumero } from '../src/paneles/formato';

describe('formatearNumero', () => {
  it('usa 4 cifras significativas y saca ceros de mas', () => {
    expect(formatearNumero(3.14159)).toBe('3.142');
    expect(formatearNumero(0.0012346)).toBe('0.001235'); // 0.0012345 en binario cae por debajo y redondea a 0.001234
    expect(formatearNumero(1234.5678)).toBe('1235');
    expect(formatearNumero(2)).toBe('2');
    expect(formatearNumero(0)).toBe('0');
  });

  it('pasa a notacion cientifica lo muy chico o muy grande', () => {
    expect(formatearNumero(1.5e-7)).toBe('1.5e-7');
    expect(formatearNumero(2.5e7)).toBe('2.5e+7');
  });
});

describe('formatear', () => {
  it('null es un guion largo', () => {
    expect(formatear(null, 'm')).toBe('—');
  });

  it('los radianes se muestran en grados', () => {
    expect(formatear(Math.PI, 'rad')).toBe('180°');
    expect(formatear(-Math.PI / 2, 'rad')).toBe('-90°');
  });

  it('las demas unidades van con un espacio', () => {
    expect(formatear(0.0012346, 'm')).toBe('0.001235 m');
    expect(formatear(5.95, 'G')).toBe('5.95 G');
  });

  it('adimensional ("-") no lleva unidad', () => {
    expect(formatear(0.825, '-')).toBe('0.825');
  });
});
