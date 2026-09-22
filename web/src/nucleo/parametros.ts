// Port de ParametrosPorDefecto.m, ParametrosDelModo.m, ParametrosDeAceptacion.m,
// ParametrosGenerales.m y AjustarParametros.m. Los valores y los textos son
// los de MATLAB, y el test los compara contra parametros.defaults y
// parametros.esquema de los golden files: si alguien cambia un default en
// MATLAB y no aca, el test lo caza.

import { deg2rad } from './matematica';
import type { Declaracion, ModoCurvatura, NombreDeElemento, NombreDeParametro, Parametros } from './tipos';

export const MODOS_DE_CURVATURA: ModoCurvatura[] = ['AceleracionNormalConstante', 'Clotoide', 'FuerzaGConstante', 'GNormativaMaxima'];

export function ParametrosPorDefecto(): Parametros {
  const Parametros: Omit<Parametros, 'SeparacionDePatas'> = {
    // 1. modo de curvatura
    ModoCurvatura: 'Clotoide',
    AceleracionNormalObjetivo: 20,
    FuerzaGObjetivo: 3.0,
    SemianchoDeSuavizadoNormativo: 0.05,
    // 2. geometria de cada elemento
    RadioDelLoop: 0.11,
    RollExtraDelLoop: 0,
    RadioDelDiveLoop: 0.45,
    SeparacionDelDiveLoop: 0,
    RadioDeLaHelice: 0.7,
    VueltasDeLaHelice: 1.0,
    AvanceDeLaHelice: -0.3,
    PeralteDeLaHelice: deg2rad(55),
    RadioDelGiro: 0.8,
    AnguloDelGiro: deg2rad(120),
    PeralteDelGiro: deg2rad(110),
    AvanceDelGiro: 0,
    SentidoDelGiro: 'Derecha',
    RadioDeReferencia: 0.21,
    InclinacionHelicoidalImpuesta: null,
    // 3. criterios de aceptacion
    GMinimaCuspide: 0.5,
    PuntoDeVerificacionNormativa: 'Heartline',
    OnsetNormativoPorEje: [5, 5, 15],
    OnsetMaximoModelo: null,
    TolObjetivoDeG: 0.05,
    TolCierrePitch: 1e-4,
    FactorDeSeguridadNormativo: 1.0,
    AlturaMaximaDelElemento: 1.0,
    RadioMinimoFabricable: 0.08,
    BoundingBoxDisponible: [
      [-2.0, 2.0],
      [-2.0, 2.0],
      [0.0, 1.5],
    ],
    AlturaMinimaSuelo: 0.05,
    ArcoMinimoAutointerferencia: 0.3,
    DistanciaMinimaEntreVias: 0.02,
    // 4. generales
    Gravedad: 9.81,
    RhoAire: 1.2,
    CrrPortantes: 0.03,
    CrrGuia: 0.035,
    CrrRetencion: 0.035,
    ModelarArrastre: true,
    CoefArrastre: 0.9,
    FactorTren: 0.25,
    NumeroDeCarros: 1,
    Masa: 0.15,
    LargoCarro: 0.1,
    AltoCarro: 0.06,
    AnchoVia: 0.06,
    Holgura: 0.01,
    DiametroRueda: 0.0136,
    AreaFrontal: 0.0036,
    DistanciaHeartline: 0.03,
    DistanciaHeartlineACabeza: 0.03,
    MetodoDeAcoplamiento: 'A',
    CalcularVelocidadMinima: false,
    RadioDeReferenciaReal: 8.0,
    LargoCarroReal: 2.2,
    PasoGeneracion: 0.002,
    PasoSimulacion: 0.005,
    PasosEntreOrtonormalizaciones: 25,
    VersoresEnGrafico3D: 40,
    PasoBusquedaVelocidad: 0.01,
    TolNorma: 1e-12,
    TolPuntoFijo: 1e-8,
    MaxIteracionesPuntoFijo: 60,
    MaxIteracionesCierre: 6,
    MaxIteracionesAjuste: 8,
    MargenDeOnset: 0.002,
    ToleranciaVelocidadDeDiseno: 0.1,
  };
  // Derivados de la envolvente: diametro del cilindro que circunscribe la
  // seccion de via mas la holgura.
  const DiametroEnvolvente = Math.hypot(Parametros.AnchoVia + 2 * Parametros.Holgura, Parametros.AltoCarro + 2 * Parametros.Holgura);
  return {
    ...Parametros,
    SeparacionDePatas: 1.2 * (DiametroEnvolvente + Parametros.DistanciaMinimaEntreVias),
  };
}

