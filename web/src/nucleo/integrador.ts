// Port de Nucleo/PuntoCinematico.m, DerivadaDeVia.m, PasoRK4.m e
// IntegrarTramo.m: la marcha RK4 sobre el vector de estado de la via.
//
//   y[0..2]   posicion del riel        y[3..5]   T
//   y[6..8]   U del transporte         y[9..11]  L del transporte
//   y[12]     v_cm^2                   y[13]     angulo girado
//   y[14]     tiempo

import { AgregarNodo, BrazoDeVerificacion, CargasEnLaVia, MarcoCarroDesdeTransporte, Ortonormalizar, ResistenciaAlAvance } from './basicos';
import { punto as productoPunto, type Vec3 } from './matematica';
import type { Parametros, Punto, Registro } from './tipos';

export type VectorDeEstado = number[];

export interface Contexto {
  Parametros: Parametros;
  FuncionRoll: (Arco: number, AnguloGiradoRelativo: number) => [number, number, number];
  PerfilVelocidad: ((Arco: number) => number) | null;
  /**
   * Tren: d(v_cm^2)/ds impuesta (la del carro para el que se disena el
   * elemento, DisenarParaElTren); reemplaza a la energia de la particula.
   */
  DerivadaImpuesta?: ((Arco: number) => number) | null;
  VelocidadMinimaDeSeguridad: number;
  InclinacionHelicoidal: number;
  AnguloGiradoDeReferencia: number;
  FuncionCurvatura: (Punto: Punto) => [number, number];
  FuncionAnguloDeCurvatura: ((Punto: Punto) => number) | null;
  /** Peralte alineado a la fuerza (RollHaciaLaFuerza.m); null en los demas casos. */
  PeralteHaciaLaFuerza?: PeralteHaciaLaFuerza | null;
}

export interface PeralteHaciaLaFuerza {
  Desvio: number;
  ArcoInicio: number;
  LongitudTransicion: number;
}

const v3 = (y: VectorDeEstado, i: number): Vec3 => [y[i]!, y[i + 1]!, y[i + 2]!];

/** Campos geometricos de un punto del RIEL, sin evaluar la curvatura. */
export function PuntoCinematico(Arco: number, y: VectorDeEstado, Contexto: Contexto): Punto {
  const AnguloGirado = y[13]!;
  const [AnguloRoll, VelocidadRoll, AceleracionRoll] = Contexto.FuncionRoll(Arco, AnguloGirado - Contexto.AnguloGiradoDeReferencia);
  const VersorArribaTransporte = v3(y, 6);
  const VersorLateralTransporte = v3(y, 9);
  const [VersorArribaCarro, VersorLateral] = MarcoCarroDesdeTransporte(VersorArribaTransporte, VersorLateralTransporte, AnguloRoll);
  const VelocidadCentroDeMasa = Math.sqrt(Math.max(y[12]!, 0));

  const P: Punto = {
    Arco,
    Posicion: v3(y, 0),
    VersorTangente: v3(y, 3),
    VersorArribaTransporte,
    VersorLateralTransporte,
    VelocidadCentroDeMasa,
    AnguloGirado,
    Tiempo: y[14]!,
    AnguloRoll,
    VelocidadRoll,
    AceleracionRoll,
    VersorArribaCarro,
    VersorLateral,
    InclinacionHelicoidal: Contexto.InclinacionHelicoidal,
    AnguloCurvaturaDesdeArriba: 0,
    VelocidadParaCurvatura: VelocidadCentroDeMasa,
    CurvaturaArriba: NaN,
    CurvaturaLateral: NaN,
    VectorCurvatura: [NaN, NaN, NaN],
    Curvatura: NaN,
    CurvaturaArribaCarro: NaN,
    CurvaturaLateralCarro: NaN,
    Velocidad: NaN,
    FactorVelocidadHeartline: NaN,
    GArribaHeartline: NaN,
    GLateralHeartline: NaN,
    GArribaVerificacion: NaN,
    GLateralVerificacion: NaN,
    AceleracionTangencial: NaN,
    PerdidaRodadura: NaN,
    PerdidaArrastre: NaN,
  };
  if (Contexto.FuncionAnguloDeCurvatura) {
    P.AnguloCurvaturaDesdeArriba = Contexto.FuncionAnguloDeCurvatura(P) - AnguloRoll;
  }
  if (Contexto.PerfilVelocidad) {
    P.VelocidadParaCurvatura = Math.max(Contexto.PerfilVelocidad(Arco), Contexto.VelocidadMinimaDeSeguridad);
  }
  // Peralte alineado a la fuerza: el roll de la ley base se reemplaza por el que pone el eje del carro sobre la fuerza.
  if (Contexto.PeralteHaciaLaFuerza) RollHaciaLaFuerza(P, Contexto, Contexto.PeralteHaciaLaFuerza);
  return P;
}

