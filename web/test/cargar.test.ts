import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MAJOR_SOPORTADO, analizarLayout } from '../src/contrato/cargar';

const golden = (caso: string) =>
  readFileSync(fileURLToPath(new URL(`../../golden/${caso}.json`, import.meta.url)), 'utf8');

describe('analizarLayout', () => {
  it('acepta un golden file del contrato v1', () => {
    const layout = analizarLayout(golden('loop-clotoide'));
    expect(layout.meta.versionContrato.startsWith(`${MAJOR_SOPORTADO}.`)).toBe(true);
    expect(layout.elementos).toHaveLength(1);
    expect(layout.elementos[0].tipo).toBe('LoopVertical');
    expect(layout.elementos[0].nodos.x).toHaveLength(layout.elementos[0].nodos.numeroDeNodos);
  });

  it('rechaza un MAJOR distinto con un mensaje que lo nombra', () => {
    const texto = golden('loop-clotoide').replace('"versionContrato":"1.0.0"', '"versionContrato":"2.0.0"');
    expect(() => analizarLayout(texto)).toThrowError(/2\.0\.0/);
  });

  it('rechaza texto que no es JSON', () => {
    expect(() => analizarLayout('esto no es json')).toThrowError(/JSON/);
  });

  it('rechaza un documento sin meta.versionContrato', () => {
    expect(() => analizarLayout('{"elementos": []}')).toThrowError(/versionContrato/);
  });
});
