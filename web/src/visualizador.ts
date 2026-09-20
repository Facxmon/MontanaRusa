// El visualizador como componente: montarVisualizador(raiz) arma el DOM
// dentro de raiz, conecta escena, paneles y estado (flujo en DISENO.md) y
// devuelve destruir(), que suelta todo lo que toca algo global: el worker,
// el contexto WebGL, los uPlot y sus ResizeObserver, el loop de render y
// el listener de teclado en document. No busca nada por id en el
// documento: todo lo que necesita lo crea aca, asi se puede montar dentro
// de cualquier pagina (la portada, una demo) o dos veces seguidas.

import { cargarIndice, cargarLayout } from './contrato/cargar';
import { disenoDesdeLayout } from './contrato/disenoDesdeLayout';
import { MAGNITUD_INICIAL } from './contrato/magnitudes';
import { Carro } from './escena/carro';
import { Escena } from './escena/escena';
import { Via } from './escena/via';
import { crearEstado } from './estado';
import { montarPanelDeGraficos } from './graficos/panelDeGraficos';
import { ClienteDeCalculo, PedidoSuperado } from './nucleo/cliente';
import { montarCriterios } from './paneles/criterios';
import { montarDiseno } from './paneles/diseno';
import { el } from './paneles/dom';
import { montarElementos } from './paneles/elementos';
import { montarErrores } from './paneles/errores';
import { montarLeyenda } from './paneles/leyenda';
import { montarReproductor } from './paneles/reproductor';
import { montarParametros } from './paneles/parametros';
import { montarResumenElemento, montarResumenLayout } from './paneles/resumen';
import { montarSelectorDeCaso } from './paneles/selectorDeCaso';
import { montarSelectorDeMagnitud } from './paneles/selectorDeMagnitud';
import { montarSelectorDePanel } from './paneles/selectorDePanel';
import { montarSelectorDeVista } from './paneles/selectorDeVista';

const BASE = import.meta.env.BASE_URL;
const urlDelIndice = `${BASE}golden/indice.json`;
const urlDelCaso = (caso: string) => `${BASE}golden/${encodeURIComponent(caso)}.json`;

/** Los nodos del visualizador: la estructura que antes estaba en index.html. */
function armarDom() {
  const errores = el('div', { class: 'errores' });
  const selectorDeVista = el('nav', { class: 'pestanas selector-de-vista', role: 'tablist', 'aria-label': 'Vista' });
  const vista3d = el('div', { class: 'vista3d', 'aria-label': 'Vista 3D de la vía' });
  const reproductor = el('div', { class: 'reproductor', 'aria-label': 'Reproducción', hidden: true });
  const graficos = el('div', { class: 'graficos', 'aria-label': 'Gráficos', hidden: true });
  const principal = el('main', { class: 'principal' }, selectorDeVista, vista3d, reproductor, graficos);

  const selectorDeCaso = el('section');
  const selectorDePanel = el('nav', { class: 'pestanas pestanas-panel', role: 'tablist', 'aria-label': 'Panel' });
  const selectorDeMagnitud = el('section');
  const leyenda = el('section');
  const resumenLayout = el('section');
  const elementos = el('section');
  const resumenElemento = el('section');
  const criterios = el('section');
  const panelResultados = el('div', { class: 'panel-resultados' }, selectorDeMagnitud, leyenda, resumenLayout, elementos, resumenElemento, criterios);
  const diseno = el('section');
  const parametros = el('section');
  const panelDiseno = el('div', { class: 'panel-diseno', hidden: true }, diseno, parametros);
  const panel = el(
    'aside',
    { class: 'panel', 'aria-label': 'Datos del layout' },
    el(
      'header',
      { class: 'panel-cabecera' },
      el('h1', {}, 'Montaña rusa en miniatura'),
      el('p', { class: 'subtitulo' }, 'Vía generada en MATLAB, leída del contrato JSON v1'),
    ),
    selectorDeCaso,
    selectorDePanel,
    panelResultados,
    panelDiseno,
  );

  const app = el('div', { class: 'visualizador' }, errores, principal, panel);
  return {
    app,
    errores,
    selectorDeVista,
    vista3d,
    reproductor,
    graficos,
    selectorDeCaso,
    selectorDePanel,
    selectorDeMagnitud,
    leyenda,
    resumenLayout,
    elementos,
    resumenElemento,
    criterios,
    panelResultados,
    diseno,
    parametros,
    panelDiseno,
  };
}

export interface Visualizador {
  destruir(): void;
}

