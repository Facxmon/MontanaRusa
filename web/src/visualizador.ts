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
import { diagnosticar } from './diagnostico';
import { crearEstado } from './estado';
import { Historial, type EntradaDeHistorial } from './historial';
import { montarPanelDeGraficos } from './graficos/panelDeGraficos';
import type { EntradaDeDiseno } from './nucleo/calcular';
import { CalculoAbortado, ClienteDeCalculo, ErrorDeCalculo, PedidoSuperado } from './nucleo/cliente';
import { deserializarDiseno, desdeTextoCompacto } from './nucleo/serializar';
import { montarAtajos } from './paneles/atajos';
import { montarAviso } from './paneles/aviso';
import { montarCriterios } from './paneles/criterios';
import { montarValoresDelCursor } from './paneles/cursor';
import { montarDeshacer } from './paneles/deshacer';
import { montarDiseno } from './paneles/diseno';
import { el } from './paneles/dom';
import { montarElementos } from './paneles/elementos';
import { montarBarra } from './paneles/barra';
import { montarErrores } from './paneles/errores';
import { leerAutoGenerar, montarGenerar } from './paneles/generar';
import { guardadorDeDiseno, haceCuanto, olvidarDiseno, restaurarDiseno } from './paneles/persistencia';
import { montarGuardar } from './paneles/guardar';
import { montarImportar } from './paneles/importar';
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
  // La barra de aplicacion cruza todo el ancho: archivo a la izquierda, la
  // vista en el centro, generar a la derecha (cada grupo lo monta su modulo).
  const barra = el('header', { class: 'barra', role: 'toolbar', 'aria-label': 'Barra de aplicación' });
  const selectorDeVista = el('nav', { class: 'pestanas selector-de-vista', role: 'tablist', 'aria-label': 'Vista' });
  const reproductor = el('div', { class: 'reproductor', 'aria-label': 'Reproducción', hidden: true });
  // El reproductor va DENTRO de la vista 3D y no al lado: con las dos vistas
  // partiendo el area, flotando sobre .principal quedaria sobre los graficos.
  const vista3d = el('div', { class: 'vista3d', 'aria-label': 'Vista 3D de la vía' }, reproductor);
  const graficos = el('div', { class: 'graficos', 'aria-label': 'Gráficos', hidden: true });
  const aviso = el('div', { class: 'aviso', role: 'status', hidden: true });
  const principal = el('main', { class: 'principal' }, vista3d, graficos, aviso);

  const selectorDeCaso = el('section');
  const selectorDePanel = el('nav', { class: 'pestanas pestanas-panel', role: 'tablist', 'aria-label': 'Panel' });
  const selectorDeMagnitud = el('section');
  const leyenda = el('section');
  const resumenLayout = el('section');
  const elementos = el('section');
  const resumenElemento = el('section');
  const criterios = el('section');
  const valoresDelCursor = el('section');
  const panelResultados = el('div', { class: 'panel-resultados' }, selectorDeMagnitud, leyenda, resumenLayout, valoresDelCursor, elementos, resumenElemento, criterios);
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

  const app = el('div', { class: 'visualizador' }, errores, barra, principal, panel);
  return {
    app,
    errores,
    barra,
    principal,
    aviso,
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
    valoresDelCursor,
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
    diagnostico: null,
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
    autoGenerar: leerAutoGenerar(),
    panel: 'resultados',
    nodo: null,
  });

  const escena = new Escena(dom.vista3d);
  const via = new Via(escena.scene);
  const carro = new Carro(escena.scene);

  const zonas = montarBarra(dom.barra);
  zonas.centro.append(dom.selectorDeVista);
  const aviso = montarAviso(dom.aviso);

  montarErrores(dom.errores, estado);
  montarSelectorDeCaso(dom.selectorDeCaso, estado);
  montarSelectorDeMagnitud(dom.selectorDeMagnitud, estado);
  montarLeyenda(dom.leyenda, estado);
  montarResumenLayout(dom.resumenLayout, estado);
  montarElementos(dom.elementos, estado);
  montarResumenElemento(dom.resumenElemento, estado);
  montarCriterios(dom.criterios, estado);
  montarValoresDelCursor(dom.valoresDelCursor, estado);
  montarSelectorDeVista(dom.selectorDeVista, estado);
  // Cursor ligado (fase 3.6): el indice de nodo global es el estado
  // compartido. Un clic en un grafico lleva el reproductor a ese instante; el
  // reproductor publica el nodo por el que va y los graficos lo siguen.
  const reproductor = montarReproductor(dom.reproductor, estado, escena, carro);
  const destruirGraficos = montarPanelDeGraficos(dom.graficos, estado, (nodo) => reproductor.irANodo(nodo));
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

  // Diseno propio: arranca del layout cargado. El calculo es explicito
  // (Generar); "auto-generar" restaura el recalculo con debounce por edicion.
  const cliente = new ClienteDeCalculo('js');
  function abrirDiseno(): void {
    const { layout } = estado.get();
    if (!layout) return;
    const diseno = disenoDesdeLayout(layout);
    // El layout en pantalla ya es el de este diseno: Generar arranca sin cambios pendientes.
    estado.set({ diseno, disenoCalculado: diseno, instancia: diseno.secuencia[0]?.id ?? null, origen: estado.get().caso, fuente: 'diseno', caso: null, panel: 'diseno' });
  }
  /** Un diseno que llega de afuera (link, archivo): se abre como borrador y se calcula enseguida. */
  function abrirDisenoExterno(diseno: EntradaDeDiseno, origen: string): void {
    estado.set({ diseno, disenoCalculado: null, instancia: diseno.secuencia[0]?.id ?? null, origen, fuente: 'diseno', caso: null, panel: 'diseno', error: null });
    generar();
  }

  // Cada Generar lleva un numero: la promesa de un pedido viejo (superado o
  // detenido para arrancar este) no toca el estado cuando se resuelve.
  let pedidoDeCalculo = 0;
  function generar(): void {
    const { diseno, disenoCalculado, calculando } = estado.get();
    if (!diseno || diseno === disenoCalculado) return;
    if (calculando) cliente.abortar(); // el worker estaba ocupado con el diseno anterior: no vale la pena esperarlo
    const pedido = ++pedidoDeCalculo;
    estado.set({ calculando: true, progreso: { hecho: 0, total: diseno.secuencia.length, tipo: '' }, error: null, diagnostico: null });
    cliente
      .calcular(diseno, (progreso) => {
        if (pedido === pedidoDeCalculo) estado.set({ progreso });
      })
      .then(({ layout, ms }) => {
        if (pedido !== pedidoDeCalculo || destruido) return;
        estado.set({ layout, disenoCalculado: diseno, calculando: false, progreso: null, ultimoCalculoMs: ms, elemento: null, nodo: null });
      })
      .catch((error: Error) => {
        if (pedido !== pedidoDeCalculo || destruido) return;
        // Superado o detenido: estado.layout no se toca, sigue el ultimo completo.
        if (error instanceof PedidoSuperado || error instanceof CalculoAbortado) {
          estado.set({ calculando: false, progreso: null });
          return;
        }
        // El elemento que fallo (si se sabe) y los parametros que nombra el
        // mensaje se resaltan en el formulario, ademas del banner.
        const instancia = error instanceof ErrorDeCalculo && error.elemento !== null ? diseno.secuencia[error.elemento]?.id ?? null : null;
        estado.set({ calculando: false, progreso: null, error: `Diseño: ${error.message}`, diagnostico: diagnosticar(error.message, instancia) });
      });
  }
  function detener(): void {
    if (!estado.get().calculando) return;
    cliente.abortar();
  }

  let temporizador: ReturnType<typeof setTimeout> | null = null;
  estado.suscribir((nuevo, anterior) => {
    if (!nuevo.autoGenerar || nuevo.fuente !== 'diseno' || !nuevo.diseno) return;
    if (nuevo.diseno === anterior.diseno && nuevo.autoGenerar === anterior.autoGenerar) return;
    if (temporizador) clearTimeout(temporizador);
    temporizador = setTimeout(generar, 400);
  });

  // Deshacer / rehacer: el historial guarda solo disenos y se alimenta de
  // cada cambio de estado.diseno que no venga de el mismo. Abrir o cerrar un
  // diseno (null <-> diseno) arranca un historial nuevo. Opera sobre el
  // borrador: despues de deshacer, Generar vuelve a marcar cambios
  // pendientes y no se recalcula solo.
  const historial = new Historial();
  let aplicandoHistorial = false;
  const botonesDeHistorial = montarDeshacer(zonas.izquierda, historial, { deshacer, rehacer });
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.diseno === anterior.diseno || aplicandoHistorial) return;
    if (!nuevo.diseno || !anterior.diseno) historial.vaciar();
    else historial.registrar(anterior.diseno, nuevo.diseno);
    botonesDeHistorial.actualizar();
  });
  function aplicarPaso(entrada: EntradaDeHistorial | null): void {
    if (!entrada) return;
    const { instancia } = estado.get();
    // Se elige la instancia del cambio (si sigue existiendo) para que se vea el campo volver.
    const elegida = entrada.instancia && entrada.diseno.secuencia.some((i) => i.id === entrada.instancia) ? entrada.instancia : instancia;
    aplicandoHistorial = true;
    estado.set({ diseno: entrada.diseno, instancia: elegida, panel: 'diseno' });
    aplicandoHistorial = false;
    botonesDeHistorial.actualizar();
  }
  function deshacer(): void {
    const { diseno } = estado.get();
    if (diseno) aplicarPaso(historial.deshacer(diseno));
  }
  function rehacer(): void {
    const { diseno } = estado.get();
    if (diseno) aplicarPaso(historial.rehacer(diseno));
  }

  zonas.izquierda.append(el('span', { class: 'barra-separador', 'aria-hidden': 'true' }));
  const destruirImportar = montarImportar(zonas.izquierda, dom.app, estado, (importado, nombre) => {
    abrirDisenoExterno(importado.diseno, nombre);
    aviso.mostrar(importado.formato === 'layout' ? `${nombre}: layout del contrato, se reconstruyó el diseño y se está calculando.` : `${nombre}: diseño importado, calculando.`);
  });
  const destruirGuardar = montarGuardar(zonas.izquierda, estado, { escena, aviso });
  // El diseno se guarda en localStorage (debounce de 1 s) en cada cambio.
  const guardador = guardadorDeDiseno();
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.diseno && nuevo.diseno !== anterior.diseno) guardador.guardar(nuevo.diseno, nuevo.origen);
  });

  montarGenerar(zonas.derecha, estado, { generar, detener });
  const destruirAtajos = montarAtajos({ generar, detener, deshacer, rehacer });

  // Mientras calcula, el layout viejo sigue visible, atenuado, en vez de blanquearse.
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.calculando !== anterior.calculando) dom.principal.classList.toggle('calculando', nuevo.calculando);
  });

  // El area principal muestra la via o los graficos; la escena se pausa
  // mientras no se ve.
  function aplicarVista(vista: string): void {
    const con3d = vista !== 'graficos';
    const conGraficos = vista !== 'via3d';
    dom.vista3d.hidden = !con3d;
    dom.graficos.hidden = !conGraficos;
    dom.principal.classList.toggle('partido', vista === 'ambos');
    escena.activar(con3d);
  }
  aplicarVista(estado.get().vista);
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.vista !== anterior.vista) aplicarVista(nuevo.vista);
  });

  // El marcador del nodo bajo el cursor se mueve en el requestAnimationFrame
  // de la escena y no en cada evento de mouse: via.marcarNodo solo anota.
  const sacarMarcadorDelCuadro = escena.enCadaCuadro(() => via.actualizarMarcador());
  estado.suscribir((nuevo, anterior) => {
    if (nuevo.nodo !== anterior.nodo) via.marcarNodo(nuevo.nodo);
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
      estado.set({ layout, elemento: null, cargando: false, nodo: null });
    } catch (error) {
      if (destruido || pedido !== pedidoActual) return;
      estado.set({ cargando: false, error: `${caso}: ${(error as Error).message}` });
    }
  }

  estado.suscribir((nuevo, anterior) => {
    if (nuevo.caso !== null && nuevo.caso !== anterior.caso) void cargarCaso(nuevo.caso);
  });

  // Un diseno en el hash de la URL (#d=..., lo que arma "Copiar link"). Se
  // abre y se saca el hash con replaceState: si no, al editar y recargar
  // volveria a abrirse el del link y no el ultimo borrador.
  function abrirDesdeElHash(): boolean {
    const hash = location.hash;
    if (!hash.startsWith('#d=')) return false;
    try {
      const diseno = deserializarDiseno(desdeTextoCompacto(hash.slice(3)));
      history.replaceState(null, '', location.pathname + location.search);
      abrirDisenoExterno(diseno, 'link');
      return true;
    } catch (error) {
      estado.set({ error: `El link no se pudo abrir: ${(error as Error).message}` });
      return false;
    }
  }
  const alCambiarElHash = () => void abrirDesdeElHash();
  window.addEventListener('hashchange', alCambiarElHash);

  /** Restaura el ultimo diseno de localStorage, con un aviso para descartarlo y volver al golden. */
  function restaurar(casoPorDefecto: string): boolean {
    const guardado = restaurarDiseno();
    if (!guardado) return false;
    abrirDisenoExterno(guardado.diseno, guardado.origen ?? 'restaurado');
    aviso.mostrar(`Se restauró tu último diseño${haceCuanto(guardado.fecha)}.`, {
      etiqueta: 'Descartar',
      alHacer: () => {
        olvidarDiseno();
        guardador.cancelar();
        estado.set({ diseno: null, disenoCalculado: null, instancia: null, origen: null, fuente: 'golden', panel: 'resultados', error: null, diagnostico: null, caso: casoPorDefecto });
      },
    }, 12000);
    return true;
  }

  // Precedencia al arrancar: hash de la URL > ?caso= > localStorage > primer golden del indice.
  async function arrancar(): Promise<void> {
    try {
      const indice = await cargarIndice(urlDelIndice);
      if (destruido) return;
      if (indice.casos.length === 0) throw new Error('El índice de casos está vacío: correr GenerarGoldenFiles.m.');
      estado.set({ casos: indice.casos });
      if (abrirDesdeElHash()) return;
      const pedido = new URLSearchParams(location.search).get('caso');
      const casoPedido = pedido && indice.casos.includes(pedido) ? pedido : null;
      if (!casoPedido && restaurar(indice.casos[0]!)) return;
      estado.set({ caso: casoPedido ?? indice.casos[0]! });
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
      guardador.cancelar();
      window.removeEventListener('hashchange', alCambiarElHash);
      destruirAtajos();
      sacarMarcadorDelCuadro();
      destruirImportar();
      destruirGuardar();
      cliente.terminar();
      reproductor.destruir();
      destruirGraficos();
      carro.destruir();
      via.destruir();
      escena.destruir();
      dom.app.remove();
    },
  };
}
