// Port de Elementos/GenerarGeometria.m: el motor de generacion comun a los
// cuatro elementos. Misma estructura que el original (tres lazos: ajuste
// de longitudes e inclinacion, correccion de cierre por secante, marcha RK4
// por sub-tramos) para poder leerlos lado a lado. Los indices de los
// sub-tramos son base 0.

import {
  AgregarNodo,
  BrazoDeVerificacion,
  DerivadaPorArco,
  DerivadaPorArcoVec3,
  EscalasDeFroude,
  MarcoTransporteDesdeCarro,
  PerfilRollQuintico,
  RegistroVacio,
} from './basicos';
import { CurvaturaDelModo, type Reloj } from './curvaturaDelModo';
import { DerivadaDeVia, IntegrarTramo, PuntoCinematico, type Contexto, type VectorDeEstado } from './integrador';
import { EPS, cruz, cumsum, gradiente, maximo, modulo, norma, normaDe, normalizar, punto as productoPunto, resta, type Vec3 } from './matematica';
import { ObjetivoNormativoPorNiveles } from './objetivoNormativo';
import type { Diagnostico, Escala, Estado, ObjetivoNormativo, Parametros, Punto, Receta, Registro, SubTramo, Track } from './tipos';

interface Plan {
  Parametros: Parametros;
  Receta: Receta;
  Escala: Escala;
  Onset: Vec3;
  EstadoEntrada: Estado;
  PerfilVelocidad: ((Arco: number) => number) | null;
  NormalEnPlano: Vec3;
  Beta: number;
  CurvaturaParalela: number;
  CurvaturaPerpendicular: number;
  EstadoInicialY: VectorDeEstado;
  Inclinacion: number;
  LongitudAcondicionamiento: number;
  FuncionRoll: (Arco: number, AnguloGirado: number) => [number, number, number];
}

interface Recorrido {
  Registro: Registro;
  SubTramos: SubTramo[];
  Aviso: string;
  LongitudClotoideEntrada: number;
  LongitudClotoideSalida: number;
  CurvaturaResidualFueraPlano: number;
  ResidualCierre: number;
  DesplazamientoLateral: number;
  LongitudDelGiro: number;
  ObjetivoNormativo: ObjetivoNormativo | null;
  NormalArco: Vec3;
  TangenteArco: Vec3;
  PosicionArco: Vec3;
  DireccionDeGiro: Vec3;
  EjeDeLaHelice: Vec3;
  PuntoFinal: Punto | null;
}

export type DiagnosticoDeGeometria = Omit<Diagnostico, 'Metodo' | 'IteracionesPuntoFijo' | 'ResiduoPuntoFijo' | 'TiempoDeComputo'>;

