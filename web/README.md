# Visualizador web

Sitio estático de dos páginas: la **portada** del portfolio (`index.html`, por ahora un esqueleto sin
JavaScript) y el **visualizador** (`visualizador.html`), que lee un layout en el formato de [`CONTRATO_VISUALIZADOR.md`](../CONTRATO_VISUALIZADOR.md)
y lo dibuja en 3D: riel (tubo orientado con los versores del carro), heartline, uniones d·U, color por
magnitud (Gz, Gy, velocidad, curvatura, jerk…), resumen del layout y de cada elemento, y criterios de
aceptación con semáforo. No calcula nada: todo viene del JSON. Diseño en [`DISENO.md`](DISENO.md), plan de
la v1 en [`PLAN-v1.md`](PLAN-v1.md).

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
| `index.html`, `src/portada.css` | la portada: solo tokens y tipografía, sin Three.js ni uPlot |
| `visualizador.html`, `src/main.ts`, `src/visualizador.ts` | la app: `montarVisualizador(raiz)` arma el DOM, conecta todo y devuelve `destruir()` |
| `src/tokens.css`, `src/fuentes.css`, `src/estilos.css`, `src/tema.ts` | tokens de diseño (única fuente de color), `@font-face`, estilos del visualizador, y el puente para que JavaScript lea los tokens |
| `src/contrato/` | `tipos.ts` (generado desde el esquema, no editar), `cargar.ts` (fetch + rechazo de MAJOR ≠ 1), `magnitudes.ts` (qué columnas se pueden colorear), `parametrosDesdeContrato.ts` y `disenoDesdeLayout.ts` (del JSON a un diseño editable) |
| `src/escena/` | `geometriaDeVia.ts` (tubo, heartline, uniones y colores como arrays planos, sin Three.js), `colores.ts` (escalas), `escena.ts` y `via.ts` (Three.js) |
| `src/paneles/` | DOM plano: selector de caso y de magnitud, leyenda, resumen, elementos, criterios, errores |
| `src/graficos/` | gráficos 2D con uPlot: `series.ts` (puro, qué series lleva cada figura), `figura.ts` (wrapper), `panelDeGraficos.ts` |
| `src/nucleo/` | el port de la física a TypeScript (ver `DISENO.md`, iteración 2), `calcular.ts` (un diseño: globales + instancias con ajustes), `worker.ts` y `cliente.ts` para calcular fuera del hilo de la interfaz, `exportar.ts` (el equivalente de `LayoutAJson.m`), `serializar.ts` (el diseño como texto: solo lo que difiere del default, comprimido para la URL) |
| `src/estado.ts` | estado mínimo con suscripción |
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

Contenido de la portada (presentación, video, contacto: fase 4), tema claro, compartir un diseño por
URL y guardarlo a archivo (fase 2, sobre `nucleo/serializar.ts`), trocha real y estructura en la vía,
comparación de métodos A/B en la web.
