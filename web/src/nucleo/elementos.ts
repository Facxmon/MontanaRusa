// Port de Elementos/ConstruirElemento.m, ElementoLoopVertical.m,
// ElementoDiveLoop.m, ElementoHelice.m, ElementoOverBankedTurn.m,
// ResolverMetodoA.m, ResolverMetodoB.m, CompararMetodos.m y
// Fisica/VelocidadInicialMinima.m, mas LayoutDeVia/LayoutNuevo.m y
// LayoutAgregarElemento.m.

import { GenerarGeometria, type DiagnosticoDeGeometria } from './generarGeometria';
import { EPS, interpolantePchip, maximo, minimo, norma, rad2deg, resta, sprintfF } from './matematica';
import { limiteDeDiseno, limiteNormativo } from './norma';
import { EvaluarObjetivoNormativo } from './objetivoNormativo';
import { SimularSobreTrack } from './simular';
import type {
  BusquedaVelocidad, Criterio, Diagnostico, Elemento, Estado, Layout, NombreDeElemento, Parametros, Receta, RegistroDeLayout, Reporte, Resumen, Sim, Track,
} from './tipos';
import { AgregarCriterio, ChequeosPosteriores, ChequeosPrevios } from './verificacion';

export type Constructor = (EstadoEntrada: Estado, Parametros: Parametros, Layout?: Layout | null) => [Estado, Elemento, Reporte];

// ------------------------------------------------------------ recetas
function SignoDelSentido(Texto: string, Elemento: string): 1 | -1 {
  if (Texto.toLowerCase() === 'izquierda') return -1;
  if (Texto.toLowerCase() === 'derecha') return 1;
  throw new Error(`${Elemento}: SentidoDelGiro tiene que ser 'Derecha' o 'Izquierda', no '${Texto}'.`);
}

export const ElementoLoopVertical: Constructor = (EstadoEntrada, Parametros, Layout = null) => {
  const P = { ...Parametros, RadioDeReferencia: Parametros.RadioDelLoop };
  const Receta: Receta = {
    Nombre: 'LoopVertical',
    GiroObjetivo: 2 * Math.PI,
    DesfasajeDeCurvatura: 0,
    RollDelElemento: P.RollExtraDelLoop,
    DesplazamientoObjetivo: P.SeparacionDePatas,
    CurvaLimiteGz: 'MasGzTodas',
  };
  return ConstruirElemento(EstadoEntrada, P, Receta, Layout);
};

export const ElementoDiveLoop: Constructor = (EstadoEntrada, Parametros, Layout = null) => {
  const P = { ...Parametros, RadioDeReferencia: Parametros.RadioDelDiveLoop };
  const Sentido = SignoDelSentido(P.SentidoDelGiro, 'ElementoDiveLoop');
  const Receta: Receta = {
    Nombre: 'DiveLoop',
    GiroObjetivo: Math.PI,
    DesfasajeDeCurvatura: Math.PI,
    RollDelElemento: Math.PI,
    DesplazamientoObjetivo: P.SeparacionDelDiveLoop,
    CurvaLimiteGz: 'MasGzTodas',
    CurvaLimiteGy: 'GyBase',
    SentidoDeGy: Sentido,
  };
  return ConstruirElemento(EstadoEntrada, P, Receta, Layout);
};

export const ElementoHelice: Constructor = (EstadoEntrada, Parametros, Layout = null) => {
  const P = { ...Parametros, RadioDeReferencia: Parametros.RadioDeLaHelice };
  const Sentido = SignoDelSentido(P.SentidoDelGiro, 'ElementoHelice');
  const Receta: Receta = {
    Nombre: 'Helice',
    GiroObjetivo: 2 * Math.PI * P.VueltasDeLaHelice,
    DesfasajeDeCurvatura: (Sentido * Math.PI) / 2,
    RollDelElemento: Sentido * P.PeralteDeLaHelice,
    DesplazamientoObjetivo: -Sentido * P.AvanceDeLaHelice,
    CurvaLimiteGz: 'MasGzTodas',
  };
  return ConstruirElemento(EstadoEntrada, P, Receta, Layout);
};

