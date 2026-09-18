# Visualizador web v1 — plan de implementación

**Objetivo:** una página estática que carga cualquier `golden/*.json` del contrato y muestra la vía en 3D
coloreada por magnitud, con resumen y criterios al lado.

**Arquitectura:** Vite + TypeScript. Módulos puros (`contrato/`, `escena/geometriaDeVia.ts`,
`escena/colores.ts`) sin dependencia de Three.js ni del DOM, testeados con vitest usando los golden como
fixtures; una capa fina de Three.js (`escena/via.ts`, `escena/escena.ts`) y paneles DOM (`paneles/`).
Estado mínimo con suscripción (`estado.ts`). Sin framework de UI.

**Stack:** vite, typescript, three, vitest, json-schema-to-typescript (dev). Node 22.

**Spec:** [`DISENO.md`](DISENO.md).

## Restricciones globales

- Nada se calcula: todo lo que se muestra viene del JSON. Unidades SI y radianes en los datos; la
  conversión a grados es de presentación y se hace en el panel.
- `versionContrato` con MAJOR ≠ 1 se rechaza con mensaje.
- Ninguna lista de casos ni de tipos escrita a mano: casos desde el disco (plugin de Vite), tipos
  generados desde `esquema/layout-v1.schema.json`.
- Código y comentarios en castellano sin tildes (convención del repo para código); textos de la UI con
  tildes.
- `null` en un nodo = sin dato: gris, nunca un NaN en un buffer de la GPU.

## Tareas

### Tarea 1: andamiaje de `web/` y plugin de golden files
- Crear: `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/index.html`,
  `web/src/main.ts` (provisorio), `web/src/estilos.css`, `web/vitest.config.ts`, `web/plugins/golden.ts`,
  `web/test/golden.test.ts`. Modificar: `.gitignore` (`web/node_modules/`, `web/dist/`).
- Interfaz: `listarCasos(carpeta: string): string[]` en `plugins/golden.ts` — nombres sin extensión,
  `circuito-*` primero y después alfabético. El plugin sirve `/golden/indice.json`
  (`{"casos": [...]}`) y `/golden/<caso>.json` en dev y los emite en build.
- Test: `listarCasos` sobre `../golden` devuelve 11 nombres, `circuito-demolayout` primero, sin `.json`.
- Verificación: `npm run dev` levanta, `/MontanaRusa/golden/indice.json` responde.
- Commit: "Visualizador: andamiaje Vite + TS y plugin que sirve los golden files".

### Tarea 2: tipos del contrato y carga
- Crear: `web/scripts/generar-tipos.mjs`, `web/src/contrato/tipos.ts` (generado), `web/src/contrato/cargar.ts`,
  `web/test/cargar.test.ts`.
- Interfaz: `analizarLayout(texto: string): Layout` (lanza `Error` con mensaje en castellano si el JSON es
  inválido, si falta `meta.versionContrato` o si su MAJOR ≠ `MAJOR_SOPORTADO`);
  `cargarLayout(url: string): Promise<Layout>` (fetch + `analizarLayout`); `MAJOR_SOPORTADO = 1`.
- Test: acepta `golden/loop-clotoide.json`; rechaza `versionContrato: "2.0.0"` con mensaje que incluye
  "2"; rechaza texto no JSON.
- Commit: "Visualizador: tipos generados desde el esquema y carga con rechazo de MAJOR".

### Tarea 3: magnitudes y colores
- Crear: `web/src/contrato/magnitudes.ts`, `web/src/escena/colores.ts`, `web/test/colores.test.ts`.
- Interfaz: `MAGNITUDES: Magnitud[]` con `{ clave, etiqueta, unidad, escala: 'secuencial' | 'divergente' }`,
  `magnitudPorClave(clave)`. `rangoDeMagnitud(layout, clave): Rango` (`{ minimo, maximo }`, ignora `null`;
  divergente → simétrico alrededor de 0). `colorDe(valor: number | null, rango, escala): [r, g, b]` en 0..1
  (`null` → `GRIS`). `paradasDeLeyenda(rango, cantidad): number[]`.
- Test: rango de `gz` en el loop es finito y `maximo > minimo`; `colorDe(null)` es gris; el color en el
  mínimo y el máximo son los extremos de la escala; la divergente es simétrica.
- Commit: "Visualizador: magnitudes coloreables y escalas de color".

