import { describe, expect, it, vi } from 'vitest';
import { crearEstado, type DatosDeEstado } from '../src/estado';

const inicial: DatosDeEstado = {
  casos: [],
  caso: null,
  layout: null,
  magnitud: 'gz',
  elemento: null,
  error: null,
  cargando: false,
  vista: 'via3d',
  pestana: 'g',
  ejeX: 'arco',
  fuente: 'golden',
  diseno: null,
  instancia: null,
  origen: null,
  disenoCalculado: null,
  calculando: false,
  progreso: null,
  ultimoCalculoMs: null,
  autoGenerar: false,
  panel: 'resultados',
};

describe('crearEstado', () => {
  it('set mezcla y notifica con el estado nuevo y el anterior', () => {
    const estado = crearEstado(inicial);
    const suscriptor = vi.fn();
    estado.suscribir(suscriptor);
    estado.set({ magnitud: 'gy' });
    expect(estado.get().magnitud).toBe('gy');
    expect(estado.get().casos).toEqual([]);
    expect(suscriptor).toHaveBeenCalledTimes(1);
    const [nuevo, anterior] = suscriptor.mock.calls[0]!;
    expect(nuevo.magnitud).toBe('gy');
    expect(anterior.magnitud).toBe('gz');
  });

  it('cancelar la suscripcion deja de notificar', () => {
    const estado = crearEstado(inicial);
    const suscriptor = vi.fn();
    const cancelar = estado.suscribir(suscriptor);
    cancelar();
    estado.set({ elemento: 2 });
    expect(suscriptor).not.toHaveBeenCalled();
  });
});
