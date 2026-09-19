// Port de Verificacion/: AgregarCriterio, ChequeosPrevios, ChequeosPosteriores,
// VerificarLimitesNormativos y DistanciaMinimaEntrePolilineas. Los textos de
// los criterios son los de MATLAB, con los mismos formatos de sprintf.

import { BrazoDeVerificacion, EscalasDeFroude, MarcoTransporteDesdeCarro } from './basicos';
import {
  cruz, linspace, maximo, minimo, modulo, norma, normaDe, punto as productoPunto, rad2deg, resta, sprintfF, type Vec3,
} from './matematica';
import { limiteNormativo, tramosContiguos, type CurvaNormativa } from './norma';
import type { Criterio, Escala, Estado, EventoSostenido, Layout, Normativo, Parametros, Receta, SentidoDeCriterio, Sim, Track } from './tipos';

// ------------------------------------------------------------ criterios
export function AgregarCriterio(
  Criterios: Criterio[], Nombre: string, Sentido: SentidoDeCriterio, Valor: number, Limite: number, Unidad: string, Detalle = '',
): void {
  let Margen: number;
  let Pasa: boolean;
  switch (Sentido) {
    case 'MenorOIgual':
      Margen = Limite - Valor;
      Pasa = Margen >= 0;
      break;
    case 'MayorOIgual':
      Margen = Valor - Limite;
      Pasa = Margen >= 0;
      break;
    case 'Informativo':
      Margen = NaN;
      Pasa = true;
      break;
    default:
      throw new Error(`Sentido no reconocido: ${String(Sentido)}`);
  }
  Criterios.push({ Nombre, Sentido, Pasa, Valor, Limite, Margen, Unidad, Detalle });
}

// ------------------------------------------------------------ previos
export function ChequeosPrevios(EstadoEntrada: Estado, Parametros: Parametros, Receta: Receta): Criterio[] {
  const Criterios: Criterio[] = [];
  const g = Parametros.Gravedad;
  const T = EstadoEntrada.VersorTangente;

  const ProyeccionHorizontal = normaDe([T[0], T[1]]);
  AgregarCriterio(Criterios, 'Tangente de entrada no vertical', 'MayorOIgual', ProyeccionHorizontal, 1e-6, '-',
    'Con la tangente vertical pura el plano del elemento queda indeterminado: hay que dar el azimut.');

  const Pitch = Math.asin(Math.max(Math.min(T[2], 1), -1));
  AgregarCriterio(Criterios, 'Pitch de entrada no descendente', 'MayorOIgual', rad2deg(Pitch), -15, 'grados',
    'Con pitch bajando fuerte esto no es un loop vertical estandar sino un dive loop.');

  const NormalEnPlano = NormalDelPlanoVerticalPrevio(T, ProyeccionHorizontal);
  const CurvaturaEnPlano = productoPunto(EstadoEntrada.VectorCurvatura, NormalEnPlano);
  const CurvaturaFueraPlano = productoPunto(EstadoEntrada.VectorCurvatura, cruz(T, NormalEnPlano));
  AgregarCriterio(Criterios, 'Curvatura de entrada dentro del plano', 'Informativo', CurvaturaEnPlano, NaN, '1/m',
    'Si no es nula se usa clotoide desplazada, que arranca en kappa_0 en vez de en cero.');
  AgregarCriterio(Criterios, 'Curvatura de entrada fuera del plano', 'Informativo', CurvaturaFueraPlano, NaN, '1/m',
    'Si no es nula se inserta un tramo de acondicionamiento que la lleva a cero.');

  const [ArribaTransporte, LateralTransporte] = MarcoTransporteDesdeCarro(EstadoEntrada.VersorArribaCarro, EstadoEntrada.VersorLateral, EstadoEntrada.AnguloRoll);
  const Beta = Math.atan2(productoPunto(NormalEnPlano, LateralTransporte), productoPunto(NormalEnPlano, ArribaTransporte));
  let DeltaRoll = Beta + Receta.RollDelElemento - EstadoEntrada.AnguloRoll;
  if (Math.abs(DeltaRoll) > Math.PI + 1e-9) DeltaRoll = modulo(DeltaRoll + Math.PI, 2 * Math.PI) - Math.PI;
  AgregarCriterio(Criterios, 'Roll de entrada compatible', 'Informativo', rad2deg(DeltaRoll), NaN, 'grados',
    'Si no es cero se inserta una transicion de roll con smoothstep quintico.');

  const RadioNominal = Parametros.RadioDeReferencia;
  const FraccionVertical = Math.max(Math.cos(Receta.DesfasajeDeCurvatura), 0);
  const AlturaCuspide = RadioNominal * (1 - Math.cos(Math.min(Receta.GiroObjetivo, Math.PI))) * FraccionVertical;
  const VelocidadCuspideCuadrado = (Parametros.GMinimaCuspide + FraccionVertical) * g * RadioNominal;
  const VelocidadMinimaEstimada = Math.sqrt(VelocidadCuspideCuadrado + 2 * g * AlturaCuspide);

  AgregarCriterio(Criterios, 'Velocidad de entrada suficiente (estimada)', 'MayorOIgual', EstadoEntrada.Velocidad, VelocidadMinimaEstimada, 'm/s',
    'Estimacion sin perdidas sobre un arco circular de radio nominal.');
  AgregarCriterio(Criterios, 'Altura estimada del elemento', 'MenorOIgual', AlturaCuspide, Parametros.AlturaMaximaDelElemento, 'm',
    'Estimacion con el radio nominal; la altura real sale de la geometria.');
  AgregarCriterio(Criterios, 'Radio nominal fabricable', 'MayorOIgual', RadioNominal, Parametros.RadioMinimoFabricable, 'm',
    'En los modos que dependen de v el radio real puede ser menor: ver el chequeo posterior.');
  return Criterios;
}

