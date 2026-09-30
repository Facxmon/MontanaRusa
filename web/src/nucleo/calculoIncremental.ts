// Recalculo incremental de un diseno: el mismo resultado que calcularLayout
// (calcular.ts), pero reutilizando lo que ya se calculo en pedidos
// anteriores. Es una optimizacion sin cambio de comportamiento: el test
// calculoIncremental.test.ts compara las dos rutas y exige igualdad exacta.
//
// Por que se puede: cada elemento arranca en el Estado de salida del
// anterior y su constructor (geometria, marcha acoplada, SimularSobreTrack,
// chequeos, velocidad minima) es una funcion pura de
//   (tipo, Parametros de la instancia, Estado de entrada)
// salvo UNA linea de los posteriores, "Interferencia con la via
// preexistente", que mira la polilinea ya construida. La cache guarda el
// resultado del constructor con esa terna como clave; al reutilizarlo, si la
// via previa no es la misma contra la que se calculo, se rehace solo esa
// linea (CriterioDeInterferenciaConLaVia).
//
// Lo que siempre se recalcula entero, porque depende de todo el circuito:
// - el bloque normativo sobre la linea de tiempo continua del layout
//   (VerificarLayoutNormativo): un elemento puede alargar un evento del
//   anterior y cambiar su veredicto. Aca se corre una sola vez al final, con
//   el layout completo; calcularLayout lo corre despues de cada elemento,
//   pero cada corrida reemplaza por completo las lineas de la anterior, asi
//   que el resultado final es el mismo;
// - la concatenacion del riel y la exportacion al contrato.
//
// La dinamica del carro no necesita trato aparte: el modelo es de particula
// (documentacion_generador_elementos.md, limitaciones: el tren de varios
// carros no esta implementado) y la velocidad y la energia de
// entrada viajan en el Estado, que es parte de la clave. Si una edicion
// cambia la velocidad a la salida del elemento k, los siguientes cambian de
// clave y se recalculan; si no la cambia, sus resultados son exactamente los
// mismos. No hay ninguna aproximacion.
//
// Invalidacion: si cambian los parametros generales (entrada.parametros) se
// vacia la cache entera. La cache vive en el worker (worker.ts), pero cada
// elemento nuevo se copia a la pagina (alGuardar -> ClienteDeCalculo): si
// el calculo se detiene, el worker se recrea y se siembra con esa copia
// (sembrar), asi que lo ya calculado no se pierde.

import type * as Contrato from '../contrato/tipos';
import { EstadoInicial } from './basicos';
import { ErrorDeElemento, type AlAvanzar, type EntradaDeDiseno } from './calcular';
import { CONSTRUCTORES } from './elementos';
import { exportarLayout, type InstanciaExportada } from './exportar';
import type { Vec3 } from './matematica';
import { AjustarParametros } from './parametros';
import type { Elemento, Estado, Layout, RegistroDeLayout, Reporte, Track } from './tipos';
import { CriterioDeInterferenciaConLaVia, NOMBRE_INTERFERENCIA_CON_LA_VIA, SeparacionExigidaEntreVias, VerificarLayoutNormativo } from './verificacion';

/**
 * Entradas de cache que se conservan ademas de las del diseno actual: dan
 * margen para deshacer/rehacer y para ir y volver entre valores de un
 * parametro sin recalcular. Cada entrada guarda un Track y un Sim completos
 * (del orden de un par de MB con el paso por defecto), por eso hay tope.
 */
export const ENTRADAS_EXTRA_EN_CACHE = 16;

export interface EntradaDeCache {
  Salida: Estado;
  Elemento: Elemento;
  Reporte: Reporte;
  /** Identifica la polilinea del riel del elemento: dos entradas con la misma ficha tienen PuntosRiel y LongitudArco identicos bit a bit. */
  Ficha: number;
  /** Firma de la via previa (fichas de los elementos anteriores) contra la que se calculo la linea de interferencia de Reporte. */
  Prefijo: string;
}

/** Que paso en la ultima llamada a calcular(): cuantos elementos salieron de la cache y cuantos se construyeron. */
export interface EstadisticaIncremental {
  reutilizados: number;
  recalculados: number;
  /** Reutilizados a los que hubo que rehacer la linea de interferencia porque la via previa cambio. */
  interferenciasRehechas: number;
}

export class CalculadorIncremental {
  private readonly cache = new Map<string, EntradaDeCache>();
  private firmaDeGlobales: string | null = null;
  private ultimaCorrida: EntradaDeCache[] = [];
  private proximaFicha = 1;
  estadistica: EstadisticaIncremental = { reutilizados: 0, recalculados: 0, interferenciasRehechas: 0 };