export const ElementoOverBankedTurn: Constructor = (EstadoEntrada, Parametros, Layout = null) => {
  const P = { ...Parametros, RadioDeReferencia: Parametros.RadioDelGiro };
  const Sentido = SignoDelSentido(P.SentidoDelGiro, 'ElementoOverBankedTurn');
  const Receta: Receta = {
    Nombre: 'OverBankedTurn',
    GiroObjetivo: P.AnguloDelGiro,
    DesfasajeDeCurvatura: (Sentido * Math.PI) / 2,
    RollDelElemento: Sentido * P.PeralteDelGiro,
    DesplazamientoObjetivo: -Sentido * P.AvanceDelGiro,
    CurvaLimiteGz: 'MasGzTodas',
  };
  return ConstruirElemento(EstadoEntrada, P, Receta, Layout);
};

/** CatalogoDeElementos.m, por nombre. */
export const CONSTRUCTORES: Record<NombreDeElemento, Constructor> = {
  LoopVertical: ElementoLoopVertical,
  DiveLoop: ElementoDiveLoop,
  Helice: ElementoHelice,
  OverBankedTurn: ElementoOverBankedTurn,
};

// ------------------------------------------------------------ metodos de acoplamiento
function ResolverMetodoA(EstadoEntrada: Estado, Parametros: Parametros, Receta: Receta): [Track, Diagnostico] {
  const inicio = performance.now();
  const [Track, D] = GenerarGeometria(EstadoEntrada, Parametros, Receta, null);
  return [Track, { ...D, Metodo: 'A - marcha acoplada', IteracionesPuntoFijo: 1, ResiduoPuntoFijo: 0, TiempoDeComputo: (performance.now() - inicio) / 1000 }];
}

function ResolverMetodoB(EstadoEntrada: Estado, Parametros: Parametros, Receta: Receta): [Track, Diagnostico] {
  const inicio = performance.now();
  const ArcoInicial = EstadoEntrada.LongitudAcumulada;
  let ArcoSupuesto: ArrayLike<number> = [ArcoInicial, ArcoInicial + 100];
  let VelocidadSupuesta: ArrayLike<number> = [EstadoEntrada.Velocidad, EstadoEntrada.Velocidad];
  let Residuo = Infinity;
  let Track!: Track;
  let D!: DiagnosticoDeGeometria;
  let Iteracion = 0;
  for (Iteracion = 1; Iteracion <= Parametros.MaxIteracionesPuntoFijo; Iteracion++) {
    const Interpolante = InterpolanteDeVelocidad(ArcoSupuesto, VelocidadSupuesta);
    [Track, D] = GenerarGeometria(EstadoEntrada, Parametros, Receta, Interpolante);
    const ArcoNuevo = D.PerfilVelocidad.Arco;
    const VelocidadNueva = D.PerfilVelocidad.Velocidad;
    Residuo = maximo(Array.from(VelocidadNueva, (v, i) => Math.abs(v - Interpolante(ArcoNuevo[i]!))));
    ArcoSupuesto = ArcoNuevo;
    VelocidadSupuesta = VelocidadNueva;
    if (Residuo < Parametros.TolPuntoFijo) break;
  }
  if (Iteracion > Parametros.MaxIteracionesPuntoFijo) Iteracion = Parametros.MaxIteracionesPuntoFijo;
  return [Track, { ...D, Metodo: 'B - punto fijo', IteracionesPuntoFijo: Iteracion, ResiduoPuntoFijo: Residuo, TiempoDeComputo: (performance.now() - inicio) / 1000 }];
}

function InterpolanteDeVelocidad(Arco: ArrayLike<number>, Velocidad: ArrayLike<number>): (s: number) => number {
  // unique(Arco, 'stable'): se conserva la primera aparicion de cada arco.
  const vistos = new Set<number>();
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < Arco.length; i++) {
    if (vistos.has(Arco[i]!)) continue;
    vistos.add(Arco[i]!);
    xs.push(Arco[i]!);
    ys.push(Velocidad[i]!);
  }
  return interpolantePchip(xs, ys);
}

