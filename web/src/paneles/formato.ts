// Formato de numeros con unidad para los paneles. El contrato manda SI y
// radianes; la conversion a grados es de presentacion y vive aca.

const CIFRAS = 4;

export function formatearNumero(valor: number): string {
  if (valor === 0) return '0';
  const magnitud = Math.abs(valor);
  if (magnitud < 1e-4 || magnitud >= 1e6) {
    return Number(valor.toExponential(CIFRAS - 1)).toExponential().replace('e+0', 'e+').replace('e-0', 'e-');
  }
  return String(Number(valor.toPrecision(CIFRAS)));
}

/** Valor con su unidad; null es "sin dato"; los radianes se muestran en grados. */
export function formatear(valor: number | null | undefined, unidad: string): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—';
  if (unidad === 'rad') return `${formatearNumero((valor * 180) / Math.PI)}°`;
  if (unidad === '-' || unidad === '') return formatearNumero(valor);
  return `${formatearNumero(valor)} ${unidad}`;
}
