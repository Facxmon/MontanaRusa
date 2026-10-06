// Como se MUESTRA cada parametro del nucleo: nombre humano, ayuda, unidad de
// presentacion, rango sugerido, en que seccion del formulario va y cuando
// se muestra (auditoria de categorias, A6 del diagnostico). Nada de esto
// toca el contrato ni el nucleo: el JSON sigue en SI y radianes (regla dura
// de CONTRATO_VISUALIZADOR.md), y la conversion es de presentacion, igual
// que el rad -> grados que ya existia en formato.ts.
//
// La `ayuda` NO se escribe aca: sale de las descripciones que ya declara el
// nucleo (ParametrosDelModo, ParametrosDeAceptacion, ParametrosGenerales y
// DECLARACIONES_DE_ELEMENTOS, todas en nucleo/parametros.ts), que son las
// mismas que viajan en parametros.esquema del contrato. Aca solo se agrega
// el nombre humano. La unica excepcion es ModoCurvatura, que el exportador
// deja fuera de las cuatro listas a proposito y por lo tanto no tiene
// descripcion que reusar.
//
// INVARIANTE (ver "Fase 3" en DISENO.md): este diccionario es una lista
// escrita en la web, y por lo tanto puede desincronizarse del nucleo. Lo
// reemplaza test/etiquetas.test.ts, que recorre ParametrosPorDefecto() y
// falla si falta una entrada: la desincronizacion es un test rojo y no un
// bug silencioso.
//
// LA UNIDAD SE DECLARA PARAMETRO POR PARAMETRO, NO POR TIPO DE DIMENSION.
// RadioDeReferenciaReal (8 m) y LargoCarroReal (2,2 m) son longitudes como
// RadioDeLaHelice (0,7 m), pero son del PROTOTIPO y no del modelo: pasarlos
// a centimetros borraria de la pantalla la diferencia de escala que ancla
// lambda de Froude. Por eso se quedan en metros y por eso la unidad no se
// puede derivar de la unidad SI del nucleo. No "corregir" esto.

import {
  CATALOGO_DE_ELEMENTOS,
  DECLARACIONES_DE_ELEMENTOS,
  MODOS_DE_CURVATURA,
  ParametrosDeAceptacion,
  ParametrosDelModo,
  ParametrosGenerales,
} from '../nucleo/parametros';
import type { ModoCurvatura, NombreDeElemento, NombreDeParametro, Parametros } from '../nucleo/tipos';

/**
 * Unidad con la que se muestra y se edita un parametro.
 *  - `factor`: cuanto vale una unidad SI en esta unidad (valor mostrado = valor SI * factor).
 *  - `decimales`: decimales fijos del input y del popover (fase 0: nunca cifras significativas).
 *  - `paso`: el `step` del input, para que las flechas del teclado sirvan.
 */
export interface UnidadDePresentacion {
  simbolo: string;
  factor: number;
  decimales: number;
  paso: number;
}

export interface Etiqueta {
  /** Nombre humano, en castellano: lo que se lee en el formulario. */
  nombre: string;
  /** Que es y que modifica; sale de la declaracion del nucleo. */
  ayuda: string;
  /** Ausente en los que no son numericos (opciones, logicos). */
  unidadDePresentacion?: UnidadDePresentacion;
  /** En UNIDADES DE PRESENTACION, no en SI: es contra lo que se compara lo que se tipea. */
  rangoSugerido?: [number, number];
  /**
   * Seccion del formulario global (auditoria de categorias, A6). Los del
   * modo y los de la geometria de cada elemento no llevan: van en la
   * seccion del modo y en la ficha. 'ficha' es un global que se edita en la
   * ficha de la instancia; 'oculto' no se muestra en la web.
   */
  seccion?: Seccion;
}

/** Secciones del formulario global, en el orden en que se dibujan dentro de su grupo. */
export type Seccion = 'norma' | 'fabricacion' | 'carro' | 'resistencia' | 'escala' | 'resolucion' | 'numerico' | 'ficha' | 'oculto';

