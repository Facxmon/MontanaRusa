// Modos de curvatura y peralte nuevos: la clotoide simetrica de verdad, el
// peralte alineado al centro instantaneo de rotacion (CIR) con sus dos
// definiciones, el renombre Clotoide -> ArcoCircular con su migracion, y
// 7.1.7.1 sin resetear la duracion al terminar la ventana reducida.

import { describe, expect, it } from 'vitest';
import { analizarLayout } from '../src/contrato/cargar';
import { EstadoInicial } from '../src/nucleo/basicos';
import { CONSTRUCTORES } from '../src/nucleo/elementos';
import { limitesDelEvento, limiteNormativo } from '../src/nucleo/norma';
import { AjustarParametros, ParametrosPorDefecto } from '../src/nucleo/parametros';
import { deserializarDiseno } from '../src/nucleo/serializar';
import type { NombreDeElemento, Parametros } from '../src/nucleo/tipos';

const GIRO_OBT = (240 * Math.PI) / 180;

function construir(elemento: NombreDeElemento, modo: Parametros['ModoCurvatura'], ajustes: Partial<Parametros> = {}) {
  let P = ParametrosPorDefecto();
  Object.assign(P, { RadioDelLoop: 0.3, CalcularVelocidadMinima: false, ModoCurvatura: modo });
  P = AjustarParametros(P, ajustes, elemento).Parametros;
  const [, El, Reporte] = CONSTRUCTORES[elemento](EstadoInicial([0, 0, 1], [1, 0, 0], [0, 0, 1], 5, P), P, null);
  return { El, Reporte, P };
}

/** Residuo maximo contra la recta de minimos cuadrados. */
function residuoLineal(x: ArrayLike<number>, y: ArrayLike<number>): number {
  const n = x.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += x[i]!; sy += y[i]!; sxx += x[i]! * x[i]!; sxy += x[i]! * y[i]!;
  }
  const m = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const b = (sy - m * sx) / n;
  let r = 0;
  for (let i = 0; i < n; i++) r = Math.max(r, Math.abs(y[i]! - (m * x[i]! + b)));
  return r;
}

describe('modo Clotoide: clotoide simetrica de verdad', () => {
  const { El } = construir('LoopVertical', 'Clotoide');
  const T = El.Track;

  it('dos sub-tramos, sin arco de radio constante, y cierra con curvatura cero', () => {
    expect(T.SubTramos.map((s) => s.Nombre)).toEqual(['ClotoideEntrada', 'ClotoideSalida']);
    expect(Math.abs(El.Diagnostico.ResidualCierrePitch)).toBeLessThan(1e-6);
    expect(T.Curvatura[T.Curvatura.length - 1]).toBeLessThan(1e-9);
  });

  it('la curvatura es lineal en el arco en cada mitad, con la misma pendiente en modulo, y llega a 1/(R + d) en el pico', () => {
    const pendientes = T.SubTramos.map((s) => {
      const x = T.LongitudArco.slice(s.IndiceInicio, s.IndiceFin + 1);
      const y = T.Curvatura.slice(s.IndiceInicio, s.IndiceFin + 1);
      expect(residuoLineal(x, y), s.Nombre).toBeLessThan(1e-3);
      return (y[y.length - 1]! - y[0]!) / (x[x.length - 1]! - x[0]!);
    });
    expect(pendientes[0]! / -pendientes[1]!).toBeCloseTo(1, 2);
    expect(Math.max(...T.Curvatura)).toBeCloseTo(1 / (0.3 + 0.03), 3);
  });
});

describe('peralte alineado al centro de curvatura', () => {
  const { El } = construir('OverBankedTurn', 'ArcoCircular', { AnguloDelGiro: GIRO_OBT, PeralteAlineadoAlCentroDeCurvatura: true });

  it('U apunta al centro de curvatura: psi = 0 y en un giro a nivel el peralte es 90 grados', () => {
    expect(Math.max(...Array.from(El.Track.AnguloCurvaturaDesdeArriba, Math.abs))).toBeLessThan(1e-9);
    expect((Math.max(...Array.from(El.Track.AnguloPeralte, Math.abs)) * 180) / Math.PI).toBeCloseTo(90, 3);
  });
});

describe('peralte alineado a la fuerza', () => {
  const { El, P } = construir('OverBankedTurn', 'ArcoCircular', { AnguloDelGiro: GIRO_OBT, PeralteAlineadoALaFuerza: true });

  it('el eje del carro sigue a la fuerza especifica del riel: Gy de balance nula', () => {
    expect(El.Diagnostico.ResidualAlineacionPeralte).toBeLessThan(1e-5);
    const T = El.Track;
    let maximo = 0;
    for (let i = 0; i < T.LongitudArco.length; i++) {
      const v2 = El.Sim.Velocidad[i]! ** 2;
      const k = T.VectorCurvatura[i]!;
      const L = T.VersorLateral[i]!;
      maximo = Math.max(maximo, Math.abs((v2 * (k[0] * L[0] + k[1] * L[1] + k[2] * L[2]) + P.Gravedad * L[2]) / P.Gravedad));
    }
    // Con la velocidad RE-SIMULADA (SimularSobreTrack): difiere un poco de la de diseno, con la que el desalineo es ~1e-7.
    expect(maximo).toBeLessThan(0.02);
  });

  it('el onset queda dentro del presupuesto y la Gy que queda es la dinamica del roll (acotada)', () => {
    const [ox, oy, oz] = El.Diagnostico.Escala.OnsetMaximo;
    expect(El.Diagnostico.OnsetLateralGenerado).toBeLessThanOrEqual(oy * 1.01);
    expect(El.Diagnostico.OnsetVerticalGenerado).toBeLessThanOrEqual(oz * 1.01);
    expect(ox).toBeGreaterThan(0);
    expect(Math.max(...Array.from(El.Sim.Gy, Math.abs))).toBeLessThan(0.5);
  });
});

