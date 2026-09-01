# Análisis de conservación de energía para diseño de montañas rusas

Documentación del proceso y las ecuaciones implementadas en [`analisis_energia.m`](analisis_energia.m). Es un modelo preliminar ("rough model"): a partir de una trayectoria 3D, calcula velocidad, radio de curvatura, fuerzas normales (en G's) y pérdidas por resistencia al avance a lo largo del recorrido.

> **Documento hermano:** los criterios de diseño (continuidad, marco de referencia, cinemática de heartline, semejanza de Froude y límites normativos tabulados) están en [`memoria_de_calculo.md`](memoria_de_calculo.md). El generador de geometría de vía propiamente dicho está documentado en [`documentacion_generador_elementos.md`](documentacion_generador_elementos.md). Este documento cubre exclusivamente el script `analisis_energia.m` de la raíz del repo — no el código bajo `GeneradorDeElementos/`. Ver [`NOMENCLATURA.md`](NOMENCLATURA.md) para la tabla completa de símbolos.

**Glosario rápido:** *polilínea* (curva representada como lista de puntos unidos por segmentos rectos, no una fórmula), *up-stop* (rueda de retención que evita que el carro se despegue de la vía), *road/running wheels* (ruedas portantes, toman la carga normal principal), *guide/side wheels* (ruedas guía, toman la carga lateral).

## Símbolos usados en este documento

| Símbolo | Significado | Unidad |
|---|---|---|
| $p$ | parámetro libre de la curva paramétrica $X(p),Y(p),Z(p)$ (antes notado $t$; renombrado por colisión con tiempo, ver [`NOMENCLATURA.md`](NOMENCLATURA.md#0-colisiones-resueltas)) | adimensional |
| $p_{min},p_{max}$ | extremos del parámetro libre (código: `TMin`, `TMax`) | adimensional |
| $\delta$ | separación objetivo entre puntos de análisis, medida sobre la curva (antes notado $d$; renombrado por colisión con el offset de heartline) | m |
| $s$ | longitud de arco acumulada | m |
| $R$ | radio de la circunferencia osculatriz discreta (radio de giro) | m |
| $\kappa$ | curvatura, $1/R$ | 1/m |
| $\varepsilon_{maq}$ | épsilon de máquina | adimensional |
| $F_N$ | fuerza normal sobre la vía (antes aparecía como $N$; colisión #6 resuelta) | N |
| $v$ | velocidad | m/s |
| $E_0$ | energía mecánica total en el arranque | J |
| $g$ | aceleración de la gravedad | m/s² |

Ver la tabla completa en [`NOMENCLATURA.md`](NOMENCLATURA.md), en particular el bloque 5 (parámetros propios de este script).

## Índice

1. [Parámetros del modelo](#1-parametros-del-modelo)
2. [Trayectoria paramétrica](#2-trayectoria-parametrica)
3. [Discretización por longitud de arco](#3-discretizacion-por-longitud-de-arco)
4. [Radio de giro (curvatura local)](#4-radio-de-giro-curvatura-local)
5. [Notación `[X Y Z Magnitud]` y protección contra NaN](#5-notacion-x-y-z-magnitud-y-proteccion-contra-nan)
6. [Energía inicial y potencial](#6-energia-inicial-y-potencial)
7. [Plano perpendicular a la trayectoria](#7-plano-perpendicular-a-la-trayectoria)
8. [Modelo de resistencia al avance](#8-modelo-de-resistencia-al-avance)
9. [Proceso iterativo: velocidad, normales y pérdidas](#9-proceso-iterativo-velocidad-normales-y-perdidas)
10. [Unidades en G's](#10-unidades-en-gs)
11. [Signo de la fuerza centrípeta sentida](#11-signo-de-la-fuerza-centripeta-sentida)
12. [Gráficos generados](#12-graficos-generados)
13. [Changelog](#13-changelog)
14. [Hipótesis vigentes](#14-hipotesis-vigentes)
15. [Limitaciones actuales / próximos pasos](#15-limitaciones-actuales--proximos-pasos)

---

## 1. Parámetros del modelo

| Variable | Significado | Unidad |
|---|---|---|
| `DistanciaDeDiscretizacion` ($\delta$) | cada cuánto (medido sobre la curva) se pone un punto de análisis | m |
| `Gravedad` ($g$) | aceleración de la gravedad | m/s² |
| `CoefRodaduraPortantes` | resistencia a la rodadura de las ruedas de carga | adimensional |
| `CoefRodaduraGuia` | resistencia a la rodadura de las ruedas laterales | adimensional |
| `CoefRodaduraRetencion` | resistencia a la rodadura de las ruedas de retención (up-stop) | adimensional |
| `DensidadAire` | densidad del aire | kg/m³ |
| `CoefArrastre` | coeficiente de arrastre aerodinámico $C_d$ | adimensional |
| `AreaFrontal` | área frontal proyectada de un carro | m² |
| `FactorTren` | fracción del arrastre que aporta cada carro detrás del primero | adimensional |
| `Masa` | masa del carrito | kg |
| `VelocidadInicial` | velocidad en el primer punto de la trayectoria | m/s |
| `NumeroDeCarros` | carros del tren | adimensional (entero) |

Todos estos valores son **provisorios** (marcados en el código con comentarios "CALIBRAR EXPERIMENTALMENTE" salvo `Masa`, `VelocidadInicial` y `NumeroDeCarros`, que son datos del caso, no coeficientes físicos). Ver la fila correspondiente en la tabla de [`memoria_de_calculo.md` §11](memoria_de_calculo.md#11-datos-pendientes-de-verificacion).

---

## 2. Trayectoria paramétrica

La vía se define como una curva paramétrica en función de una variable libre $p$ (en el código, la variable MATLAB sigue llamándose `t`; el símbolo de este documento es $p$ para no chocar con el tiempo — colisión de símbolos #2, ver [`NOMENCLATURA.md`](NOMENCLATURA.md#0-colisiones-resueltas)):

$$X(p),\quad Y(p),\quad Z(p), \qquad p \in [p_{min}, p_{max}]$$

Parametrizar por $p$ (en vez de usar `x` como parámetro) permite representar curvas que doblan hacia atrás, suben y bajan más de una vez para el mismo `x`, o hacen loops.

Se muestrea finamente (`NumPuntosFinos`) para aproximar la curva continua como una polilínea de segmentos muy cortos — `TrayectoriaFina`.

> **Polilínea:** una curva representada como una lista ordenada de puntos unidos por segmentos rectos. No es una fórmula, es una tabla de coordenadas. Si los puntos están lo bastante juntos, la diferencia con la curva real es despreciable para todo propósito práctico.

### 2.1 Trayectoria actualmente activa

> ⚠️ **CURVA DE PRUEBA — NO ES GEOMETRÍA DE DISEÑO.** Verificado contra `analisis_energia.m` (líneas 55–58, sección `TRAYECTORIA (DEBUG)`): la trayectoria de abajo es la que efectivamente corre hoy en el script. No representa ningún elemento de vía real; es una curva elegida para ejercitar la discretización por longitud de arco y el cálculo de curvatura. La geometría de vía real la genera el constructor de elementos, documentado en [`documentacion_generador_elementos.md`](documentacion_generador_elementos.md).

$$X(p) = \sin(p), \qquad Y(p) = 2\cos(p), \qquad Z(p) = 10 - p + 20\cos(p/10)$$

con $p_{min}=0$, $p_{max}=10\pi$.

> **Por qué sale una hélice de varias vueltas y no un loop.** $X$ e $Y$ son periódicas en $p$ con período $2\pi$, y $p_{max} = 10\pi$ son cinco períodos: la proyección sobre el plano $XY$ recorre cinco veces la misma elipse. Mientras tanto $dZ/dp = -1 - 2\sin(p/10)$ es negativa en todo el intervalo, o sea que $Z$ baja siempre y nunca vuelve. Curva cerrada en horizontal más avance monótono en vertical es, por definición, una hélice. No es un error: es una curva de prueba elegida para ejercitar la discretización por longitud de arco y el cálculo de curvatura sobre algo que no es función de $x$.
>
> Para un solo loop vertical hay que poner la circunferencia en un plano **vertical** y recorrer un solo período; el script tiene las tres líneas comentadas al lado (`TMax = 2*pi; XFino = 0.30*sin(TFino); YFino = zeros(...); ZFino = 0.30*(1-cos(TFino));`).

---

## 3. Discretización por longitud de arco

El objetivo es obtener puntos separados por $\delta$ = `DistanciaDeDiscretizacion` **medido sobre la curva**, no sobre ningún eje.

1. Distancia de cada segmento fino:
$$\Delta s_i = \lVert P_{i+1} - P_i \rVert$$
2. Longitud acumulada (cuentakilómetros) en cada punto fino:
$$s_i = \sum_{k=1}^{i-1} \Delta s_k$$
3. Se definen las longitudes objetivo $0, \delta, 2\delta, \dots$ y se interpola (`interp1`) la posición $(x,y,z)$ correspondiente a cada una, usando $s_i \to P_i$ como tabla de interpolación.

Resultado: **`TrayectoriaDePuntos`**, matriz $n\times3$ con un punto real de la vía cada $\delta$ metros de recorrido.

---

## 4. Radio de giro (curvatura local)

Para cada punto interior $P_i$ (con vecino anterior $P_{i-1}$ y siguiente $P_{i+1}$), se estima la circunferencia que pasa por los 3 puntos (circunferencia osculatriz discreta).

Lados del triángulo:
$$a = \lVert P_i - P_{i-1}\rVert, \quad b = \lVert P_{i+1}-P_i\rVert, \quad c = \lVert P_{i+1}-P_{i-1}\rVert$$

Área (con producto cruz):
$$\text{Área} = \tfrac{1}{2}\lVert (P_i-P_{i-1}) \times (P_{i+1}-P_{i-1}) \rVert$$

Radio de curvatura (`RadioDeGiro`, $R$):
$$R = \frac{a\,b\,c}{4\,\text{Área}}$$

En un tramo recto, Área $\to 0$ y $R \to \infty$ (correcto: una recta no tiene curvatura).

### 4.1 Fragilidad numérica de esta fórmula

Esta estimación **se degrada cuando el paso de discretización es chico y la vía es casi recta**. El área se calcula restando cantidades casi iguales; en aritmética de punto flotante (≈16 dígitos significativos) esa resta destruye casi todos los dígitos y lo que queda es ruido de redondeo.

$\varepsilon_{maq}$ (épsilon de máquina) es el menor número tal que, en aritmética de punto flotante de doble precisión, `1 + eps ≠ 1`; vale aproximadamente $2.22\times10^{-16}$. Regla práctica: el error relativo del área crece aproximadamente como $\varepsilon_{maq}\,(R/\Delta s)^2$. Con $R = 1$ m y $\Delta s = 1$ mm el factor es $10^6$ — todavía tolerable. Con $R = 100$ m y $\Delta s = 1$ mm es $10^{10}$, y el resultado ya no tiene ningún dígito válido.

Mitigación implementada: si Área $<$ `TolArea`, se declara el tramo recto ($R = \infty$) en vez de devolver un número inventado.

**Mitigación definitiva (pendiente):** cuando la geometría se genera imponiendo $\kappa(s)$ (loops, clotoides), llevar la curvatura analíticamente desde la generación y usar esta fórmula discreta **sólo como test de validación** contra la curvatura impuesta. Esto ya está implementado en el generador de elementos: `TestsValidacion.m` reutiliza exactamente esta misma fórmula ($R=abc/4\text{Área}$) para comparar la curvatura recuperada de la polilínea contra la impuesta al generar — ver [`documentacion_generador_elementos.md` §11, test 2](documentacion_generador_elementos.md#11-tests-de-validacion).

### 4.2 Dirección (centro de curvatura)

Se calcula el centro exacto de esa misma circunferencia con la fórmula de **coordenadas baricéntricas del circuncentro** (válida en 2D o 3D). El peso de cada vértice se construye con el lado **opuesto** a ese vértice:

$$w_{i-1} = b^2(c^2+a^2-b^2), \quad w_{i} = c^2(a^2+b^2-c^2), \quad w_{i+1} = a^2(b^2+c^2-a^2)$$

$$\text{CentroDeCurvatura} = \frac{w_{i-1} P_{i-1} + w_{i} P_i + w_{i+1} P_{i+1}}{w_{i-1}+w_{i}+w_{i+1}}$$

$$\text{DireccionRadioDeGiro} = \frac{\text{CentroDeCurvatura} - P_i}{\lVert \text{CentroDeCurvatura} - P_i \rVert}$$

Es el vector unitario que apunta, desde cada punto de la vía, hacia el centro de curvatura ("hacia dónde te empuja la curva"). La convención de pesos (lado opuesto a cada vértice) está verificada directamente contra el código fuente (`analisis_energia.m`, líneas 117–119): el código siempre calculó los pesos correctamente; ver el historial de esta corrección en [§13](#13-changelog).

---

## 5. Notación `[X Y Z Magnitud]` y protección contra NaN

Toda matriz que guarda **vectores** (no posiciones) sigue el mismo formato: las primeras 3 columnas son la dirección normalizada (vector unitario) y la 4ta columna es el módulo real. Para recuperar el vector completo de cualquier fila: `Magnitud .* [X Y Z]`.

### 5.1 El problema del NaN

Para obtener la dirección de un vector se lo divide por su propia norma. Si el vector es **exactamente nulo** — cosa que pasa en tramos rectos, donde la aceleración centrípeta es cero — la operación es $0/0$, que en punto flotante da `NaN` ("Not a Number").

El `NaN` es contagioso: cualquier operación aritmética que lo toque devuelve `NaN`. Un solo tramo recto puede así vaciar silenciosamente resultados aguas abajo, sin ningún mensaje de error.

Solución implementada: la función local `VersorSeguro` verifica la norma contra una tolerancia y devuelve $[0,0,0]$ donde el vector es nulo, en vez de dividir. Ver el historial de esta protección en [§13](#13-changelog).

---

## 6. Energía inicial y potencial

$$E_0 = \tfrac{1}{2}\,\text{Masa}\cdot\text{VelocidadInicial}^2 + \text{Masa}\cdot\text{Gravedad}\cdot z_1$$

$$\text{EnergiaPotencial}_i = \text{Masa}\cdot\text{Gravedad}\cdot z_i$$

`EnergiaInicial` es $E_0$ repetido en todos los puntos, usado como recta de referencia (energía máxima disponible, sin pérdidas).

---

## 7. Plano perpendicular a la trayectoria

En cada punto se arma el plano perpendicular a la vía, definido por la tangente local:

$$\mathbf{T}_i = \frac{P_{i+1}-P_i}{\lVert P_{i+1}-P_i \rVert}$$

Proyección de un vector cualquiera $V$ sobre ese plano (se le quita la componente a lo largo de la vía):

$$V_{\perp} = V - (V\cdot \mathbf{T})\,\mathbf{T}$$

$$\text{GravedadProyectada} = \text{proy}_{\perp}\big([0,\,0,\,-g]\big)$$

---

## 8. Modelo de resistencia al avance

La versión anterior (previa al changelog de [§13](#13-changelog)) usaba un único coeficiente de fricción de deslizamiento, $\mu = 0.18$, aplicado a la fuerza normal total:

$$E_{perdida} = \mu\,F_N\,\Delta s \qquad \text{(modelo anterior, ya reemplazado)}$$

Ese modelo tenía dos problemas:

1. **$\mu = 0.18$ es un coeficiente de deslizamiento**, apropiado para un bloque arrastrado sobre una superficie. El carro va sobre ruedas montadas en rodamientos: el mecanismo de pérdida es resistencia a la rodadura más fricción interna del rodamiento, típicamente un orden de magnitud menor.
2. **No hay un solo contacto, hay tres.** Un carro de montaña rusa tiene tres juegos de ruedas, cada uno tomando carga en una dirección distinta y con su propia resistencia.

### 8.1 Los tres juegos de ruedas

| Juego | En inglés | Qué carga toma | Cuándo trabaja |
|---|---|---|---|
| Portantes | road / running wheels | normal "hacia arriba" en el marco del carro | régimen normal, $G_z > 0$ |
| Guía | guide / side wheels | normal lateral | curvas con peralte imperfecto |
| Retención | up-stop wheels | normal "hacia abajo" en el marco del carro | airtime, $G_z < 0$ |

$$F_{rodadura} = C_{rr,port}\,F_{N,port} + C_{rr,guia}\,F_{N,guia} + C_{rr,ret}\,F_{N,ret}$$

($F_{N,port}, F_{N,guia}, F_{N,ret}$: fuerza normal tomada por cada juego de ruedas; antes notadas $N_{port}$, etc. — renombradas por la colisión de símbolos #6, ver [`NOMENCLATURA.md`](NOMENCLATURA.md#0-colisiones-resueltas).)

**Estado actual del reparto, específico de `analisis_energia.m`.** Hasta que este script incorpore el modelo de ángulo de roll $\phi(s)$ no se puede determinar el marco del carro y, por lo tanto, tampoco cómo se reparte la normal entre los tres juegos. El código de **este script** asume provisoriamente **peralte perfecto** (G lateral nula), con lo cual toda la carga va a las ruedas portantes (verificado contra `analisis_energia.m`, líneas 195–203: `CargaPortantes = FuerzaNormal; CargaGuia = 0; CargaRetencion = 0;`).

Esto **no es una contradicción** con lo que dice [`documentacion_generador_elementos.md` §15](documentacion_generador_elementos.md#15-otras-limitaciones-y-proximos-pasos), que afirma que el generador de elementos **sí** reparte correctamente la normal proyectando sobre $\mathbf{U}$ y $\mathbf{L}$: son dos scripts distintos, con distinto grado de madurez. El generador de elementos (`GeneradorDeElementos/Fisica/CargasEnLaVia.m` y `ResistenciaAlAvance.m`) ya tiene el marco del carro con roll explícito y por eso puede repartir la carga; `analisis_energia.m` es el modelo preliminar y todavía no lo tiene. El reparto real en este script requeriría proyectar `NormalVia` sobre los ejes $\mathbf{U}$ (arriba del carro) y $\mathbf{L}$ (lateral) del marco del carro, igual que ya hace el generador.

### 8.2 Arrastre aerodinámico

La versión anterior lo despreciaba. **A la escala del modelo no es despreciable.**

$$F_{arrastre} = \tfrac{1}{2}\,\rho\,C_d\,A_{ef}\,v^2$$

con área frontal efectiva del tren

$$A_{ef} = A\,\big[1 + k_{tren}(n_{carros}-1)\big]$$

Los carros de atrás van en la estela del primero y aportan sólo una fracción $k_{tren} \approx 0.2$–$0.3$ del arrastre de flujo libre (código: `Parametros.FactorTren`).

Órdenes de magnitud con los valores actuales ($\rho = 1.2$ kg/m³, $C_d = 0.9$, $A = 0.06 \times 0.06$ m², $m = 0.15$ kg, 1 carro):

| $v$ [m/s] | $F_{arrastre}$ [N] | % del peso | $Re$ |
|---|---|---|---|
| 2 | 0.0078 | 0.5 | 1.3×10⁴ |
| 3 | 0.0175 | 1.2 | 2.0×10⁴ |
| 4 | 0.0311 | 2.1 | 2.7×10⁴ |
| 5 | 0.0486 | 3.3 | 3.3×10⁴ |
| 6 | 0.0700 | 4.8 | 4.0×10⁴ |

Comparado con la rodadura, la velocidad a la que ambos mecanismos se igualan es

$$v_{cruce} = \sqrt{\frac{2\,C_{rr}\,m\,g}{\rho\,C_d\,A_{ef}}}$$

que con $C_{rr} = 0.03$ da **≈ 4.8 m/s** — justo en el rango de diseño del modelo. Por encima de esa velocidad el arrastre domina.

**Nota sobre $C_{rr}=0.03$ en esta fórmula.** Este valor **no corresponde a ninguno de los tres coeficientes declarados** en `ParametrosPorDefecto.m`/`analisis_energia.m` (`CoefRodaduraPortantes = 0.030`, `CoefRodaduraGuia = 0.035`, `CoefRodaduraRetencion = 0.035`): coincide numéricamente con `CoefRodaduraPortantes`, pero la fórmula de $v_{cruce}$ lo usa como un valor único de referencia para estimar el orden de magnitud de cruce, no como el coeficiente efectivo del modelo completo (que mezcla los tres según cómo se reparta la carga). Se lo deja así, marcado, como valor de referencia — no se inventa una combinación de los tres coeficientes para reemplazarlo.

### 8.3 Diferencia estructural entre ambos mecanismos

| | Rodadura | Arrastre |
|---|---|---|
| Depende de | fuerza normal $F_N$ | velocidad $v^2$ |
| En un loop | máximo en el valle (alta $F_N$) | máximo en el valle (alta $v$) |
| En la cúspide | mínimo | mínimo |
| Necesita curvatura definida | sí | no |

La segunda columna es la razón por la que el arrastre **sí** se puede calcular en el primer punto de la trayectoria, donde la curvatura todavía no está definida.

### 8.4 Pérdida total

$$E_{perdida,\,k \to k+1} = \big(F_{rodadura,k} + F_{arrastre,k}\big)\,\Delta s$$

---

## 9. Proceso iterativo: velocidad, normales y pérdidas

Como la energía disponible en el punto $k+1$ depende de la resistencia entre $k$ y $k+1$, que depende de la fuerza normal en $k$, que depende de la velocidad en $k$, que depende de la energía en $k$ — es una cadena que **no se puede vectorizar**: se recorre la trayectoria punto por punto (equivalente a un método de Euler explícito).

Para cada punto $k$ (de 1 a $n-1$), con `EnergiaTotal(1) = `$E_0$:

1. $\text{EnergiaCinetica}_k = \text{EnergiaTotal}_k - \text{EnergiaPotencial}_k$
   - Si es negativa: el carrito no tiene energía suficiente para llegar ahí → **se corta el cálculo** (`PuntoDeParada`) y se grafica solo hasta ese punto.
2. $\text{Velocidad}_k = \sqrt{2\,\text{EnergiaCinetica}_k / \text{Masa}}$
3. Arrastre aerodinámico (no requiere curvatura, se calcula siempre).
4. Aceleración centrípeta, proyectada sobre el plano perpendicular:
   $$\text{NormalRadioDeGiro}_k = \text{proy}_{\perp}\left(\text{DireccionRadioDeGiro}_k \cdot \frac{\text{Velocidad}_k^2}{\text{RadioDeGiro}_k}\right)$$
5. Equilibrio en el plano perpendicular — se despeja la aceleración que debe aportar la vía:
   $$\text{GravedadProyectada} + \text{NormalVia} + \text{NormalRadioDeGiro} = 0$$
   $$\text{NormalVia}_k = -(\text{GravedadProyectada}_k + \text{NormalRadioDeGiro}_k)$$
6. Fuerza normal real (recién acá se reintroduce la masa, ya que todo lo anterior está en unidades de aceleración):
   $$F_{N,k} = \text{Masa} \cdot \lVert \text{NormalVia}_k \rVert$$
7. Actualización del contador de energía con ambas pérdidas.

**Caso de borde:** el primer punto no tiene curvatura definida (no tiene vecino anterior), así que no computa pérdida por rodadura. El arrastre **sí** se computa ahí, porque no depende de la normal.

---

## 10. Unidades en G's

Ni `Gravedad` ni $v^2/R$ están multiplicados por `Masa`, así que toda la ecuación de equilibrio queda en unidades de aceleración. Dividiendo `GravedadProyectada`, `NormalRadioDeGiro` y `NormalVia` por `Gravedad`, quedan expresadas en **G's** — independiente de qué tan pesado sea el carrito.

> **Consistencia con ASTM F2291 §7.1.4.5:** la norma define sus límites como *aceleración neta total, incluida la gravedad terrestre* — un cuerpo en reposo mide 1 G en el eje perpendicular a la superficie de la Tierra. `NormalVia` ya es exactamente esa magnitud (gravedad + centrípeta combinadas), así que es directamente comparable contra los límites de la norma. `NormalRadioDeGiro` **no** lo es, porque excluye la gravedad.

Las curvas límite por eje (Figs. 6 a 10 de F2291-06a) están tabuladas en [`memoria_de_calculo.md` §5](memoria_de_calculo.md#5-criterios-de-aceptacion-astm-f2291-06a-7). Son **dependientes de la duración**: no alcanza con comparar el pico contra un escalar, hay que medir cuánto dura el evento sostenido y evaluar la curva en esa duración (fórmula de conversión de duración modelo→real: [`memoria_de_calculo.md` §5.1](memoria_de_calculo.md#51-definiciones-normativas-aplicables)).

**Limitación actual del script:** las G se calculan como magnitud en el marco global. Para comparar contra la norma hacen falta las componentes en los ejes del pasajero ($G_x$, $G_y$, $G_z$), lo cual requiere el marco del carro — pendiente junto con el modelo de roll. El generador de elementos ya lo tiene resuelto, ver [`documentacion_generador_elementos.md` §3](documentacion_generador_elementos.md#3-marco-de-referencia).

---

## 11. Signo de la fuerza centrípeta sentida

Como `NormalRadioDeGiro` y `DireccionRadioDeGiro` ya están normalizadas, el producto punto entre sus direcciones da el signo:

$$\text{signo} = \text{sign}\big(\widehat{\text{NormalRadioDeGiro}} \cdot \widehat{\text{DireccionRadioDeGiro}}\big)$$

$$\text{FuerzaGRadioDeGiro} = \text{signo} \times \lVert \text{NormalRadioDeGiro} \rVert$$

Positivo: la fuerza empuja en el sentido del radio de giro (hacia el centro de curvatura). Negativo: en sentido opuesto.

---

## 12. Gráficos generados

1. **Trayectoria 3D — radio de giro**: vía en gris, puntos coloreados por curvatura ($1/R$), flechas con la dirección del radio de giro.
2. **Energía vs Longitud Recorrida**: energía potencial, **energía cinética**, recta de energía inicial ($E_0$) y energía total real (decreciente por pérdidas), con marca en el punto donde el carrito se queda sin energía (si aplica). La cinética es la distancia vertical entre la total y la potencial; graficarla explícita hace visible dónde se acaba el margen.
3. **Reparto de pérdidas**: energía disipada acumulada por rodadura y por arrastre, por separado.
4. **Trayectoria 3D — velocidades**: vía en gris, puntos coloreados por velocidad, flechas con la dirección de avance (tangente).
5. **Fuerza G por radio de giro** (con signo) vs Longitud Recorrida.
6. **Trayectoria 3D — G's sobre la vía**: vía en gris, puntos coloreados por la magnitud de `NormalVia`, flechas con su dirección.

En todos los gráficos que dependen de la energía, los puntos posteriores a `PuntoDeParada` quedan en `NaN` y la línea se corta sola ahí — no se inventan datos donde el carrito no llegó.

---

## 13. Changelog

Esta sección documenta cambios ya integrados en el código de `analisis_energia.m`. La rama en que se introdujeron fue `correcciones menores`; ese trabajo ya está incorporado en la rama actual del repositorio (`Correcciones-menores`, verificado leyendo el script: los cuatro cambios listados abajo están efectivamente implementados y activos). Por eso esta sección es un registro histórico y no una descripción de "lo que corrige esta rama" — las marcas **(C1)** a **(C4)** que antes aparecían dispersas en el cuerpo del documento se sacaron del texto corrido; sólo quedan acá.

| ID | Qué cambió | Por qué |
|---|---|---|
| **C1** | Resistencia al avance: rodadura con tres coeficientes + arrastre aerodinámico, en lugar de un único $\mu$ de deslizamiento | $\mu = 0.18$ era un coeficiente de deslizamiento aplicado a un sistema con ruedas y rodamientos; el arrastre es comparable a la rodadura a las velocidades del modelo. Ver [§8](#8-modelo-de-resistencia-al-avance) |
| **C2** | `VersorSeguro` / `ConVersorYMagnitud` protegen contra $0/0$ | Un tramo recto generaba `NaN` que se propagaba silenciosamente. Ver [§5.1](#51-el-problema-del-nan) |
| **C3** | Guarda numérica en el radio de giro para triángulos degenerados | Con paso chico y vía casi recta, el área se pierde en el error de redondeo. Ver [§4.1](#41-fragilidad-numerica-de-esta-formula) |
| **C4** | Fórmula del circuncentro corregida en la documentación | El `.md` de una versión anterior usaba el lado adyacente en vez del opuesto en la fórmula de pesos baricéntricos; el código nunca tuvo ese error, sólo la documentación estaba mal etiquetada. Ver [§4.2](#42-direccion-centro-de-curvatura) |

---

## 14. Hipótesis vigentes

- **Modelo de partícula.** El tren se trata como un punto. Con $n_{carros}$ carros, la velocidad es común a todo el tren y la altura relevante es la del conjunto, no la de un punto — pendiente de implementar.
- **Peralte perfecto.** Se asume G lateral nula, con lo cual toda la normal la toman las ruedas portantes. Válido sólo hasta que exista el modelo de roll $\phi(s)$ en este script — ver la aclaración de alcance en [§8.1](#81-los-tres-juegos-de-ruedas).
- **$C_d$ constante.** El número de Reynolds del modelo ($\sim$2–4×10⁴) está en el rango donde $C_d$ de un cuerpo romo varía poco, pero no es el mismo Re que el de una atracción real (ver [`memoria_de_calculo.md` §4.5](memoria_de_calculo.md#45-que-no-escala)).
- **Aire quieto.** Sin viento ni efectos de aire en movimiento.
- **Vía rígida.** Sin deformación de la estructura ni de las ruedas.
- **Sin pérdidas en juntas.** No se modelan impactos ni discontinuidades de fabricación entre tramos de vía.

---

## 15. Limitaciones actuales / próximos pasos

- La trayectoria hoy se genera en el propio script (debug, ver [§2.1](#21-trayectoria-actualmente-activa)); falta la importación de una lista real de puntos.
- El esquema de integración es Euler explícito (orden 1): usa la normal al **principio** de cada segmento para estimar la pérdida de todo el tramo. Para la generación de geometría de elementos (loops, clotoides) esto acumula deriva y hay que pasar a RK4 — ya implementado en el generador, ver [`documentacion_generador_elementos.md` §4.1.1](documentacion_generador_elementos.md#411-capa-3-la-marcha-un-paso-a-la-vez).
- Falta el marco del carro (ángulo de roll $\phi(s)$), sin el cual no se puede repartir la normal entre los tres juegos de ruedas ni descomponer las G en los ejes del pasajero.
- Los tres coeficientes de rodadura y el $C_d$ son valores provisorios: **requieren calibración experimental** (ver [`memoria_de_calculo.md` §11](memoria_de_calculo.md#11-datos-pendientes-de-verificacion)).
