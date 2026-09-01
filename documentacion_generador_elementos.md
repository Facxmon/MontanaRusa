# Constructor de elementos de vía

Documentación del generador de geometría de vía implementado en [`GeneradorDeElementos/`](GeneradorDeElementos), con los scripts de demostración [`DemoElemento.m`](DemoElemento.m) y [`DemoLayout.m`](DemoLayout.m) y los tests en [`TestsValidacion.m`](TestsValidacion.m).

Elementos implementados: **loop vertical**, **hélice**, **over-banked turn** (glosario: curva peraltada más de 90°) y **dive loop** (glosario: media vuelta que invierte al pasajero de cabeza hacia abajo). Otros términos en inglés que aparecen: *up-stop* (rueda de retención que evita que el carro se despegue de la vía), *switch track* (desvío de vía), *smoothstep* (perfil de transición suave con derivadas nulas en los extremos).

> **Lo más importante de este documento es [§4.1, cómo se construye la geometría paso a paso](#41-cómo-se-construye-la-geometría-paso-a-paso):** el generador no tiene una fórmula cerrada para la vía, sino un proceso iterativo de tres capas anidadas (longitud/torsión → cierre del loop → marcha RK4), cada una con su propia condición de convergencia. Eso es el **Método A**, el método por defecto. El Método B es una envoltura opcional aparte, no una capa más. Todo lo demás en este documento describe piezas de ese proceso.

> **Documentos hermanos.** Los criterios de diseño (continuidad, marco de referencia, cinemática de heartline, semejanza de Froude y límites normativos tabulados) están en [`memoria_de_calculo.md`](memoria_de_calculo.md). El análisis energético preliminar sobre una trayectoria ya dada está en [`documentacion_analisis_energia.md`](documentacion_analisis_energia.md). Este documento cubre sólo el generador de elementos, es decir, exclusivamente el código bajo `GeneradorDeElementos/` y los scripts `DemoElemento.m`/`DemoLayout.m`/`TestsValidacion.m` — no el script `analisis_energia.m` de la raíz del repo, que es un modelo aparte. Ver [`NOMENCLATURA.md`](NOMENCLATURA.md) para la tabla completa de símbolos.

## Símbolos usados en este documento

| Símbolo | Significado | Unidad |
|---|---|---|
| $s$ | longitud de arco | m |
| $\mathbf{T},\mathbf{U}_{pt},\mathbf{L}_{pt}$ | marco de transporte paralelo | — (versores) |
| $\mathbf{U},\mathbf{L}$ | marco del carro | — (versores) |
| $\kappa,\kappa_U,\kappa_L$ | curvatura y sus componentes sobre el marco de transporte | 1/m |
| $\phi,\phi',\phi''$ | roll y sus derivadas | rad, rad/m, rad/m² |
| $\mathbf{r}(s)$ | heartline: curva integrada y eje de roll (`Track.PuntosHeartline`) | m |
| $\mathbf{r}_{riel}(s)$ | riel, $\mathbf{r}-d\,\mathbf{U}$: la pieza que se fabrica (`Track.PuntosRiel`) | m |
| $d$ | offset riel → heartline, geometría de la vía (`DistanciaHeartline`) | m |
| $e$ | offset heartline → cuerpo del pasajero, confort (`DistanciaEvaluacionPasajero`) | m |
| $\boldsymbol\omega$ | velocidad angular del marco del carro | rad/s |
| $\beta$ | ángulo entre la normal del plano de referencia y $\mathbf{U}_{pt}$ | rad |
| $\alpha$ | ángulo de la hélice del loop (inclinación helicoidal) | rad |
| $U_z$ | componente vertical de $\mathbf{U}$ | — (adimensional, componente de versor) |
| $\tau$ | torsión de la vía | 1/m |
| $v$ | velocidad | m/s |
| $G_x,G_y,G_z$ | fuerza G en los ejes del pasajero | G |
| $F_N$ | fuerza normal sobre la vía (colisión de símbolos #6 resuelta, ver [`NOMENCLATURA.md`](NOMENCLATURA.md#0-colisiones-resueltas)) | N |
| $J_{max}$ | presupuesto de onset por eje | G/s |
| $\lambda_{loop},\lambda_{carro}$ | factores de escala | — |
| $R$ | radio de curvatura de la vía (nunca radio de rueda, colisión #8) | m |

Ver la tabla completa en [`NOMENCLATURA.md`](NOMENCLATURA.md).

## Índice

1. [Cómo se corre](#1-cómo-se-corre)
2. [Arquitectura](#2-arquitectura)
3. [Marco de referencia](#3-marco-de-referencia)
4. [Sub-tramos](#4-sub-tramos)
   - [4.1 Cómo se construye la geometría, paso a paso](#41-cómo-se-construye-la-geometría-paso-a-paso)
5. [Los cuatro modos de curvatura](#5-los-cuatro-modos-de-curvatura)
6. [Los dos métodos de acoplamiento](#6-los-dos-métodos-de-acoplamiento)
7. [Presupuesto de onset y longitudes de transición](#7-presupuesto-de-onset-y-longitudes-de-transición)
8. [Chequeos de factibilidad](#8-chequeos-de-factibilidad)
9. [Límites normativos](#9-límites-normativos)
10. [Escalado](#10-escalado)
11. [Tests de validación](#11-tests-de-validación)
12. [Hallazgos de ingeniería](#12-hallazgos-de-ingeniería)
13. [Discrepancias con la consigna](#13-discrepancias-con-la-consigna)
14. [El modelo de heartline: tres curvas](#14-el-modelo-de-heartline-tres-curvas)
15. [Otras limitaciones y próximos pasos](#15-otras-limitaciones-y-próximos-pasos)

---

## 1. Cómo se corre

```matlab
run('DemoElemento.m')         % un elemento en detalle: reporte y gráficos
run('DemoLayout.m')           % los cuatro elementos encadenados en un circuito
run('TestsValidacion.m')      % diez tests, termina con error si alguno falla
```

Todos los parámetros de entrada están agrupados en [`ParametrosPorDefecto.m`](GeneradorDeElementos/ParametrosPorDefecto.m). Los que dependen de investigación pendiente (disponibilidad de rodamientos en Argentina, tolerancia de la impresora) están marcados como **SIN CERRAR** ahí mismo. La tabla completa de esos parámetros, con símbolo, unidad y sección donde se usan, está en [`NOMENCLATURA.md` bloque 3](NOMENCLATURA.md#3-parámetros-de-entrada-del-generador-parametrospordefectom).

---

## 2. Arquitectura

El código está en [`GeneradorDeElementos/`](GeneradorDeElementos), en seis carpetas por rol. Para encontrar algo, primero se elige la carpeta:

| Carpeta | Qué contiene |
|---|---|
| *(raíz)* | `ParametrosPorDefecto` — el único archivo que se edita para configurar |
| `Nucleo/` | contrato de `Estado`, marco de Bishop, integrador RK4, registro de nodos |
| `Fisica/` | cargas por juego de ruedas, resistencia, modos de curvatura, Froude, simulación |
| `Elementos/` | los cuatro elementos, el motor común y los dos métodos de acoplamiento |
| `Verificacion/` | curvas de la norma, chequeos de factibilidad, distancia entre polilíneas |
| `Salida/` | reporte por consola y gráficos |
| `LayoutDeVia/` | alta, deshacer, guardar, cargar y re-simular el circuito |

### 2.1 Los cuatro elementos comparten un solo motor

Un elemento no es un algoritmo propio: es una **receta** de cinco campos que describe a [`GenerarGeometria`](GeneradorDeElementos/Elementos/GenerarGeometria.m) qué construir. Todos son el mismo objeto geométrico —un giro de cierto ángulo alrededor de un eje, con una ley de roll encima— y lo que cambia son los números:

| Elemento | Giro objetivo | Desfasaje de curvatura | Roll del elemento | Avance sobre el eje |
|---|---|---|---|---|
| `ElementoLoopVertical` | $2\pi$ | 0 — curvatura en el plano vertical | 0 | separación entre patas |
| `ElementoDiveLoop` | $\pi$ | $\pi$ — curvatura hacia abajo | $\pi$ — entra invertido | 0 |
| `ElementoHelice` | vueltas $\times\,2\pi$ | $\pm\pi/2$ — curvatura horizontal | el peralte | cuánto sube o baja |
| `ElementoOverBankedTurn` | cambio de rumbo | $\pm\pi/2$ — curvatura horizontal | el peralte, mayor a $90°$ | 0 |

El **desfasaje de curvatura** es lo que separa las dos familias: con 0 la curvatura queda en el plano vertical y el elemento cambia el *pitch* (loop); con $\pm\pi/2$ queda horizontal y cambia el *rumbo* (giros). El **roll va por su lado**, y eso es lo que permite un over-banked turn: la curva sigue siendo horizontal y lo único que cambia es cómo está parado el carro sobre ella. Con Frenet el peralte quedaría atado a la geometría y no se podría elegir (ver por qué en [`memoria_de_calculo.md` §2.1](memoria_de_calculo.md#21-por-qué-frenet-serret-no-sirve)).

Dos consecuencias que salieron gratis de esta unificación:

- El **dive loop** es el loop con tres números cambiados. El medio tonel de entrada lo hace el sub-tramo de acondicionamiento que ya existía para corregir el roll, con su smoothstep quíntico y su longitud dimensionada por el onset lateral.
- El **avance sobre el eje** es el mismo parámetro que en el loop separa las dos patas para que no se choque. Ahí el eje es lateral; en la hélice el eje es vertical y el parámetro es directamente cuánto sube.

### 2.2 Separación Track / Sim

`Track` es geometría y no cambia. `Sim` es el estado dinámico y se recalcula sobre una geometría dada. Si cambia la velocidad de lanzamiento, la vía ya fabricada sigue siendo la misma: `LayoutResimular` recalcula toda la dinámica sin regenerar nada, y avisa cuando la velocidad de entrada se aparta de `Track.VelocidadDeDiseno` más que la tolerancia.

### 2.3 Contrato de estado entre elementos

```matlab
[EstadoSalida, Elemento, Reporte] = ElementoLoopVertical(EstadoEntrada, Parametros, Layout)
[EstadoSalida, Elemento, Reporte] = ElementoHelice(EstadoEntrada, Parametros, Layout)
[EstadoSalida, Elemento, Reporte] = ElementoOverBankedTurn(EstadoEntrada, Parametros, Layout)
[EstadoSalida, Elemento, Reporte] = ElementoDiveLoop(EstadoEntrada, Parametros, Layout)
```

Los cuatro tienen la misma firma y todos delegan en `ConstruirElemento`, que es donde vive lo común. Agregar un elemento nuevo es escribir una receta de cinco campos.

`Estado` lleva posición, los tres versores del marco del carro, el vector curvatura y su derivada, el roll con sus dos derivadas, la longitud acumulada, la velocidad y la energía. El roll se mide **contra el marco de transporte paralelo**, de modo que el `Estado` no necesita arrastrar además ese marco: se recupera rotando el marco del carro por $-\phi$.

**Dos ángulos de roll — la distinción se adelanta acá.** El `Track` resultante trae dos campos de roll: `Track.AnguloRoll` ($\phi(s)$, medido contra el marco de transporte paralelo, que gira por su cuenta con la torsión) y `Track.AnguloPeralte` (el mismo roll medido contra la vertical real, el que se ve mirando la vía). Pueden diferir en decenas de grados sin que el carro esté torcido: el detalle completo, con el caso numérico del loop helicoidal, está en [§12.3](#123-dos-ángulos-de-roll-distintos-y-sólo-uno-se-ve-en-la-vía).

---

## 3. Marco de referencia

No se usa Frenet-Serret (por qué, en [`memoria_de_calculo.md` §2.1](memoria_de_calculo.md#21-por-qué-frenet-serret-no-sirve)). Se integra directamente el **marco de transporte paralelo (Bishop)**:

$$\frac{d\mathbf{T}}{ds} = \kappa_U\mathbf{U}_{pt} + \kappa_L\mathbf{L}_{pt}, \qquad \frac{d\mathbf{U}_{pt}}{ds} = -\kappa_U\mathbf{T}, \qquad \frac{d\mathbf{L}_{pt}}{ds} = -\kappa_L\mathbf{T}$$

Por construcción no tiene rotación alrededor de $\mathbf{T}$, así que queda definido donde la curvatura es nula y no salta 180° en las inflexiones. El marco del carro se arma encima con el roll explícito ($\mathbf U=\cos\phi\,\mathbf U_{pt}+\sin\phi\,\mathbf L_{pt}$, ver [`memoria_de_calculo.md` §2.3](memoria_de_calculo.md#23-marco-del-carro)), y se reortonormaliza por Gram-Schmidt cada `PasosEntreOrtonormalizaciones`.

$U_z$ es la componente vertical del versor "arriba del carro" ($U_z = \mathbf{U}\cdot\hat z$), definida acá porque se usa más adelante — en la tabla de modos de curvatura (§5) y en el análisis de $G_x$ (§12.4) — antes de derivarla en detalle.

**Consistencia útil:** en una curva plana el transporte paralelo coincide con la normal en el plano, y el ángulo $\beta$ entre el marco de transporte y esa normal es constante. $\beta$ se mide con `atan2` sobre las proyecciones de la normal del plano de referencia sobre $\mathbf{L}_{pt}$ (numerador) y $\mathbf{U}_{pt}$ (denominador): un $\beta$ positivo indica que la normal está rotada desde $\mathbf{U}_{pt}$ hacia $\mathbf{L}_{pt}$ en el sentido antihorario visto desde $+\mathbf{T}$. Por eso la curvatura del loop se reparte con un $\cos\beta$ y un $\sin\beta$ calculados una sola vez.

---

## 4. Sub-tramos

| Sub-tramo | Qué hace | Cuándo aparece |
|---|---|---|
| `AcondicionamientoEntrada` | lleva a cero la componente de curvatura que el elemento no puede representar, y el roll al que el elemento pide | sólo si hace falta |
| `ClotoideEntrada` | rampa lineal de curvatura desde $\kappa_0$ hasta la que pide el modo | siempre |
| `ArcoPrincipal` | curvatura según el modo elegido | siempre |
| `ClotoideSalida` | rampa de curvatura de vuelta a cero | siempre |

Quedan demarcados por índice de nodo en `Track.SubTramos(k).IndiceInicio/IndiceFin`, se listan en el reporte con su rango de arco, y se distinguen por color en los gráficos.

La clotoide de entrada arranca en la curvatura que traiga el estado de entrada (**clotoide desplazada**), no en cero. Se implementa como una mezcla lineal entre $\kappa_0$ y la curvatura del modo; con el modo `Clotoide` la curvatura objetivo es constante y la mezcla es exactamente una clotoide ($d\kappa/ds$ constante).

### 4.1 Cómo se construye la geometría, paso a paso

Esta es la parte central del generador: **no hay una fórmula cerrada para la vía**, hay un proceso iterativo de tres capas anidadas, cada una resolviendo una cosa distinta. Esto es lo que corre siempre, con el **Método A** — el método por defecto (`Parametros.MetodoDeAcoplamiento = 'A'`) y el que queda como resultado final aun cuando se corren los dos para comparar. De afuera hacia adentro:

```
Ajuste de forma         punto fijo + Newton sobre LONGITUD y TORSIÓN del elemento
  └─ Cierre del loop    corrección por secante sobre el GIRO remanente
       └─ Marcha        un paso RK4 por cada ds, sub-tramo por sub-tramo
```

Cada capa envuelve a la siguiente: la de más adentro (la marcha RK4) es la única que efectivamente traza puntos; todo lo de afuera son ajustes que la vuelven a correr con números distintos hasta que algo converge. El **Método B** (§4.1.4) es una envoltura *opcional*, aparte de estas tres — no reemplaza este proceso, lo repite varias veces con un perfil de velocidad distinto en cada repetición.

**Las tres incógnitas de este proceso**, definidas antes de usarlas:

| Nombre | Qué es | Ajustada por (capa) |
|---|---|---|
| `FactorLongitud` | factor multiplicativo sobre la longitud calculada de las transiciones (clotoides y roll), para que el onset medido sobre la geometría ya generada iguale el presupuesto | 1 (ajuste de forma) |
| `Inclinacion` | $\tan\alpha$, la torsión helicoidal por unidad de ángulo girado, sólo si el elemento pide desplazamiento lateral | 1 (ajuste de forma) |
| `AjusteCierre` | ángulo que se resta al `GiroObjetivo` del arco principal, para que el giro real (incluyendo lo que van a girar las clotoides) cierre exactamente | 2 (cierre del loop) |

La tabla siguiente es la referencia rápida de las tres capas; después va el detalle de cada una con sus fórmulas.

| Capa | Qué ajusta | Cómo | Converge cuando |
|---|---|---|---|
| 1. Ajuste de forma | `FactorLongitud` (longitud de las transiciones) e `Inclinacion` (torsión helicoidal) | punto fijo sobre el onset medido + un paso de Newton sobre el desplazamiento lateral | ambos números dejan de moverse (`< 1e-6` relativo y `< 1e-8` rad) |
| 2. Cierre del loop | `AjusteCierre`, el giro que se le resta al objetivo del arco principal | corrección por secante sobre el residual de cierre | $\lvert$residual$\rvert <$ `Parametros.TolCierrePitch` |
| 3. Marcha (RK4) | el estado $y$ nodo a nodo dentro de cada sub-tramo | un paso de Runge-Kutta 4 de longitud `Parametros.PasoGeneracion` | recorrió toda la longitud del sub-tramo (o se acorta el último paso para caer justo) |

**Nota de orden de presentación.** El diagrama de bloques de arriba y la tabla listan las capas de afuera hacia adentro: 1 (ajuste de forma), 2 (cierre), 3 (marcha). El detalle que sigue las explica en el orden inverso — 3, 2, 1 — porque la capa interna (la marcha) es la única que traza puntos, y entender qué hace primero deja más claro qué es lo que las capas externas están ajustando. Numeración adoptada para que no queden huecos: **4.1.1** es la capa 3 (marcha), **4.1.2** la capa 2 (cierre), **4.1.3** la capa 1 (ajuste de forma), **4.1.4** el método B.

#### 4.1.1 Capa 3 — la marcha: un paso a la vez

Es lo único que de verdad avanza la vía. `IntegrarTramo` la corre sub-tramo por sub-tramo (acondicionamiento, clotoide de entrada, arco principal, clotoide de salida) y en cada uno repite, mientras quede arco por recorrer:

1. **Evaluar el punto actual** (`PuntoCinematico` + `DerivadaDeVia`): con el estado $y$ de ese nodo se arma el marco del carro (roll aplicado sobre el marco de transporte), se evalúa la curvatura objetivo de ese sub-tramo — constante, mezcla lineal, o según el modo elegido (ver [§5](#5-los-cuatro-modos-de-curvatura)) — y con eso las cargas $G$ y la resistencia al avance. La velocidad que entra a este cálculo es `Punto.VelocidadParaCurvatura`: la velocidad real de la marcha en el método A, o el perfil de velocidad supuesto (interpolado) en el método B — ver [§6](#6-los-dos-métodos-de-acoplamiento).
2. **Registrar el nodo** (`AgregarNodo`) con todos esos campos: posición, los tres versores, curvatura, roll, velocidad, G's, pérdidas, ángulo girado, tiempo.
3. **Dar el paso** (`PasoRK4`): integra el sistema completo posición + marco + energía con Runge-Kutta 4 sobre un paso $\Delta s$ = `Parametros.PasoGeneracion` (o menos, si es el último paso del sub-tramo). El vector de estado tiene 15 componentes — posición, tangente, arriba y lateral del transporte paralelo, $v^2$, ángulo girado, tiempo — y sus derivadas son:
   $$\frac{d\mathbf{r}}{ds}=\mathbf{T},\quad \frac{d\mathbf{T}}{ds}=\kappa_U\mathbf{U}_{pt}+\kappa_L\mathbf{L}_{pt},\quad \frac{d\mathbf{U}_{pt}}{ds}=-\kappa_U\mathbf{T},\quad \frac{d\mathbf{L}_{pt}}{ds}=-\kappa_L\mathbf{T}$$
   $$\frac{d(v^2)}{ds}=2a_t,\quad \frac{d\theta_{girado}}{ds}=\kappa,\quad \frac{dt}{ds}=\frac{1}{v}$$
   con $a_t = -g\,T_z - F_{res}/m$. RK4 evalúa esta derivada cuatro veces ($k_1$ en el punto actual, $k_2$ y $k_3$ a mitad de paso, $k_4$ al final) y combina $y_{n+1}=y_n+\frac{\Delta s}{6}(k_1+2k_2+2k_3+k_4)$. Con Euler (una sola evaluación) el error de cada paso cae siempre para el mismo lado y tras miles de pasos el loop sale en espiral en vez de cerrar; RK4 lleva ese error de orden $\Delta s^2$ a orden $\Delta s^5$.
4. **Re-ortonormalizar** el marco cada `PasosEntreOrtonormalizaciones` pasos (Gram-Schmidt sobre $\mathbf{T}$ y $\mathbf{U}_{pt}$), porque la integración numérica va acumulando error y el marco deja de ser exactamente ortonormal.
5. **Parar** cuando se acabó la longitud del sub-tramo, o antes si el carro se quedó sin energía ($v^2\le 0$), o exactamente en el punto que pide el corte de cierre del arco principal (ver [§4.1.2](#412-capa-2--cierre-del-loop-corrección-por-secante)): ahí se acorta el último paso para caer justo en vez de quedar cuantizado por $\Delta s$.

La curvatura que entra en el paso 1 depende de en qué sub-tramo está la marcha:

| Sub-tramo | Curvatura que impone |
|---|---|
| `AcondicionamientoEntrada` | rampa lineal de la componente perpendicular hacia 0, manteniendo la paralela |
| `ClotoideEntrada` | mezcla lineal $(1-f)\kappa_0 + f\,\kappa_{modo}$, con $f$ = fracción recorrida del sub-tramo |
| `ArcoPrincipal` | $\kappa_{modo}$ evaluada en cada paso según la tabla de modos ([§5](#5-los-cuatro-modos-de-curvatura)) |
| `ClotoideSalida` | rampa lineal desde $\kappa_{fin}$ del arco principal hasta 0 |

#### 4.1.2 Capa 2 — cierre del loop: corrección por secante

El arco principal no tiene una longitud fija: se corta cuando el ángulo ya girado, más lo que todavía va a girar la clotoide de salida, llega al `GiroObjetivo` de la receta ($2\pi$ en un loop, $\pi$ en un dive loop, etc.). El giro que falta por la clotoide de salida se estima con el área del triángulo de la rampa lineal, $\kappa/2 \times L$, sin necesidad de generarla todavía.

Esa predicción no es exacta cuando $\kappa$ depende de $v$ (modos 1, 3 y 4), así que después de generar el arco completo queda un **residual de cierre** — la vuelta real no cayó exactamente en `GiroObjetivo`. La capa 2 lo corrige iterando:

1. Generar el arco con el `AjusteCierre` actual restado al objetivo de giro (arranca en 0).
2. Medir el residual de cierre real, sobre la rotación de la tangente **dentro del plano de giro** (no el ángulo 3D total, que con torsión no vuelve exactamente al objetivo aunque el giro sí haya cerrado).
3. Si $\lvert$residual$\rvert <$ `Parametros.TolCierrePitch`, listo. Si no, `AjusteCierre += residual` (paso de secante) y se repite, hasta `Parametros.MaxIteracionesCierre`.

En modo `Clotoide` converge en la primera vuelta porque $\kappa$ no depende de $v$ y la predicción ya es exacta.

#### 4.1.3 Capa 1 — ajuste de forma: longitud de transición y torsión helicoidal

Esta es la capa más externa del proceso *nuclear* (§4.1 sin el método B) y envuelve a la 2 y 3 completas (cada iteración suya vuelve a correr un cierre de loop entero). Ajusta dos números a la vez:

**Longitud de las transiciones (`FactorLongitud`).** Las clotoides y la transición de roll se dimensionan por presupuesto de onset ([§7](#7-presupuesto-de-onset-y-longitudes-de-transición)): $L = v^3\lvert\Delta\kappa\rvert/(g\cdot\text{onset})$. Pero el onset que se mide sobre la geometría ya generada no es exactamente el que se pidió (la fórmula asume $v$ constante dentro de la transición, y no lo es). Punto fijo:
$$\text{FactorLongitud}_{siguiente} = (1+\text{margen})\cdot\text{FactorLongitud}\cdot\frac{\text{OnsetMedido}}{\text{OnsetMáximo}}$$
Es un punto fijo sobre el factor, **no** un corte al primer valor que cumple: cortar por cumplimiento haría que la geometría dependiera de forma discontinua de los datos de entrada, y ahí los métodos A y B dejarían de coincidir aunque los dos estén bien.

**Torsión helicoidal (`Inclinacion`), sólo si el elemento pide desplazamiento lateral.** Arranca en 0 y se corrige con un paso de Newton exacto (no un punto fijo genérico), porque el desplazamiento lateral es *exactamente* $\sin\alpha \cdot L_{giro}$, así que $L_{giro}$ es la pendiente:
$$\text{Inclinacion}_{siguiente} = \text{Inclinacion} + \frac{\text{DesplazamientoObjetivo} - \text{DesplazamientoLateralMedido}}{L_{giro}}$$
Converge en una o dos pasadas.

La capa termina cuando los dos números —`FactorLongitud` e `Inclinacion`— dejan de moverse entre una vuelta y la siguiente (`Parametros.MaxIteracionesAjuste` como tope).

Con esto termina el proceso del **Método A**: las capas 1 a 3 solas, una sola vez, evaluando los modos de curvatura dependientes de $v$ con la velocidad que trae la marcha en cada paso (`Punto.VelocidadParaCurvatura = Punto.Velocidad`). Es el método por defecto (`Parametros.MetodoDeAcoplamiento = 'A'`) y el que se usa en el 99% de las corridas: no hay nada más que envuelva a las tres capas de arriba.

#### 4.1.4 Método B — envoltura opcional de punto fijo sobre la velocidad

El **Método B** no es parte del proceso principal: es una envoltura *alternativa*, que se activa a mano con `Parametros.MetodoDeAcoplamiento = 'B'` (o `'Ambos'`, sólo para comparar en el reporte — la geometría que queda es siempre la de A). Sirve para separar la forma de la vía del perfil de velocidad, que es lo que hace falta si algún día se quiere imponer un perfil de diseño en vez del que sale solo, o resolver hacia atrás. Cuando se activa, en vez de correr las capas 1-3 una sola vez, las repite dentro de un punto fijo más:

1. Suponer un perfil $v(s)$ — arranca constante, $v(s) = v_0$.
2. Generar la geometría **completa** (las tres capas 1 a 3, de punta a punta) usando ese perfil supuesto en vez de la velocidad real para evaluar los modos de curvatura que dependen de $v$.
3. Tomar el $v(s)$ que resultó de esa geometría (el de la marcha real, no el supuesto).
4. Repetir con el nuevo perfil hasta que $\max\lvert v_{nuevo}(s) - v_{supuesto}(s)\rvert <$ `Parametros.TolPuntoFijo`.

El perfil viaja entre iteraciones como interpolante `pchip` precompilado (no lineal: la interpolación lineal metería un error de orden $\Delta s^2$ en los estadios intermedios de RK4 y separaría artificialmente los dos métodos). Las **longitudes** de las transiciones (capa 1) siempre se dimensionan con la velocidad real de la marcha, nunca con el perfil supuesto — lo que el perfil supuesto rompe es sólo el lazo de la *ley de curvatura*, no el dimensionamiento geométrico.

Es más caro (~6 s contra ~2 s de A, ver [§6](#6-los-dos-métodos-de-acoplamiento)) precisamente porque cada una de sus iteraciones vuelve a correr las tres capas del proceso principal completas. En modo `Clotoide` converge en 2 iteraciones y da resultado idéntico bit a bit al método A, porque ahí $\kappa$ no depende de $v$ (§6 tiene el detalle de esa equivalencia).

### 4.2 El loop no es plano

**Un giro de $2\pi$ contenido en un plano vuelve a pasar por donde entró.** No hay forma de evitarlo: la vía se choca consigo misma siempre. Por eso el elemento tiene una **inclinación helicoidal** y `SeparacionDePatas` no es opcional. (Un dive loop gira sólo $\pi$ y no llega a cruzarse, así que no la necesita.)

La construcción es una hélice de eje horizontal $\mathbf{B}$: se pide que la tangente mantenga $\mathbf{T}\cdot\mathbf{B} = \sin\alpha$ constante. Eso obliga a que el vector curvatura no tenga componente sobre $\mathbf{B}$, y de esa condición sale

$$\tau = \kappa\,\tan\alpha$$

o sea que la dirección de la curvatura tiene que girar dentro del marco de transporte **proporcionalmente al ángulo ya girado**, no al arco recorrido. La diferencia importa: con torsión constante el desplazamiento lateral deja de ser monótono en cuanto $\kappa$ varía —el loop se va para un lado y vuelve— y se sigue chocando. Con $\tau = \kappa\tan\alpha$ el desplazamiento vale exactamente $\sin\alpha \cdot L$ y es monótono por construcción.

Tres consecuencias que sirven de verificación:

1. **La tangente de salida es idéntica a la de entrada.** El elemento no cambia el rumbo: sólo desplaza la vía lateralmente.
2. **El carro sale derecho.** El número del roll no termina en cero (avanza con $\tan\alpha$ veces el giro), pero eso no es un peralte agregado: el roll se mide contra el marco de transporte, que gira respecto de la normal de la curva justamente a razón de la torsión. Seguir esa razón es mantener el eje "arriba" del carro alineado con el vector curvatura.
3. **La tangente gira $2\pi\cos\alpha$, no $2\pi$.** Recorre un círculo de radio $\cos\alpha$ sobre la esfera unitaria. El test 7 lo verifica.

$\alpha$ no se pide directamente: se pide el desplazamiento lateral y el generador lo resuelve con un paso de Newton, usando la longitud del loop como pendiente. El valor por defecto sale de la envolvente de la vía, de modo que siempre supere la separación exigida por el chequeo de interferencia.

### 4.3 Cierre del loop

El arco se corta cuando el ángulo ya girado más lo que va a girar la clotoide de salida llega a $2\pi$. Dos detalles importantes:

1. **El último paso del arco se acorta** para caer justo en el ángulo objetivo. Sin eso el corte queda cuantizado por el paso y el residual de cierre no puede bajar de $\kappa\,\Delta s$ — con $\kappa = 4.8$ y $\Delta s = 2$ mm eso son $10^{-2}$ rad.
2. La predicción del giro de la clotoide de salida no es exacta cuando la curvatura depende de $v$, así que el residual se **corrige por secante** y se **reporta siempre**. Nunca se asume cero.

---

## 5. Los cuatro modos de curvatura

| Modo | $\kappa$ | ¿Depende de $v$? |
|---|---|---|
| `AceleracionNormalConstante` | $a_n / v^2$ | sí |
| `Clotoide` | $1/R_{loop}$ (constante en el arco) | no |
| `FuerzaGConstante` | $g\,(G_{obj} - U_z)/v^2$ | sí |
| `GMaximas` | $g\,(G_{lim}(\text{duración}) - U_z)/v^2$ | sí |

$U_z$ (ver definición en [§3](#3-marco-de-referencia)) es la componente vertical del versor "arriba del carro", que en un loop plano vale $\cos\theta$. En la cúspide vale $-1$ y ahí $v$ es mínima, así que $\kappa$ es máxima: de ahí sale la **forma de lágrima** del loop clotoide real. Con el modo `Clotoide` sale un círculo, que es lo correcto para ese modo.

El modo `GMaximas` sigue el tiempo de exposición desde el comienzo del arco, lo convierte a duración equivalente del prototipo multiplicando por $\sqrt\lambda_{loop}$ y evalúa la curva límite ahí (fórmula de conversión de duración: [`memoria_de_calculo.md` §5.1](memoria_de_calculo.md#51-definiciones-normativas-aplicables)). La interfaz está completa; la lógica de seguimiento de exposición es la simplificación de tratar el arco como un único evento sostenido.

---

## 6. Los dos métodos de acoplamiento

En los modos que dependen de $v$, la forma depende de la velocidad, la velocidad de la energía, la energía de las pérdidas y las pérdidas de la normal, que depende de la forma. Los dos métodos comparten el mismo núcleo de generación.

| | Método A — marcha acoplada | Método B — punto fijo |
|---|---|---|
| Cómo | una sola pasada; con $v_k$ conocida se calcula $\kappa_k$, se propaga con RK4 y se actualiza la energía | se supone un perfil $v(s)$, se genera con él, se obtiene el $v(s)$ resultante y se repite |
| A favor | una pasada, sin criterio de convergencia que ajustar | separa la forma del perfil de velocidad, que es lo que hace falta para imponer un perfil de diseño o resolver hacia atrás |
| En contra | la geometría queda atada a la marcha | hay que iterar; con modos muy sensibles a $v$ puede necesitar relajación |
| Costo medido | ~2 s | ~6 s (2 iteraciones en modo clotoide, ~11 en los modos dependientes de $v$) |

El perfil supuesto viaja como **interpolante pchip precompilado**: con interpolación lineal, los estadios intermedios de RK4 metían un error de orden $\Delta s^2$ que separaba artificialmente los dos métodos.

**Resultado de la comparación.** Los dos métodos son matemáticamente equivalentes en el punto fijo: la diferencia entre ellos es de costo de cómputo y de flexibilidad, no de resultado. En modo `Clotoide` dan resultados **idénticos bit a bit** y el método B converge en 2 iteraciones.

---

## 7. Presupuesto de onset y longitudes de transición

$$L_{trans} = \frac{\Delta G\,v}{J_{max}} = \frac{v^3\,|\Delta\kappa|}{g\,J_{max}}$$

Las dos formas son la misma relación escrita al revés. El presupuesto del modelo sale de multiplicar el de la norma por $\sqrt{\lambda_{loop}}$: un modelo fiel a Froude produce jerk **mayor** que el prototipo, no menor (derivación completa en [`memoria_de_calculo.md` §7.1](memoria_de_calculo.md#71-por-qué-el-criterio-de-onset-cambia-entre-modelo-y-prototipo)).

La transición de roll se dimensiona por el onset lateral que produce la rotación sobre el cuerpo del pasajero. Con el smoothstep quíntico $\max|\phi'''| = 60|\Delta\phi|/L^3$, y la G lateral de un punto a distancia $e$ del eje de roll vale $e\,v^2\phi''/g$, así que:

$$L_{roll} = \left(\frac{60\,e\,v^3\,|\Delta\phi|}{g\,J_{y,max}}\right)^{1/3}$$

**El brazo de palanca es $e$ (`DistanciaEvaluacionPasajero`) y no $d$ (`DistanciaHeartline`).** El heartline es el eje de roll: un punto matemático ahí tiene brazo cero. Lo que justifica seguir limitando esto es que el pasajero no es un punto — cabeza y hombros quedan fuera del eje. Es el mismo $e$ con el que se evalúa la G reportada ([`memoria_de_calculo.md` §3.5](memoria_de_calculo.md#35-resultado-la-expresión-que-se-implementa)), y tiene que serlo: dimensionar la transición con un offset y después verificarla con otro no cierra.

**La fórmula supone $v$ constante dentro de la transición y por eso el onset resultante se pasa alrededor de un 1.5 %.** El generador cierra ese hueco con un punto fijo sobre un factor de longitud, y el reporte informa el margen que quedó. El punto fijo es sobre el factor y no un corte al primer valor que cumple: cortar por cumplimiento haría que la geometría dependiera de forma **discontinua** de los datos de entrada, y ahí los dos métodos dejan de coincidir aunque los dos estén bien.

Las longitudes de transición se dimensionan con la **velocidad real de la marcha**, no con el perfil supuesto del método B. Son decisiones geométricas de diseño; lo que el perfil supuesto rompe es el lazo de la *ley de curvatura*.

---

## 8. Chequeos de factibilidad

Están separados en dos grupos, y la separación es deliberada:

- **`ChequeosPrevios`** — dependen sólo del estado de entrada y de los parámetros: tangente no vertical, pitch de entrada, curvatura dentro y fuera del plano, compatibilidad de roll, estimación energética a priori, altura y radio nominales.
- **`ChequeosPosteriores`** — necesitan la geometría: radio alcanzado, altura real, suelo, bounding box, interferencia y límites normativos.

**Qué curva usa cada chequeo posterior no es intercambiable** ([§14](#14-el-modelo-de-heartline-tres-curvas)):

| Chequeo | Curva | Por qué |
|---|---|---|
| Radio mínimo fabricable | Riel | Lo limita la impresora, y lo que se imprime es el riel |
| Autointerferencia e interferencia con el layout | Riel | Chocan las piezas físicas; el heartline es un lugar geométrico y no ocupa lugar |
| Bounding box y altura sobre el suelo | Riel | Es la pieza que puede tocar el piso o pasarse de la huella |
| Radio alcanzado contra el nominal | Heartline | Es intención de diseño: los modos resuelven el radio para la G del pasajero |
| Altura del elemento | Heartline | Se mide sobre la trayectoria de diseño, respecto de su punto de entrada |
| Límites normativos y presupuesto de onset | Punto de evaluación | Es lo que siente el pasajero, que es lo que la norma limita |

La consigna del proyecto pide que los chequeos corran "antes de generar". Los del segundo grupo **no se pueden evaluar sin la geometría**, y la velocidad mínima por bisección requiere generar decenas de veces. Se declara la distinción en vez de fingir lo contrario (ver también [§13](#13-discrepancias-con-la-consigna)).

### 8.1 Interferencia

Distancia mínima **segmento a segmento** entre polilíneas: punto a punto subestima el acercamiento, porque dos vías que se cruzan pueden tener todos sus nodos lejos y aun así tocarse entre nodos. Tres chequeos: autointerferencia (excluyendo pares vecinos por longitud de arco), contra la vía preexistente del layout, y suelo.

La envolvente **no es un ancho escalar**: es una sección orientada que rota con el roll. Se usa la simplificación conservadora del cilindro circunscripto para el criterio de pasa/no pasa, y además se reporta la separación que exigiría la sección orientada en el par crítico, calculada con la función soporte de la caja.

### 8.2 Velocidad inicial mínima

Por bisección, con criterio combinado de G mínima sobre el eje vertical del carro **y** radio mínimo fabricable. El criterio no es $F_N = 0$ (colisión de símbolos #6 resuelta, ver [`NOMENCLATURA.md`](NOMENCLATURA.md#0-colisiones-resueltas)): con ruedas de retención el carro no se cae, pero un margen nulo no tolera variación de fricción ni de temperatura. El radio entra al criterio porque en los modos que fijan la G objetivo la geometría se adapta a la velocidad y la G en la cúspide no cambia, así que la restricción que termina mordiendo es de fabricación y no energética.

---

## 9. Límites normativos

Cada curva de las Figs. 6 a 10 está implementada como interpolación lineal por tramos $G_{lim} = f(\text{duración})$ (tabuladas en [`memoria_de_calculo.md` §5.2 a §5.6](memoria_de_calculo.md#5-criterios-de-aceptación--astm-f2291-06a-7)). El límite **no es puntual**: para cada nivel $G^*$ se mide la duración del evento sostenido en que $G \geq G^*$ y se evalúa la curva ahí, con la duración ya convertida a equivalente real ($\times\sqrt{\lambda_{loop}}$, fórmula unificada en [`memoria_de_calculo.md` §5.1](memoria_de_calculo.md#51-definiciones-normativas-aplicables)), y los eventos de menos de 200 ms se descartan (§7.1.4.2).

También se verifican la elipse de dos ejes de §7.1.5.1 — con el semieje del signo correcto en cada eje, porque $+G_z$ admite 6 G y $-G_z$ sólo 2 — y el onset de §7.1.7.2, evaluado con su **alcance literal**: sólo transiciones desde 0 G o menos hacia 2 G o más.

Los gráficos de G llevan la banda de límite superpuesta, evaluada punto a punto con la duración del evento sostenido que contiene a cada nodo. Una curva desnuda no dice si el diseño pasa o no.

---

## 10. Escalado

`RadioDelLoop` y `LargoCarro` son parámetros **independientes** y cada uno tiene su propio $\lambda$ (definiciones completas en [`memoria_de_calculo.md` §9.4](memoria_de_calculo.md#94-λ-no-es-una-propiedad-del-modelo)). No hay ningún $\lambda$ único cableado. Se reporta la distorsión $\lambda_{carro}/\lambda_{loop}$ y el equivalente en carros reales — fórmulas explícitas en [`memoria_de_calculo.md` §9.6](memoria_de_calculo.md#96-qué-conserva-y-qué-pierde-el-modelo-distorsionado) y en [`NOMENCLATURA.md` bloque 6](NOMENCLATURA.md#6-escalado-y-semejanza).

---

## 11. Tests de validación

`TestsValidacion.m` implementa **diez** tests y termina con error si alguno falla. Todos pasan por la API pública de los elementos, para que lo que se verifica sea el mismo camino que usa el usuario.

| # | Test | Resultado típico |
|---|---|---|
| 1 | Conservación de energía sin pérdidas contra $v^2 = v_0^2 - 2gh$ | error relativo $6\times10^{-9}$ |
| 2 | Curvatura impuesta contra recuperada de la polilínea | error relativo $2\times10^{-5}$ |
| 3 | Residual del endpoint y desplazamiento lateral | tangente $8.8\times10^{-5}$, desplazamiento lateral dentro del 0.01 % del objetivo |
| 4 | Continuidad en el empalme | los tres saltos exactamente 0 |
| 5 | Equivalencia de métodos A y B en modo clotoide | diferencia exactamente 0 |
| 6 | Ortonormalidad del marco | desvío $8\times10^{-13}$ |
| 7 | Cierre del loop de 360° | pitch final $-6\times10^{-5}$ rad; ángulo girado dentro de $6\times10^{-5}$ rad de $2\pi\cos\alpha$ |
| 8 | Los cuatro elementos generan y encadenan (loop, over-banked turn, hélice, dive loop en secuencia) | peor residual de cierre y peor salto de empalme, ambos por debajo de tolerancia; velocidad final finita |
| 9 | Derivación del riel desde el heartline: separación constante y $R_{riel}=R+d$ | separación exacta a $1.3\times10^{-15}$ m; diferencia de radios dentro del 0.7 % de $d$ |
| 10 | Transporte de cuerpo rígido al punto del pasajero | con $e=0$ se reduce a la G del heartline con error $2\times10^{-16}$ G; con $e$ real la rotación aporta hasta 0.49 G |

**Nota de discrepancia doc↔código corregida.** Una versión anterior de este documento decía en prosa "los ocho son ejecutables" pero la tabla sólo listaba siete filas, sin el test de encadenamiento. Se corrigió agregando la fila que faltaba. Hoy son **diez**: los tests 9 y 10 se agregaron junto con el modelo de heartline de [§14](#14-el-modelo-de-heartline-tres-curvas).

**Test 2 excluye los nodos cuyo esquema de tres puntos cruza una frontera de sub-tramo.** Ahí $d\kappa/ds$ salta y la circunferencia por tres puntos devuelve un promedio de dos curvaturas distintas: el error sube a $4.6\times10^{-3}$. Es una limitación del estimador discreto, no de la geometría generada — y es exactamente la fragilidad que ya documenta [`documentacion_analisis_energia.md` §4](documentacion_analisis_energia.md#4-radio-de-giro-curvatura-local).

**Test 3 no compara contra el punto de entrada.** Un loop con clotoides de entrada y salida de distinta longitud no vuelve a su propio arranque. Lo que sí tiene que cerrar es la dirección de la tangente tras la vuelta completa; el desplazamiento lateral tampoco es un residual sino el objetivo de diseño que evita la autointerferencia, así que se verifica contra el valor pedido.

**Test 8** verifica específicamente el contrato de encadenamiento: cada elemento consume el `EstadoSalida` del anterior sin salto de posición ni de tangente, que es lo que sostiene todo `DemoLayout.m` y, a futuro, cualquier layout con más elementos.

**Tests 9 y 10 cubren el modelo de heartline** ([§14](#14-el-modelo-de-heartline-tres-curvas)). El 9 verifica que el riel sale del heartline con la separación y el **signo** correctos: $R_{riel}=R+d$ y no $R-d$, que es lo que distingue diseñar para el pasajero de diseñar para el riel. El 10 verifica las dos caras del transporte de cuerpo rígido: que con brazo nulo se reduzca exactamente a la G del heartline —o sea que la fórmula general no introdujo nada espurio— y que con brazo real la rotación aporte de verdad. Si ese segundo aporte diera cero, el modelo estaría afirmando que rolear no se siente.

---

## 12. Hallazgos de ingeniería

### 12.1 Un loop plano de 360° se cruza consigo mismo — resuelto

Antes de introducir la inclinación helicoidal, el chequeo de autointerferencia fallaba en **todos** los casos, con distancia mínima del orden de $10^{-19}$ m: la pata de salida cruzaba la de entrada. No era un error del chequeo —está validado contra casos de distancia conocida— ni de la geometría: es intrínseco a un giro de $2\pi$ dentro de un plano.

Está resuelto con la construcción helicoidal de la [sección 4.2](#42-el-loop-no-es-plano). Con el desplazamiento lateral por defecto (16 cm, derivado de la envolvente) el caso de la demo pasa el chequeo con 0.142 m de separación libre contra 0.133 m exigidos, y **ningún criterio queda en falla**.

El costo es un ángulo de hélice de unos 7–8°, que es del mismo orden que el de un loop comercial. La inclinación es un parámetro reportado, no un número escondido.

### 12.2 Un loop circular no puede cumplir las dos puntas a la vez

Sin pérdidas, para un loop circular de radio $R$ vale $v_{abajo}^2 = v_{arriba}^2 + 4gR$, y de ahí:

$$G_{abajo} = \frac{v_{abajo}^2}{gR} + 1 = \frac{v_{arriba}^2}{gR} - 1 + 6 = G_{arriba} + 6$$

**La diferencia es exactamente 6 G, independiente de $R$ y de $v$.** Con el criterio de $G_{arriba} \geq 0.5$ queda $G_{abajo} \geq 6.5$, por encima del límite de 6.0 G de la Fig. 10 aun en su punto más permisivo. Un loop circular no puede satisfacer los dos criterios simultáneamente: por eso los loops reales son clotoides. El modo `FuerzaGConstante` resuelve el problema y produce la forma de lágrima característica.

### 12.3 Dos ángulos de roll distintos, y sólo uno se ve en la vía

`Track.AnguloRoll` está medido **contra el marco de transporte paralelo**, que va girando por su cuenta a razón de la torsión. En un loop helicoidal ese número termina en unos 48°, y sin embargo el carro sale perfectamente derecho: lo que giró fue la referencia, no el carro.

Por eso se reporta y grafica también `Track.AnguloPeralte`, que es el mismo roll medido **contra la vertical** —el que se ve mirando la vía— y termina en cero. Los dos aparecen juntos en el gráfico de roll, y la vista 3D de orientación dibuja los versores $\mathbf{U}$ y $\mathbf{L}$ sobre la trayectoria, que es la forma directa de ver hacia dónde apunta el carro.

### 12.4 $G_x$ casi no depende de la aceleración tangencial

Parece raro que $G_x$ salga casi plana cuando la aceleración tangencial varía mucho a lo largo del recorrido. Sale de la definición:

$$G_x = \frac{a_t}{g} + T_z, \qquad a_t = -g\,T_z - \frac{F_{res}}{m} \quad\Longrightarrow\quad G_x = -\frac{F_{res}}{m\,g}$$

**La componente de la gravedad a lo largo de la vía se cancela exactamente contra la aceleración tangencial que ella misma produce.** Lo único que queda es la resistencia al avance. Tiene sentido físico: un acelerómetro montado en el carro, sobre vía sin rozamiento, no mide nada en el eje longitudinal, igual que un cuerpo en caída libre no mide nada. Que $G_x$ valga alrededor de $-0.1$ G y varíe poco es la confirmación de que el modelo está bien planteado, no un error.

### 12.5 `RadioDeReferencia` es una entrada que en tres de los cuatro modos describe una salida

`RadioDeReferencia` (pisado por `RadioDelLoop` en el caso del loop vertical) es la longitud característica de Froude: fija $\lambda_{loop}$ y con él el presupuesto de onset y la conversión de duraciones contra las curvas normativas. Pero en los modos que dependen de $v$ el radio de cúspide **sale** de la integración. Si el nominal y el alcanzado se apartan, esos dos números se calcularon con la longitud de referencia equivocada. Hay un chequeo posterior que lo detecta y avisa.

---

## 13. Discrepancias con la consigna

| Punto | Qué dice la consigna | Qué se implementó y por qué |
|---|---|---|
| Carros equivalentes | `CarrosEquivalentes = NumeroDeCarros * distorsion` | `NumeroDeCarros / distorsion`. Con carro de 10 cm y loop de 50 cm la memoria de cálculo ([§9.6](memoria_de_calculo.md#96-qué-conserva-y-qué-pierde-el-modelo-distorsionado)) da 2.3 carros reales; la fórmula de la consigna da 0.44. Un carro del modelo escalado por $\lambda_{loop}$ representa un largo $L\lambda_{loop}$, que dividido por el carro real $L\lambda_{carro}$ da $\lambda_{loop}/\lambda_{carro} = 1/\text{distorsión}$ |
| Equivalencia A/B en modo clotoide | "idénticos salvo error de máquina, porque en ese modo $\kappa$ no depende de $v$" | Cierto para $\kappa$, pero las **longitudes de las clotoides sí dependen de $v$**, porque salen del presupuesto de onset. Se resolvió dimensionándolas con la velocidad real de la marcha en vez del perfil supuesto, y entonces sí son idénticas bit a bit |
| Chequeos "antes de generar" | todos los chequeos corren antes de construir la geometría | Los de interferencia, radio real, altura alcanzada y límites normativos necesitan la geometría; la velocidad mínima por bisección necesita generar decenas de veces. Se separaron en `ChequeosPrevios` y `ChequeosPosteriores` |

---

## 14. El modelo de heartline: tres curvas

Esta sección responde qué curva es "la vía", porque son tres y confundirlas es el error que este modelo existe para evitar.

### 14.1 Las tres curvas y qué gobierna cada una

| Curva | Campo en el código | Qué gobierna |
|---|---|---|
| Heartline $\mathbf{r}(s)$ | `Track.PuntosHeartline` | Curva integrada, eje de roll, centro de masa supuesto. Energía, rodadura, `FuerzaNormal` |
| Punto de evaluación $\mathbf{r}+e\mathbf{U}$ | — (se evalúa al vuelo) | `Sim.Gx/Gy/Gz` y toda la verificación normativa |
| Riel $\mathbf{r}-d\mathbf{U}$ | `Track.PuntosRiel` | Fabricación, interferencia, bounding box, altura sobre el suelo, radio mínimo imprimible |

### 14.2 Por qué el heartline es la curva integrada y no el riel

Los modos de curvatura resuelven $\kappa = g(G_{obj}-U_z)/v^2$ sobre la curva que se está integrando. Si esa curva es el riel, el radio queda dimensionado para que el **riel** reciba $G_{obj}$ y el pasajero recibe otra cosa, porque recorre otro radio. Integrando el heartline, la misma fórmula —sin cambiar un signo— dimensiona el radio para el **pasajero**, que es lo que interesa.

La diferencia entre los dos radios vale $d$ en valor absoluto y $d/R$ en relativo. El heartline queda del lado del centro de curvatura, así que $R_{riel} = R + d$: con el radio de cúspide de 0.11 m del loop y $d = 3$ cm, **27 %**. El test 9 de `TestsValidacion.m` verifica esa relación sobre la geometría generada y da 0.7 % de desvío.

### 14.3 La velocidad angular tiene dos aportes, no uno

La G del pasajero sale por transferencia de cuerpo rígido desde el heartline hasta el punto de evaluación, con la velocidad angular **completa** del marco del carro:

$$\boldsymbol\omega = v\,\big(\underbrace{\mathbf{T}\times\boldsymbol\kappa}_{\text{giro del marco de transporte}} + \underbrace{\phi'\,\mathbf{T}}_{\text{roll}}\big)$$

Quedarse sólo con el segundo término —que es lo que hacía la versión anterior— pierde los términos cruzados entre curvatura y roll, que son los que dominan justo donde la vía curva y rola **a la vez**: over-banked turn y dive loop. Medido sobre el over-banked turn de 120° con peralte de 110°, el aporte total de rotación llega a **0.49 G**.

Se evalúa numéricamente sobre la polilínea ya construida y no analíticamente, porque $\phi''$ del tramo helicoidal depende de $d\kappa/ds$, que no está disponible dentro del paso de integración. Derivación completa en [`memoria_de_calculo.md` §3.5](memoria_de_calculo.md#35-resultado-la-expresión-que-se-implementa).

### 14.4 Por qué la rotación no se anula aunque el pasajero esté sobre el eje

Un punto **matemático** sobre el eje de roll no recibe aporte de esa rotación: es el punto fijo del giro. Pero el pasajero no es un punto — cabeza y hombros quedan fuera del eje, con brazo $e$, y sí la sienten. Anular el término equivaldría a afirmar que rolear no se siente.

Lo que el heartlineado logra no es eliminar el efecto sino **minimizarlo**: pone al pasajero lo más cerca posible del eje de rotación en vez de hacerlo orbitar alrededor del riel. Por eso $e$ (`DistanciaEvaluacionPasajero`) y $d$ (`DistanciaHeartline`) son parámetros separados: $d$ es geometría de la vía, $e$ es confort. El valor por defecto de $e$ **está sin cerrar** — reproduce la geometría previa a esta corrección, no una medida antropométrica. A escala $\lambda\approx22$, un offset cabeza-corazón real de ~0.25 m daría $e\approx0.011$ m.

### 14.5 Lo que queda abierto

Para la rotación pura, el criterio normativo propio es un límite de **velocidad angular** del carro (ASTM F2291 §7.1.6), no un offset equivalente. Hoy la rotación entra sólo a través del brazo $e$, tanto para reportar la G como para dimensionar la transición de roll ([§7](#7-presupuesto-de-onset-y-longitudes-de-transición)). Cerrar $e$ contra una medida antropométrica, o reemplazar el criterio por el límite de velocidad angular, son las dos salidas posibles y ninguna está tomada.

---

## 15. Otras limitaciones y próximos pasos

- **§7.1.7.1 simplificada.** Si aparece un evento de $-G_z$ de más de 3 s, se aplica la columna reducida de $+G_z$ a todo el elemento en vez de arrastrar el reloj de los 6 s. Es conservador y evita que el reloj cruce entre elementos.
- **Modelo de partícula.** El tren se trata como un punto. Con $n_{carros}$ carros la velocidad es común y la altura relevante es la del conjunto; la arquitectura está preparada para $n_{carros}>1$ pero el reparto no está.
- **Centro de masa supuesto en el heartline.** Las fuerzas (rodadura, `FuerzaNormal`) se calculan como $m(\mathbf{a}_{cm}-\mathbf{g})$ con el centro de masa sobre el heartline. El centro de masa real está más abajo, entre el heartline y el riel, porque el chasis y las ruedas pesan. El error que mete es de orden $d/R$ sobre la rodadura — pocos por ciento — muy por debajo de la incertidumbre de los $C_{rr}$, que están sin calibrar. Sobre la G del pasajero **no** aplica esa disculpa, y por eso ahí sí se hace el transporte completo ([§14.3](#143-la-velocidad-angular-tiene-dos-aportes-no-uno)).
- **Criterio de rotación por offset equivalente.** La rotación entra en la G del pasajero y en la longitud de transición de roll a través del brazo $e$, que está **sin cerrar**. El criterio normativo propio de la rotación pura es un límite de velocidad angular (ASTM F2291 §7.1.6). Ver [§14.5](#145-lo-que-queda-abierto).
- **Reparto entre juegos de ruedas — específico de este script.** En el generador de elementos (`Fisica/CargasEnLaVia.m` y `Fisica/ResistenciaAlAvance.m`) el reparto **ya se hace correctamente**, proyectando la normal sobre $\mathbf{U}$ y $\mathbf{L}$ del marco del carro: la componente sobre $\mathbf{U}$ va a las portantes si es positiva y a las de retención si es negativa, y la componente sobre $\mathbf{L}$ va a las de guía (código verificado: `ResistenciaAlAvance.m` líneas 10–12). Esto es distinto de lo que hace el script `analisis_energia.m` de la raíz del repo, que todavía asume peralte perfecto (ver [`documentacion_analisis_energia.md` §8](documentacion_analisis_energia.md#8-modelo-de-resistencia-al-avance)) — son dos scripts separados y esta sección se refiere únicamente al generador. Los tres $C_{rr}$ y el $C_d$ siguen siendo provisorios y **requieren calibración experimental**.
- **Modo inverso**, elemento conector y tren de $n_{carros}>1$ quedan fuera de alcance, igual que el backend web.
- **Modo `GMaximas`**: la interfaz está completa pero el seguimiento de duración de exposición trata el arco como un único evento sostenido.
