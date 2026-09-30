// Refresco limitado de los numeros durante la reproduccion. Con el carro
// andando, el nodo cambia en cada cuadro (60 Hz) y un numero que se reescribe
// sesenta veces por segundo no se puede leer. Mientras se reproduce, el HUD,
// los valores en el cursor y los graficos se refrescan a ~8 Hz; el carro y el
// marcador del 3D siguen a su frame rate. Al pausar, cada panel escribe los
// valores del instante EXACTO en que se paro, no los del ultimo refresco.
//
// Puro, sin DOM ni reloj propio (el tiempo entra como argumento): se testea
// en Node.

/** 8 Hz: el extremo lento del rango de 8 a 10 Hz, el mas legible. */
export const PERIODO_DE_REFRESCO_MS = 125;

export class LimitadorDeRefresco {
  private ultimo = -Infinity;

  constructor(private readonly periodo = PERIODO_DE_REFRESCO_MS) {}

  /** true si ya paso un periodo desde el ultimo refresco (y lo cuenta como hecho). */
  toca(ahora: number): boolean {
    if (ahora - this.ultimo < this.periodo) return false;
    this.ultimo = ahora;
    return true;
  }

  /** El proximo toca() refresca sin esperar (al arrancar la reproduccion). */
  reiniciar(): void {
    this.ultimo = -Infinity;
  }
}
