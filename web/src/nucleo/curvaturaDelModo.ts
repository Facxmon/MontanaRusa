// Port de Fisica/CurvaturaDelModo.m: la curvatura del RIEL que pide el modo
// elegido en un punto del arco, y el angulo (desde U hacia L) en el que hay
// que ponerla. Todos los objetivos de G son del pasajero, no del riel: el
// riel es el eje de roll y el pasajero va a distancia Brazo sobre U.

import { BrazoDeVerificacion } from './basicos';
import { rad2deg } from './matematica';
import { limiteDeDiseno, limiteNormativo } from './norma';
import { EvaluarObjetivoNormativo } from './objetivoNormativo';
import type { Escala, ObjetivoNormativo, Parametros, Punto, Receta } from './tipos';

/** Reloj del modo normativo: instante del modelo (Inf = duracion cero) o la tabla por niveles del arco. */
export type Reloj = number | ObjetivoNormativo;

export function CurvaturaDelModo(Punto: Punto, Parametros: Parametros, Escala: Escala, Reloj: Reloj, Receta: Receta): [number, number] {
  const g = Parametros.Gravedad;
  const d = Parametros.DistanciaHeartline;
  const Brazo = BrazoDeVerificacion(Parametros);

  const VelocidadCentroDeMasa = Math.max(Punto.VelocidadParaCurvatura, 1e-3);
  const v2 = VelocidadCentroDeMasa * VelocidadCentroDeMasa;
  const ArribaVertical = Punto.VersorArribaCarro[2];
  const AnguloDesdeArriba = Punto.AnguloCurvaturaDesdeArriba;
  const Coseno = Math.cos(AnguloDesdeArriba);

  let ObjetivoSinGravedad: number;
  switch (Parametros.ModoCurvatura) {
    case 'Clotoide': {
      // Radio de referencia del PASAJERO: el riel va d*c mas afuera.
      const RadioRiel = Math.max(Parametros.RadioDeReferencia + d * Coseno, 0.5 * Parametros.RadioDeReferencia);
      return [1 / RadioRiel, AnguloDesdeArriba];
    }
    case 'AceleracionNormalConstante':
      ObjetivoSinGravedad = Parametros.AceleracionNormalObjetivo / v2;
      break;
    case 'FuerzaGConstante':
      ObjetivoSinGravedad = (g * (Parametros.FuerzaGObjetivo - ArribaVertical)) / v2;
      break;
    case 'GNormativaMaxima': {
      if (!Receta.CurvaLimiteGz) {
        throw new Error(
          'El modo GNormativaMaxima necesita Receta.CurvaLimiteGz: cada elemento declara que curva de la norma persigue (ver ElementoLoopVertical y companeros).',
        );
      }
      const FactorDeSeguridad = Parametros.FactorDeSeguridadNormativo;
      const Semiancho = Parametros.SemianchoDeSuavizadoNormativo;
      let GLimite: number;
      let DuracionReal: number;
      if (typeof Reloj !== 'number') {
        GLimite = EvaluarObjetivoNormativo(Reloj, Punto.Tiempo);
        DuracionReal = Math.max(Punto.Tiempo - Reloj.TiempoInicioArco, 0) * Escala.RaizLambdaLoop;
      } else {
        DuracionReal = Math.max(Punto.Tiempo - Reloj, 0) * Escala.RaizLambdaLoop;
        GLimite = limiteDeDiseno(Receta.CurvaLimiteGz, DuracionReal, Semiancho) / FactorDeSeguridad - Parametros.TolObjetivoDeG;
      }
      ObjetivoSinGravedad = (g * (GLimite - ArribaVertical)) / v2;

      if (Receta.CurvaLimiteGy) {
        const GyObjetivo = ObjetivoDeGyDentroDeLaElipse(GLimite, DuracionReal, Receta, Parametros.TolObjetivoDeG, FactorDeSeguridad, Semiancho);
        return CurvaturaDelRielParaGzYGyObjetivo(
          ObjetivoSinGravedad,
          ((GyObjetivo - Punto.VersorLateral[2]) * g) / v2,
          Brazo,
          d,
          VelocidadCentroDeMasa,
          Punto.VelocidadRoll,
          Punto.AceleracionRoll,
          -g * Punto.VersorTangente[2],
          Punto.InclinacionHelicoidal,
        );
      }
      break;
    }
    default:
      throw new Error(`Modo de curvatura no reconocido: ${String(Parametros.ModoCurvatura)}`);
  }

  if (Math.abs(Coseno) < 0.1) {
    throw new Error(
      `El modo ${Parametros.ModoCurvatura} pide +Gz pero la curvatura forma ${rad2deg(AnguloDesdeArriba).toFixed(0)} grados con el eje arriba del carro ` +
        `(cos = ${Coseno.toFixed(3)}): una curva sin peraltar no puede generar +Gz, genera Gy. Hay que peraltar el elemento o cambiar de modo.`,
    );
  }

  let Curvatura = CurvaturaDelRielParaGzObjetivo(ObjetivoSinGravedad, Coseno, Brazo, d, Punto.VelocidadRoll, Punto.InclinacionHelicoidal);
  Curvatura = Math.max(Curvatura, 0); // un loop no invierte el sentido de giro
  return [Curvatura, AnguloDesdeArriba];
}

