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
  conExclusionDePeralte,
  GRUPOS_GLOBALES,
  seMuestra,
  textoConUnidad,
  textoDeEntrada,
} from '../src/paneles/etiquetas';
import { OPCIONES_DE_PARAMETRO, ParametrosDeAceptacion, ParametrosGenerales, ParametrosPorDefecto } from '../src/nucleo/parametros';
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
    expect(modosQueLoConsumen('RadioDeReferencia')).toEqual(['ArcoCircular', 'Clotoide']);
    expect(modosQueLoConsumen('RadioDeLaHelice')).toEqual([]);
  });
});

describe('parametros condicionales (A6)', () => {
  const con = (cambios: Partial<typeof defaults>) => ({ ...defaults, ...cambios });

  it('el factor de seguridad normativo solo se muestra si algun elemento usa GNormativaMaxima', () => {
    expect(seMuestra('FactorDeSeguridadNormativo', ['ArcoCircular'], defaults)).toBe(false);
    expect(seMuestra('FactorDeSeguridadNormativo', ['ArcoCircular', 'FuerzaGConstante'], defaults)).toBe(false);
    expect(seMuestra('FactorDeSeguridadNormativo', ['GNormativaMaxima'], defaults)).toBe(true);
    // Global en ArcoCircular pero una instancia con modo propio normativo: se muestra.
    expect(seMuestra('FactorDeSeguridadNormativo', ['ArcoCircular', 'GNormativaMaxima'], defaults)).toBe(true);
  });

  it('la tolerancia del objetivo de G solo con FuerzaGConstante o GNormativaMaxima', () => {
    expect(seMuestra('TolObjetivoDeG', ['ArcoCircular', 'Clotoide'], defaults)).toBe(false);
    expect(seMuestra('TolObjetivoDeG', ['FuerzaGConstante'], defaults)).toBe(true);
  });

  it('el arrastre, el tren y la busqueda de velocidad dependen de sus interruptores', () => {
    for (const n of ['RhoAire', 'CoefArrastre', 'AreaFrontal'] as const) {
      expect(seMuestra(n, ['ArcoCircular'], con({ ModelarArrastre: true }))).toBe(true);
      expect(seMuestra(n, ['ArcoCircular'], con({ ModelarArrastre: false }))).toBe(false);
    }
    expect(seMuestra('FactorTren', ['ArcoCircular'], con({ NumeroDeCarros: 1 }))).toBe(false);
    expect(seMuestra('FactorTren', ['ArcoCircular'], con({ NumeroDeCarros: 3 }))).toBe(true);
    expect(seMuestra('PasoBusquedaVelocidad', ['ArcoCircular'], con({ CalcularVelocidadMinima: false }))).toBe(false);
    expect(seMuestra('PasoBusquedaVelocidad', ['ArcoCircular'], con({ CalcularVelocidadMinima: true }))).toBe(true);
  });

  it('el peralte propio se esconde con el peralte alineado al CIR, y el desvio solo en los modos relativos', () => {
    expect(seMuestra('PeralteDelGiro', ['ArcoCircular'], defaults)).toBe(true);
    expect(seMuestra('DesvioDePeralteDelGiro', ['ArcoCircular'], defaults)).toBe(false);
    expect(seMuestra('PeralteDelGiro', ['ArcoCircular'], con({ ModoDePeralteDelGiro: 'RelativoALaFuerza' }))).toBe(false);
    expect(seMuestra('DesvioDePeralteDelGiro', ['ArcoCircular'], con({ ModoDePeralteDelGiro: 'RelativoALaFuerza' }))).toBe(true);
    for (const n of ['PeralteDelGiro', 'ModoDePeralteDelGiro', 'DesvioDePeralteDelGiro', 'PeralteDeLaHelice', 'RollExtraDelLoop'] as const) {
      expect(seMuestra(n, ['ArcoCircular'], con({ PeralteAlineadoALaFuerza: true }))).toBe(false);
    }
  });

  it('los dos ticks de peralte alineado son excluyentes', () => {
    expect(conExclusionDePeralte('PeralteAlineadoALaFuerza', true)).toEqual({ PeralteAlineadoALaFuerza: true, PeralteAlineadoAlCentroDeCurvatura: false });
    expect(conExclusionDePeralte('PeralteAlineadoAlCentroDeCurvatura', true)).toEqual({ PeralteAlineadoAlCentroDeCurvatura: true, PeralteAlineadoALaFuerza: false });
    expect(conExclusionDePeralte('PeralteAlineadoALaFuerza', false)).toEqual({ PeralteAlineadoALaFuerza: false });
  });

  it('los versores del grafico 3D de MATLAB no se muestran en la web', () => {
    expect(seMuestra('VersoresEnGrafico3D', ['ArcoCircular'], defaults)).toBe(false);
  });
});

describe('secciones del formulario global (A6)', () => {
  it('todo parametro de aceptacion y generales tiene seccion, y es una de las declaradas', () => {
    const validas = new Set([...GRUPOS_GLOBALES.flatMap((g) => g.secciones.map((s) => s.clave)), 'ficha', 'oculto']);
    for (const d of [...ParametrosDeAceptacion(), ...ParametrosGenerales()]) {
      expect(validas.has(etiquetaDe(d.Nombre).seccion!), d.Nombre).toBe(true);
    }
  });

  it('las tolerancias numericas van a Avanzado y los radios no tienen seccion global', () => {
    const numericos = nombres.filter((n) => etiquetaDe(n).seccion === 'numerico');
    expect(numericos.sort()).toEqual(
      [
        'ArcoMinimoAutointerferencia', 'Gravedad', 'MargenDeOnset', 'MaxIteracionesAjuste', 'MaxIteracionesCierre', 'MaxIteracionesPuntoFijo',
        'PasoGeneracion', 'PasoSimulacion', 'PasosEntreOrtonormalizaciones', 'TolCierrePitch', 'TolNorma', 'TolPuntoFijo', 'ToleranciaVelocidadDeDiseno',
        'TolVelocidadDelTren',
      ].sort(),
    );
    expect(etiquetaDe('RadioDelLoop').seccion).toBeUndefined();
    expect(etiquetaDe('InclinacionHelicoidalImpuesta').seccion).toBe('ficha');
    expect(etiquetaDe('RadioDeReferenciaReal').seccion).toBe('escala');
  });
});