function ternas(...filas: [NombreDeParametro, string, string][]): Declaracion[] {
  return filas.map(([Nombre, Unidad, Descripcion]) => ({ Nombre, Unidad, Descripcion }));
}

/** ParametrosDelModo(Modo): que parametros consume cada modo, y la nota del modo normativo. */
export function ParametrosDelModo(Modo: ModoCurvatura): { Lista: Declaracion[]; Nota: string } {
  switch (Modo) {
    case 'AceleracionNormalConstante':
      return {
        Lista: ternas(['AceleracionNormalObjetivo', 'm/s^2', 'aceleracion centripeta del pasajero sobre U, sin la gravedad, constante en el arco']),
        Nota: '',
      };
    case 'Clotoide':
      return {
        Lista: ternas(['RadioDeReferencia', 'm', 'radio de la heartline en el arco (el riel va d*cos(psi) mas afuera); lo pisa cada elemento con su radio']),
        Nota: '',
      };
    case 'FuerzaGConstante':
      return { Lista: ternas(['FuerzaGObjetivo', 'G', 'Gz neta del pasajero, incluida la gravedad, constante en el arco']), Nota: '' };
    case 'GNormativaMaxima':
      return {
        Lista: ternas([
          'SemianchoDeSuavizadoNormativo',
          's',
          'semiancho (prototipo) con el que LimiteDeDiseno redondea por debajo los quiebres de la tabla; 0 = tabla literal',
        ]),
        Nota:
          'la curva de la norma que persigue es parte de la Receta del elemento (Receta.CurvaLimiteGz en los cuatro; CurvaLimiteGy y SentidoDeGy en el dive loop). La curva va dividida por FactorDeSeguridadNormativo, del bloque de criterios de aceptacion',
      };
    default:
      throw new Error(`Modo de curvatura no reconocido: ${String(Modo)}. Los modos son: ${MODOS_DE_CURVATURA.join(', ')}.`);
  }
}

export function ParametrosDeAceptacion(): Declaracion[] {
  return ternas(
    ['GMinimaCuspide', 'G', 'holgura minima de Gz en la cuspide; N = 0 no sirve como criterio'],
    ['PuntoDeVerificacionNormativa', '-', "donde se aplica la norma: 'Heartline' (brazo d) o 'Cabeza' (brazo d + e)"],
    ['OnsetNormativoPorEje', 'G/s', 'presupuesto de onset [Gx Gy Gz] en el prototipo; el del modelo es sqrt(lambda) veces mayor'],
    ['OnsetMaximoModelo', 'G/s', 'override directo del presupuesto del modelo; vacio = derivar de Froude'],
    ['TolObjetivoDeG', 'G', 'desvio admitido entre la G del pasajero y la que pidio el modo'],
    ['FactorDeSeguridadNormativo', '-', 'divide la curva de la norma que persigue GNormativaMaxima (objetivo de diseno); la verificacion sigue siendo contra la norma literal'],
    ['TolCierrePitch', 'rad', 'residual de cierre admitido en el giro objetivo'],
    ['AlturaMaximaDelElemento', 'm', 'altura maxima de la heartline sobre su entrada'],
    ['RadioMinimoFabricable', 'm', 'radio minimo del riel que admite la impresora'],
    ['AlturaMinimaSuelo', 'm', 'z minimo admisible del riel'],
    ['BoundingBoxDisponible', 'm', 'huella disponible, filas x, y, z'],
    ['DistanciaMinimaEntreVias', 'm', 'separacion libre exigida entre rieles'],
    ['ArcoMinimoAutointerferencia', 'm', 'vecinos por arco que la autointerferencia ignora'],
  );
}

