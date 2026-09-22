import { describe, expect, it } from 'vitest';
import { ATAJOS } from '../src/paneles/hojaDeAtajos';

describe('hoja de atajos (fase 4.9)', () => {
  it('lista los atajos de las fases 2 y 3', () => {
    const combinaciones = ATAJOS.flatMap((a) => a.teclas.map((t) => t.join('+')));
    for (const esperado of ['Ctrl+Enter', 'Esc', 'Ctrl+Z', 'Ctrl+Shift+Z', 'Espacio', '?']) expect(combinaciones).toContain(esperado);
    for (const a of ATAJOS) expect(a.que.length).toBeGreaterThan(3);
  });
});