export function GenerarGeometria(
  EstadoEntrada: Estado,
  Parametros: Parametros,
  Receta: Receta,
  PerfilVelocidad: ((Arco: number) => number) | null = null,
): [Track, DiagnosticoDeGeometria] {
  const Escala = EscalasDeFroude(Parametros);

  // ---------------- Marco y curvatura del estado de entrada -------------
  const VersorTangenteEntrada = EstadoEntrada.VersorTangente;
  if (normaDe([VersorTangenteEntrada[0], VersorTangenteEntrada[1]]) < 1e-9) {
    throw new Error(
      'La tangente de entrada es vertical pura: el plano del loop queda indeterminado. Hace falta dar el azimut del plano como dato.',
    );
  }
  const [VersorArribaTransporteEntrada, VersorLateralTransporteEntrada] = MarcoTransporteDesdeCarro(
    EstadoEntrada.VersorArribaCarro, EstadoEntrada.VersorLateral, EstadoEntrada.AnguloRoll,
  );
  const NormalEnPlano = NormalDelPlanoVertical(VersorTangenteEntrada);
  const Beta = Math.atan2(productoPunto(NormalEnPlano, VersorLateralTransporteEntrada), productoPunto(NormalEnPlano, VersorArribaTransporteEntrada));

  const cosDesfasaje = Math.cos(Receta.DesfasajeDeCurvatura);
  const sinDesfasaje = Math.sin(Receta.DesfasajeDeCurvatura);
  const TxN = cruz(VersorTangenteEntrada, NormalEnPlano);
  const DireccionDeCurvatura: Vec3 = [
    cosDesfasaje * NormalEnPlano[0] + sinDesfasaje * TxN[0],
    cosDesfasaje * NormalEnPlano[1] + sinDesfasaje * TxN[1],
    cosDesfasaje * NormalEnPlano[2] + sinDesfasaje * TxN[2],
  ];

  // ---------------- Plan del elemento -----------------------------------
  const Plan: Plan = {
    Parametros,
    Receta,
    Escala,
    Onset: Escala.OnsetMaximo,
    EstadoEntrada,
    PerfilVelocidad,
    NormalEnPlano,
    Beta,
    CurvaturaParalela: productoPunto(EstadoEntrada.VectorCurvatura, DireccionDeCurvatura),
    CurvaturaPerpendicular: productoPunto(EstadoEntrada.VectorCurvatura, cruz(VersorTangenteEntrada, DireccionDeCurvatura)),
    EstadoInicialY: [
      ...EstadoEntrada.Posicion, ...VersorTangenteEntrada, ...VersorArribaTransporteEntrada, ...VersorLateralTransporteEntrada,
      EstadoEntrada.Velocidad ** 2, 0, 0,
    ],
    Inclinacion: 0,
    LongitudAcondicionamiento: 0,
    FuncionRoll: () => [0, 0, 0],
  };

  const DeltaRollCrudo = Beta + Receta.RollDelElemento - EstadoEntrada.AnguloRoll;
  const DeltaRoll = Math.abs(DeltaRollCrudo) <= Math.PI + 1e-9 ? DeltaRollCrudo : AjustarAngulo(DeltaRollCrudo);
  const RollObjetivo = EstadoEntrada.AnguloRoll + DeltaRoll;

  // ---------------- Generacion ------------------------------------------
  let FactorLongitud = 1;
  const AjustarInclinacion = Parametros.InclinacionHelicoidalImpuesta === null && Receta.DesplazamientoObjetivo !== 0;
  let Inclinacion = Parametros.InclinacionHelicoidalImpuesta === null ? 0 : Parametros.InclinacionHelicoidalImpuesta;
  let ResidualCierre = NaN;
  let InclinacionUsada = 0;
  let FactorUsado = 1;
  let AjusteCierre = 0;
  let IteracionCierre = 0;
  let IteracionAjuste = 0;
  let Recorrido!: Recorrido;
  let OnsetMedido = 0;
  let OnsetLateralMedido = 0;

  for (IteracionAjuste = 1; IteracionAjuste <= Parametros.MaxIteracionesAjuste; IteracionAjuste++) {
    Plan.Onset = [Escala.OnsetMaximo[0] / FactorLongitud, Escala.OnsetMaximo[1] / FactorLongitud, Escala.OnsetMaximo[2] / FactorLongitud];
    Plan.Inclinacion = Inclinacion;
    InclinacionUsada = Inclinacion;
    FactorUsado = FactorLongitud;

    Plan.LongitudAcondicionamiento = LongitudTransicionDeRoll(DeltaRoll, EstadoEntrada.Velocidad, Plan.Onset[1], Parametros);
    if (Math.abs(Plan.CurvaturaPerpendicular) > 1e-9) {
      const LongitudPorCurvatura = LongitudDeClotoide(EstadoEntrada.Velocidad, Plan.CurvaturaPerpendicular, Plan.Onset[1], Parametros);
      Plan.LongitudAcondicionamiento = Math.max(Plan.LongitudAcondicionamiento, LongitudPorCurvatura);
    }
    const LongitudAcondicionamiento = Plan.LongitudAcondicionamiento;
    const InclinacionDelPlan = Inclinacion;
    Plan.FuncionRoll = (Arco, AnguloGirado) =>
      PerfilRollDelElemento(Arco, AnguloGirado, EstadoEntrada, RollObjetivo, LongitudAcondicionamiento, InclinacionDelPlan);

    AjusteCierre = 0;
    for (IteracionCierre = 1; IteracionCierre <= Parametros.MaxIteracionesCierre; IteracionCierre++) {
      Recorrido = RecorrerElemento(Plan, AjusteCierre);
      ResidualCierre = Recorrido.ResidualCierre;
      if (Math.abs(ResidualCierre) < Parametros.TolCierrePitch || Recorrido.Aviso !== '') break;
      AjusteCierre = AjusteCierre + ResidualCierre;
    }
    if (IteracionCierre > Parametros.MaxIteracionesCierre) IteracionCierre = Parametros.MaxIteracionesCierre;

    CompletarAceleracionRoll(Recorrido.Registro, Parametros);
    [OnsetMedido, OnsetLateralMedido] = OnsetDelRecorrido(Recorrido.Registro);
    if (Recorrido.Aviso !== '') break;

    const OnsetRelativo = Math.max(OnsetMedido / Escala.OnsetMaximo[2], OnsetLateralMedido / Escala.OnsetMaximo[1]);
    const FactorSiguiente = (1 + Parametros.MargenDeOnset) * FactorLongitud * OnsetRelativo;

    let InclinacionSiguiente = Inclinacion;
    if (AjustarInclinacion && Recorrido.LongitudDelGiro > 0) {
      const FaltaDesplazamiento = Receta.DesplazamientoObjetivo - Recorrido.DesplazamientoLateral;
      InclinacionSiguiente = Inclinacion + FaltaDesplazamiento / Recorrido.LongitudDelGiro;
    }

    if (Math.abs(FactorSiguiente - FactorLongitud) < 1e-6 * FactorLongitud && Math.abs(InclinacionSiguiente - Inclinacion) < 1e-8) break;
    FactorLongitud = FactorSiguiente;
    Inclinacion = InclinacionSiguiente;
  }
  if (IteracionAjuste > Parametros.MaxIteracionesAjuste) IteracionAjuste = Parametros.MaxIteracionesAjuste;
  Inclinacion = InclinacionUsada;
  FactorLongitud = FactorUsado;

  // ---------------- Armado del Track ------------------------------------
  const Registro = Recorrido.Registro;
  const n = Registro.NumeroDeNodos;
  const Arco = Float64Array.from(Registro.Arco);
  const Curvatura = Float64Array.from(Registro.Curvatura);

  const AnguloCurvaturaDesdeArriba = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    AnguloCurvaturaDesdeArriba[i] = Curvatura[i]! < 1e-9 ? 0 : Math.atan2(Registro.CurvaturaLateralCarro[i]!, Registro.CurvaturaArribaCarro[i]!);
  }

  const [PuntosHeartline, LongitudArcoHeartline, CurvaturaHeartline] = DerivarHeartline(Registro.Posicion, Registro.VersorArribaCarro, Arco, Parametros);

  const Track: Track = {
    Nombre: Receta.Nombre,
    ModoCurvatura: Parametros.ModoCurvatura,
    Receta,
    PuntosRiel: Registro.Posicion,
    LongitudArco: Arco,
    VersorTangente: Registro.VersorTangente,
    VersorArribaTransporte: Registro.VersorArribaTransporte,
    VersorLateralTransporte: Registro.VersorLateralTransporte,
    VersorArribaCarro: Registro.VersorArribaCarro,
    VersorLateral: Registro.VersorLateral,
    VectorCurvatura: Registro.VectorCurvatura,
    Curvatura,
    AnguloRoll: Float64Array.from(Registro.AnguloRoll),
    VelocidadRoll: Float64Array.from(Registro.VelocidadRoll),
    AceleracionRoll: Float64Array.from(Registro.AceleracionRoll),
    AnguloGirado: Float64Array.from(Registro.AnguloGirado),
    SubTramos: Recorrido.SubTramos,
    VelocidadDeDiseno: EstadoEntrada.Velocidad,
    PasoGeneracion: Parametros.PasoGeneracion,
    NormalDelPlano: NormalEnPlano,
    InclinacionHelicoidal: Inclinacion,
    ObjetivoNormativo: Recorrido.ObjetivoNormativo,
    AnguloPeralte: AnguloDePeralte(Registro.VersorTangente, Registro.VersorArribaCarro),
    AnguloCurvaturaDesdeArriba,
    DerivadaCurvatura: gradiente(Curvatura, Arco),
    PuntosHeartline,
    LongitudArcoHeartline,
    CurvaturaHeartline,
    VelocidadCentroDeMasa: Float64Array.from(Registro.VelocidadCentroDeMasa),
    FactorVelocidadHeartline: Float64Array.from(Registro.FactorVelocidadHeartline),
  };

  const Diagnostico: DiagnosticoDeGeometria = {
    ResidualCierrePitch: ResidualCierre,
    IteracionesCierre: IteracionCierre,
    IteracionesAjuste: IteracionAjuste,
    AjusteCierre,
    InclinacionHelicoidal: Inclinacion,
    DesplazamientoLateral: Recorrido.DesplazamientoLateral,
    Aviso: Recorrido.Aviso,
    CurvaturaEntradaParalela: Plan.CurvaturaParalela,
    CurvaturaEntradaPerpendicular: Plan.CurvaturaPerpendicular,
    CurvaturaResidualFueraPlano: Recorrido.CurvaturaResidualFueraPlano,
    LongitudAcondicionamiento: Plan.LongitudAcondicionamiento,
    LongitudClotoideEntrada: Recorrido.LongitudClotoideEntrada,
    LongitudClotoideSalida: Recorrido.LongitudClotoideSalida,
    DeltaRoll,
    Escala,
    FactorLongitudTransicion: FactorLongitud,
    OnsetVerticalGenerado: OnsetMedido,
    OnsetLateralGenerado: OnsetLateralMedido,
    PerfilVelocidad: { Arco, Velocidad: Float64Array.from(Registro.VelocidadCentroDeMasa) },
    TiempoDeRecorrido: Float64Array.from(Registro.Tiempo),
    GArribaHeartline: Float64Array.from(Registro.GArribaHeartline),
    GLateralHeartline: Float64Array.from(Registro.GLateralHeartline),
    GArribaVerificacion: Float64Array.from(Registro.GArribaVerificacion),
    GLateralVerificacion: Float64Array.from(Registro.GLateralVerificacion),
  };
  return [Track, Diagnostico];
}

