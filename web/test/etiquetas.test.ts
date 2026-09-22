// El invariante de DISENO.md era "el formulario sale del esquema del JSON, no
// de una lista escrita en la web". etiquetas.ts ES una lista escrita en la
// web, asi que este test la reemplaza: recorre ParametrosPorDefecto() y falla
// si algun parametro no tiene etiqueta. Si el nucleo (o MATLAB) declara uno
// nuevo, aca hay un test rojo y no un bug silencioso en el formulario.

import { describe, expect, it } from 'vitest';
import {
  aPresentacion,
  aSI,
  digitosDeEntrada,
  ETIQUETAS,
  etiquetaDe,
  fueraDelRango,
  modosQueLoConsumen,
  textoConUnidad,
  textoDeEntrada,
} from '../src/paneles/etiquetas';
import { OPCIONES_DE_PARAMETRO, ParametrosPorDefecto } from '../src/nucleo/parametros';
import type { NombreDeParametro } from '../src/nucleo/tipos';

const defaults = ParametrosPorDefecto();
const nombres = Object.keys(defaults) as NombreDeParametro[];

describe('cobertura de etiquetas', () => {
  it('todo parametro de ParametrosPorDefecto tiene entrada en etiquetas.ts', () => {
    const faltan = nombres.filter((nombre) => !ETIQUETAS[nombre]);
    expect(faltan, `sin etiqueta: ${faltan.join(', ')}`).toEqual([]);
  });

  it('etiquetas.ts no declara parametros que el nucleo no tiene', () => {
    const sobran = Object.keys(ETIQUETAS).filter((nombre) => !(nombre in defaults));
    expect(sobran, `etiqueta sin parametro: ${sobran.join(', ')}`).toEqual([]);
  });

  it('todas tienen nombre humano y ayuda no vacia', () => {
    for (const nombre of nombres) {
      const etiqueta = etiquetaDe(nombre);
      expect(etiqueta.nombre.length, nombre).toBeGreaterThan(0);
      expect(etiqueta.ayuda.length, nombre).toBeGreaterThan(0);
    }
  });

  it('ningun nombre humano es el camelCase del parametro', () => {
    for (const nombre of nombres) {
      const camel = nombre[0]!.toLowerCase() + nombre.slice(1);
      expect(etiquetaDe(nombre).nombre, nombre).not.toBe(camel);
    }
  });

  it('los numericos declaran unidad de presentacion y los no numericos no', () => {
    for (const nombre of nombres) {
      const valor = defaults[nombre];
      const esNumerico = typeof valor === 'number' || Array.isArray(valor) || valor === null;
      const tieneUnidad = etiquetaDe(nombre).unidadDePresentacion !== undefined;
      expect(tieneUnidad, nombre).toBe(esNumerico && !OPCIONES_DE_PARAMETRO[nombre]);
    }
  });

  it('la ayuda es la descripcion que ya declara el nucleo', () => {
    // Muestra: si alguien reescribe una descripcion en la web en vez de reusarla, cambia.
    expect(etiquetaDe('RadioDeLaHelice').ayuda).toContain('longitud caracteristica de Froude');
    expect(etiquetaDe('DistanciaHeartlineACabeza').ayuda).toContain('cabeza del pasajero');
    expect(etiquetaDe('MargenDeOnset').ayuda).toContain('margen relativo');
  });
});

describe('unidades de presentacion', () => {
  it('convierte los valores de la consigna', () => {
    const cm = (nombre: NombreDeParametro) => aPresentacion(defaults[nombre] as number, etiquetaDe(nombre).unidadDePresentacion);
    expect(cm('RadioDelLoop')).toBeCloseTo(11, 10);
    expect(cm('RadioDeLaHelice')).toBeCloseTo(70, 10);
    expect(cm('AvanceDeLaHelice')).toBeCloseTo(-30, 10);
    expect(cm('DistanciaHeartlineACabeza')).toBeCloseTo(3, 10);
    expect(cm('PasoGeneracion')).toBeCloseTo(2, 10);
    expect(cm('DiametroRueda')).toBeCloseTo(13.6, 10);
    expect(cm('AreaFrontal')).toBeCloseTo(36, 10);
    expect(cm('Masa')).toBeCloseTo(150, 10);
  });

  it('los parametros del prototipo se quedan en metros', () => {
    for (const nombre of ['RadioDeReferenciaReal', 'LargoCarroReal'] as NombreDeParametro[]) {
      const unidad = etiquetaDe(nombre).unidadDePresentacion!;
      expect(unidad.simbolo, nombre).toBe('m');
      expect(unidad.factor, nombre).toBe(1);
    }
    expect(textoConUnidad(defaults.RadioDeReferenciaReal, etiquetaDe('RadioDeReferenciaReal').unidadDePresentacion)).toBe('8.00 m');
  });

  it('la ida y vuelta a SI es exacta en el valor que se tipea', () => {
    for (const nombre of nombres) {
      const unidad = etiquetaDe(nombre).unidadDePresentacion;
      if (!unidad || typeof defaults[nombre] !== 'number') continue;
      expect(aSI(aPresentacion(1, unidad), unidad), nombre).toBeCloseTo(1, 12);
    }
  });
});

