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

---

# Fase 2 (2026-09-22): control — barra, Generar/Detener, deshacer, guardar, importar

## La barra de aplicación

Una barra que cruza todo el ancho, arriba de todo, en tres zonas: **archivo y edición** a la izquierda
(deshacer, rehacer, importar, `.json` y el menú Guardar), el **selector de vista** en el centro y
**Generar / Detener** a la derecha. `.visualizador` pasa de una fila de `100vh` a una fila de barra de
altura fija más una de contenido. Las pestañas "Vía 3D / Gráficos" estaban flotando en
`position: absolute` sobre el área principal, justo donde iban los botones de archivo: se mudaron al
centro de la barra, que era la forma de resolver el choque sin apilar dos barras. El banner de errores
baja debajo de la barra.

Los iconos son SVG en línea con `currentColor` (no hay librería de iconos y Plex no trae glifos de
flechas); todo botón con icono lleva `aria-label` y un `title` que incluye el atajo de teclado.

## El cálculo es explícito

Antes, cada edición programaba un recálculo con 400 ms de debounce: editar cinco campos eran hasta cinco
cálculos de entre 0,3 y 3 s, y en el medio la pantalla mostraba layouts de estados a medio escribir. Ahora:

- `estado.disenoCalculado` es **el diseño al que corresponde el layout en pantalla**. Generar está
  habilitado cuando `diseno !== disenoCalculado`, y con cambios pendientes muestra un punto de acento.
- Mientras calcula, el botón pasa a **Detener** con progreso determinado: `calcularLayout` recibe un
  `alAvanzar?` **opcional** (así los tests existentes no cambian) que se llama después de cada elemento,
  el worker postea `{ id, progreso }` además de la respuesta final y `ClienteDeCalculo` expone el
  callback, conservando el descarte por `id` y `PedidoSuperado`.
- **Al abortar no se toca `estado.layout`**: en pantalla queda el último layout completo, nunca uno a
  medias. Mientras calcula se ve atenuado (opacidad 0,6) en vez de blanquearse.
- Atajos `Ctrl+Enter` y `Esc`; casilla **auto-generar** que restaura el debounce de antes, apagada por
  defecto y persistida en `localStorage`.

### Por qué Detener es `terminate()` y no otra cosa

`ClienteDeCalculo.abortar()` hace `worker.terminate()` y crea un worker nuevo. **No revertir esto sin leer
lo que sigue.** Un Web Worker no se puede interrumpir de forma cooperativa salvo que el núcleo chequee una
bandera en cada iteración de sus loops, lo que ensuciaría el port literal de MATLAB (la propiedad que
sostiene `golden-port.test.ts`). La alternativa, `SharedArrayBuffer` + `Atomics`, exige los headers de
aislamiento COOP/COEP, que GitHub Pages no permite configurar. `terminate()` es inmediato y garantizado, y
recrear el worker cuesta decenas de milisegundos porque el módulo ya está en el caché del navegador.

## Deshacer / rehacer