// ------------------------------------------------------------ construccion
export function ConstruirElemento(EstadoEntrada: Estado, Parametros: Parametros, Receta: Receta, Layout: Layout | null = null): [Estado, Elemento, Reporte] {
  const Previos = ChequeosPrevios(EstadoEntrada, Parametros, Receta);

  let Track: Track;
  let D: Diagnostico;
  switch (Parametros.MetodoDeAcoplamiento.toUpperCase()) {
    case 'A':
      [Track, D] = ResolverMetodoA(EstadoEntrada, Parametros, Receta);
      break;
    case 'B':
      [Track, D] = ResolverMetodoB(EstadoEntrada, Parametros, Receta);
      break;
    case 'AMBOS':
      // La geometria que queda es la del metodo A; la comparacion se imprime en MATLAB, aca no se conserva.
      [Track, D] = ResolverMetodoA(EstadoEntrada, Parametros, Receta);
      break;
    default:
      throw new Error(`Metodo de acoplamiento no reconocido: ${Parametros.MetodoDeAcoplamiento}. Las opciones son 'A', 'B' o 'Ambos'.`);
  }

  const Sim = SimularSobreTrack(Track, EstadoEntrada, Parametros);
  const [Posteriores, Normativo] = ChequeosPosteriores(Track, Sim, Parametros, Layout);

  AgregarCriterio(Posteriores, 'Giro objetivo alcanzado', 'MenorOIgual', Math.abs(D.ResidualCierrePitch), Parametros.TolCierrePitch, 'rad',
    'Si falla, las transiciones consumen mas giro que el que pide el elemento: hay que agrandar el radio o entrar mas lento.');
  CriterioDeObjetivoDeG(Posteriores, Track, Sim, D, Receta, Parametros);

  // ---------------- Estado de salida -------------------------------------
  const Ultimo = Track.PuntosRiel.length - 1;
  const EstadoSalida: Estado = {
    Posicion: Track.PuntosRiel[Ultimo]!,
    VersorTangente: Track.VersorTangente[Ultimo]!,
    VersorArribaCarro: Track.VersorArribaCarro[Ultimo]!,
    VersorLateral: Track.VersorLateral[Ultimo]!,
    VectorCurvatura: Track.VectorCurvatura[Ultimo]!,
    DerivadaCurvatura: Track.DerivadaCurvatura[Ultimo]!,
    AnguloRoll: Track.AnguloRoll[Ultimo]!,
    VelocidadRoll: Track.VelocidadRoll[Ultimo]!,
    AceleracionRoll: Track.AceleracionRoll[Ultimo]!,
    LongitudAcumulada: Track.LongitudArco[Ultimo]!,
    Velocidad: Sim.VelocidadCentroDeMasa[Ultimo]!,
    EnergiaTotal: Sim.EnergiaTotal[Ultimo]!,
  };

  // ---------------- Numeros de salida ------------------------------------
  const Escala = D.Escala;
  const AlturaRelativa = Track.PuntosHeartline.map((p) => p[2] - Track.PuntosHeartline[0]![2]);
  const n = Track.LongitudArco.length;

  let VelocidadInicialMinima = NaN;
  let BusquedaVelocidad: BusquedaVelocidad = { Convergio: false, Evaluaciones: 0, Motivo: 'No se pidio el calculo.' };
  if (Parametros.CalcularVelocidadMinima) {
    [VelocidadInicialMinima, BusquedaVelocidad] = VelocidadInicialMinimaDe(EstadoEntrada, Parametros, Receta);
  }

  const R: Resumen = {
    Metodo: D.Metodo,
    LongitudRecorrida: Track.LongitudArco[n - 1]! - Track.LongitudArco[0]!,
    LongitudDeMaterial: LongitudDePolilinea(Track.PuntosRiel),
    AlturaMaxima: maximo(AlturaRelativa),
    RadioMinimoRiel: 1 / Math.max(maximo(Track.Curvatura), EPS),
    RadioMinimo: 1 / Math.max(maximo(Track.CurvaturaHeartline), EPS),
    FuerzaNormalMaxima: maximo(Sim.FuerzaNormal),
    VelocidadMinima: minimo(Sim.VelocidadCentroDeMasa),
    TiempoDeRecorrido: Sim.Tiempo[n - 1]!,
    EnergiaDisipadaRodadura: Sim.EnergiaDisipadaRodadura[n - 1]!,
    EnergiaDisipadaArrastre: Sim.EnergiaDisipadaArrastre[n - 1]!,
    GzMaxima: maximo(Sim.Gz),
    GzMinima: minimo(Sim.Gz),
    GyMaximaAbsoluta: maximo(Array.from(Sim.Gy, Math.abs)),
    GzMaximaCabeza: maximo(Sim.GzCabeza),
    GyMaximaAbsolutaCabeza: maximo(Array.from(Sim.GyCabeza, Math.abs)),
    BrazoDeVerificacion: Sim.BrazoDeVerificacion,
    PeralteFinal: Track.AnguloPeralte[n - 1]!,
    PeralteMaximo: maximo(Array.from(Track.AnguloPeralte, Math.abs)),
    ResidualCierrePitch: D.ResidualCierrePitch,
    ResidualCierreTangente: norma(resta(Track.VersorTangente[n - 1]!, Track.VersorTangente[0]!)),
    PosicionFinal: Track.PuntosRiel[n - 1]!,
    DesplazamientoLateral: D.DesplazamientoLateral,
    DesplazamientoLateralObjetivo: Receta.DesplazamientoObjetivo,
    InclinacionHelicoidal: D.InclinacionHelicoidal,
    SaltoDeTangente: norma(resta(Track.VersorTangente[0]!, EstadoEntrada.VersorTangente)),
    SaltoDeCurvatura: norma(resta(Track.VectorCurvatura[0]!, EstadoEntrada.VectorCurvatura)),
    SaltoDePosicion: norma(resta(Track.PuntosRiel[0]!, EstadoEntrada.Posicion)),
    LambdaLoop: Escala.LambdaLoop,
    LambdaCarro: Escala.LambdaCarro,
    Distorsion: Escala.Distorsion,
    CarrosEquivalentes: Escala.CarrosEquivalentes,
    OnsetMaximoModelo: Escala.OnsetMaximo,
    VelocidadInicialMinima,
    BusquedaVelocidad,
  };

  const Reporte: Reporte = { Previos, Posteriores, Normativo, Resumen: R };
  const Elemento: Elemento = {
    Nombre: Receta.Nombre, Track, Sim, SubTramos: Track.SubTramos, Diagnostico: D, Parametros, Receta, EstadoEntrada, EstadoSalida,
  };
  return [EstadoSalida, Elemento, Reporte];
}