/** Grupos plegables del formulario global y sus secciones. */
export const GRUPOS_GLOBALES: { titulo: string; secciones: { clave: Seccion; titulo: string }[] }[] = [
  { titulo: 'Criterios de aceptación', secciones: [{ clave: 'norma', titulo: 'Norma' }, { clave: 'fabricacion', titulo: 'Fabricación y espacio' }] },
  {
    titulo: 'Generales',
    secciones: [
      { clave: 'carro', titulo: 'Tren y carro' },
      { clave: 'resistencia', titulo: 'Resistencia al avance' },
      { clave: 'escala', titulo: 'Escala (prototipo)' },
    ],
  },
  { titulo: 'Avanzado', secciones: [{ clave: 'resolucion', titulo: 'Resolución' }, { clave: 'numerico', titulo: 'Numérico' }] },
];

// Unidades usadas, una sola vez cada una: el factor y el simbolo no se repiten campo a campo.
const cm = (decimales: number, paso: number): UnidadDePresentacion => ({ simbolo: 'cm', factor: 100, decimales, paso });
const mm = (decimales: number, paso: number): UnidadDePresentacion => ({ simbolo: 'mm', factor: 1000, decimales, paso });
const grados = (decimales: number, paso: number): UnidadDePresentacion => ({ simbolo: '°', factor: 180 / Math.PI, decimales, paso });
const tal = (simbolo: string, decimales: number, paso: number): UnidadDePresentacion => ({ simbolo, factor: 1, decimales, paso });

/** Lo que se declara aca: todo menos la ayuda, que se toma del nucleo. */
type Declarada = Omit<Etiqueta, 'ayuda'> & { ayuda?: string };

