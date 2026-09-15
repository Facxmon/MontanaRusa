# Memoria de cálculo — criterios de diseño del constructor de elementos

Documento de criterios y derivaciones: **por qué** se adoptó cada decisión de diseño, no cómo está implementada.
Complementa a [`documentacion_generador_elementos.md`](documentacion_generador_elementos.md) (documenta el
generador de geometría) y a [`documentacion_analisis_energia.md`](documentacion_analisis_energia.md) (documenta
el script de análisis energético preliminar); acá va la fundamentación de los criterios que esos dos scripts
tienen que respetar. Ver [`NOMENCLATURA.md`](NOMENCLATURA.md) para la tabla completa de símbolos.

**Glosario rápido de términos en inglés** usados en este documento: *heartline* (línea imaginaria a la altura del
torso del pasajero; en este modelo es la curva que recorre su centro de masa, derivada del riel a distancia $d$ sobre
$\mathbf{U}$, y donde se aplica la norma), *heartlining* (práctica de diseñar haciendo que el eje de roll pase por el
pasajero en vez de por el riel, para que rolar no lo latiguee; en este modelo el eje de roll es el riel y la heartline
rota alrededor de él, que es lo que ocurre en un vehículo real sobre un riel dado), *airtime* (sensación de ingravidez, $G_z<1$),
*over-banked turn* (curva peraltada más de 90°), *dive loop* (media vuelta que invierte al pasajero de cabeza
hacia abajo), *up-stop* (rueda de retención que evita que el carro se despegue de la vía), *Force Vector Design*
(metodología de diseño que parte del perfil de fuerzas deseado y deriva la geometría, en vez de al revés),
*smoothstep* (perfil de transición suave entre dos valores, con derivadas nulas en los extremos).

## Símbolos usados en este documento