  /**
   * @param alGuardar se llama cada vez que una entrada se agrega o cambia (con la firma de los
   *   globales a la que pertenece), para llevar una copia fuera del worker.
   */
  constructor(
    private readonly entradasExtra = ENTRADAS_EXTRA_EN_CACHE,
    private readonly alGuardar?: (firma: string, clave: string, entrada: EntradaDeCache) => void,
  ) {}

  /**
   * Carga entradas guardadas afuera (por un worker anterior) para la firma de
   * globales dada. Las fichas se conservan; las nuevas siguen desde la mayor.
   */
  sembrar(firma: string, entradas: Array<[string, EntradaDeCache]>): void {
    this.invalidar();
    this.firmaDeGlobales = firma;
    for (const [clave, entrada] of entradas) {
      this.cache.set(clave, entrada);
      this.proximaFicha = Math.max(this.proximaFicha, entrada.Ficha + 1);
    }
  }

  /** Claves en cache, de la menos a la mas usada. */
  claves(): string[] {
    return [...this.cache.keys()];
  }

  /** Vacia la cache: el proximo calculo es completo. */
  invalidar(): void {
    this.cache.clear();
    this.ultimaCorrida = [];
    this.firmaDeGlobales = null;
  }

  /** Cantidad de elementos cacheados (para los tests). */
  get tamanoDeCache(): number {
    return this.cache.size;
  }

  /** Mismo contrato que calcularLayout (mismos errores, mismo avance por elemento, mismo resultado). */
  calcular(entrada: EntradaDeDiseno, versionGenerador = 'js', alAvanzar?: AlAvanzar): Contrato.Layout {
    if (entrada.secuencia.length === 0) throw new Error('La secuencia no tiene elementos: agregar al menos uno.');
    const firma = claveExacta(entrada.parametros);
    if (firma !== this.firmaDeGlobales) {
      this.invalidar();
      this.firmaDeGlobales = firma;
    }
    const estadistica: EstadisticaIncremental = { reutilizados: 0, recalculados: 0, interferenciasRehechas: 0 };
    this.estadistica = estadistica;

    const EstadoInicialDelLayout = EstadoInicial(entrada.posicion, entrada.tangente, entrada.arriba, entrada.velocidad, entrada.parametros);
    let Estado = EstadoInicialDelLayout;
    const Elementos: RegistroDeLayout[] = [];
    const PuntosRiel: Vec3[] = [];
    const LongitudArcoRiel: number[] = [];
    const instancias: InstanciaExportada[] = [];
    const corrida: EntradaDeCache[] = [];
    let prefijo = '';
    const total = entrada.secuencia.length;

    entrada.secuencia.forEach((inst, i) => {
      const constructor = CONSTRUCTORES[inst.tipo];
      if (!constructor) throw new Error(`Elemento desconocido: ${String(inst.tipo)}`);
      try {
        const { Parametros: P, Inertes } = AjustarParametros(entrada.parametros, inst.ajustes, inst.tipo);
        const clave = `${inst.tipo}|${claveExacta(P)}|${claveExacta(Estado)}`;
        let registro = this.cache.get(clave);
        let nueva = true;
        if (registro) {
          nueva = false;
          this.cache.delete(clave); // al final del orden de la Map: la menos usada queda primera
          if (registro.Prefijo !== prefijo) {
            registro = { ...registro, Reporte: conInterferencia(registro.Reporte, registro.Elemento, { PuntosRiel, LongitudArcoRiel }), Prefijo: prefijo };
            estadistica.interferenciasRehechas++;
            nueva = true;
          }
          estadistica.reutilizados++;
        } else {
          // Lo unico del layout que lee el constructor es la via ya construida (ChequeosPosteriores).
          const Layout: Layout = { EstadoInicial: EstadoInicialDelLayout, EstadoActual: Estado, Parametros: entrada.parametros, Elementos, PuntosRiel, LongitudArcoRiel };
          const [Salida, Elemento, Reporte] = constructor(Estado, P, Layout);
          registro = { Salida, Elemento, Reporte, Ficha: this.fichaDe(Elemento.Track, i), Prefijo: prefijo };
          estadistica.recalculados++;
        }
        this.cache.set(clave, registro);
        if (nueva) this.alGuardar?.(firma, clave, registro);
        corrida.push(registro);

        const { Elemento, Reporte, Salida } = registro;
        Elementos.push({ Elemento, EstadoEntrada: Elemento.EstadoEntrada, EstadoSalida: Salida, Reporte });
        // Igual que LayoutAgregarElemento: el nodo de empalme no se repite.
        const desde = PuntosRiel.length === 0 ? 0 : 1;
        for (let k = desde; k < Elemento.Track.PuntosRiel.length; k++) {
          PuntosRiel.push(Elemento.Track.PuntosRiel[k]!);
          LongitudArcoRiel.push(Elemento.Track.LongitudArco[k]!);
        }
        Estado = Salida;
        prefijo += `${registro.Ficha},`;
        instancias.push({ ajustes: inst.ajustes, inertes: Inertes });
      } catch (error) {
        throw new ErrorDeElemento(i, inst.tipo, error as Error);
      }
      alAvanzar?.(i + 1, total, inst.tipo);
    });

    const Layout = VerificarLayoutNormativo({
      EstadoInicial: EstadoInicialDelLayout, EstadoActual: Estado, Parametros: entrada.parametros, Elementos, PuntosRiel, LongitudArcoRiel,
    });
    this.ultimaCorrida = corrida;
    this.recortar(total + this.entradasExtra);
    return exportarLayout(Layout, { versionGenerador, instancias });
  }