export function ParametrosGenerales(): Declaracion[] {
  return ternas(
    ['Gravedad', 'm/s^2', 'aceleracion de la gravedad'],
    ['RhoAire', 'kg/m^3', 'densidad del aire'],
    ['CrrPortantes', '-', 'coeficiente de rodadura de las ruedas portantes (de carga)'],
    ['CrrGuia', '-', 'coeficiente de rodadura de las ruedas guia (laterales)'],
    ['CrrRetencion', '-', 'coeficiente de rodadura de las ruedas de retencion (up-stop)'],
    ['ModelarArrastre', '-', 'logico: si se computa el arrastre aerodinamico'],
    ['CoefArrastre', '-', 'coeficiente de arrastre aerodinamico del carro'],
    ['FactorTren', '-', 'fraccion del arrastre de flujo libre que aporta cada carro detras del primero'],
    ['NumeroDeCarros', '-', 'carros del tren'],
    ['Masa', 'kg', 'masa del carro con el pasajero'],
    ['LargoCarro', 'm', 'largo del carro del modelo'],
    ['AltoCarro', 'm', 'alto del carro del modelo'],
    ['AnchoVia', 'm', 'trocha (ancho de via) del modelo'],
    ['Holgura', 'm', 'margen sobre la envolvente del carro para el chequeo de interferencia'],
    ['DiametroRueda', 'm', 'diametro de rueda; piso impuesto por el rodamiento minimo'],
    ['AreaFrontal', 'm^2', 'area frontal proyectada de un carro'],
    ['DistanciaHeartline', 'm', 'del riel al centro de masa del pasajero (heartline), medida sobre U; define la via'],
    ['DistanciaHeartlineACabeza', 'm', 'de la heartline a la cabeza del pasajero, medida sobre U; solo informativa salvo verificacion en Cabeza'],
    ['MetodoDeAcoplamiento', '-', "acoplamiento geometria-dinamica: 'A' marcha acoplada, 'B' punto fijo, 'Ambos' compara"],
    ['CalcularVelocidadMinima', '-', 'logico: si se corre la biseccion de la velocidad inicial minima (cuesta decenas de generaciones)'],
    ['InclinacionHelicoidalImpuesta', '-', 'override de tan(alfa), la inclinacion de la tangente respecto del plano del giro; vacio = se resuelve por Newton'],
    ['RadioDeReferenciaReal', 'm', 'radio de la atraccion real que ancla lambda del loop'],
    ['LargoCarroReal', 'm', 'largo del carro real que ancla lambda del carro'],
    ['PasoGeneracion', 'm', 'paso de arco de la marcha RK4 que genera la geometria'],
    ['PasoSimulacion', 'm', 'paso de arco de SimularSobreTrack'],
    ['PasosEntreOrtonormalizaciones', '-', 'cada cuantos pasos se reortonormaliza el marco (Gram-Schmidt)'],
    ['VersoresEnGrafico3D', '-', 'flechas del marco del carro que se dibujan en la vista 3D'],
    ['PasoBusquedaVelocidad', 'm', 'paso de generacion grueso dentro de la biseccion de la velocidad minima'],
    ['TolNorma', 'm', 'norma por debajo de la cual un vector se considera nulo'],
    ['TolPuntoFijo', 'm/s', 'cambio maximo de velocidad entre iteraciones del punto fijo del metodo B'],
    ['MaxIteracionesPuntoFijo', '-', 'tope de iteraciones del punto fijo del metodo B'],
    ['MaxIteracionesCierre', '-', 'tope de iteraciones de la correccion de cierre del giro'],
    ['MaxIteracionesAjuste', '-', 'tope de iteraciones del ajuste de longitud de las transiciones'],
    ['MargenDeOnset', '-', 'margen relativo que se agrega sobre la longitud justa de las transiciones en cada iteracion'],
    ['ToleranciaVelocidadDeDiseno', 'm/s', 'diferencia de velocidad de entrada que dispara aviso al re-simular un track'],
  );
}

/** Lo que declara cada ElementoXxx() sin argumentos, por nombre de elemento (CatalogoDeElementos). */
export const DECLARACIONES_DE_ELEMENTOS: Record<NombreDeElemento, Declaracion[]> = {
  LoopVertical: ternas(
    [
      'RadioDelLoop',
      'm',
      'radio de la heartline en la cuspide: en Clotoide es el que se impone; en los modos dependientes de v es solo la longitud caracteristica de Froude y el radio real es una salida',
    ],
    ['RollExtraDelLoop', 'rad', 'roll adicional del carro respecto de la vertical (0 = loop vertical estandar)'],
    ['SeparacionDePatas', 'm', 'avance sobre el eje de la helice: separa la pata de salida de la de entrada'],
  ),
  DiveLoop: ternas(
    [
      'RadioDelDiveLoop',
      'm',
      'radio de la heartline en la cuspide: en Clotoide es el que se impone; en los modos dependientes de v es solo la longitud caracteristica de Froude y el radio real es una salida',
    ],
    ['SeparacionDelDiveLoop', 'm', 'avance sobre el eje de la helice (0: gira solo pi y no se cruza consigo mismo)'],
    ['SentidoDelGiro', '-', 'lado hacia el que se desalinea la curvatura para el Gy objetivo en modo GNormativaMaxima'],
  ),
  Helice: ternas(
    [
      'RadioDeLaHelice',
      'm',
      'radio de la heartline en el arco: en Clotoide es el que se impone; en los modos dependientes de v es solo la longitud caracteristica de Froude y el radio real es una salida',
    ],
    ['VueltasDeLaHelice', '-', 'vueltas del giro (puede no ser entero)'],
    ['AvanceDeLaHelice', 'm', 'cuanto sube (positivo) o baja (negativo) sobre el eje vertical'],
    ['PeralteDeLaHelice', 'rad', 'roll del carro respecto de la vertical en el arco'],
    ['SentidoDelGiro', '-', "'Derecha' o 'Izquierda'"],
  ),
  OverBankedTurn: ternas(
    [
      'RadioDelGiro',
      'm',
      'radio de la heartline en el arco: en Clotoide es el que se impone; en los modos dependientes de v es solo la longitud caracteristica de Froude y el radio real es una salida',
    ],
    ['AnguloDelGiro', 'rad', 'cambio de rumbo'],
    ['PeralteDelGiro', 'rad', 'roll del carro respecto de la vertical en el arco (mas de pi/2 = over-banked)'],
    ['AvanceDelGiro', 'm', 'cuanto sube o baja sobre el eje vertical (0 = giro a nivel)'],
    ['SentidoDelGiro', '-', "'Derecha' o 'Izquierda'"],
  ),
};