// ========================= derivacion de la heartline =====================
function DerivarHeartline(PuntosRiel: Vec3[], VersorArribaCarro: Vec3[], Arco: Float64Array, Parametros: Parametros): [Vec3[], Float64Array, Float64Array] {
  const d = Parametros.DistanciaHeartline;
  const PuntosHeartline: Vec3[] = PuntosRiel.map((p, i) => {
    const U = VersorArribaCarro[i]!;
    return [p[0] + d * U[0], p[1] + d * U[1], p[2] + d * U[2]];
  });
  const n = PuntosHeartline.length;
  const segmentos = new Float64Array(Math.max(n - 1, 0));
  for (let i = 0; i < n - 1; i++) segmentos[i] = norma(resta(PuntosHeartline[i + 1]!, PuntosHeartline[i]!));
  const acumulado = cumsum(segmentos);
  const ArcoHeartline = new Float64Array(n);
  for (let i = 0; i < n; i++) ArcoHeartline[i] = (i === 0 ? 0 : acumulado[i - 1]!) + Arco[0]!;

  const Primera = DerivadaPorArcoVec3(PuntosHeartline, Arco);
  const Segunda = DerivadaPorArcoVec3(Primera, Arco);
  const CurvaturaHeartline = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const NormaPrimera = norma(Primera[i]!);
    CurvaturaHeartline[i] = norma(cruz(Primera[i]!, Segunda[i]!)) / Math.max(NormaPrimera ** 3, EPS);
  }
  return [PuntosHeartline, ArcoHeartline, CurvaturaHeartline];
}