describe('opciones de peralte', () => {
  it('los dos ticks son excluyentes', () => {
    expect(() => construir('Helice', 'ArcoCircular', { PeralteAlineadoALaFuerza: true, PeralteAlineadoAlCentroDeCurvatura: true })).toThrowError(/excluyentes/);
  });

  it('con el peralte alineado, el dive loop normativo deja de perseguir Gy', () => {
    const { El } = construir('DiveLoop', 'GNormativaMaxima', { PeralteAlineadoAlCentroDeCurvatura: true });
    expect(El.Receta.CurvaLimiteGy).toBeUndefined();
    expect(Math.max(...Array.from(El.Track.AnguloCurvaturaDesdeArriba, Math.abs))).toBeLessThan(1e-9);
  });

  it('sin opciones, nada cambia: el peralte constante del over-banked turn sigue siendo el de siempre', () => {
    const { El } = construir('OverBankedTurn', 'ArcoCircular', { AnguloDelGiro: GIRO_OBT });
    expect(El.Receta.AlineacionDelPeralte).toBe('Constante');
    expect(El.Receta.RollDelElemento).toBeCloseTo((110 * Math.PI) / 180, 12);
  });
});

describe('7.1.7.1: la ventana reducida no resetea la duracion del evento', () => {
  const t = Array.from({ length: 1001 }, (_, i) => i * 0.01);
  const reducida = t.map((x) => x <= 6);

  it('un evento que empieza en la ventana y termina afuera cumple las dos curvas con la duracion acumulada', () => {
    const inicio = 400; // t = 4 s
    const fin = 900; // t = 9 s
    const tramos = limitesDelEvento(t, inicio, fin, 'MasGzTodas', reducida);
    expect(tramos.map((x) => x.curva)).toEqual(['MasGzReducido', 'MasGzTodas']);
    // Adentro: 2 s acumulados contra la reducida. Afuera: 5 s acumulados (no 3) contra la normal.
    expect(tramos[0]!.duracion).toBeCloseTo(2, 9);
    expect(tramos[0]!.limite).toBe(limiteNormativo('MasGzReducido', 2));
    expect(tramos[1]!.duracion).toBeCloseTo(5, 9);
    expect(tramos[1]!.limite).toBe(limiteNormativo('MasGzTodas', 5));
  });

  it('sin ventanas es un solo limite, como siempre', () => {
    const tramos = limitesDelEvento(t, 100, 150, 'MasGzTodas', null);
    expect(tramos).toHaveLength(1);
    expect(tramos[0]!.duracion).toBeCloseTo(0.5, 9);
  });
});

describe('renombre Clotoide -> ArcoCircular', () => {
  const ei = { pos: [0, 0, 1], tan: [1, 0, 0], arr: [0, 0, 1], vel: 4.5 };

  it('un diseno guardado v1 con Clotoide se lee como ArcoCircular (global y por instancia)', () => {
    const d = deserializarDiseno({ v: 1, p: { ModoCurvatura: 'Clotoide' }, ei, s: [{ t: 'Helice', a: { ModoCurvatura: 'Clotoide' } }] });
    expect(d.parametros.ModoCurvatura).toBe('ArcoCircular');
    expect(d.secuencia[0]!.ajustes.ModoCurvatura).toBe('ArcoCircular');
  });

  it('un diseno v2 con Clotoide es la clotoide nueva', () => {
    const d = deserializarDiseno({ v: 2, p: { ModoCurvatura: 'Clotoide' }, ei, s: [] });
    expect(d.parametros.ModoCurvatura).toBe('Clotoide');
  });

  it('un layout del contrato anterior a 1.2.0 con Clotoide se lee como ArcoCircular', () => {
    const texto = JSON.stringify({
      meta: { versionContrato: '1.1.0' },
      parametros: { valores: { modoCurvatura: 'Clotoide' }, defaults: { modoCurvatura: 'Clotoide' }, esquema: { modo: { nombre: 'Clotoide', opciones: ['Clotoide'] } } },
      elementos: [{ ajustes: { modoCurvatura: 'Clotoide' } }],
    });
    const layout = analizarLayout(texto) as unknown as {
      parametros: { valores: { modoCurvatura: string }; esquema: { modo: { nombre: string } } };
      elementos: { ajustes: { modoCurvatura: string } }[];
    };
    expect(layout.parametros.valores.modoCurvatura).toBe('ArcoCircular');
    expect(layout.parametros.esquema.modo.nombre).toBe('ArcoCircular');
    expect(layout.elementos[0]!.ajustes.modoCurvatura).toBe('ArcoCircular');
  });
});
