// Estructuras del nucleo, espejo de los structs de MATLAB (NOMENCLATURA.md,
// seccion 4). Los nombres son los de MATLAB en PascalCase: el port se lee
// al lado del original. La traduccion a camelCase la hace exportar.ts, como
// LayoutAJson.m.

import type { Vec3 } from './matematica';
import type { CurvaNormativa } from './norma';

export type ModoCurvatura = 'AceleracionNormalConstante' | 'Clotoide' | 'FuerzaGConstante' | 'GNormativaMaxima';
export type MetodoDeAcoplamiento = 'A' | 'B' | 'Ambos';
export type SentidoDelGiro = 'Derecha' | 'Izquierda';
export type PuntoDeVerificacion = 'Heartline' | 'Cabeza';

/** ParametrosPorDefecto.m, campo por campo. */
export interface Parametros {
  // 1. modo de curvatura
  ModoCurvatura: ModoCurvatura;
  AceleracionNormalObjetivo: number;
  FuerzaGObjetivo: number;
  SemianchoDeSuavizadoNormativo: number;
  // 2. geometria de cada elemento
  RadioDelLoop: number;
  RollExtraDelLoop: number;
  RadioDelDiveLoop: number;
  SeparacionDelDiveLoop: number;
  RadioDeLaHelice: number;
  VueltasDeLaHelice: number;
  AvanceDeLaHelice: number;
  PeralteDeLaHelice: number;
  RadioDelGiro: number;
  AnguloDelGiro: number;
  PeralteDelGiro: number;
  AvanceDelGiro: number;
  SentidoDelGiro: SentidoDelGiro;
  RadioDeReferencia: number;
  InclinacionHelicoidalImpuesta: number | null;
  // 3. criterios de aceptacion
  GMinimaCuspide: number;
  PuntoDeVerificacionNormativa: PuntoDeVerificacion;
  OnsetNormativoPorEje: Vec3;
  OnsetMaximoModelo: Vec3 | null;
  TolObjetivoDeG: number;
  TolCierrePitch: number;
  FactorDeSeguridadNormativo: number;
  AlturaMaximaDelElemento: number;
  RadioMinimoFabricable: number;
  BoundingBoxDisponible: [[number, number], [number, number], [number, number]];
  AlturaMinimaSuelo: number;
  ArcoMinimoAutointerferencia: number;
  DistanciaMinimaEntreVias: number;
  // 4. generales
  Gravedad: number;
  RhoAire: number;
  CrrPortantes: number;
  CrrGuia: number;
  CrrRetencion: number;
  ModelarArrastre: boolean;
  CoefArrastre: number;
  FactorTren: number;
  NumeroDeCarros: number;
  Masa: number;
  LargoCarro: number;
  AltoCarro: number;
  AnchoVia: number;
  Holgura: number;
  DiametroRueda: number;
  AreaFrontal: number;
  DistanciaHeartline: number;
  DistanciaHeartlineACabeza: number;
  MetodoDeAcoplamiento: MetodoDeAcoplamiento;
  CalcularVelocidadMinima: boolean;
  RadioDeReferenciaReal: number;
  LargoCarroReal: number;
  PasoGeneracion: number;
  PasoSimulacion: number;
  PasosEntreOrtonormalizaciones: number;
  VersoresEnGrafico3D: number;
  PasoBusquedaVelocidad: number;
  TolNorma: number;
  TolPuntoFijo: number;
  MaxIteracionesPuntoFijo: number;
  MaxIteracionesCierre: number;
  MaxIteracionesAjuste: number;
  MargenDeOnset: number;
  ToleranciaVelocidadDeDiseno: number;
  // derivado de la envolvente (bloque 2)
  SeparacionDePatas: number;
}

export type NombreDeParametro = keyof Parametros;

/** Terna de DeclaracionDeParametros / ParametrosDelModo / ParametrosDeAceptacion / ParametrosGenerales. */
export interface Declaracion {
  Nombre: NombreDeParametro;
  Unidad: string;
  Descripcion: string;
}

export type NombreDeElemento = 'LoopVertical' | 'Helice' | 'OverBankedTurn' | 'DiveLoop';