// ========================= recorrido del elemento =========================
function RecorrerElemento(Plan: Plan, AjusteCierre: number): Recorrido {
  const Parametros = Plan.Parametros;
  const Contexto: Contexto = {
    Parametros,
    FuncionRoll: Plan.FuncionRoll,
    PerfilVelocidad: Plan.PerfilVelocidad,
    VelocidadMinimaDeSeguridad: 1e-3,
    InclinacionHelicoidal: 0,
    AnguloGiradoDeReferencia: 0,
    FuncionCurvatura: () => [0, 0],
    FuncionAnguloDeCurvatura: () => Plan.Beta + Plan.Receta.DesfasajeDeCurvatura,
  };

  let y: VectorDeEstado = [...Plan.EstadoInicialY];
  let Arco = Plan.EstadoEntrada.LongitudAcumulada;

  const Recorrido: Recorrido = {
    Registro: RegistroVacio(),
    SubTramos: [],
    Aviso: '',
    LongitudClotoideEntrada: 0,
    LongitudClotoideSalida: 0,
    CurvaturaResidualFueraPlano: 0,
    ResidualCierre: 0,
    DesplazamientoLateral: 0,
    LongitudDelGiro: 0,
    ObjetivoNormativo: null,
    NormalArco: Plan.NormalEnPlano,
    TangenteArco: Plan.EstadoEntrada.VersorTangente,
    PosicionArco: Plan.EstadoEntrada.Posicion,
    DireccionDeGiro: Plan.NormalEnPlano,
    EjeDeLaHelice: cruz(Plan.EstadoEntrada.VersorTangente, Plan.NormalEnPlano),
    PuntoFinal: null,
  };
  const v3 = (i: number): Vec3 => [y[i]!, y[i + 1]!, y[i + 2]!];

  // --- AcondicionamientoEntrada ---
  if (Plan.LongitudAcondicionamiento > 0) {
    const ArcoInicio = Arco;
    Contexto.FuncionCurvatura = (P) => CurvaturaDeAcondicionamiento(P, ArcoInicio, Plan);
    const Indice = Recorrido.Registro.NumeroDeNodos;
    ({ y, Arco } = IntegrarTramo(Recorrido.Registro, y, Arco, Contexto, Plan.LongitudAcondicionamiento, null));
    Recorrido.SubTramos.push({ Nombre: 'AcondicionamientoEntrada', IndiceInicio: Indice, IndiceFin: Recorrido.Registro.NumeroDeNodos - 1 });
    if (y[12]! <= 0) return TerminarSinEnergia(Recorrido, y, Arco, Contexto, 'el acondicionamiento');
  }

  // --- El plano de referencia del loop se fija recien aca ---
  const NormalArco = NormalDelPlanoVertical(v3(3));
  const BetaArco = Math.atan2(productoPunto(NormalArco, v3(9)), productoPunto(NormalArco, v3(6)));
  Recorrido.NormalArco = NormalArco;
  Recorrido.TangenteArco = v3(3);
  Recorrido.PosicionArco = v3(0);
  const ArcoInicioLoop = Arco;

  const AnguloGiradoInicio = y[13]!;
  Contexto.AnguloGiradoDeReferencia = AnguloGiradoInicio;
  const AnguloDeCurvatura = (P: Punto): number =>
    BetaArco + Plan.Receta.DesfasajeDeCurvatura + Plan.Inclinacion * (P.AnguloGirado - AnguloGiradoInicio);
  Contexto.InclinacionHelicoidal = Plan.Inclinacion;
  Contexto.FuncionAnguloDeCurvatura = AnguloDeCurvatura;

  const AnguloInicialCurvatura = AnguloDeCurvatura(PuntoCinematico(Arco, y, Contexto));
  {
    const Upt = v3(6);
    const Lpt = v3(9);
    const c = Math.cos(AnguloInicialCurvatura);
    const s = Math.sin(AnguloInicialCurvatura);
    Recorrido.DireccionDeGiro = [c * Upt[0] + s * Lpt[0], c * Upt[1] + s * Lpt[1], c * Upt[2] + s * Lpt[2]];
  }
  Recorrido.EjeDeLaHelice = cruz(v3(3), Recorrido.DireccionDeGiro);

  let CurvaturaInicialArco: number;
  {
    const [CurvaturaArriba, CurvaturaLateral] = Contexto.FuncionCurvatura(PuntoCinematico(Arco, y, Contexto));
    const Upt = v3(6);
    const Lpt = v3(9);
    const VectorCurvatura: Vec3 = [
      CurvaturaArriba * Upt[0] + CurvaturaLateral * Lpt[0],
      CurvaturaArriba * Upt[1] + CurvaturaLateral * Lpt[1],
      CurvaturaArriba * Upt[2] + CurvaturaLateral * Lpt[2],
    ];
    CurvaturaInicialArco = productoPunto(VectorCurvatura, Recorrido.DireccionDeGiro);
    Recorrido.CurvaturaResidualFueraPlano = productoPunto(VectorCurvatura, Recorrido.EjeDeLaHelice);
  }

  // --- ClotoideEntrada ---
  const [, PuntoInicial] = DerivadaDeVia(Arco, y, Contexto);
  const [CurvaturaObjetivo, AnguloObjetivo] = CurvaturaDelModo(PuntoInicial, Parametros, Plan.Escala, PuntoInicial.Tiempo, Plan.Receta);
  const AnguloInicial = PuntoInicial.AnguloCurvaturaDesdeArriba;
  const LongitudEntrada = LongitudDeClotoidePorEjes(
    PuntoInicial.Velocidad,
    CurvaturaObjetivo * Math.cos(AnguloObjetivo) - CurvaturaInicialArco * Math.cos(AnguloInicial),
    CurvaturaObjetivo * Math.sin(AnguloObjetivo) - CurvaturaInicialArco * Math.sin(AnguloInicial),
    Plan.Onset,
    Parametros,
  );
  Recorrido.LongitudClotoideEntrada = LongitudEntrada;

  {
    const ArcoInicio = Arco;
    const TiempoReferenciaRampa = Infinity;
    Contexto.FuncionCurvatura = (P) => MezclaDeClotoide(P, ArcoInicio, LongitudEntrada, CurvaturaInicialArco, Plan, TiempoReferenciaRampa);
    const Indice = Recorrido.Registro.NumeroDeNodos;
    ({ y, Arco } = IntegrarTramo(Recorrido.Registro, y, Arco, Contexto, LongitudEntrada, null));
    Recorrido.SubTramos.push({ Nombre: 'ClotoideEntrada', IndiceInicio: Indice, IndiceFin: Recorrido.Registro.NumeroDeNodos - 1 });
    if (y[12]! <= 0) return TerminarSinEnergia(Recorrido, y, Arco, Contexto, 'la clotoide de entrada');
  }

  // --- ArcoLoop ---
  let RelojArco: Reloj;
  if (Parametros.ModoCurvatura === 'GNormativaMaxima') {
    const R = Recorrido.Registro;
    const objetivo = ObjetivoNormativoPorNiveles(Plan.Receta.CurvaLimiteGz, R.Tiempo, R.GArribaVerificacion, y[14]!, Plan.Escala, Parametros);
    Recorrido.ObjetivoNormativo = objetivo;
    RelojArco = objetivo;
  } else {
    RelojArco = y[14]!;
  }
  Contexto.FuncionCurvatura = (P) => CurvaturaDelModoProyectada(P, Plan, RelojArco);

  const ArcoQueFalta = (P: Punto, R: Registro): number =>
    (Plan.Receta.GiroObjetivo - AjusteCierre - (P.AnguloGirado - AnguloGiradoInicio) - GiroDeLaRampaDeSalida(P, R, Plan)) / Math.max(P.Curvatura, EPS);

  {
    const Indice = Recorrido.Registro.NumeroDeNodos;
    ({ y, Arco } = IntegrarTramo(Recorrido.Registro, y, Arco, Contexto, 50, ArcoQueFalta));
    Recorrido.SubTramos.push({ Nombre: 'ArcoPrincipal', IndiceInicio: Indice, IndiceFin: Recorrido.Registro.NumeroDeNodos - 1 });
    if (y[12]! <= 0) return TerminarSinEnergia(Recorrido, y, Arco, Contexto, 'el arco principal');
  }

  // --- ClotoideSalida ---
  const [, PuntoFinArco] = DerivadaDeVia(Arco, y, Contexto);
  const CurvaturaFinArco = PuntoFinArco.Curvatura;
  const LongitudSalida = LongitudDeClotoidePorEjes(
    PuntoFinArco.Velocidad, PuntoFinArco.CurvaturaArribaCarro, PuntoFinArco.CurvaturaLateralCarro, Plan.Onset, Parametros,
  );
  Recorrido.LongitudClotoideSalida = LongitudSalida;
  const DerivadaCurvaturaFinArco = DerivadaCurvaturaEnElUltimoTramo(PuntoFinArco, Recorrido.Registro, Parametros);
  const DesvioFinArco = Math.atan2(PuntoFinArco.CurvaturaLateralCarro, PuntoFinArco.CurvaturaArribaCarro) - PuntoFinArco.AnguloCurvaturaDesdeArriba;
  {
    const ArcoInicio = Arco;
    Contexto.FuncionCurvatura = (P) =>
      ProyectarCurvatura(
        RampaDeSalida(FraccionDeTramo(P.Arco, ArcoInicio, LongitudSalida), CurvaturaFinArco, DerivadaCurvaturaFinArco, LongitudSalida),
        AnguloDeCurvatura(P) + DesvioFinArco,
      );
    const Indice = Recorrido.Registro.NumeroDeNodos;
    ({ y, Arco } = IntegrarTramo(Recorrido.Registro, y, Arco, Contexto, LongitudSalida, null));
    const [, PuntoFinal] = DerivadaDeVia(Arco, y, Contexto);
    Recorrido.PuntoFinal = PuntoFinal;
    AgregarNodo(Recorrido.Registro, PuntoFinal);
    Recorrido.SubTramos.push({ Nombre: 'ClotoideSalida', IndiceInicio: Indice, IndiceFin: Recorrido.Registro.NumeroDeNodos - 1 });
  }

  const TangenteFinal = Recorrido.PuntoFinal!.VersorTangente;
  const AnguloMedido = Math.atan2(productoPunto(TangenteFinal, Recorrido.DireccionDeGiro), productoPunto(TangenteFinal, Recorrido.TangenteArco));
  Recorrido.ResidualCierre = AjustarAngulo(AnguloMedido - Plan.Receta.GiroObjetivo);
  Recorrido.DesplazamientoLateral = productoPunto(resta(Recorrido.PuntoFinal!.Posicion, Recorrido.PosicionArco), Recorrido.EjeDeLaHelice);
  Recorrido.LongitudDelGiro = Arco - ArcoInicioLoop;
  return Recorrido;
}

