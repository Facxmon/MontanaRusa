// Bienvenida del visualizador (fase 4.7): quien entra por primera vez ve una
// via y cuarenta perillas sin saber que es. Arriba del panel de resultados
// van tres lineas de "que es esto" y tres recorridos que cargan un ejemplo y
// muestran algo concreto. Se descarta con un boton y la decision se guarda
// en localStorage; la hoja de atajos ("?") la vuelve a abrir.
//
// Los recorridos los ejecuta el visualizador (necesitan cargar casos, abrir
// un diseno y generar): aca solo se describen y se llaman.

import { borrarAlmacen, escribirAlmacen, leerAlmacen } from './almacen';
import { el } from './dom';

export const CLAVE_BIENVENIDA = 'bienvenida';

export interface Recorrido {
  clave: string;
  titulo: string;
  detalle: string;
  hacer: () => void;
}

export interface Bienvenida {
  /** La vuelve a mostrar (y olvida que se habia descartado). */
  mostrar(): void;
}

export function montarBienvenida(contenedor: HTMLElement, recorridos: Recorrido[]): Bienvenida {
  const dibujar = () => {
    contenedor.replaceChildren();
    if (leerAlmacen(CLAVE_BIENVENIDA) === 'descartada') return;
    const cerrar = () => {
      escribirAlmacen(CLAVE_BIENVENIDA, 'descartada');
      contenedor.replaceChildren();
    };
    contenedor.append(
      el(
        'section',
        { class: 'bienvenida', 'aria-labelledby': 'bienvenida-titulo' },
        el(
          'div',
          { class: 'bienvenida-cabecera' },
          el('h2', { id: 'bienvenida-titulo' }, 'Qué es esto'),
          el('button', { type: 'button', class: 'boton chico', title: 'No volver a mostrar (la tecla ? la trae de vuelta)', onClick: cerrar }, 'Entendido'),
        ),
        el(
          'p',
          { class: 'bienvenida-texto' },
          'Cada tramo de esta montaña rusa en miniatura se calcula a partir de sus parámetros y se verifica contra los límites de aceleración de ASTM F2291. ',
          'El color de la vía es la magnitud elegida, los gráficos muestran las G contra los límites, y en ',
          el('strong', {}, 'Diseño'),
          ' se cambian los parámetros y se recalcula acá mismo, en el navegador.',
        ),
        el(
          'ul',
          { class: 'bienvenida-recorridos' },
          recorridos.map((r) =>
            el(
              'li',
              {},
              el(
                'button',
                { type: 'button', class: 'recorrido', 'data-recorrido': r.clave, onClick: r.hacer },
                el('span', { class: 'recorrido-titulo' }, r.titulo),
                el('span', { class: 'recorrido-detalle' }, r.detalle),
              ),
            ),
          ),
        ),
      ),
    );
  };
  dibujar();
  return {
    mostrar() {
      borrarAlmacen(CLAVE_BIENVENIDA);
      dibujar();
    },
  };
}
