// Port de Fisica/SimularSobreTrack.m: el estado dinamico del carro sobre una
// geometria ya congelada. RK4 sobre la energia del centro de masa con la
// geometria interpolada (pchip) entre nodos, y transporte de cuerpo rigido de
// la G a los tres brazos (centro de masa, verificacion, cabeza).

import { BrazoDeVerificacion, CargasEnLaVia, DerivadaPorArco, DerivadaPorArcoVec3, ResistenciaAlAvance } from './basicos';
import { cruz, interpolantePchip, punto as productoPunto, type Vec3 } from './matematica';
import type { Estado, Parametros, Sim, Track } from './tipos';

interface Geometria {
  TangenteVertical: (s: number) => number;
  ArribaVertical: (s: number) => number;
  LateralVertical: (s: number) => number;
  CurvaturaArribaCarro: (s: number) => number;
  CurvaturaLateralCarro: (s: number) => number;
  VelocidadRoll: (s: number) => number;
  AceleracionRoll: (s: number) => number;
}

export function SimularSobreTrack(Track: Track, EstadoEntrada: Estado, Parametros: Parametros): Sim {
  const g = Parametros.Gravedad;
  const d = Parametros.DistanciaHeartline;
  const Arco = Track.LongitudArco;
  const NumeroDeNodos = Arco.length;

  const CurvaturaArribaCarro = new Float64Array(NumeroDeNodos);
  const CurvaturaLateralCarro = new Float64Array(NumeroDeNodos);
  for (let k = 0; k < NumeroDeNodos; k++) {
    CurvaturaArribaCarro[k] = productoPunto(Track.VectorCurvatura[k]!, Track.VersorArribaCarro[k]!);
    CurvaturaLateralCarro[k] = productoPunto(Track.VectorCurvatura[k]!, Track.VersorLateral[k]!);
  }

  const Geometria: Geometria = {
    TangenteVertical: Interpolante(Arco, Track.VersorTangente.map((v) => v[2])),
    ArribaVertical: Interpolante(Arco, Track.VersorArribaCarro.map((v) => v[2])),
    LateralVertical: Interpolante(Arco, Track.VersorLateral.map((v) => v[2])),
    CurvaturaArribaCarro: Interpolante(Arco, CurvaturaArribaCarro),
    CurvaturaLateralCarro: Interpolante(Arco, CurvaturaLateralCarro),
    VelocidadRoll: Interpolante(Arco, Track.VelocidadRoll),
    AceleracionRoll: Interpolante(Arco, Track.AceleracionRoll),
  };

  const VelocidadCentroDeMasa = new Float64Array(NumeroDeNodos).fill(NaN);
  const Tiempo = new Float64Array(NumeroDeNodos).fill(NaN);
  const FuerzaRodadura = new Float64Array(NumeroDeNodos);
  const FuerzaArrastre = new Float64Array(NumeroDeNodos);
  let PuntoDeParada: number | null = null;

  let VelocidadCuadrado = EstadoEntrada.Velocidad ** 2;
  let t = 0;
  for (let k = 0; k < NumeroDeNodos; k++) {
    if (VelocidadCuadrado <= 0) {
      PuntoDeParada = k;
      break;
    }
    VelocidadCentroDeMasa[k] = Math.sqrt(VelocidadCuadrado);
    Tiempo[k] = t;
    const [, Rodadura, Arrastre] = ResistenciaEnArco(Arco[k]!, VelocidadCuadrado, Geometria, Parametros);
    FuerzaRodadura[k] = Rodadura;
    FuerzaArrastre[k] = Arrastre;
    if (k === NumeroDeNodos - 1) break;
    const Paso = Arco[k + 1]! - Arco[k]!;
    [VelocidadCuadrado, t] = PasoDeEnergia(Arco[k]!, VelocidadCuadrado, t, Paso, Geometria, Parametros);
  }
  if (PuntoDeParada !== null) {
    for (let k = PuntoDeParada; k < NumeroDeNodos; k++) {
      VelocidadCentroDeMasa[k] = NaN;
      Tiempo[k] = NaN;
    }
  }

  // ------------- magnitudes derivadas, ya vectorizadas -----------------
  const FactorVelocidadHeartline = new Float64Array(NumeroDeNodos);
  const Velocidad = new Float64Array(NumeroDeNodos);
  for (let k = 0; k < NumeroDeNodos; k++) {
    FactorVelocidadHeartline[k] = Math.hypot(1 - d * CurvaturaArribaCarro[k]!, d * Track.VelocidadRoll[k]!);
    Velocidad[k] = VelocidadCentroDeMasa[k]! / FactorVelocidadHeartline[k]!;
  }

  const EnergiaDisipadaRodadura = new Float64Array(NumeroDeNodos);
  const EnergiaDisipadaArrastre = new Float64Array(NumeroDeNodos);
  let acumuladaR = 0;
  let acumuladaA = 0;
  for (let k = 0; k < NumeroDeNodos; k++) {
    const PasoEntreNodos = k < NumeroDeNodos - 1 ? Arco[k + 1]! - Arco[k]! : 0;
    acumuladaR += FuerzaRodadura[k]! * PasoEntreNodos;
    acumuladaA += FuerzaArrastre[k]! * PasoEntreNodos;
    EnergiaDisipadaRodadura[k] = acumuladaR;
    EnergiaDisipadaArrastre[k] = acumuladaA;
  }

  const dVcm = DerivadaPorArco(VelocidadCentroDeMasa, Arco);
  const dV = DerivadaPorArco(Velocidad, Arco);
  const AceleracionTangencial = new Float64Array(NumeroDeNodos);
  const AceleracionTangencialRiel = new Float64Array(NumeroDeNodos);
  for (let k = 0; k < NumeroDeNodos; k++) {
    AceleracionTangencial[k] = dVcm[k]! * Velocidad[k]!;
    AceleracionTangencialRiel[k] = dV[k]! * Velocidad[k]!;
  }

  const BrazoVerificacion = BrazoDeVerificacion(Parametros);
  const BrazoCabeza = d + Parametros.DistanciaHeartlineACabeza;

  const [, GLateralHeartline, GArribaHeartline] = GTransportada(Track, Velocidad, AceleracionTangencialRiel, d, Parametros);
  const [Gx, Gy, Gz] = GTransportada(Track, Velocidad, AceleracionTangencialRiel, BrazoVerificacion, Parametros);
  const [GxCabeza, GyCabeza, GzCabeza] = GTransportada(Track, Velocidad, AceleracionTangencialRiel, BrazoCabeza, Parametros);

  const FuerzaNormal = new Float64Array(NumeroDeNodos);
  const EnergiaCinetica = new Float64Array(NumeroDeNodos);
  const EnergiaPotencial = new Float64Array(NumeroDeNodos);
  const EnergiaTotal = new Float64Array(NumeroDeNodos);
  for (let k = 0; k < NumeroDeNodos; k++) {
    FuerzaNormal[k] = Parametros.Masa * g * Math.hypot(GArribaHeartline[k]!, GLateralHeartline[k]!);
    EnergiaCinetica[k] = 0.5 * Parametros.Masa * VelocidadCentroDeMasa[k]! ** 2;
    EnergiaPotencial[k] = Parametros.Masa * g * Track.PuntosHeartline[k]![2];
    EnergiaTotal[k] = EnergiaCinetica[k]! + EnergiaPotencial[k]!;
  }

  const dGx = DerivadaPorArco(Gx, Arco);
  const dGy = DerivadaPorArco(Gy, Arco);
  const dGz = DerivadaPorArco(Gz, Arco);
  const JerkGx = new Float64Array(NumeroDeNodos);
  const JerkGy = new Float64Array(NumeroDeNodos);
  const JerkGz = new Float64Array(NumeroDeNodos);
  for (let k = 0; k < NumeroDeNodos; k++) {
    JerkGx[k] = dGx[k]! * Velocidad[k]!;
    JerkGy[k] = dGy[k]! * Velocidad[k]!;
    JerkGz[k] = dGz[k]! * Velocidad[k]!;
  }

  let AvisoVelocidadDeDiseno = '';
  if (Math.abs(EstadoEntrada.Velocidad - Track.VelocidadDeDiseno) > Parametros.ToleranciaVelocidadDeDiseno) {
    AvisoVelocidadDeDiseno =
      `La velocidad de entrada (${EstadoEntrada.Velocidad.toFixed(3)} m/s) difiere de la de diseno (${Track.VelocidadDeDiseno.toFixed(3)} m/s) en mas de ` +
      `${Parametros.ToleranciaVelocidadDeDiseno.toFixed(3)} m/s. La geometria no cambia, pero conviene regenerar el elemento.`;
  }

  return {
    VelocidadCentroDeMasa, Tiempo, FuerzaRodadura, FuerzaArrastre, PuntoDeParada, FactorVelocidadHeartline, Velocidad,
    EnergiaDisipadaRodadura, EnergiaDisipadaArrastre, AceleracionTangencial, GLateralHeartline, GArribaHeartline,
    Gx, Gy, Gz, GxCabeza, GyCabeza, GzCabeza, BrazoDeVerificacion: BrazoVerificacion, FuerzaNormal,
    EnergiaCinetica, EnergiaPotencial, EnergiaTotal, JerkGx, JerkGy, JerkGz,
    VelocidadDeDiseno: Track.VelocidadDeDiseno, AvisoVelocidadDeDiseno,
  };
}