export function montarVisualizador(raiz: HTMLElement): Visualizador {
  const dom = armarDom();
  raiz.append(dom.app);

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
    fuente: 'golden',
    diseno: null,
    instancia: null,
    calculando: false,
    ultimoCalculoMs: null,
    panel: 'resultados',
  });

  const escena = new Escena(dom.vista3d);
  const via = new Via(escena.scene);
  const carro = new Carro(escena.scene);

  montarErrores(dom.errores, estado);
  montarSelectorDeCaso(dom.selectorDeCaso, estado);
  montarSelectorDeMagnitud(dom.selectorDeMagnitud, estado);
  montarLeyenda(dom.leyenda, estado);
  montarResumenLayout(dom.resumenLayout, estado);
  montarElementos(dom.elementos, estado);
  montarResumenElemento(dom.resumenElemento, estado);
  montarCriterios(dom.criterios, estado);
  montarSelectorDeVista(dom.selectorDeVista, estado);
  const destruirReproductor = montarReproductor(dom.reproductor, estado, escena, carro);
  const destruirGraficos = montarPanelDeGraficos(dom.graficos, estado);
  montarSelectorDePanel(dom.selectorDePanel, estado);
  montarDiseno(dom.diseno, estado, abrirDiseno);
  montarParametros(dom.parametros, estado);

  // Panel lateral: resultados o diseno.
  function aplicarPanel(panel: string): void {
    dom.panelResultados.hidden = panel !== 'resultados';
    dom.panelDiseno.hidden = panel !== 'diseno';
  }
  aplicarPanel(estado.get().panel);
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.panel !== anterior.panel) aplicarPanel(nuevo.panel);
  });

  // Diseno propio: arranca del layout cargado y se recalcula en el worker con cada cambio.
  const cliente = new ClienteDeCalculo('js');
  function abrirDiseno(): void {
    const { layout } = estado.get();
    if (!layout) return;
    const diseno = disenoDesdeLayout(layout);
    estado.set({ diseno, instancia: diseno.secuencia[0]?.id ?? null, fuente: 'diseno', caso: null, panel: 'diseno' });
  }

  let temporizador: ReturnType<typeof setTimeout> | null = null;
  function recalcular(): void {
    const { diseno } = estado.get();
    if (!diseno) return;
    estado.set({ calculando: true, error: null });
    cliente
      .calcular(diseno)
      .then(({ layout, ms }) => {
        estado.set({ layout, calculando: false, ultimoCalculoMs: ms, elemento: null });
      })
      .catch((error: Error) => {
        if (error instanceof PedidoSuperado) return;
        estado.set({ calculando: false, error: `Diseño: ${error.message}` });
      });
  }
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.fuente !== 'diseno' || !nuevo.diseno) return;
    if (nuevo.diseno === anterior.diseno && nuevo.fuente === anterior.fuente) return;
    if (temporizador) clearTimeout(temporizador);
    temporizador = setTimeout(recalcular, 400);
  });

  // El area principal muestra la via o los graficos; la escena se pausa
  // mientras no se ve.
  function aplicarVista(vista: string): void {
    dom.vista3d.hidden = vista !== 'via3d';
    dom.reproductor.style.display = vista === 'via3d' ? '' : 'none';
    dom.graficos.hidden = vista !== 'graficos';
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
  // conserva el layout anterior en pantalla. Despues de destruir(), las
  // respuestas que lleguen se descartan.
  let pedidoActual = 0;
  let destruido = false;
  async function cargarCaso(caso: string): Promise<void> {
    const pedido = ++pedidoActual;
    estado.set({ cargando: true, error: null });
    try {
      const layout = await cargarLayout(urlDelCaso(caso));
      if (destruido || pedido !== pedidoActual) return; // el usuario ya eligio otro caso
      estado.set({ layout, elemento: null, cargando: false });
    } catch (error) {
      if (destruido || pedido !== pedidoActual) return;
      estado.set({ cargando: false, error: `${caso}: ${(error as Error).message}` });
    }
  }

  estado.suscribir((nuevo, anterior) => {
    if (nuevo.caso !== null && nuevo.caso !== anterior.caso) void cargarCaso(nuevo.caso);
  });

  async function arrancar(): Promise<void> {
    try {
      const indice = await cargarIndice(urlDelIndice);
      if (destruido) return;
      if (indice.casos.length === 0) throw new Error('El índice de casos está vacío: correr GenerarGoldenFiles.m.');
      const casoInicial = new URLSearchParams(location.search).get('caso');
      const caso = casoInicial && indice.casos.includes(casoInicial) ? casoInicial : indice.casos[0]!;
      estado.set({ casos: indice.casos, caso });
    } catch (error) {
      if (destruido) return;
      estado.set({ error: (error as Error).message });
    }
  }

  void arrancar();

  return {
    destruir() {
      if (destruido) return;
      destruido = true;
      if (temporizador) clearTimeout(temporizador);
      cliente.terminar();
      destruirReproductor();
      destruirGraficos();
      carro.destruir();
      via.destruir();
      escena.destruir();
      dom.app.remove();
    },
  };
}