const DECLARADAS: Record<NombreDeParametro, Declarada> = {
  // ---------- modo de curvatura ----------
  // Unico con ayuda escrita aca: el exportador lo deja fuera de las cuatro
  // listas del esquema (CONTRATO_VISUALIZADOR.md) y no hay descripcion que reusar.
  ModoCurvatura: {
    nombre: 'Modo de curvatura',
    ayuda: 'que ley de curvatura persigue el generador en el arco de cada elemento; decide cuales de los parametros de abajo se consumen y cuales quedan inertes',
  },
  AceleracionNormalObjetivo: { nombre: 'Aceleración normal objetivo', unidadDePresentacion: tal('m/s²', 1, 0.5), rangoSugerido: [5, 60] },
  FuerzaGObjetivo: { nombre: 'Fuerza G objetivo', unidadDePresentacion: tal('G', 2, 0.1), rangoSugerido: [1, 6] },
  SemianchoDeSuavizadoNormativo: { nombre: 'Semiancho de suavizado normativo', unidadDePresentacion: tal('s', 3, 0.01), rangoSugerido: [0, 0.5] },

  // ---------- geometria de cada elemento ----------
  RadioDelLoop: { nombre: 'Radio del loop', unidadDePresentacion: cm(1, 0.5), rangoSugerido: [5, 100] },
  RollExtraDelLoop: { nombre: 'Roll extra del loop', unidadDePresentacion: grados(1, 1), rangoSugerido: [-180, 180] },
  RadioDelDiveLoop: { nombre: 'Radio del dive loop', unidadDePresentacion: cm(1, 0.5), rangoSugerido: [5, 150] },
  SeparacionDelDiveLoop: { nombre: 'Separación del dive loop', unidadDePresentacion: cm(1, 0.5), rangoSugerido: [0, 100] },
  RadioDeLaHelice: { nombre: 'Radio de la hélice', unidadDePresentacion: cm(1, 0.5), rangoSugerido: [5, 200] },
  VueltasDeLaHelice: { nombre: 'Vueltas de la hélice', unidadDePresentacion: tal('vueltas', 2, 0.25), rangoSugerido: [0.1, 5] },
  AvanceDeLaHelice: { nombre: 'Avance de la hélice', unidadDePresentacion: cm(1, 0.5), rangoSugerido: [-200, 200] },
  PeralteDeLaHelice: { nombre: 'Peralte de la hélice', unidadDePresentacion: grados(1, 1), rangoSugerido: [-90, 90] },
  RadioDelGiro: { nombre: 'Radio del giro', unidadDePresentacion: cm(1, 0.5), rangoSugerido: [5, 200] },
  AnguloDelGiro: { nombre: 'Ángulo del giro', unidadDePresentacion: grados(1, 5), rangoSugerido: [5, 360] },
  PeralteDelGiro: { nombre: 'Peralte del giro', unidadDePresentacion: grados(1, 1), rangoSugerido: [0, 180] },
  AvanceDelGiro: { nombre: 'Avance del giro', unidadDePresentacion: cm(1, 0.5), rangoSugerido: [-100, 100] },
  ModoDePeralteDelGiro: { nombre: 'Modo de peralte del giro' },
  DesvioDePeralteDelGiro: { nombre: 'Desvío del peralte respecto del CIR', unidadDePresentacion: grados(1, 1), rangoSugerido: [-90, 90] },
  PeralteAlineadoAlCentroDeCurvatura: { nombre: 'Peralte siempre alineado al CIR (centro de curvatura)' },
  PeralteAlineadoALaFuerza: { nombre: 'Peralte siempre alineado al CIR (fuerza resultante)' },
  SentidoDelGiro: { nombre: 'Sentido del giro' },
  RadioDeReferencia: { nombre: 'Radio de referencia', unidadDePresentacion: cm(1, 0.5), rangoSugerido: [5, 200] },
  SeparacionDePatas: { nombre: 'Separación de patas', unidadDePresentacion: cm(1, 0.5), rangoSugerido: [0, 100] },
  InclinacionHelicoidalImpuesta: { nombre: 'Inclinación helicoidal impuesta (tan α)', unidadDePresentacion: tal('-', 3, 0.01), rangoSugerido: [-2, 2], seccion: 'ficha' },

  // ---------- criterios de aceptacion ----------
  GMinimaCuspide: { nombre: 'G mínima en la cúspide', unidadDePresentacion: tal('G', 2, 0.05), rangoSugerido: [0, 2], seccion: 'norma' },
  PuntoDeVerificacionNormativa: { nombre: 'Punto de verificación normativa', seccion: 'norma' },
  OnsetNormativoPorEje: { nombre: 'Onset normativo por eje (prototipo)', unidadDePresentacion: tal('G/s', 1, 0.5), rangoSugerido: [1, 30], seccion: 'norma' },
  OnsetMaximoModelo: { nombre: 'Onset máximo del modelo', unidadDePresentacion: tal('G/s', 1, 0.5), rangoSugerido: [1, 200], seccion: 'resolucion' },
  TolObjetivoDeG: { nombre: 'Tolerancia del objetivo de G', unidadDePresentacion: tal('G', 3, 0.01), rangoSugerido: [0.001, 0.5], seccion: 'norma' },
  FactorDeSeguridadNormativo: { nombre: 'Factor de seguridad normativo', unidadDePresentacion: tal('-', 2, 0.05), rangoSugerido: [1, 3], seccion: 'norma' },
  AlturaMaximaDelElemento: { nombre: 'Altura máxima del elemento', unidadDePresentacion: cm(1, 1), rangoSugerido: [10, 300], seccion: 'fabricacion' },
  RadioMinimoFabricable: { nombre: 'Radio mínimo fabricable', unidadDePresentacion: cm(1, 0.5), rangoSugerido: [1, 50], seccion: 'fabricacion' },
  AlturaMinimaSuelo: { nombre: 'Altura mínima sobre el suelo', unidadDePresentacion: cm(1, 0.5), rangoSugerido: [0, 50], seccion: 'fabricacion' },
  BoundingBoxDisponible: { nombre: 'Caja disponible', unidadDePresentacion: cm(1, 5), seccion: 'fabricacion' },
  ArcoMinimoAutointerferencia: { nombre: 'Arco mínimo de autointerferencia', unidadDePresentacion: cm(1, 1), rangoSugerido: [5, 100], seccion: 'numerico' },
  DistanciaMinimaEntreVias: { nombre: 'Distancia mínima entre vías', unidadDePresentacion: mm(1, 1), rangoSugerido: [1, 200], seccion: 'fabricacion' },
  AnguloMaximoDeAcople: { nombre: 'Ángulo máximo del acople entre carros', unidadDePresentacion: grados(1, 1), rangoSugerido: [5, 90], seccion: 'fabricacion' },

  // ---------- generales ----------
  Gravedad: { nombre: 'Gravedad', unidadDePresentacion: tal('m/s²', 3, 0.01), rangoSugerido: [9, 10], seccion: 'numerico' },
  RhoAire: { nombre: 'Densidad del aire', unidadDePresentacion: tal('kg/m³', 3, 0.01), rangoSugerido: [0.5, 2], seccion: 'resistencia' },
  CrrPortantes: { nombre: 'Rodadura de las ruedas portantes', unidadDePresentacion: tal('-', 4, 0.005), rangoSugerido: [0, 0.2], seccion: 'resistencia' },
  CrrGuia: { nombre: 'Rodadura de las ruedas guía', unidadDePresentacion: tal('-', 4, 0.005), rangoSugerido: [0, 0.2], seccion: 'resistencia' },
  CrrRetencion: { nombre: 'Rodadura de las ruedas de retención', unidadDePresentacion: tal('-', 4, 0.005), rangoSugerido: [0, 0.2], seccion: 'resistencia' },
  ModelarArrastre: { nombre: 'Modelar el arrastre aerodinámico', seccion: 'resistencia' },
  CoefArrastre: { nombre: 'Coeficiente de arrastre', unidadDePresentacion: tal('-', 3, 0.05), rangoSugerido: [0.1, 2], seccion: 'resistencia' },
  FactorTren: { nombre: 'Factor de tren', unidadDePresentacion: tal('-', 3, 0.05), rangoSugerido: [0, 1], seccion: 'resistencia' },
  NumeroDeCarros: { nombre: 'Número de carros', unidadDePresentacion: tal('-', 0, 1), rangoSugerido: [1, 10], seccion: 'carro' },
  Masa: { nombre: 'Masa del carro con el pasajero', unidadDePresentacion: { simbolo: 'g', factor: 1000, decimales: 1, paso: 1 }, rangoSugerido: [10, 2000], seccion: 'carro' },
  LargoCarro: { nombre: 'Largo del carro', unidadDePresentacion: cm(1, 0.5), rangoSugerido: [2, 50], seccion: 'carro' },
  AltoCarro: { nombre: 'Alto del carro', unidadDePresentacion: cm(1, 0.5), rangoSugerido: [2, 30], seccion: 'carro' },
  AnchoVia: { nombre: 'Ancho de vía (trocha)', unidadDePresentacion: cm(1, 0.5), rangoSugerido: [2, 30], seccion: 'carro' },
  Holgura: { nombre: 'Holgura', unidadDePresentacion: mm(1, 1), rangoSugerido: [0, 100], seccion: 'carro' },
  DiametroRueda: { nombre: 'Diámetro de rueda', unidadDePresentacion: mm(1, 0.1), rangoSugerido: [3, 60], seccion: 'carro' },
  SeparacionEntreCarros: { nombre: 'Separación entre carros', unidadDePresentacion: cm(1, 0.1), rangoSugerido: [0.5, 10], seccion: 'carro' },
  AreaFrontal: { nombre: 'Área frontal', unidadDePresentacion: { simbolo: 'cm²', factor: 1e4, decimales: 1, paso: 0.5 }, rangoSugerido: [1, 500], seccion: 'resistencia' },
  DistanciaHeartline: { nombre: 'Distancia del riel a la heartline', unidadDePresentacion: cm(1, 0.1), rangoSugerido: [0.5, 20], seccion: 'carro' },
  DistanciaHeartlineACabeza: { nombre: 'Distancia de la heartline a la cabeza', unidadDePresentacion: cm(1, 0.1), rangoSugerido: [0.5, 20], seccion: 'carro' },
  MetodoDeAcoplamiento: { nombre: 'Método de acoplamiento', seccion: 'resolucion' },
  CalcularVelocidadMinima: { nombre: 'Calcular la velocidad inicial mínima', seccion: 'resolucion' },
  CalcularTodosLosCarros: { nombre: 'Calcular todos los carros del tren', seccion: 'carro' },
  DisenoDelTren: { nombre: 'Diseño del tren (para qué carro se diseña cada elemento)', seccion: 'carro' },
  // Los dos del prototipo: en METROS a proposito (ver la cabecera de este archivo).
  RadioDeReferenciaReal: { nombre: 'Radio de referencia real (prototipo)', unidadDePresentacion: tal('m', 2, 0.1), rangoSugerido: [1, 50], seccion: 'escala' },
  LargoCarroReal: { nombre: 'Largo del carro real (prototipo)', unidadDePresentacion: tal('m', 2, 0.1), rangoSugerido: [1, 20], seccion: 'escala' },
  PasoGeneracion: { nombre: 'Paso de generación', unidadDePresentacion: mm(2, 0.1), rangoSugerido: [0.2, 20], seccion: 'numerico' },
  PasoSimulacion: { nombre: 'Paso de simulación', unidadDePresentacion: mm(2, 0.1), rangoSugerido: [0.5, 50], seccion: 'numerico' },
  PasoBusquedaVelocidad: { nombre: 'Paso de búsqueda de velocidad', unidadDePresentacion: mm(1, 1), rangoSugerido: [1, 100], seccion: 'resolucion' },

  // ---------- avanzado: numerico (decisiones del solver, no de diseno) ----------
  TolCierrePitch: { nombre: 'Tolerancia de cierre del pitch', unidadDePresentacion: grados(4, 0.001), rangoSugerido: [0.0001, 1], seccion: 'numerico' },
  TolNorma: { nombre: 'Tolerancia de norma nula', unidadDePresentacion: tal('m', 2, 1e-12), seccion: 'numerico' },
  TolPuntoFijo: { nombre: 'Tolerancia del punto fijo', unidadDePresentacion: tal('m/s', 2, 1e-9), seccion: 'numerico' },
  MaxIteracionesPuntoFijo: { nombre: 'Máximo de iteraciones del punto fijo', unidadDePresentacion: tal('-', 0, 1), rangoSugerido: [5, 500], seccion: 'numerico' },
  TolVelocidadDelTren: { nombre: 'Tolerancia de velocidad del diseño del tren', unidadDePresentacion: tal('m/s', 4, 0.001), rangoSugerido: [0.0001, 0.05], seccion: 'numerico' },
  MaxIteracionesCierre: { nombre: 'Máximo de iteraciones de cierre', unidadDePresentacion: tal('-', 0, 1), rangoSugerido: [1, 50], seccion: 'numerico' },
  MaxIteracionesAjuste: { nombre: 'Máximo de iteraciones de ajuste', unidadDePresentacion: tal('-', 0, 1), rangoSugerido: [1, 50], seccion: 'numerico' },
  MargenDeOnset: { nombre: 'Margen de onset', unidadDePresentacion: tal('-', 4, 0.001), rangoSugerido: [0, 0.1], seccion: 'numerico' },
  PasosEntreOrtonormalizaciones: { nombre: 'Pasos entre ortonormalizaciones', unidadDePresentacion: tal('-', 0, 1), rangoSugerido: [1, 200], seccion: 'numerico' },
  VersoresEnGrafico3D: { nombre: 'Versores en el gráfico 3D', unidadDePresentacion: tal('-', 0, 5), rangoSugerido: [0, 200], seccion: 'oculto' },
  ToleranciaVelocidadDeDiseno: { nombre: 'Tolerancia de velocidad de diseño', unidadDePresentacion: tal('m/s', 2, 0.01), rangoSugerido: [0.01, 1], seccion: 'numerico' },
};

