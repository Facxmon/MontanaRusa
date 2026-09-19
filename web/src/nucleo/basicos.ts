// Port de las piezas chicas del nucleo: EscalasDeFroude, EstadoInicial,
// MarcoCarroDesdeTransporte / MarcoTransporteDesdeCarro, Ortonormalizar,
// PerfilRollQuintico, BrazoDeVerificacion, CargasEnLaVia, ResistenciaAlAvance,
// RegistroVacio / AgregarNodo / RecortarRegistro y DerivadaPorArco.

import { cruz, escalar, gradiente, interp1Lineal, normalizar, punto, resta, type Vec3 } from './matematica';
import type { Escala, Estado, Parametros, Punto, Registro } from './tipos';

// ------------------------------------------------------------ Froude
export function EscalasDeFroude(Parametros: Parametros): Escala {
  const LambdaLoop = Parametros.RadioDeReferenciaReal / Parametros.RadioDeReferencia;
  const LambdaCarro = Parametros.LargoCarroReal / Parametros.LargoCarro;
  const RaizLambdaLoop = Math.sqrt(LambdaLoop);
  const Distorsion = LambdaCarro / LambdaLoop;
  const OnsetMaximo: Vec3 =
    Parametros.OnsetMaximoModelo === null
      ? escalar(RaizLambdaLoop, Parametros.OnsetNormativoPorEje)
      : [...Parametros.OnsetMaximoModelo];
  return {
    LambdaLoop,
    LambdaCarro,
    RaizLambdaLoop,
    Distorsion,
    CarrosEquivalentes: Parametros.NumeroDeCarros / Distorsion,
    OnsetMaximo,
    FactorLongitud: 1 / LambdaLoop,
    FactorVelocidad: 1 / RaizLambdaLoop,
    FactorTiempo: 1 / RaizLambdaLoop,
    FactorAceleracion: 1,
    FactorJerk: RaizLambdaLoop,
  };
}

// ------------------------------------------------------------ estado
export function EstadoInicial(Posicion: Vec3, VersorTangente: Vec3, VersorArribaCarro: Vec3, Velocidad: number, Parametros: Parametros): Estado {
  const T = normalizar(VersorTangente);
  const UsinProyeccion = resta(VersorArribaCarro, escalar(punto(VersorArribaCarro, T), T));
  const U = normalizar(UsinProyeccion);
  const P: Vec3 = [Posicion[0], Posicion[1], Posicion[2]];
  return {
    Posicion: P,
    VersorTangente: T,
    VersorArribaCarro: U,
    VersorLateral: cruz(T, U),
    VectorCurvatura: [0, 0, 0],
    DerivadaCurvatura: 0,
    AnguloRoll: 0,
    VelocidadRoll: 0,
    AceleracionRoll: 0,
    LongitudAcumulada: 0,
    Velocidad,
    // Energia del centro de masa, que esta d*U por encima del riel.
    EnergiaTotal:
      0.5 * Parametros.Masa * (Velocidad * Velocidad) +
      Parametros.Masa * Parametros.Gravedad * (P[2] + Parametros.DistanciaHeartline * U[2]),
  };
}

// ------------------------------------------------------------ marcos y roll
export function MarcoCarroDesdeTransporte(Upt: Vec3, Lpt: Vec3, AnguloRoll: number): [Vec3, Vec3] {
  const c = Math.cos(AnguloRoll);
  const s = Math.sin(AnguloRoll);
  return [
    [c * Upt[0] + s * Lpt[0], c * Upt[1] + s * Lpt[1], c * Upt[2] + s * Lpt[2]],
    [-s * Upt[0] + c * Lpt[0], -s * Upt[1] + c * Lpt[1], -s * Upt[2] + c * Lpt[2]],
  ];
}

export function MarcoTransporteDesdeCarro(U: Vec3, L: Vec3, AnguloRoll: number): [Vec3, Vec3] {
  const c = Math.cos(AnguloRoll);
  const s = Math.sin(AnguloRoll);
  return [
    [c * U[0] - s * L[0], c * U[1] - s * L[1], c * U[2] - s * L[2]],
    [s * U[0] + c * L[0], s * U[1] + c * L[1], s * U[2] + c * L[2]],
  ];
}

