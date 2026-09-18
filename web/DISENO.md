# Visualizador web — diseño de la v1

Fecha: 2026-09-18. Rama `feat/visualizador-web-v1`. Aprobado en chat.

## Qué es

Una página estática que lee un layout en el formato de [`CONTRATO_VISUALIZADOR.md`](../CONTRATO_VISUALIZADOR.md)
(hoy, los `golden/*.json` que exporta MATLAB) y lo dibuja en 3D con un panel de resultados al lado. No
calcula nada: todo lo que muestra viene del JSON. Es la mitad "consumidor" del contrato, construida antes
del port de la física para que el frontend exista y esté validado cuando el port llegue.

Audiencia hoy: el propio autor, para visualizar los elementos más cómodo que en MATLAB. Mañana: pública,
con una portada de presentación y un video. La app queda como un componente en `src/` para poder ponerle
una portada adelante sin reescribirla.

## Decisiones tomadas

| Decisión | Elección | Por qué |
|---|---|---|
| Stack | Vite + TypeScript + Three.js, sin framework de UI | Tipos para el contrato (el port a TS los reusa); Three.js controlado fino para construir el tubo desde los versores. Los paneles son DOM plano generado por funciones chicas; si el panel de parámetros editable se pone pesado, se agrega Preact solo ahí. |
| Dónde vive | `web/` en este repo | Un solo repo, un solo contrato, los golden al lado. |
| Deploy | GitHub Pages por GitHub Action, `base: /MontanaRusa/` | Sitio estático sin backend. Habilitar Pages (Source: GitHub Actions) es un paso manual en Settings. |
| Datos | `golden/*.json` servidos en `/golden/` | Un plugin de Vite los sirve en dev desde `../golden` y los copia en build; genera `golden/indice.json` listando la carpeta. La lista de casos nunca se escribe a mano. |
| Tipos del contrato | Generados desde `esquema/layout-v1.schema.json` con `json-schema-to-typescript` (`npm run tipos`), commiteados | No pueden desincronizarse del esquema. |
| Alcance v1 | Vía 3D + color por magnitud + resumen + criterios | Sin animación. Play, carro y cámara on-board son la iteración 2. |
| Idioma y estilo | Castellano con la terminología del repo; tema oscuro; una sola vista | Los visores 3D se leen mejor en oscuro; la terminología es la de NOMENCLATURA.md. |

## Estructura

```
web/
  index.html  package.json  tsconfig.json  vite.config.ts  vitest.config.ts
  src/
    main.ts                arranque: lee el indice, carga el primer caso, arma escena y paneles
    estado.ts              estado minimo: caso, layout cargado, magnitud, elemento elegido; suscripcion
    contrato/
      tipos.ts             GENERADO desde el esquema (no editar a mano)
      cargar.ts            fetch + parse + rechazo de MAJOR != 1; error con mensaje claro
      magnitudes.ts        que columnas de nodos se pueden colorear: clave, etiqueta, unidad, tipo de escala
    escena/
      escena.ts            renderer, camara orbital, luces, piso con grilla, resize, encuadre por bounding box
      via.ts               tubo del riel construido desde (U, L) de cada nodo; heartline como linea;
                           uniones d*U cada N nodos; atributo de color por nodo; resaltado de un elemento
      colores.ts           escalas (secuencial y divergente), rango min/max ignorando null, leyenda
    paneles/
      selectorDeCaso.ts    <select> con los casos del indice
      selectorDeMagnitud.ts
      leyenda.ts
      resumen.ts           resumenLayout con unidades; resumen del elemento elegido (salto* destacados)
      elementos.ts         lista: tipo, nodos, Gz max, todosPasan; click = elegir
      criterios.ts         previos y posteriores del elemento elegido: semaforo, valor/limite/margen/unidad, detalle en tooltip
      errores.ts           banner rojo
    estilos.css
  test/                    vitest: colores, via (geometria sin NaN, conteos), cargar (MAJOR), con los golden como fixtures
.github/workflows/pages.yml   build + deploy a Pages en cada push a main
```

## Flujo

1. `main` lee `/golden/indice.json`, arma el selector y carga el primer caso.
2. Cambio de caso → `cargar` → `estado.layout` → `via.construir(layout, magnitud)` + todos los paneles.
3. Cambio de magnitud → solo `via.recolorear(magnitud)`: se reescribe el atributo de color, no la geometría.
4. Elegir elemento → `via.resaltar(indice)` (los demás atenuados), la cámara encuadra el elemento, y los
   paneles de resumen y criterios muestran ese elemento.
5. Cualquier fallo (fetch, JSON inválido, `versionContrato` con MAJOR distinto de 1) → banner con el
   mensaje. Nada falla en silencio.

## Geometría de la vía

- **Riel**: tubo. Para cada nodo, un anillo de vértices en el plano (U, L) alrededor de `(xRiel, yRiel, zRiel)`,
  con radio pequeño respecto de la vía. Se usan los versores del JSON, no un marco recalculado: es
  exactamente para esto que el contrato manda los tres (§1.5).
- **Heartline**: línea `(x, y, z)`, más fina, para que se vea que son dos curvas.
- **Uniones d·U**: segmento riel → heartline cada N nodos, para mostrar el offset y el roll.
- **Color**: por nodo, según la magnitud elegida. Nodos con `null` en gris. Escala secuencial para
  magnitudes positivas (velocidad, curvatura, Gz) y divergente centrada en 0 para las con signo (Gy,
  Gx, jerk, peralte). Rango: mínimo y máximo sobre todo el layout.
- El primer nodo de cada elemento repite el último del anterior (contrato §6); se descarta al concatenar.

## Fuera de la v1

Play, carro animado, cámara on-board (iteración 2: `tiempo` y los versores ya viajan). Panel de parámetros
(v1 muestra `parametros.valores` con las etiquetas del `esquema`, solo lectura; editable recién con el port).
Gráficos 2D (G contra tiempo). Portada de presentación y video. Comparación entre casos.

## Verificación

- `npm test`: vitest sobre módulos puros con los golden como fixtures.
- `npm run build`: `tsc --noEmit` + Vite. Corre en el Action.
- Manual: abrir los 11 casos en el navegador, confirmar que se ven las dos curvas, que el color cambia con
  la magnitud, que los criterios coinciden con los del JSON.
