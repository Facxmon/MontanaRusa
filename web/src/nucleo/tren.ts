// Port de GeneradorDeElementos/Tren/: el tren de NumeroDeCarros carros.
// Los carros van rigidamente unidos a lo largo del riel (arco constante
// LargoCarro + SeparacionEntreCarros entre uno y otro) y comparten la
// velocidad del riel; la energia es la suma de los carros. Archivo por
// archivo:
//   DistanciasDelTren, GeometriaDelTren, EvaluarGeometriaDelTren, SimularTren,
//   EvaluarEnArco, SimDelCarro, InicioDelTren, UtilizacionNormativa,
//   ConEnergiaDelTren, ResumenDelTren, CriteriosDelCarro,
//   PeorCarroPorCriterio, DisenarParaElTren, VerificarTrenDelLayout.
// Las explicaciones largas estan en los .m.

import { DerivadaPorArco, EscalasDeFroude, ResistenciaAlAvance } from './basicos';
import { GenerarGeometria } from './generarGeometria';
import { interp1Lineal, interpolantePchip, maximo, minimo, punto as productoPunto } from './matematica';
import { limiteNormativo } from './norma';
import { Interpolante, MagnitudesDinamicas } from './simular';
import type {
  ContextoNormativo, Criterio, Diagnostico, Escala, Estado, EstadoDelTren, InfoDelTren, Layout, Normativo, Parametros, Receta, ReporteDelCarro, Resumen, Sim, Track, TrenSimulado,
} from './tipos';
export type { EstadoDelTren, InfoDelTren, ReporteDelCarro, TrenSimulado };
import { CriteriosDeCabeza, CriteriosDeMarcha, CriteriosDeOnset, CriteriosNormativos, SerieNormativaDelLayout, VerificarLimitesNormativos } from './verificacion';

// ------------------------------------------------------------ DistanciasDelTren.m
export function DistanciasDelTren(Parametros: Parametros): number[] {
  if (Parametros.SeparacionEntreCarros < 0) {
    throw new Error(`SeparacionEntreCarros no puede ser negativa (vale ${Parametros.SeparacionEntreCarros} m).`);
  }
  const Paso = Parametros.LargoCarro + Parametros.SeparacionEntreCarros;
  const Cantidad = Math.max(1, Math.round(Parametros.NumeroDeCarros));
  return Array.from({ length: Cantidad }, (_, i) => i * Paso);
}

export const esTren = (Parametros: Parametros): boolean => Math.round(Parametros.NumeroDeCarros) > 1;

// ------------------------------------------------------------ GeometriaDelTren.m
interface Extremo {
  TangenteVertical: number;
  ArribaVertical: number;
  LateralVertical: number;
  AlturaRiel: number;
}

export interface GeometriaDelTren {
  TangenteVertical: (s: number) => number;
  ArribaVertical: (s: number) => number;
  LateralVertical: (s: number) => number;
  CurvaturaArribaCarro: (s: number) => number;
  CurvaturaLateralCarro: (s: number) => number;
  VelocidadRoll: (s: number) => number;
  AceleracionRoll: (s: number) => number;
  AlturaRiel: (s: number) => number;
  FactorCuadrado: (s: number) => number;
  DerivadaFactorCuadrado: (s: number) => number;
  Arco: Float64Array;
  Inicio: number;
  Fin: number;
  Antes: Extremo;
  Despues: Extremo;
}