function LongitudDePolilinea(Puntos: Track['PuntosRiel']): number {
  let Longitud = 0;
  for (let i = 1; i < Puntos.length; i++) Longitud += norma(resta(Puntos[i]!, Puntos[i - 1]!));
  return Longitud;
}

function CriterioDeObjetivoDeG(Criterios: Criterio[], Track: Track, Sim: Sim, D: Diagnostico, Receta: Receta, Parametros: Parametros): void {
  const arco = Track.SubTramos.find((s) => s.Nombre === 'ArcoPrincipal');
  if (!arco) return;
  const Rango: number[] = [];
  for (let i = arco.IndiceInicio; i <= arco.IndiceFin; i++) if (!Number.isNaN(Sim.Gz[i]!)) Rango.push(i);
  if (Rango.length === 0) {
    AgregarCriterio(Criterios, 'Gz objetivo del modo alcanzado', 'Informativo', NaN, NaN, 'G', 'El arco principal quedo vacio: las clotoides consumieron todo el giro.');
    return;
  }

  let Objetivo: number[];
  let Detalle: string;
  let DuracionReal: number[] = [];
  const FactorDeSeguridad = Parametros.FactorDeSeguridadNormativo;
  const Semiancho = Parametros.SemianchoDeSuavizadoNormativo;
  switch (Parametros.ModoCurvatura) {
    case 'FuerzaGConstante':
      Objetivo = Rango.map(() => Parametros.FuerzaGObjetivo);
      Detalle = `FuerzaGObjetivo = ${sprintfF(Parametros.FuerzaGObjetivo, 2)} G`;
      break;
    case 'GNormativaMaxima': {
      const t0 = Sim.Tiempo[Rango[0]!]!;
      DuracionReal = Rango.map((i) => (Sim.Tiempo[i]! - t0) * D.Escala.RaizLambdaLoop);
      Objetivo = Rango.map((i) => EvaluarObjetivoNormativo(Track.ObjetivoNormativo!, Sim.Tiempo[i]!));
      Detalle =
        `curva ${Receta.CurvaLimiteGz} / FS ${sprintfF(FactorDeSeguridad, 2)} menos TolObjetivoDeG, reloj por nivel: ` +
        `de ${sprintfF(Objetivo[0]!, 2)} a ${sprintfF(Objetivo[Objetivo.length - 1]!, 2)} G a lo largo del arco (${sprintfF(DuracionReal[DuracionReal.length - 1]!, 2)} s reales)`;
      break;
    }
    default:
      return;
  }

  const Desvio = maximo(Rango.map((i, k) => Math.abs(Sim.Gz[i]! - Objetivo[k]!)));
  AgregarCriterio(Criterios, 'Gz objetivo del modo alcanzado', 'MenorOIgual', Desvio, Parametros.TolObjetivoDeG, 'G',
    `${Detalle}; medido en el punto de verificacion (brazo ${sprintfF(Sim.BrazoDeVerificacion, 3)} m). Si falla, el objetivo era ` +
      'inalcanzable a esa velocidad con ese brazo, o el arco es demasiado corto.');

  if (Parametros.ModoCurvatura === 'GNormativaMaxima' && Receta.CurvaLimiteGy) {
    const SemiejeGz = (1.1 * Math.abs(limiteNormativo(Receta.CurvaLimiteGz, 0.2))) / FactorDeSeguridad;
    const SemiejeGy = (1.1 * Math.abs(limiteNormativo(Receta.CurvaLimiteGy, 0.2))) / FactorDeSeguridad;
    const ObjetivoGy = Rango.map((_, k) => {
      const GyDeLaCurva = Math.abs(limiteDeDiseno(Receta.CurvaLimiteGy!, DuracionReal[k]!, Semiancho)) / FactorDeSeguridad;
      const GyDeLaElipse = SemiejeGy * Math.sqrt(Math.max(1 - (Objetivo[k]! / SemiejeGz) ** 2, 0));
      return (Receta.SentidoDeGy ?? 1) * Math.max(Math.min(GyDeLaCurva, GyDeLaElipse) - Parametros.TolObjetivoDeG, 0);
    });
    const DesvioGy = maximo(Rango.map((i, k) => Math.abs(Sim.Gy[i]! - ObjetivoGy[k]!)));
    const SubPeralte = rad2deg(maximo(Rango.map((i) => Math.abs(Track.AnguloCurvaturaDesdeArriba[i]!))));
    AgregarCriterio(Criterios, 'Gy objetivo del modo alcanzado', 'MenorOIgual', DesvioGy, Parametros.TolObjetivoDeG, 'G',
      `Gy objetivo ${sprintfF(ObjetivoGy[0]!, 2)} a ${sprintfF(ObjetivoGy[ObjetivoGy.length - 1]!, 2)} G: el maximo que deja la elipse de 7.1.5.1 con ese Gz ` +
        `(curva ${Receta.CurvaLimiteGy} como tope, todo / FS ${sprintfF(FactorDeSeguridad, 2)}), menos TolObjetivoDeG. Sub-peralte de la curvatura: hasta ${sprintfF(SubPeralte, 1)} grados.`);
  }
}

