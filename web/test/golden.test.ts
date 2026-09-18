import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { listarCasos, textoDelIndice } from '../plugins/golden';

const CARPETA_GOLDEN = fileURLToPath(new URL('../../golden', import.meta.url));

describe('listarCasos', () => {
  it('lista los once casos del contrato, sin extension, con el circuito primero', () => {
    const casos = listarCasos(CARPETA_GOLDEN);
    expect(casos).toHaveLength(11);
    expect(casos[0]).toBe('circuito-demolayout');
    expect(casos.every((caso) => !caso.endsWith('.json'))).toBe(true);
    expect(casos.slice(1)).toEqual([...casos.slice(1)].sort((a, b) => a.localeCompare(b)));
  });

  it('el indice es JSON con la clave casos', () => {
    const indice = JSON.parse(textoDelIndice(CARPETA_GOLDEN)) as { casos: string[] };
    expect(indice.casos).toContain('loop-clotoide');
  });
});