function NormalDelPlanoVerticalPrevio(T: Vec3, ProyeccionHorizontal: number): Vec3 {
  if (ProyeccionHorizontal < 1e-9) return [0, 0, 1];
  const Horizontal: Vec3 = [T[0] / ProyeccionHorizontal, T[1] / ProyeccionHorizontal, 0];
  const Normal: Vec3 = [-T[2] * Horizontal[0], -T[2] * Horizontal[1], -T[2] * Horizontal[2] + ProyeccionHorizontal];
  const n = norma(Normal);
  return [Normal[0] / n, Normal[1] / n, Normal[2] / n];
}

// ------------------------------------------------------------ posteriores
export function ChequeosPosteriores(Track: Track, Sim: Sim, Parametros: Parametros, Layout: Layout | null): [Criterio[], Normativo] {
  const Criterios: Criterio[] = [];
  const Escala = EscalasDeFroude(Parametros);
  const n = Track.LongitudArco.length;
  const Valido = Array.from(Sim.Velocidad, (v) => !Number.isNaN(v));
  const AlturaRelativa = Track.PuntosHeartline.map((p) => p[2] - Track.PuntosHeartline[0]![2]);
  const validos = (valores: ArrayLike<number>) => Array.from({ length: n }, (_, i) => (Valido[i] ? valores[i]! : NaN));

  AgregarCriterio(Criterios, 'El carro completa el elemento', 'MayorOIgual', Sim.PuntoDeParada === null ? 1 : 0, 1, '-',
    'Si falla, el carro se queda sin energia antes del final.');
  AgregarCriterio(Criterios, 'G minima sobre el eje vertical del carro', 'MayorOIgual', minimo(validos(Sim.Gz)), Parametros.GMinimaCuspide, 'G',
    `Margen en la cuspide, en el punto de verificacion (${Parametros.PuntoDeVerificacionNormativa}, brazo ${sprintfF(Sim.BrazoDeVerificacion, 3)} m). ` +
      'N = 0 no sirve como criterio: no tolera variacion de friccion.');

  const RadioMinimoRiel = 1 / Math.max(maximo(Track.Curvatura), Number.EPSILON);
  const RadioMinimo = 1 / Math.max(maximo(Track.CurvaturaHeartline), Number.EPSILON);
  AgregarCriterio(Criterios, 'Radio de curvatura minimo del riel', 'MayorOIgual', RadioMinimoRiel, Parametros.RadioMinimoFabricable, 'm',
    `Lo limita la impresora 3D. Es el radio del riel (${sprintfF(RadioMinimoRiel, 4)} m), no el del heartline (${sprintfF(RadioMinimo, 4)} m): el offset de ${sprintfF(Parametros.DistanciaHeartline, 3)} m los separa.`);

  const RazonDeRadios = RadioMinimo / Parametros.RadioDeReferencia;
  AgregarCriterio(Criterios, 'Radio alcanzado coherente con el nominal', 'MayorOIgual', Math.min(RazonDeRadios, 1 / RazonDeRadios), 0.75, '-',
    `Radio nominal ${sprintfF(Parametros.RadioDeReferencia, 4)} m contra alcanzado ${sprintfF(RadioMinimo, 4)} m, los dos sobre el heartline. ` +
      'RadioDeReferencia es la longitud caracteristica de Froude: fija lambda_loop, el presupuesto de onset y la conversion de duraciones.');

  AgregarCriterio(Criterios, 'Altura del loop', 'MenorOIgual', maximo(AlturaRelativa), Parametros.AlturaMaximaDelElemento, 'm',
    'Medida sobre el heartline, respecto del punto de entrada del elemento.');
  AgregarCriterio(Criterios, 'Altura del riel sobre el suelo', 'MayorOIgual', minimo(Track.PuntosRiel.map((p) => p[2])), Parametros.AlturaMinimaSuelo, 'm',
    'Sobre el riel: es la pieza que efectivamente puede tocar el piso.');

  const Caja = Parametros.BoundingBoxDisponible;
  const minimos = [0, 1, 2].map((c) => minimo(Track.PuntosRiel.map((p) => p[c]!)));
  const maximos = [0, 1, 2].map((c) => maximo(Track.PuntosRiel.map((p) => p[c]!)));
  const Sobresale = maximo([
    Caja[0][0] - minimos[0]!, Caja[1][0] - minimos[1]!, Caja[2][0] - minimos[2]!,
    maximos[0]! - Caja[0][1], maximos[1]! - Caja[1][1], maximos[2]! - Caja[2][1],
  ]);
  AgregarCriterio(Criterios, 'Dentro del bounding box disponible', 'MenorOIgual', Sobresale, 0, 'm', 'Maximo desborde sobre cualquiera de las seis caras.');

  const RadioEnvolvente = Math.hypot(Parametros.AnchoVia + 2 * Parametros.Holgura, Parametros.AltoCarro + 2 * Parametros.Holgura) / 2;
  const SeparacionExigida = 2 * RadioEnvolvente + Parametros.DistanciaMinimaEntreVias;

  const [DistanciaPropia, IndicePropioA, IndicePropioB] = DistanciaMinimaEntrePolilineas(
    Track.PuntosRiel, Track.PuntosRiel, Track.LongitudArco, Track.LongitudArco, Parametros.ArcoMinimoAutointerferencia,
  );
  let DetalleOrientado = '';
  if (Number.isFinite(DistanciaPropia)) {
    DetalleOrientado =
      `Seccion orientada en el par critico: exigiria ${sprintfF(SeparacionOrientada(Track, IndicePropioA, IndicePropioB, Parametros), 4)} m. ` +
      `Pares vecinos por arco (< ${sprintfF(Parametros.ArcoMinimoAutointerferencia, 2)} m) excluidos.`;
  }
  AgregarCriterio(Criterios, 'Autointerferencia del loop', 'MayorOIgual', DistanciaPropia, SeparacionExigida, 'm', DetalleOrientado);

  let DistanciaLayout = Infinity;
  if (Layout && Layout.PuntosRiel.length > 0) {
    [DistanciaLayout] = DistanciaMinimaEntrePolilineas(Track.PuntosRiel, Layout.PuntosRiel, Track.LongitudArco, Layout.LongitudArcoRiel, Parametros.ArcoMinimoAutointerferencia);
  }
  AgregarCriterio(Criterios, 'Interferencia con la via preexistente', 'MayorOIgual', DistanciaLayout, SeparacionExigida, 'm',
    `Distancia segmento a segmento contra toda la polilinea ya construida, salteando la junta (pares a menos de ${sprintfF(Parametros.ArcoMinimoAutointerferencia, 2)} m de arco).`);

  const Normativo = VerificarLimitesNormativos(Sim, Escala, Parametros);
  const Ejes = ['Gx', 'Gy', 'Gz'] as const;
  for (let i = 0; i < 3; i++) {
    AgregarCriterio(Criterios, `Onset maximo de ${Ejes[i]}`, 'MenorOIgual', Normativo.OnsetMaximoPorEje[i]!, Escala.OnsetMaximo[i]!, 'G/s',
      `Presupuesto del modelo = sqrt(lambda_loop) x ${sprintfF(Parametros.OnsetNormativoPorEje[i]!, 1)} G/s de la norma.`);
  }
  AgregarCriterio(Criterios, 'Onset de 0 G a 2 G (7.1.7.2)', 'MenorOIgual', Normativo.OnsetDeCarga, Escala.OnsetMaximo[2], 'G/s',
    'Alcance literal de la clausula: solo transiciones desde 0 G o menos hacia 2 G o mas.');

  AgregarCriterioNormativo(Criterios, '+Gz (Fig. 10)', Normativo.MasGz);
  AgregarCriterioNormativo(Criterios, '-Gz (Fig. 9)', Normativo.MenosGz);
  AgregarCriterioNormativo(Criterios, 'Gy (Fig. 8)', Normativo.Gy);
  AgregarCriterioNormativo(Criterios, '+Gx (Fig. 6)', Normativo.MasGx);
  AgregarCriterioNormativo(Criterios, '-Gx (Fig. 7)', Normativo.MenosGx);

  AgregarCriterio(Criterios, 'Elipse de dos ejes Gy-Gz (7.1.5.1)', 'MenorOIgual', Normativo.Elipse.ValorMaximoGyGz, 1, '-',
    'Semiejes iguales a los limites de 200 ms multiplicados por 1.1.');
  AgregarCriterio(Criterios, 'Elipse de dos ejes Gx-Gz (7.1.5.1)', 'MenorOIgual', Normativo.Elipse.ValorMaximoGxGz, 1, '-');
  AgregarCriterio(Criterios, 'Elipse de dos ejes Gx-Gy (7.1.5.1)', 'MenorOIgual', Normativo.Elipse.ValorMaximoGxGy, 1, '-');

  AgregarCriterio(Criterios, 'Gz maxima en la cabeza', 'Informativo', maximo(validos(Sim.GzCabeza)), NaN, 'G',
    `A ${sprintfF(Parametros.DistanciaHeartline + Parametros.DistanciaHeartlineACabeza, 3)} m del riel (d + e). Las verificadas arriba estan a ${sprintfF(Sim.BrazoDeVerificacion, 3)} m.`);
  AgregarCriterio(Criterios, '|Gy| maxima en la cabeza', 'Informativo', maximo(validos(Sim.GyCabeza).map(Math.abs)), NaN, 'G', '');

  return [Criterios, Normativo];
}