/**
 * Descripcion declarada en el nucleo, por parametro. Las de los elementos
 * van al final y no pisan: SentidoDelGiro lo declaran tres elementos con
 * matices distintos, y en la ficha se usa la del elemento concreto.
 */
function descripcionesDelNucleo(): Map<NombreDeParametro, string> {
  const mapa = new Map<NombreDeParametro, string>();
  for (const modo of MODOS_DE_CURVATURA) {
    for (const d of ParametrosDelModo(modo).Lista) mapa.set(d.Nombre, d.Descripcion);
  }
  for (const d of ParametrosDeAceptacion()) mapa.set(d.Nombre, d.Descripcion);
  for (const d of ParametrosGenerales()) mapa.set(d.Nombre, d.Descripcion);
  for (const tipo of CATALOGO_DE_ELEMENTOS) {
    for (const d of DECLARACIONES_DE_ELEMENTOS[tipo]) if (!mapa.has(d.Nombre)) mapa.set(d.Nombre, d.Descripcion);
  }
  return mapa;
}

function construir(): Record<NombreDeParametro, Etiqueta> {
  const descripciones = descripcionesDelNucleo();
  const salida = {} as Record<NombreDeParametro, Etiqueta>;
  for (const [nombre, declarada] of Object.entries(DECLARADAS) as [NombreDeParametro, Declarada][]) {
    salida[nombre] = { ...declarada, ayuda: declarada.ayuda ?? descripciones.get(nombre) ?? '' };
  }
  return salida;
}

