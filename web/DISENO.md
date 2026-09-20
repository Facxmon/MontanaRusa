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

---

# Iteración 2 (2026-09-19)

Decisiones del usuario: lo más importante eran los gráficos y los parámetros editables; sin cámara
on-board, el carro se ve desde afuera; la vía queda como línea/tubo; el port de la física se hace
porque los parámetros editables lo necesitan.

## Qué se agregó

| Pieza | Dónde | Qué hace |
|---|---|---|
| Gráficos 2D | `src/graficos/` (uPlot) | Espejo de `GraficarElemento.m`: G por eje con banda admisible, límite a 200 ms y límite aplicable nodo a nodo; jerk contra el presupuesto de onset; velocidad, aceleración tangencial y energía; roll y peralte; curvatura del riel y de la heartline contra el radio fabricable. Eje horizontal: arco, tiempo del modelo o tiempo del prototipo. Franjas con los subtramos (o los elementos, en la vista del layout). |
| Port de la física | `src/nucleo/` | Reescritura en TypeScript, archivo por archivo, del generador de MATLAB. `test/golden-port.test.ts` reconstruye los once golden y coinciden dentro del redondeo del export (6e-6 relativo). Corre en el navegador entre 0,3 y 3 s por caso. |
| Parámetros editables | `src/paneles/parametros.ts`, `diseno.ts`, `src/nucleo/worker.ts` | Pestaña "Diseño": estado inicial, secuencia de elementos y el formulario generado desde `parametros.esquema`. Cada cambio recalcula en un Web Worker y el resultado entra al visualizador como si fuera un golden. Reset a defaults y descarga del JSON del contrato. |
| Carro | `src/escena/carro.ts`, `src/paneles/reproductor.ts` | Caja con las dimensiones del carro orientada con T, L, U, recorriendo la vía en el tiempo acumulado; play/pausa, barra, velocidad de reproducción, "seguir" (centro de la órbita), HUD con t, elemento, v y G. |

## Decisiones de diseño de esta iteración

- **El visualizador no sabe de dónde viene el layout.** Un golden y un diseño calculado en el navegador
  son el mismo objeto del contrato (`nucleo/exportar.ts` es el equivalente de `LayoutAJson.m`). Eso es
  lo que el contrato prometía y lo que hace que todo el frontend siga igual.
- **El port es literal.** Mismos nombres, misma estructura, mismo orden de operaciones donde afecta el
  redondeo (potencias agrupadas como MATLAB), y primitivas numéricas con la semántica exacta de MATLAB
  (`pchip`, `gradient`, `interp1`, colon, `unique`, `sprintf`), verificadas contra valores generados
  por MATLAB (`test/fixtures/matlab-referencia.json`).
- **El formulario sale del esquema del JSON**, no de una lista en la web: si MATLAB o el port declaran
  un parámetro nuevo, aparece solo.
- **El cálculo va en un Web Worker** para que la interfaz no se congele; un pedido superado se descarta.

## Pendientes conocidos

- ~~`esquema.modo.parametros` trae solo el modo actual: al cambiar de modo el formulario muestra los
  parámetros del modo nuevo recién después del recálculo.~~ Resuelto en la fase 1: el formulario deriva
  las cuatro listas del núcleo (`ParametrosDelModo(modo)`, `DECLARACIONES_DE_ELEMENTOS`, …), que
  `parametros.test.ts` verifica idénticas al esquema de los golden.
- `MetodoDeAcoplamiento = 'Ambos'` calcula solo el método A (la comparación se imprime en MATLAB y no
  tiene lugar en la web todavía).
- La vía es un tubo único; trocha real, durmientes y estructura quedan para más adelante.
- Compartir un diseño por URL (parámetros en el hash, contrato §9) no está hecho; hoy se descarga el JSON.

---

# Fase 0 (2026-09-19): base visual y estructural

Sin funcionalidad nueva salvo el arreglo de los números; todo lo demás es la base sobre la que se
apoyan las fases siguientes (modelo, control, lectura, pulido).

## Qué cambió y por qué