/** AlEjeDeLaFuerza.m: lleva un angulo a (-pi/2, pi/2] (alinear el eje del carro, no su sentido). */
export function AlEjeDeLaFuerza(Angulo: number): number {
  let a = Angulo + Math.PI / 2;
  a = a - Math.PI * Math.floor(a / Math.PI);
  a = a - Math.PI / 2;
  return a === -Math.PI / 2 ? Math.PI / 2 : a;
}

/**
 * RollHaciaLaFuerza.m: roll que pone el eje del carro sobre la fuerza
 * especifica del riel, F = v^2*kappa + g*z, mas el desvio; en el
 * acondicionamiento se mezcla con la ley base con el smoothstep quintico.
 * Unas pocas pasadas de punto fijo porque el modulo de la curvatura depende
 * del roll. phi' y phi'' quedan aproximados (los completa el generador).
 */
function RollHaciaLaFuerza(P: Punto, Contexto: Contexto, Alinear: PeralteHaciaLaFuerza): void {
  const g = Contexto.Parametros.Gravedad;
  const d = Contexto.Parametros.DistanciaHeartline;
  const Longitud = Alinear.LongitudTransicion;
  let Peso = 1;
  let DerivadaPeso = 0;
  let SegundaPeso = 0;
  if (Longitud > 0) {
    const u = Math.min(Math.max((P.Arco - Alinear.ArcoInicio) / Longitud, 0), 1);
    Peso = 6 * u ** 5 - 15 * u ** 4 + 10 * u ** 3;
    DerivadaPeso = (30 * u ** 4 - 60 * u ** 3 + 30 * u ** 2) / Longitud;
    SegundaPeso = (120 * u ** 3 - 180 * u ** 2 + 60 * u) / Longitud ** 2;
  }
  const Base = P.AnguloRoll;
  const BaseV = P.VelocidadRoll;
  const BaseA = P.AceleracionRoll;
  let Roll = Base;
  let Objetivo = Base;
  for (let Iteracion = 1; Iteracion <= 4; Iteracion++) {
    ConRoll(P, Roll, Contexto);
    const [CurvaturaArriba, CurvaturaLateral] = Contexto.FuncionCurvatura(P);
    const CurvaturaSobreU = CurvaturaArriba * Math.cos(Roll) + CurvaturaLateral * Math.sin(Roll);
    const Velocidad = P.VelocidadCentroDeMasa / Math.hypot(1 - d * CurvaturaSobreU, d * BaseV);
    const FuerzaArriba = Velocidad ** 2 * CurvaturaArriba + g * P.VersorArribaTransporte[2];
    const FuerzaLateral = Velocidad ** 2 * CurvaturaLateral + g * P.VersorLateralTransporte[2];
    if (Math.hypot(FuerzaArriba, FuerzaLateral) >= 0.05 * g) {
      Objetivo = Base + AlEjeDeLaFuerza(Math.atan2(FuerzaLateral, FuerzaArriba) - Base) + Alinear.Desvio;
    }
    const RollNuevo = Base + Peso * (Objetivo - Base);
    if (Math.abs(RollNuevo - Roll) < 1e-12) {
      Roll = RollNuevo;
      break;
    }
    Roll = RollNuevo;
  }
  ConRoll(P, Roll, Contexto);
  P.VelocidadRoll = (1 - Peso) * BaseV + DerivadaPeso * (Objetivo - Base);
  P.AceleracionRoll = (1 - Peso) * BaseA - 2 * DerivadaPeso * BaseV + SegundaPeso * (Objetivo - Base);
}

function ConRoll(P: Punto, Roll: number, Contexto: Contexto): void {
  P.AnguloRoll = Roll;
  [P.VersorArribaCarro, P.VersorLateral] = MarcoCarroDesdeTransporte(P.VersorArribaTransporte, P.VersorLateralTransporte, Roll);
  P.AnguloCurvaturaDesdeArriba = Contexto.FuncionAnguloDeCurvatura ? Contexto.FuncionAnguloDeCurvatura(P) - Roll : 0;
}