export const ETIQUETAS: Record<NombreDeParametro, Etiqueta> = construir();

/** La etiqueta de un parametro; si faltara (el test lo impide) cae al propio nombre. */
export function etiquetaDe(nombre: NombreDeParametro): Etiqueta {
  return ETIQUETAS[nombre] ?? { nombre, ayuda: '' };
}

/**
 * Parametros que solo tienen efecto en algunos modos de curvatura aunque no
 * los declare ParametrosDelModo (estan en otro bloque del contrato y ahi se
 * quedan: esto es solo presentacion). El formulario los muestra si al menos
 * una instancia del diseno usa uno de esos modos.
 *
 * FactorDeSeguridadNormativo solo lo lee el objetivo de GNormativaMaxima;
 * TolObjetivoDeG, ese objetivo y el criterio "Gz objetivo del modo
 * alcanzado", que existe en FuerzaGConstante y GNormativaMaxima.
 */
const SOLO_EN_MODOS: Partial<Record<NombreDeParametro, readonly ModoCurvatura[]>> = {
  FactorDeSeguridadNormativo: ['GNormativaMaxima'],
  TolObjetivoDeG: ['FuerzaGConstante', 'GNormativaMaxima'],
};

const alineado = (p: Parametros) => p.PeralteAlineadoAlCentroDeCurvatura || p.PeralteAlineadoALaFuerza;

