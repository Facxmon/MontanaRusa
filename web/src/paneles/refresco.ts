// Refresco limitado de los numeros durante la reproduccion. Con el carro
// andando, el nodo cambia en cada cuadro (60 Hz) y un numero que se reescribe
// sesenta veces por segundo no se puede leer. Mientras se reproduce, el HUD,
// los valores en el cursor y los graficos se refrescan a ~12 Hz; el tiempo del HUD, el carro y el
// marcador del 3D siguen a su frame rate. Al pausar, cada panel escribe los
// valores del instante EXACTO en que se paro, no los del ultimo refresco.
//
// Puro, sin DOM ni reloj propio (el tiempo entra como argumento): se testea
// en Node.

/** 12 Hz: un poco mas vivo que los 8 Hz iniciales y todavia legible. */
export const PERIODO_DE_REFRESCO_MS = 80;

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