// ------------------------------------------------------------ velocidad inicial minima
function VelocidadInicialMinimaDe(EstadoEntrada: Estado, Parametros: Parametros, Receta: Receta): [number, BusquedaVelocidad] {
  const ParametrosBusqueda = { ...Parametros, PasoGeneracion: Parametros.PasoBusquedaVelocidad };
  const Holgura = (Velocidad: number) => HolguraDeCuspide(EstadoEntrada, ParametrosBusqueda, Receta, Velocidad);

  let VelocidadAlta = Math.max(EstadoEntrada.Velocidad, 0.5);
  const VelocidadTope = 3 * VelocidadAlta;
  let Evaluaciones = 0;
  while (Holgura(VelocidadAlta) < 0) {
    VelocidadAlta = 1.5 * VelocidadAlta;
    Evaluaciones++;
    if (VelocidadAlta > VelocidadTope) {
      return [NaN, { Convergio: false, Evaluaciones, Motivo: `Ninguna velocidad hasta ${sprintfF(VelocidadTope, 1)} m/s satisface la G minima de cuspide y el radio fabricable a la vez.` }];
    }
  }
  let VelocidadBaja = VelocidadAlta;
  while (Holgura(VelocidadBaja) >= 0) {
    VelocidadBaja = VelocidadBaja / 1.5;
    Evaluaciones++;
    if (VelocidadBaja < 1e-3) break;
  }
  for (let Iteracion = 1; Iteracion <= 40; Iteracion++) {
    const VelocidadMedia = 0.5 * (VelocidadBaja + VelocidadAlta);
    if (Holgura(VelocidadMedia) >= 0) VelocidadAlta = VelocidadMedia;
    else VelocidadBaja = VelocidadMedia;
    Evaluaciones++;
    if (VelocidadAlta - VelocidadBaja < 1e-3) break;
  }
  return [VelocidadAlta, { Convergio: true, Evaluaciones, Motivo: `Biseccion cerrada en ${sprintfF(VelocidadAlta, 4)} m/s con tolerancia 1e-3 m/s.` }];
}

