import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analizarLayout } from '../src/contrato/cargar';
import { disenoDesdeLayout } from '../src/contrato/disenoDesdeLayout';
import { crearEstado, type DatosDeEstado } from '../src/estado';
import { elementoDeInstancia, resaltarElemento } from '../src/paneles/resaltarElemento';

const circuito = analizarLayout(readFileSync(fileURLToPath(new URL('../../golden/circuito-demolayout.json', import.meta.url)), 'utf8'));

function estadoCon(parcial: Partial<DatosDeEstado>) {
  return crearEstado({
    casos: [], caso: null, layout: circuito, magnitud: 'gz', elemento: null, error: null, diagnostico: null, cargando: false,
    vista: 'via3d', pestana: 'g', ejeX: 'arco', fuente: 'diseno', diseno: null, instancia: null, origen: null, disenoCalculado: null,
    calculando: false, progreso: null, ultimoCalculoMs: null, autoGenerar: false, panel: 'diseno', nodo: null, reproduciendo: false, carro: null, carroAnalizado: null, comparacion: null,
    ...parcial,
  });
}

describe('resaltarElemento', () => {
  it('elige el elemento (lo que dispara el resaltado y el encuadre) y null vuelve al layout entero', () => {
    const estado = estadoCon({});
    resaltarElemento(estado, 2);
    expect(estado.get().elemento).toBe(2);
    resaltarElemento(estado, null);
    expect(estado.get().elemento).toBeNull();
  });

  it('ignora un indice que el layout en pantalla no tiene', () => {
    const estado = estadoCon({ elemento: 1 });
    resaltarElemento(estado, circuito.elementos.length);
    expect(estado.get().elemento).toBe(1);
  });
});

describe('elementoDeInstancia', () => {
  const diseno = disenoDesdeLayout(circuito);

  it('la fila de la secuencia es el elemento del layout calculado con ese diseno', () => {
    diseno.secuencia.forEach((inst, i) => expect(elementoDeInstancia(diseno, inst.id)).toBe(i));
  });

  it('una instancia que el layout en pantalla no tiene (sin generar, o sin diseno calculado) no resalta nada', () => {
    expect(elementoDeInstancia(diseno, 'no-existe')).toBeNull();
    expect(elementoDeInstancia(null, diseno.secuencia[0]!.id)).toBeNull();
  });
});