function AgregarCriterioNormativo(Criterios: Criterio[], Nombre: string, Evento: EventoSostenido): void {
  if (!Number.isFinite(Evento.Exceso)) {
    AgregarCriterio(Criterios, Nombre, 'Informativo', Evento.PicoG, NaN, 'G',
      'Ningun evento sostenido supera los 200 ms: fuera del alcance de la norma (7.1.4.2).');
    return;
  }
  AgregarCriterio(Criterios, Nombre, 'MenorOIgual', Evento.Exceso, 0, 'G',
    `Nivel critico ${sprintfF(Evento.NivelCritico, 2)} G sostenido ${sprintfF(Evento.DuracionReal, 2)} s equivalentes reales; limite ${sprintfF(Evento.LimiteAplicado, 2)} G.`);
}

function SeparacionOrientada(Track: Track, IndiceA: number, IndiceB: number, Parametros: Parametros): number {
  let Direccion = resta(Track.PuntosRiel[IndiceB]!, Track.PuntosRiel[IndiceA]!);
  const largo = norma(Direccion);
  if (largo < 1e-12) return Infinity;
  Direccion = [Direccion[0] / largo, Direccion[1] / largo, Direccion[2] / largo];
  const SemiAncho = Parametros.AnchoVia / 2 + Parametros.Holgura;
  const SemiAlto = Parametros.AltoCarro / 2 + Parametros.Holgura;
  const Soporte = (i: number) =>
    SemiAncho * Math.abs(productoPunto(Direccion, Track.VersorLateral[i]!)) + SemiAlto * Math.abs(productoPunto(Direccion, Track.VersorArribaCarro[i]!));
  return Soporte(IndiceA) + Soporte(IndiceB) + Parametros.DistanciaMinimaEntreVias;
}