  /**
   * Ficha de la polilinea de un elemento recien construido: si es identica
   * bit a bit a la del elemento que ocupaba la misma posicion en la corrida
   * anterior, hereda su ficha. Asi, una edicion que no cambia el riel de k
   * (p. ej. un limite de aceptacion) no obliga a rehacer la interferencia de
   * los siguientes.
   */
  private fichaDe(Track: Track, indice: number): number {
    const anterior = this.ultimaCorrida[indice];
    if (anterior && mismaPolilinea(anterior.Elemento.Track, Track)) return anterior.Ficha;
    return this.proximaFicha++;
  }

  /** Descarta las entradas menos usadas hasta dejar `capacidad`. */
  private recortar(capacidad: number): void {
    for (const clave of this.cache.keys()) {
      if (this.cache.size <= capacidad) break;
      this.cache.delete(clave);
    }
  }
}

/** El Reporte con la linea de interferencia rehecha contra otra via previa; el resto de las lineas no depende de ella. */
export function conInterferencia(Reporte: Reporte, Elemento: Elemento, Via: Pick<Layout, 'PuntosRiel' | 'LongitudArcoRiel'>): Reporte {
  const Posteriores = [...Reporte.Posteriores];
  const k = Posteriores.findIndex((c) => c.Nombre === NOMBRE_INTERFERENCIA_CON_LA_VIA);
  if (k < 0) throw new Error(`El reporte no trae la linea "${NOMBRE_INTERFERENCIA_CON_LA_VIA}".`);
  // Elemento.Parametros son los que vio ChequeosPosteriores (con el RadioDeReferencia del elemento).
  const P = Elemento.Parametros;
  Posteriores[k] = CriterioDeInterferenciaConLaVia(Elemento.Track, P, Via, SeparacionExigidaEntreVias(P));
  return { ...Reporte, Posteriores };
}

function mismaPolilinea(a: Track, b: Track): boolean {
  if (a.PuntosRiel.length !== b.PuntosRiel.length || a.LongitudArco.length !== b.LongitudArco.length) return false;
  for (let i = 0; i < a.LongitudArco.length; i++) if (!Object.is(a.LongitudArco[i], b.LongitudArco[i])) return false;
  for (let i = 0; i < a.PuntosRiel.length; i++) {
    const p = a.PuntosRiel[i]!;
    const q = b.PuntosRiel[i]!;
    if (!Object.is(p[0], q[0]) || !Object.is(p[1], q[1]) || !Object.is(p[2], q[2])) return false;
  }
  return true;
}

/**
 * Texto que identifica un valor exactamente: dos valores dan la misma clave
 * si y solo si todos sus numeros son identicos bit a bit (String(numero) es
 * reversible en JS; -0, NaN e Infinity tienen clave propia). Las claves de
 * los objetos se ordenan.
 *
 * TODO(decision de diseno): la consigna pide reutilizar la cache si el
 * estado de entrada coincide "dentro de la tolerancia numerica del
 * proyecto", pero tambien que el resultado incremental sea identico al
 * completo. Las dos cosas no son compatibles: reutilizar con un estado que
 * difiere en 1e-12 devuelve un elemento que el calculo completo no daria.
 * Se eligio igualdad exacta (tolerancia cero). El proyecto no tiene una
 * tolerancia de empalme propia; las del arnes (6e-6 relativo) son para
 * comparar contra los golden redondeados a 6 cifras, no para esto.
 */
export function claveExacta(valor: unknown): string {
  if (typeof valor === 'number') return Object.is(valor, -0) ? '-0' : String(valor);
  if (typeof valor === 'string') return JSON.stringify(valor);
  if (typeof valor === 'boolean' || valor === null) return String(valor);
  if (valor === undefined) return 'u';
  if (Array.isArray(valor) || ArrayBuffer.isView(valor)) return `[${Array.from(valor as ArrayLike<unknown>, claveExacta).join(',')}]`;
  if (typeof valor === 'object') {
    const objeto = valor as Record<string, unknown>;
    return `{${Object.keys(objeto).sort().map((k) => `${JSON.stringify(k)}:${claveExacta(objeto[k])}`).join(',')}}`;
  }
  throw new Error(`claveExacta: tipo no soportado (${typeof valor}).`);
}