export function GeometriaDelTren(Tracks: Track[], Parametros: Parametros): GeometriaDelTren {
  const d = Parametros.DistanciaHeartline;
  const Arco: number[] = [];
  const Columnas: number[][] = [[], [], [], [], [], [], [], []];
  Tracks.forEach((Track, i) => {
    for (let k = i === 0 ? 0 : 1; k < Track.LongitudArco.length; k++) {
      Arco.push(Track.LongitudArco[k]!);
      Columnas[0]!.push(Track.VersorTangente[k]![2]);
      Columnas[1]!.push(Track.VersorArribaCarro[k]![2]);
      Columnas[2]!.push(Track.VersorLateral[k]![2]);
      Columnas[3]!.push(productoPunto(Track.VectorCurvatura[k]!, Track.VersorArribaCarro[k]!));
      Columnas[4]!.push(productoPunto(Track.VectorCurvatura[k]!, Track.VersorLateral[k]!));
      Columnas[5]!.push(Track.VelocidadRoll[k]!);
      Columnas[6]!.push(Track.AceleracionRoll[k]!);
      Columnas[7]!.push(Track.PuntosRiel[k]![2]);
    }
  });
  const ArcoF = Float64Array.from(Arco);
  const FactorCuadrado = Arco.map((_, k) => {
    const a = 1 - d * Columnas[3]![k]!;
    const b = d * Columnas[5]![k]!;
    return a * a + b * b;
  });
  const DerivadaFactorCuadrado = DerivadaPorArco(FactorCuadrado, ArcoF);
  const conservados: number[] = [];
  for (let k = 0; k < Arco.length; k++) if (k === 0 || Arco[k]! - Arco[k - 1]! > 1e-9) conservados.push(Arco[k]!);
  const extremo = (k: number): Extremo => ({
    TangenteVertical: Columnas[0]![k]!, ArribaVertical: Columnas[1]![k]!, LateralVertical: Columnas[2]![k]!, AlturaRiel: Columnas[7]![k]!,
  });
  const n = Arco.length;
  return {
    TangenteVertical: Interpolante(ArcoF, Columnas[0]!),
    ArribaVertical: Interpolante(ArcoF, Columnas[1]!),
    LateralVertical: Interpolante(ArcoF, Columnas[2]!),
    CurvaturaArribaCarro: Interpolante(ArcoF, Columnas[3]!),
    CurvaturaLateralCarro: Interpolante(ArcoF, Columnas[4]!),
    VelocidadRoll: Interpolante(ArcoF, Columnas[5]!),
    AceleracionRoll: Interpolante(ArcoF, Columnas[6]!),
    AlturaRiel: Interpolante(ArcoF, Columnas[7]!),
    FactorCuadrado: Interpolante(ArcoF, FactorCuadrado),
    DerivadaFactorCuadrado: Interpolante(ArcoF, DerivadaFactorCuadrado),
    Arco: Float64Array.from(conservados),
    Inicio: Arco[0]!,
    Fin: Arco[n - 1]!,
    Antes: extremo(0),
    Despues: extremo(n - 1),
  };
}

// ------------------------------------------------------------ EvaluarGeometriaDelTren.m
interface PuntoDeLaVia {
  TangenteVertical: number;
  ArribaVertical: number;
  LateralVertical: number;
  CurvaturaArribaCarro: number;
  CurvaturaLateralCarro: number;
  VelocidadRoll: number;
  AceleracionRoll: number;
  AlturaRiel: number;
  FactorCuadrado: number;
  DerivadaFactorCuadrado: number;
}

export function EvaluarGeometriaDelTren(Geo: GeometriaDelTren, s: number): PuntoDeLaVia {
  if (s >= Geo.Inicio && s <= Geo.Fin) {
    return {
      TangenteVertical: Geo.TangenteVertical(s),
      ArribaVertical: Geo.ArribaVertical(s),
      LateralVertical: Geo.LateralVertical(s),
      CurvaturaArribaCarro: Geo.CurvaturaArribaCarro(s),
      CurvaturaLateralCarro: Geo.CurvaturaLateralCarro(s),
      VelocidadRoll: Geo.VelocidadRoll(s),
      AceleracionRoll: Geo.AceleracionRoll(s),
      AlturaRiel: Geo.AlturaRiel(s),
      FactorCuadrado: Geo.FactorCuadrado(s),
      DerivadaFactorCuadrado: Geo.DerivadaFactorCuadrado(s),
    };
  }
  // Fuera de la via: recta por la tangente del extremo, sin curvatura ni roll.
  const [E, Borde] = s < Geo.Inicio ? [Geo.Antes, Geo.Inicio] : [Geo.Despues, Geo.Fin];
  return {
    TangenteVertical: E.TangenteVertical,
    ArribaVertical: E.ArribaVertical,
    LateralVertical: E.LateralVertical,
    CurvaturaArribaCarro: 0,
    CurvaturaLateralCarro: 0,
    VelocidadRoll: 0,
    AceleracionRoll: 0,
    AlturaRiel: E.AlturaRiel + E.TangenteVertical * (s - Borde),
    FactorCuadrado: 1,
    DerivadaFactorCuadrado: 0,
  };
}