// ------------------------------------------------------------ distancia entre polilineas
/** Distancia minima segmento a segmento. Devuelve [distancia, indiceA, indiceB] (base 0; NaN si no hay). */
export function DistanciaMinimaEntrePolilineas(
  PuntosA: Vec3[], PuntosB: Vec3[], ArcoA: ArrayLike<number>, ArcoB: ArrayLike<number>, ArcoMinimoExcluido: number | null,
): [number, number, number] {
  const nA = PuntosA.length - 1;
  const nB = PuntosB.length - 1;
  let DistanciaMinima = Infinity;
  let IndiceA = NaN;
  let IndiceB = NaN;
  if (nA <= 0 || nB <= 0) return [DistanciaMinima, IndiceA, IndiceB];

  const OrigenB = PuntosB.slice(0, nB);
  const DireccionB: Vec3[] = OrigenB.map((o, j) => resta(PuntosB[j + 1]!, o));
  const ArcoSegmentoB = Array.from({ length: nB }, (_, j) => (ArcoB[j]! + ArcoB[j + 1]!) / 2);
  const e = DireccionB.map((dB) => productoPunto(dB, dB));

  for (let i = 0; i < nA; i++) {
    const Origen1 = PuntosA[i]!;
    const Direccion1 = resta(PuntosA[i + 1]!, Origen1);
    const ArcoSegmentoA = (ArcoA[i]! + ArcoA[i + 1]!) / 2;
    const a = productoPunto(Direccion1, Direccion1);
    let Menor = Infinity;
    let j = -1;
    for (let k = 0; k < nB; k++) {
      if (ArcoMinimoExcluido !== null && Math.abs(ArcoSegmentoB[k]! - ArcoSegmentoA) < ArcoMinimoExcluido) continue;
      const Diferencia = resta(Origen1, OrigenB[k]!);
      const b = productoPunto(DireccionB[k]!, Direccion1);
      const c = productoPunto(Diferencia, Direccion1);
      const f = productoPunto(DireccionB[k]!, Diferencia);
      const Denominador = a * e[k]! - b * b;
      let s = 0;
      if (Denominador > 1e-18) s = (b * f - c * e[k]!) / Denominador;
      s = Math.min(Math.max(s, 0), 1);
      let t = 0;
      if (e[k]! > 1e-18) t = (b * s + f) / e[k]!;
      if (t < 0) {
        t = 0;
        if (a > 1e-18) s = Math.min(Math.max(-c / a, 0), 1);
      } else if (t > 1) {
        t = 1;
        if (a > 1e-18) s = Math.min(Math.max((b - c) / a, 0), 1);
      }
      const dB = DireccionB[k]!;
      const Vector: Vec3 = [
        Diferencia[0] + s * Direccion1[0] - t * dB[0],
        Diferencia[1] + s * Direccion1[1] - t * dB[1],
        Diferencia[2] + s * Direccion1[2] - t * dB[2],
      ];
      const Distancia = norma(Vector);
      if (Distancia < Menor) {
        Menor = Distancia;
        j = k;
      }
    }
    if (Menor < DistanciaMinima) {
      DistanciaMinima = Menor;
      IndiceA = i;
      IndiceB = j;
    }
  }
  return [DistanciaMinima, IndiceA, IndiceB];
}