| Pieza | Qué se hizo | Por qué |
|---|---|---|
| Tokens (`src/tokens.css`) | Paleta cruda (`--gris-950…050`, `--azul-400`, `--verde-500`, `--rojo-500`, `--ambar-500`, más tripletes rgb para transparencias) y tokens semánticos (`--superficie-0/1/2/3`, `--texto-1/2/3`, bordes, `--acento`, estados, gráficos, escena) definidos por tema en `:root[data-tema="oscuro"]` y `:root[data-tema="claro"]`; escalas de espaciado, radios, tipografía y movimiento. `estilos.css` no tiene ni un literal. | Sin una sola fuente de color no hay tema claro posible, y los diez `--nombre` ad hoc más los hex sueltos en JS eran dos fuentes que ya divergían. El tema claro tiene la estructura lista con valores provisorios: la fase 4 los calibra, no los inventa. |
| `src/tema.ts` | JavaScript lee los tokens con `getComputedStyle` (cacheado, con `alCambiarTema` sobre `data-tema`). `series.ts` describe colores simbólicos (`'serie1'`, `'limite'`…) y `figura.ts` los resuelve al dibujar; Three.js recibe `new THREE.Color(tema().escenaFondo)`. | `series.ts` y `colores.ts` se testean en Node y no pueden tocar el DOM; el color se resuelve en la capa que sí lo toca. Los tokens que lee JS resuelven a hex o `rgba(r, g, b, a)` porque `THREE.Color` no parsea `color-mix()`. |
| `colores.ts` | Las escalas de la vía (interpolación lineal en RGB entre paradas: viridis aproximado y azul-gris-rojo) quedan documentadas y las paradas son un parámetro nombrado (`ESCALAS_OSCURO`). | Son el único color que no sale de `tokens.css`: van a un atributo de la GPU, no al CSS. La fase 4 pasa otras paradas para el tema claro sin tocar la fórmula. |
| Tipografía | IBM Plex Sans (400/500/600) y Mono (400/500) self-hosteadas en `public/fuentes/`, subseteadas con `scripts/subsetear-fuentes.mjs` (harfbuzz en wasm, sin Python). | Offline, sin terceros, y Plex Mono tiene cifras tabulares de verdad. Plex no trae `✕ ▶ ❚ ✗`: esos caen al fallback del sistema. |
| Números | `formato.ts` pasa de 4 cifras significativas a decimales fijos declarados por magnitud (`MAGNITUDES[].decimales`, `notacion`) o por unidad (tabla para resúmenes y criterios); `tabular-nums` en todo lo que muestra números; el HUD es un `inline-grid` con un `span` por campo y columnas de ancho fijo; la leyenda de uPlot reserva `7ch` por valor y usa los decimales de la magnitud de cada figura. | `toPrecision(4)` borraba los ceros a la derecha y `1 G` convivía con `0.0002815 G`; con un solo string, cada cambio de ancho movía todo lo de la derecha. Verificado en `circuito-demolayout`: ningún span del HUD ni fila de la leyenda cambia de posición entre cuadros. |
| `montarVisualizador(raiz)` | `src/visualizador.ts` arma el DOM con `el()`, monta todo sobre un estado propio y devuelve `destruir()`. `main.ts` son dos líneas. Nada busca ids en el documento. | Lo que DISENO.md prometía ("un componente al que se le pone una portada adelante") no era cierto: `main.ts` era efectos de módulo sobre ids globales. Ahora se puede montar dentro de cualquier página y dos veces seguidas. |
| Multipágina | `index.html` es la portada (esqueleto) con `portada.css`; `visualizador.html` es la app; `vite.config.ts` con dos entradas. Meta tags OG y `public/og.png`. | La portada no tiene que pagar los ~600 kB de Three.js + uPlot. Medido: la portada carga 1.5 kB de HTML y 5.8 kB de CSS, ningún chunk JS. Un router de cliente habría arrastrado todo. |

## Invariantes nuevos

- **`tokens.css` es la única fuente de color, espaciado, radio y tipografía.** Ningún otro archivo
  (CSS o TS) tiene un literal: `grep -rE "#[0-9a-fA-F]{6}|0x[0-9a-fA-F]{6}" web/src/` no devuelve nada
  fuera de `tokens.css`. JavaScript los lee por `tema.ts`. La excepción documentada son las paradas de
  las escalas de la vía en `colores.ts`, que van a la GPU y son un parámetro nombrado.