// ------------------------------------------------------------ SimularTren.m
export function SimularTren(Geo: GeometriaDelTren, Parametros: Parametros, Inicio: EstadoDelTren & { Arco: number }, ArcoFinal: number): TrenSimulado {
  const Distancias = DistanciasDelTren(Parametros);
  const Arco: number[] = [Inicio.Arco];
  const Tope = Math.min(ArcoFinal, Geo.Fin);
  for (const s of Geo.Arco) if (s > Inicio.Arco + 1e-9 && s <= Tope) Arco.push(s);
  if (ArcoFinal > Arco[Arco.length - 1]! + 1e-9) {
    const Ultimo = Arco[Arco.length - 1]!;
    // Sin el 1e-9, un ulp de diferencia en el final de la via cambia la cantidad de pasos (SimularTren.m).
    const Cantidad = Math.max(1, Math.ceil((ArcoFinal - Ultimo) / Parametros.PasoSimulacion - 1e-9));
    for (let i = 1; i <= Cantidad; i++) Arco.push(Ultimo + ((ArcoFinal - Ultimo) * i) / Cantidad);
  }
  const n = Arco.length;
  const Tren: TrenSimulado = {
    Arco: Float64Array.from(Arco),
    Distancias,
    VelocidadRielCuadrado: new Float64Array(n).fill(NaN),
    Tiempo: new Float64Array(n).fill(NaN),
    FuerzaRodadura: new Float64Array(n),
    FuerzaArrastre: new Float64Array(n),
    EnergiaCinetica: new Float64Array(n).fill(NaN),
    EnergiaPotencial: new Float64Array(n).fill(NaN),
    EnergiaDisipadaRodadura: new Float64Array(n),
    EnergiaDisipadaArrastre: new Float64Array(n),
    PuntoDeParada: null,
  };
  let w = Inicio.VelocidadRielCuadrado;
  let t = Inicio.Tiempo;
  for (let k = 0; k < n; k++) {
    if (!(w > 0)) {
      Tren.PuntoDeParada = k;
      break;
    }
    Tren.VelocidadRielCuadrado[k] = w;
    Tren.Tiempo[k] = t;
    const D = DerivadaDelTren(Arco[k]!, w, Geo, Distancias, Parametros);
    Tren.FuerzaRodadura[k] = D.Rodadura;
    Tren.FuerzaArrastre[k] = D.Arrastre;
    Tren.EnergiaCinetica[k] = D.Cinetica;
    Tren.EnergiaPotencial[k] = D.Potencial;
    if (k === n - 1) break;
    const h = Arco[k + 1]! - Arco[k]!;
    const k1 = DerivadaDelTren(Arco[k]!, w, Geo, Distancias, Parametros).Derivada;
    const k2 = DerivadaDelTren(Arco[k]! + h / 2, w + (h / 2) * k1[0], Geo, Distancias, Parametros).Derivada;
    const k3 = DerivadaDelTren(Arco[k]! + h / 2, w + (h / 2) * k2[0], Geo, Distancias, Parametros).Derivada;
    const k4 = DerivadaDelTren(Arco[k]! + h, w + h * k3[0], Geo, Distancias, Parametros).Derivada;
    w = w + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    t = t + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
  }
  // Energia disipada desde Inicio, con la fuerza del nodo de partida de cada paso.
  let r = 0;
  let a = 0;
  for (let k = 1; k < n; k++) {
    r += Tren.FuerzaRodadura[k - 1]! * (Arco[k]! - Arco[k - 1]!);
    a += Tren.FuerzaArrastre[k - 1]! * (Arco[k]! - Arco[k - 1]!);
    Tren.EnergiaDisipadaRodadura[k] = r;
    Tren.EnergiaDisipadaArrastre[k] = a;
  }
  return Tren;
}

function DerivadaDelTren(Arco: number, wEntrada: number, Geo: GeometriaDelTren, Distancias: number[], Parametros: Parametros) {
  const g = Parametros.Gravedad;
  const d = Parametros.DistanciaHeartline;
  const m = Parametros.Masa;
  const w = Math.max(wEntrada, 0);
  const VelocidadRiel = Math.sqrt(w);
  let Rodadura = 0;
  let Arrastre = 0;
  let SumaDerivadaFactor = 0;
  let SumaDerivadaAltura = 0;
  let SumaFactor = 0;
  let SumaAltura = 0;
  for (const Distancia of Distancias) {
    const P = EvaluarGeometriaDelTren(Geo, Arco - Distancia);
    const Reduccion = 1 - d * P.CurvaturaArribaCarro;
    const GArriba = (w * (P.CurvaturaArribaCarro * Reduccion - d * (P.VelocidadRoll * P.VelocidadRoll))) / g + P.ArribaVertical;
    const GLateral = (w * P.CurvaturaLateralCarro * Reduccion) / g + P.LateralVertical + (d * (-g * P.TangenteVertical * P.VelocidadRoll + w * P.AceleracionRoll)) / g;
    const [, RodaduraDelCarro, ArrastreDelTren] = ResistenciaAlAvance(VelocidadRiel, GArriba, GLateral, Parametros);
    Rodadura += RodaduraDelCarro;
    Arrastre = ArrastreDelTren;
    SumaDerivadaFactor += P.DerivadaFactorCuadrado;
    SumaDerivadaAltura += Reduccion * P.TangenteVertical + d * P.VelocidadRoll * P.LateralVertical;
    SumaFactor += P.FactorCuadrado;
    SumaAltura += P.AlturaRiel + d * P.ArribaVertical;
  }
  const Derivada: [number, number] = [
    -(w * SumaDerivadaFactor + 2 * g * SumaDerivadaAltura + (2 * (Rodadura + Arrastre)) / m) / SumaFactor,
    1 / Math.max(VelocidadRiel, 1e-6),
  ];
  return { Derivada, Rodadura, Arrastre, Cinetica: 0.5 * m * w * SumaFactor, Potencial: m * g * SumaAltura };
}