/** Gram-Schmidt sobre el marco, con L = T x U. */
export function Ortonormalizar(T0: Vec3, U0: Vec3): [Vec3, Vec3, Vec3] {
  const T = normalizar(T0);
  const U = normalizar(resta(U0, escalar(punto(U0, T), T)));
  return [T, U, cruz(T, U)];
}

/** Smoothstep quintico phi(u) = phi0 + Dphi (6u^5 - 15u^4 + 10u^3). */
export function PerfilRollQuintico(RollInicial: number, RollFinal: number, LongitudTransicion: number, Arco: number): [number, number, number] {
  const DeltaRoll = RollFinal - RollInicial;
  if (LongitudTransicion <= 0) return [RollFinal, 0, 0];
  const u = Math.min(Math.max(Arco / LongitudTransicion, 0), 1);
  const u2 = u * u;
  const u3 = u2 * u;
  const u4 = u3 * u;
  const u5 = u4 * u;
  return [
    RollInicial + DeltaRoll * (6 * u5 - 15 * u4 + 10 * u3),
    (DeltaRoll * (30 * u4 - 60 * u3 + 30 * u2)) / LongitudTransicion,
    (DeltaRoll * (120 * u3 - 180 * u2 + 60 * u)) / (LongitudTransicion * LongitudTransicion),
  ];
}

// ------------------------------------------------------------ cargas
export function BrazoDeVerificacion(Parametros: Parametros): number {
  switch (Parametros.PuntoDeVerificacionNormativa) {
    case 'Heartline':
      return Parametros.DistanciaHeartline;
    case 'Cabeza':
      return Parametros.DistanciaHeartline + Parametros.DistanciaHeartlineACabeza;
    default:
      throw new Error(
        `PuntoDeVerificacionNormativa tiene que ser 'Heartline' o 'Cabeza', no '${String(Parametros.PuntoDeVerificacionNormativa)}'.`,
      );
  }
}

/** G neta sobre U y L en un punto a distancia Brazo del riel (CargasEnLaVia.m). */
export function CargasEnLaVia(
  CurvaturaArribaCarro: number,
  CurvaturaLateralCarro: number,
  VelocidadRiel: number,
  VelocidadRoll: number,
  AceleracionRoll: number,
  AceleracionTangencial: number,
  ArribaVertical: number,
  LateralVertical: number,
  Brazo: number,
  Gravedad: number,
): [number, number] {
  const Reduccion = 1 - Brazo * CurvaturaArribaCarro;
  const v2 = VelocidadRiel * VelocidadRiel;
  const GArriba = (v2 * (CurvaturaArribaCarro * Reduccion - Brazo * (VelocidadRoll * VelocidadRoll))) / Gravedad + ArribaVertical;
  const GLateral =
    (v2 * CurvaturaLateralCarro * Reduccion) / Gravedad +
    LateralVertical +
    (Brazo * (AceleracionTangencial * VelocidadRoll + v2 * AceleracionRoll)) / Gravedad;
  return [GArriba, GLateral];
}

/** [FuerzaTotal, Rodadura, Arrastre] (ResistenciaAlAvance.m). */
export function ResistenciaAlAvance(Velocidad: number, GArribaHeartline: number, GLateralHeartline: number, Parametros: Parametros): [number, number, number] {
  const Peso = Parametros.Masa * Parametros.Gravedad;
  const CargaPortantes = Math.max(GArribaHeartline, 0) * Peso;
  const CargaRetencion = Math.max(-GArribaHeartline, 0) * Peso;
  const CargaGuia = Math.abs(GLateralHeartline) * Peso;
  const Rodadura = Parametros.CrrPortantes * CargaPortantes + Parametros.CrrRetencion * CargaRetencion + Parametros.CrrGuia * CargaGuia;
  let Arrastre = 0;
  if (Parametros.ModelarArrastre) {
    const AreaEfectiva = Parametros.AreaFrontal * (1 + Parametros.FactorTren * (Parametros.NumeroDeCarros - 1));
    Arrastre = 0.5 * Parametros.RhoAire * Parametros.CoefArrastre * AreaEfectiva * (Velocidad * Velocidad);
  }
  return [Rodadura + Arrastre, Rodadura, Arrastre];
}