- **`montarVisualizador(raiz)` es el único punto de entrada de la app**, y `destruir()` suelta todo lo
  global (worker, contexto WebGL, uPlot y ResizeObservers, loop de render, listener de teclado en
  `document`). `grep -r "document.getElementById" web/src/` solo encuentra `main.ts`.
- **Sitio multipágina**: la portada nunca importa nada de `src/` salvo `portada.css` (tokens y fuentes).
  Si algún día la portada necesita el visualizador, lo monta con `montarVisualizador` en un
  `import()` dinámico, no en su entrada.
- **Los números van con decimales fijos declarados**, nunca con cifras significativas, y cada
  contenedor que muestra un número que cambia le reserva el ancho (`ch`) y usa `tabular-nums`.
- **El tema se elige con `data-tema` en `<html>`**, y `color-scheme` lo sigue. Hoy está fijo en
  `oscuro`; el claro llega en la fase 4.

---

# Fase 1 (2026-09-20): parámetros por instancia y serialización única

## MATLAB como subconjunto (decisión tomada, regla dura)

El núcleo en TypeScript deja de ser un port uno a uno en un solo sentido: admite **ajustes por
instancia de elemento** (dos `Helice` con radios distintos en la misma secuencia), cosa que MATLAB, con
sus `Parametros` globales, no hace. **MATLAB no cambia.** JS es un superconjunto que se reduce
exactamente a MATLAB cuando ninguna instancia trae ajustes: `golden-port.test.ts` y `golden/` no se
tocan y tienen que seguir en verde, y un cambio en JS que los rompa está mal por definición. MATLAB
sigue siendo la referencia normativa y la memoria de cálculo para el caso de parámetros globales. Está
escrito también en `CONTRATO_VISUALIZADOR.md` §8.

## El modelo: instancias con ajustes propios

El problema era de modelo de datos, no de interfaz: `EntradaDeDiseno.secuencia` era una lista de
nombres de tipo y el cálculo le pasaba **los mismos** `Parametros` a todos los constructores, así que dos
`Helice` compartían radio, vueltas, avance y peralte, y el formulario, agrupado por tipo, no podía hacer
otra cosa que editar las dos a la vez.

```ts
interface InstanciaDeElemento { id: string; tipo: NombreDeElemento; ajustes: Partial<Parametros> }
interface EntradaDeDiseno { parametros: Parametros; posicion; tangente; arriba; velocidad; secuencia: InstanciaDeElemento[] }
```

- `ajustes` es **solo lo que la instancia pisa** sobre los globales. `calcularLayout` construye cada
  instancia con `AjustarParametros(globales, ajustes, tipo)`, el port de `AjustarParametros.m`, como
  haría un script de MATLAB elemento por elemento; no se reimplementó nada. Los `Inertes` que devuelve
  (ajustes que ni el modo ni el tipo consumen) antes se descartaban; ahora viajan al layout exportado y
  a la ficha de la instancia. `SeparacionDePatas`, que es derivado en `ParametrosPorDefecto()` pero
  parámetro declarado del loop, no recibe trato especial: gana el ajuste si viene, si no el derivado.
- `id` (`e1`, `e2`, …) es estable dentro del diseño: identifica la instancia elegida en el panel y va
  a servir para deshacer/rehacer. No viaja en la serialización (es estado de sesión, como el hash de
  la interfaz del contrato §9): al crear un diseño desde un layout o al deserializar se asignan
  secuenciales, y agregar o duplicar toma el siguiente número libre sin reutilizar uno quitado.
- Los `Parametros` del núcleo, `Layout` y `RegistroDeLayout` no cambian: los ajustes e inertes entran al
  exportador por opciones (`exportarLayout(Layout, { instancias })`), que es la única pieza que no es un
  espejo de MATLAB.

## El contrato: `1.1.0`, cambio MINOR

