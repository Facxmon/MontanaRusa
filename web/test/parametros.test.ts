import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analizarLayout } from '../src/contrato/cargar';
import {
  AjustarParametros,
  CATALOGO_DE_ELEMENTOS,
  DECLARACIONES_DE_ELEMENTOS,
  ParametrosDeAceptacion,
  ParametrosDelModo,
  ParametrosGenerales,
  ParametrosPorDefecto,
} from '../src/nucleo/parametros';

const layout = analizarLayout(
  readFileSync(fileURLToPath(new URL('../../golden/loop-clotoide.json', import.meta.url)), 'utf8'),
);
const camel = (nombre: string) => nombre[0]!.toLowerCase() + nombre.slice(1);

/** Redondeo a 6 cifras significativas como el exportador de MATLAB, para comparar. */
const seis = (v: unknown): unknown => {
  if (typeof v === 'number') return v === 0 ? 0 : Number(v.toPrecision(6));
  if (Array.isArray(v)) return v.map(seis);
  if (v === null) return [];
  return v;
};

describe('ParametrosPorDefecto contra parametros.defaults del golden', () => {
  it('tiene exactamente los mismos campos con los mismos valores (a 6 cifras)', () => {
    const mios = ParametrosPorDefecto();
    const golden = layout.parametros.defaults as Record<string, unknown>;
    const clavesMias = Object.keys(mios).map(camel).sort();
    expect(clavesMias).toEqual(Object.keys(golden).sort());
    for (const [nombre, valor] of Object.entries(mios)) {
      expect(seis(valor), nombre).toEqual(seis(golden[camel(nombre)]));
    }
  });
});

describe('declaraciones contra parametros.esquema del golden', () => {
  const esquema = layout.parametros.esquema;
  const aTernas = (lista: { Nombre: string; Unidad: string; Descripcion: string }[]) =>
    lista.map((d) => ({ clave: camel(d.Nombre), unidad: d.Unidad, descripcion: d.Descripcion }));

  it('modo', () => {
    const { Lista, Nota } = ParametrosDelModo('Clotoide');
    expect(aTernas(Lista)).toEqual(esquema.modo.parametros);
    expect(Nota).toBe(esquema.modo.nota);
  });

  it('elementos, en el orden del catalogo', () => {
    expect(CATALOGO_DE_ELEMENTOS).toEqual(Object.keys(esquema.elementos));
    for (const nombre of CATALOGO_DE_ELEMENTOS) {
      expect(aTernas(DECLARACIONES_DE_ELEMENTOS[nombre]), nombre).toEqual(esquema.elementos[nombre]);
    }
  });

  it('aceptacion y generales', () => {
    expect(aTernas(ParametrosDeAceptacion())).toEqual(esquema.aceptacion);
    expect(aTernas(ParametrosGenerales())).toEqual(esquema.generales);
  });

  it('la nota del modo normativo es la de MATLAB', () => {
    const normativa = analizarLayout(
      readFileSync(fileURLToPath(new URL('../../golden/loop-normativa.json', import.meta.url)), 'utf8'),
    );
    expect(ParametrosDelModo('GNormativaMaxima').Nota).toBe(normativa.parametros.esquema.modo.nota);
    expect(aTernas(ParametrosDelModo('GNormativaMaxima').Lista)).toEqual(normativa.parametros.esquema.modo.parametros);
  });
});

describe('AjustarParametros', () => {
  it('aplica y detecta los inertes', () => {
    const base = ParametrosPorDefecto();
    const { Parametros, Inertes } = AjustarParametros(base, { RadioDelLoop: 0.3, FuerzaGObjetivo: 2 }, 'DiveLoop');
    expect(Parametros.RadioDelLoop).toBe(0.3);
    expect(Inertes).toEqual(['RadioDelLoop', 'FuerzaGObjetivo']);
  });

  it('un campo inexistente es un error', () => {
    expect(() => AjustarParametros(ParametrosPorDefecto(), { Fantasma: 1 } as never, 'LoopVertical')).toThrowError(/Fantasma/);
  });
});