/** Orden de CatalogoDeElementos.m. */
export const CATALOGO_DE_ELEMENTOS: NombreDeElemento[] = ['LoopVertical', 'DiveLoop', 'Helice', 'OverBankedTurn'];

/**
 * Enumeraciones que la declaracion (unidad '-') no distingue de un texto
 * libre: las validan la serializacion y el formulario. ModoCurvatura es
 * MODOS_DE_CURVATURA.
 */
export const OPCIONES_DE_PARAMETRO: Partial<Record<NombreDeParametro, readonly string[]>> = {
  ModoCurvatura: MODOS_DE_CURVATURA,
  SentidoDelGiro: ['Derecha', 'Izquierda'],
  PuntoDeVerificacionNormativa: ['Heartline', 'Cabeza'],
  MetodoDeAcoplamiento: ['A', 'B', 'Ambos'],
};

/** Los que en MATLAB admiten [] (vacio = derivar): aca valen null, y el contrato los escribe como []. */
export const PARAMETROS_ANULABLES: readonly NombreDeParametro[] = ['OnsetMaximoModelo', 'InclinacionHelicoidalImpuesta'];

/**
 * AjustarParametros.m: sobrescribe y devuelve los nombres inertes (los que
 * ni el modo ni el elemento elegidos consumen) para avisar. Un campo que no
 * existe es un error.
 *
 * SeparacionDePatas es un caso a tener presente: ParametrosPorDefecto() lo
 * deriva de la envolvente del carro, pero ElementoLoopVertical lo declara
 * como parametro propio. Aca no recibe trato especial y eso es lo correcto:
 * si viene en Ajustes gana el ajuste (se sobrescribe como cualquier campo);
 * si no viene, queda el derivado que traen los Parametros de entrada.
 */
export function AjustarParametros(
  Parametros: Parametros,
  Ajustes: Partial<Parametros>,
  Elegido: NombreDeElemento,
): { Parametros: Parametros; Inertes: NombreDeParametro[] } {
  const salida = { ...Parametros };
  for (const clave of Object.keys(Ajustes) as NombreDeParametro[]) {
    if (!(clave in Parametros)) {
      throw new Error(`Parametros.${clave} no existe en ParametrosPorDefecto: revisar el nombre.`);
    }
    (salida as unknown as Record<string, unknown>)[clave] = Ajustes[clave];
  }
  const deTodosLosModos = MODOS_DE_CURVATURA.flatMap((m) => ParametrosDelModo(m).Lista.map((d) => d.Nombre));
  const deTodosLosElementos = CATALOGO_DE_ELEMENTOS.flatMap((e) => DECLARACIONES_DE_ELEMENTOS[e].map((d) => d.Nombre));
  const consumidos = new Set<NombreDeParametro>([
    ...ParametrosDelModo(salida.ModoCurvatura).Lista.map((d) => d.Nombre),
    ...DECLARACIONES_DE_ELEMENTOS[Elegido].map((d) => d.Nombre),
  ]);
  const inertes = (Object.keys(Ajustes) as NombreDeParametro[]).filter(
    (clave) => [...deTodosLosModos, ...deTodosLosElementos].includes(clave) && !consumidos.has(clave),
  );
  return { Parametros: salida, Inertes: inertes };
}
