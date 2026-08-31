# Análisis de conservación de energía para diseño de montañas rusas

Documentación del proceso y las ecuaciones implementadas en [`analisis_energia.m`](analisis_energia.m). Es un modelo preliminar ("rough model"): a partir de una trayectoria 3D, calcula velocidad, radio de curvatura, fuerzas normales (en G's) y pérdidas por resistencia al avance a lo largo del recorrido.

> **Branch `correcciones menores`.** Esta versión corrige cuatro cosas respecto de la anterior. Están marcadas en el texto como **(C1)** a **(C4)** y resumidas en la sección 13.

> **Documento hermano:** los criterios de diseño (continuidad, marco de referencia, cinemática de heartline, semejanza de Froude y límites normativos tabulados) están en [`memoria_de_calculo.md`](memoria_de_calculo.md). Este documento cubre sólo el script de análisis energético.

## 1. Parámetros del modelo

| Variable | Significado | Unidad |
|---|---|---|
| `DistanciaDeDiscretizacion` | cada cuánto (medido sobre la curva) se pone un punto de análisis | m |
| `Gravedad` | aceleración de la gravedad | m/s² |
| `CoefRodaduraPortantes` | resistencia a la rodadura de las ruedas de carga | — |
| `CoefRodaduraGuia` | resistencia a la rodadura de las ruedas laterales | — |
| `CoefRodaduraRetencion` | resistencia a la rodadura de las ruedas de retención (up-stop) | — |
| `DensidadAire` | densidad del aire | kg/m³ |
| `CoefArrastre` | coeficiente de arrastre aerodinámico $C_d$ | — |
| `AreaFrontal` | área frontal proyectada de un carro | m² |
| `FactorTren` | fracción del arrastre que aporta cada carro detrás del primero | — |
| `Masa` | masa del carrito | kg |
| `VelocidadInicial` | velocidad en el primer punto de la trayectoria | m/s |
| `NumeroDeCarros` | carros del tren | — |

## 2. Trayectoria paramétrica

La vía se define como una curva paramétrica en función de una variable libre `t`:

$$X(t),\quad Y(t),\quad Z(t), \qquad t \in [T_{min}, T_{max}]$$

Parametrizar por `t` (en vez de usar `x` como parámetro) permite representar curvas que doblan hacia atrás, suben y bajan más de una vez para el mismo `x`, o hacen loops.

Se muestrea finamente (`NumPuntosFinos`) para aproximar la curva continua como una polilínea de segmentos muy cortos — `TrayectoriaFina`.

> **Polilínea:** una curva representada como una lista ordenada de puntos unidos por segmentos rectos. No es una fórmula, es una tabla de coordenadas. Si los puntos están lo bastante juntos, la diferencia con la curva real es despreciable para todo propósito práctico.

Trayectoria de prueba actual (debug):
$$X(t) = \sin(t), \qquad Y(t) = 2\cos(t), \qquad Z(t) = 10 - t + 20\cos(t/10)$$

> **Por qué sale una hélice de varias vueltas y no un loop.** $X$ e $Y$ son periódicas en $t$ con período $2\pi$, y $T_{max} = 10\pi$ son cinco períodos: la proyección sobre el plano $XY$ recorre cinco veces la misma elipse. Mientras tanto $dZ/dt = -1 - 2\sin(t/10)$ es negativa en todo el intervalo, o sea que $Z$ baja siempre y nunca vuelve. Curva cerrada en horizontal más avance monótono en vertical es, por definición, una hélice. No es un error: es una curva de prueba elegida para ejercitar la discretización por longitud de arco y el cálculo de curvatura sobre algo que no es función de $x$. La geometría de vía de verdad la genera el constructor de elementos, documentado en [`documentacion_generador_elementos.md`](documentacion_generador_elementos.md). Para un solo loop vertical hay que poner la circunferencia en un plano **vertical** y recorrer un solo período; el script tiene las tres líneas comentadas al lado.

## 3. Discretización por longitud de arco

El objetivo es obtener puntos separados por `DistanciaDeDiscretizacion` **medido sobre la curva**, no sobre ningún eje.

1. Distancia de cada segmento fino:
$$\Delta s_i = \lVert P_{i+1} - P_i \rVert$$
2. Longitud acumulada (cuentakilómetros) en cada punto fino:
$$s_i = \sum_{k=1}^{i-1} \Delta s_k$$
3. Se definen las longitudes objetivo $0, d, 2d, \dots$ (con $d=$ `DistanciaDeDiscretizacion`) y se interpola (`interp1`) la posición $(x,y,z)$ correspondiente a cada una, usando $s_i \to P_i$ como tabla de interpolación.

Resultado: **`TrayectoriaDePuntos`**, matriz $n\times3$ con un punto real de la vía cada `DistanciaDeDiscretizacion` metros de recorrido.

## 4. Radio de giro (curvatura local)

Para cada punto interior $P_i$ (con vecino anterior $P_{i-1}$ y siguiente $P_{i+1}$), se estima la circunferencia que pasa por los 3 puntos (circunferencia osculatriz discreta).

Lados del triángulo:
$$a = \lVert P_i - P_{i-1}\rVert, \quad b = \lVert P_{i+1}-P_i\rVert, \quad c = \lVert P_{i+1}-P_{i-1}\rVert$$

Área (con producto cruz):
$$\text{Área} = \tfrac{1}{2}\lVert (P_i-P_{i-1}) \times (P_{i+1}-P_{i-1}) \rVert$$

Radio de curvatura (`RadioDeGiro`):
$$R = \frac{a\,b\,c}{4\,\text{Área}}$$

En un tramo recto, Área $\to 0$ y $R \to \infty$ (correcto: una recta no tiene curvatura).

### (C3) Fragilidad numérica de esta fórmula

Esta estimación **se degrada cuando el paso de discretización es chico y la vía es casi recta**. El área se calcula restando cantidades casi iguales; en aritmética de punto flotante (≈16 dígitos significativos) esa resta destruye casi todos los dígitos y lo que queda es ruido de redondeo. Como el área está en el denominador, el radio resultante puede saltar erráticamente entre valores sin sentido.

Regla práctica: el error relativo del área crece aproximadamente como $\varepsilon_{maq}\,(R/\Delta s)^2$. Con $R = 1$ m y $\Delta s = 1$ mm el factor es $10^6$ — todavía tolerable. Con $R = 100$ m y $\Delta s = 1$ mm es $10^{10}$, y el resultado ya no tiene ningún dígito válido.

Mitigación implementada: si Área $<$ `TolArea`, se declara el tramo recto ($R = \infty$) en vez de devolver un número inventado.

**Mitigación definitiva (pendiente):** cuando la geometría se genere imponiendo $\kappa(s)$ (loops, clotoides), llevar la curvatura analíticamente desde la generación y usar esta fórmula discreta **sólo como test de validación** contra la curvatura impuesta.

### Dirección (centro de curvatura)

Se calcula el centro exacto de esa misma circunferencia con la fórmula de **coordenadas baricéntricas del circuncentro** (válida en 2D o 3D). El peso de cada vértice se construye con el lado **opuesto** a ese vértice:

$$w_{i-1} = b^2(c^2+a^2-b^2), \quad w_{i} = c^2(a^2+b^2-c^2), \quad w_{i+1} = a^2(b^2+c^2-a^2)$$

$$\text{CentroDeCurvatura} = \frac{w_{i-1} P_{i-1} + w_{i} P_i + w_{i+1} P_{i+1}}{w_{i-1}+w_{i}+w_{i+1}}$$

$$\text{DireccionRadioDeGiro} = \frac{\text{CentroDeCurvatura} - P_i}{\lVert \text{CentroDeCurvatura} - P_i \rVert}$$

> **(C4) Corrección respecto de la versión anterior de este documento.** La versión previa escribía $\alpha = a^2(b^2+c^2-a^2)$ asignado a $P_{i-1}$, es decir usaba el lado $a$ (que es *adyacente* a $P_{i-1}$) en vez del lado $b$ (que es el *opuesto*). **El código siempre estuvo bien**; era la documentación la que estaba mal etiquetada. Queda corregido arriba.

Es el vector unitario que apunta, desde cada punto de la vía, hacia el centro de curvatura ("hacia dónde te empuja la curva").

## 5. Notación `[X Y Z Magnitud]` y protección contra NaN

Toda matriz que guarda **vectores** (no posiciones) sigue el mismo formato: las primeras 3 columnas son la dirección normalizada (vector unitario) y la 4ta columna es el módulo real. Para recuperar el vector completo de cualquier fila: `Magnitud .* [X Y Z]`.

### (C2) El problema del NaN

Para obtener la dirección de un vector se lo divide por su propia norma. Si el vector es **exactamente nulo** — cosa que pasa en tramos rectos, donde la aceleración centrípeta es cero — la operación es $0/0$, que en punto flotante da `NaN` ("Not a Number").

El `NaN` es contagioso: cualquier operación aritmética que lo toque devuelve `NaN`. Un solo tramo recto puede así vaciar silenciosamente resultados aguas abajo, sin ningún mensaje de error.

Solución implementada: la función local `VersorSeguro` verifica la norma contra una tolerancia y devuelve $[0,0,0]$ donde el vector es nulo, en vez de dividir.

## 6. Energía inicial y potencial

$$E_0 = \tfrac{1}{2}\,\text{Masa}\cdot\text{VelocidadInicial}^2 + \text{Masa}\cdot\text{Gravedad}\cdot z_1$$

$$\text{EnergiaPotencial}_i = \text{Masa}\cdot\text{Gravedad}\cdot z_i$$

`EnergiaInicial` es $E_0$ repetido en todos los puntos, usado como recta de referencia (energía máxima disponible, sin pérdidas).

## 7. Plano perpendicular a la trayectoria

En cada punto se arma el plano perpendicular a la vía, definido por la tangente local:

$$\text{VersorTangente}_i = \frac{P_{i+1}-P_i}{\lVert P_{i+1}-P_i \rVert}$$

Proyección de un vector cualquiera $V$ sobre ese plano (se le quita la componente a lo largo de la vía):

$$V_{\perp} = V - (V\cdot \text{VersorTangente})\,\text{VersorTangente}$$

$$\text{GravedadProyectada} = \text{proy}_{\perp}\big([0,\,0,\,-\text{Gravedad}]\big)$$

## 8. (C1) Modelo de resistencia al avance

La versión anterior usaba un único coeficiente de fricción de deslizamiento, $\mu = 0.18$, aplicado a la fuerza normal total:

$$E_{perdida} = \mu\,N\,\Delta s \qquad \text{(modelo anterior)}$$

Ese modelo tiene dos problemas:

1. **$\mu = 0.18$ es un coeficiente de deslizamiento**, apropiado para un bloque arrastrado sobre una superficie. El carro va sobre ruedas montadas en rodamientos: el mecanismo de pérdida es resistencia a la rodadura más fricción interna del rodamiento, típicamente un orden de magnitud menor.
2. **No hay un solo contacto, hay tres.** Un carro de montaña rusa tiene tres juegos de ruedas, cada uno tomando carga en una dirección distinta y con su propia resistencia.

### Los tres juegos de ruedas

| Juego | En inglés | Qué carga toma | Cuándo trabaja |
|---|---|---|---|
| Portantes | road / running wheels | normal "hacia arriba" en el marco del carro | régimen normal, $G_z > 0$ |
| Guía | guide / side wheels | normal lateral | curvas con peralte imperfecto |
| Retención | up-stop wheels | normal "hacia abajo" en el marco del carro | airtime, $G_z < 0$ |

$$F_{rodadura} = C_{rr,port}\,N_{port} + C_{rr,guia}\,N_{guia} + C_{rr,ret}\,N_{ret}$$

Los tres coeficientes son los que el prompt llama "coeficiente de rozamiento en tres direcciones".

> **Estado actual del reparto.** Hasta que exista el modelo de ángulo de roll $\phi(s)$ no se puede determinar el marco del carro y, por lo tanto, tampoco cómo se reparte la normal entre los tres juegos. El código asume provisoriamente **peralte perfecto** (G lateral nula), con lo cual toda la carga va a las ruedas portantes. El reparto real requiere proyectar `NormalVia` sobre los ejes $U$ (arriba del carro) y $L$ (lateral) del marco del carro.

### Arrastre aerodinámico

La versión anterior lo despreciaba. **A la escala del modelo no es despreciable.**

$$F_{arrastre} = \tfrac{1}{2}\,\rho\,C_d\,A_{ef}\,v^2$$

con área frontal efectiva del tren

$$A_{ef} = A\,\big[1 + k_{tren}(N_{carros}-1)\big]$$

Los carros de atrás van en la estela del primero y aportan sólo una fracción $k_{tren} \approx 0.2$–$0.3$ del arrastre de flujo libre.

Órdenes de magnitud con los valores actuales ($\rho = 1.2$ kg/m³, $C_d = 0.9$, $A = 0.06 \times 0.06$ m², $m = 0.15$ kg, 1 carro):

| $v$ [m/s] | $F_{arrastre}$ [N] | % del peso | Re |
|---|---|---|---|
| 2 | 0.0078 | 0.5 % | 1.3×10⁴ |
| 3 | 0.0175 | 1.2 % | 2.0×10⁴ |
| 4 | 0.0311 | 2.1 % | 2.7×10⁴ |
| 5 | 0.0486 | 3.3 % | 3.3×10⁴ |
| 6 | 0.0700 | 4.8 % | 4.0×10⁴ |

Comparado con la rodadura, la velocidad a la que ambos mecanismos se igualan es

$$v_{cruce} = \sqrt{\frac{2\,C_{rr}\,m\,g}{\rho\,C_d\,A_{ef}}}$$

que con $C_{rr} = 0.03$ da **≈ 4.8 m/s** — justo en el rango de diseño del modelo. Por encima de esa velocidad el arrastre domina.

### Diferencia estructural entre ambos mecanismos

| | Rodadura | Arrastre |
|---|---|---|
| Depende de | fuerza normal $N$ | velocidad $v^2$ |
| En un loop | máximo en el valle (alta $N$) | máximo en el valle (alta $v$) |
| En la cúspide | mínimo | mínimo |
| Necesita curvatura definida | sí | no |

La segunda columna es la razón por la que el arrastre **sí** se puede calcular en el primer punto de la trayectoria, donde la curvatura todavía no está definida.

### Pérdida total

$$E_{perdida,\,k \to k+1} = \big(F_{rodadura,k} + F_{arrastre,k}\big)\,\Delta s$$

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
   $$\text{FuerzaNormal}_k = \text{Masa} \cdot \lVert \text{NormalVia}_k \rVert$$
7. Actualización del contador de energía con ambas pérdidas.

**Caso de borde:** el primer punto no tiene curvatura definida (no tiene vecino anterior), así que no computa pérdida por rodadura. El arrastre **sí** se computa ahí, porque no depende de la normal.

## 10. Unidades en G's

Ni `Gravedad` ni $v^2/R$ están multiplicados por `Masa`, así que toda la ecuación de equilibrio queda en unidades de aceleración. Dividiendo `GravedadProyectada`, `NormalRadioDeGiro` y `NormalVia` por `Gravedad`, quedan expresadas en **G's** — independiente de qué tan pesado sea el carrito.

> **Consistencia con ASTM F2291 §7.1.4.5:** la norma define sus límites como *aceleración neta total, incluida la gravedad terrestre* — un cuerpo en reposo mide 1 G en el eje perpendicular a la superficie de la Tierra. `NormalVia` ya es exactamente esa magnitud (gravedad + centrípeta combinadas), así que es directamente comparable contra los límites de la norma. `NormalRadioDeGiro` **no** lo es, porque excluye la gravedad.

Las curvas límite por eje (Figs. 6 a 10 de F2291-06a) están tabuladas en la sección 5 de [`memoria_de_calculo.md`](memoria_de_calculo.md). Son **dependientes de la duración**: no alcanza con comparar el pico contra un escalar, hay que medir cuánto dura el evento sostenido y evaluar la curva en esa duración.

**Limitación actual del script:** las G se calculan como magnitud en el marco global. Para comparar contra la norma hacen falta las componentes en los ejes del pasajero ($G_x$, $G_y$, $G_z$), lo cual requiere el marco del carro — pendiente junto con el modelo de roll.

## 11. Signo de la fuerza centrípeta sentida

Como `NormalRadioDeGiro` y `DireccionRadioDeGiro` ya están normalizadas, el producto punto entre sus direcciones da el signo:

$$\text{signo} = \text{sign}\big(\widehat{\text{NormalRadioDeGiro}} \cdot \widehat{\text{DireccionRadioDeGiro}}\big)$$

$$\text{FuerzaGRadioDeGiro} = \text{signo} \times \lVert \text{NormalRadioDeGiro} \rVert$$

Positivo: la fuerza empuja en el sentido del radio de giro (hacia el centro de curvatura). Negativo: en sentido opuesto.

## 12. Gráficos generados

1. **Trayectoria 3D — radio de giro**: vía en gris, puntos coloreados por curvatura ($1/R$), flechas con la dirección del radio de giro.
2. **Energía vs Longitud Recorrida**: energía potencial, **energía cinética**, recta de energía inicial ($E_0$) y energía total real (decreciente por pérdidas), con marca en el punto donde el carrito se queda sin energía (si aplica). La cinética es la distancia vertical entre la total y la potencial; graficarla explícita hace visible dónde se acaba el margen.
3. **Reparto de pérdidas** *(nuevo)*: energía disipada acumulada por rodadura y por arrastre, por separado.
4. **Trayectoria 3D — velocidades**: vía en gris, puntos coloreados por velocidad, flechas con la dirección de avance (tangente).
5. **Fuerza G por radio de giro** (con signo) vs Longitud Recorrida.
6. **Trayectoria 3D — G's sobre la vía**: vía en gris, puntos coloreados por la magnitud de `NormalVia`, flechas con su dirección.

En todos los gráficos que dependen de la energía, los puntos posteriores a `PuntoDeParada` quedan en `NaN` y la línea se corta sola ahí — no se inventan datos donde el carrito no llegó.

## 13. Resumen de correcciones de esta branch

| ID | Qué cambió | Por qué |
|---|---|---|
| **C1** | Resistencia al avance: rodadura con tres coeficientes + arrastre aerodinámico, en lugar de un único $\mu$ de deslizamiento | $\mu = 0.18$ era un coeficiente de deslizamiento aplicado a un sistema con ruedas y rodamientos; el arrastre es comparable a la rodadura a las velocidades del modelo |
| **C2** | `VersorSeguro` / `ConVersorYMagnitud` protegen contra $0/0$ | Un tramo recto generaba `NaN` que se propagaba silenciosamente |
| **C3** | Guarda numérica en el radio de giro para triángulos degenerados | Con paso chico y vía casi recta, el área se pierde en el error de redondeo |
| **C4** | Fórmula del circuncentro corregida en la documentación | El `.md` usaba el lado adyacente en vez del opuesto; el código estaba bien |

## 14. Hipótesis vigentes

- **Modelo de partícula.** El tren se trata como un punto. Con $N$ carros, la velocidad es común a todo el tren y la altura relevante es la del conjunto, no la de un punto — pendiente de implementar.
- **Peralte perfecto.** Se asume G lateral nula, con lo cual toda la normal la toman las ruedas portantes. Válido sólo hasta que exista el modelo de roll $\phi(s)$.
- **$C_d$ constante.** El número de Reynolds del modelo ($\sim$2–4×10⁴) está en el rango donde $C_d$ de un cuerpo romo varía poco, pero no es el mismo Re que el de una atracción real (ver nota de semejanza de Froude en el reporte).
- **Aire quieto.** Sin viento ni efectos de aire en movimiento.
- **Vía rígida.** Sin deformación de la estructura ni de las ruedas.
- **Sin pérdidas en juntas.** No se modelan impactos ni discontinuidades de fabricación entre tramos de vía.

## 15. Limitaciones actuales / próximos pasos

- La trayectoria hoy se genera en el propio script (debug); falta la importación de una lista real de puntos.
- El esquema de integración es Euler explícito (orden 1): usa la normal al **principio** de cada segmento para estimar la pérdida de todo el tramo. Para la generación de geometría de elementos (loops, clotoides) esto acumula deriva y hay que pasar a RK4.
- Falta el marco del carro (ángulo de roll $\phi(s)$), sin el cual no se puede repartir la normal entre los tres juegos de ruedas ni descomponer las G en los ejes del pasajero.
- Los tres coeficientes de rodadura y el $C_d$ son valores provisorios: **requieren calibración experimental**.
