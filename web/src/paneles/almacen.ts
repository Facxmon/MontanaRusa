// localStorage con red: en ventanas privadas, con el almacenamiento
// bloqueado o lleno, leer o escribir tira; aca nunca. Las claves van con
// prefijo para no chocar con otra cosa servida en el mismo origen.

const PREFIJO = 'montanarusa.';

export function leerAlmacen(clave: string): string | null {
  try {
    return localStorage.getItem(PREFIJO + clave);
  } catch {
    return null;
  }
}

export function escribirAlmacen(clave: string, valor: string): boolean {
  try {
    localStorage.setItem(PREFIJO + clave, valor);
    return true;
  } catch {
    return false;
  }
}

export function borrarAlmacen(clave: string): void {
  try {
    localStorage.removeItem(PREFIJO + clave);
  } catch {
    // nada que borrar
  }
}