function ObjetivoDeGyDentroDeLaElipse(
  GzLimite: number,
  DuracionReal: number,
  Receta: Receta,
  Tolerancia: number,
  FactorDeSeguridad: number,
  Semiancho: number,
): number {
  const SemiejeGz = (1.1 * Math.abs(limiteNormativo(Receta.CurvaLimiteGz, 0.2))) / FactorDeSeguridad;
  const SemiejeGy = (1.1 * Math.abs(limiteNormativo(Receta.CurvaLimiteGy!, 0.2))) / FactorDeSeguridad;
  const GyDeLaElipse = SemiejeGy * Math.sqrt(Math.max(1 - (GzLimite / SemiejeGz) ** 2, 0));
  const GyDeLaCurva = Math.abs(limiteDeDiseno(Receta.CurvaLimiteGy!, DuracionReal, Semiancho)) / FactorDeSeguridad;
  return (Receta.SentidoDeGy ?? 1) * Math.max(Math.min(GyDeLaElipse, GyDeLaCurva) - Tolerancia, 0);
}

function CurvaturaDelRielParaGzYGyObjetivo(
  ObjetivoZ: number,
  ObjetivoY: number,
  Brazo: number,
  d: number,
  VelocidadCentroDeMasa: number,
  VelocidadRollBase: number,
  AceleracionRoll: number,
  AceleracionTangencial: number,
  Inclinacion: number,
): [number, number] {
  let Curvatura = 0;
  let CurvaturaArribaCarro = 0;
  let CurvaturaLateralCarro = 0;
  for (let Iteracion = 1; Iteracion <= 4; Iteracion++) {
    const VelocidadRoll = VelocidadRollBase + Inclinacion * Curvatura;
    CurvaturaArribaCarro = CurvaturaDelRielParaGzObjetivo(ObjetivoZ, 1, Brazo, d, VelocidadRoll, 0);
    const FactorJ2 = (1 - d * CurvaturaArribaCarro) ** 2 + (d * VelocidadRoll) ** 2;
    CurvaturaLateralCarro =
      (FactorJ2 * (ObjetivoY - (Brazo * AceleracionTangencial * VelocidadRoll) / (VelocidadCentroDeMasa * VelocidadCentroDeMasa)) -
        Brazo * AceleracionRoll) /
      (1 - Brazo * CurvaturaArribaCarro);
    const CurvaturaNueva = Math.hypot(CurvaturaArribaCarro, CurvaturaLateralCarro);
    if (Inclinacion === 0 || Math.abs(CurvaturaNueva - Curvatura) < 1e-10) {
      Curvatura = CurvaturaNueva;
      break;
    }
    Curvatura = CurvaturaNueva;
  }
  return [Curvatura, Math.atan2(CurvaturaLateralCarro, CurvaturaArribaCarro)];
}

/** Cuadratica del transporte inverso: kappa para un Gz objetivo, con phi' cerrado por punto fijo. */
function CurvaturaDelRielParaGzObjetivo(Objetivo: number, Coseno: number, Brazo: number, d: number, VelocidadRollBase: number, Inclinacion: number): number {
  let Curvatura = 0;
  for (let Iteracion = 1; Iteracion <= 3; Iteracion++) {
    const VelocidadRoll = VelocidadRollBase + Inclinacion * Curvatura;
    // Mismo agrupamiento que MATLAB (x^2 se evalua antes de multiplicar).
    const d2 = d * d;
    const phi2 = VelocidadRoll * VelocidadRoll;
    const a2 = -(Coseno * Coseno) * (Brazo + Objetivo * d2);
    const a1 = Coseno * (1 + 2 * Objetivo * d);
    const a0 = -(Objetivo * (1 + d2 * phi2) + Brazo * phi2);
    let CurvaturaNueva: number;
    if (Math.abs(a2) < 1e-12) {
      CurvaturaNueva = -a0 / a1;
    } else {
      const Discriminante = a1 * a1 - 4 * a2 * a0;
      if (Discriminante < 0) {
        // Objetivo inalcanzable: curvatura del maximo; el chequeo posterior lo reporta.
        CurvaturaNueva = -a1 / (2 * a2);
      } else {
        CurvaturaNueva = (2 * a0) / (-a1 - Math.sqrt(Discriminante));
      }
    }
    if (Inclinacion === 0 || Math.abs(CurvaturaNueva - Curvatura) < 1e-10) {
      Curvatura = CurvaturaNueva;
      break;
    }
    Curvatura = CurvaturaNueva;
  }
  return Curvatura;
}
