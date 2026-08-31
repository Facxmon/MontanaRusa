# Memoria de cálculo — criterios de diseño del constructor de elementos

Documento de criterios y derivaciones. Complementa a [`documentacion_analisis_energia.md`](documentacion_analisis_energia.md), que documenta el script de análisis energético; acá va la fundamentación de los criterios que ese script y el generador de elementos tienen que respetar.

---

# 1. Continuidad paramétrica y geométrica

## 1.1 Definiciones

**Continuidad paramétrica $C^n$.** Las derivadas de la curva respecto del parámetro coinciden hasta orden $n$ en el punto de empalme.

- $C^0$: coincide la posición
- $C^1$: coincide el vector velocidad — módulo **y** dirección
- $C^2$: coincide el vector aceleración
- $C^3$: coincide el jerk

**Continuidad geométrica $G^n$.** Coinciden las propiedades geométricas del trazo, independientemente de a qué velocidad se lo recorra.

- $G^0$: coincide la posición
- $G^1$: coincide la **dirección** tangente (los módulos pueden diferir)
- $G^2$: coincide el vector curvatura
- $G^3$: coincide la torsión

## 1.2 Relación entre ambas

$$C^n \implies G^n, \qquad G^n \nRightarrow C^n$$

$C^n$ es la condición **más fuerte**. La implicación se ve directamente en la definición de curvatura:

$$\kappa = \frac{\lVert \mathbf{r}'\times\mathbf{r}''\rVert}{\lVert\mathbf{r}'\rVert^3}$$

Si $\mathbf{r}'$ y $\mathbf{r}''$ son continuas y $\mathbf{r}' \neq \mathbf{0}$, entonces $\kappa$ es continua.