// ------------------------------------------------------------ EvaluarEnArco.m
export function EvaluarEnArco(Arco: ArrayLike<number>, Datos: ArrayLike<number>, Consulta: ArrayLike<number>): Float64Array {
  const Valores = new Float64Array(Consulta.length).fill(NaN);
  const n = Arco.length;
  if (n < 2) {
    for (let i = 0; i < Consulta.length; i++) if (n === 1 && Math.abs(Consulta[i]! - Arco[0]!) < 1e-12) Valores[i] = Datos[0]!;
    return Valores;
  }
  const f = interpolantePchip(Arco, Datos);
  for (let i = 0; i < Consulta.length; i++) {
    const s = Consulta[i]!;
    if (s >= Arco[0]! - 1e-12 && s <= Arco[n - 1]! + 1e-12) Valores[i] = f(s);
  }
  return Valores;
}

/** Arco y columnas de los nodos del tren con velocidad, sin nodos repetidos. */
function TrenConservado(Tren: TrenSimulado): { Arco: number[]; indices: number[] } {
  const Arco: number[] = [];
  const indices: number[] = [];
  for (let k = 0; k < Tren.Arco.length; k++) {
    if (Number.isNaN(Tren.VelocidadRielCuadrado[k]!)) continue;
    if (k > 0 && !(Tren.Arco[k]! - Tren.Arco[k - 1]! > 1e-9)) continue;
    Arco.push(Tren.Arco[k]!);
    indices.push(k);
  }
  return { Arco, indices };
}

// ------------------------------------------------------------ SimDelCarro.m
export function SimDelCarro(Track: Track, Tren: TrenSimulado, Carro: number, Parametros: Parametros): Sim {
  const d = Parametros.DistanciaHeartline;
  const g = Parametros.Gravedad;
  const n = Track.LongitudArco.length;
  const ArcoDelPrimero = Array.from(Track.LongitudArco, (s) => s + Tren.Distancias[Carro - 1]!);
  const { Arco: ArcoTren, indices } = TrenConservado(Tren);
  const Hasta = ArcoTren[ArcoTren.length - 1]!;
  const w2 = EvaluarEnArco(ArcoTren, indices.map((k) => Tren.VelocidadRielCuadrado[k]!), ArcoDelPrimero);
  const T = EvaluarEnArco(ArcoTren, indices.map((k) => Tren.Tiempo[k]!), ArcoDelPrimero);
  for (let i = 0; i < n; i++) {
    if (ArcoDelPrimero[i]! > Hasta + 1e-12 || ArcoDelPrimero[i]! < ArcoTren[0]! - 1e-12) {
      w2[i] = NaN;
      T[i] = NaN;
    }
  }

  const VelocidadCentroDeMasa = new Float64Array(n);
  const Tiempo = new Float64Array(n);
  const CurvaturaArribaCarro = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    CurvaturaArribaCarro[i] = productoPunto(Track.VectorCurvatura[i]!, Track.VersorArribaCarro[i]!);
    const Factor = Math.hypot(1 - d * CurvaturaArribaCarro[i]!, d * Track.VelocidadRoll[i]!);
    VelocidadCentroDeMasa[i] = Number.isNaN(w2[i]!) ? NaN : Math.sqrt(Math.max(w2[i]!, 0)) * Factor;
    Tiempo[i] = T[i]! - T[0]!;
  }
  let PuntoDeParada: number | null = null;
  for (let i = 0; i < n; i++) {
    if (Number.isNaN(VelocidadCentroDeMasa[i]!)) {
      PuntoDeParada = i;
      break;
    }
  }
  if (PuntoDeParada !== null) {
    for (let i = PuntoDeParada; i < n; i++) {
      VelocidadCentroDeMasa[i] = NaN;
      Tiempo[i] = NaN;
    }
  }

  const Peso = Parametros.Masa * g;
  const FuerzaRodadura = new Float64Array(n);
  const FuerzaArrastre = new Float64Array(n);
  const AreaEfectiva = Parametros.AreaFrontal * (1 + Parametros.FactorTren * (Parametros.NumeroDeCarros - 1));
  for (let i = 0; i < n; i++) {
    const w = Math.max(w2[i]!, 0);
    const Reduccion = 1 - d * CurvaturaArribaCarro[i]!;
    const CurvaturaLateralCarro = productoPunto(Track.VectorCurvatura[i]!, Track.VersorLateral[i]!);
    const phi = Track.VelocidadRoll[i]!;
    const GArriba = (w * (CurvaturaArribaCarro[i]! * Reduccion - d * (phi * phi))) / g + Track.VersorArribaCarro[i]![2];
    const GLateral = (w * CurvaturaLateralCarro * Reduccion) / g + Track.VersorLateral[i]![2] + (d * (-g * Track.VersorTangente[i]![2] * phi + w * Track.AceleracionRoll[i]!)) / g;
    const SinDato = Number.isNaN(VelocidadCentroDeMasa[i]!);
    FuerzaRodadura[i] = SinDato
      ? 0
      : Parametros.CrrPortantes * Math.max(GArriba, 0) * Peso + Parametros.CrrRetencion * Math.max(-GArriba, 0) * Peso + Parametros.CrrGuia * Math.abs(GLateral) * Peso;
    FuerzaArrastre[i] = !SinDato && Carro === 1 && Parametros.ModelarArrastre ? 0.5 * Parametros.RhoAire * Parametros.CoefArrastre * AreaEfectiva * w : 0;
  }

  const Derivadas = MagnitudesDinamicas(Track, { VelocidadCentroDeMasa, Tiempo, FuerzaRodadura, FuerzaArrastre, PuntoDeParada }, Parametros);
  return { ...Derivadas, VelocidadDeDiseno: Track.VelocidadDeDiseno, AvisoVelocidadDeDiseno: '', Carro };
}

