// Atajos de teclado de la aplicacion, escuchados en document (el foco puede
// estar en cualquier lado). Devuelve la funcion que saca el listener, para
// destruir(). La barra espaciadora del reproductor vive en reproductor.ts.
//
//   Ctrl+Enter          generar
//   Esc                 detener el calculo en curso
//   Ctrl+Z              deshacer
//   Ctrl+Shift+Z, Ctrl+Y  rehacer
//
// Deshacer con el foco en un campo de texto: el navegador tiene su propio
// deshacer de texto, y las dos cosas no pueden convivir en la misma tecla.
// Decision: si el campo con foco tiene una edicion SIN CONFIRMAR (lo que se
// tipeo todavia no llego al diseno: value !== defaultValue, porque cada
// campo iguala defaultValue a value al confirmar con change), Ctrl+Z queda
// para el navegador y revierte el texto que se esta tipeando; en cualquier
// otro caso (foco en un campo ya confirmado, en un select, en un boton o
// en ningun lado) Ctrl+Z es de la aplicacion y deshace el ultimo cambio
// del diseno. Asi tipear "0.75" y arrepentirse a mitad de camino vuelve
// el texto, y Ctrl+Z despues de confirmar con Tab o Enter deshace el
// campo entero, que es lo que se espera de "campo por campo".

export interface AccionesDeAtajos {
  generar: () => void;
  detener: () => void;
  deshacer: () => void;
  rehacer: () => void;
}

/** Ctrl en Windows/Linux, Cmd en Mac: el atajo se escribe "Ctrl+..." en los tooltips igual. */
function conControl(evento: KeyboardEvent): boolean {
  return evento.ctrlKey || evento.metaKey;
}

/** true si el foco esta en un campo de texto con algo tipeado que todavia no se confirmo. */
function editandoTexto(evento: KeyboardEvent): boolean {
  const objetivo = evento.target;
  if (objetivo instanceof HTMLTextAreaElement) return true;
  if (!(objetivo instanceof HTMLInputElement)) return false;
  if (objetivo.type !== 'text' && objetivo.type !== 'number') return false;
  return objetivo.value !== objetivo.defaultValue;
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
      return;
    }
    if (!conControl(evento)) return;
    const tecla = evento.key.toLowerCase();
    const esDeshacer = tecla === 'z' && !evento.shiftKey;
    const esRehacer = (tecla === 'z' && evento.shiftKey) || tecla === 'y';
    if (!esDeshacer && !esRehacer) return;
    if (editandoTexto(evento)) return; // el navegador revierte lo tipeado
    evento.preventDefault();
    if (esDeshacer) acciones.deshacer();
    else acciones.rehacer();
  };
  document.addEventListener('keydown', alTeclear);
  return () => document.removeEventListener('keydown', alTeclear);
}
