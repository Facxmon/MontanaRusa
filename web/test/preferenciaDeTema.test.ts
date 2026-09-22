import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CLAVE_DE_TEMA, esPreferencia, PREFERENCIA_POR_DEFECTO, temaEfectivo } from '../src/preferenciaDeTema';

describe('preferencia de tema', () => {
  it('auto sigue al sistema; claro y oscuro mandan', () => {
    expect(temaEfectivo('auto', true)).toBe('oscuro');
    expect(temaEfectivo('auto', false)).toBe('claro');
    expect(temaEfectivo('claro', true)).toBe('claro');
    expect(temaEfectivo('oscuro', false)).toBe('oscuro');
  });

  it('el default del proyecto es oscuro y solo valen los tres estados', () => {
    expect(PREFERENCIA_POR_DEFECTO).toBe('oscuro');
    expect(esPreferencia('auto')).toBe(true);
    expect(esPreferencia('dark')).toBe(false);
  });

  it('el script en linea de las dos paginas usa la misma clave y el mismo default', () => {
    for (const pagina of ['index.html', 'visualizador.html']) {
      const html = readFileSync(fileURLToPath(new URL(`../${pagina}`, import.meta.url)), 'utf8');
      expect(html, pagina).toContain(`localStorage.getItem('montanarusa.${CLAVE_DE_TEMA}')`);
      expect(html, pagina).toContain('data-tema="oscuro"');
    }
  });

  it('la escena 3D no cambia con el tema: sus tokens viven fuera de los bloques de tema', () => {
    const css = readFileSync(fileURLToPath(new URL('../src/tokens.css', import.meta.url)), 'utf8');
    const bloques = css.split(/:root\[data-tema="(?:oscuro|claro)"\]/).slice(1);
    for (const bloque of bloques) expect(bloque).not.toMatch(/--escena-/);
  });
});
