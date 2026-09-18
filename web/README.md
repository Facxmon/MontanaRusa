# Visualizador web

Página estática que lee un layout en el formato de [`CONTRATO_VISUALIZADOR.md`](../CONTRATO_VISUALIZADOR.md)
y lo dibuja en 3D: riel (tubo orientado con los versores del carro), heartline, uniones d·U, color por
magnitud (Gz, Gy, velocidad, curvatura, jerk…), resumen del layout y de cada elemento, y criterios de
aceptación con semáforo. No calcula nada: todo viene del JSON. Diseño en [`DISENO.md`](DISENO.md), plan de
la v1 en [`PLAN-v1.md`](PLAN-v1.md).

## Correr

```bash
cd web
npm install
npm run dev        # http://localhost:5173/MontanaRusa/
```

Los casos que aparecen en el menú son los `../golden/*.json` (los genera `GenerarGoldenFiles.m` en
MATLAB); el plugin `plugins/golden.ts` los sirve en desarrollo y los copia en el build. Para abrir uno
directo: `?caso=loop-normativa`.

```bash
npm test           # vitest sobre los módulos puros, con los golden como fixtures
npm run build      # tsc --noEmit + vite build → dist/ (incluye dist/golden/)
npm run preview    # sirve dist/ en http://localhost:4173/MontanaRusa/
npm run tipos      # regenera src/contrato/tipos.ts desde ../esquema/layout-v1.schema.json
```

## Estructura

| Carpeta | Qué hay |
|---|---|
| `src/contrato/` | `tipos.ts` (generado desde el esquema, no editar), `cargar.ts` (fetch + rechazo de MAJOR ≠ 1), `magnitudes.ts` (qué columnas se pueden colorear) |
| `src/escena/` | `geometriaDeVia.ts` (tubo, heartline, uniones y colores como arrays planos, sin Three.js), `colores.ts` (escalas), `escena.ts` y `via.ts` (Three.js) |
| `src/paneles/` | DOM plano: selector de caso y de magnitud, leyenda, resumen, elementos, criterios, errores |
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

## Fuera de la v1

Play con el carro animado y cámara on-board (los datos ya viajan: `tiempo` y los versores), panel de
parámetros editable (necesita el port de la física a `src/nucleo/`), gráficos 2D, portada de presentación.