// ------------------------------------------------------------ InicioDelTren.m
export function InicioDelTren(EstadoEntrada: Estado, Track: Track, Parametros: Parametros): EstadoDelTren & { Arco: number } {
  const Arco = Track.LongitudArco[0]!;
  if (EstadoEntrada.Tren) return { Arco, VelocidadRielCuadrado: EstadoEntrada.Tren.VelocidadRielCuadrado, Tiempo: EstadoEntrada.Tren.Tiempo };
  const d = Parametros.DistanciaHeartline;
  const CurvaturaArribaCarro = productoPunto(Track.VectorCurvatura[0]!, Track.VersorArribaCarro[0]!);
  const Factor = Math.hypot(1 - d * CurvaturaArribaCarro, d * Track.VelocidadRoll[0]!);
  const v = EstadoEntrada.Velocidad / Factor;
  return { Arco, VelocidadRielCuadrado: v * v, Tiempo: 0 };
}

// ------------------------------------------------------------ UtilizacionNormativa.m
export function UtilizacionNormativa(Sim: Sim): number {
  const Gx: number[] = [];
  const Gy: number[] = [];
  const Gz: number[] = [];
  for (let i = 0; i < Sim.Gz.length; i++) {
    if (Number.isNaN(Sim.Gz[i]!) || Number.isNaN(Sim.Gy[i]!) || Number.isNaN(Sim.Gx[i]!)) continue;
    Gx.push(Sim.Gx[i]!);
    Gy.push(Sim.Gy[i]!);
    Gz.push(Sim.Gz[i]!);
  }
  if (Gz.length === 0) return NaN;
  const Limite = (curva: Parameters<typeof limiteNormativo>[0]) => Math.abs(limiteNormativo(curva, 0.2));
  return maximo([
    maximo(Gz) / Limite('MasGzTodas'),
    maximo(Gz.map((v) => -v)) / Limite('MenosGzBase'),
    maximo(Gy.map(Math.abs)) / Limite('GyBase'),
    maximo(Gx) / Limite('MasGxBase'),
    maximo(Gx.map((v) => -v)) / Limite('MenosGxBase'),
  ]);
}

// ------------------------------------------------------------ ConEnergiaDelTren.m
export function ConEnergiaDelTren(Sim: Sim, Track: Track, Tren: TrenSimulado): Sim {
  const { Arco: ArcoTren, indices } = TrenConservado(Tren);
  const n = Track.LongitudArco.length;
  const En = (Valores: Float64Array) => {
    const datos = indices.map((k) => Valores[k]!);
    return Float64Array.from(Track.LongitudArco, (s) => interp1Lineal(ArcoTren, datos, s, NaN));
  };
  const EnergiaCinetica = En(Tren.EnergiaCinetica);
  const EnergiaPotencial = En(Tren.EnergiaPotencial);
  const Rodadura = En(Tren.EnergiaDisipadaRodadura);
  const Arrastre = En(Tren.EnergiaDisipadaArrastre);
  const EnergiaTotal = new Float64Array(n);
  const EnergiaDisipadaRodadura = new Float64Array(n);
  const EnergiaDisipadaArrastre = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    EnergiaTotal[i] = EnergiaCinetica[i]! + EnergiaPotencial[i]!;
    EnergiaDisipadaRodadura[i] = Rodadura[i]! - Rodadura[0]!;
    EnergiaDisipadaArrastre[i] = Arrastre[i]! - Arrastre[0]!;
    if (Number.isNaN(Sim.VelocidadCentroDeMasa[i]!)) {
      EnergiaCinetica[i] = NaN;
      EnergiaPotencial[i] = NaN;
      EnergiaTotal[i] = NaN;
    }
  }
  return { ...Sim, EnergiaCinetica, EnergiaPotencial, EnergiaTotal, EnergiaDisipadaRodadura, EnergiaDisipadaArrastre, EnergiaDelTren: true };
}