function HolguraDeCuspide(EstadoEntrada: Estado, Parametros: Parametros, Receta: Receta, Velocidad: number): number {
  const Estado: Estado = {
    ...EstadoEntrada,
    Velocidad,
    EnergiaTotal: 0.5 * Parametros.Masa * (Velocidad * Velocidad) + Parametros.Masa * Parametros.Gravedad * EstadoEntrada.Posicion[2],
  };
  let Track: Track;
  let D: DiagnosticoDeGeometria;
  try {
    [Track, D] = GenerarGeometria(Estado, Parametros, Receta, null);
  } catch {
    return -Infinity;
  }
  if (D.Aviso !== '') return -Infinity;
  const clotoide = Track.SubTramos.find((s) => s.Nombre === 'ClotoideEntrada');
  const Desde = clotoide ? clotoide.IndiceInicio : 0;
  const HolguraDeG = minimo(D.GArribaVerificacion.subarray(Desde)) - Parametros.GMinimaCuspide;
  const RadioAlcanzado = 1 / Math.max(maximo(Track.Curvatura), EPS);
  const HolguraDeRadio = (RadioAlcanzado - Parametros.RadioMinimoFabricable) / Parametros.RadioMinimoFabricable;
  return Math.min(HolguraDeG, HolguraDeRadio);
}

// ------------------------------------------------------------ layout
export function LayoutNuevo(EstadoInicialDelLayout: Estado, Parametros: Parametros): Layout {
  return { EstadoInicial: EstadoInicialDelLayout, EstadoActual: EstadoInicialDelLayout, Parametros, Elementos: [], PuntosRiel: [], LongitudArcoRiel: [] };
}

export function LayoutAgregarElemento(Layout: Layout, Elemento: Elemento, EstadoSalida: Estado, Reporte: Reporte): Layout {
  const Registro: RegistroDeLayout = { Elemento, EstadoEntrada: Elemento.EstadoEntrada, EstadoSalida, Reporte };
  const desde = Layout.PuntosRiel.length === 0 ? 0 : 1;
  return {
    ...Layout,
    Elementos: [...Layout.Elementos, Registro],
    EstadoActual: EstadoSalida,
    PuntosRiel: [...Layout.PuntosRiel, ...Elemento.Track.PuntosRiel.slice(desde)],
    LongitudArcoRiel: [...Layout.LongitudArcoRiel, ...Array.from(Elemento.Track.LongitudArco.subarray(desde))],
  };
}