describe('texto del input (bug de redondeo del export)', () => {
  it('el ida y vuelta del redondeo a 6 cifras no se ve', () => {
    // deg2rad(55) exportado a 6 cifras vuelve como 54.99999493...
    const peralteRedondeado = Number((defaults.PeralteDeLaHelice).toPrecision(6));
    const unidad = etiquetaDe('PeralteDeLaHelice').unidadDePresentacion;
    expect(textoDeEntrada(peralteRedondeado, unidad)).toBe('55.0');
    const anguloRedondeado = Number((defaults.AnguloDelGiro).toPrecision(6));
    expect(textoDeEntrada(anguloRedondeado, etiquetaDe('AnguloDelGiro').unidadDePresentacion)).toBe('120.0');
    const peralteGiro = Number((defaults.PeralteDelGiro).toPrecision(6));
    expect(textoDeEntrada(peralteGiro, etiquetaDe('PeralteDelGiro').unidadDePresentacion)).toBe('110.0');
  });

  it('las tolerancias muy chicas caen a exponencial en vez de mostrarse como cero', () => {
    expect(textoDeEntrada(1e-12, etiquetaDe('TolNorma').unidadDePresentacion)).toBe('1e-12');
    expect(textoDeEntrada(1e-8, etiquetaDe('TolPuntoFijo').unidadDePresentacion)).toBe('1e-8');
  });

  it('el cero va sin signo y con los decimales de la unidad', () => {
    expect(textoDeEntrada(0, etiquetaDe('AvanceDelGiro').unidadDePresentacion)).toBe('0.0');
    expect(textoDeEntrada(-0, etiquetaDe('NumeroDeCarros').unidadDePresentacion)).toBe('0');
    // Un valor chico pero NO nulo no se muestra como cero: cae a exponencial.
    expect(textoDeEntrada(-0.00001, etiquetaDe('AvanceDelGiro').unidadDePresentacion)).toBe('-1e-3');
  });

  it('ningun valor por defecto desborda el ancho declarado del input', () => {
    for (const nombre of nombres) {
      const etiqueta = etiquetaDe(nombre);
      if (!etiqueta.unidadDePresentacion) continue;
      const valores = ([] as number[]).concat(defaults[nombre] as never).flat().filter((v) => typeof v === 'number');
      for (const valor of valores) {
        expect(textoDeEntrada(valor, etiqueta.unidadDePresentacion).length, `${nombre} = ${valor}`).toBeLessThanOrEqual(digitosDeEntrada(etiqueta));
      }
    }
  });
});

describe('rango sugerido', () => {
  it('los valores por defecto caen dentro del rango sugerido', () => {
    for (const nombre of nombres) {
      const etiqueta = etiquetaDe(nombre);
      if (!etiqueta.rangoSugerido || typeof defaults[nombre] !== 'number') continue;
      const mostrado = aPresentacion(defaults[nombre] as number, etiqueta.unidadDePresentacion);
      expect(fueraDelRango(mostrado, etiqueta), `${nombre} = ${mostrado}`).toBe(false);
    }
  });

  it('avisa cuando se sale', () => {
    expect(fueraDelRango(4000, etiquetaDe('RadioDeLaHelice'))).toBe(true);
    expect(fueraDelRango(70, etiquetaDe('RadioDeLaHelice'))).toBe(false);
  });
});

describe('de que depende cada parametro', () => {
  it('los del modo dicen en cuales se consumen', () => {
    expect(modosQueLoConsumen('FuerzaGObjetivo')).toEqual(['FuerzaGConstante']);
    expect(modosQueLoConsumen('RadioDeReferencia')).toEqual(['Clotoide']);
    expect(modosQueLoConsumen('RadioDeLaHelice')).toEqual([]);
  });
});

describe('grupo avanzado', () => {
  it('las tolerancias numericas van al grupo solver y los radios no', () => {
    const solver = nombres.filter((n) => etiquetaDe(n).grupo === 'solver');
    expect(solver.sort()).toEqual(
      [
        'MargenDeOnset',
        'MaxIteracionesAjuste',
        'MaxIteracionesCierre',
        'MaxIteracionesPuntoFijo',
        'PasosEntreOrtonormalizaciones',
        'TolCierrePitch',
        'TolNorma',
        'TolPuntoFijo',
        'ToleranciaVelocidadDeDiseno',
        'VersoresEnGrafico3D',
      ].sort(),
    );
  });
});