// ========================= auxiliares =====================================
function TerminarSinEnergia(Recorrido: Recorrido, y: VectorDeEstado, Arco: number, Contexto: Contexto, DondeTexto: string): Recorrido {
  const [, PuntoFinal] = DerivadaDeVia(Arco, y, Contexto);
  Recorrido.PuntoFinal = PuntoFinal;
  AgregarNodo(Recorrido.Registro, PuntoFinal);
  if (Recorrido.SubTramos.length > 0) {
    Recorrido.SubTramos[Recorrido.SubTramos.length - 1]!.IndiceFin = Recorrido.Registro.NumeroDeNodos - 1;
  }
  Recorrido.Aviso = `El carro se quedo sin energia en ${DondeTexto}.`;
  return Recorrido;
}

function ProyectarCurvatura(Curvatura: number, AnguloDeCurvatura: number): [number, number] {
  return [Curvatura * Math.cos(AnguloDeCurvatura), Curvatura * Math.sin(AnguloDeCurvatura)];
}

function CurvaturaDeAcondicionamiento(P: Punto, ArcoInicio: number, Plan: Plan): [number, number] {
  const Fraccion = Smoothstep(FraccionDeTramo(P.Arco, ArcoInicio, Plan.LongitudAcondicionamiento));
  const CurvaturaPerpendicular = (1 - Fraccion) * Plan.CurvaturaPerpendicular;
  const Angulo = Plan.Beta + Plan.Receta.DesfasajeDeCurvatura;
  return [
    Plan.CurvaturaParalela * Math.cos(Angulo) - CurvaturaPerpendicular * Math.sin(Angulo),
    Plan.CurvaturaParalela * Math.sin(Angulo) + CurvaturaPerpendicular * Math.cos(Angulo),
  ];
}

