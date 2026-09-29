// Port de Verificacion/: AgregarCriterio, ChequeosPrevios, ChequeosPosteriores,
// VerificarLimitesNormativos, CriteriosNormativos, SerieNormativaDelLayout,
// VerificarLayoutNormativo y DistanciaMinimaEntrePolilineas. Los textos de
// los criterios son los de MATLAB, con los mismos formatos de sprintf.

import { BrazoDeVerificacion, EscalasDeFroude, MarcoTransporteDesdeCarro } from './basicos';
import {
  cruz, linspace, maximo, maximoConIndice, minimo, modulo, norma, normaDe, punto as productoPunto, rad2deg, resta, sprintfF, type Vec3,
} from './matematica';
import { algunoEntre, G_MIN_EVALUABLE, limiteNormativo, limitesDelEvento, tramosContiguos, ventanasMasGzReducido, type CurvaNormativa } from './norma';
import type {
  ContextoNormativo, Criterio, Escala, Estado, EventoSostenido, Layout, Normativo, Parametros, Receta, Reversion, SentidoDeCriterio, Sim, Track,
} from './tipos';

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

  // Para el elemento suelto. Si el elemento entra a un layout,
  // VerificarLayoutNormativo recalcula este bloque sobre la linea de tiempo
  // continua del circuito y reemplaza estas mismas lineas.
  Criterios.push(...CriteriosNormativos(Normativo));

  AgregarCriterio(Criterios, 'Gz maxima en la cabeza', 'Informativo', maximo(validos(Sim.GzCabeza)), NaN, 'G',
    `A ${sprintfF(Parametros.DistanciaHeartline + Parametros.DistanciaHeartlineACabeza, 3)} m del riel (d + e). Las verificadas arriba estan a ${sprintfF(Sim.BrazoDeVerificacion, 3)} m.`);
  AgregarCriterio(Criterios, '|Gy| maxima en la cabeza', 'Informativo', maximo(validos(Sim.GyCabeza).map(Math.abs)), NaN, 'G', '');

  return [Criterios, Normativo];
}

/**
 * Lineas del reporte que resumen el bloque normativo: limites dependientes de
 * la duracion (Figs. 6-10), reversiones (7.1.6) y elipses (7.1.5.1), en ese
 * orden. Port de CriteriosNormativos.m.
 */
export function CriteriosNormativos(Normativo: Normativo): Criterio[] {
  const Criterios: Criterio[] = [];
  AgregarCriterioNormativo(Criterios, '+Gz (Fig. 10)', Normativo.MasGz);
  AgregarCriterioNormativo(Criterios, '-Gz (Fig. 9)', Normativo.MenosGz);
  AgregarCriterioNormativo(Criterios, 'Gy (Fig. 8)', Normativo.Gy);
  AgregarCriterioNormativo(Criterios, '+Gx (Fig. 6)', Normativo.MasGx);
  AgregarCriterioNormativo(Criterios, '-Gx (Fig. 7)', Normativo.MenosGx);

  AgregarCriterioDeReversion(Criterios, 'Reversiones de Gx (7.1.6)', Normativo.ReversionGx);
  AgregarCriterioDeReversion(Criterios, 'Reversiones de Gy (7.1.6)', Normativo.ReversionGy);

  AgregarCriterio(Criterios, 'Elipse de dos ejes Gy-Gz (7.1.5.1)', 'MenorOIgual', Normativo.Elipse.ValorMaximoGyGz, 1, '-',
    'Semiejes iguales a los limites de 200 ms multiplicados por 1.1.');
  AgregarCriterio(Criterios, 'Elipse de dos ejes Gx-Gz (7.1.5.1)', 'MenorOIgual', Normativo.Elipse.ValorMaximoGxGz, 1, '-');
  AgregarCriterio(Criterios, 'Elipse de dos ejes Gx-Gy (7.1.5.1)', 'MenorOIgual', Normativo.Elipse.ValorMaximoGxGy, 1, '-');
  return Criterios;
}

function AgregarCriterioNormativo(Criterios: Criterio[], Nombre: string, Evento: EventoSostenido): void {
  if (!Number.isFinite(Evento.Exceso)) {
    AgregarCriterio(Criterios, Nombre, 'Informativo', Evento.PicoG, NaN, 'G',
      `Sin G evaluable de ese signo (el maximo no llega a ${sprintfF(G_MIN_EVALUABLE, 2)} G): no hay evento que evaluar.`);
    return;
  }
  AgregarCriterio(Criterios, Nombre, 'MenorOIgual', Evento.Exceso, 0, 'G',
    `Nivel critico ${sprintfF(Evento.NivelCritico, 2)} G sostenido ${sprintfF(Evento.DuracionReal, 2)} s equivalentes reales; limite ${sprintfF(Evento.LimiteAplicado, 2)} G. ` +
      'Los eventos de menos de 0.2 s se evaluan contra el limite de 200 ms.');
}