/**
 * Condiciones sobre los parametros vigentes (los globales en el formulario
 * global; globales mas ajustes en la ficha de una instancia): un parametro
 * que en ese estado no hace nada no se muestra. El valor no se toca.
 */
const SOLO_SI: Partial<Record<NombreDeParametro, (p: Parametros) => boolean>> = {
  RhoAire: (p) => p.ModelarArrastre,
  CoefArrastre: (p) => p.ModelarArrastre,
  AreaFrontal: (p) => p.ModelarArrastre,
  FactorTren: (p) => p.ModelarArrastre && p.NumeroDeCarros > 1,
  // Lo del tren solo con mas de un carro.
  SeparacionEntreCarros: (p) => p.NumeroDeCarros > 1,
  CalcularTodosLosCarros: (p) => p.NumeroDeCarros > 1,
  DisenoDelTren: (p) => p.NumeroDeCarros > 1,
  AnguloMaximoDeAcople: (p) => p.NumeroDeCarros > 1,
  TolVelocidadDelTren: (p) => p.NumeroDeCarros > 1 && p.DisenoDelTren !== 'Particula',
  PasoBusquedaVelocidad: (p) => p.CalcularVelocidadMinima,
  // Con el peralte alineado al CIR, el peralte propio del elemento no se usa.
  PeralteDelGiro: (p) => !alineado(p) && p.ModoDePeralteDelGiro === 'Constante',
  ModoDePeralteDelGiro: (p) => !alineado(p),
  DesvioDePeralteDelGiro: (p) => !alineado(p) && p.ModoDePeralteDelGiro !== 'Constante',
  PeralteDeLaHelice: (p) => !alineado(p),
  RollExtraDelLoop: (p) => !alineado(p),
};

/** Parametros cuyo cambio cambia que se muestra: el formulario se redibuja al editarlos. */
export const CAMBIAN_LA_VISTA: readonly NombreDeParametro[] = [
  'ModoCurvatura', 'ModelarArrastre', 'NumeroDeCarros', 'CalcularVelocidadMinima', 'DisenoDelTren',
  'ModoDePeralteDelGiro', 'PeralteAlineadoAlCentroDeCurvatura', 'PeralteAlineadoALaFuerza',
];

/** true si el parametro se muestra con estos modos en uso y estos parametros vigentes. */
export function seMuestra(nombre: NombreDeParametro, modosEnUso: readonly ModoCurvatura[], parametros: Parametros): boolean {
  if (ETIQUETAS[nombre]?.seccion === 'oculto') return false;
  const modos = SOLO_EN_MODOS[nombre];
  if (modos && !modosEnUso.some((m) => modos.includes(m))) return false;
  const condicion = SOLO_SI[nombre];
  return !condicion || condicion(parametros);
}

/**
 * Los dos ticks de peralte alineado al CIR son excluyentes: prender uno
 * apaga el otro. Devuelve los ajustes a aplicar junto con el cambio.
 */
export function conExclusionDePeralte(nombre: NombreDeParametro, valor: unknown): Partial<Parametros> {
  const cambio = { [nombre]: valor } as Partial<Parametros>;
  if (nombre === 'PeralteAlineadoAlCentroDeCurvatura' && valor === true) cambio.PeralteAlineadoALaFuerza = false;
  if (nombre === 'PeralteAlineadoALaFuerza' && valor === true) cambio.PeralteAlineadoAlCentroDeCurvatura = false;
  return cambio;
}

