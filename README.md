# MontanaRusa

Modelo de cálculo de una **montaña rusa en miniatura**, pieza de portfolio de ingeniería mecánica. El objetivo
no es un circuito largo sino un modelo compacto que implemente mecanismos de atracciones reales — motor
sincrónico lineal para el lanzamiento, switch tracks, frenos de Foucault — para demostrar profundidad de
ingeniería. El repo tiene dos piezas de cálculo: un script preliminar de análisis energético sobre una
trayectoria ya dada, y el generador de geometría de vía propiamente dicho (loop vertical, hélice, over-banked
turn, dive loop), con integración RK4, marco de transporte paralelo, modos de curvatura y verificación contra
ASTM F2291. Un tercer documento aparte fija los criterios de diseño (continuidad, escalado, límites normativos)
que las dos piezas de código tienen que respetar.

## Mapa de lectura

| ¿Qué buscás? | Documento | Sección |
|---|---|---|
| Por qué se usa transporte paralelo y no Frenet-Serret | [`memoria_de_calculo.md`](memoria_de_calculo.md) | [§2](memoria_de_calculo.md#2-marco-de-referencia-de-la-vía) |
| Cinemática de heartline, por qué el roll tiene que ser $C^2$ | [`memoria_de_calculo.md`](memoria_de_calculo.md) | [§3](memoria_de_calculo.md#3-cinemática-de-heartline) |
| Semejanza de Froude, factores de escala, $\lambda=22$ | [`memoria_de_calculo.md`](memoria_de_calculo.md) | [§4](memoria_de_calculo.md#4-semejanza-de-froude) |
| Límites de la norma ASTM F2291-06a §7 (tablas de las Figs. 6–10) | [`memoria_de_calculo.md`](memoria_de_calculo.md) | [§5](memoria_de_calculo.md#5-criterios-de-aceptación--astm-f2291-06a-7) |
| Por qué se admite discontinuidad acotada en vez de continuidad estricta | [`memoria_de_calculo.md`](memoria_de_calculo.md) | [§6](memoria_de_calculo.md#6-política-de-continuidad-por-eje) |
| Cómo se dimensiona la longitud de una clotoide | [`memoria_de_calculo.md`](memoria_de_calculo.md) | [§7](memoria_de_calculo.md#7-longitudes-de-transición-derivación-y-escalado) |
| Dimensionamiento del carro, modelo distorsionado vs. semejante | [`memoria_de_calculo.md`](memoria_de_calculo.md) | [§9](memoria_de_calculo.md#9-dimensionamiento-del-carro) |
| Cómo el generador construye la geometría paso a paso (las tres capas) | [`documentacion_generador_elementos.md`](documentacion_generador_elementos.md) | [§4.1](documentacion_generador_elementos.md#41-cómo-se-construye-la-geometría-paso-a-paso) |
| Los cuatro modos de curvatura (Clotoide, FuerzaGConstante, etc.) | [`documentacion_generador_elementos.md`](documentacion_generador_elementos.md) | [§5](documentacion_generador_elementos.md#5-los-cuatro-modos-de-curvatura) |
| Método A vs. Método B de acoplamiento geometría-dinámica | [`documentacion_generador_elementos.md`](documentacion_generador_elementos.md) | [§6](documentacion_generador_elementos.md#6-los-dos-métodos-de-acoplamiento) |
| Chequeos de factibilidad e interferencia | [`documentacion_generador_elementos.md`](documentacion_generador_elementos.md) | [§8](documentacion_generador_elementos.md#8-chequeos-de-factibilidad) |
| Qué tests corren y qué verifican | [`documentacion_generador_elementos.md`](documentacion_generador_elementos.md) | [§11](documentacion_generador_elementos.md#11-tests-de-validación) |
| Hallazgos de ingeniería (loop que se cruza, loop circular imposible, etc.) | [`documentacion_generador_elementos.md`](documentacion_generador_elementos.md) | [§12](documentacion_generador_elementos.md#12-hallazgos-de-ingeniería) |
| Cómo se calcula energía, velocidad y pérdidas sobre una trayectoria dada | [`documentacion_analisis_energia.md`](documentacion_analisis_energia.md) | [§9](documentacion_analisis_energia.md#9-proceso-iterativo-velocidad-normales-y-pérdidas) |
| Modelo de resistencia al avance (rodadura + arrastre) | [`documentacion_analisis_energia.md`](documentacion_analisis_energia.md) | [§8](documentacion_analisis_energia.md#8-modelo-de-resistencia-al-avance) |
| Qué significa cada símbolo o variable, con su unidad | [`NOMENCLATURA.md`](NOMENCLATURA.md) | tabla completa |

## Estructura del repo

| Carpeta | Qué contiene |
|---|---|
| *(raíz)* | `analisis_energia.m`, `DemoElemento.m`, `DemoLayout.m`, `TestsValidacion.m` y los cinco documentos `.md` |
| `GeneradorDeElementos/` (raíz) | `ParametrosPorDefecto.m` — el único archivo que se edita para configurar, en cuatro bloques (modo de curvatura, geometría de cada elemento, criterios de aceptación, generales); `ParametrosGenerales.m` declara el cuarto bloque con unidades; `AjustarParametros.m` avisa si se carga un valor que la corrida no lee |
| `GeneradorDeElementos/Nucleo/` | contrato de `Estado`, marco de Bishop, integrador RK4, registro de nodos |
| `GeneradorDeElementos/Fisica/` | cargas por juego de ruedas, resistencia, modos de curvatura, Froude, simulación |
| `GeneradorDeElementos/Elementos/` | los cuatro elementos, el motor común y los dos métodos de acoplamiento |
| `GeneradorDeElementos/Verificacion/` | curvas de la norma, chequeos de factibilidad, distancia entre polilíneas |
| `GeneradorDeElementos/Salida/` | reporte por consola, gráficos y `LayoutAJson.m`, el exportador al contrato del visualizador |
| `GeneradorDeElementos/LayoutDeVia/` | alta, deshacer, guardar, cargar y re-simular el circuito |
| `esquema/` | `layout-v1.schema.json` (JSON Schema del contrato), `ejemplo-layout.json` y el validador Node (`validar-layout.js`) |
| `golden/` | los once casos canónicos del contrato, generados por `GenerarGoldenFiles.m`; son el arnés de validación del port a JS |
| `web/` | el visualizador web (Vite + TypeScript + Three.js): lee los `golden/*.json` y dibuja la vía en 3D con resumen y criterios; ver [`web/README.md`](web/README.md) |

Detalle completo en [`documentacion_generador_elementos.md` §2](documentacion_generador_elementos.md#2-arquitectura).

## Cómo correr

```matlab
run('analisis_energia.m')     % modelo preliminar sobre una trayectoria de prueba (no es geometría de diseño)
run('DemoElemento.m')         % un elemento del generador en detalle: reporte y gráficos
run('DemoLayout.m')           % los cuatro elementos encadenados en un circuito
run('TestsValidacion.m')      % dieciseis tests del generador, termina con error si alguno falla
run('GenerarGoldenFiles.m')   % regenera golden/*.json y los valida contra el esquema (necesita node)
```

El visualizador web se corre con `cd web && npm install && npm run dev` (y se publica solo en GitHub Pages en cada push a
`main`). El contrato de datos entre el cálculo y el visualizador está en [`CONTRATO_VISUALIZADOR.md`](CONTRATO_VISUALIZADOR.md);
`DemoLayout.m` y `DemoElemento.m` escriben además el layout como `layout_*.json`. Para validar cualquier JSON contra el
esquema (una vez, `npm install` dentro de `esquema/`):

```bash
node esquema/validar-layout.js golden layout_circuito.json
```

Los parámetros del generador de elementos se configuran en un único lugar:
[`GeneradorDeElementos/ParametrosPorDefecto.m`](GeneradorDeElementos/ParametrosPorDefecto.m). Los parámetros de
`analisis_energia.m` están declarados al principio de ese mismo script.

## Estado del proyecto

| Área | Estado |
|---|---|
| Generador de geometría (loop, hélice, over-banked turn, dive loop) | Implementado y con 16 tests pasando (ver [`documentacion_generador_elementos.md` §11](documentacion_generador_elementos.md#11-tests-de-validación)) |
| Modelo de heartline (tres curvas: riel, heartline, cabeza) | Implementado; el riel es la curva integrada y el eje de roll, la heartline se deriva y la G se impone en el pasajero por transporte inverso (ver [`documentacion_generador_elementos.md` §14](documentacion_generador_elementos.md#14-el-modelo-de-heartline-tres-curvas)) |
| Verificación normativa contra ASTM F2291 | Implementada; valores de la norma sin verificar contra el texto original (ver [`memoria_de_calculo.md` §11](memoria_de_calculo.md#11-datos-pendientes-de-verificación)) |
| Análisis energético (`analisis_energia.m`) | Modelo preliminar, corre sobre trayectoria de prueba; falta importar geometría real y pasar a RK4 (ver [`documentacion_analisis_energia.md` §15](documentacion_analisis_energia.md#15-limitaciones-actuales--próximos-pasos)) |
| Dimensionamiento del carro y del loop | Decisión de similitud tomada (modelo distorsionado); dimensiones definitivas sin cerrar (ver [`memoria_de_calculo.md` §10](memoria_de_calculo.md#10-pendientes-que-bloquean-el-dimensionamiento)) |
| Visualizador web (`web/`) | v1: vía 3D coloreada por magnitud, resumen y criterios, leyendo los golden files; sin animación ni edición de parámetros todavía (ver [`web/DISENO.md`](web/DISENO.md)) |
| Modelo de N carros, elemento conector, modo inverso, backend web | Fuera de alcance actual (ver [`documentacion_generador_elementos.md` §15](documentacion_generador_elementos.md#15-otras-limitaciones-y-próximos-pasos)) |

## Nomenclatura

Todo símbolo matemático y toda variable de código que aparece en estos documentos está definido, con unidad,
en [`NOMENCLATURA.md`](NOMENCLATURA.md) — es la tabla maestra y la fuente de verdad para cualquier ambigüedad.
