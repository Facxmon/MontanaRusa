// Port de ObjetivoNormativoPorNiveles.m y EvaluarObjetivoNormativo.m: la
// tabla Gz(t) que persigue el modo GNormativaMaxima en el arco, con el reloj
// de cada nivel arrancando donde la G registrada antes del arco lo cruzo.

import { coeficientesPchip, colon, cummax, evaluarCubica, interp1Lineal, interpolantePchip, unico } from './matematica';
import { limiteDeDiseno, tablaNormativa } from './norma';
import type { CurvaNormativa } from './norma';
import type { Escala, ObjetivoNormativo, Parametros } from './tipos';

export function ObjetivoNormativoPorNiveles(
  Curva: CurvaNormativa,
  TiempoPrevio: ArrayLike<number>,
  GzPrevio: ArrayLike<number>,
  TiempoInicioArco: number,
  Escala: Escala,
  Parametros: Parametros,
): ObjetivoNormativo {
  const FactorTiempo = Escala.RaizLambdaLoop;
  const FactorDeSeguridad = Parametros.FactorDeSeguridadNormativo;
  const Semiancho = Parametros.SemianchoDeSuavizadoNormativo;
  const Margen = Parametros.TolObjetivoDeG;

  const Tabla = tablaNormativa(Curva);
  const PasoDuracion = 0.002; // s de prototipo
  const Duracion = colon(0, PasoDuracion, Tabla[Tabla.length - 1]![0]);
  const GzDiseno = Float64Array.from(Duracion, (D) => limiteDeDiseno(Curva, D, Semiancho) / FactorDeSeguridad - Margen);

  // Primer cruce de cada nivel en lo registrado antes del arco.
  const tiempos: number[] = [];
  const gz: number[] = [];
  for (let i = 0; i < TiempoPrevio.length; i++) {
    if (Number.isFinite(TiempoPrevio[i]!) && Number.isFinite(GzPrevio[i]!)) {
      tiempos.push(TiempoPrevio[i]!);
      gz.push(GzPrevio[i]!);
    }
  }
  const TiempoDeCruce = new Float64Array(GzDiseno.length).fill(TiempoInicioArco);
  let Deficit = 0;
  if (tiempos.length >= 2) {
    const { valores: nivelesCrudos, indices: Primero } = unico(cummax(gz), 'first');
    Deficit = Math.min(Math.max(GzDiseno[0]! - nivelesCrudos[nivelesCrudos.length - 1]!, 0), 0.01);
    const NivelesCruzados = nivelesCrudos.map((v) => v + Deficit);
    const TiempoDelPrimero = Primero.map((i) => tiempos[i]!);
    if (NivelesCruzados.length >= 2) {
      const primero = NivelesCruzados[0]!;
      const ultimo = NivelesCruzados[NivelesCruzados.length - 1]!;
      // Dentro del rango es exactamente interp1 pchip; el interpolante precompilado evita rehacer las pendientes por consulta.
      const inversa = interpolantePchip(NivelesCruzados, TiempoDelPrimero);
      for (let i = 0; i < GzDiseno.length; i++) {
        const G = GzDiseno[i]!;
        if (G > primero && G < ultimo) TiempoDeCruce[i] = inversa(G);
      }
    }
    for (let i = 0; i < GzDiseno.length; i++) {
      if (GzDiseno[i]! <= NivelesCruzados[0]!) TiempoDeCruce[i] = tiempos[0]!;
    }
  }

  const Paso = PasoDuracion / FactorTiempo; // s de modelo
  const TiempoDiseno = Float64Array.from(TiempoDeCruce, (t, i) => t + Duracion[i]! / FactorTiempo);

  // Monotonia: donde t(D) retrocede, gana el nivel mas bajo (el D mayor).
  const TiempoMonotono = cummax(TiempoDiseno);
  let HuboPliegue = false;
  for (let i = 0; i < TiempoDiseno.length; i++) {
    if (TiempoDiseno[i]! < TiempoMonotono[i]! - Paso) {
      HuboPliegue = true;
      break;
    }
  }
  const { valores: TiempoUnico, indices: Ultimo } = unico(TiempoMonotono, 'last');
  const GzUnico = Ultimo.map((i) => GzDiseno[i]!);

  let Tiempo = colon(TiempoUnico[0]!, Paso, TiempoUnico[TiempoUnico.length - 1]!);
  if (Tiempo.length < 2) Tiempo = Float64Array.from([TiempoUnico[0]!, TiempoUnico[0]! + Paso]);
  const relleno = GzUnico[GzUnico.length - 1]!;
  const Gz = Float64Array.from(Tiempo, (t) => interp1Lineal(TiempoUnico, GzUnico, t, relleno));
  const Coeficientes = coeficientesPchip(Tiempo, Gz);

  return { Curva, Tiempo, Gz, Coeficientes, Paso, TiempoInicioArco, Margen, Deficit, HuboPliegue };
}

/** Gz objetivo del arco en un instante del modelo: cubica de Hermite por intervalo, constante fuera de la tabla. */
export function EvaluarObjetivoNormativo(Objetivo: ObjetivoNormativo, Tiempo: number): number {
  const NumeroDeNodos = Objetivo.Tiempo.length;
  let Posicion = (Tiempo - Objetivo.Tiempo[0]!) / Objetivo.Paso;
  Posicion = Math.min(Math.max(Posicion, 0), NumeroDeNodos - 1);
  const Indice = Math.min(Math.floor(Posicion), NumeroDeNodos - 2);
  const Local = (Posicion - Indice) * Objetivo.Paso;
  return evaluarCubica(Objetivo.Coeficientes[Indice]!, Local);
}