// ------------------------------------------------------------ norma
export function VerificarLimitesNormativos(Sim: Sim, Escala: Escala, Parametros: Parametros): Normativo {
  const n = Sim.Gz.length;
  const Tiempo: number[] = [];
  const Gx: number[] = [];
  const Gy: number[] = [];
  const Gz: number[] = [];
  const JerkGx: number[] = [];
  const JerkGy: number[] = [];
  const JerkGz: number[] = [];
  for (let i = 0; i < n; i++) {
    if (Number.isNaN(Sim.Gz[i]!) || Number.isNaN(Sim.Tiempo[i]!)) continue;
    Tiempo.push(Sim.Tiempo[i]!);
    Gx.push(Sim.Gx[i]!);
    Gy.push(Sim.Gy[i]!);
    Gz.push(Sim.Gz[i]!);
    JerkGx.push(Sim.JerkGx[i]!);
    JerkGy.push(Sim.JerkGy[i]!);
    JerkGz.push(Sim.JerkGz[i]!);
  }

  const FactorTiempo = Escala.RaizLambdaLoop;
  const DuracionModelo = Tiempo[Tiempo.length - 1]! - Tiempo[0]!;

  const EventoAirtimeLargo = PeorEventoSostenido(Gz, Tiempo, 'MenosGzBase', FactorTiempo, -1);
  const HuboAirtimeSostenido = EventoAirtimeLargo.DuracionMasLarga > 3.0;
  const CurvaMasGz: CurvaNormativa = HuboAirtimeSostenido ? 'MasGzReducido' : 'MasGzTodas';

  const MasGz = PeorEventoSostenido(Gz, Tiempo, CurvaMasGz, FactorTiempo, 1);
  const MenosGz = PeorEventoSostenido(Gz, Tiempo, 'MenosGzBase', FactorTiempo, -1);
  const GyEvento = PeorEventoSostenido(Gy.map(Math.abs), Tiempo, 'GyBase', FactorTiempo, 1);
  const MasGx = PeorEventoSostenido(Gx, Tiempo, 'MasGxBase', FactorTiempo, 1);
  const MenosGx = PeorEventoSostenido(Gx, Tiempo, 'MenosGxBase', FactorTiempo, -1);

  const SemiejeGx = SemiejePorSigno(Gx, 'MasGxBase', 'MenosGxBase');
  const SemiejeGy = SemiejePorSigno(Gy, 'GyBase', 'GyBase');
  const SemiejeGz = SemiejePorSigno(Gz, CurvaMasGz, 'MenosGzBase');
  const elipse = (A: number[], sA: number[], B: number[], sB: number[]) => maximo(A.map((a, i) => (a / sA[i]!) ** 2 + (B[i]! / sB[i]!) ** 2));

  return {
    FactorTiempo,
    DuracionModelo,
    DuracionRealEquivalente: DuracionModelo * FactorTiempo,
    HuboAirtimeSostenido,
    CurvaMasGzAplicada: CurvaMasGz,
    MasGz,
    MenosGz,
    Gy: GyEvento,
    MasGx,
    MenosGx,
    Elipse: {
      ValorMaximoGyGz: elipse(Gy, SemiejeGy, Gz, SemiejeGz),
      ValorMaximoGxGz: elipse(Gx, SemiejeGx, Gz, SemiejeGz),
      ValorMaximoGxGy: elipse(Gx, SemiejeGx, Gy, SemiejeGy),
      Semiejes: [1.1 * limiteNormativo('MasGxBase', 0.2), 1.1 * limiteNormativo('GyBase', 0.2), 1.1 * limiteNormativo(CurvaMasGz, 0.2)],
    },
    OnsetDeCarga: OnsetDeTransicionCritica(Gz, JerkGz),
    OnsetNormativoReal: Parametros.OnsetNormativoPorEje[2],
    OnsetPresupuestoModelo: Escala.OnsetMaximo,
    OnsetMaximoPorEje: [maximo(JerkGx.map(Math.abs)), maximo(JerkGy.map(Math.abs)), maximo(JerkGz.map(Math.abs))],
  };
}