// ------------------------------------------------------------ ResumenDelTren.m
export function ResumenDelTren(Resumen: Resumen, Sims: Sim[]): Resumen {
  const Extremo = (f: (v: ArrayLike<number>) => number, campo: keyof Sim) => f(Sims.map((S) => f(S[campo] as Float64Array)));
  return {
    ...Resumen,
    FuerzaNormalMaxima: Extremo(maximo, 'FuerzaNormal'),
    VelocidadMinima: Extremo(minimo, 'VelocidadCentroDeMasa'),
    GzMaxima: Extremo(maximo, 'Gz'),
    GzMinima: Extremo(minimo, 'Gz'),
    GyMaximaAbsoluta: maximo(Sims.map((S) => maximo(Array.from(S.Gy, Math.abs)))),
    GzMaximaCabeza: Extremo(maximo, 'GzCabeza'),
    GyMaximaAbsolutaCabeza: maximo(Sims.map((S) => maximo(Array.from(S.GyCabeza, Math.abs)))),
  };
}

// ------------------------------------------------------------ CriteriosDelCarro.m
export function CriteriosDelCarro(Sim: Sim, Escala: Escala, Parametros: Parametros, Contexto?: ContextoNormativo): [Criterio[], Normativo] {
  const Normativo = VerificarLimitesNormativos(Sim, Escala, Parametros, Contexto);
  return [
    [...CriteriosDeMarcha(Sim, Parametros), ...CriteriosDeOnset(Normativo, Escala, Parametros), ...CriteriosNormativos(Normativo), ...CriteriosDeCabeza(Sim, Parametros)],
    Normativo,
  ];
}

// ------------------------------------------------------------ PeorCarroPorCriterio.m
export function PeorCarroPorCriterio(Posteriores: Criterio[], PorCarro: Criterio[][], Carros: number[], Cantidad: number): Criterio[] {
  const salida = [...Posteriores];
  PorCarro[0]!.forEach((primera, j) => {
    const Indice = salida.findIndex((c) => c.Nombre === primera.Nombre);
    if (Indice < 0) return;
    const Lineas = PorCarro.map((C) => C[j]!);
    const Peor = ElegirPeor(Lineas);
    const Prefijo = Carros.length === 1 ? `Carro ${Carros[0]} de ${Cantidad} (solo se calcula ese). ` : `Peor carro: ${Carros[Peor]} de ${Cantidad}. `;
    salida[Indice] = { ...Lineas[Peor]!, Detalle: Prefijo + Lineas[Peor]!.Detalle };
  });
  return salida;
}

function ElegirPeor(Lineas: Criterio[]): number {
  if (Lineas[0]!.Sentido === 'Informativo') {
    const Valores = Lineas.map((l) => l.Valor);
    if (Valores.every((v) => Number.isNaN(v))) return 0;
    return indiceDe(Valores, Lineas[0]!.Nombre.includes('maxima') ? 'max' : 'min');
  }
  const NoPasa = Lineas.map((l, i) => (l.Pasa ? -1 : i)).filter((i) => i >= 0);
  if (NoPasa.length > 0) {
    const M = NoPasa.map((i) => (Number.isNaN(Lineas[i]!.Margen) ? -Infinity : Lineas[i]!.Margen));
    return NoPasa[indiceDe(M, 'min')]!;
  }
  return indiceDe(Lineas.map((l) => (Number.isNaN(l.Margen) ? Infinity : l.Margen)), 'min');
}

/** Primer indice del max/min ignorando NaN, como [~, k] = max(...) de MATLAB. */
function indiceDe(valores: number[], cual: 'max' | 'min'): number {
  let k = -1;
  for (let i = 0; i < valores.length; i++) {
    const v = valores[i]!;
    if (Number.isNaN(v)) continue;
    if (k < 0 || (cual === 'max' ? v > valores[k]! : v < valores[k]!)) k = i;
  }
  return Math.max(k, 0);
}

// ------------------------------------------------------------ DisenarParaElTren.m
interface Diseno {
  Carro: number;
  Track: Track;
  Diagnostico: Diagnostico;
  Tren: TrenSimulado;
  Sims: (Sim | null)[];
  Utilizacion: number[];
  Iteraciones: number;
  Residuo: number;
  Convergio: boolean;
}

interface ContextoDelDiseno {
  EstadoEntrada: Estado;
  Parametros: Parametros;
  Receta: Receta;
  TracksPrevios: Track[];
  Distancias: number[];
  Calculados: number[];
}

