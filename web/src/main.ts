// Arranque: lee el indice de casos, carga el primero y conecta escena y paneles
// al estado. El flujo esta descrito en DISENO.md.

import { cargarIndice, cargarLayout } from './contrato/cargar';
import { MAGNITUD_INICIAL } from './contrato/magnitudes';
import { Escena } from './escena/escena';
import { Via } from './escena/via';
import { crearEstado } from './estado';
import { montarPanelDeGraficos } from './graficos/panelDeGraficos';
import { montarCriterios } from './paneles/criterios';
import { montarElementos } from './paneles/elementos';
import { montarErrores } from './paneles/errores';
import { montarLeyenda } from './paneles/leyenda';
import { montarResumenElemento, montarResumenLayout } from './paneles/resumen';
import { montarSelectorDeCaso } from './paneles/selectorDeCaso';
import { montarSelectorDeMagnitud } from './paneles/selectorDeMagnitud';
import { montarSelectorDeVista } from './paneles/selectorDeVista';

const BASE = import.meta.env.BASE_URL;
const urlDelIndice = `${BASE}golden/indice.json`;
const urlDelCaso = (caso: string) => `${BASE}golden/${encodeURIComponent(caso)}.json`;

function seccion(id: string): HTMLElement {
  const elemento = document.getElementById(id);
  if (!elemento) throw new Error(`Falta el elemento #${id} en index.html`);
  return elemento;
}

const estado = crearEstado({
  casos: [],
  caso: null,
  layout: null,
  magnitud: MAGNITUD_INICIAL,
  elemento: null,
  error: null,
  cargando: false,
  vista: 'via3d',
  pestana: 'g',
  ejeX: 'arco',
});

const escena = new Escena(seccion('vista3d'));
const via = new Via(escena.scene);

montarErrores(seccion('errores'), estado);
montarSelectorDeCaso(seccion('selectorDeCaso'), estado);
montarSelectorDeMagnitud(seccion('selectorDeMagnitud'), estado);
montarLeyenda(seccion('leyenda'), estado);
montarResumenLayout(seccion('resumenLayout'), estado);
montarElementos(seccion('elementos'), estado);
montarResumenElemento(seccion('resumenElemento'), estado);
montarCriterios(seccion('criterios'), estado);
montarSelectorDeVista(seccion('selectorDeVista'), estado);
montarPanelDeGraficos(seccion('graficos'), estado);

// El area principal muestra la via o los graficos; la escena se pausa
// mientras no se ve.
const vista3d = seccion('vista3d');
const graficos = seccion('graficos');
function aplicarVista(vista: string): void {
  vista3d.hidden = vista !== 'via3d';
  graficos.hidden = vista !== 'graficos';
  escena.activar(vista === 'via3d');
}
aplicarVista(estado.get().vista);
estado.suscribir((nuevo, anterior) => {
  if (nuevo.vista !== anterior.vista) aplicarVista(nuevo.vista);
});

// La escena reacciona al estado igual que un panel.
estado.suscribir((nuevo, anterior) => {
  if (nuevo.layout !== anterior.layout) {
    if (nuevo.layout) {
      via.construir(nuevo.layout, nuevo.magnitud, nuevo.elemento);
      escena.encuadrar(nuevo.layout.resumenLayout.boundingBox);
    }
    return;
  }
  if (!nuevo.layout) return;
  if (nuevo.magnitud !== anterior.magnitud || nuevo.elemento !== anterior.elemento) {
    via.recolorear(nuevo.magnitud, nuevo.elemento);
  }
  if (nuevo.elemento !== anterior.elemento) {
    const caja = nuevo.elemento === null ? nuevo.layout.resumenLayout.boundingBox : via.cajaDelElemento(nuevo.elemento);
    if (caja) escena.encuadrar(caja);
  }
});

// Cambio de caso: cargar y reemplazar el layout. Si falla, banner y se
// conserva el layout anterior en pantalla.
let pedidoActual = 0;
async function cargarCaso(caso: string): Promise<void> {
  const pedido = ++pedidoActual;
  estado.set({ cargando: true, error: null });
  try {
    const layout = await cargarLayout(urlDelCaso(caso));
    if (pedido !== pedidoActual) return; // el usuario ya eligio otro caso
    estado.set({ layout, elemento: null, cargando: false });
  } catch (error) {
    if (pedido !== pedidoActual) return;
    estado.set({ cargando: false, error: `${caso}: ${(error as Error).message}` });
  }
}

estado.suscribir((nuevo, anterior) => {
  if (nuevo.caso !== null && nuevo.caso !== anterior.caso) void cargarCaso(nuevo.caso);
});

async function arrancar(): Promise<void> {
  try {
    const indice = await cargarIndice(urlDelIndice);
    if (indice.casos.length === 0) throw new Error('El índice de casos está vacío: correr GenerarGoldenFiles.m.');
    const casoInicial = new URLSearchParams(location.search).get('caso');
    const caso = casoInicial && indice.casos.includes(casoInicial) ? casoInicial : indice.casos[0]!;
    estado.set({ casos: indice.casos, caso });
  } catch (error) {
    estado.set({ error: (error as Error).message });
  }
}

void arrancar();