function CurvaturaDelModoProyectada(P: Punto, Plan: Plan, TiempoReferencia: Reloj): [number, number] {
  const [Curvatura, AnguloDesdeArriba] = CurvaturaDelModo(P, Plan.Parametros, Plan.Escala, TiempoReferencia, Plan.Receta);
  return ProyectarCurvatura(Curvatura, P.AnguloRoll + AnguloDesdeArriba);
}

function MezclaDeClotoide(P: Punto, ArcoInicio: number, Longitud: number, CurvaturaInicial: number, Plan: Plan, TiempoReferencia: Reloj): [number, number] {
  const Fraccion = Smoothstep(FraccionDeTramo(P.Arco, ArcoInicio, Longitud));
  const [ArribaObjetivo, LateralObjetivo] = CurvaturaDelModoProyectada(P, Plan, TiempoReferencia);
  const AnguloEntrada = P.AnguloRoll + P.AnguloCurvaturaDesdeArriba;
  const [ArribaInicial, LateralInicial] = ProyectarCurvatura(CurvaturaInicial, AnguloEntrada);
  return [(1 - Fraccion) * ArribaInicial + Fraccion * ArribaObjetivo, (1 - Fraccion) * LateralInicial + Fraccion * LateralObjetivo];
}

function Smoothstep(u: number): number {
  return u * u * (3 - 2 * u);
}