export function DisenarParaElTren(
  EstadoEntrada: Estado, Parametros: Parametros, Receta: Receta, Layout: Layout | null, TrackInicial: Track, DiagnosticoInicial: Diagnostico,
): [Track, Diagnostico, TrenSimulado, (Sim | null)[], InfoDelTren] {
  const inicio = performance.now();
  const MetodoBase = DiagnosticoInicial.Metodo;
  const Distancias = DistanciasDelTren(Parametros);
  const Cantidad = Distancias.length;
  const Calculados = Parametros.CalcularTodosLosCarros ? Array.from({ length: Cantidad }, (_, i) => i + 1) : [1];
  let Candidatos: number[];
  switch (Parametros.DisenoDelTren) {
    case 'Particula':
      Candidatos = [];
      break;
    case 'PrimerCarro':
      Candidatos = [1];
      break;
    case 'CarroCritico':
      Candidatos = Calculados;
      break;
    default:
      throw new Error(`DisenoDelTren no reconocido: ${String(Parametros.DisenoDelTren)}. Las opciones son 'Particula', 'PrimerCarro' o 'CarroCritico'.`);
  }
  const Contexto: ContextoDelDiseno = {
    EstadoEntrada, Parametros, Receta, TracksPrevios: Layout ? Layout.Elementos.map((r) => r.Elemento.Track) : [], Distancias, Calculados,
  };

  const PeorUtilizacion = new Array<number>(Cantidad).fill(NaN);
  let Mejor: Diseno | null = Candidatos.length === 0 ? SimularSinRedisenar(TrackInicial, DiagnosticoInicial, Contexto) : null;
  for (const c of Candidatos) {
    const D = DisenarParaCarro(c, TrackInicial, DiagnosticoInicial, Contexto);
    PeorUtilizacion[c - 1] = maximo(D.Utilizacion);
    if (!Mejor || PeorUtilizacion[c - 1]! < maximo(Mejor.Utilizacion)) Mejor = D;
  }
  const M = Mejor!;
  const Diagnostico: Diagnostico = {
    ...M.Diagnostico,
    Metodo: M.Carro > 0 ? `${MetodoBase}; tren de ${Cantidad} carros, disenado para el carro ${M.Carro}` : `${MetodoBase}; tren de ${Cantidad} carros, disenado con la masa puntual`,
    IteracionesPuntoFijo: M.Iteraciones,
    ResiduoPuntoFijo: M.Residuo,
    TiempoDeComputo: (performance.now() - inicio) / 1000,
  };
  return [M.Track, Diagnostico, M.Tren, M.Sims, {
    CarroDeDiseno: M.Carro, Iteraciones: M.Iteraciones, Residuo: M.Residuo, Convergio: M.Convergio,
    Utilizacion: M.Utilizacion, PeorUtilizacionPorCandidato: PeorUtilizacion, Calculados,
  }];
}

function SimularEnElTren(Track: Track, Contexto: ContextoDelDiseno): { Tren: TrenSimulado; Sims: (Sim | null)[]; Utilizacion: number[] } {
  const { Parametros, Distancias } = Contexto;
  const Geo = GeometriaDelTren([...Contexto.TracksPrevios, Track], Parametros);
  const Inicio = InicioDelTren(Contexto.EstadoEntrada, Track, Parametros);
  const Tren = SimularTren(Geo, Parametros, Inicio, Track.LongitudArco[Track.LongitudArco.length - 1]! + Distancias[Distancias.length - 1]!);
  const Sims: (Sim | null)[] = new Array(Distancias.length).fill(null);
  const Utilizacion = new Array<number>(Distancias.length).fill(NaN);
  for (const i of Contexto.Calculados) {
    const S = SimDelCarro(Track, Tren, i, Parametros);
    Sims[i - 1] = S;
    Utilizacion[i - 1] = UtilizacionNormativa(S);
  }
  return { Tren, Sims, Utilizacion };
}

function SimularSinRedisenar(Track: Track, Diagnostico: Diagnostico, Contexto: ContextoDelDiseno): Diseno {
  const { Tren, Sims, Utilizacion } = SimularEnElTren(Track, Contexto);
  return { Carro: 0, Track, Diagnostico, Tren, Sims, Utilizacion, Iteraciones: 0, Residuo: 0, Convergio: true };
}

function DisenarParaCarro(Carro: number, TrackInicial: Track, DiagnosticoInicial: Diagnostico, Contexto: ContextoDelDiseno): Diseno {
  const { Parametros } = Contexto;
  let Track = TrackInicial;
  let Diagnostico = DiagnosticoInicial;
  let PerfilUsado: ((s: number) => number) | null = null;
  let Residuo = Infinity;
  let Convergio = false;
  let Iteracion = 0;
  let Resultado = SimularEnElTren(Track, Contexto);
  for (Iteracion = 1; Iteracion <= Parametros.MaxIteracionesPuntoFijo; Iteracion++) {
    if (Iteracion > 1) Resultado = SimularEnElTren(Track, Contexto);
    const Perfil = Resultado.Sims[Carro - 1]!.VelocidadCentroDeMasa;
    if (PerfilUsado) {
      const f = PerfilUsado;
      Residuo = maximo(Array.from(Perfil, (v, i) => Math.abs(v - f(Track.LongitudArco[i]!))));
      if (Residuo < Parametros.TolVelocidadDelTren) {
        Convergio = true;
        break;
      }
    }
    if (Array.from(Perfil).some((v) => Number.isNaN(v))) break;

    const ArcoC: number[] = [];
    const PerfilC: number[] = [];
    for (let i = 0; i < Track.LongitudArco.length; i++) {
      if (i > 0 && !(Track.LongitudArco[i]! - Track.LongitudArco[i - 1]! > 1e-9)) continue;
      ArcoC.push(Track.LongitudArco[i]!);
      PerfilC.push(Perfil[i]!);
    }
    PerfilUsado = interpolantePchip(ArcoC, PerfilC);
    const Derivada = interpolantePchip(ArcoC, DerivadaPorArco(PerfilC.map((v) => v * v), ArcoC));
    const EstadoDiseno: Estado = { ...Contexto.EstadoEntrada, Velocidad: Perfil[0]! };
    const [NuevoTrack, D] = GenerarGeometria(EstadoDiseno, Parametros, Contexto.Receta, null, Derivada);
    Track = NuevoTrack;
    Diagnostico = { ...Diagnostico, ...D };
  }
  if (Iteracion > Parametros.MaxIteracionesPuntoFijo) Iteracion = Parametros.MaxIteracionesPuntoFijo;
  return { Carro, Track, Diagnostico, Tren: Resultado.Tren, Sims: Resultado.Sims, Utilizacion: Resultado.Utilizacion, Iteraciones: Iteracion, Residuo, Convergio };
}