/** Ecuaciones de la via y de la energia, acopladas. Devuelve [dy/ds, Punto completo]. */
export function DerivadaDeVia(Arco: number, y: VectorDeEstado, Contexto: Contexto): [VectorDeEstado, Punto] {
  const Parametros = Contexto.Parametros;
  const g = Parametros.Gravedad;
  const d = Parametros.DistanciaHeartline;

  const P = PuntoCinematico(Arco, y, Contexto);

  const [CurvaturaArriba, CurvaturaLateral] = Contexto.FuncionCurvatura(P);
  const Upt = P.VersorArribaTransporte;
  const Lpt = P.VersorLateralTransporte;
  const VectorCurvatura: Vec3 = [
    CurvaturaArriba * Upt[0] + CurvaturaLateral * Lpt[0],
    CurvaturaArriba * Upt[1] + CurvaturaLateral * Lpt[1],
    CurvaturaArriba * Upt[2] + CurvaturaLateral * Lpt[2],
  ];
  const Curvatura = Math.hypot(CurvaturaArriba, CurvaturaLateral);

  const CurvaturaArribaCarro = productoPunto(VectorCurvatura, P.VersorArribaCarro);
  const CurvaturaLateralCarro = productoPunto(VectorCurvatura, P.VersorLateral);

  // Roll total por unidad de arco: la transicion quintica mas la parte helicoidal.
  const VelocidadRoll = P.VelocidadRoll + Contexto.InclinacionHelicoidal * Curvatura;

  const FactorVelocidadHeartline = Math.hypot(1 - d * CurvaturaArribaCarro, d * VelocidadRoll);
  const VelocidadRiel = P.VelocidadCentroDeMasa / FactorVelocidadHeartline;

  const AceleracionTangencialEstimada = -g * P.VersorTangente[2];

  const [GArribaHeartline, GLateralHeartline] = CargasEnLaVia(
    CurvaturaArribaCarro, CurvaturaLateralCarro, VelocidadRiel, VelocidadRoll, P.AceleracionRoll,
    AceleracionTangencialEstimada, P.VersorArribaCarro[2], P.VersorLateral[2], d, g,
  );
  const [FuerzaResistencia, Rodadura, Arrastre] = ResistenciaAlAvance(VelocidadRiel, GArribaHeartline, GLateralHeartline, Parametros);

  const Brazo = BrazoDeVerificacion(Parametros);
  let GArribaVerificacion = GArribaHeartline;
  let GLateralVerificacion = GLateralHeartline;
  if (Brazo !== d) {
    [GArribaVerificacion, GLateralVerificacion] = CargasEnLaVia(
      CurvaturaArribaCarro, CurvaturaLateralCarro, VelocidadRiel, VelocidadRoll, P.AceleracionRoll,
      AceleracionTangencialEstimada, P.VersorArribaCarro[2], P.VersorLateral[2], Brazo, g,
    );
  }

  const DerivadaAlturaCentroDeMasa = (1 - d * CurvaturaArribaCarro) * P.VersorTangente[2] + d * VelocidadRoll * P.VersorLateral[2];
  let DerivadaVelocidadCuadrado = -2 * g * DerivadaAlturaCentroDeMasa - (2 * FuerzaResistencia) / Parametros.Masa;
  // Tren: la velocidad no es la de una particula sino la del carro para el
  // que se disena el elemento, que sale de la simulacion del tren completo.
  if (Contexto.DerivadaImpuesta) DerivadaVelocidadCuadrado = Contexto.DerivadaImpuesta(Arco);

  P.CurvaturaArriba = CurvaturaArriba;
  P.CurvaturaLateral = CurvaturaLateral;
  P.VectorCurvatura = VectorCurvatura;
  P.Curvatura = Curvatura;
  P.CurvaturaArribaCarro = CurvaturaArribaCarro;
  P.CurvaturaLateralCarro = CurvaturaLateralCarro;
  P.VelocidadRoll = VelocidadRoll;
  P.Velocidad = VelocidadRiel;
  P.FactorVelocidadHeartline = FactorVelocidadHeartline;
  P.GArribaHeartline = GArribaHeartline;
  P.GLateralHeartline = GLateralHeartline;
  P.GArribaVerificacion = GArribaVerificacion;
  P.GLateralVerificacion = GLateralVerificacion;
  P.AceleracionTangencial = (VelocidadRiel * DerivadaVelocidadCuadrado) / Math.max(2 * P.VelocidadCentroDeMasa, 1e-6);
  P.PerdidaRodadura = Rodadura;
  P.PerdidaArrastre = Arrastre;

  const T = P.VersorTangente;
  const Derivada: VectorDeEstado = [
    T[0], T[1], T[2],
    VectorCurvatura[0], VectorCurvatura[1], VectorCurvatura[2],
    -CurvaturaArriba * T[0], -CurvaturaArriba * T[1], -CurvaturaArriba * T[2],
    -CurvaturaLateral * T[0], -CurvaturaLateral * T[1], -CurvaturaLateral * T[2],
    DerivadaVelocidadCuadrado,
    Curvatura,
    FactorVelocidadHeartline / Math.max(P.VelocidadCentroDeMasa, 1e-6),
  ];
  return [Derivada, P];
}