// ========================= auxiliares =====================================
/** G en un punto a distancia Brazo del riel, por transporte de cuerpo rigido. Devuelve [Gx, Gy, Gz]. */
function GTransportada(Track: Track, Velocidad: Float64Array, AceleracionTangencialRiel: Float64Array, Brazo: number, Parametros: Parametros): [Float64Array, Float64Array, Float64Array] {
  const g = Parametros.Gravedad;
  const Arco = Track.LongitudArco;
  const n = Arco.length;
  const Gx = new Float64Array(n);
  const Gy = new Float64Array(n);
  const Gz = new Float64Array(n);

  const Aceleracion: Vec3[] = new Array(n);
  for (let k = 0; k < n; k++) {
    const T = Track.VersorTangente[k]!;
    const kv = Track.VectorCurvatura[k]!;
    const v2 = Velocidad[k]! ** 2;
    Aceleracion[k] = [
      AceleracionTangencialRiel[k]! * T[0] + v2 * kv[0],
      AceleracionTangencialRiel[k]! * T[1] + v2 * kv[1],
      AceleracionTangencialRiel[k]! * T[2] + v2 * kv[2],
    ];
  }

  if (Brazo !== 0) {
    const Omega: Vec3[] = new Array(n);
    for (let k = 0; k < n; k++) {
      const T = Track.VersorTangente[k]!;
      const TxK = cruz(T, Track.VectorCurvatura[k]!);
      const phi = Track.VelocidadRoll[k]!;
      const v = Velocidad[k]!;
      Omega[k] = [v * (TxK[0] + phi * T[0]), v * (TxK[1] + phi * T[1]), v * (TxK[2] + phi * T[2])];
    }
    const dOmega = DerivadaPorArcoVec3(Omega, Arco);
    for (let k = 0; k < n; k++) {
      const v = Velocidad[k]!;
      const DerivadaOmega: Vec3 = [v * dOmega[k]![0], v * dOmega[k]![1], v * dOmega[k]![2]];
      const U = Track.VersorArribaCarro[k]!;
      const r: Vec3 = [Brazo * U[0], Brazo * U[1], Brazo * U[2]];
      const euler = cruz(DerivadaOmega, r);
      const centripeta = cruz(Omega[k]!, cruz(Omega[k]!, r));
      const a = Aceleracion[k]!;
      Aceleracion[k] = [a[0] + euler[0] + centripeta[0], a[1] + euler[1] + centripeta[1], a[2] + euler[2] + centripeta[2]];
    }
  }

  for (let k = 0; k < n; k++) {
    const a = Aceleracion[k]!;
    const Fuerza: Vec3 = [a[0], a[1], a[2] + g];
    const sinVelocidad = Number.isNaN(Velocidad[k]!);
    Gx[k] = sinVelocidad ? NaN : productoPunto(Fuerza, Track.VersorTangente[k]!) / g;
    Gy[k] = sinVelocidad ? NaN : productoPunto(Fuerza, Track.VersorLateral[k]!) / g;
    Gz[k] = sinVelocidad ? NaN : productoPunto(Fuerza, Track.VersorArribaCarro[k]!) / g;
  }
  return [Gx, Gy, Gz];
}