/** El radio de cada elemento: el que copia en RadioDeReferencia antes de generar (A5). */
export const RADIO_DEL_ELEMENTO: Record<NombreDeElemento, NombreDeParametro> = {
  LoopVertical: 'RadioDelLoop',
  DiveLoop: 'RadioDelDiveLoop',
  Helice: 'RadioDeLaHelice',
  OverBankedTurn: 'RadioDelGiro',
};

/** En que modos de curvatura se consume este parametro (vacio si no es del modo). */
export function modosQueLoConsumen(nombre: NombreDeParametro): string[] {
  return MODOS_DE_CURVATURA.filter((modo) => ParametrosDelModo(modo).Lista.some((d) => d.Nombre === nombre));
}

/** Que elementos del catalogo declaran este parametro (vacio si no es geometrico). */
export function elementosQueLoConsumen(nombre: NombreDeParametro): string[] {
  return CATALOGO_DE_ELEMENTOS.filter((tipo) => DECLARACIONES_DE_ELEMENTOS[tipo].some((d) => d.Nombre === nombre));
}

// ---------------------------------------------------------------- conversion
// El JSON y el nucleo estan en SI; estas cuatro funciones son el unico lugar
// donde el numero cambia de unidad, y solo para mostrarlo o para leer lo que
// se tipeo. Sin unidad declarada el valor pasa tal cual.

/** Valor SI -> valor mostrado. */
export function aPresentacion(valorSI: number, unidad?: UnidadDePresentacion): number {
  return unidad ? valorSI * unidad.factor : valorSI;
}

/** Valor mostrado -> valor SI (lo que se guarda en el diseno). */
export function aSI(valorMostrado: number, unidad?: UnidadDePresentacion): number {
  return unidad ? valorMostrado / unidad.factor : valorMostrado;
}

/**
 * Texto del input: decimales fijos de la unidad, nunca cifras
 * significativas (fase 0). Si con esos decimales el valor se redondearia a
 * cero (las tolerancias: 1e-12) se cae a exponencial, que es lo que el
 * usuario escribio y ademas es un valor valido para <input type="number">.
 */
export function textoDeEntrada(valorSI: number, unidad?: UnidadDePresentacion): string {
  const valor = aPresentacion(valorSI, unidad);
  if (!Number.isFinite(valor)) return '';
  const decimales = unidad?.decimales ?? 6;
  const fijo = valor.toFixed(decimales);
  if (valor !== 0 && Number(fijo) === 0) return valor.toExponential();
  // toFixed puede dar "-0.0": el signo de un cero no aporta.
  return Number(fijo) === 0 ? (0).toFixed(decimales) : fijo;
}

/** Valor con su simbolo, para el popover ("70.0 cm", "55.0°", "0.25"). */
export function textoConUnidad(valorSI: number, unidad?: UnidadDePresentacion): string {
  const texto = textoDeEntrada(valorSI, unidad);
  if (!unidad || unidad.simbolo === '-') return texto;
  return unidad.simbolo === '°' ? `${texto}°` : `${texto} ${unidad.simbolo}`;
}

/** true si el valor mostrado se sale del rango sugerido. Aviso visual, nunca bloqueo. */
export function fueraDelRango(valorMostrado: number, etiqueta: Etiqueta): boolean {
  const rango = etiqueta.rangoSugerido;
  if (!rango || !Number.isFinite(valorMostrado)) return false;
  return valorMostrado < rango[0] || valorMostrado > rango[1];
}

/**
 * Ancho del input en caracteres, para que ningun valor razonable desborde:
 * signo + digitos enteros (los del rango sugerido, o 4) + punto + decimales.
 */
export function digitosDeEntrada(etiqueta: Etiqueta): number {
  const unidad = etiqueta.unidadDePresentacion;
  const decimales = unidad?.decimales ?? 3;
  const enteros = etiqueta.rangoSugerido
    ? Math.max(...etiqueta.rangoSugerido.map((v) => String(Math.trunc(Math.abs(v))).length))
    : 4;
  const total = 1 + enteros + (decimales > 0 ? decimales + 1 : 0);
  return Math.min(Math.max(total, 6), 13);
}