function SemiejePorSigno(G: number[], CurvaPositiva: CurvaNormativa, CurvaNegativa: CurvaNormativa): number[] {
  const SemiejePositivo = 1.1 * Math.abs(limiteNormativo(CurvaPositiva, 0.2));
  const SemiejeNegativo = 1.1 * Math.abs(limiteNormativo(CurvaNegativa, 0.2));
  return G.map((g) => (g >= 0 ? SemiejePositivo : SemiejeNegativo));
}

function PeorEventoSostenido(G: number[], Tiempo: number[], Curva: CurvaNormativa, FactorTiempo: number, Signo: 1 | -1): EventoSostenido {
  const H = G.map((g) => Signo * g);
  const Evento: EventoSostenido = {
    Curva, Signo, NivelCritico: 0, DuracionReal: 0, LimiteAplicado: NaN, Exceso: -Infinity, DuracionMasLarga: 0, PicoG: Signo * maximo(H),
  };
  const HMaximo = maximo(H);
  if (!(HMaximo > 0) || H.length < 2) return Evento;

  const Niveles = linspace(HMaximo / 60, HMaximo, 60);
  for (const Nivel of Niveles) {
    for (const [inicio, fin] of tramosContiguos(H.map((h) => h >= Nivel))) {
      const DuracionReal = (Tiempo[fin]! - Tiempo[inicio]!) * FactorTiempo;
      if (DuracionReal > Evento.DuracionMasLarga) Evento.DuracionMasLarga = DuracionReal;
      if (DuracionReal < 0.2) continue;
      const LimiteMagnitud = Signo * limiteNormativo(Curva, DuracionReal);
      const Exceso = Nivel - LimiteMagnitud;
      if (Exceso > Evento.Exceso) {
        Evento.Exceso = Exceso;
        Evento.NivelCritico = Signo * Nivel;
        Evento.DuracionReal = DuracionReal;
        Evento.LimiteAplicado = Signo * LimiteMagnitud;
      }
    }
  }
  return Evento;
}

function OnsetDeTransicionCritica(Gz: number[], JerkGz: number[]): number {
  let Onset = 0;
  let Indice = 0;
  const NumeroDeNodos = Gz.length;
  while (Indice < NumeroDeNodos) {
    if (Gz[Indice]! <= 0) {
      let Fin = Indice;
      while (Fin < NumeroDeNodos - 1 && Gz[Fin]! < 2) {
        Fin++;
        if (Gz[Fin]! <= 0) {
          Indice = Fin; // volvio a caer: la transicion no llego a 2 G
          break;
        }
      }
      if (Fin > Indice && Gz[Fin]! >= 2) {
        Onset = Math.max(Onset, maximo(JerkGz.slice(Indice, Fin + 1)));
        Indice = Fin;
      }
    }
    Indice++;
  }
  return Onset;
}