/** Receta que arma cada ElementoXxx y consume GenerarGeometria. */
export interface Receta {
  Nombre: NombreDeElemento;
  GiroObjetivo: number;
  DesfasajeDeCurvatura: number;
  RollDelElemento: number;
  DesplazamientoObjetivo: number;
  CurvaLimiteGz: CurvaNormativa;
  CurvaLimiteGy?: CurvaNormativa;
  SentidoDeGy?: 1 | -1;
}

/** Contrato de Estado (EstadoInicial.m). */
export interface Estado {
  Posicion: Vec3;
  VersorTangente: Vec3;
  VersorArribaCarro: Vec3;
  VersorLateral: Vec3;
  VectorCurvatura: Vec3;
  DerivadaCurvatura: number;
  AnguloRoll: number;
  VelocidadRoll: number;
  AceleracionRoll: number;
  LongitudAcumulada: number;
  Velocidad: number;
  EnergiaTotal: number;
}

export interface Escala {
  LambdaLoop: number;
  LambdaCarro: number;
  RaizLambdaLoop: number;
  Distorsion: number;
  CarrosEquivalentes: number;
  OnsetMaximo: Vec3;
  FactorLongitud: number;
  FactorVelocidad: number;
  FactorTiempo: number;
  FactorAceleracion: number;
  FactorJerk: number;
}

export interface SubTramo {
  Nombre: 'AcondicionamientoEntrada' | 'ClotoideEntrada' | 'ArcoPrincipal' | 'ClotoideSalida';
  /** Indices base 0 (en MATLAB base 1; el exportador de MATLAB resta 1, aca ya son base 0). */
  IndiceInicio: number;
  IndiceFin: number;
}

/** Tabla del modo normativo (ObjetivoNormativoPorNiveles.m). */
export interface ObjetivoNormativo {
  Curva: CurvaNormativa;
  Tiempo: Float64Array;
  Gz: Float64Array;
  Coeficientes: Float64Array[];
  Paso: number;
  TiempoInicioArco: number;
  Margen: number;
  Deficit: number;
  HuboPliegue: boolean;
}

/** Punto evaluado sobre el riel (PuntoCinematico + DerivadaDeVia). */
export interface Punto {
  Arco: number;
  Posicion: Vec3;
  VersorTangente: Vec3;
  VersorArribaTransporte: Vec3;
  VersorLateralTransporte: Vec3;
  VelocidadCentroDeMasa: number;
  AnguloGirado: number;
  Tiempo: number;
  AnguloRoll: number;
  VelocidadRoll: number;
  AceleracionRoll: number;
  VersorArribaCarro: Vec3;
  VersorLateral: Vec3;
  InclinacionHelicoidal: number;
  AnguloCurvaturaDesdeArriba: number;
  VelocidadParaCurvatura: number;
  // completados por DerivadaDeVia
  CurvaturaArriba: number;
  CurvaturaLateral: number;
  VectorCurvatura: Vec3;
  Curvatura: number;
  CurvaturaArribaCarro: number;
  CurvaturaLateralCarro: number;
  Velocidad: number;
  FactorVelocidadHeartline: number;
  GArribaHeartline: number;
  GLateralHeartline: number;
  GArribaVerificacion: number;
  GLateralVerificacion: number;
  AceleracionTangencial: number;
  PerdidaRodadura: number;
  PerdidaArrastre: number;
}

/** Registro de nodos (RegistroVacio.m / AgregarNodo.m), con arrays que crecen. */
export interface Registro {
  Arco: number[];
  Tiempo: number[];
  CurvaturaArriba: number[];
  CurvaturaLateral: number[];
  Curvatura: number[];
  CurvaturaArribaCarro: number[];
  CurvaturaLateralCarro: number[];
  AnguloRoll: number[];
  VelocidadRoll: number[];
  AceleracionRoll: number[];
  Velocidad: number[];
  VelocidadCentroDeMasa: number[];
  FactorVelocidadHeartline: number[];
  AceleracionTangencial: number[];
  GArribaHeartline: number[];
  GLateralHeartline: number[];
  GArribaVerificacion: number[];
  GLateralVerificacion: number[];
  PerdidaRodadura: number[];
  PerdidaArrastre: number[];
  AnguloGirado: number[];
  Posicion: Vec3[];
  VersorTangente: Vec3[];
  VersorArribaTransporte: Vec3[];
  VersorLateralTransporte: Vec3[];
  VersorArribaCarro: Vec3[];
  VersorLateral: Vec3[];
  VectorCurvatura: Vec3[];
  NumeroDeNodos: number;
}