function masPor(y: VectorDeEstado, factor: number, k: VectorDeEstado): VectorDeEstado {
  const salida = new Array<number>(y.length);
  for (let i = 0; i < y.length; i++) salida[i] = y[i]! + factor * k[i]!;
  return salida;
}

/** Un paso de Runge-Kutta 4. Devuelve [y siguiente, Punto al inicio del paso]. */
export function PasoRK4(Arco: number, y: VectorDeEstado, Paso: number, Contexto: Contexto): [VectorDeEstado, Punto] {
  const [k1, P] = DerivadaDeVia(Arco, y, Contexto);
  const [k2] = DerivadaDeVia(Arco + Paso / 2, masPor(y, Paso / 2, k1), Contexto);
  const [k3] = DerivadaDeVia(Arco + Paso / 2, masPor(y, Paso / 2, k2), Contexto);
  const [k4] = DerivadaDeVia(Arco + Paso, masPor(y, Paso, k3), Contexto);
  const siguiente = new Array<number>(y.length);
  for (let i = 0; i < y.length; i++) {
    siguiente[i] = y[i]! + (Paso / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!);
  }
  return [siguiente, P];
}

function PasoSinAstilla(PasoNominal: number, Faltante: number): number {
  return Faltante < 1.5 * PasoNominal ? Faltante : PasoNominal;
}

/**
 * Integra un sub-tramo volcando los nodos en el registro. El nodo final no
 * se registra: queda como primer nodo del tramo siguiente. Devuelve el
 * estado y el arco al terminar, y cuantos pasos dio.
 */
export function IntegrarTramo(
  Registro: Registro,
  y0: VectorDeEstado,
  Arco0: number,
  Contexto: Contexto,
  Longitud: number,
  DistanciaHastaParar: ((Punto: Punto, Registro: Registro) => number) | null,
): { y: VectorDeEstado; Arco: number; PasosDados: number } {
  const Parametros = Contexto.Parametros;
  const ArcoInicial = Arco0;
  let y = y0;
  let Arco = Arco0;
  let PasosDados = 0;
  const PasoNominal = Parametros.PasoGeneracion;

  while (Arco - ArcoInicial < Longitud - 1e-12) {
    const [, P] = DerivadaDeVia(Arco, y, Contexto);

    let Paso = PasoSinAstilla(PasoNominal, Longitud - (Arco - ArcoInicial));
    let UltimoPaso = false;

    if (DistanciaHastaParar) {
      const Restante = DistanciaHastaParar(P, Registro);
      if (Restante <= 0) {
        break;
      } else if (Restante < 1.5 * PasoNominal) {
        Paso = Restante;
        UltimoPaso = true;
      }
    }

    AgregarNodo(Registro, P);
    [y] = PasoRK4(Arco, y, Paso, Contexto);
    Arco = Arco + Paso;
    PasosDados += 1;

    if (PasosDados % Parametros.PasosEntreOrtonormalizaciones === 0) {
      const [T, U, L] = Ortonormalizar(v3(y, 3), v3(y, 6));
      y[3] = T[0]; y[4] = T[1]; y[5] = T[2];
      y[6] = U[0]; y[7] = U[1]; y[8] = U[2];
      y[9] = L[0]; y[10] = L[1]; y[11] = L[2];
    }

    if (UltimoPaso || y[12]! <= 0) break;
  }
  return { y, Arco, PasosDados };
}