// ------------------------------------------------------------ VerificarTrenDelLayout.m
export function VerificarTrenDelLayout(Layout: Layout): Layout {
  const NumeroDeElementos = Layout.Elementos.length;
  if (NumeroDeElementos === 0) return Layout;
  const Parametros = Layout.Elementos[0]!.Elemento.Parametros;
  const Distancias = DistanciasDelTren(Parametros);
  const Cantidad = Distancias.length;
  const Calculados = Parametros.CalcularTodosLosCarros ? Array.from({ length: Cantidad }, (_, i) => i + 1) : [1];

  const Tracks = Layout.Elementos.map((r) => r.Elemento.Track);
  const Geo = GeometriaDelTren(Tracks, Parametros);
  const Inicio = InicioDelTren(Layout.Elementos[0]!.Elemento.EstadoEntrada, Tracks[0]!, Parametros);
  const Tren = SimularTren(Geo, Parametros, Inicio, Geo.Fin + Distancias[Cantidad - 1]!);

  const Sims: (Sim | null)[][] = Layout.Elementos.map(() => new Array<Sim | null>(Cantidad).fill(null));
  const Escalas = Layout.Elementos.map((r) => EscalasDeFroude(r.Elemento.Parametros));
  Layout.Elementos.forEach((r, e) => {
    for (const i of Calculados) Sims[e]![i - 1] = SimDelCarro(r.Elemento.Track, Tren, i, r.Elemento.Parametros);
  });

  const Lineas: Criterio[][][] = Layout.Elementos.map(() => new Array(Cantidad));
  const Normativos: Normativo[][] = Layout.Elementos.map(() => new Array(Cantidad));
  for (const i of Calculados) {
    const Serie = SerieNormativaDelLayout(Sims.map((fila) => fila[i - 1]!), Escalas.map((x) => x.RaizLambdaLoop));
    Layout.Elementos.forEach((r, e) => {
      [Lineas[e]![i - 1]!, Normativos[e]![i - 1]!] = CriteriosDelCarro(Sims[e]![i - 1]!, Escalas[e]!, r.Elemento.Parametros, { ...Serie, Elemento: e });
    });
  }

  const Elementos = Layout.Elementos.map((Registro, e) => {
    const Elemento = { ...Registro.Elemento, Sim: ConEnergiaDelTren(Sims[e]![0]!, Registro.Elemento.Track, Tren), SimCarros: Sims[e]! };
    if (!Registro.Reporte) return { ...Registro, Elemento };
    const Carros: (ReporteDelCarro | null)[] = new Array(Cantidad).fill(null);
    for (const i of Calculados) Carros[i - 1] = { Posteriores: Lineas[e]![i - 1]!, Normativo: Normativos[e]![i - 1]! };
    const Posteriores = PeorCarroPorCriterio(Registro.Reporte.Posteriores, Calculados.map((i) => Lineas[e]![i - 1]!), Calculados, Cantidad);
    const n = Elemento.Sim.Tiempo.length;
    const Resumen = ResumenDelTren({
      ...Registro.Reporte.Resumen,
      TiempoDeRecorrido: Elemento.Sim.Tiempo[n - 1]!,
      EnergiaDisipadaRodadura: Elemento.Sim.EnergiaDisipadaRodadura[n - 1]!,
      EnergiaDisipadaArrastre: Elemento.Sim.EnergiaDisipadaArrastre[n - 1]!,
    }, Calculados.map((i) => Sims[e]![i - 1]!));
    return { ...Registro, Elemento, Reporte: { ...Registro.Reporte, Carros, Posteriores, Normativo: Normativos[e]![0]!, Resumen } };
  });
  return { ...Layout, Elementos, Tren };
}