Cada elemento del layout puede traer dos campos **opcionales**: `ajustes` (lo que la instancia pisó, en
SI y camelCase) e `inertes` (claves de `ajustes` sin efecto). Como su ausencia significa "sin ajustes",
`cargar.ts` sigue rechazando solo MAJOR ≠ 1, los golden de `1.0.0` cargan igual y **MATLAB no emite los
campos, lo cual es válido** (`CONTRATO_VISUALIZADOR.md` §3 y §6). El exportador JS emite `1.1.0` y solo
agrega los campos cuando hay ajustes: con ajustes vacíos el objeto es byte a byte el de antes. El
validador chequea que las claves de `ajustes` existan en `defaults` y que `inertes ⊆ ajustes`.
`parametrosDesdeContrato` toma el default exacto cuando el valor del JSON coincide con él a 6 cifras
(la inversa del redondeo del export), así "diseñar a partir de este caso" reproduce el golden y no deja
treinta globales a 1e-6 del default.

## `serializar.ts`: un módulo, no tres

El guardado a archivo, la importación, el hash de la URL y el deshacer/rehacer (fase 2) necesitan lo
mismo: una representación **completa y mínima** del diseño. Si cada uno tuviera la suya, habría tres
listas de "qué es un parámetro válido", tres comparaciones con el default y tres formas de fallar en
silencio. `nucleo/serializar.ts` es la única:

- `serializarDiseno` guarda **solo lo que difiere de `ParametrosPorDefecto()`** con comparación profunda
  (vectores, caja 3×2, anulables `null`), el estado inicial y las instancias como `{t, a}`. El circuito
  de demo serializa a 247 bytes de JSON (`p = {RadioDelLoop: 0.3}`), contra 2,2 MB del layout.
- `deserializarDiseno` completa con los defaults y **rechaza con mensaje de campo + esperado**: versión
  distinta de 1, nombre inexistente en `ParametrosPorDefecto()`, tipo fuera de `CATALOGO_DE_ELEMENTOS`,
  valor de forma equivocada (la forma sale del default: número, lógico, opción, vector3, caja 3×2; `null`
  solo en los anulables).
- `aTextoCompacto` / `desdeTextoCompacto`: deflate crudo con **fflate** en base64url sin relleno, apto
  para el hash de la URL. fflate y no `CompressionStream` porque la API es sincrónica (sirve en un
  `hashchange`, en el deshacer y en los tests), `deflate-raw` nativo recién existe en Chrome 103 /
  Safari 16.4 / Node 21, y cuesta ~8 kB. La justificación completa está en la cabecera del módulo.
- Los nombres son los del núcleo (PascalCase): es un formato interno de la web, no el contrato.
- `test/serializar.test.ts` hace la ida y vuelta exacta para los once golden, por objeto y por texto.

## El panel: la secuencia es la navegación

- Cada fila de la secuencia tiene número, tipo, subir / bajar / **duplicar** / quitar y el contador
  "N ajustes"; elegir una abre su **ficha** con `DECLARACIONES_DE_ELEMENTOS[tipo]`. Cada campo dice si
  es *heredado* del global o *pisado* por la instancia, con ↺ para volver al global; editar uno lo pisa
  en el lugar, sin redibujar la ficha (así no se pierde el foco: la propiedad de `cambioPropio` de la
  iteración 2 se mantiene, y el estado del cálculo, que llega mientras se tipea, también se actualiza
  en el lugar). Duplicar copia los ajustes con id nuevo. Los inertes se muestran con el texto concreto
  ("ajustaste RadioDeLaHelice pero el elemento LoopVertical no lo consume") y un botón para quitarlos.
- Los grupos de parámetros **por tipo** desaparecen: los geométricos se editan por instancia; modo de
  curvatura, criterios de aceptación y generales siguen como globales. "Resetear a default" vuelve los
  globales y conserva los ajustes.
- Las cuatro listas salen del núcleo y no del esquema del layout, por lo que al cambiar de modo sus
  parámetros aparecen al instante (pendiente conocido de la iteración 2, resuelto). La propiedad "si el
  port declara un parámetro nuevo, aparece solo" se conserva: el núcleo es quien declara.
- `disenoDesdeLayout` es un módulo puro en `contrato/` y lee `elementos[].ajustes` si el layout los trae.

## Verificado

`npm test` (143 tests, ~12 s: la reducción a MATLAB reconstruye los once casos otra vez) y
`npm run build` en verde con `golden-port.test.ts` y `golden/` intactos; en el
navegador, dos hélices con radios 0,7 y 0,4 en la misma secuencia se ven distintas en el 3D, y al
tipear un valor y pasar con Tab el foco queda en el campo siguiente durante y después del recálculo.
