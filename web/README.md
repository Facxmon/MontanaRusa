# Visualizador web

Sitio estático de dos páginas: la **portada** del portfolio (`index.html`, sin JavaScript de la app y con
placeholders para los textos del autor) y el **visualizador** (`visualizador.html`), que lee un layout en el formato de [`CONTRATO_VISUALIZADOR.md`](../CONTRATO_VISUALIZADOR.md)
y lo dibuja en 3D: riel (tubo orientado con los versores del carro), heartline, uniones d·U, color por
magnitud (Gz, Gy, velocidad, curvatura, jerk…), resumen del layout y de cada elemento, y criterios de
aceptación con semáforo, y un **veredicto** arriba de todo con las G extremas y dónde ocurren. El layout
puede venir de un golden file de MATLAB o calcularse en el navegador con el port de la física: los
parámetros se editan con nombre humano, unidad de presentación (cm, mm, grados) y un `?` que explica cada
uno, **Generar** los calcula en un Web Worker con progreso y **Detener** corta, hay deshacer/rehacer, el
diseño se guarda a `.json`, a un paquete `.zip` (layout, parámetros, gráficos PNG, vista 3D, CSV y LEEME)
o a un link, se importa por botón o arrastrando, y se restaura solo al recargar. Los gráficos tienen zoom,
tooltip, estadística del rango y exportación propia, y el **cursor está ligado**: pasar el mouse por un
pico ilumina ese punto de la vía en 3D y un clic lleva el carro ahí. Desde la fase 4 hay tema claro (interfaz y
gráficos; el 3D queda oscuro), comparación A/B de dos diseños, una bienvenida con tres recorridos guiados,
hoja de atajos con `?` y diseño responsive hasta teléfono. Diseño en [`DISENO.md`](DISENO.md),
plan de la v1 en [`PLAN-v1.md`](PLAN-v1.md).

## Correr

```bash
cd web
npm install
npm run dev        # http://localhost:5173/MontanaRusa/ (portada) y /MontanaRusa/visualizador.html
```

Los casos que aparecen en el menú son los `../golden/*.json` (los genera `GenerarGoldenFiles.m` en
MATLAB); el plugin `plugins/golden.ts` los sirve en desarrollo y los copia en el build. Para abrir uno
directo: `visualizador.html?caso=loop-normativa`.

```bash
npm test           # vitest sobre los módulos puros, con los golden como fixtures
npm run build      # tsc --noEmit + vite build → dist/ (incluye dist/golden/)
npm run preview    # sirve dist/ en http://localhost:4173/MontanaRusa/
npm run tipos      # regenera src/contrato/tipos.ts desde ../esquema/layout-v1.schema.json
```

Las fuentes (IBM Plex Sans y Mono, self-hosteadas en `public/fuentes/`) se regeneran con
`scripts/subsetear-fuentes.mjs` (ver la cabecera del script). `public/og.png` (1200×630, la imagen de
las meta tags `og:image`) es una captura de la vista 3D de `circuito-demolayout`; si cambia el aspecto
de la vía, se vuelve a capturar.

## Estructura