// ------------------------------------------------------------ registro
export function RegistroVacio(): Registro {
  return {
    Arco: [], Tiempo: [], CurvaturaArriba: [], CurvaturaLateral: [], Curvatura: [],
    CurvaturaArribaCarro: [], CurvaturaLateralCarro: [], AnguloRoll: [], VelocidadRoll: [], AceleracionRoll: [],
    Velocidad: [], VelocidadCentroDeMasa: [], FactorVelocidadHeartline: [], AceleracionTangencial: [],
    GArribaHeartline: [], GLateralHeartline: [], GArribaVerificacion: [], GLateralVerificacion: [],
    PerdidaRodadura: [], PerdidaArrastre: [], AnguloGirado: [],
    Posicion: [], VersorTangente: [], VersorArribaTransporte: [], VersorLateralTransporte: [],
    VersorArribaCarro: [], VersorLateral: [], VectorCurvatura: [],
    NumeroDeNodos: 0,
  };
}

export function AgregarNodo(Registro: Registro, P: Punto): void {
  Registro.Arco.push(P.Arco);
  Registro.Posicion.push(P.Posicion);
  Registro.VersorTangente.push(P.VersorTangente);
  Registro.VersorArribaTransporte.push(P.VersorArribaTransporte);
  Registro.VersorLateralTransporte.push(P.VersorLateralTransporte);
  Registro.VersorArribaCarro.push(P.VersorArribaCarro);
  Registro.VersorLateral.push(P.VersorLateral);
  Registro.VectorCurvatura.push(P.VectorCurvatura);
  Registro.CurvaturaArriba.push(P.CurvaturaArriba);
  Registro.CurvaturaLateral.push(P.CurvaturaLateral);
  Registro.Curvatura.push(P.Curvatura);
  Registro.CurvaturaArribaCarro.push(P.CurvaturaArribaCarro);
  Registro.CurvaturaLateralCarro.push(P.CurvaturaLateralCarro);
  Registro.AnguloRoll.push(P.AnguloRoll);
  Registro.VelocidadRoll.push(P.VelocidadRoll);
  Registro.AceleracionRoll.push(P.AceleracionRoll);
  Registro.Velocidad.push(P.Velocidad);
  Registro.VelocidadCentroDeMasa.push(P.VelocidadCentroDeMasa);
  Registro.FactorVelocidadHeartline.push(P.FactorVelocidadHeartline);
  Registro.AceleracionTangencial.push(P.AceleracionTangencial);
  Registro.GArribaHeartline.push(P.GArribaHeartline);
  Registro.GLateralHeartline.push(P.GLateralHeartline);
  Registro.GArribaVerificacion.push(P.GArribaVerificacion);
  Registro.GLateralVerificacion.push(P.GLateralVerificacion);
  Registro.PerdidaRodadura.push(P.PerdidaRodadura);
  Registro.PerdidaArrastre.push(P.PerdidaArrastre);
  Registro.AnguloGirado.push(P.AnguloGirado);
  Registro.Tiempo.push(P.Tiempo);
  Registro.NumeroDeNodos = Registro.Arco.length;
}

// ------------------------------------------------------------ derivadas sobre la polilinea
/**
 * DerivadaPorArco.m: gradient sobre los nodos distintos (diff > 1e-9) y
 * vuelta a la grilla completa por interpolacion lineal con extrapolacion.
 */
export function DerivadaPorArco(Valores: ArrayLike<number>, Arco: ArrayLike<number>): Float64Array {
  const n = Arco.length;
  const conservar: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0 || Arco[i]! - Arco[i - 1]! > 1e-9) conservar.push(i);
  }
  const salida = new Float64Array(n).fill(NaN);
  if (conservar.length < 2) return salida;
  const arcoUtil = Float64Array.from(conservar, (i) => Arco[i]!);
  const valoresUtil = Float64Array.from(conservar, (i) => Valores[i]!);
  const derivadaUtil = gradiente(valoresUtil, arcoUtil);
  for (let i = 0; i < n; i++) salida[i] = interp1Lineal(arcoUtil, derivadaUtil, Arco[i]!, 'extrap');
  return salida;
}

/** DerivadaPorArco sobre una matriz n x 3 guardada como Vec3[]. */
export function DerivadaPorArcoVec3(Valores: Vec3[], Arco: ArrayLike<number>): Vec3[] {
  const columnas = [0, 1, 2].map((c) => DerivadaPorArco(Valores.map((v) => v[c]!), Arco));
  return Valores.map((_, i) => [columnas[0]![i]!, columnas[1]![i]!, columnas[2]![i]!]);
}
