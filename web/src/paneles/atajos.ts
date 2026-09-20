// Atajos de teclado de la aplicacion, escuchados en document (el foco puede
// estar en cualquier lado). Devuelve la funcion que saca el listener, para
// destruir(). La barra espaciadora del reproductor vive en reproductor.ts.
//
//   Ctrl+Enter  generar
//   Esc         detener el calculo en curso

export interface AccionesDeAtajos {
  generar: () => void;
  detener: () => void;
}

/** Ctrl en Windows/Linux, Cmd en Mac: el atajo se escribe "Ctrl+..." en los tooltips igual. */
function conControl(evento: KeyboardEvent): boolean {
  return evento.ctrlKey || evento.metaKey;
}

export function montarAtajos(acciones: AccionesDeAtajos): () => void {
  const alTeclear = (evento: KeyboardEvent) => {
    if (evento.key === 'Enter' && conControl(evento)) {
      evento.preventDefault();
      acciones.generar();
      return;
    }
    if (evento.key === 'Escape') {
      // Sin preventDefault: si hay un menu abierto o un campo con foco, Esc sigue haciendo lo suyo.
      acciones.detener();
    }
  };
  document.addEventListener('keydown', alTeclear);
  return () => document.removeEventListener('keydown', alTeclear);
}