| Carpeta | Qué hay |
|---|---|
| `index.html`, `src/portada.css` | la portada: solo tokens y tipografía, sin Three.js ni uPlot; en el build el CSS va dentro del HTML (`plugins/cssEnLinea.ts`) |
| `visualizador.html`, `src/main.ts`, `src/visualizador.ts` | la app: `montarVisualizador(raiz)` arma el DOM, conecta todo y devuelve `destruir()` |
| `src/tokens.css`, `src/fuentes.css`, `src/estilos.css`, `src/tema.ts`, `src/preferenciaDeTema.ts` | tokens de diseño (única fuente de color, temas oscuro y claro), `@font-face`, estilos del visualizador, el puente para que JavaScript lea los tokens y la preferencia auto / claro / oscuro |
| `src/contrato/` | `tipos.ts` (generado desde el esquema, no editar), `cargar.ts` (fetch + rechazo de MAJOR ≠ 1), `magnitudes.ts` (qué columnas se pueden colorear), `parametrosDesdeContrato.ts` y `disenoDesdeLayout.ts` (del JSON a un diseño editable), `veredicto.ts` (puro: pasa/no pasa, extremos con su ubicación y criterio peor) |
| `src/escena/` | `geometriaDeVia.ts` (tubo, heartline, uniones y colores como arrays planos, sin Three.js), `colores.ts` (escalas), `escena.ts` (renderer, cámara con vuelo, gizmo), `via.ts` y `entorno.ts` (piso con grilla rotulada, caja disponible, proyección) (Three.js) |
| `src/paneles/` | DOM plano: barra de aplicación (`barra.ts`) con deshacer/rehacer, importar, guardar y Generar/Detener; `etiquetas.ts` (cómo se muestra cada parámetro: nombre humano, unidad de presentación, rango) y `ayuda.ts` (el `?` con `popover` nativo); `veredicto.ts` y `cursor.ts`; selector de caso y de magnitud, leyenda, resumen, elementos, criterios, errores, avisos y persistencia en `localStorage` |
| `src/graficos/` | gráficos 2D con uPlot: `series.ts` (puro, qué series lleva cada figura, el índice de nodo global y la estadística de rango), `figura.ts` (wrapper con zoom, tooltip y alto configurable), `panelDeGraficos.ts` |
| `src/nucleo/` | el port de la física a TypeScript (ver `DISENO.md`, iteración 2), `calcular.ts` (un diseño: globales + instancias con ajustes), `worker.ts` y `cliente.ts` para calcular fuera del hilo de la interfaz, `exportar.ts` (el equivalente de `LayoutAJson.m`), `serializar.ts` (el diseño como texto: solo lo que difiere del default, comprimido para la URL), `importar.ts` y `descargar.ts` (los textos que se guardan: contrato, parámetros, CSV y LEEME) |
| `src/estado.ts`, `src/historial.ts`, `src/diagnostico.ts` | estado mínimo con suscripción; deshacer/rehacer del diseño (pilas con coalescencia por campo); de un error del núcleo a qué campo resaltar |
| `plugins/golden.ts` | sirve y emite `golden/` e `indice.json` |
| `test/` | vitest |

## Cuando cambia algo

- **Cambia el esquema** (`esquema/layout-v1.schema.json`): `npm run tipos`, revisar que compile, commitear `tipos.ts`.
- **Se regeneran los golden** (cambió la física): nada que hacer acá; el build los toma del disco.
- **Se agrega una columna a `nodos`**: aparece en los tipos con `npm run tipos`; para poder colorear por ella, agregarla a `MAGNITUDES` en `src/contrato/magnitudes.ts` (el compilador exige que sea una columna real).

## Deploy

`.github/workflows/pages.yml` construye y publica en GitHub Pages en cada push a `main` que toque `web/`,
`golden/` o el esquema. Una sola vez, en el repo: Settings → Pages → Source: **GitHub Actions**. La URL
queda `https://<usuario>.github.io/MontanaRusa/` (`base` en `vite.config.ts`).

## Qué hay (iteración 2)

Vía 3D coloreada por magnitud, gráficos 2D (G con bandas normativas, jerk, cinemática, roll, curvatura),
pestaña Diseño con parámetros editables que recalculan la vía en el navegador (Web Worker sobre el port
de la física), carro recorriendo la vía con play/pausa, y descarga del JSON del contrato.

Desde la fase 1 (`DISENO.md`), cada instancia de elemento de la secuencia puede pisar sus parámetros
geométricos sobre los globales (dos hélices con radios distintos): la secuencia es la navegación, la
ficha de cada instancia muestra qué hereda y qué pisa, y el layout exportado lleva `ajustes` e
`inertes` por elemento (contrato 1.1.0, campos opcionales que MATLAB no emite). Con ajustes vacíos el
resultado es idéntico al de MATLAB.

`npm test` incluye `test/golden-port.test.ts`: el port reconstruye los once golden y tienen que coincidir
dentro de 6e-6 relativo. Si cambia la física en MATLAB, se regeneran los golden y ese test dice qué hay
que portear.

## Pendiente

Los textos, el video y el contacto de la portada (placeholders marcados en `index.html`), volver a
capturar `public/og.png`, trocha real y estructura en la vía, y la comparación de métodos de acoplamiento
(`MetodoDeAcoplamiento = 'Ambos'` de MATLAB) en la web. Ver "Pendiente" en la fase 4 de `DISENO.md`.