### Tarea 4: geometría pura de la vía
- Crear: `web/src/escena/geometriaDeVia.ts`, `web/test/geometriaDeVia.test.ts`.
- Interfaz: `aplanarNodos(layout): NodosAplanados` (`{ cantidad, riel, heartline, u, l, elemento, indiceLocal }`,
  descarta el primer nodo de cada elemento salvo el primero); `tubo(nodos, radio, lados): Tubo`
  (`{ posiciones, normales, indices, nodoDeVertice }`); `uniones(nodos, cadaN): Float32Array` (pares de
  puntos riel → heartline); `valoresPorNodo(layout, nodos, clave): Float64Array` (NaN donde `null`);
  `coloresPorVertice(valores, nodoDeVertice, rango, escala, atenuar?: (nodo) => boolean): Float32Array`.
- Test: sobre `circuito-demolayout`: `cantidad = 6880 - 3`; ningún NaN en posiciones/normales; índices
  dentro de rango; `tubo` tiene `cantidad * lados` vértices; los colores no tienen NaN aunque haya `null`.
- Commit: "Visualizador: geometria de la via desde los versores del contrato".

### Tarea 5: escena Three.js y vía
- Crear: `web/src/escena/escena.ts`, `web/src/escena/via.ts`.
- Interfaz: `class Escena { constructor(contenedor: HTMLElement); readonly scene; encuadrar(bbox): void; }`
  (cámara perspectiva con `up = z`, OrbitControls, luces, grilla en z = 0, resize, loop de render).
  `class Via { constructor(scene); construir(layout, clave, elementoResaltado): void; recolorear(clave,
  elementoResaltado): void; }` (tubo del riel con colores por vértice, heartline como línea coloreada,
  uniones d·U cada 25 nodos).
- Verificación: manual en el navegador (Tarea 8).
- Commit: "Visualizador: escena y via en Three.js".

### Tarea 6: estado
- Crear: `web/src/estado.ts`, `web/test/estado.test.ts`.
- Interfaz: `crearEstado(inicial): Estado` con `get()`, `set(parcial)`, `suscribir(fn): () => void`.
  `DatosDeEstado = { casos: string[]; caso: string | null; layout: Layout | null; magnitud: ClaveDeMagnitud;
  elemento: number | null; error: string | null }`.
- Test: `set` notifica a los suscriptores con el estado nuevo; cancelar la suscripción deja de notificar.
- Commit: "Visualizador: estado minimo con suscripcion".

### Tarea 7: paneles
- Crear: `web/src/paneles/dom.ts` (helper `el(tag, atributos, hijos)`), `selectorDeCaso.ts`,
  `selectorDeMagnitud.ts`, `leyenda.ts`, `resumen.ts`, `elementos.ts`, `criterios.ts`, `errores.ts`,
  `web/src/paneles/formato.ts` (`formatear(valor, unidad)`: 4 cifras significativas, rad → grados con
  sufijo, `null` → "—"), `web/test/formato.test.ts`.
- Interfaz: cada panel exporta `montarX(contenedor: HTMLElement, estado: Estado): void` y se suscribe.
- Test: `formatear(3.14159, 'rad')` → "180.0°"; `formatear(null, 'm')` → "—"; `formatear(0.0012345, 'm')`
  → "0.001235 m".
- Commit: "Visualizador: paneles de caso, magnitud, leyenda, resumen, elementos y criterios".

### Tarea 8: arranque, layout de pantalla y verificación en navegador
- Modificar: `web/src/main.ts`, `web/index.html`, `web/src/estilos.css`.
- Flujo: leer índice → estado.casos → cargar primer caso → escena + via + paneles. Cambio de caso →
  cargar → construir; cambio de magnitud → recolorear; elección de elemento → recolorear + encuadrar.
- Verificación: abrir los 11 casos, cambiar magnitud, elegir elementos, provocar un error (caso
  inexistente) y ver el banner.
- Commit: "Visualizador: arranque y flujo completo".

### Tarea 9: deploy y documentación
- Crear: `.github/workflows/pages.yml`. Modificar: `README.md` (sección del visualizador),
  `web/README.md` (cómo correr, cómo regenerar tipos, cómo agregar un caso).
- Verificación: `npm run build` local produce `dist/` con `golden/` adentro.
- Commit: "Visualizador: deploy a GitHub Pages y documentacion".