Es barato porque `diseno` es un objeto plano que se reemplaza entero en cada edición: alcanza con guardar
la referencia anterior. `historial.ts` (puro, testeado) tiene las pilas `pasado` / `futuro` con tope de 50
y guarda **solo el diseño**, nunca el layout (megabytes, se recalcula). `describirCambio` deduce qué se
tocó comparando dos diseños, así ningún panel tiene que avisar: devuelve el **campo** (`global:Nombre`,
`eN:Nombre`, `ei:velocidad`) cuando cambió uno solo y la etiqueta del tooltip (*"deshacer: radioDeLaHelice
de 2. Hélice"*). Ediciones consecutivas al mismo campo dentro de 500 ms se funden en una entrada, así
tipear `0.75` no son cuatro deshacer. El deshacer opera sobre el **borrador**: vuelve el diseño, elige la
instancia del cambio, Generar vuelve a marcar cambios pendientes y no se recalcula solo.

**Ctrl+Z con el foco en un campo de texto** (decisión, documentada también en `paneles/atajos.ts`): si el
campo tiene una edición **sin confirmar** (`value !== defaultValue`; cada campo iguala `defaultValue` a
`value` en su `change`), `Ctrl+Z` queda para el deshacer de texto del navegador y revierte lo que se está
tipeando; en cualquier otro caso —campo ya confirmado, `select`, botón o sin foco— es de la aplicación y
deshace el último cambio del diseño. Así, arrepentirse a mitad de tipear vuelve el texto, y `Ctrl+Z`
después de confirmar con Tab o Enter deshace el campo entero, que es lo que se espera de "campo por campo".

## Guardar: tres salidas sobre `serializarDiseno`

1. **Solo parámetros** (`.json`, ~0,5 kB en el circuito de demo): `serializarDiseno` con sangría, botón
   propio y visible. Es lo que se versiona en git y lo que se comparte.
2. **Paquete completo** (`.zip`, con fflate): `layout.json` (el contrato entero), `parametros.json`,
   `series.csv`, `graficos/<pestaña>-<figura>.png` de las cinco pestañas, `vista-3d.png` y `LEEME.txt`
   con fecha, versiones, caso de origen y contenido. Los textos los arma `nucleo/descargar.ts`, que es
   puro y se testea en Node. El CSV no es opcional: es lo que hace que las figuras se puedan re-graficar
   en cualquier lado.
3. **Copiar link**: el diseño en el hash (`#d=<aTextoCompacto>`), 246 caracteres en el circuito de demo.
   Al cargar la página con hash se abre ese diseño y se calcula, y el hash se saca con `replaceState`
   (si no, recargar volvería a abrir el del link y no el último borrador). Es el requisito fundacional de
   `CONTRATO_VISUALIZADOR.md` §9: que la herramienta se use desde cualquier lado con un link.

### PNG y no JPG (y a 2×)

Las imágenes van en **PNG**. Curvas finas sobre fondo oscuro es el peor caso para JPG: deja halos
alrededor de cada trazo *y* encima pesa más que el PNG en este tipo de imagen. Se exportan a **2×** para
que sirvan impresas en la memoria de cálculo:

- Las figuras se dibujan fuera de pantalla al doble de tamaño CSS con trazos, fuentes y ejes escalados al
  doble (`opcionesDeFigura(datos, tamaño, clave, escala)`, extraída de `Figura` junto con el dibujo de las
  franjas) y se componen en un canvas propio con fondo, título y leyenda, que en pantalla son DOM. Hay
  que **esperar un tick**: uPlot dimensiona y dibuja su canvas en un microtask, no en el constructor, y
  sin eso se exporta un canvas de 300×150 vacío.
- La vista 3D **no** usa `preserveDrawingBuffer` (costaría rendimiento en cada cuadro): se hace `render()`
  y `toDataURL()` en el mismo tick. Se captura a 2560×1440 fijos y no al tamaño del contenedor, para que
  la imagen sirva impresa aunque la ventana esté chica o la pestaña de gráficos esté al frente.

## Importar

Botón en la barra y arrastrar-y-soltar sobre toda la ventana. `nucleo/importar.ts` decide por los campos
del JSON si es el `.json` de solo parámetros o un layout completo del contrato (del que reconstruye el
diseño con `disenoDesdeLayout`) y deja hablar al validador que corresponde, de modo que el error nunca es
genérico: JSON inválido con la posición del parser, MAJOR incompatible con el mensaje de
`contrato/cargar.ts`, parámetro o tipo de elemento desconocido y valor de forma equivocada con el campo y
lo esperado (`serializar.ts`), y para cualquier otra cosa, qué claves trae el archivo y cuáles tiene cada
formato.

## Persistencia y errores por campo

- El diseño se guarda **serializado** en `localStorage` (debounce de 1 s, ~1 kB; nunca el layout) y se
  restaura al abrir con un aviso discreto y un botón para descartarlo. `paneles/almacen.ts` envuelve
  `localStorage` para que una ventana privada o el almacenamiento lleno no rompan nada.
- **Precedencia al cargar**: hash de la URL > `?caso=` > `localStorage` > primer golden del índice.
- **Errores por campo**: `diagnostico.ts` busca en el mensaje del núcleo los nombres de
  `ParametrosPorDefecto()` (nombre completo, sin letras alrededor) y resalta esos campos en el formulario
  con el mensaje debajo, además del banner, abriendo el grupo cerrado que los contenga. No hace falta que
  el núcleo devuelva códigos: si mañana un mensaje nombra otro parámetro, el resaltado aparece solo. Única
  excepción documentada: los mensajes del modo nombran el **valor** y no el parámetro ("El modo
  FuerzaGConstante pide +Gz pero…"), así que los cuatro modos cuentan como `ModoCurvatura`. La instancia
  donde falló el cálculo llega por `ErrorDeCalculo.elemento` y marca su fila de la secuencia.

## Verificado

`npm test` (189 tests, ~14 s) y `npm run build` en verde, con `golden-port.test.ts` y `golden/` intactos.
En el navegador, sobre `circuito-demolayout`: cinco ediciones seguidas disparan **cero** cálculos y
Generar dispara exactamente uno (contando los `postMessage` al worker); Detener a mitad de camino (2/4)
deja el layout anterior completo en pantalla y la app utilizable al instante; el contador del botón avanza
1/4, 2/4, 3/4; `Ctrl+Z` deshace campo por campo con el tooltip diciendo cuál; el link copiado abre el
mismo diseño en otra carga; el `.zip` trae 16 archivos (1,6–3 MB según el caso) con las figuras a 1920 px
de ancho y la vista 3D a 2560×1440; recargar la página restaura el diseño con el aviso.

---

# Fase 3 (2026-09-22): lectura — nombres, unidades, tooltips y gráficos

Nada de esta fase toca el contrato ni el núcleo: **el JSON sigue en SI y radianes**, y todas las
conversiones que se agregan son de presentación, como ya lo era el rad → ° de `formato.ts`.

## Qué cambió y por qué

| Pieza | Qué se hizo | Por qué |
|---|---|---|
| `src/paneles/etiquetas.ts` | Un `Record<NombreDeParametro, Etiqueta>` con nombre humano, ayuda, unidad de presentación, rango sugerido y grupo, más las cuatro funciones de conversión (`aPresentacion`, `aSI`, `textoDeEntrada`, `textoConUnidad`). La **`ayuda` no se escribe ahí**: sale de las descripciones que ya declaran `ParametrosDelModo`, `ParametrosDeAceptacion`, `ParametrosGenerales` y `DECLARACIONES_DE_ELEMENTOS`, las mismas que viajan en `parametros.esquema` del contrato. | El formulario mostraba `radioDeLaHelice` y `semianchoDeSuavizadoNormativo` en camelCase, y la descripción solo existía como `title`. Lo único que faltaba era el nombre humano: reescribir las descripciones habría creado una segunda fuente de verdad que se desincroniza en silencio. La excepción es `ModoCurvatura`, que el exportador deja fuera de las cuatro listas a propósito (§3 del contrato) y por lo tanto no tiene descripción que reusar. |
| `src/paneles/ayuda.ts` | El `?` al lado de cada etiqueta abre un popover con el **atributo nativo `popover`**, sin librerías. Se abre con hover, con foco de teclado y con clic (que además lo fija); `aria-describedby` apunta al popover. Contenido: nombre, qué modifica, unidad, valor por defecto, rango sugerido, en qué modos se consume, qué elementos lo declaran y la clave del JSON. | `title=` tarda cerca de un segundo, no se puede estilar, no existe en táctil y el `overflow` del panel lateral lo recorta. El popover se dibuja en el **top layer**, así que ningún scroll lo puede cortar, y trae Esc y clic-afuera gratis. |
| Unidades de presentación | Radios, avances y dimensiones del carro en **cm**; pasos, holguras y diámetros en **mm**; área frontal en **cm²**; masa en **gramos**; ángulos en grados (como ya estaban). Cada input recibe el `step` de su unidad (0,5 cm, 0,1 mm, 1°) en lugar del `step="any"` anterior. | Los valores estaban en unidades demasiado grandes para el modelo: `radioDeLaHelice` se editaba como `0,7` y `pasoGeneracion` como `0,002`. Con `step="any"` las flechitas del teclado no servían para nada. |
| Grupo "Avanzado — numérico" | Las diez tolerancias, topes de iteración y pasos de dibujo (`TolNorma`, `TolPuntoFijo`, `TolCierrePitch`, `MaxIteraciones*`, `MargenDeOnset`, `PasosEntreOrtonormalizaciones`, `VersoresEnGrafico3D`, `ToleranciaVelocidadDeDiseno`) se marcan `grupo: 'solver'` y van a un desplegable propio, cerrado. Aceptación queda en 12 campos y Generales en 26. | No son decisiones de diseño sino del solver, y mezclarlas con los radios era parte de por qué el panel abrumaba. |
| Redondeo de los inputs | Se muestra con los decimales declarados y el **valor exacto vive en una variable de la closure** de `entradaNumerica`; al estado se escribe **solo si el texto cambió**. El ancho del input sale de la unidad (`--digitos` = signo + enteros del rango + decimales). | La página publicada mostraba `peralteDeLaHelice = 54,9999949` y `anguloDelGiro = 120,000288`, que además desbordaban el input de 96 px. La causa no era el formulario sino la vuelta por el JSON: `exportar.ts` redondea a `Number(v.toPrecision(6))` (deliberado y cubierto por los tests de paridad), así que `deg2rad(55)` vuelve como `0,959931` = 54,99999493°. El redondeo del export **no se tocó**; lo que se arregló es que un campo que el usuario no toca no acumule error de ida y vuelta. |
| Gráficos | Expandir por figura (Esc vuelve), alto configurable 240/360/480 persistido, zoom en Y, zoom con la rueda, desplazamiento con Shift o con la rueda apretada, cartel de ayuda una sola vez, tooltip en el cursor, estadística del rango elegido (máximo, mínimo, promedio y **dónde** ocurre el máximo), exportar PNG a 2× y CSV por figura, y la leyenda arriba del gráfico en una línea. | `height` estaba clavado en el método privado `tamano()`; el zoom por arrastre existía pero nada lo indicaba; leer un pico de G obligaba a estimar a ojo. **No se cambió uPlot por otra librería**: es más chica y más rápida que las alternativas y nada de esto la necesita. |
| Cursor ligado | El **índice de nodo global** es el estado compartido (`estado.nodo`). Mover el cursor sobre un gráfico mueve un marcador sobre la vía 3D; mover el carro con el reproductor mueve el cursor de los gráficos; un clic en un punto lleva el reproductor a ese instante. Vista nueva **"Ambos"**, que parte el área principal. | Es lo que convierte "gráficos al lado de un 3D" en un instrumento. La vista "Ambos" no es cosmética: con las dos vistas excluyentes de antes, "pasar el mouse por un pico de Gz ilumina ese punto de la vía" no se podía ver nunca. |
| Veredicto e inertes | `contrato/veredicto.ts` (puro) y `paneles/veredicto.ts`: pasa / no pasa en grande, Gz máxima, Gz mínima y \|Gy\| máxima con el elemento, el subtramo y el arco donde ocurren, el criterio que peor está, y los `inertes` que la fase 1 dejó en el layout exportado. | Los criterios de aceptación son el diferencial del proyecto (aplican ASTM F2291) y eran una lista al final de un panel al que había que scrollear, visible solo con un elemento elegido. Es presentación: el cálculo ya estaba en `AjustarParametros` y en los `criterios` del JSON. |

## Invariantes: uno que cambia y uno nuevo

**Cambia el invariante del formulario.** Hasta la fase 2 valía que *"el formulario sale del esquema del
JSON, no de una lista escrita en la web: si MATLAB o el port declaran un parámetro nuevo, aparece solo"*.
`etiquetas.ts` **es** una lista escrita en la web y por lo tanto se puede desincronizar del núcleo. Lo
reemplaza un invariante equivalente y verificable:

> **`test/etiquetas.test.ts` recorre `Object.keys(ParametrosPorDefecto())` y falla si algún parámetro no
> tiene entrada en `etiquetas.ts`.** La desincronización pasa a ser un test rojo y no un bug silencioso.

El test comprueba además que ningún nombre humano sea el camelCase del parámetro, que la ayuda no esté
vacía y salga del núcleo, que los numéricos declaren unidad y los no numéricos no, que los valores por
defecto caigan dentro de su rango sugerido y que ninguno desborde el ancho declarado del input. La otra
mitad del invariante viejo se conserva: **las cuatro listas y las descripciones siguen saliendo del
núcleo**, no del diccionario.

**La unidad de presentación se declara parámetro por parámetro, no por tipo de dimensión.**
`RadioDeReferenciaReal` (8 m) y `LargoCarroReal` (2,2 m) son longitudes igual que `RadioDeLaHelice`
(0,7 m), pero son del **prototipo** y no del modelo: pasarlos a centímetros borraría de la pantalla la
diferencia de escala que ancla λ de Froude, que es de lo que trata el proyecto. Por eso la unidad no se
puede derivar de la unidad SI que declara el núcleo, y por eso está escrito también en la cabecera de
`etiquetas.ts` para que nadie lo "corrija".

Corolario práctico: un parámetro nuevo aparece en el formulario solo (lo declara el núcleo) pero con el
test en rojo hasta que se le escriba nombre, unidad y rango.

## Decisiones de esta fase

- **`popover` nativo y posición calculada a mano.** El anchor positioning de CSS sigue siendo solo de
  Chromium, y un popover sin posicionar se dibuja centrado en la pantalla, que sería peor que el `title`.
  `ayuda.ts` usa `getBoundingClientRect` del botón y acota a la ventana. El clic lo maneja un listener y
  **no** el atributo `popovertarget`: el toggle nativo corre después de los listeners y cerraría lo que
  el hover acababa de abrir.
- **El `mousedown` del desplazamiento de los gráficos se escucha en `u.root` en fase de captura.** uPlot
  registra el suyo sobre `u.over` en el constructor, o sea antes que cualquier listener que se agregue en
  el hook `ready`; desde un ancestro en captura es la única forma de ganarle para que no arranque una
  selección.
- **La rueda queda tomada por el zoom mientras el puntero está sobre una figura**, que es lo que se pidió.
  La lista de figuras se recorre con la barra de la derecha o expandiendo una (⤢), y el cartel de ayuda
  lo dice. Invertirlo (pedir Ctrl para el zoom) es cambiar una condición en `figura.ts`.
- **El marcador del 3D se aplica en el `requestAnimationFrame` de la escena.** `via.marcarNodo()` solo
  anota el pedido y `via.actualizarMarcador()` lo aplica desde `escena.enCadaCuadro`: el cursor se mueve
  en cada evento de mouse y el carro en cada cuadro, y tocar Three.js ahí sería trabajo tirado entre dos
  cuadros. Por la misma razón la tabla de "valores en el cursor" se arma una vez por layout y después
  solo se le reescribe el texto a cada celda.
- **El "criterio peor" compara margenes relativos al límite.** Los criterios están en unidades distintas
  (metros contra G contra radianes) y comparar margenes crudos sería sumar peras con manzanas. Si todos
  pasan, se muestra el más ajustado en vez de nada.
- **El reproductor pasa a vivir dentro de `.vista3d`.** Flotando sobre `.principal` quedaría sobre los
  gráficos al partir el área en la vista "Ambos".
- **`slug` y `descargarArchivo` se mudan a `paneles/archivo.ts`.** Los botones de exportar de cada figura
  los necesitan, y que `graficos/` importara `guardar.ts` (que importa `graficos/series` y
  `graficos/exportarFigura`) cerraría un ciclo entre los dos módulos.

## Verificado

`npm test` (227 tests) y `npm run build` en verde, con `golden-port.test.ts` y `golden/` intactos. En el
navegador, sobre `circuito-demolayout`:

- los 61 inputs del panel entran en su caja, la hélice se edita como `70,0 cm` y `55,0°`,
  `radioDeReferenciaReal` sigue en `8,00 m`, y reconfirmar un campo sin cambiarlo **no** marca cambios
  pendientes mientras que editarlo sí;
- el `?` abre al instante, no lo recorta el panel y el clic lo deja fijo;
- se hace zoom arrastrando, la estadística del rango aparece con el máximo, el mínimo, el promedio y
  dónde ocurre el máximo, y el doble clic vuelve;
- moviendo el mouse por la curva de Gx el marcador azul recorre la hélice en el 3D, un clic lleva el
  reproductor a ese instante, y con play el cursor de los gráficos avanza solo y el bloque de valores
  sigue al carro entre elementos;
- el panel abre con "No pasa — 8 de 105 criterios" y el criterio peor (`Altura del riel sobre el suelo`,
  4. DiveLoop, margen −0,325 m); pisando `RadioDelLoop` en una instancia y cambiándola a `Helice`, el
  aviso de inerte aparece en el panel de resultados.