function RampaDeSalida(Fraccion: number, CurvaturaInicial: number, DerivadaInicial: number, Longitud: number): number {
  const u = Fraccion;
  const Pendiente = PendienteAcotada(DerivadaInicial, CurvaturaInicial, Longitud);
  return CurvaturaInicial * (2 * u ** 3 - 3 * u ** 2 + 1) + Pendiente * (u ** 3 - 2 * u ** 2 + u);
}

function PendienteAcotada(DerivadaInicial: number, CurvaturaInicial: number, Longitud: number): number {
  return Math.max(Math.min(DerivadaInicial * Longitud, 3 * CurvaturaInicial), -3 * CurvaturaInicial);
}

function DerivadaCurvaturaEnElUltimoTramo(P: Punto, Registro: Registro, Parametros: Parametros): number {
  const DistanciaMinima = 0.5 * Parametros.PasoGeneracion;
  let k = Registro.NumeroDeNodos - 1;
  while (k >= 0 && P.Arco - Registro.Arco[k]! < DistanciaMinima) k--;
  if (k < 0) return 0;
  return (P.Curvatura - Registro.Curvatura[k]!) / (P.Arco - Registro.Arco[k]!);
}

function GiroDeLaRampaDeSalida(P: Punto, Registro: Registro, Plan: Plan): number {
  const Longitud = LongitudDeClotoidePorEjes(P.Velocidad, P.CurvaturaArribaCarro, P.CurvaturaLateralCarro, Plan.Onset, Plan.Parametros);
  const Pendiente = PendienteAcotada(DerivadaCurvaturaEnElUltimoTramo(P, Registro, Plan.Parametros), P.Curvatura, Longitud);
  return Longitud * (0.5 * P.Curvatura + Pendiente / 12);
}

function LongitudDeClotoidePorEjes(Velocidad: number, DeltaCurvaturaArriba: number, DeltaCurvaturaLateral: number, Onset: Vec3, Parametros: Parametros): number {
  return Math.max(
    LongitudDeClotoide(Velocidad, DeltaCurvaturaArriba, Onset[2], Parametros),
    LongitudDeClotoide(Velocidad, DeltaCurvaturaLateral, Onset[1], Parametros),
  );
}

function FraccionDeTramo(Arco: number, ArcoInicio: number, Longitud: number): number {
  return Math.min(Math.max((Arco - ArcoInicio) / Math.max(Longitud, EPS), 0), 1);
}