/** Geometria congelada del elemento (GenerarGeometria.m, "Armado del Track"). */
export interface Track {
  Nombre: NombreDeElemento;
  ModoCurvatura: ModoCurvatura;
  Receta: Receta;
  PuntosRiel: Vec3[];
  LongitudArco: Float64Array;
  VersorTangente: Vec3[];
  VersorArribaTransporte: Vec3[];
  VersorLateralTransporte: Vec3[];
  VersorArribaCarro: Vec3[];
  VersorLateral: Vec3[];
  VectorCurvatura: Vec3[];
  Curvatura: Float64Array;
  AnguloRoll: Float64Array;
  VelocidadRoll: Float64Array;
  AceleracionRoll: Float64Array;
  AnguloGirado: Float64Array;
  SubTramos: SubTramo[];
  VelocidadDeDiseno: number;
  PasoGeneracion: number;
  NormalDelPlano: Vec3;
  InclinacionHelicoidal: number;
  ObjetivoNormativo: ObjetivoNormativo | null;
  AnguloPeralte: Float64Array;
  AnguloCurvaturaDesdeArriba: Float64Array;
  DerivadaCurvatura: Float64Array;
  PuntosHeartline: Vec3[];
  LongitudArcoHeartline: Float64Array;
  CurvaturaHeartline: Float64Array;
  VelocidadCentroDeMasa: Float64Array;
  FactorVelocidadHeartline: Float64Array;
}

export interface Diagnostico {
  ResidualCierrePitch: number;
  IteracionesCierre: number;
  IteracionesAjuste: number;
  AjusteCierre: number;
  InclinacionHelicoidal: number;
  DesplazamientoLateral: number;
  Aviso: string;
  CurvaturaEntradaParalela: number;
  CurvaturaEntradaPerpendicular: number;
  CurvaturaResidualFueraPlano: number;
  LongitudAcondicionamiento: number;
  LongitudClotoideEntrada: number;
  LongitudClotoideSalida: number;
  DeltaRoll: number;
  Escala: Escala;
  FactorLongitudTransicion: number;
  OnsetVerticalGenerado: number;
  OnsetLateralGenerado: number;
  PerfilVelocidad: { Arco: Float64Array; Velocidad: Float64Array };
  TiempoDeRecorrido: Float64Array;
  GArribaHeartline: Float64Array;
  GLateralHeartline: Float64Array;
  GArribaVerificacion: Float64Array;
  GLateralVerificacion: Float64Array;
  Metodo: string;
  IteracionesPuntoFijo: number;
  ResiduoPuntoFijo: number;
  TiempoDeComputo: number;
}

/** Estado dinamico sobre el Track (SimularSobreTrack.m). */
export interface Sim {
  VelocidadCentroDeMasa: Float64Array;
  Tiempo: Float64Array;
  FuerzaRodadura: Float64Array;
  FuerzaArrastre: Float64Array;
  PuntoDeParada: number | null;
  FactorVelocidadHeartline: Float64Array;
  Velocidad: Float64Array;
  EnergiaDisipadaRodadura: Float64Array;
  EnergiaDisipadaArrastre: Float64Array;
  AceleracionTangencial: Float64Array;
  GLateralHeartline: Float64Array;
  GArribaHeartline: Float64Array;
  Gx: Float64Array;
  Gy: Float64Array;
  Gz: Float64Array;
  GxCabeza: Float64Array;
  GyCabeza: Float64Array;
  GzCabeza: Float64Array;
  BrazoDeVerificacion: number;
  FuerzaNormal: Float64Array;
  EnergiaCinetica: Float64Array;
  EnergiaPotencial: Float64Array;
  EnergiaTotal: Float64Array;
  JerkGx: Float64Array;
  JerkGy: Float64Array;
  JerkGz: Float64Array;
  VelocidadDeDiseno: number;
  AvisoVelocidadDeDiseno: string;
}

