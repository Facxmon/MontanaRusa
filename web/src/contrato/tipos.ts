/* eslint-disable */
// GENERADO por scripts/generar-tipos.mjs desde esquema/layout-v1.schema.json.
// No editar a mano: correr `npm run tipos`.

/**
 * @minItems 3
 * @maxItems 3
 */
export type Vector3 = [number, number, number];
/**
 * Número finito, o null si el valor original era NaN o Infinity.
 */
export type Numero = number | null;
export type ArrayDeNumeros = Numero[];
export type ArrayDeVectores3 = Vector3[];

/**
 * Contrato de datos entre el generador de geometría (MATLAB hoy, JS mañana) y el visualizador web. Ver CONTRATO_VISUALIZADOR.md para el razonamiento de cada decisión. Unidades: SI y radianes, siempre. Todo valor no finito se serializa como null.
 */
export interface Layout {
  meta: Meta;
  parametros: Parametros;
  estadoInicial: Estado;
  /**
   * @minItems 1
   */
  elementos: [Elemento, ...Elemento[]];
  resumenLayout: ResumenLayout;
}
export interface Meta {
  /**
   * Semver. El consumidor rechaza un MAJOR distinto del que conoce.
   */
  versionContrato: string;
  generadoPor: 'matlab' | 'js';
  /**
   * Hash de commit del repo que produjo el archivo
   */
  versionGenerador?: string;
  generadoEn?: string;
  /**
   * Hace el archivo autodescriptivo sin consultar la documentación.
   */
  unidades: {
    [k: string]: string;
  };
}
export interface Parametros {
  /**
   * ParametrosPorDefecto() con los overrides de esta corrida, aplanado y en camelCase.
   */
  valores: {
    modoCurvatura: 'AceleracionNormalConstante' | 'Clotoide' | 'FuerzaGConstante' | 'GNormativaMaxima';
    metodoDeAcoplamiento: 'A' | 'B' | 'Ambos';
    [k: string]: unknown;
  };
  /**
   * Metadatos de los parámetros, extraídos de las declaraciones del propio MATLAB. Nunca se escribe a mano.
   */
  esquema: {
    modo: {
      nombre: string;
      opciones: string[];
      nota?: string;
      parametros: DeclaracionDeParametro[];
    };
    /**
     * Una entrada por constructor de CatalogoDeElementos(), llamado sin argumentos.
     */
    elementos: {
      [k: string]: DeclaracionDeParametro[];
    };
    aceptacion: DeclaracionDeParametro[];
    generales: DeclaracionDeParametro[];
  };
  /**
   * ParametrosPorDefecto() sin overrides. Alimenta el botón de resetear.
   */
  defaults: {
    [k: string]: unknown;
  };
}
/**
 * Terna autodescriptiva que produce DeclaracionDeParametros / ParametrosDelModo / ParametrosDeAceptacion. Es lo que permite que el panel de parámetros del frontend se genere solo.
 */
export interface DeclaracionDeParametro {
  /**
   * Nombre del campo dentro de parametros.valores
   */
  clave: string;
  /**
   * Unidad SI, o '-' si es adimensional o una cadena
   */
  unidad: string;
  descripcion: string;
}
/**
 * Contrato de Estado de EstadoInicial.m. La posición viaja sobre el RIEL; la velocidad es la del centro de masa sobre la heartline.
 */
export interface Estado {
  posicion: Vector3;
  versorTangente: Vector3;
  versorArribaCarro: Vector3;
  versorLateral?: Vector3;
  vectorCurvatura?: Vector3;
  derivadaCurvatura?: Numero;
  anguloRoll?: Numero;
  velocidadRoll?: Numero;
  aceleracionRoll?: Numero;
  longitudAcumulada?: Numero;
  velocidad: number;
  energiaTotal?: Numero;
}
export interface Elemento {
  indice: number;
  /**
   * Receta.Nombre del elemento.
   */
  tipo: 'LoopVertical' | 'Helice' | 'OverBankedTurn' | 'DiveLoop';
  /**
   * Solo los parámetros geométricos que este elemento efectivamente consumió.
   */
  parametrosUsados: {
    [k: string]: unknown;
  };
  nodos: Nodos;
  subtramos: Subtramo[];
  resumen: ResumenElemento;
  criterios: Criterios;
  estadoSalida: Estado;
}
/**
 * Arrays columnares. TODOS los arrays de este objeto tienen exactamente numeroDeNodos elementos — el consumidor puede asumirlo sin verificar. Formato columnar y no array de objetos porque se mapea directo a Float32Array / BufferAttribute.
 */