**Excepción — parametrización no regular.** Si la velocidad paramétrica se anula ($\mathbf{r}' = \mathbf{0}$), la expresión queda $0/0$ y la implicación se rompe: se puede construir una curva $C^\infty$ con una esquina geométrica visible (cúspide). Por eso la implicación exige parametrización regular.

## 1.3 Qué se exige en este proyecto

Una vía física **no tiene parametrización**: es una curva en el espacio. $C^n$ es una afirmación sobre una parametrización elegida; $G^n$ es una afirmación sobre el objeto físico.

Como toda la discretización de este proyecto es **por longitud de arco**, en esa parametrización $\lVert\mathbf{r}'(s)\rVert = 1$ idénticamente. La parametrización es regular por construcción, y por lo tanto:

$$C^n \Longleftrightarrow G^n \quad \text{(en parametrización por longitud de arco)}$$

Exigir $G^2$ por longitud de arco es exactamente equivalente a exigir $C^2$. No es una condición más débil.

## 1.4 El roll es un grado de libertad aparte

La clasificación $C^n/G^n$ describe la **curva central**. Una vía tiene un grado de libertad más: la rotación de la sección alrededor de la tangente, el ángulo de roll $\phi(s)$.

Ningún nivel de continuidad de la curva restringe $\phi$. Por eso la especificación tiene dos partes independientes: continuidad de la curva **y** continuidad del roll.

**Torsión ≠ roll.** La torsión $\tau$ es la tasa a la que gira el plano osculador de la curva; es una propiedad de la curva y aparece en el nivel $G^3$. El roll es la orientación de la sección de vía. En un loop vertical planar $\tau = 0$ en todo el recorrido y sin embargo el roll puede estar haciendo cualquier cosa. Son objetos distintos.

---

# 2. Marco de referencia de la vía

## 2.1 Por qué Frenet-Serret no sirve

El marco de Frenet-Serret define la terna local a partir de la geometría de la curva:

$$\mathbf{T} = \frac{\mathbf{r}'}{\lVert\mathbf{r}'\rVert}, \qquad \mathbf{N} = \frac{\mathbf{T}'}{\lVert\mathbf{T}'\rVert}, \qquad \mathbf{B} = \mathbf{T}\times\mathbf{N}$$

Tiene dos fallas que lo descalifican como marco de una vía:

**Falla 1 — indefinido donde $\kappa = 0$.** La normal se define dividiendo por $\lVert\mathbf{T}'\rVert = \kappa$. En un tramo recto $\kappa = 0$ y la división es $0/0$: la normal no existe. Y no es un caso raro: aparece en **todos** los tramos rectos, y en el punto medio de cualquier clotoide que cruce por curvatura nula.

**Falla 2 — salto de 180° en las inflexiones.** La normal de Frenet siempre apunta hacia el centro de curvatura. Cuando la vía pasa de curvar hacia un lado a curvar hacia el otro, el centro de curvatura salta al lado opuesto y $\mathbf{N}$ se invierte instantáneamente.

Consecuencia física de la falla 2: si el marco del carro se derivara de Frenet, en cada inflexión el carro haría un tonel de 180° instantáneo. Numéricamente es peor todavía, porque cerca de la inflexión $\kappa$ es chico y $\mathbf{N}$ oscila con el ruido de redondeo.

## 2.2 Marco de transporte paralelo

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

## 2.3 Marco del carro

$$\mathbf{U}(s) = \cos\phi(s)\,\mathbf{U}_{pt}(s) + \sin\phi(s)\,\mathbf{L}_{pt}(s)$$
$$\mathbf{L}(s) = -\sin\phi(s)\,\mathbf{U}_{pt}(s) + \cos\phi(s)\,\mathbf{L}_{pt}(s)$$

con $\{\mathbf{T},\mathbf{U}_{pt},\mathbf{L}_{pt}\}$ el marco de transporte paralelo y $\{\mathbf{T},\mathbf{U},\mathbf{L}\}$ el marco del carro.

Sobre este marco se descomponen las G en los ejes del pasajero:

$$G_x = \frac{\mathbf{a}_{total}\cdot\mathbf{T}}{g}, \qquad G_y = \frac{\mathbf{a}_{total}\cdot\mathbf{L}}{g}, \qquad G_z = \frac{\mathbf{a}_{total}\cdot\mathbf{U}}{g}$$

Sin este marco no hay forma de comparar contra los límites de la norma, que están definidos por eje del pasajero.

---

# 3. Cinemática de heartline

## 3.1 Planteo

El pasajero no está sobre el riel: está a una distancia $d$ del eje de la vía, medida a lo largo de $\mathbf{U}$. Ese punto de referencia es la **heartline**.

$$\mathbf{p}(s) = \mathbf{r}(s) + d\,\mathbf{U}(s)$$

$d$ es un **parámetro virtual de evaluación**, no una propiedad física del carro del modelo: representa dónde estaría el pecho de un pasajero a escala. Sirve para calcular qué sentiría ese pasajero.

## 3.2 Transferencia de aceleraciones

El carro es un cuerpo rígido, así que aplica la fórmula de transferencia entre dos puntos:

$$\mathbf{a}_P = \mathbf{a}_O + \boldsymbol{\alpha}\times\mathbf{r}_{P/O} + \boldsymbol{\omega}\times(\boldsymbol{\omega}\times\mathbf{r}_{P/O})$$

con $O$ sobre el riel, $P$ la heartline, $\mathbf{r}_{P/O} = d\,\mathbf{U}$.

| Término | Nombre | Origen |
|---|---|---|
| $\mathbf{a}_O$ | Aceleración del riel | $a_t\mathbf{T} + \kappa v^2\mathbf{N}$ |
| $\boldsymbol{\omega}\times(\boldsymbol{\omega}\times\mathbf{r})$ | Centrípeta del punto desplazado | El pasajero gira alrededor del eje de vía |
| $\boldsymbol{\alpha}\times\mathbf{r}$ | Euler (tangencial de rotación) | El giro está acelerando |

## 3.3 Velocidad angular

$$\boldsymbol{\omega} = \Omega_T\mathbf{T} + \Omega_U\mathbf{U} + \Omega_L\mathbf{L}$$

$\Omega_U$ y $\Omega_L$ las impone la curvatura (el marco debe girar a razón $\kappa v$ para seguir la vía). La componente de roll es:

$$\Omega_T = \frac{d\phi}{dt} = v\,\frac{d\phi}{ds} = v\,\phi'$$

Esta igualdad ya dice algo importante: **la misma geometría de roll gira más rápido en el tiempo a mayor velocidad.**

## 3.4 Los dos términos de roll

Tomando $\boldsymbol{\omega}\approx\Omega_T\mathbf{T}$ y $\mathbf{r}_{P/O} = d\mathbf{U} \perp \mathbf{T}$:

**Centrípeto** (apunta hacia el eje de la vía, o sea $-\mathbf{U}$):
$$a_{U,\text{roll}} = -\Omega_T^2\,d = -v^2\phi'^2\,d$$

**Euler** (perpendicular a $\mathbf{T}$ y a $\mathbf{U}$, o sea **lateral**):
$$a_{L,\text{roll}} = \dot{\Omega}_T\,d$$

Expandiendo por regla de la cadena:
$$\dot{\Omega}_T = \frac{d}{dt}(v\phi') = \frac{dv}{dt}\phi' + v\frac{d\phi'}{ds}\frac{ds}{dt} = a_t\,\phi' + v^2\,\phi''$$

## 3.5 Resultado

$$\boxed{\;a_{\text{lateral, heartline}} = d\,\big(a_t\,\phi' + v^2\,\phi''\big)\;}$$

$$a_{\text{vertical, heartline}} = -d\,v^2\,\phi'^2$$

## 3.6 Consecuencias

**La aceleración lateral depende de $\phi''$.** Si $\phi$ es sólo $C^1$, entonces $\phi''$ es discontinua y **hay un salto de aceleración lateral** en los extremos de la transición de roll.

| Modelo | Aceleración continua | Jerk continuo |
|---|---|---|
| Partícula sobre el riel ($d=0$) | $\phi \in C^0$ | $\phi \in C^1$ |
| **Con heartline ($d>0$)** | $\phi \in C^2$ | $\phi \in C^3$ |

**Perfil de roll adoptado: smoothstep quíntico.** Con $u = s/L_{trans}$ normalizado en $[0,1]$:

$$\phi(u) = \phi_{total}\,\big(6u^5 - 15u^4 + 10u^3\big)$$

Cumple $\phi'(0)=\phi'(1)=0$ **y** $\phi''(0)=\phi''(1)=0$, de modo que empalma con $C^2$ contra cualquier tramo de roll constante a ambos lados, sin salto de aceleración lateral.

**Alternativa descartada:** la rampa coseno $\phi = \phi_{total}(1-\cos\pi u)/2$ tiene $\phi'(0)=0$ pero $\phi''(0)\neq 0$, así que sí produce el salto de aceleración lateral. Es una trampa frecuente.

## 3.7 Verificación de consistencia con Froude

Contando exponentes de $\lambda$ en el resultado de 3.5: $d\sim\lambda^{-1}$, $a_t\sim\lambda^0$, $\phi'\sim\lambda^{1}$, $v^2\sim\lambda^{-1}$, $\phi''\sim\lambda^{2}$.

$$d\,a_t\,\phi' \sim \lambda^{-1+0+1} = \lambda^0 \qquad d\,v^2\phi'' \sim \lambda^{-1-1+2} = \lambda^0$$

Ambos términos son invariantes de escala, consistente con que la aceleración lo sea bajo Froude. La derivación y el marco de escalado son mutuamente consistentes.

---

# 4. Semejanza de Froude

## 4.1 Fundamento

Una montaña rusa es una máquina de gravedad: toda la energía sale de $mgh$ y todas las cargas se comparan contra $mg$. Lo que define la experiencia es la relación entre fuerzas inerciales y gravitatorias.

Con las tres variables que gobiernan el problema — velocidad $v$, longitud característica $L$, gravedad $g$ — hay un único grupo adimensional formable:

$$Fr = \frac{v}{\sqrt{gL}}$$

Y su cuadrado es directamente la fuerza G:

$$Fr^2 = \frac{v^2}{gL} = \frac{v^2/L}{g} = \frac{\text{aceleración centrípeta}}{g}$$

**Igualar Froude entre modelo y prototipo es igualar las fuerzas G.** Ése es el motivo por el que es el criterio de escalado correcto para este proyecto.

## 4.2 Factores de escala

Con $\lambda = L_{real}/L_{modelo}$ y **la misma gravedad en ambos** (no se puede escalar $g$):

$$\frac{v_m}{\sqrt{gL_m}} = \frac{v_r}{\sqrt{gL_r}} \implies \frac{v_m}{v_r} = \frac{1}{\sqrt{\lambda}}$$

De ahí, con $t = L/v$ y $a = v^2/L$:

| Magnitud | Factor modelo/real | $\lambda = 22$ |
|---|---|---|
| Longitud | $1/\lambda$ | 0.0455 |
| Velocidad | $1/\sqrt\lambda$ | 0.213 |
| Tiempo | $1/\sqrt\lambda$ | 0.213 |
| **Aceleración (G)** | **1** | **1.00** |
| Jerk | $\sqrt\lambda$ | 4.69 |
| Velocidad angular | $\sqrt\lambda$ | 4.69 |
| Aceleración angular | $\lambda$ | 22.0 |

## 4.3 Estimación de $\lambda$

| Anclaje | Real (aproximado) | Modelo | $\lambda$ |
|---|---|---|---|
| Largo de carro | 2.2 m | 0.10 m | 22.0 |
| Alto de carro | 1.5 m | 0.06 m | 25.0 |
| Trocha de vía | 1.3 m | 0.06 m | 21.7 |

Valor de trabajo adoptado: $\lambda = 22$, $\sqrt\lambda = 4.69$.

> Las dimensiones "reales" son rangos típicos, no datos verificados contra una atracción concreta. Para el reporte hay que fijar una atracción de referencia y usar sus dimensiones publicadas.

## 4.4 Dirección correcta de la conversión de jerk

Un modelo fiel a Froude produce jerk $\sqrt\lambda$ veces **mayor** que el prototipo. El criterio normativo aplica al prototipo. Por lo tanto, para verificar cumplimiento:

$$J_{real,equiv} = \frac{J_{modelo}}{\sqrt\lambda} \leq J_{lim} \qquad\Longleftrightarrow\qquad J_{modelo} \leq \sqrt\lambda\;J_{lim}$$

**El presupuesto de jerk del modelo es mayor que el número de la norma, no menor.** El jerk es una restricción menos severa en el modelo.

## 4.5 Qué no escala

**Resistencia a la rodadura.** El coeficiente depende del radio de rueda y de la fricción interna del rodamiento, ninguno de los cuales baja proporcionalmente al achicar. El modelo pierde proporcionalmente más energía que el prototipo. Es una limitación del análisis y hay que declararla.

**Número de Reynolds.** $Re_m/Re_r = \lambda^{-3/2} \approx 1/103$. Como $C_d$ depende de $Re$, no es exactamente el mismo coeficiente. En el rango del modelo ($Re \approx 2$–$4\times10^4$) el $C_d$ de un cuerpo romo varía poco, así que el error es acotado. Es el **conflicto clásico Froude-Reynolds**: no se pueden igualar los dos simultáneamente. Es el mismo problema que enfrentan los ensayos de modelos navales.

**Arrastre relativo al peso — sí escala.** Con semejanza geométrica y densidad equivalente: $A\sim L^2$, $v^2\sim L$, $m\sim L^3$, de modo que $F_d/mg \sim L^2\cdot L/L^3 = \text{cte}$. El arrastre mantiene la misma importancia relativa.

## 4.6 Implicancia de tamaño

Ésta es la consecuencia con más impacto sobre el proyecto físico. Un loop real escalado a $\lambda = 22$:

| $R$ cúspide real | $R$ cúspide modelo | Altura del loop modelo | $v$ cúspide modelo ($G=2$) |
|---|---|---|---|
| 8 m | 36 cm | 80–95 cm | 3.3 m/s |
| 10 m | 46 cm | 100–118 cm | 3.7 m/s |
| 12 m | 55 cm | 120–142 cm | 4.0 m/s |
| 15 m | 68 cm | 150–177 cm | 4.5 m/s |

(Altura total del loop estimada en 2.2–2.6 veces el radio de cúspide, típico de un loop clotoide.)

**La fidelidad de Froude con un carro de 10 cm obliga a un loop de aproximadamente un metro de altura.** No es un elemento de mesa.

Chequeo inverso, si se impone la altura disponible:

| Altura disponible | $R$ modelo | $R$ real equivalente | $v$ cúspide modelo |
|---|---|---|---|
| 30 cm | 12.5 cm | 2.8 m | 1.9 m/s |
| 50 cm | 21 cm | 4.6 m | 2.5 m/s |
| 80 cm | 33 cm | 7.3 m | 3.1 m/s |
| 100 cm | 42 cm | 9.2 m | 3.5 m/s |

Un loop que quepa en 50 cm representa fielmente una atracción cuyo loop real tendría 4.6 m de radio — más chico que cualquier loop comercial. Sigue siendo un ejercicio válido de Froude, pero deja de representar una atracción existente.

**Éste es el trade-off central del proyecto y hay que resolverlo antes de fabricar:** o el modelo es grande y representa fielmente una atracción real, o es compacto y representa una atracción hipotética más chica de lo que existe.

---

# 5. Criterios de aceptación — ASTM F2291-06a §7

> Valores leídos de las Figs. 6 a 10 de la norma. La versión vigente es **F2291-25c**: estos valores pueden haber cambiado. En una maqueta sin pasajeros estos criterios son **autoimpuestos**, no normativa aplicable — se adoptan como criterio de diseño para demostrar conocimiento y aplicación de práctica industrial real.

## 5.1 Definiciones normativas aplicables

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

La cláusula §7.1.4.5 valida la métrica del script: `NormalVia` (gravedad + centrípeta combinadas) es exactamente la magnitud que la norma limita. `NormalRadioDeGiro` no lo es, porque excluye la gravedad.

## 5.2 Fig. 6 — Límites de $+G_x$ (Eyes Back, aceleración hacia atrás)

Caso base con apoyacabezas:

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

**Nota 1:** se requiere apoyacabezas por encima de 1.5 g, salvo que la tasa de aparición sea menor a 5 g/s, en cuyo caso se permite hasta 2.0 g. Sin apoyacabezas, la duración máxima por encima de 1.5 g es 4 s.

**Nota 2:** los procedimientos de diseño y operación deben asegurar que el pasajero esté en contacto con y soportado por respaldo y apoyacabezas apropiados.

## 5.3 Fig. 7 — Límites de $-G_x$ (Eyes Front, desaceleración)

| Duración [s] | Base Case | Over-The-Shoulder | Prone |
|---|---|---|---|
| 0.2 | −2.0 | −2.0 | −3.5 |
| 0.5 | −1.5 | −2.0 | −3.5 |
| 2.0 | −1.5 | −2.0 | −3.5 |
| 3.0 | −1.5 | −2.0 | −2.5 |
| 4.0 | −1.5 | −2.0 | −2.5 |
| 5.0 | −1.5 | −2.0 | −2.0 |
| >5 | −1.5 | −2.0 | −2.0 |

**Nota 2:** los límites Over-The-Shoulder pueden elevarse a los límites Prone si la tasa de aparición es menor a 15 g/s y la sujeción está apropiadamente acolchada.

## 5.4 Fig. 8 — Límites de $\pm G_y$ (lateral)

Caso base:

| Duración [s] | Límite [G] |
|---|---|
| 0.2 | 3.0 |
| 1.0 | 3.0 |
| 2.0 | 2.0 |
| >2 | 2.0 |

**Nota:** para vehículos de asiento corrido sin retención individual ni divisores, con aceleraciones laterales sostenidas mayores a 0.7 g, el orden de asiento debe ser de pasajero más chico a más grande en la dirección de la carga.

## 5.5 Fig. 9 — Límites de $-G_z$ (Eyes Up, airtime)

| Duración [s] | Base Case | Extended $-G_z$ |
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

> Los puntos de quiebre en 3.0 y 4.0 s son la lectura más consistente de la figura; conviene verificarlos contra el original antes de citarlos en el reporte.

## 5.6 Fig. 10 — Límites de $+G_z$ (Eyes Down) — **el crítico para el loop**

| Duración [s] | Todas las sujeciones | Reducido (precedido por ≥3 s de $-G_z$) |
|---|---|---|
| 0.2 | 6.0 | 5.0 |
| 1.0 | 6.0 | 5.0 |
| 2.0 | 4.0 | ≈ 2.6 |
| 2.5 | 4.0 | 2.0 |
| 4.0 | 4.0 | 2.0 |
| 5.0 | 3.0 | 2.0 |
| 11.8 | 3.0 | 2.0 |
| 12.0 | 2.0 | 2.0 |
| 40 | 2.0 | 2.0 |

**Nota:** el diseño debe asegurar que el pasajero esté correctamente sentado en posición erguida.

Comparación útil: las curvas de $+G_x$ (Fig. 6) y $+G_z$ (Fig. 10) son idénticas en forma hasta los 11.8 s; difieren sólo en el escalón final, que baja a 2.5 G en $+G_x$ y a 2.0 G en $+G_z$.

## 5.7 Cómo se aplica un límite dependiente de la duración

El límite no es puntual: depende de **cuánto tiempo lleva el pasajero por encima de ese nivel**. La verificación correcta es:

Para cada nivel $G^*$, medir la duración acumulada del evento sostenido en que $G \geq G^*$, y verificar que $G^* \leq G_{lim}(\text{duración})$.

En la práctica, para cada tramo del recorrido en que la G supera un umbral, se calcula la duración del tramo y se evalúa la curva límite en esa duración. Un pico de 6 G durante 0.5 s es admisible; el mismo 6 G durante 3 s no lo es.

Con los tiempos del modelo comprimidos por $1/\sqrt\lambda$, las duraciones del modelo deben multiplicarse por $\sqrt\lambda$ antes de entrar a estas curvas.

---

# 6. Política de continuidad por eje

> **Destinada al reporte final.** Esta sección completa — el análisis de qué exige realmente la norma, el falso dilema continuo/discontinuo, las cuatro razones contra la discontinuidad, el filtro de 5 Hz y la política por eje — va íntegra al reporte del proyecto como justificación del criterio de continuidad adoptado.

## 6.1 Lo que la norma exige realmente

La norma **no exige continuidad de la aceleración en ningún lado**. Exige **tasa de aparición acotada** en transiciones específicas identificadas como peligrosas:

| Situación | Límite de onset | Fuente |
|---|---|---|
| De 0 G o menos hacia 2 G o más | < 15 G/s | §7.1.7.2 |
| $+G_x$ por encima de 1.5 g sin apoyacabezas | < 5 g/s (permite 2.0 g) | Fig. 6, nota 1 |
| Elevar OTS a límites Prone en $-G_x$ | < 15 g/s | Fig. 7, nota 2 |

La diferencia es de fondo:

- **Continuidad de aceleración** = jerk finito
- **Requisito normativo** = jerk por debajo de un número específico, en transiciones específicas

Un salto de aceleración implica jerk infinito, que viola cualquier límite finito. Pero el requisito real es más laxo que la continuidad: permite jerk alto mientras esté acotado.

## 6.2 El falso dilema

**"Continuo vs. discontinuo" no es la variable de decisión.** La variable es la **longitud de la transición**.

Una clotoide con transición corta produce jerk altísimo pero finito. Se obtiene el golpe *y* la continuidad. Exigir $G^2$ no impide que la transición sea agresiva: sólo garantiza que el jerk sea finito, calculable y **elegido por el diseñador** en vez de quedar determinado por accidente.

$$\text{jerk normal en una clotoide} \approx v^3\,\frac{d\kappa}{ds}$$

La longitud de la clotoide es el perilla de ajuste directo.

## 6.3 Por qué la discontinuidad no es realizable

Argumento decisivo para este proyecto: **una discontinuidad de curvatura no se puede fabricar.**

Un tubo doblado o una vía impresa siempre va a tener una transición finita. Si se diseña una discontinuidad, la longitud real de la transición queda determinada por la tolerancia del proceso de fabricación, no por el diseño. La geometría construida no va a ser la geometría diseñada, y las G medidas no van a coincidir con las calculadas.

Diseñar una clotoide es elegir explícitamente esa longitud en vez de dejar que la decida el proceso.

## 6.4 El filtro de 5 Hz

Las Figs. 19 y 20 de la norma especifican **datos filtrados a 5 Hz**, y §7.1.8 remite a la Práctica F2137 para la medición.

Consecuencia: la verificación de cumplimiento no se hace sobre la señal cruda sino sobre la señal filtrada. Un pasabajos de primer orden a 5 Hz tiene $\tau = 1/(2\pi f_c) = 31.8$ ms y tiempo de subida 10–90 % de ≈ 70 ms. Un escalón matemático medido a través de ese filtro aparece como una rampa:

| Escalón | Onset medido tras el filtro |
|---|---|
| 1 G | ≈ 11 G/s |
| 2 G | ≈ 23 G/s |
| 3 G | ≈ 34 G/s |
| 4 G | ≈ 46 G/s |

O sea que un escalón de 2 G o más, medido según la norma, ya excede el límite de 15 G/s de §7.1.7.2. **La discontinuidad no sobrevive la verificación normativa** en las transiciones donde ese límite aplica.

## 6.5 Ventajas y desventajas de admitir discontinuidad

### A favor

| Ventaja | Alcance real |
|---|---|
| Menos restricciones → problema geométrico más fácil de resolver | Real: bajar de $G^2$ a $G^1$ quita ecuaciones y libera grados de libertad para alcanzar el endpoint |
| Elementos más cortos | Real y muy relevante a esta escala: las transiciones consumen decenas de centímetros y compiten contra el bounding box |
| Mayor G pico en la misma huella | Real |
| Emoción de la transición seca | Parcial: se consigue igual con una clotoide corta, sin perder continuidad |

### En contra

| Desventaja | Gravedad |
|---|---|
| **No es fabricable** | Decisiva. La transición real la fija la tolerancia del proceso |
| **Fatiga estructural** | Alta. Un salto de curvatura es un salto escalonado de carga sobre la vía: concentración de tensión y sitio de iniciación de fisuras |
| **Excitación de vibración** | Alta en un modelo. Un escalón de aceleración es de banda ancha y excita todos los modos del carro y de la vía. En una maqueta impresa con poco amortiguamiento se traduce en traqueteo y ruido |
| No sobrevive la verificación filtrada a 5 Hz | Alta donde §7.1.7.2 aplica |
| El jerk deja de ser calculable | Media. No se puede reportar ni verificar contra criterio |

La fatiga es la que más pesa para el proyecto físico. Coincide con la conclusión de Pendrill y Eager (2020): minimizar jerk y snap importa tanto para confort y seguridad como para reducir fatiga estructural.

## 6.6 Práctica de la industria

El caso fundacional es el **loop clotoide de Werner Stengel** (mediados de los años 70, Revolution en Six Flags Magic Mountain). El loop circular tiene una discontinuidad de curvatura en la entrada — se pasa de recta ($\kappa = 0$) a círculo ($\kappa = 1/R$) de golpe — y esa discontinuidad producía latigazo cervical. La clotoide se adoptó precisamente para eliminarla.

> La atribución y fecha exacta convienen verificarse contra fuente primaria antes de citarlas en el reporte.

Las herramientas modernas de diseño (Force Vector Design) trabajan especificando el **perfil de fuerza** y derivando la geometría a partir de él, en vez de al revés. Eso existe justamente para que el diseñador controle la continuidad y la tasa de aparición de las G directamente.

Conclusión: la industria no diseña ni con jerk cero ni con discontinuidad. Diseña con **tasa de aparición acotada y elegida**.

## 6.7 Política adoptada

Se reemplaza el criterio binario por un **presupuesto de tasa de aparición por eje**:

| Eje | Continuidad exigida | Presupuesto de onset | Justificación |
|---|---|---|---|
| $G_y$ lateral | $G^2$ curva + $C^2$ roll | El más bajo de los tres | Sin valor de emoción; el jerk lateral produce sacudida de cabeza. Es la queja clásica de las curvas sin peralte |
| $G_z$ vertical | $G^2$ curva | Alto pero acotado, parametrizable | Las transiciones secas son la firma de los coasters modernos. La norma limita la *carga* rápida, no la *descarga* |
| $G_x$ longitudinal | Acotado por el sistema de lanzamiento y frenado | Según Fig. 6 nota 1 | Lo fija el LSM, no la geometría del loop |

La asimetría de $G_z$ que reconoce la norma tiene sentido fisiológico: §7.1.7.2 limita la transición *hacia* $+G_z$ (que empuja la sangre lejos de la cabeza) y no limita la descarga hacia $-G_z$. Airtime seco: permitido. Recuperación seca: limitada.

**Implementación:** `OnsetMaximo` como vector de tres componentes, uno por eje, con valores por defecto derivados de la norma y escalados por $\sqrt\lambda$. El generador ajusta la longitud de transición para respetarlos y reporta el margen.

---

# 7. Longitudes de transición: derivación y escalado

## 7.1 Por qué el criterio de onset cambia entre modelo y prototipo

Es la pregunta clave y la respuesta está en distinguir **magnitud** de **tasa**.

Bajo semejanza de Froude:

$$a_{modelo} = a_{real} \quad\text{(las G son iguales)}, \qquad t_{modelo} = \frac{t_{real}}{\sqrt\lambda} \quad\text{(el tiempo se comprime)}$$

Las fuerzas G **sí** son iguales — eso no cambió. Lo que cambia es **cuánto tarda el carro en llegar a esa G**, porque el modelo recorre toda la experiencia $\sqrt\lambda$ veces más rápido en tiempo de reloj.

Imagen mental: el gráfico de G contra tiempo del modelo es **exactamente el mismo gráfico** que el del prototipo, con el eje horizontal comprimido por un factor 4.69. Los picos están a la misma altura. Pero al comprimir el eje del tiempo, **todas las pendientes se vuelven 4.69 veces más empinadas**.

El jerk es la pendiente de esa curva. De ahí:

$$J = \frac{da}{dt} \implies \frac{J_m}{J_r} = \frac{a_m/a_r}{t_m/t_r} = \frac{1}{1/\sqrt\lambda} = \sqrt\lambda$$

**No es que el criterio cambie: el criterio es el mismo y se aplica al prototipo.** Lo que cambia es el valor numérico que un modelo fiel produce. Un modelo que reproduce fielmente un prototipo que cumple 15 G/s exhibe 70.4 G/s. Si se le exigiera al modelo cumplir 15 G/s, se le estaría exigiendo ser *más suave* que el prototipo, y ya no sería fiel.

## 7.2 Derivación de la longitud de transición — vía cinemática

$$\Delta t = \frac{\Delta G}{J}, \qquad L_{trans} = v\,\Delta t = \frac{v\,\Delta G}{J}$$

## 7.3 Derivación de la longitud de transición — vía geometría

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

| $v$ [m/s] | $\Delta G$ | $J$ [G/s] | $L$ vía cinemática | $L$ vía geometría | $\kappa_f$ | $R$ |
|---|---|---|---|---|---|---|
| 4.3 | 3.0 | 70.4 | 18.32 cm | 18.32 cm | 1.592 m⁻¹ | 62.8 cm |
| 3.0 | 2.0 | 70.4 | 8.52 cm | 8.52 cm | 2.180 m⁻¹ | 45.9 cm |
| 4.3 | 4.0 | 23.5 | 73.19 cm | 73.19 cm | 2.122 m⁻¹ | 47.1 cm |

**Hipótesis:** $v$ constante dentro de la transición. Verificación del error que introduce, con $v_0 = 4.3$ m/s:

| Desnivel en la transición | $v$ final | Error |
|---|---|---|
| 3 cm | 4.23 m/s | 1.6 % |
| 5 cm | 4.18 m/s | 2.7 % |
| 10 cm | 4.07 m/s | 5.5 % |

Aceptable para dimensionamiento preliminar. El generador de geometría **no usa esta hipótesis**: integra $v(s)$ y $\kappa(s)$ acopladamente paso a paso, y esta fórmula sirve sólo como estimación inicial y como test de sanidad del resultado.

## 7.4 El escalado cierra sobre sí mismo

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

| | $v$ | $J$ | $\Delta t$ | $L$ |
|---|---|---|---|---|
| Real | 20.17 m/s | 15.0 G/s | 0.2000 s | 4.034 m |
| Modelo | 4.30 m/s | 70.4 G/s | 0.0426 s | 0.183 m |
| Razón | $1/\sqrt\lambda$ | $\sqrt\lambda$ | $1/\sqrt\lambda$ | **$1/\lambda$ = 1/22** ✓ |

## 7.5 Presupuesto de onset del modelo

$$J_{modelo,lim} = \sqrt\lambda\;J_{real,lim}$$

| Criterio | Límite real | Límite del modelo ($\lambda=22$) |
|---|---|---|
| §7.1.7.2 (0 G → 2 G+) | 15 G/s | 70.4 G/s |
| Fig. 6 nota 1 ($+G_x$ sin apoyacabezas) | 5 g/s | 23.5 G/s |

> **Advertencia sobre el alcance de §7.1.7.2.** La cláusula limita específicamente la transición desde 0 G o menos hacia 2 G o más. Una clotoide que entra a un valle desde vía a nivel va de 1 G a 4 G, y por lo tanto **no cae bajo esa cláusula**: la norma no limita el onset de esa transición. Usar los 15 G/s como presupuesto general es una **extrapolación autoimpuesta**, no un requisito normativo. Se adopta por prudencia y por consistencia interna, y debe declararse como criterio propio en el reporte.

## 7.6 Longitud que consume una transición

| $\Delta G$ | $J$=70.4, $v$=3.0 | $J$=70.4, $v$=4.3 | $J$=23.5, $v$=4.3 |
|---|---|---|---|
| 1 G | 4.3 cm | 6.1 cm | 18.3 cm |
| 2 G | 8.5 cm | 12.2 cm | 36.7 cm |
| 3 G | 12.8 cm | 18.3 cm | 55.0 cm |
| 4 G | 17.1 cm | 24.4 cm | 73.3 cm |

## 7.7 Presupuesto total de un loop

A $v=4.3$ m/s con G pico de 4 ($R = 63$ cm):

| Tramo | Longitud |
|---|---|
| Acondicionamiento de entrada | por determinar |
| Clotoide de entrada | ≈ 18 cm |
| Arco del loop | $\approx 2\pi R \approx$ 3.9 m |
| Clotoide de salida | ≈ 18 cm |
| Conector al endpoint | por determinar |

El arco domina ampliamente: las clotoides son alrededor del 10 % del total. Esto **refuerza la decisión de no sacrificar continuidad para ahorrar longitud** — se ahorra poco y se pierde fabricabilidad, vida a fatiga y cumplimiento normativo.

# 8. Resumen de criterios adoptados

| Criterio | Valor | Origen |
|---|---|---|
| Continuidad de la curva | $G^2$ por longitud de arco | Decisión de diseño |
| Continuidad del roll | $C^2$ vía smoothstep quíntico | Derivación de heartline, §3.6 |
| Marco de referencia | Transporte paralelo + $\phi(s)$ explícito | §2.2 |
| Escalado | Froude, $\lambda = 22$ (provisorio) | §4 |
| Límite $+G_z$ | Curva de Fig. 10, dependiente de duración | F2291-06a |
| Límite $-G_z$ | Curva de Fig. 9, Base Case | F2291-06a |
| Límite $\pm G_y$ | Curva de Fig. 8 | F2291-06a |
| Onset $G_z$ | ≤ 70.4 G/s en el modelo | §7.1.7.2 × $\sqrt\lambda$ |
| Onset $G_y$ | Por definir, el más restrictivo | Política §6.7 |
| Combinación de dos ejes | Elipse con semiejes = límites de 200 ms × 1.1 | §7.1.5.1 |
| Métrica de G | Aceleración neta total incluida la gravedad | §7.1.4.5 |

---

# 9. Dimensionamiento del carro

## 9.1 La relación que gobierna todo

La pregunta "¿qué tan grande queda el loop?" no necesita $\lambda$ en absoluto. Por semejanza geométrica, **la razón entre dos dimensiones cualesquiera se conserva** entre modelo y prototipo:

$$\frac{H_{loop}}{L_{carro}}\bigg|_{modelo} = \frac{H_{loop}}{L_{carro}}\bigg|_{real}$$

Con un loop real de ≈ 25 m y un carro real de ≈ 2.2 m, la razón es ≈ **11.4**:

$$\boxed{\;H_{loop,modelo} \approx 11.4 \times L_{carro,modelo}\;}$$

Es una regla más robusta que pasar por $\lambda$, porque no depende de mi estimación del factor altura/radio del loop: es sólo el cociente de dos dimensiones reales, verificables contra una atracción concreta.

| Largo del carro | Altura del loop | $\lambda$ | $v$ cúspide ($G=2$) |
|---|---|---|---|
| 4 cm | 45.5 cm | 55.0 | 2.36 m/s |
| 5 cm | 56.8 cm | 44.0 | 2.64 m/s |
| 6 cm | 68.2 cm | 36.7 | 2.89 m/s |
| 8 cm | 90.9 cm | 27.5 | 3.34 m/s |
| **10 cm** | **113.6 cm** | **22.0** | **3.73 m/s** |
| 12 cm | 136.4 cm | 18.3 | 4.09 m/s |

> Las dimensiones reales de referencia (loop de 25 m, carro de 2.2 m) son valores típicos, no verificados contra una atracción concreta. Fijar la atracción de referencia y usar sus dimensiones publicadas antes de citar esta tabla en el reporte.

## 9.2 El piso físico: rodamientos

Achicar el carro achica el loop proporcionalmente, pero hay un piso duro que no escala: **el tamaño mínimo de un rodamiento comercial**.

Una rueda portante real mide ≈ 30 cm de diámetro. Escalada:

| Largo del carro | $\lambda$ | Rueda del modelo | Rodamiento viable |
|---|---|---|---|
| 4 cm | 55.0 | 5.5 mm | Sin rodamiento — buje plano |
| 5 cm | 44.0 | 6.8 mm | Sin rodamiento — buje plano |
| 6 cm | 36.7 | 8.2 mm | 681X (1.5×4×2) al límite |
| 8 cm | 27.5 | 10.9 mm | 692 (2×6×2.5) justo |
| **10 cm** | **22.0** | **13.6 mm** | **693 (3×8×3) cómodo** |
| 12 cm | 18.3 | 16.4 mm | 693 (3×8×3) cómodo |

Por qué importa. La resistencia a la rodadura de una rueda rígida sobre vía rígida está dominada por la fricción del rodamiento, que se traduce en una fuerza resistente equivalente:

$$F_{res} = \frac{T_{rodamiento}}{R_{rueda}} = \frac{\mu_b\,N\,r_{eje}}{R_{rueda}} \implies C_{rr} = \mu_b\,\frac{r_{eje}}{R_{rueda}}$$

**Mientras el diámetro interior del rodamiento pueda escalar junto con la rueda, $C_{rr}$ es invariante de escala.** Pero el diámetro interior tiene un piso comercial de 1.5–3 mm. Por debajo de ese punto la razón $r_{eje}/R_{rueda}$ empieza a crecer y $C_{rr}$ crece con ella, es decir:

$$C_{rr} \propto \frac{1}{R_{rueda}} \quad \text{una vez alcanzado el rodamiento mínimo}$$

Con un carro de 10 cm la rueda queda en ≈ 13.6 mm, que es aproximadamente el mínimo que aloja cómodamente un rodamiento estándar más una banda de rodadura. **El diseño actual está justo en el piso.** Achicar el carro obliga a bujes planos, con fricción sustancialmente mayor, en un modelo que ya es marginal energéticamente.

## 9.3 Otros efectos de achicar

| Efecto | Dirección | Comentario |
|---|---|---|
| Altura del loop | Mejora (más chico) | Proporcional al largo del carro |
| $C_{rr}$ efectivo | **Empeora** | Por debajo del rodamiento mínimo, crece como $1/R_{rueda}$ |
| Número de Reynolds | Empeora | $Re \sim \lambda^{-3/2}$; con carro de 4 cm baja a ≈ 7×10³ |
| Tolerancia relativa de fabricación | **Empeora** | La precisión de impresión (≈0.1–0.2 mm) es fija; su peso relativo crece |
| Frecuencia de conmutación del LSM | Empeora | $f = v/\text{paso polar} \sim \sqrt\lambda$: sensado y conmutación más rápidos |
| Espacio para mecanismos | **Empeora** | Switch track, frenos de Foucault, imanes del LSM tienen tamaños mínimos |
| Fuerza requerida al LSM | Mejora | $F \sim \lambda^{-3}$: baja muy rápido |

Reynolds en función del tamaño:

| Largo del carro | $\lambda$ | $v$ | $Re$ |
|---|---|---|---|
| 4 cm | 55.0 | 2.70 m/s | 7 191 |
| 6 cm | 36.7 | 3.30 m/s | 13 212 |
| 10 cm | 22.0 | 4.26 m/s | 28 427 |

## 9.4 λ no es una propiedad del modelo

Punto conceptual que hay que tener claro antes de decidir nada.

**λ es una propiedad de un emparejamiento entre una dimensión del modelo y la correspondiente del prototipo**, no del modelo en su conjunto. Se puede calcular uno por cada dimensión:

$$\lambda_{carro} = \frac{L_{carro,real}}{L_{carro,modelo}}, \qquad \lambda_{loop} = \frac{R_{loop,real}}{R_{loop,modelo}}$$

El número de Froude involucra **una sola** longitud característica:

$$Fr = \frac{v}{\sqrt{g\,L}}$$

Y la que gobierna la dinámica de un loop es el **radio del loop**, no el largo del carro:

$$G_{centrípeta} = \frac{v^2}{g\,R} = Fr^2$$

El largo del carro no aparece en esa ecuación. Por lo tanto, calcular λ a partir del carro y aplicarlo al loop **sólo es legítimo si se impone además semejanza geométrica**: que todas las longitudes escalen por el mismo factor. Esa imposición es una decisión de diseño, no una consecuencia física.

## 9.5 Las dos opciones de similitud

### Modelo semejante — $\lambda_{loop} = \lambda_{carro}$

Todas las longitudes escalan por el mismo factor. El modelo es una réplica a escala de una atracción concreta. Con carro de 10 cm el loop queda forzado a ≈114 cm.

Afirmación resultante: *"este modelo reproduce el perfil de G de la atracción X"*. Es la más fuerte, y fija el tamaño.

### Modelo distorsionado — $\lambda_{loop} \neq \lambda_{carro}$

El loop escala por un factor y el carro por otro. Se elige el tamaño de loop que las restricciones de fabricación permitan y el tamaño de carro que sea realizable.

No es un atajo ni una concesión: **los modelos distorsionados son práctica estándar en similitud**. En ingeniería hidráulica, los modelos de ríos y estuarios se construyen rutinariamente con escala vertical distinta de la horizontal, precisamente porque un modelo geométricamente semejante daría profundidades de milímetros donde la tensión superficial dominaría el flujo. La práctica correcta es declarar la distorsión y explicitar qué se conserva y qué no.

## 9.6 Qué conserva y qué pierde el modelo distorsionado

**Se conserva: el perfil de G del loop.** Sale de $v^2/(gR)$, que involucra únicamente el radio del loop y la velocidad. Eligiendo $R$ y ajustando $v$ para igualar el Froude del prototipo, las G son fielmente las del prototipo. El largo del carro no interviene.

**Se pierde: la proporción entre longitud del tren y perímetro del loop.** Es lo único, y afecta exclusivamente al modelo multi-carro.

Cuantificación, con carro de 10 cm y atracción de referencia de loop 25 m / carro 2.2 m:

| Altura del loop modelo | $\lambda_{loop}$ | $\lambda_{carro}$ | Distorsión | 1 carro equivale a un tren real de |
|---|---|---|---|---|
| 114 cm | 22.0 | 22.0 | 1.00 | 1.0 carros |
| 100 cm | 25.0 | 22.0 | 0.88 | 1.1 carros |
| 70 cm | 35.7 | 22.0 | 0.62 | 1.6 carros |
| 50 cm | 50.0 | 22.0 | 0.44 | 2.3 carros |
| 30 cm | 83.3 | 22.0 | 0.26 | 3.8 carros |

Lectura: con loop de 50 cm y carros de 10 cm, cada carro ocupa la misma fracción del loop que **2.3 carros reales**. Un tren de 3 carros del modelo se comporta como un tren real de 6.8 carros.

**Con un solo carro la distorsión no tiene efecto**, porque el efecto que se rompe es precisamente el de longitud del tren. Al pasar a N carros hay que declararla como limitación y reportar el equivalente en carros reales.

## 9.7 Palanca alternativa: acortar el carro sin achicar la rueda

El piso duro es la **rueda** (≈13.6 mm, por el rodamiento), y es separable del largo del carro. Se puede tener un carro corto con ruedas relativamente grandes.

| Largo del carro | Loop sin distorsión | Rueda si escala con el carro |
|---|---|---|
| 6 cm | 68 cm | 8.2 mm — demasiado chica |
| 7 cm | 80 cm | 9.5 mm |
| 8 cm | 91 cm | 10.9 mm |
| 10 cm | 114 cm | 13.6 mm — cómoda |

Manteniendo ruedas de ≈13 mm y acortando el carro a 7–8 cm se baja el loop a 80–90 cm **sin distorsión** y sin comprometer el rodamiento. El carro queda visualmente rechoncho (ruedas proporcionalmente grandes) pero mecánicamente sano.

## 9.8 Restricciones del proyecto y decisión adoptada

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

# 10. Pendientes que bloquean el dimensionamiento

- [x] Elección del tipo de similitud → **modelo distorsionado** (§9.8)
- [x] Altura máxima del loop → **1 m**
- [ ] Atracción de referencia concreta, con dimensiones publicadas de loop y de carro
- [ ] Tamaño de rueda y rodamiento — sujeto a disponibilidad en Argentina
- [ ] Dimensiones definitivas del carro
- [ ] Altura definitiva del loop dentro del techo de 1 m
- [ ] Huella total disponible para el circuito completo
- [ ] Volumen mínimo que requieren LSM, switch track y freno de Foucault
- [ ] Tolerancia alcanzable por la impresora, que fija el radio mínimo de vía fabricable