function AgregarCriterioDeReversion(Criterios: Criterio[], Nombre: string, Reversion: Reversion): void {
  if (Reversion.Reducida) {
    AgregarCriterio(Criterios, Nombre, 'MenorOIgual', Reversion.Exceso, 0, 'G',
      `Reversion entre eventos sostenidos con ${sprintfF(Reversion.TiempoPicoAPico, 3)} s entre picos (menos de 0.2 s): el limite ` +
        `del pico cae al 50 %. Pico ${sprintfF(Reversion.PicoG, 2)} G sostenido ${sprintfF(Reversion.DuracionReal, 2)} s reales; limite reducido ${sprintfF(Reversion.LimiteReducido, 2)} G.`);
    return;
  }
  const Detalle = Number.isFinite(Reversion.TiempoPicoAPicoMinimo)
    ? 'Ninguna reversion entre eventos sostenidos tiene menos de 0.2 s entre picos: sin reduccion del limite. El valor es la mas rapida, en s reales.'
    : 'Sin reversiones entre eventos sostenidos de signo opuesto.';
  AgregarCriterio(Criterios, Nombre, 'Informativo', Reversion.TiempoPicoAPicoMinimo, 0.2, 's', Detalle);
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
/**
 * Linea de tiempo continua del layout para la norma. Port de
 * SerieNormativaDelLayout.m: las G de todos los elementos concatenadas, con
 * el tiempo en PROTOTIPO (cada tramo escalado con el factorTiempo de SU
 * elemento y acumulado), sin repetir el nodo de cada empalme. `Rango` de
 * cada elemento incluye su nodo de empalme de entrada.
 */
export function SerieNormativaDelLayout(Sims: Sim[], FactoresTiempo: number[]): Omit<ContextoNormativo, 'Elemento'> {
  const TiempoPrototipo: number[] = [];
  const Gx: number[] = [];
  const Gy: number[] = [];
  const Gz: number[] = [];
  const Rango: Array<[number, number]> = [];
  let Desfase = 0;
  Sims.forEach((Sim, i) => {
    const Desde = i === 0 ? 0 : 1;
    const Primero = i === 0 ? 0 : TiempoPrototipo.length - 1; // el nodo del empalme
    for (let k = Desde; k < Sim.Tiempo.length; k++) {
      TiempoPrototipo.push(Sim.Tiempo[k]! * FactoresTiempo[i]! + Desfase);
      Gx.push(Sim.Gx[k]!);
      Gy.push(Sim.Gy[k]!);
      Gz.push(Sim.Gz[k]!);
    }
    Rango.push([Primero, TiempoPrototipo.length - 1]);
    // Si el carro se quedo sin energia el tiempo del final es NaN: el desfase sale del ultimo nodo con tiempo.
    let Ultimo = Sim.Tiempo.length - 1;
    while (Ultimo > 0 && Number.isNaN(Sim.Tiempo[Ultimo]!)) Ultimo--;
    Desfase += Sim.Tiempo[Ultimo]! * FactoresTiempo[i]!;
  });
  const { reducida, enAirtimeLargo } = ventanasMasGzReducido(Gz, TiempoPrototipo);
  return {
    TiempoPrototipo: Float64Array.from(TiempoPrototipo),
    Gx: Float64Array.from(Gx),
    Gy: Float64Array.from(Gy),
    Gz: Float64Array.from(Gz),
    Rango,
    Reducida: reducida,
    EnAirtimeLargo: enAirtimeLargo,
  };
}

/**
 * Recalcula el bloque normativo de cada elemento sobre la linea de tiempo
 * continua del layout y reemplaza las lineas de CriteriosNormativos en sus
 * posteriores. Port de VerificarLayoutNormativo.m. Se corre entera cada vez
 * que el layout cambia: un elemento nuevo puede alargar un evento del
 * anterior y cambiar su veredicto. Devuelve un layout nuevo (no muta los
 * reportes anteriores).
 */
export function VerificarLayoutNormativo(Layout: Layout): Layout {
  if (Layout.Elementos.length === 0) return Layout;
  const Escalas = Layout.Elementos.map((r) => EscalasDeFroude(r.Elemento.Parametros));
  const Serie = SerieNormativaDelLayout(
    Layout.Elementos.map((r) => r.Elemento.Sim),
    Escalas.map((e) => e.RaizLambdaLoop),
  );
  const Elementos = Layout.Elementos.map((Registro, i) => {
    if (!Registro.Reporte) return Registro;
    const Normativo = VerificarLimitesNormativos(Registro.Elemento.Sim, Escalas[i]!, Registro.Elemento.Parametros, { ...Serie, Elemento: i });
    const Nuevos = CriteriosNormativos(Normativo);
    const Posteriores = [...Registro.Reporte.Posteriores];
    const Desde = Posteriores.findIndex((c) => c.Nombre === Nuevos[0]!.Nombre);
    const Coinciden = Desde >= 0 && Nuevos.every((c, k) => Posteriores[Desde + k]?.Nombre === c.Nombre);
    if (!Coinciden) {
      throw new Error(`El reporte del elemento ${i + 1} (${Registro.Elemento.Nombre}) no trae las lineas normativas de CriteriosNormativos en el orden esperado.`);
    }
    Posteriores.splice(Desde, Nuevos.length, ...Nuevos);
    return { ...Registro, Reporte: { ...Registro.Reporte, Posteriores, Normativo } };
  });
  return { ...Layout, Elementos };
}

/**
 * Port de VerificarLimitesNormativos.m. Sin `Contexto` (un elemento suelto)
 * la serie es la del propio elemento; con el, la del layout entero, y el
 * elemento evalua los eventos que tocan alguno de sus nodos con la duracion
 * completa. Los eventos de menos de 0.2 s se evaluan contra el limite de
 * 200 ms (criterio conservador del proyecto) y por debajo de G_MIN_EVALUABLE
 * no se evalua.
 */
export function VerificarLimitesNormativos(Sim: Sim, Escala: Escala, Parametros: Parametros, Contexto?: ContextoNormativo): Normativo {
  const C: ContextoNormativo = Contexto ?? { ...SerieNormativaDelLayout([Sim], [Escala.RaizLambdaLoop]), Elemento: 0 };

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

  const Rango = C.Rango[C.Elemento]!;
  const TiempoLayout = C.TiempoPrototipo;

  // 7.1.7.1, literal sobre la linea de tiempo del layout (ventanasMasGzReducido).
  const HuboAirtimeSostenido = algunoEntre(C.EnAirtimeLargo, Rango[0], Rango[1]);
  const CurvaMasGz: CurvaNormativa = algunoEntre(C.Reducida, Rango[0], Rango[1]) ? 'MasGzReducido' : 'MasGzTodas';

  const MasGz = PeorEventoSostenido(C.Gz, TiempoLayout, Rango, 'MasGzTodas', 1, C.Reducida);
  const MenosGz = PeorEventoSostenido(C.Gz, TiempoLayout, Rango, 'MenosGzBase', -1, null);
  const GyEvento = PeorEventoSostenido(C.Gy.map(Math.abs), TiempoLayout, Rango, 'GyBase', 1, null);
  const MasGx = PeorEventoSostenido(C.Gx, TiempoLayout, Rango, 'MasGxBase', 1, null);
  const MenosGx = PeorEventoSostenido(C.Gx, TiempoLayout, Rango, 'MenosGxBase', -1, null);

  const ReversionGx = ReversionesSostenidas(C.Gx, TiempoLayout, Rango, 'MasGxBase', 'MenosGxBase');
  const ReversionGy = ReversionesSostenidas(C.Gy, TiempoLayout, Rango, 'GyBase', 'GyBase');

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
    ReversionGx,
    ReversionGy,
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

/**
 * Peor evento sostenido contra la curva. G y Tiempo son la linea de tiempo
 * del layout (tiempo ya en PROTOTIPO); Rango, los nodos del elemento. Los
 * niveles salen del maximo del elemento y se evaluan los eventos que tocan
 * alguno de sus nodos. `Reducida` (solo +Gz): ventanas de 7.1.7.1, con la
 * curva reducida adentro y la normal despues, sin resetear la duracion.
 */
export function PeorEventoSostenido(
  G: ArrayLike<number>, Tiempo: ArrayLike<number>, Rango: [number, number], Curva: CurvaNormativa, Signo: 1 | -1, Reducida: ArrayLike<boolean> | null,
): EventoSostenido {
  const H = Array.from(G, (g) => Signo * g);
  const HElemento = H.slice(Rango[0], Rango[1] + 1);
  const Evento: EventoSostenido = {
    Curva, Signo, NivelCritico: 0, DuracionReal: 0, LimiteAplicado: NaN, Exceso: -Infinity, DuracionMasLarga: 0, PicoG: Signo * maximo(HElemento),
  };
  const HMaximo = maximo(HElemento);
  if (!(HMaximo >= G_MIN_EVALUABLE) || HElemento.length < 2) return Evento; // nada evaluable de este signo

  const Niveles = linspace(Math.max(G_MIN_EVALUABLE, HMaximo / 60), HMaximo, 60);
  for (const Nivel of Niveles) {
    for (const [inicio, fin] of tramosContiguos(H.map((h) => h >= Nivel))) {
      if (fin < Rango[0] || inicio > Rango[1]) continue;
      const DuracionReal = Tiempo[fin]! - Tiempo[inicio]!;
      if (DuracionReal > Evento.DuracionMasLarga) Evento.DuracionMasLarga = DuracionReal;
      // 7.1.4.2 no cubre los eventos de menos de 200 ms; el proyecto los evalua contra el limite de 200 ms.
      // Con ventanas de 7.1.7.1, un limite por tramo de regimen sin resetear la duracion (limitesDelEvento).
      for (const Tramo of limitesDelEvento(Tiempo, inicio, fin, Curva, Reducida)) {
        const Exceso = Nivel - Tramo.limite;
        if (Exceso > Evento.Exceso) {
          Evento.Exceso = Exceso;
          Evento.NivelCritico = Signo * Nivel;
          Evento.DuracionReal = Tramo.duracion;
          Evento.LimiteAplicado = Signo * Tramo.limite;
          Evento.Curva = Tramo.curva;
        }
      }
    }
  }
  return Evento;
}

/**
 * 7.1.6: reversiones entre eventos sostenidos en X o Y. Port de
 * ReversionesSostenidas (VerificarLimitesNormativos.m). Un evento es un
 * intervalo de un mismo signo con |G| >= G_MIN_EVALUABLE, sostenido si dura
 * 0.2 s o mas; si dos sostenidos consecutivos de signo opuesto tienen menos
 * de 0.2 s entre picos, el limite del pico de cada uno cae al 50 % del que le
 * corresponde por su duracion.
 * TODO(7.1.6): dos sostenidos consecutivos del mismo signo no se unen ni se
 * evaluan (la norma no dice si son uno solo).
 */
export function ReversionesSostenidas(
  G: ArrayLike<number>, Tiempo: ArrayLike<number>, Rango: [number, number], CurvaPositiva: CurvaNormativa, CurvaNegativa: CurvaNormativa,
): Reversion {
  const Reversion: Reversion = {
    TiempoPicoAPicoMinimo: Infinity, Reducida: false, TiempoPicoAPico: NaN, PicoG: NaN, DuracionReal: NaN, LimiteReducido: NaN, Exceso: -Infinity,
  };
  const Valores = Array.from(G);
  const Eventos: Array<[number, number, 1 | -1]> = [
    ...tramosContiguos(Valores.map((g) => g >= G_MIN_EVALUABLE)).map(([a, b]): [number, number, 1 | -1] => [a, b, 1]),
    ...tramosContiguos(Valores.map((g) => g <= -G_MIN_EVALUABLE)).map(([a, b]): [number, number, 1 | -1] => [a, b, -1]),
  ];
  if (Eventos.length === 0) return Reversion;
  Eventos.sort((p, q) => p[0] - q[0]);
  const Sostenidos = Eventos.filter(([a, b]) => Tiempo[b]! - Tiempo[a]! >= 0.2);

  for (let k = 0; k < Sostenidos.length - 1; k++) {
    const Par = [Sostenidos[k]!, Sostenidos[k + 1]!];
    if (Par[0]![2] === Par[1]![2]) continue; // mismo signo: no es una reversion (ver el TODO)
    const Toca = Par.map(([a, b]) => b >= Rango[0] && a <= Rango[1]);
    if (!Toca.some(Boolean)) continue;
    const Picos = Par.map(([a, b]) => {
      const [, Posicion] = maximoConIndice(Valores.slice(a, b + 1).map(Math.abs));
      return { valor: Valores[a + Posicion]!, tiempo: Tiempo[a + Posicion]! };
    });
    const Separacion = Math.abs(Picos[1]!.tiempo - Picos[0]!.tiempo);
    Reversion.TiempoPicoAPicoMinimo = Math.min(Reversion.TiempoPicoAPicoMinimo, Separacion);
    if (Separacion >= 0.2) continue;
    Reversion.Reducida = true;
    for (let j = 0; j < 2; j++) {
      if (!Toca[j]) continue;
      const [a, b, signo] = Par[j]!;
      const Curva = signo > 0 ? CurvaPositiva : CurvaNegativa;
      const Duracion = Tiempo[b]! - Tiempo[a]!;
      const LimiteReducido = 0.5 * Math.abs(limiteNormativo(Curva, Duracion));
      const Exceso = Math.abs(Picos[j]!.valor) - LimiteReducido;
      if (Exceso > Reversion.Exceso) {
        Reversion.Exceso = Exceso;
        Reversion.PicoG = Picos[j]!.valor;
        Reversion.DuracionReal = Duracion;
        Reversion.LimiteReducido = signo * LimiteReducido;
        Reversion.TiempoPicoAPico = Separacion;
      }
    }
  }
  return Reversion;
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