| Símbolo | Significado | Unidad |
|---|---|---|
| $C^n$ | continuidad paramétrica de orden $n$ | — (adimensional, orden) |
| $\mathcal{G}^n$ | continuidad geométrica de orden $n$ (no confundir con $G$, fuerza G — colisión resuelta, ver [`NOMENCLATURA.md`](NOMENCLATURA.md#0-colisiones-resueltas)) | — |
| $\kappa$ | curvatura de la vía | 1/m |
| $\tau$ | torsión de la vía | 1/m |
| $\mathbf{T},\mathbf{U}_{pt},\mathbf{L}_{pt}$ | marco de transporte paralelo (tangente, arriba, lateral) | — (versores) |
| $\mathbf{U},\mathbf{L}$ | marco del carro (arriba, lateral) | — (versores) |
| $\phi(s)$ | ángulo de roll, $\phi',\phi''$ sus derivadas | rad, rad/m, rad/m² |
| $\mathbf{r}(s)$ | riel: la curva que integra el generador, eje de roll y pieza que se fabrica | m |
| $\mathbf{r}_h(s)$ | heartline, $\mathbf{r} + d\,\mathbf{U}$: centro de masa del pasajero, donde se aplica la norma | m |
| $\mathbf{p}(s)$ | cabeza del pasajero, $\mathbf{r} + (d+e)\,\mathbf{U}$ | m |
| $d$ | offset riel → heartline (centro de masa del pasajero) | m |
| $e$ | offset heartline → cabeza (chequeo de rotaciones) | m |
| $b$ | brazo de verificación: $d$, o $d+e$ si la norma se verifica en la cabeza | m |
| $J$ | $\lVert d\mathbf{r}_h/ds\rVert$, razón entre la velocidad del centro de masa y la del punto del riel | — |
| $\boldsymbol\omega,\dot{\boldsymbol\omega}$ | velocidad y aceleración angular del marco del carro | rad/s, rad/s² |
| $\Omega_T$ | componente de $\boldsymbol\omega$ sobre $\mathbf{T}$ (roll) | rad/s |
| $\kappa_u,\kappa_l$ | componentes de $\boldsymbol\kappa$ sobre $\mathbf{U}$ y $\mathbf{L}$ | 1/m |
| $G_x,G_y,G_z$ | fuerza G en los ejes del pasajero | G |
| $Fr$ | número de Froude | — |
| $\lambda,\lambda_{loop},\lambda_{carro}$ | factores de escala | — |
| $J$ (onset/jerk) | tasa de aparición de G | G/s |
| $L_{trans}$ | longitud de transición (clotoide) | m |
| $H_{loop}$ | altura total del loop | m |
| $L_{carro}$ | largo del carro | m |
| $R$ | radio de curvatura de la vía (a secas: nunca radio de rueda) | m |
| $R_{rueda}$ | radio de rueda | m |
| $M_b$ | torque de fricción del rodamiento | N·m |
| $\mu_b$ | coeficiente de fricción interna del rodamiento | — |
| $r_{eje}$ | radio del eje dentro del rodamiento | m |

Ver la tabla completa y la resolución de las nueve colisiones de símbolos en [`NOMENCLATURA.md`](NOMENCLATURA.md).

## Índice

1. [Continuidad paramétrica y geométrica](#1-continuidad-paramétrica-y-geométrica)
2. [Marco de referencia de la vía](#2-marco-de-referencia-de-la-vía)
3. [Cinemática de heartline](#3-cinemática-de-heartline)
4. [Semejanza de Froude](#4-semejanza-de-froude)
5. [Criterios de aceptación — ASTM F2291-06a §7](#5-criterios-de-aceptación--astm-f2291-06a-7)
6. [Política de continuidad por eje](#6-política-de-continuidad-por-eje)
7. [Longitudes de transición: derivación y escalado](#7-longitudes-de-transición-derivación-y-escalado)
8. [Resumen de criterios adoptados](#8-resumen-de-criterios-adoptados)
9. [Dimensionamiento del carro](#9-dimensionamiento-del-carro)
10. [Pendientes que bloquean el dimensionamiento](#10-pendientes-que-bloquean-el-dimensionamiento)
11. [Datos pendientes de verificación](#11-datos-pendientes-de-verificación)

---

## 1. Continuidad paramétrica y geométrica

### 1.1 Definiciones

**Continuidad paramétrica $C^n$.** Las derivadas de la curva respecto del parámetro coinciden hasta orden $n$ en el punto de empalme.

- $C^0$: coincide la posición
- $C^1$: coincide el vector velocidad — módulo **y** dirección
- $C^2$: coincide el vector aceleración
- $C^3$: coincide el jerk

**Continuidad geométrica $\mathcal{G}^n$.** Coinciden las propiedades geométricas del trazo, independientemente de a qué velocidad se lo recorra. (No confundir $\mathcal{G}^n$, continuidad geométrica, con $G$, fuerza G — ver la colisión de símbolos #7 resuelta en [`NOMENCLATURA.md`](NOMENCLATURA.md#0-colisiones-resueltas).)

- $\mathcal{G}^0$: coincide la posición
- $\mathcal{G}^1$: coincide la **dirección** tangente (los módulos pueden diferir)
- $\mathcal{G}^2$: coincide el vector curvatura
- $\mathcal{G}^3$: coincide la torsión

### 1.2 Relación entre ambas

$$C^n \implies \mathcal{G}^n, \qquad \mathcal{G}^n \nRightarrow C^n$$

$C^n$ es la condición **más fuerte**. La implicación se ve directamente en la definición de curvatura:

$$\kappa = \frac{\lVert \mathbf{r}'\times\mathbf{r}''\rVert}{\lVert\mathbf{r}'\rVert^3}$$

Si $\mathbf{r}'$ y $\mathbf{r}''$ son continuas y $\mathbf{r}' \neq \mathbf{0}$, entonces $\kappa$ es continua.

**Excepción — parametrización no regular.** Si la velocidad paramétrica se anula ($\mathbf{r}' = \mathbf{0}$), la expresión queda $0/0$ y la implicación se rompe: se puede construir una curva $C^\infty$ con una esquina geométrica visible (cúspide). Por eso la implicación exige parametrización regular.

### 1.3 Qué se exige en este proyecto

Una vía física **no tiene parametrización**: es una curva en el espacio. $C^n$ es una afirmación sobre una parametrización elegida; $\mathcal{G}^n$ es una afirmación sobre el objeto físico.

Como toda la discretización de este proyecto es **por longitud de arco** $s$, en esa parametrización $\lVert\mathbf{r}'(s)\rVert = 1$ idénticamente. La parametrización es regular por construcción, y por lo tanto:

$$C^n \Longleftrightarrow \mathcal{G}^n \quad \text{(en parametrización por longitud de arco)}$$

Exigir $\mathcal{G}^2$ por longitud de arco es exactamente equivalente a exigir $C^2$. No es una condición más débil.

### 1.4 El roll es un grado de libertad aparte

La clasificación $C^n/\mathcal{G}^n$ describe la **curva central**. Una vía tiene un grado de libertad más: la rotación de la sección alrededor de la tangente, el ángulo de roll $\phi(s)$.

Ningún nivel de continuidad de la curva restringe $\phi$. Por eso la especificación tiene dos partes independientes: continuidad de la curva **y** continuidad del roll.

**Torsión ≠ roll.** La torsión $\tau$ es la tasa a la que gira el plano osculador de la curva; es una propiedad de la curva y aparece en el nivel $\mathcal{G}^3$. El roll es la orientación de la sección de vía. En un loop vertical planar $\tau = 0$ en todo el recorrido y sin embargo el roll puede estar haciendo cualquier cosa. Son objetos distintos.

---

## 2. Marco de referencia de la vía

### 2.1 Por qué Frenet-Serret no sirve

El marco de Frenet-Serret define la terna local a partir de la geometría de la curva:

$$\mathbf{T} = \frac{\mathbf{r}'}{\lVert\mathbf{r}'\rVert}, \qquad \mathbf{N} = \frac{\mathbf{T}'}{\lVert\mathbf{T}'\rVert}, \qquad \mathbf{B} = \mathbf{T}\times\mathbf{N}$$

($\mathbf{N}$ acá es el versor normal de Frenet, uso confinado a esta sección — no es la fuerza normal ni `NumeroDeCarros`, ver colisión #6 en [`NOMENCLATURA.md`](NOMENCLATURA.md#0-colisiones-resueltas).)

Tiene dos fallas que lo descalifican como marco de una vía:

**Falla 1 — indefinido donde $\kappa = 0$.** La normal se define dividiendo por $\lVert\mathbf{T}'\rVert = \kappa$. En un tramo recto $\kappa = 0$ y la división es $0/0$: la normal no existe. Y no es un caso raro: aparece en **todos** los tramos rectos, y en el punto medio de cualquier clotoide que cruce por curvatura nula.

**Falla 2 — salto de 180° en las inflexiones.** La normal de Frenet siempre apunta hacia el centro de curvatura. Cuando la vía pasa de curvar hacia un lado a curvar hacia el otro, el centro de curvatura salta al lado opuesto y $\mathbf{N}$ se invierte instantáneamente.

Consecuencia física de la falla 2: si el marco del carro se derivara de Frenet, en cada inflexión el carro haría un tonel de 180° instantáneo. Numéricamente es peor todavía, porque cerca de la inflexión $\kappa$ es chico y $\mathbf{N}$ oscila con el ruido de redondeo.

### 2.2 Marco de transporte paralelo

La alternativa es un **marco de transporte paralelo** (rotation-minimizing frame, o marco de Bishop). En vez de definir la normal por la curvatura, se la transporta a lo largo de la curva minimizando el giro alrededor de la tangente.

Se elige una normal arbitraria $\mathbf{U}_0$ perpendicular a $\mathbf{T}_0$ en el punto inicial, y en cada paso se la rota **sólo lo mínimo necesario** para que siga siendo perpendicular a la nueva tangente. La rotación en cada paso es la que lleva $\mathbf{T}_k$ a $\mathbf{T}_{k+1}$ por el camino más corto, aplicada también a $\mathbf{U}$.

Propiedades:

| | Frenet | Transporte paralelo |
|---|---|---|
| Definido con $\kappa = 0$ | No | Sí |
| Continuo en inflexiones | No | Sí |
| Depende de la historia | No | Sí (hay que integrarlo) |
| Roll respecto del marco | Implícito y descontrolado | Explícito, es $\phi(s)$ |

La tercera fila es el costo: el marco de transporte paralelo depende del camino recorrido, así que hay que propagarlo secuencialmente y no se puede evaluar en un punto aislado. Es exactamente el mismo tipo de cadena que ya tiene el cálculo de energía.

La cuarta fila es la ventaja decisiva: el marco de transporte paralelo da una **referencia neutra sin giro propio**, y encima de ella el ángulo de roll $\phi(s)$ es una función que el diseñador escribe explícitamente. Se separa lo que impone la geometría de lo que decide el diseñador.

**Track.AnguloRoll vs. Track.AnguloPeralte — la distinción se adelanta acá.** El generador de elementos reporta dos ángulos de roll distintos, y conviene tenerlos claros antes de seguir: `Track.AnguloRoll` es $\phi(s)$ medido **contra el marco de transporte paralelo** (el que acabamos de definir), mientras que `Track.AnguloPeralte` es el mismo roll medido **contra la vertical real** — el que se ve mirando la vía. Como el marco de transporte gira por su cuenta a razón de la torsión $\tau$, `Track.AnguloRoll` puede terminar en decenas de grados mientras `Track.AnguloPeralte` es cero: lo que giró fue la referencia, no el carro. El detalle completo, con el caso numérico del loop helicoidal, está en [`documentacion_generador_elementos.md` §12.3](documentacion_generador_elementos.md#123-dos-ángulos-de-roll-distintos-y-sólo-uno-se-ve-en-la-vía).

### 2.3 Marco del carro

$$\mathbf{U}(s) = \cos\phi(s)\,\mathbf{U}_{pt}(s) + \sin\phi(s)\,\mathbf{L}_{pt}(s)$$
$$\mathbf{L}(s) = -\sin\phi(s)\,\mathbf{U}_{pt}(s) + \cos\phi(s)\,\mathbf{L}_{pt}(s)$$

con $\{\mathbf{T},\mathbf{U}_{pt},\mathbf{L}_{pt}\}$ el marco de transporte paralelo y $\{\mathbf{T},\mathbf{U},\mathbf{L}\}$ el marco del carro.

Sobre este marco se descomponen las G en los ejes del pasajero:

$$G_x = \frac{\mathbf{a}_{total}\cdot\mathbf{T}}{g}, \qquad G_y = \frac{\mathbf{a}_{total}\cdot\mathbf{L}}{g}, \qquad G_z = \frac{\mathbf{a}_{total}\cdot\mathbf{U}}{g}$$

Sin este marco no hay forma de comparar contra los límites de la norma, que están definidos por eje del pasajero.

---

## 3. Cinemática de heartline

### 3.1 Planteo: tres curvas, no una

El error conceptual que hay que evitar acá es tratar "la vía" como una sola curva. Son tres, con tres roles distintos, y confundirlas mete errores de hasta el 27 % en la G calculada.

| Curva | Definición | Qué gobierna |
|---|---|---|
| **Riel** $\mathbf{r}(s)$ | La curva que integra el generador, unit-speed en $s$ | Es la curva de diseño, el **eje de roll** y la pieza física. Fija fabricación, interferencia, bounding box y radio mínimo imprimible |
| **Heartline** $\mathbf{r}_h(s)$ | $\mathbf{r}(s) + d\,\mathbf{U}(s)$ | Dónde va el centro de masa del pasajero. Fija energía, rodadura y fuerza normal. Es donde se diseña y donde se aplica la norma (punto de verificación por defecto) |
| **Cabeza** $\mathbf{p}(s)$ | $\mathbf{r}(s) + (d+e)\,\mathbf{U}(s)$ | Chequeo adicional por rotaciones; G informativa, o punto de verificación si se lo pide |

**Hipótesis del eje de roll.** El carro va montado sobre el riel y es el riel el que lo vincula: cuando rola, gira alrededor de la tangente del riel. Por eso el riel es la curva que se prescribe y se integra, y la heartline se despeja de él. La consecuencia visible es que **sobre un riel recto que rola, el riel sigue recto y es la heartline la que hace una hélice** de radio $d$: el pasajero rota respecto de la vía, describiendo un arco $d\,\Delta\phi$ en el plano transversal, y siente la centrípeta y el Euler de esa rotación. La alternativa —prescribir la heartline y despejar el riel, que es lo que hacía una versión anterior del generador— es autoconsistente pero produce la geometría inversa: la heartline recta y el riel helicoidal. Se descartó porque no corresponde al vehículo real sobre un riel dado.

**Dónde se impone la G.** Los modos de curvatura no resuelven $\kappa = g(G_{obj}-U_z)/v^2$ sobre la curva integrada, porque esa curva es el riel y el pasajero no está ahí: recorre otro radio y además rota. Resuelven la curvatura **del riel** para que el **pasajero**, transportado por cuerpo rígido con brazo $b$ (§3.5), reciba $G_{obj}$. Es una cuadrática cerrada por punto (§3.6).

**Cuánto importa.** La heartline está del lado del centro de curvatura respecto del riel, así que $R_h = R - d$. La diferencia relativa vale $d/R$: con $d = 3$ cm y el radio de cúspide de 0.11 m del loop, **27 %**. No es una corrección de segundo orden. Imponer la G sobre el riel dejaría al pasajero recorriendo un radio 27 % más chico que el dimensionado.

**$d$ y $e$ son parámetros distintos y no hay que colapsarlos.** $d$ (`DistanciaHeartline`) va del riel al centro de masa del pasajero y es geometría de la vía. $e$ (`DistanciaHeartlineACabeza`) va de la heartline a la cabeza y es un chequeo de rotaciones. Que hoy tengan el mismo valor por defecto es una coincidencia de arranque, no una identidad — ver [`NOMENCLATURA.md`](NOMENCLATURA.md#3-parámetros-de-entrada-del-generador-parametrospordefectom).

**Dónde se aplica la norma en la práctica real.** El diseño se hace sobre la heart line del pasajero, y las mediciones de verificación se toman sobre el asiento: ASTM F2137 §12.1.5.2 monta el acelerómetro a 28–36 cm (niños) / 30–41 cm (adultos) sobre el nivel del asiento, y el ensayo SARC de EN 13814 a 50 ± 5 cm / 56–66 cm, que es la heart line. La cabeza no es el punto de la norma, pero es la parte más sensible a las rotaciones y "the designers must include the rotations into their calculations" (Rohde, *Some Details about the Development of Acceleration Limits for Amusement Rides*, VDV, 2.ª ed., 2024, §7.6.2 y §9). Por eso el punto de verificación por defecto es la heartline (`PuntoDeVerificacionNormativa = 'Heartline'`), la G de la cabeza se reporta siempre como informativa, y `'Cabeza'` es la opción conservadora.

### 3.2 Transferencia de aceleraciones

El carro es un cuerpo rígido, así que aplica la fórmula de transferencia entre dos puntos:

$$\mathbf{a}_P = \mathbf{a}_O + \dot{\boldsymbol{\omega}}\times\mathbf{r}_{P/O} + \boldsymbol{\omega}\times(\boldsymbol{\omega}\times\mathbf{r}_{P/O})$$

con $O$ sobre el riel, $P$ el punto transportado, $\mathbf{r}_{P/O} = b\,\mathbf{U}$ (con $b = d$ para el centro de masa, $b = d+e$ para la cabeza), y $\dot{\boldsymbol\omega}$ la aceleración angular del marco del carro (antes notada $\boldsymbol\alpha$; se renombra para no chocar con $\alpha$, el ángulo de hélice del loop de generador §4.1 — colisión #5 en [`NOMENCLATURA.md`](NOMENCLATURA.md#0-colisiones-resueltas)).

| Término | Nombre | Origen |
|---|---|---|
| $\mathbf{a}_O$ | Aceleración del punto del riel | $a_t\mathbf{T} + v^2\boldsymbol{\kappa}$, con $v = ds/dt$ |
| $\boldsymbol{\omega}\times(\boldsymbol{\omega}\times\mathbf{r})$ | Centrípeta del punto desplazado | El cuerpo gira alrededor del eje de roll y el pasajero recorre un radio distinto |
| $\dot{\boldsymbol{\omega}}\times\mathbf{r}$ | Euler (tangencial de rotación) | El giro está acelerando |

Como $\boldsymbol\omega$ es la misma para todos los puntos de un cuerpo rígido, el punto de referencia $O$ es una elección de conveniencia: se toma el riel porque es la curva integrada, cuya aceleración se conoce exacta.

### 3.3 Velocidad angular — completa

$$\boldsymbol{\omega} = v\,\big(\underbrace{\mathbf{T}\times\boldsymbol{\kappa}}_{\text{giro del marco de transporte}} + \underbrace{\phi'\,\mathbf{T}}_{\text{roll}}\big)$$

Son **dos** aportes, no uno:

- **Giro del marco de transporte.** El marco tiene que dar vueltas junto con la vía para seguir siendo tangente. Es $\mathbf{T}\times\boldsymbol\kappa$ por unidad de arco, de módulo $\kappa$, y no tiene componente sobre $\mathbf{T}$: el transporte paralelo no tiene torsión propia (§2.2).
- **Roll.** Gira alrededor de $\mathbf{T}$ a razón $\phi'$ por unidad de arco.

En componentes del marco del carro, con $\kappa_u = \boldsymbol\kappa\cdot\mathbf{U}$ y $\kappa_l = \boldsymbol\kappa\cdot\mathbf{L}$:

$$\boldsymbol{\omega} = v\,\big(-\kappa_l\,\mathbf{U} + \kappa_u\,\mathbf{L} + \phi'\,\mathbf{T}\big)$$

De acá sale $\Omega_T = v\phi'$, que ya dice algo importante: **la misma geometría de roll gira más rápido en el tiempo a mayor velocidad.**

### 3.4 Componentes cerradas en el plano normal

Desarrollando §3.2 con la $\boldsymbol\omega$ de §3.3 y $\mathbf{r}_{P/O} = b\,\mathbf{U}$, las componentes sobre $\mathbf{U}$ y $\mathbf{L}$ **no dependen de $d\boldsymbol\kappa/ds$**, así que tienen forma cerrada y se pueden evaluar dentro del paso de integración:

$$G_z = \frac{v^2\kappa_u\,(1 - b\,\kappa_u)}{g} + U_z - \frac{v^2\,b\,\phi'^2}{g}$$

$$G_y = \frac{v^2\kappa_l\,(1 - b\,\kappa_u)}{g} + L_z + \frac{b\,(a_t\,\phi' + v^2\phi'')}{g}$$

Cada término tiene nombre:

| Término | Qué es |
|---|---|
| $(1 - b\kappa_u)$ | El pasajero recorre un radio $R - b$ en vez de $R$: es el 27 % de §3.1 |
| $-v^2 b\phi'^2$ (sobre $\mathbf{U}$) | Centrípeta de girar alrededor del riel: apunta hacia el eje de roll |
| $b\,(a_t\phi' + v^2\phi'')$ (sobre $\mathbf{L}$) | Euler de la rotación: la G lateral que produce una transición de roll |

Sólo la componente longitudinal $G_x$ arrastra un término en $d\boldsymbol\kappa/ds$ (a través de $\dot{\boldsymbol\omega}\cdot\mathbf{L}$), y por eso se evalúa numéricamente sobre la polilínea ya construida (§3.5). Los dos términos de roll son los que dimensionan la longitud de la transición de roll (§7): con $\phi''$ del smoothstep quíntico, $\max|\phi'''| = 60|\Delta\phi|/L^3$ y la tasa de aparición de $G_y$ vale $b\,v^3\phi'''/g$.

**Signo de $G_y$.** Con $\mathbf{L} = \mathbf{T}\times\mathbf{U}$ y $\psi$ el ángulo de $\boldsymbol\kappa$ medido desde $\mathbf{U}$ hacia $\mathbf{L}$, $\kappa_l = \kappa\sin\psi$ y el aporte de la curvatura a $G_y$ es $+\kappa v^2\sin\psi/g$: una curvatura desalineada hacia $+\mathbf{L}$ empuja al pasajero hacia $+\mathbf{L}$. Es la convención que usa `CargasEnLaVia`.

### 3.5 Resultado: la expresión que se implementa

Dentro del paso de integración (`DerivadaDeVia`, `CurvaturaDelModo`) se usan las componentes cerradas de §3.4. Sobre la polilínea ya construida (`SimularSobreTrack`) se usa la fórmula completa de §3.2 con la $\boldsymbol\omega$ entera de §3.3, evaluada numéricamente, a tres brazos —$d$ para la fuerza normal, $b$ para la verificación normativa y $d+e$ para la cabeza—:

$$\boxed{\;\mathbf{a}_P = a_t\mathbf{T} + v^2\boldsymbol{\kappa} + \dot{\boldsymbol{\omega}}\times b\,\mathbf{U} + \boldsymbol{\omega}\times(\boldsymbol{\omega}\times b\,\mathbf{U})\;}$$

y la G por eje sale de la fuerza específica $\mathbf{f} = \mathbf{a}_P - \mathbf{g}$, con $\mathbf{g} = -g\hat{z}$:

$$G_x = \frac{\mathbf{f}\cdot\mathbf{T}}{g} \qquad G_y = \frac{\mathbf{f}\cdot\mathbf{L}}{g} \qquad G_z = \frac{\mathbf{f}\cdot\mathbf{U}}{g}$$

Restar $\mathbf{g}$ y no ignorarla es lo que hace que un cuerpo en reposo sobre vía a nivel mida 1 G, que es como la norma define la magnitud que limita (§5.1, cláusula 7.1.4.5).

**Por qué la fórmula completa y no la aproximación de roll puro.** Quedarse con $\boldsymbol\omega\approx\Omega_T\mathbf{T}$ pierde los términos cruzados entre curvatura y roll, que son los que dominan justo donde la vía curva y rola *a la vez* — que es todo el interés de un over-banked turn o un dive loop. Medido sobre el over-banked turn de 120° con peralte de 110°, el aporte total de rotación más el cambio de radio llega a **0.49 G**, y desaparecería entero si se lo despreciara.

**Verificación.** Con $b = 0$ la expresión tiene que reducirse exactamente a la G del punto del riel, $v^2\kappa_u/g + U_z$. El test 10 de `TestsValidacion.m` lo comprueba y da $2\times10^{-16}$ G de diferencia; el mismo test verifica que con $d$ real el aporte es estrictamente positivo. El test 11 fija la hipótesis del eje de roll: en la transición de roll del dive loop el riel queda exactamente recto, la heartline sale con la curvatura de la hélice $d\phi'^2/(1+d^2\phi'^2)$, y la $G_y$ de rotación en la cabeza es exactamente el doble que en la heartline.

### 3.6 Transporte inverso: la curvatura del riel para una G del pasajero

Los modos de curvatura conocen la G que quieren en el pasajero y tienen que devolver la curvatura del riel. Con $c = \cos\psi$ la proyección de la curvatura sobre $\mathbf{U}$ (§3.4, $\kappa_u = \kappa c$), la ecuación de $G_z$ de §3.4 se resuelve para $\kappa$. Hay un matiz: la velocidad que se integra es la del centro de masa, $v_{cm}$, porque es la que conserva energía (§3.7), y la del punto del riel es $v = v_{cm}/J$ con

$$J = \left\lVert\frac{d\mathbf{r}_h}{ds}\right\rVert = \sqrt{(1 - d\kappa_u)^2 + d^2\phi'^2}$$

que depende de la misma $\kappa$. Sustituyendo, con $A = (G_{obj} - U_z)\,g/v_{cm}^2$ y $\phi'$ dado:

$$\kappa c\,(1 - b\kappa c) - b\phi'^2 = A\,J^2 \quad\Longrightarrow\quad a_2\kappa^2 + a_1\kappa + a_0 = 0$$

$$a_2 = -c^2\,(b + A d^2), \qquad a_1 = c\,(1 + 2Ad), \qquad a_0 = -\big(A\,(1 + d^2\phi'^2) + b\phi'^2\big)$$

Es cerrada por punto. Se toma la raíz que tiende a $A/c$ cuando los brazos van a cero, escrita como $2a_0/(-a_1 - \sqrt{a_1^2 - 4a_2a_0})$ para no restar números parecidos. $\phi'$ lleva el término helicoidal $\kappa\tan\alpha$ del loop, que se cierra por punto fijo en dos o tres pasadas (exacto sin hélice).

Dos consecuencias que la fórmula hace explícitas:

- **La proyección $c$ importa.** Una curva peraltada un ángulo $\beta$ con la curvatura horizontal tiene $c = \sin\beta$; una curva sin peraltar ($c = 0$) no puede generar $+G_z$ por más curvatura que se le ponga: genera $G_y$. La implementación tiene una guarda explícita para ese caso. Sin esta proyección, la hélice de 55° de peralte le erraba al objetivo por un factor $1/\sin 55° = 1.22$ (≈ 1 G a 6 G de objetivo).
- **Hay una G máxima alcanzable.** $\kappa c(1 - b\kappa c)$ tiene máximo $1/(4b)$ en $\kappa c = 1/(2b)$: más allá, acercar el pasajero al centro de giro le baja la G. Con $b = 0.03$ m eso es $R = 0.06$ m; a $v = 3$ m/s la G centrípeta máxima es 7.6 G. Si el objetivo está por encima, la cuadrática no tiene raíz real y se devuelve la curvatura del máximo; el chequeo posterior lo reporta.

Comprobado sobre los cuatro elementos en los modos `FuerzaGConstante` y normativo: la $G_z$ del pasajero en el arco coincide con el objetivo dentro de 0.004 G, mientras que la del propio riel difiere entre 0.08 y 0.70 G.

### 3.7 Energía del centro de masa

La curva integrada es el riel pero la masa está en la heartline, que no es unit-speed en $s$: $\lVert d\mathbf{r}_h/ds\rVert = J$. La energía que se conserva es la del centro de masa, así que el estado lleva $v_{cm}^2$ y

$$\frac{d(v_{cm}^2)}{ds} = -2g\,\frac{dz_h}{ds} - \frac{2F_{res}}{m}, \qquad \frac{dz_h}{ds} = (1 - d\kappa_u)\,T_z + d\phi'\,L_z, \qquad \frac{dt}{ds} = \frac{J}{v_{cm}}$$

Integrar la energía como si la masa fuera con la velocidad del riel metería un error de $(1 - d\kappa_u)^2$ en la energía cinética — 47 % a $R = 0.11$ m — que es la otra cara del 27 % de §3.1. El test 1 verifica $v_{cm}^2 = v_0^2 - 2g\,\Delta z_h$ sin pérdidas con error relativo $10^{-7}$.

### 3.8 Consecuencias sobre la continuidad del roll

**La aceleración lateral depende de $\phi''$.** Si $\phi$ es sólo $C^1$, entonces $\phi''$ es discontinua y **hay un salto de aceleración lateral** en los extremos de la transición de roll.

| Modelo | Aceleración continua | Jerk continuo |
|---|---|---|
| Punto sobre el eje de roll ($b=0$) | $\phi \in C^0$ | $\phi \in C^1$ |
| **Cuerpo fuera del eje ($b>0$)** | $\phi \in C^2$ | $\phi \in C^3$ |

La exigencia de $C^2$ depende de que el punto evaluado esté **fuera** del eje de roll, y lo está siempre, porque el eje es el riel y el pasajero va a $d > 0$. Si se pusiera $d = 0$ —el pasajero sobre el riel— la exigencia caería a $C^0$ y las transiciones de roll podrían ser arbitrariamente cortas, que es físicamente falso.

**Perfil de roll adoptado: smoothstep quíntico.** Con $u = s/L_{trans}$ normalizado en $[0,1]$:

$$\phi(u) = \phi_{total}\,\big(6u^5 - 15u^4 + 10u^3\big)$$

Cumple $\phi'(0)=\phi'(1)=0$ **y** $\phi''(0)=\phi''(1)=0$, de modo que empalma con $C^2$ contra cualquier tramo de roll constante a ambos lados, sin salto de aceleración lateral.

**Alternativa descartada:** la rampa coseno $\phi = \phi_{total}(1-\cos\pi u)/2$ tiene $\phi'(0)=0$ pero $\phi''(0)\neq 0$, así que sí produce el salto de aceleración lateral. Es una trampa frecuente.

### 3.9 Verificación de consistencia con Froude

Contando exponentes de $\lambda$ en los términos de roll de §3.4: $b\sim\lambda^{-1}$, $a_t\sim\lambda^0$, $\phi'\sim\lambda^{1}$, $v^2\sim\lambda^{-1}$, $\phi''\sim\lambda^{2}$.

$$b\,a_t\,\phi' \sim \lambda^{-1+0+1} = \lambda^0 \qquad b\,v^2\phi'' \sim \lambda^{-1-1+2} = \lambda^0 \qquad b\,v^2\phi'^2 \sim \lambda^{-1-1+2} = \lambda^0$$

Los tres términos son invariantes de escala, consistente con que la aceleración lo sea bajo Froude. La derivación y el marco de escalado son mutuamente consistentes.

---

## 4. Semejanza de Froude

### 4.1 Fundamento

Una montaña rusa es una máquina de gravedad: toda la energía sale de $mgh$ y todas las cargas se comparan contra $mg$. Lo que define la experiencia es la relación entre fuerzas inerciales y gravitatorias.

Con las tres variables que gobiernan el problema — velocidad $v$, longitud característica $L$, gravedad $g$ — hay un único grupo adimensional formable:

$$Fr = \frac{v}{\sqrt{gL}}$$

($L$ acá es la longitud característica genérica de Froude, en abstracto. En cualquier uso concreto de este documento aparece siempre con subíndice: $L_{trans}$, longitud de transición; $L_{carro}$, largo del carro. Ver la colisión #3 resuelta en [`NOMENCLATURA.md`](NOMENCLATURA.md#0-colisiones-resueltas).)

Y su cuadrado es directamente la fuerza G:

$$Fr^2 = \frac{v^2}{gL} = \frac{v^2/L}{g} = \frac{\text{aceleración centrípeta}}{g}$$

**Igualar Froude entre modelo y prototipo es igualar las fuerzas G.** Ése es el motivo por el que es el criterio de escalado correcto para este proyecto.

### 4.2 Factores de escala

Con $\lambda = L_{real}/L_{modelo}$ y **la misma gravedad en ambos** (no se puede escalar $g$):

$$\frac{v_m}{\sqrt{gL_m}} = \frac{v_r}{\sqrt{gL_r}} \implies \frac{v_m}{v_r} = \frac{1}{\sqrt{\lambda}}$$

De ahí, con $t = L/v$ y $a = v^2/L$:

| Magnitud | Factor modelo/real (adimensional) | Valor con $\lambda = 22$ (adimensional) |
|---|---|---|
| Longitud | $1/\lambda$ | 0.0455 |
| Velocidad | $1/\sqrt\lambda$ | 0.213 |
| Tiempo | $1/\sqrt\lambda$ | 0.213 |
| **Aceleración (G)** | **1** | **1.00** |
| Jerk | $\sqrt\lambda$ | 4.69 |
| Velocidad angular | $\sqrt\lambda$ | 4.69 |
| Aceleración angular | $\lambda$ | 22.0 |

### 4.3 Estimación de $\lambda$

| Anclaje | Real (aproximado) [m] | Modelo [m] | $\lambda$ [—] |
|---|---|---|---|
| Largo de carro | 2.2 m **[SIN VERIFICAR]** | 0.10 m | 22.0 |
| Alto de carro | 1.5 m **[SIN VERIFICAR]** | 0.06 m | 25.0 |
| Trocha de vía | 1.3 m **[SIN VERIFICAR]** | 0.06 m | 21.7 |

Valor de trabajo adoptado: $\lambda = 22$ **[SIN VERIFICAR]**, $\sqrt\lambda = 4.69$.

> Las dimensiones "reales" son rangos típicos, no datos verificados contra una atracción concreta. Para el reporte hay que fijar una atracción de referencia y usar sus dimensiones publicadas. Ver la tabla consolidada en [§11](#11-datos-pendientes-de-verificación).

### 4.4 Dirección correcta de la conversión de jerk

Un modelo fiel a Froude produce jerk $\sqrt\lambda$ veces **mayor** que el prototipo. El criterio normativo aplica al prototipo. Por lo tanto, para verificar cumplimiento:

$$J_{real,equiv} = \frac{J_{modelo}}{\sqrt\lambda} \leq J_{lim} \qquad\Longleftrightarrow\qquad J_{modelo} \leq \sqrt\lambda\;J_{lim}$$

**El presupuesto de jerk del modelo es mayor que el número de la norma, no menor.** El jerk es una restricción menos severa en el modelo.

### 4.5 Qué no escala

**Resistencia a la rodadura.** El coeficiente depende del radio de rueda y de la fricción interna del rodamiento, ninguno de los cuales baja proporcionalmente al achicar. El modelo pierde proporcionalmente más energía que el prototipo. Es una limitación del análisis y hay que declararla.

**Número de Reynolds ($Re$).** $Re_m/Re_r = \lambda^{-3/2} \approx 1/103$. Como $C_d$ depende de $Re$, no es exactamente el mismo coeficiente. En el rango del modelo ($Re \approx 2$–$4\times10^4$) el $C_d$ de un cuerpo romo varía poco, así que el error es acotado. Es el **conflicto clásico Froude-Reynolds**: no se pueden igualar los dos simultáneamente. Es el mismo problema que enfrentan los ensayos de modelos navales.

**Arrastre relativo al peso — sí escala.** Con semejanza geométrica y densidad equivalente: $A\sim L^2$, $v^2\sim L$, $m\sim L^3$, de modo que $F_d/mg \sim L^2\cdot L/L^3 = \text{cte}$. El arrastre mantiene la misma importancia relativa.

### 4.6 Implicancia de tamaño

Ésta es la consecuencia con más impacto sobre el proyecto físico. Un loop real escalado a $\lambda = 22$:

| $R$ cúspide real [m] | $R$ cúspide modelo [cm] | Altura del loop modelo [cm] | $v$ cúspide modelo ($G=2$) [m/s] |
|---|---|---|---|
| 8 m | 36 cm | 80–95 cm | 3.3 m/s |
| 10 m | 46 cm | 100–118 cm | 3.7 m/s |
| 12 m | 55 cm | 120–142 cm | 4.0 m/s |
| 15 m | 68 cm | 150–177 cm | 4.5 m/s |

(Altura total del loop $H_{loop}$ estimada en 2.2–2.6 veces el radio de cúspide **[SIN VERIFICAR]**, típico de un loop clotoide. "Radio de cúspide" es el radio de curvatura en el punto más alto del loop, no un radio nominal único: en los modos de curvatura que dependen de $v$ el radio cambia a lo largo del arco, ver [`documentacion_generador_elementos.md` §5](documentacion_generador_elementos.md#5-los-cuatro-modos-de-curvatura).)

**La fidelidad de Froude con un carro de 10 cm obliga a un loop de aproximadamente un metro de altura.** No es un elemento de mesa.

Chequeo inverso, si se impone la altura disponible:

| Altura disponible [cm] | $R$ modelo [cm] | $R$ real equivalente [m] | $v$ cúspide modelo [m/s] |
|---|---|---|---|
| 30 cm | 12.5 cm | 2.8 m | 1.9 m/s |
| 50 cm | 21 cm | 4.6 m | 2.5 m/s |
| 80 cm | 33 cm | 7.3 m | 3.1 m/s |
| 100 cm | 42 cm | 9.2 m | 3.5 m/s |

Un loop que quepa en 50 cm representa fielmente una atracción cuyo loop real tendría 4.6 m de radio — más chico que cualquier loop comercial. Sigue siendo un ejercicio válido de Froude, pero deja de representar una atracción existente.

**Éste es el trade-off central del proyecto y hay que resolverlo antes de fabricar:** o el modelo es grande y representa fielmente una atracción real, o es compacto y representa una atracción hipotética más chica de lo que existe.

---

## 5. Criterios de aceptación — ASTM F2291-06a §7

> Valores leídos de las Figs. 6 a 10 de la norma **[SIN VERIFICAR contra el texto normativo original]**. La versión vigente es **F2291-25c**: estos valores pueden haber cambiado. En una maqueta sin pasajeros estos criterios son **autoimpuestos**, no normativa aplicable — se adoptan como criterio de diseño para demostrar conocimiento y aplicación de práctica industrial real.

### 5.1 Definiciones normativas aplicables

| Cláusula | Contenido |
|---|---|
| §7.1.4.1 | Unidad G = 9.81 m/s² |
| §7.1.4.2 | Impactos de menos de 200 ms no están cubiertos |
| §7.1.4.3 | Límites para pasajeros de 48 in (1.22 m) de altura o más |
| **§7.1.4.5** | **Los límites son de aceleración neta total, incluida la gravedad.** Un cuerpo en reposo mide 1 G en el eje perpendicular a la superficie terrestre |
| §7.1.4.6 | Régimen permanente sin límite de tiempo salvo indicación; exposición sostenida mayor a 90 s no cubierta |
| §7.1.5.1 | Combinación de dos ejes limitada por una elipse centrada en el origen, con semiejes iguales a los límites de 200 ms multiplicados por 1.1 |
| §7.1.6.1 | Inversiones en X e Y: pico a pico entre eventos sostenidos consecutivos debe superar 200 ms; por debajo, los límites se reducen 50 % |
| §7.1.7.1 | Si hay exposición a $-G_z$ por más de 3 s, los límites de $+G_z$ se reducen durante los 6 s siguientes |
| **§7.1.7.2** | **Transición desde 0 G o menos hacia 2 G o más: la tasa de aparición debe ser menor a 15 G/s** |
| §7.1.8 | Medición y análisis según Práctica F2137 |

La cláusula §7.1.4.5 valida la métrica del script de análisis energético: `NormalVia` (gravedad + centrípeta combinadas) es exactamente la magnitud que la norma limita. `NormalRadioDeGiro` no lo es, porque excluye la gravedad. Ver [`documentacion_analisis_energia.md` §10](documentacion_analisis_energia.md#10-unidades-en-gs).

**Cómo se evalúa un límite dependiente de la duración, en una sola fórmula (se usa tres veces en este documento, en §5.7, §6.1 y §7.5, y también en generador §9 y §10 — se define acá una única vez):**

$$G_{lim}(\text{duración real}) \quad\text{con}\quad \text{duración real} = \text{duración medida en el modelo} \times \sqrt{\lambda_{loop}}$$

Es decir: se mide cuánto dura, en el reloj del modelo, el evento sostenido en que $G$ supera cierto nivel; esa duración se multiplica por $\sqrt{\lambda_{loop}}$ para obtener la "duración equivalente del prototipo" (el tiempo que ese mismo evento habría durado en la atracción real, porque el modelo recorre la misma experiencia $\sqrt{\lambda_{loop}}$ veces más rápido en tiempo de reloj — ver la derivación completa en §7.1); y con esa duración real se entra a la curva límite correspondiente (Figs. 6 a 10, tabuladas abajo).

### 5.2 Fig. 6 — Límites de $+G_x$ (Eyes Back, aceleración hacia atrás)

Caso base con apoyacabezas — valores **[SIN VERIFICAR]** contra el texto normativo original:

| Duración [s] | Límite [G] |
|---|---|
| 0.2 | 6.0 |
| 1.0 | 6.0 |
| 2.0 | 4.0 |
| 4.0 | 4.0 |
| 5.0 | 3.0 |
| 11.8 | 3.0 |
| 12.0 | 2.5 |
| >12 | 2.5 |

**Nota 1:** se requiere apoyacabezas por encima de 1.5 g, salvo que la tasa de aparición sea menor a 5 g/s, en cuyo caso se permite hasta 2.0 g. Sin apoyacabezas, la duración máxima por encima de 1.5 g es 4 s. (Aquí "g" es la grafía literal de la norma; denota lo mismo que "G" en el resto de este documento, múltiplos de 9.81 m/s² — §7.1.4.1. Ver colisión #9 en [`NOMENCLATURA.md`](NOMENCLATURA.md#0-colisiones-resueltas).)

**Nota 2:** los procedimientos de diseño y operación deben asegurar que el pasajero esté en contacto con y soportado por respaldo y apoyacabezas apropiados.

### 5.3 Fig. 7 — Límites de $-G_x$ (Eyes Front, desaceleración)

Valores **[SIN VERIFICAR]**:

| Duración [s] | Base Case [G] | Over-The-Shoulder [G] | Prone [G] |
|---|---|---|---|
| 0.2 | −2.0 | −2.0 | −3.5 |
| 0.5 | −1.5 | −2.0 | −3.5 |
| 2.0 | −1.5 | −2.0 | −3.5 |
| 3.0 | −1.5 | −2.0 | −2.5 |
| 4.0 | −1.5 | −2.0 | −2.5 |
| 5.0 | −1.5 | −2.0 | −2.0 |
| >5 | −1.5 | −2.0 | −2.0 |

**Nota 2:** los límites Over-The-Shoulder pueden elevarse a los límites Prone si la tasa de aparición es menor a 15 g/s y la sujeción está apropiadamente acolchada.

### 5.4 Fig. 8 — Límites de $\pm G_y$ (lateral)

Caso base, valores **[SIN VERIFICAR]**:

| Duración [s] | Límite [G] |
|---|---|
| 0.2 | 3.0 |
| 1.0 | 3.0 |
| 2.0 | 2.0 |
| >2 | 2.0 |

**Nota:** para vehículos de asiento corrido sin retención individual ni divisores, con aceleraciones laterales sostenidas mayores a 0.7 g, el orden de asiento debe ser de pasajero más chico a más grande en la dirección de la carga.

### 5.5 Fig. 9 — Límites de $-G_z$ (Eyes Up, airtime)

Valores **[SIN VERIFICAR]**:

| Duración [s] | Base Case [G] | Extended $-G_z$ [G] |
|---|---|---|
| 0.2 | −2.0 | −2.8 |
| 0.5 | −1.5 | ≈ −2.5 |
| 1.0 | −1.5 | −2.2 |
| 3.0 | −1.5 | −1.5 |
| 4.0 | −1.5 | −1.5 |
| 7.0 | −1.1 | −1.1 |
| >7 | −1.1 | −1.1 |

La curva Extended converge con la Base alrededor de los 3 s; a partir de ahí son iguales.

**Nota 2:** las atracciones diseñadas para operar en el rango Extended requieren sujeciones especiales, que deben tratarse en el Ride Analysis.

> Los puntos de quiebre en 3.0 y 4.0 s son la lectura más consistente de la figura, pero **[SIN VERIFICAR]**: conviene verificarlos contra el original antes de citarlos en el reporte.

### 5.6 Fig. 10 — Límites de $+G_z$ (Eyes Down) — **el crítico para el loop**

Valores **[SIN VERIFICAR]**:

| Duración [s] | Todas las sujeciones [G] | Reducido (precedido por ≥3 s de $-G_z$) [G] |
|---|---|---|
| 0.2 | 6.0 | 5.0 |
| 1.0 | 6.0 | 5.0 |
| 1.5 | 5.0 | 5.0 |
| 2.0 | 4.0 | 4.0 |
| 2.5 | 4.0 | 2.0 |
| 4.0 | 4.0 | 2.0 |
| 5.0 | 3.0 | 2.0 |
| 11.8 | 3.0 | 2.0 |
| 12.0 | 2.0 | 2.0 |
| 40 | 2.0 | 2.0 |

**Nota:** el diseño debe asegurar que el pasajero esté correctamente sentado en posición erguida.

Comparación útil: las curvas de $+G_x$ (Fig. 6) y $+G_z$ (Fig. 10) son idénticas en forma hasta los 11.8 s; difieren sólo en el escalón final, que baja a 2.5 G en $+G_x$ y a 2.0 G en $+G_z$.

### 5.7 Cómo se aplica un límite dependiente de la duración

El límite no es puntual: depende de **cuánto tiempo lleva el pasajero por encima de ese nivel**. La verificación correcta es:

Para cada nivel $G^*$, medir la duración acumulada del evento sostenido en que $G \geq G^*$, y verificar que $G^* \leq G_{lim}(\text{duración})$ — la fórmula de conversión de duración está en §5.1.

En la práctica, para cada tramo del recorrido en que la G supera un umbral, se calcula la duración del tramo y se evalúa la curva límite en esa duración. Un pico de 6 G durante 0.5 s es admisible; el mismo 6 G durante 3 s no lo es.

### 5.8 $G_y$ objetivo del dive loop: prioridad al $G_z$ y elipse de 7.1.5.1

El dive loop, en modo `GNormativaMaxima`, persigue a la vez el $+G_z$ de la Fig. 10 y un $G_y$ lateral. **Los dos máximos juntos no son admisibles**: la cláusula 7.1.5.1 limita la combinación de dos ejes a una elipse con semiejes iguales a los límites de 200 ms multiplicados por 1.1, y

$$\left(\frac{3.0}{3.3}\right)^2 + \left(\frac{6.0}{6.6}\right)^2 = 0.826 + 0.826 = 1.65 > 1.$$

**Decisión adoptada:** se prioriza el $G_z$ al máximo de la Fig. 10 y el $G_y$ objetivo es el máximo que deja la elipse dado ese $G_z$, con la Fig. 8 como tope si resultara más restrictiva:

$$G_{y,obj}(\text{dur}) = \min\!\Big(G_{y,lim}(\text{dur}),\; 3.3\sqrt{1 - \big(G_{z,lim}(\text{dur})/6.6\big)^2}\Big) - \text{TolObjetivoDeG}$$

| $G_{z,lim}$ [G] | $G_y$ que deja la elipse [G] | Fig. 8 [G] | $G_{y,obj}$ (con 0.05 de tolerancia) [G] |
|---|---|---|---|
| 6.0 (dur < 1 s) | 1.375 | 3.0 | 1.33 |
| 5.0 (1.5 s) | 2.154 | 2.5 | 2.10 |
| 4.0 (2–4 s) | 2.625 | 2.0 | 1.95 |
| 3.0 (5–11.8 s) | 2.939 | 2.0 | 1.95 |

La alternativa de perseguir los dos máximos y aceptar que la elipse falle, o la de escalar los dos hasta la elipse ($G_z \approx 4.7$, $G_y \approx 2.3$), quedaron descartadas. El mecanismo geométrico es el sub-peralte de la curvatura (generador §5.1).

---

## 6. Política de continuidad por eje

> **Destinada al reporte final.** Esta sección completa — el análisis de qué exige realmente la norma, el falso dilema continuo/discontinuo, las cuatro razones contra la discontinuidad, el filtro de 5 Hz y la política por eje — va íntegra al reporte del proyecto como justificación del criterio de continuidad adoptado.

### 6.1 Lo que la norma exige realmente

La norma **no exige continuidad de la aceleración en ningún lado**. Exige **tasa de aparición acotada** en transiciones específicas identificadas como peligrosas:

| Situación | Límite de onset [G/s] | Fuente |
|---|---|---|
| De 0 G o menos hacia 2 G o más | < 15 G/s | §7.1.7.2 |
| $+G_x$ por encima de 1.5 g sin apoyacabezas | < 5 g/s (permite 2.0 g) | Fig. 6, nota 1 |
| Elevar OTS a límites Prone en $-G_x$ | < 15 g/s | Fig. 7, nota 2 |

(Otra vez "g"/"G" indistintos, colisión #9: son la misma unidad, ver §5.1.)

La diferencia es de fondo:

- **Continuidad de aceleración** = jerk finito
- **Requisito normativo** = jerk por debajo de un número específico, en transiciones específicas

Un salto de aceleración implica jerk infinito, que viola cualquier límite finito. Pero el requisito real es más laxo que la continuidad: permite jerk alto mientras esté acotado.

### 6.2 El falso dilema

**"Continuo vs. discontinuo" no es la variable de decisión.** La variable es la **longitud de la transición**.

Una clotoide con transición corta produce jerk altísimo pero finito. Se obtiene el golpe *y* la continuidad. Exigir $\mathcal{G}^2$ no impide que la transición sea agresiva: sólo garantiza que el jerk sea finito, calculable y **elegido por el diseñador** en vez de quedar determinado por accidente.

$$\text{jerk normal en una clotoide} \approx v^3\,\frac{d\kappa}{ds}$$

La longitud de la clotoide es el perilla de ajuste directo.

### 6.3 Por qué la discontinuidad no es realizable

Argumento decisivo para este proyecto: **una discontinuidad de curvatura no se puede fabricar.**

Un tubo doblado o una vía impresa siempre va a tener una transición finita. Si se diseña una discontinuidad, la longitud real de la transición queda determinada por la tolerancia del proceso de fabricación, no por el diseño. La geometría construida no va a ser la geometría diseñada, y las G medidas no van a coincidir con las calculadas.

Diseñar una clotoide es elegir explícitamente esa longitud en vez de dejar que la decida el proceso.

### 6.4 El filtro de 5 Hz

Las Figs. 19 y 20 de la norma especifican **datos filtrados a 5 Hz**, y §7.1.8 remite a la Práctica F2137 para la medición.

Consecuencia: la verificación de cumplimiento no se hace sobre la señal cruda sino sobre la señal filtrada. Un pasabajos de primer orden a 5 Hz tiene $\tau_{filtro} = 1/(2\pi f_c) = 31.8$ ms y tiempo de subida 10–90 % de ≈ 70 ms. (Este $\tau_{filtro}$ es la constante de tiempo del filtro, no la torsión de la vía; se usa el subíndice para no chocar con $\tau$ del bloque 1 de [`NOMENCLATURA.md`](NOMENCLATURA.md).) Un escalón matemático medido a través de ese filtro aparece como una rampa:

| Escalón [G] | Onset medido tras el filtro [G/s] |
|---|---|
| 1 G | ≈ 11 G/s |
| 2 G | ≈ 23 G/s |
| 3 G | ≈ 34 G/s |
| 4 G | ≈ 46 G/s |

O sea que un escalón de 2 G o más, medido según la norma, ya excede el límite de 15 G/s de §7.1.7.2. **La discontinuidad no sobrevive la verificación normativa** en las transiciones donde ese límite aplica.

### 6.5 Ventajas y desventajas de admitir discontinuidad

**A favor:**

| Ventaja | Alcance real |
|---|---|
| Menos restricciones → problema geométrico más fácil de resolver | Real: bajar de $\mathcal{G}^2$ a $\mathcal{G}^1$ quita ecuaciones y libera grados de libertad para alcanzar el endpoint |
| Elementos más cortos | Real y muy relevante a esta escala: las transiciones consumen decenas de centímetros y compiten contra el bounding box |
| Mayor G pico en la misma huella | Real |
| Emoción de la transición seca | Parcial: se consigue igual con una clotoide corta, sin perder continuidad |

**En contra:**

| Desventaja | Gravedad |
|---|---|
| **No es fabricable** | Decisiva. La transición real la fija la tolerancia del proceso |
| **Fatiga estructural** | Alta. Un salto de curvatura es un salto escalonado de carga sobre la vía: concentración de tensión y sitio de iniciación de fisuras |
| **Excitación de vibración** | Alta en un modelo. Un escalón de aceleración es de banda ancha y excita todos los modos del carro y de la vía. En una maqueta impresa con poco amortiguamiento se traduce en traqueteo y ruido |
| No sobrevive la verificación filtrada a 5 Hz | Alta donde §7.1.7.2 aplica |
| El jerk deja de ser calculable | Media. No se puede reportar ni verificar contra criterio |

La fatiga es la que más pesa para el proyecto físico. Coincide con la conclusión de Pendrill y Eager (2020) **[SIN VERIFICAR — referencia completa pendiente]**: minimizar jerk y snap importa tanto para confort y seguridad como para reducir fatiga estructural.

### 6.6 Práctica de la industria

El caso fundacional es el **loop clotoide de Werner Stengel** (mediados de los años 70, Revolution en Six Flags Magic Mountain) **[SIN VERIFICAR — atribución y fecha pendientes de fuente primaria]**. El loop circular tiene una discontinuidad de curvatura en la entrada — se pasa de recta ($\kappa = 0$) a círculo ($\kappa = 1/R$) de golpe — y esa discontinuidad producía latigazo cervical. La clotoide se adoptó precisamente para eliminarla.

Las herramientas modernas de diseño (*Force Vector Design*, ver glosario) trabajan especificando el **perfil de fuerza** y derivando la geometría a partir de él, en vez de al revés. Eso existe justamente para que el diseñador controle la continuidad y la tasa de aparición de las G directamente.

Conclusión: la industria no diseña ni con jerk cero ni con discontinuidad. Diseña con **tasa de aparición acotada y elegida**.

### 6.7 Política adoptada

Se reemplaza el criterio binario por un **presupuesto de tasa de aparición por eje**:

| Eje | Continuidad exigida | Presupuesto de onset | Justificación |
|---|---|---|---|
| $G_y$ lateral | $\mathcal{G}^2$ curva + $C^2$ roll | El más bajo de los tres | Sin valor de emoción; el jerk lateral produce sacudida de cabeza. Es la queja clásica de las curvas sin peralte |
| $G_z$ vertical | $\mathcal{G}^2$ curva | Alto pero acotado, parametrizable | Las transiciones secas son la firma de los coasters modernos. La norma limita la *carga* rápida, no la *descarga* |
| $G_x$ longitudinal | Acotado por el sistema de lanzamiento y frenado | Según Fig. 6 nota 1 | Lo fija el LSM (motor sincrónico lineal), no la geometría del loop |

La asimetría de $G_z$ que reconoce la norma tiene sentido fisiológico: §7.1.7.2 limita la transición *hacia* $+G_z$ (que empuja la sangre lejos de la cabeza) y no limita la descarga hacia $-G_z$. Airtime seco: permitido. Recuperación seca: limitada.

**Implementación:** `OnsetMaximo` como vector de tres componentes ($J_{x,max}, J_{y,max}, J_{z,max}$ — ver [`NOMENCLATURA.md`](NOMENCLATURA.md#2-cinemática-y-dinámica)), uno por eje, con valores por defecto derivados de la norma y escalados por $\sqrt\lambda$. El generador ajusta la longitud de transición para respetarlos y reporta el margen. $G_y$ es el más laxo de definir porque no tiene valor normativo propio: se adopta el más restrictivo de los otros dos como criterio propio — **decisión sin cerrar**, ver [§10](#10-pendientes-que-bloquean-el-dimensionamiento).

---

## 7. Longitudes de transición: derivación y escalado

### 7.1 Por qué el criterio de onset cambia entre modelo y prototipo

Es la pregunta clave y la respuesta está en distinguir **magnitud** de **tasa**.

Bajo semejanza de Froude:

$$a_{modelo} = a_{real} \quad\text{(las G son iguales)}, \qquad t_{modelo} = \frac{t_{real}}{\sqrt\lambda} \quad\text{(el tiempo se comprime)}$$

Las fuerzas G **sí** son iguales — eso no cambió. Lo que cambia es **cuánto tarda el carro en llegar a esa G**, porque el modelo recorre toda la experiencia $\sqrt\lambda$ veces más rápido en tiempo de reloj.

Imagen mental: el gráfico de G contra tiempo del modelo es **exactamente el mismo gráfico** que el del prototipo, con el eje horizontal comprimido por un factor 4.69. Los picos están a la misma altura. Pero al comprimir el eje del tiempo, **todas las pendientes se vuelven 4.69 veces más empinadas**.

El jerk es la pendiente de esa curva. De ahí:

$$J = \frac{da}{dt} \implies \frac{J_m}{J_r} = \frac{a_m/a_r}{t_m/t_r} = \frac{1}{1/\sqrt\lambda} = \sqrt\lambda$$

**No es que el criterio cambie: el criterio es el mismo y se aplica al prototipo.** Lo que cambia es el valor numérico que un modelo fiel produce. Un modelo que reproduce fielmente un prototipo que cumple 15 G/s exhibe 70.4 G/s. Si se le exigiera al modelo cumplir 15 G/s, se le estaría exigiendo ser *más suave* que el prototipo, y ya no sería fiel.

### 7.2 Derivación de la longitud de transición — vía cinemática

$$\Delta t = \frac{\Delta G}{J}, \qquad L_{trans} = v\,\Delta t = \frac{v\,\Delta G}{J}$$

### 7.3 Derivación de la longitud de transición — vía geometría

Esta derivación responde a la objeción legítima de que el cambio de G depende de la velocidad **y** de la geometría, no sólo del tiempo.

Para un valle, la G neta incluyendo gravedad es:

$$G(s) = 1 + \frac{v^2\kappa(s)}{g}$$

Derivando respecto del tiempo, con $\kappa$ variando a lo largo del arco:

$$J = \frac{dG}{dt} = \frac{v^2}{g}\frac{d\kappa}{dt} = \frac{v^2}{g}\frac{d\kappa}{ds}\frac{ds}{dt} = \frac{v^3}{g}\frac{d\kappa}{ds}$$

Despejando la tasa de curvatura que corresponde a un presupuesto de jerk dado:

$$\frac{d\kappa}{ds} = \frac{J\,g}{v^3}$$

En una clotoide $d\kappa/ds$ es constante por definición, así que la longitud necesaria para pasar de $\kappa=0$ hasta $\kappa_f$ es:

$$L_{trans} = \frac{\kappa_f}{d\kappa/ds} = \frac{\kappa_f\,v^3}{J\,g}$$

Y la curvatura final que produce la G pico buscada es $\kappa_f = \Delta G\,g/v^2$. Sustituyendo:

$$L_{trans} = \frac{\Delta G\,g}{v^2}\cdot\frac{v^3}{J\,g} = \frac{\Delta G\,v}{J}$$

**Idéntica a la derivación cinemática.** La dependencia de la geometría se cancela: aparece $\kappa_f$ pero también aparece $v^3$, y el cociente deja sólo $\Delta G\,v/J$.

Verificación numérica de que ambos caminos coinciden:

| $v$ [m/s] | $\Delta G$ [G] | $J$ [G/s] | $L$ vía cinemática [m] | $L$ vía geometría [m] | $\kappa_f$ [1/m] | $R$ [m] |
|---|---|---|---|---|---|---|
| 4.3 | 3.0 | 70.4 | 0.1832 | 0.1832 | 1.592 | 0.628 |
| 3.0 | 2.0 | 70.4 | 0.0852 | 0.0852 | 2.180 | 0.459 |
| 4.3 | 4.0 | 23.5 | 0.7319 | 0.7319 | 2.122 | 0.471 |

**Hipótesis:** $v$ constante dentro de la transición. Verificación del error que introduce, con $v_0 = 4.3$ m/s:

| Desnivel en la transición [m] | $v$ final [m/s] | Error [%] |
|---|---|---|
| 0.03 | 4.23 | 1.6 |
| 0.05 | 4.18 | 2.7 |
| 0.10 | 4.07 | 5.5 |

Aceptable para dimensionamiento preliminar. El generador de geometría **no usa esta hipótesis**: integra $v(s)$ y $\kappa(s)$ acopladamente paso a paso, y esta fórmula sirve sólo como estimación inicial y como test de sanidad del resultado.

### 7.4 El escalado cierra sobre sí mismo

$$L_{trans} = \frac{\Delta G\,v}{J}, \qquad \Delta G \sim \lambda^0, \quad v \sim \lambda^{-1/2}, \quad J \sim \lambda^{+1/2}$$

$$\implies L_{trans} \sim \frac{\lambda^0\cdot\lambda^{-1/2}}{\lambda^{+1/2}} = \lambda^{-1}$$

**La longitud de transición escala como $1/\lambda$, exactamente igual que cualquier otra longitud.** Es lo que la semejanza geométrica exige, y es la confirmación de que el marco es consistente.

Los dos efectos que parecían opuestos en realidad se multiplican en el mismo sentido:

| Factor | Efecto sobre $L$ |
|---|---|
| El modelo va $\sqrt\lambda$ veces más lento → recorre menos vía en el mismo tiempo | $\div\sqrt\lambda$ |
| El modelo admite $\sqrt\lambda$ veces más jerk → necesita menos tiempo | $\div\sqrt\lambda$ |
| **Combinado** | $\div\lambda$ |

Comprobación numérica con $\Delta G = 3$ G:

| | $v$ [m/s] | $J$ [G/s] | $\Delta t$ [s] | $L$ [m] |
|---|---|---|---|---|
| Real | 20.17 | 15.0 | 0.2000 | 4.034 |
| Modelo | 4.30 | 70.4 | 0.0426 | 0.183 |
| Razón | $1/\sqrt\lambda$ | $\sqrt\lambda$ | $1/\sqrt\lambda$ | **$1/\lambda$ = 1/22** ✓ |

### 7.5 Presupuesto de onset del modelo

$$J_{modelo,lim} = \sqrt\lambda\;J_{real,lim}$$

| Criterio | Límite real [G/s] | Límite del modelo ($\lambda=22$) [G/s] |
|---|---|---|
| §7.1.7.2 (0 G → 2 G+) | 15 G/s | 70.4 G/s |
| Fig. 6 nota 1 ($+G_x$ sin apoyacabezas) | 5 g/s | 23.5 G/s |

> **Advertencia sobre el alcance de §7.1.7.2.** La cláusula limita específicamente la transición desde 0 G o menos hacia 2 G o más. Una clotoide que entra a un valle desde vía a nivel va de 1 G a 4 G, y por lo tanto **no cae bajo esa cláusula**: la norma no limita el onset de esa transición. Usar los 15 G/s como presupuesto general es una **extrapolación autoimpuesta**, no un requisito normativo. Se adopta por prudencia y por consistencia interna, y debe declararse como criterio propio en el reporte.

### 7.6 Longitud que consume una transición

| $\Delta G$ [G] | $J$=70.4 G/s, $v$=3.0 m/s [cm] | $J$=70.4 G/s, $v$=4.3 m/s [cm] | $J$=23.5 G/s, $v$=4.3 m/s [cm] |
|---|---|---|---|
| 1 | 4.3 | 6.1 | 18.3 |
| 2 | 8.5 | 12.2 | 36.7 |
| 3 | 12.8 | 18.3 | 55.0 |
| 4 | 17.1 | 24.4 | 73.3 |

### 7.7 Presupuesto total de un loop

A $v=4.3$ m/s con G pico de 4 ($R = 63$ cm):

| Tramo | Longitud |
|---|---|
| Acondicionamiento de entrada | por determinar |
| Clotoide de entrada | ≈ 18 cm |
| Arco del loop | $\approx 2\pi R \approx$ 3.9 m |
| Clotoide de salida | ≈ 18 cm |
| Conector al endpoint | por determinar |

El arco domina ampliamente: las clotoides son alrededor del 10 % del total. Esto **refuerza la decisión de no sacrificar continuidad para ahorrar longitud** — se ahorra poco y se pierde fabricabilidad, vida a fatiga y cumplimiento normativo.

---

## 8. Resumen de criterios adoptados

| Criterio | Valor | Origen |
|---|---|---|
| Continuidad de la curva | $\mathcal{G}^2$ por longitud de arco | Decisión de diseño |
| Continuidad del roll | $C^2$ vía smoothstep quíntico | Derivación de heartline, [§3.8](#38-consecuencias-sobre-la-continuidad-del-roll) |
| Marco de referencia | Transporte paralelo + $\phi(s)$ explícito | [§2.2](#22-marco-de-transporte-paralelo) |
| Escalado | Froude, $\lambda = 22$ **[SIN VERIFICAR]** (provisorio) | [§4](#4-semejanza-de-froude) |
| Límite $+G_z$ | Curva de Fig. 10, dependiente de duración | F2291-06a **[SIN VERIFICAR]** |
| Límite $-G_z$ | Curva de Fig. 9, Base Case | F2291-06a **[SIN VERIFICAR]** |
| Límite $\pm G_y$ | Curva de Fig. 8 | F2291-06a **[SIN VERIFICAR]** |
| Onset $G_z$ | ≤ 70.4 G/s en el modelo | §7.1.7.2 × $\sqrt\lambda$ |
| Onset $G_y$ | Por definir, el más restrictivo | Política [§6.7](#67-política-adoptada) |
| Combinación de dos ejes | Elipse con semiejes = límites de 200 ms × 1.1 | §7.1.5.1 |
| Métrica de G | Aceleración neta total incluida la gravedad | §7.1.4.5 |

---

## 9. Dimensionamiento del carro

### 9.1 La relación que gobierna todo

La pregunta "¿qué tan grande queda el loop?" no necesita $\lambda$ en absoluto. Por semejanza geométrica, **la razón entre dos dimensiones cualesquiera se conserva** entre modelo y prototipo:

$$\frac{H_{loop}}{L_{carro}}\bigg|_{modelo} = \frac{H_{loop}}{L_{carro}}\bigg|_{real}$$

($H_{loop}$ es la **altura total** del loop, medida sobre el punto de entrada — no confundir con "R de cúspide", que es el radio de curvatura en el punto más alto; ver la aclaración en [§4.6](#46-implicancia-de-tamaño). $L_{carro}$ es el largo del carro, código `Parametros.LargoCarro`.)

Con un loop real de ≈ 25 m **[SIN VERIFICAR]** y un carro real de ≈ 2.2 m **[SIN VERIFICAR]**, la razón es ≈ **11.4**:

$$\boxed{\;H_{loop,modelo} \approx 11.4 \times L_{carro,modelo}\;}$$

Es una regla más robusta que pasar por $\lambda$, porque no depende de mi estimación del factor altura/radio del loop: es sólo el cociente de dos dimensiones reales, verificables contra una atracción concreta.

| Largo del carro [cm] | Altura del loop [cm] | $\lambda$ | $v$ cúspide ($G=2$) [m/s] |
|---|---|---|---|
| 4 | 45.5 | 55.0 | 2.36 |
| 5 | 56.8 | 44.0 | 2.64 |
| 6 | 68.2 | 36.7 | 2.89 |
| 8 | 90.9 | 27.5 | 3.34 |
| **10** | **113.6** | **22.0** | **3.73** |
| 12 | 136.4 | 18.3 | 4.09 |

> Las dimensiones reales de referencia (loop de 25 m, carro de 2.2 m) son valores típicos **[SIN VERIFICAR]**, no verificados contra una atracción concreta. Fijar la atracción de referencia y usar sus dimensiones publicadas antes de citar esta tabla en el reporte.

### 9.2 El piso físico: rodamientos

Achicar el carro achica el loop proporcionalmente, pero hay un piso duro que no escala: **el tamaño mínimo de un rodamiento comercial**.

**Símbolos de esta sección:** $R_{rueda}$ es el radio de la rueda; $r_{eje}$ es el radio del eje que pasa por el centro del rodamiento; $\mu_b$ es el coeficiente de fricción interna del rodamiento (adimensional, asimilable a un coeficiente de rozamiento equivalente en el eje); $M_b$ es el torque resistente que ejerce el rodamiento (antes notado $T_{rodamiento}$ — se renombra por la colisión #4 de [`NOMENCLATURA.md`](NOMENCLATURA.md#0-colisiones-resueltas), donde $T$ queda reservado para el versor tangente).

Una rueda portante real mide ≈ 30 cm de diámetro **[SIN VERIFICAR]**. Escalada:

| Largo del carro [cm] | $\lambda$ | Rueda del modelo [mm] | Rodamiento viable |
|---|---|---|---|
| 4 | 55.0 | 5.5 | Sin rodamiento — buje plano |
| 5 | 44.0 | 6.8 | Sin rodamiento — buje plano |
| 6 | 36.7 | 8.2 | 681X (1.5×4×2) al límite |
| 8 | 27.5 | 10.9 | 692 (2×6×2.5) justo |
| **10** | **22.0** | **13.6** | **693 (3×8×3) cómodo** |
| 12 | 18.3 | 16.4 | 693 (3×8×3) cómodo |

Por qué importa. La resistencia a la rodadura de una rueda rígida sobre vía rígida está dominada por la fricción del rodamiento, que se traduce en una fuerza resistente equivalente:

$$F_{res} = \frac{M_b}{R_{rueda}} = \frac{\mu_b\,F_N\,r_{eje}}{R_{rueda}} \implies C_{rr} = \mu_b\,\frac{r_{eje}}{R_{rueda}}$$

(Acá $F_N$ es la fuerza normal — colisión #6 resuelta.)

**Mientras el diámetro interior del rodamiento pueda escalar junto con la rueda, $C_{rr}$ es invariante de escala.** Pero el diámetro interior tiene un piso comercial de 1.5–3 mm. Por debajo de ese punto la razón $r_{eje}/R_{rueda}$ empieza a crecer y $C_{rr}$ crece con ella, es decir:

$$C_{rr} \propto \frac{1}{R_{rueda}} \quad \text{una vez alcanzado el rodamiento mínimo}$$

Con un carro de 10 cm la rueda queda en ≈ 13.6 mm, que es aproximadamente el mínimo que aloja cómodamente un rodamiento estándar más una banda de rodadura. **El diseño actual está justo en el piso.** Achicar el carro obliga a bujes planos, con fricción sustancialmente mayor, en un modelo que ya es marginal energéticamente.

### 9.3 Otros efectos de achicar

| Efecto | Dirección | Comentario |
|---|---|---|
| Altura del loop | Mejora (más chico) | Proporcional al largo del carro |
| $C_{rr}$ efectivo | **Empeora** | Por debajo del rodamiento mínimo, crece como $1/R_{rueda}$ |
| Número de Reynolds ($Re$) | Empeora | $Re \sim \lambda^{-3/2}$; con carro de 4 cm baja a ≈ 7×10³ |
| Tolerancia relativa de fabricación | **Empeora** | La precisión de impresión (≈0.1–0.2 mm) es fija; su peso relativo crece |
| Frecuencia de conmutación del LSM | Empeora | $f = v/\text{paso polar} \sim \sqrt\lambda$: sensado y conmutación más rápidos |
| Espacio para mecanismos | **Empeora** | Switch track, frenos de Foucault, imanes del LSM tienen tamaños mínimos |
| Fuerza requerida al LSM | Mejora | $F \sim \lambda^{-3}$: baja muy rápido |

Reynolds en función del tamaño:

| Largo del carro [cm] | $\lambda$ | $v$ [m/s] | $Re$ |
|---|---|---|---|
| 4 | 55.0 | 2.70 | 7 191 |
| 6 | 36.7 | 3.30 | 13 212 |
| 10 | 22.0 | 4.26 | 28 427 |

### 9.4 λ no es una propiedad del modelo

Punto conceptual que hay que tener claro antes de decidir nada.

**λ es una propiedad de un emparejamiento entre una dimensión del modelo y la correspondiente del prototipo**, no del modelo en su conjunto. Se puede calcular uno por cada dimensión:

$$\lambda_{carro} = \frac{L_{carro,real}}{L_{carro,modelo}}, \qquad \lambda_{loop} = \frac{R_{loop,real}}{R_{loop,modelo}}$$

El número de Froude involucra **una sola** longitud característica:

$$Fr = \frac{v}{\sqrt{g\,L}}$$

Y la que gobierna la dinámica de un loop es el **radio del loop**, no el largo del carro:

$$G_{centrípeta} = \frac{v^2}{g\,R} = Fr^2$$

El largo del carro no aparece en esa ecuación. Por lo tanto, calcular λ a partir del carro y aplicarlo al loop **sólo es legítimo si se impone además semejanza geométrica**: que todas las longitudes escalen por el mismo factor. Esa imposición es una decisión de diseño, no una consecuencia física.

### 9.5 Las dos opciones de similitud

**Modelo semejante — $\lambda_{loop} = \lambda_{carro}$.** Todas las longitudes escalan por el mismo factor. El modelo es una réplica a escala de una atracción concreta. Con carro de 10 cm el loop queda forzado a ≈114 cm.

Afirmación resultante: *"este modelo reproduce el perfil de G de la atracción X"*. Es la más fuerte, y fija el tamaño.

**Modelo distorsionado — $\lambda_{loop} \neq \lambda_{carro}$.** El loop escala por un factor y el carro por otro. Se elige el tamaño de loop que las restricciones de fabricación permitan y el tamaño de carro que sea realizable.

No es un atajo ni una concesión: **los modelos distorsionados son práctica estándar en similitud**. En ingeniería hidráulica, los modelos de ríos y estuarios se construyen rutinariamente con escala vertical distinta de la horizontal, precisamente porque un modelo geométricamente semejante daría profundidades de milímetros donde la tensión superficial dominaría el flujo. La práctica correcta es declarar la distorsión y explicitar qué se conserva y qué no.

### 9.6 Qué conserva y qué pierde el modelo distorsionado

**Se conserva: el perfil de G del loop.** Sale de $v^2/(gR)$, que involucra únicamente el radio del loop y la velocidad. Eligiendo $R$ y ajustando $v$ para igualar el Froude del prototipo, las G son fielmente las del prototipo. El largo del carro no interviene.

**Se pierde: la proporción entre longitud del tren y perímetro del loop.** Es lo único, y afecta exclusivamente al modelo multi-carro. Se cuantifica con dos magnitudes derivadas, definidas explícitamente acá porque hasta ahora sólo estaban en prosa:

$$\text{distorsión} = \frac{\lambda_{carro}}{\lambda_{loop}}, \qquad \text{CarrosEquivalentes} = \frac{n_{carros}}{\text{distorsión}}$$

`CarrosEquivalentes` es cuántos carros de la atracción real ocuparían la misma fracción de perímetro de loop que ocupa el tren del modelo. Ver también la discrepancia respecto de una versión anterior de esta fórmula, documentada en [`documentacion_generador_elementos.md` §13](documentacion_generador_elementos.md#13-discrepancias-con-la-consigna).

Cuantificación, con carro de 10 cm y atracción de referencia de loop 25 m / carro 2.2 m **[SIN VERIFICAR]**:

| Altura del loop modelo [cm] | $\lambda_{loop}$ | $\lambda_{carro}$ | Distorsión | 1 carro equivale a un tren real de |
|---|---|---|---|---|
| 114 | 22.0 | 22.0 | 1.00 | 1.0 carros |
| 100 | 25.0 | 22.0 | 0.88 | 1.1 carros |
| 70 | 35.7 | 22.0 | 0.62 | 1.6 carros |
| 50 | 50.0 | 22.0 | 0.44 | 2.3 carros |
| 30 | 83.3 | 22.0 | 0.26 | 3.8 carros |

Lectura: con loop de 50 cm y carros de 10 cm, cada carro ocupa la misma fracción del loop que **2.3 carros reales**. Un tren de 3 carros del modelo se comporta como un tren real de 6.8 carros.

**Con un solo carro la distorsión no tiene efecto**, porque el efecto que se rompe es precisamente el de longitud del tren. Al pasar a N carros hay que declararla como limitación y reportar el equivalente en carros reales.

### 9.7 Palanca alternativa: acortar el carro sin achicar la rueda

El piso duro es la **rueda** (≈13.6 mm, por el rodamiento), y es separable del largo del carro. Se puede tener un carro corto con ruedas relativamente grandes.

| Largo del carro [cm] | Loop sin distorsión [cm] | Rueda si escala con el carro [mm] |
|---|---|---|
| 6 | 68 | 8.2 — demasiado chica |
| 7 | 80 | 9.5 |
| 8 | 91 | 10.9 |
| 10 | 114 | 13.6 — cómoda |

Manteniendo ruedas de ≈13 mm y acortando el carro a 7–8 cm se baja el loop a 80–90 cm **sin distorsión** y sin comprometer el rodamiento. El carro queda visualmente rechoncho (ruedas proporcionalmente grandes) pero mecánicamente sano.

### 9.8 Restricciones del proyecto y decisión adoptada

Restricciones declaradas:

| Restricción | Valor |
|---|---|
| Altura máxima del loop | **1 m**, no sólo por este elemento sino porque el resto del circuito ocuparía la casa entera |
| Proceso de fabricación de la vía | Impresión 3D |
| Disponibilidad de componentes | Varios componentes son difíciles o caros de conseguir en Argentina; condiciona la elección de ruedas y rodamientos |
| Sin definir | Ruedas, dimensiones del carro, altura del loop — requieren investigación de disponibilidad local |

**Decisión adoptada: modelo distorsionado.**

Justificación para el reporte:

1. La restricción de altura (1 m) y la de huella total del circuito son binding y no negociables. Un modelo geométricamente semejante a una atracción comercial exigiría un loop de ≈114 cm sólo para ese elemento.
2. Las dimensiones del carro no se pueden fijar todavía, porque dependen de la disponibilidad local de rodamientos y de las tolerancias alcanzables por impresión 3D. Un modelo semejante exigiría fijar el carro primero y aceptar el loop que salga.
3. El costo de la distorsión —la proporción tren/loop— es nulo con un carro y cuantificable y declarable con varios.
4. Lo que el proyecto quiere demostrar son los **mecanismos** (LSM, switch track, freno de Foucault), que tienen tamaños mínimos propios. Dimensionar el carro por el loop optimizaría la restricción equivocada.

Consecuencia operativa: el generador de elementos toma $R_{loop}$ y $L_{carro}$ como **parámetros independientes**, calcula ambos λ y reporta la distorsión y el equivalente en carros reales. No hay ningún λ único cableado en el código.

---

## 10. Pendientes que bloquean el dimensionamiento

- [x] Elección del tipo de similitud → **modelo distorsionado** ([§9.8](#98-restricciones-del-proyecto-y-decisión-adoptada))
- [x] Altura máxima del loop → **1 m**
- [ ] Atracción de referencia concreta, con dimensiones publicadas de loop y de carro
- [ ] Tamaño de rueda y rodamiento — sujeto a disponibilidad en Argentina
- [ ] Dimensiones definitivas del carro
- [ ] Altura definitiva del loop dentro del techo de 1 m
- [ ] Huella total disponible para el circuito completo
- [ ] Volumen mínimo que requieren LSM, switch track y freno de Foucault
- [ ] Tolerancia alcanzable por la impresora, que fija el radio mínimo de vía fabricable
- [ ] Presupuesto de onset de $G_y$: no tiene valor normativo propio, se adopta el más restrictivo de los otros dos ejes como criterio propio (§6.7) — falta cerrar el criterio de cuál es "el más restrictivo" en cada caso
- [ ] Offset heartline → cabeza $e$ (`DistanciaHeartlineACabeza`): hoy vale 0.030 m y **no** es una medida antropométrica. Cerrarlo exige escalar un offset corazón-cabeza real por $\lambda$ — a $\lambda\approx22$, ~0.25 m daría ~0.011 m ([§3.1](#31-planteo-tres-curvas-no-una)). Afecta sólo la G informativa de la cabeza, salvo que se pida `PuntoDeVerificacionNormativa = 'Cabeza'`
- [ ] Criterio de rotación pura: hoy la rotación entra por el brazo $b$ del transporte de cuerpo rígido. ASTM F2291 §7.1.6 tiene un límite de **velocidad angular** propio, que sería el criterio correcto y no está implementado

---

## 11. Datos pendientes de verificación

Todo dato marcado **[SIN VERIFICAR]** en el cuerpo de este documento, consolidado acá. Ningún valor de esta
tabla fue inventado para completar un cálculo: donde falta un dato, se lo dejó marcado en vez de suponerlo.

| Dato | Valor usado | Dónde se usa | Fuente pendiente |
|---|---|---|---|
| Dimensiones "típicas" de atracción real | loop de 25 m, carro de 2.2 m, alto de carro 1.5 m, trocha 1.3 m, rueda portante ≈30 cm de diámetro | §4.3, §9.1, §9.2 | Fijar una atracción de referencia concreta y usar sus dimensiones publicadas |
| Valores tabulados de los límites de las Figs. 6 a 10 | tablas completas de §5.2 a §5.6 | §5.2–§5.6, §8 | Leídos de la figura y no del texto normativo, edición F2291-06a; contrastar además contra la versión vigente **F2291-25c**. Los puntos de quiebre de la Fig. 9 en 3.0 s y 4.0 s son la lectura más consistente pero no confirmada |
| Factor altura/radio de un loop clotoide | 2.2–2.6 × R de cúspide | §4.6 | Fuente de ingeniería de coasters que dé el rango con referencia |
| Atribución del loop clotoide | Werner Stengel, mediados de los 70, Revolution en Six Flags Magic Mountain | §6.6 | Fuente primaria (patente, entrevista o publicación técnica) |
| Cita a Pendrill y Eager (2020) | referencia usada para respaldar la importancia de jerk/snap en fatiga estructural | §6.5 | Verificar referencia bibliográfica completa (título, revista, DOI) |
| Los tres coeficientes de rodadura y el $C_d$ | $C_{rr,port}=0.030$, $C_{rr,guia}=0.035$, $C_{rr,ret}=0.035$, $C_d=0.90$ | Parámetros de `ParametrosPorDefecto.m`, usados en generador y en `analisis_energia.m` | Provisorios, requieren calibración experimental sobre el carro real construido |
| $\lambda = 22$ como valor de trabajo | factor de escala adoptado en todo el documento | §4.2 a §9 | Provisorio: deriva de las dimensiones no verificadas de la atracción de referencia (fila 1 de esta tabla) |

> Los valores de las tablas de la norma **no se tocan ni se recalculan** en este trabajo de reestructuración. Se marcan. No se inventaron valores para reemplazar los que faltan.