export interface Nodos {
  numeroDeNodos: number;
  arco: ArrayDeNumeros;
  tiempo: ArrayDeNumeros;
  x: ArrayDeNumeros;
  y: ArrayDeNumeros;
  z: ArrayDeNumeros;
  xRiel: ArrayDeNumeros;
  yRiel: ArrayDeNumeros;
  zRiel: ArrayDeNumeros;
  versorTangente: ArrayDeVectores3;
  versorArribaCarro: ArrayDeVectores3;
  versorLateral: ArrayDeVectores3;
  velocidad: ArrayDeNumeros;
  velocidadRiel?: ArrayDeNumeros;
  aceleracionTangencial?: ArrayDeNumeros;
  gx: ArrayDeNumeros;
  gy: ArrayDeNumeros;
  gz: ArrayDeNumeros;
  jerkGx?: ArrayDeNumeros;
  jerkGy?: ArrayDeNumeros;
  jerkGz?: ArrayDeNumeros;
  gyCabeza?: ArrayDeNumeros;
  gzCabeza?: ArrayDeNumeros;
  curvatura: ArrayDeNumeros;
  curvaturaRiel: ArrayDeNumeros;
  anguloRoll: ArrayDeNumeros;
  anguloPeralte: ArrayDeNumeros;
  fuerzaNormal?: ArrayDeNumeros;
  energiaTotal?: ArrayDeNumeros;
  /**
   * Índice base 0 donde el carro se quedó sin energía, o null si completó el elemento.
   */
  puntoDeParada?: number | null;
}
/**
 * Tramo con nombre dentro del elemento. Índices BASE 0 (el exportador MATLAB resta 1).
 */
export interface Subtramo {
  nombre: string;
  indiceInicio: number;
  indiceFin: number;
}
/**
 * Volcado plano de Reporte.Resumen en camelCase. Alimenta el panel numérico lateral.
 */
export interface ResumenElemento {
  metodo?: string;
  longitudRecorrida: Numero;
  longitudDeMaterial?: Numero;
  alturaMaxima?: Numero;
  radioMinimo: Numero;
  radioMinimoRiel?: Numero;
  fuerzaNormalMaxima?: Numero;
  velocidadMinima?: Numero;
  tiempoDeRecorrido?: Numero;
  energiaDisipadaRodadura?: Numero;
  energiaDisipadaArrastre?: Numero;
  gzMaxima: Numero;
  gzMinima?: Numero;
  gyMaximaAbsoluta: Numero;
  gzMaximaCabeza?: Numero;
  gyMaximaAbsolutaCabeza?: Numero;
  brazoDeVerificacion?: Numero;
  peralteFinal?: Numero;
  peralteMaximo?: Numero;
  residualCierrePitch?: Numero;
  residualCierreTangente?: Numero;
  posicionFinal?: Vector3;
  desplazamientoLateral?: Numero;
  desplazamientoLateralObjetivo?: Numero;
  inclinacionHelicoidal?: Numero;
  saltoDeTangente?: Numero;
  saltoDeCurvatura?: Numero;
  saltoDePosicion?: Numero;
  lambdaLoop?: Numero;
  lambdaCarro?: Numero;
  distorsion?: Numero;
  carrosEquivalentes?: Numero;
  onsetMaximoModelo?: Vector3;
  velocidadInicialMinima?: Numero;
  [k: string]: unknown;
}
export interface Criterios {
  previos: Criterio[];
  posteriores: Criterio[];
  /**
   * PENDIENTE: abrir la estructura de Reporte.Normativo (ChequeosPosteriores.m) y detallarla campo por campo.
   */
  normativo?: {
    [k: string]: unknown;
  } | null;
  todosPasan: boolean;
}
/**
 * Espejo exacto de lo que produce AgregarCriterio.m. margen negativo se lee directo como cuánto falta.
 */
export interface Criterio {
  nombre: string;
  sentido: 'MenorOIgual' | 'MayorOIgual' | 'Informativo';
  /**
   * Sin tolerancia en los golden files: un veredicto que cambia es un bug.
   */
  pasa: boolean;
  valor: Numero;
  limite: Numero;
  margen: Numero;
  unidad: string;
  /**
   * Tooltip que explica qué hacer si falla.
   */
  detalle?: string;
}
export interface ResumenLayout {
  numeroDeElementos: number;
  longitudTotal: Numero;
  tiempoTotal?: Numero;
  velocidadFinal?: Numero;
  gzMaximaGlobal?: Numero;
  gzMinimaGlobal?: Numero;
  gyMaximaAbsolutaGlobal?: Numero;
  alturaMaxima?: Numero;
  alturaMinima?: Numero;
  /**
   * [[xmin,xmax],[ymin,ymax],[zmin,zmax]] — le ahorra al frontend recorrer todos los nodos para encuadrar la cámara.
   *
   * @minItems 3
   * @maxItems 3
   */
  boundingBox: [[number, number], [number, number], [number, number]];
  todosLosCriteriosPasan: boolean;
}