function PasoDeEnergia(Arco: number, VelocidadCuadrado: number, Tiempo: number, Paso: number, Geometria: Geometria, Parametros: Parametros): [number, number] {
  const k1 = DerivadaDeEnergia(Arco, VelocidadCuadrado, Geometria, Parametros);
  const k2 = DerivadaDeEnergia(Arco + Paso / 2, VelocidadCuadrado + (Paso / 2) * k1[0], Geometria, Parametros);
  const k3 = DerivadaDeEnergia(Arco + Paso / 2, VelocidadCuadrado + (Paso / 2) * k2[0], Geometria, Parametros);
  const k4 = DerivadaDeEnergia(Arco + Paso, VelocidadCuadrado + Paso * k3[0], Geometria, Parametros);
  return [
    VelocidadCuadrado + (Paso / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
    Tiempo + (Paso / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
  ];
}

function DerivadaDeEnergia(Arco: number, VelocidadCuadrado: number, Geometria: Geometria, Parametros: Parametros): [number, number] {
  const d = Parametros.DistanciaHeartline;
  const v2 = Math.max(VelocidadCuadrado, 0);
  const VelocidadCentroDeMasa = Math.sqrt(v2);
  const [FuerzaResistencia, , , FactorVelocidadHeartline] = ResistenciaEnArco(Arco, v2, Geometria, Parametros);
  const DerivadaAlturaCentroDeMasa =
    (1 - d * Geometria.CurvaturaArribaCarro(Arco)) * Geometria.TangenteVertical(Arco) + d * Geometria.VelocidadRoll(Arco) * Geometria.LateralVertical(Arco);
  return [
    -2 * Parametros.Gravedad * DerivadaAlturaCentroDeMasa - (2 * FuerzaResistencia) / Parametros.Masa,
    FactorVelocidadHeartline / Math.max(VelocidadCentroDeMasa, 1e-6),
  ];
}

function ResistenciaEnArco(Arco: number, VelocidadCuadrado: number, Geometria: Geometria, Parametros: Parametros): [number, number, number, number] {
  const g = Parametros.Gravedad;
  const d = Parametros.DistanciaHeartline;
  const v2 = Math.max(VelocidadCuadrado, 0);
  const CurvaturaArribaCarro = Geometria.CurvaturaArribaCarro(Arco);
  const CurvaturaLateralCarro = Geometria.CurvaturaLateralCarro(Arco);
  const VelocidadRoll = Geometria.VelocidadRoll(Arco);
  const AceleracionRoll = Geometria.AceleracionRoll(Arco);
  const TangenteVertical = Geometria.TangenteVertical(Arco);
  const FactorVelocidadHeartline = Math.hypot(1 - d * CurvaturaArribaCarro, d * VelocidadRoll);
  const VelocidadRiel = Math.sqrt(v2) / FactorVelocidadHeartline;
  const [GArribaHeartline, GLateralHeartline] = CargasEnLaVia(
    CurvaturaArribaCarro, CurvaturaLateralCarro, VelocidadRiel, VelocidadRoll, AceleracionRoll, -g * TangenteVertical,
    Geometria.ArribaVertical(Arco), Geometria.LateralVertical(Arco), d, g,
  );
  const [FuerzaResistencia, Rodadura, Arrastre] = ResistenciaAlAvance(VelocidadRiel, GArribaHeartline, GLateralHeartline, Parametros);
  return [FuerzaResistencia, Rodadura, Arrastre, FactorVelocidadHeartline];
}

/** Interpolante pchip precompilado sobre los nodos distintos (diff > 1e-9), con extrapolacion lineal. */
function Interpolante(Arco: Float64Array, Valores: ArrayLike<number>): (s: number) => number {
  const conservar: number[] = [];
  for (let i = 0; i < Arco.length; i++) if (i === 0 || Arco[i]! - Arco[i - 1]! > 1e-9) conservar.push(i);
  return interpolantePchip(
    conservar.map((i) => Arco[i]!),
    conservar.map((i) => Valores[i]!),
  );
}