export type SentidoDeCriterio = 'MenorOIgual' | 'MayorOIgual' | 'Informativo';

export interface Criterio {
  Nombre: string;
  Sentido: SentidoDeCriterio;
  Pasa: boolean;
  Valor: number;
  Limite: number;
  Margen: number;
  Unidad: string;
  Detalle: string;
}

export interface EventoSostenido {
  Curva: CurvaNormativa;
  Signo: 1 | -1;
  NivelCritico: number;
  DuracionReal: number;
  LimiteAplicado: number;
  Exceso: number;
  DuracionMasLarga: number;
  PicoG: number;
}

export interface Normativo {
  FactorTiempo: number;
  DuracionModelo: number;
  DuracionRealEquivalente: number;
  HuboAirtimeSostenido: boolean;
  CurvaMasGzAplicada: CurvaNormativa;
  MasGz: EventoSostenido;
  MenosGz: EventoSostenido;
  Gy: EventoSostenido;
  MasGx: EventoSostenido;
  MenosGx: EventoSostenido;
  Elipse: { ValorMaximoGyGz: number; ValorMaximoGxGz: number; ValorMaximoGxGy: number; Semiejes: Vec3 };
  OnsetDeCarga: number;
  OnsetNormativoReal: number;
  OnsetPresupuestoModelo: Vec3;
  OnsetMaximoPorEje: Vec3;
}

export interface BusquedaVelocidad {
  Convergio: boolean;
  Evaluaciones: number;
  Motivo: string;
}

export interface Resumen {
  Metodo: string;
  LongitudRecorrida: number;
  LongitudDeMaterial: number;
  AlturaMaxima: number;
  RadioMinimoRiel: number;
  RadioMinimo: number;
  FuerzaNormalMaxima: number;
  VelocidadMinima: number;
  TiempoDeRecorrido: number;
  EnergiaDisipadaRodadura: number;
  EnergiaDisipadaArrastre: number;
  GzMaxima: number;
  GzMinima: number;
  GyMaximaAbsoluta: number;
  GzMaximaCabeza: number;
  GyMaximaAbsolutaCabeza: number;
  BrazoDeVerificacion: number;
  PeralteFinal: number;
  PeralteMaximo: number;
  ResidualCierrePitch: number;
  ResidualCierreTangente: number;
  PosicionFinal: Vec3;
  DesplazamientoLateral: number;
  DesplazamientoLateralObjetivo: number;
  InclinacionHelicoidal: number;
  SaltoDeTangente: number;
  SaltoDeCurvatura: number;
  SaltoDePosicion: number;
  LambdaLoop: number;
  LambdaCarro: number;
  Distorsion: number;
  CarrosEquivalentes: number;
  OnsetMaximoModelo: Vec3;
  VelocidadInicialMinima: number;
  BusquedaVelocidad: BusquedaVelocidad;
}

export interface Reporte {
  Previos: Criterio[];
  Posteriores: Criterio[];
  Normativo: Normativo;
  Resumen: Resumen;
}

export interface Elemento {
  Nombre: NombreDeElemento;
  Track: Track;
  Sim: Sim;
  SubTramos: SubTramo[];
  Diagnostico: Diagnostico;
  Parametros: Parametros;
  Receta: Receta;
  EstadoEntrada: Estado;
  EstadoSalida: Estado;
}

export interface RegistroDeLayout {
  Elemento: Elemento;
  EstadoEntrada: Estado;
  EstadoSalida: Estado;
  Reporte: Reporte;
}

/** LayoutNuevo.m / LayoutAgregarElemento.m. */
export interface Layout {
  EstadoInicial: Estado;
  EstadoActual: Estado;
  Parametros: Parametros;
  Elementos: RegistroDeLayout[];
  PuntosRiel: Vec3[];
  LongitudArcoRiel: number[];
}