function NormalDelPlanoVertical(VersorTangente: Vec3): Vec3 {
  const Horizontal = normalizar([VersorTangente[0], VersorTangente[1], 0]);
  const CosPitch = normaDe([VersorTangente[0], VersorTangente[1]]);
  const Tz = VersorTangente[2];
  return normalizar([-Tz * Horizontal[0], -Tz * Horizontal[1], -Tz * Horizontal[2] + CosPitch]);
}

function PerfilRollDelElemento(
  Arco: number, AnguloGirado: number, EstadoEntrada: Estado, RollBase: number, LongitudAcondicionamiento: number, Inclinacion: number,
): [number, number, number] {
  const ArcoLocal = Arco - EstadoEntrada.LongitudAcumulada;
  const [AnguloRoll, VelocidadRoll, AceleracionRoll] = PerfilRollQuintico(EstadoEntrada.AnguloRoll, RollBase, LongitudAcondicionamiento, ArcoLocal);
  return [AnguloRoll + Inclinacion * AnguloGirado, VelocidadRoll, AceleracionRoll];
}

export function AjustarAngulo(Angulo: number): number {
  return modulo(Angulo + Math.PI, 2 * Math.PI) - Math.PI;
}

/** Peralte contra la vertical, nodo a nodo; NaN con la tangente vertical. */
export function AnguloDePeralte(VersorTangente: Vec3[], VersorArribaCarro: Vec3[]): Float64Array {
  const n = VersorTangente.length;
  const Peralte = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const T = VersorTangente[i]!;
    const U = VersorArribaCarro[i]!;
    const NormaHorizontal = Math.hypot(T[0], T[1]);
    const escalaH = Math.max(NormaHorizontal, EPS);
    let Normal: Vec3 = [-T[2] * (T[0] / escalaH), -T[2] * (T[1] / escalaH), NormaHorizontal];
    const nn = Math.max(norma(Normal), EPS);
    Normal = [Normal[0] / nn, Normal[1] / nn, Normal[2] / nn];
    const Binormal = cruz(T, Normal);
    Peralte[i] = NormaHorizontal < 1e-9 ? NaN : Math.atan2(productoPunto(U, Binormal), productoPunto(U, Normal));
  }
  return Peralte;
}

function CompletarAceleracionRoll(Registro: Registro, Parametros: Parametros): void {
  const n = Registro.NumeroDeNodos;
  if (n < 3) return;
  const AceleracionCompleta = DerivadaPorArco(Registro.VelocidadRoll, Registro.Arco);
  const Brazo = BrazoDeVerificacion(Parametros);
  for (let i = 0; i < n; i++) {
    const Termino = (Registro.Velocidad[i]! ** 2 * (AceleracionCompleta[i]! - Registro.AceleracionRoll[i]!)) / Parametros.Gravedad;
    Registro.AceleracionRoll[i] = AceleracionCompleta[i]!;
    Registro.GLateralHeartline[i] = Registro.GLateralHeartline[i]! + Parametros.DistanciaHeartline * Termino;
    Registro.GLateralVerificacion[i] = Registro.GLateralVerificacion[i]! + Brazo * Termino;
  }
}

function OnsetDelRecorrido(Registro: Registro): [number, number] {
  const n = Registro.NumeroDeNodos;
  if (n < 3) return [0, 0];
  const dVertical = gradiente(Registro.GArribaVerificacion, Registro.Arco);
  const dLateral = gradiente(Registro.GLateralVerificacion, Registro.Arco);
  const vertical = new Float64Array(n);
  const lateral = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    vertical[i] = Math.abs(dVertical[i]! * Registro.Velocidad[i]!);
    lateral[i] = Math.abs(dLateral[i]! * Registro.Velocidad[i]!);
  }
  return [maximo(vertical), maximo(lateral)];
}

function LongitudDeClotoide(Velocidad: number, DeltaCurvatura: number, Onset: number, Parametros: Parametros): number {
  const FactorSmoothstep = 1.5;
  const Longitud = (FactorSmoothstep * Velocidad ** 3 * Math.abs(DeltaCurvatura)) / (Parametros.Gravedad * Onset);
  return Math.max(Longitud, 2 * Parametros.PasoGeneracion);
}

function LongitudTransicionDeRoll(DeltaRoll: number, Velocidad: number, Onset: number, Parametros: Parametros): number {
  if (Math.abs(DeltaRoll) < 1e-9) return 0;
  const Brazo = BrazoDeVerificacion(Parametros);
  if (Brazo <= 0) return Parametros.LargoCarro;
  const Longitud = ((60 * Brazo * Velocidad ** 3 * Math.abs(DeltaRoll)) / (Parametros.Gravedad * Onset)) ** (1 / 3);
  return Math.max(Longitud, Parametros.LargoCarro);
}
