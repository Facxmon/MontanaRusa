# Constructor de elementos de vía — loop vertical

Documentación del generador de geometría de vía implementado en [`GeneradorDeElementos/`](GeneradorDeElementos), con el script de demostración [`DemoLoopVertical.m`](DemoLoopVertical.m) y los tests en [`TestsValidacion.m`](TestsValidacion.m).

> **Documentos hermanos.** Los criterios de diseño (continuidad, marco de referencia, cinemática de heartline, semejanza de Froude y límites normativos tabulados) están en [`memoria_de_calculo.md`](memoria_de_calculo.md). El análisis energético preliminar sobre una trayectoria ya dada está en [`documentacion_analisis_energia.md`](documentacion_analisis_energia.md). Este documento cubre sólo el generador de elementos.

## 1. Cómo se corre

```matlab
run('DemoLoopVertical.m')     % genera, verifica, grafica y compara métodos
run('TestsValidacion.m')      % siete tests, termina con error si alguno falla
```

Todos los parámetros de entrada están agrupados en [`ParametrosPorDefecto.m`](GeneradorDeElementos/ParametrosPorDefecto.m). Los que dependen de investigación pendiente (disponibilidad de rodamientos en Argentina, tolerancia de la impresora) están marcados como **SIN CERRAR** ahí mismo.

## 2. Arquitectura

| Archivo | Rol |
|---|---|
| `ParametrosPorDefecto` | bloque único de parámetros de entrada |
| `EstadoInicial` | contrato de `Estado`, documentado en el encabezado |
| `DerivadaDeVia`, `PasoRK4`, `IntegrarTramo` | integración RK4 del sistema vía + energía |
| `PuntoCinematico` | campos geométricos de un punto, sin evaluar curvatura |
| `MarcoCarroDesdeTransporte`, `MarcoTransporteDesdeCarro`, `Ortonormalizar` | marco de Bishop y marco del carro |
| `CurvaturaDelModo` | los cuatro modos de curvatura |
| `PerfilRollQuintico` | smoothstep quíntico del roll |
| `CargasEnLaVia`, `ResistenciaAlAvance` | dinámica: normales por juego de ruedas y arrastre |
| `GenerarLoopVertical` | núcleo de generación, con los sub-tramos |
| `ResolverMetodoA`, `ResolverMetodoB`, `CompararMetodos` | los dos métodos de acoplamiento |
| `SimularSobreTrack` | estado dinámico sobre geometría congelada |
| `ChequeosPrevios`, `ChequeosPosteriores`, `DistanciaMinimaEntrePolilineas` | factibilidad |
| `LimiteNormativo`, `LimitePorPunto`, `VerificarLimitesNormativos` | ASTM F2291 |
| `EscalasDeFroude` | escalado del modelo distorsionado |
| `ElementoLoopVertical`, `ReportarElemento`, `GraficarElemento` | API del elemento y salidas |
| `Layout*` | alta, deshacer, guardar, cargar y re-simular el layout |

### Separación Track / Sim

`Track` es geometría y no cambia. `Sim` es el estado dinámico y se recalcula sobre una geometría dada. Si cambia la velocidad de lanzamiento, la vía ya fabricada sigue siendo la misma: `LayoutResimular` recalcula toda la dinámica sin regenerar nada, y avisa cuando la velocidad de entrada se aparta de `Track.VelocidadDeDiseno` más que la tolerancia.

### Contrato de estado entre elementos

```matlab
[EstadoSalida, Elemento, Reporte] = ElementoLoopVertical(EstadoEntrada, Parametros, Layout)
```

`Estado` lleva posición, los tres versores del marco del carro, el vector curvatura y su derivada, el roll con sus dos derivadas, la longitud acumulada, la velocidad y la energía. El roll se mide **contra el marco de transporte paralelo**, de modo que el `Estado` no necesita arrastrar además ese marco: se recupera rotando el marco del carro por $-\phi$.

## 3. Marco de referencia

No se usa Frenet-Serret. Se integra directamente el **marco de transporte paralelo (Bishop)**:

$$\frac{d\mathbf{T}}{ds} = \kappa_U\mathbf{U}_{pt} + \kappa_L\mathbf{L}_{pt}, \qquad \frac{d\mathbf{U}_{pt}}{ds} = -\kappa_U\mathbf{T}, \qquad \frac{d\mathbf{L}_{pt}}{ds} = -\kappa_L\mathbf{T}$$

Por construcción no tiene rotación alrededor de $\mathbf{T}$, así que queda definido donde la curvatura es nula y no salta 180° en las inflexiones. El marco del carro se arma encima con el roll explícito, y se reortonormaliza por Gram-Schmidt cada `PasosEntreOrtonormalizaciones`.

**Consistencia útil:** en una curva plana el transporte paralelo coincide con la normal en el plano, y el ángulo $\beta$ entre el marco de transporte y esa normal es constante. Por eso la curvatura del loop se reparte con un $\cos\beta$ y un $\sin\beta$ calculados una sola vez.

## 4. Sub-tramos

| Sub-tramo | Qué hace | Cuándo aparece |
|---|---|---|
| `AcondicionamientoEntrada` | lleva a cero la curvatura fuera del plano del loop y el roll al que el loop necesita | sólo si hace falta |
| `ClotoideEntrada` | rampa lineal de curvatura desde $\kappa_0$ hasta la que pide el modo | siempre |
| `ArcoLoop` | curvatura según el modo elegido | siempre |
| `ClotoideSalida` | rampa de curvatura de vuelta a cero | siempre |

Quedan demarcados por índice de nodo en `Track.SubTramos(k).IndiceInicio/IndiceFin`, se listan en el reporte con su rango de arco, y se distinguen por color en los gráficos.

La clotoide de entrada arranca en la curvatura que traiga el estado de entrada (**clotoide desplazada**), no en cero. Se implementa como una mezcla lineal entre $\kappa_0$ y la curvatura del modo; con el modo `Clotoide` la curvatura objetivo es constante y la mezcla es exactamente una clotoide ($d\kappa/ds$ constante).

### El loop no es plano

**Un giro de $2\pi$ contenido en un plano vuelve a pasar por donde entró.** No hay forma de evitarlo: la vía se choca consigo misma siempre. Por eso el elemento tiene una **inclinación helicoidal** y `DesplazamientoLateralLoop` no es opcional.

La construcción es una hélice de eje horizontal $\mathbf{B}$: se pide que la tangente mantenga $\mathbf{T}\cdot\mathbf{B} = \sin\alpha$ constante. Eso obliga a que el vector curvatura no tenga componente sobre $\mathbf{B}$, y de esa condición sale

$$\tau = \kappa\,\tan\alpha$$

o sea que la dirección de la curvatura tiene que girar dentro del marco de transporte **proporcionalmente al ángulo ya girado**, no al arco recorrido. La diferencia importa: con torsión constante el desplazamiento lateral deja de ser monótono en cuanto $\kappa$ varía —el loop se va para un lado y vuelve— y se sigue chocando. Con $\tau = \kappa\tan\alpha$ el desplazamiento vale exactamente $\sin\alpha \cdot L$ y es monótono por construcción.

Tres consecuencias que sirven de verificación:

1. **La tangente de salida es idéntica a la de entrada.** El elemento no cambia el rumbo: sólo desplaza la vía lateralmente.
2. **El carro sale derecho.** El número del roll no termina en cero (avanza con $\tan\alpha$ veces el giro), pero eso no es un peralte agregado: el roll se mide contra el marco de transporte, que gira respecto de la normal de la curva justamente a razón de la torsión. Seguir esa razón es mantener el eje "arriba" del carro alineado con el vector curvatura.
3. **La tangente gira $2\pi\cos\alpha$, no $2\pi$.** Recorre un círculo de radio $\cos\alpha$ sobre la esfera unitaria. El test 7 lo verifica.

$\alpha$ no se pide directamente: se pide el desplazamiento lateral y el generador lo resuelve con un paso de Newton, usando la longitud del loop como pendiente. El valor por defecto sale de la envolvente de la vía, de modo que siempre supere la separación exigida por el chequeo de interferencia.

### Cierre del loop

El arco se corta cuando el ángulo ya girado más lo que va a girar la clotoide de salida llega a $2\pi$. Dos detalles importantes:

1. **El último paso del arco se acorta** para caer justo en el ángulo objetivo. Sin eso el corte queda cuantizado por el paso y el residual de cierre no puede bajar de $\kappa\,\Delta s$ — con $\kappa = 4.8$ y $\Delta s = 2$ mm eso son $10^{-2}$ rad.
2. La predicción del giro de la clotoide de salida no es exacta cuando la curvatura depende de $v$, así que el residual se **corrige por secante** y se **reporta siempre**. Nunca se asume cero.

## 5. Los cuatro modos de curvatura

| Modo | $\kappa$ | ¿Depende de $v$? |
|---|---|---|
| `AceleracionNormalConstante` | $a_n / v^2$ | sí |
| `Clotoide` | $1/R_{loop}$ (constante en el arco) | no |
| `FuerzaGConstante` | $g\,(G_{obj} - U_z)/v^2$ | sí |
| `GMaximas` | $g\,(G_{lim}(\text{duración}) - U_z)/v^2$ | sí |

$U_z$ es la componente vertical del versor "arriba del carro", que en un loop plano vale $\cos\theta$. En la cúspide vale $-1$ y ahí $v$ es mínima, así que $\kappa$ es máxima: de ahí sale la **forma de lágrima** del loop clotoide real. Con el modo `Clotoide` sale un círculo, que es lo correcto para ese modo.

El modo `GMaximas` sigue el tiempo de exposición desde el comienzo del arco, lo convierte a duración equivalente del prototipo multiplicando por $\sqrt\lambda$ y evalúa la curva límite ahí. La interfaz está completa; la lógica de seguimiento de exposición es la simplificación de tratar el arco como un único evento sostenido.

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

## 7. Presupuesto de onset y longitudes de transición

$$L_{trans} = \frac{\Delta G\,v}{J_{max}} = \frac{v^3\,|\Delta\kappa|}{g\,J_{max}}$$

Las dos formas son la misma relación escrita al revés. El presupuesto del modelo sale de multiplicar el de la norma por $\sqrt{\lambda_{loop}}$: un modelo fiel a Froude produce jerk **mayor** que el prototipo, no menor.

La transición de roll se dimensiona por el onset lateral que produce la heartline. Con el smoothstep quíntico $\max|\phi'''| = 60|\Delta\phi|/L^3$, y la G lateral vale $d\,v^2\phi''/g$, así que:

$$L_{roll} = \left(\frac{60\,d\,v^3\,|\Delta\phi|}{g\,J_{y,max}}\right)^{1/3}$$

**La fórmula supone $v$ constante dentro de la transición y por eso el onset resultante se pasa alrededor de un 1.5 %.** El generador cierra ese hueco con un punto fijo sobre un factor de longitud, y el reporte informa el margen que quedó. El punto fijo es sobre el factor y no un corte al primer valor que cumple: cortar por cumplimiento haría que la geometría dependiera de forma **discontinua** de los datos de entrada, y ahí los dos métodos dejan de coincidir aunque los dos estén bien.

Las longitudes de transición se dimensionan con la **velocidad real de la marcha**, no con el perfil supuesto del método B. Son decisiones geométricas de diseño; lo que el perfil supuesto rompe es el lazo de la *ley de curvatura*.

## 8. Chequeos de factibilidad

Están separados en dos grupos, y la separación es deliberada:

- **`ChequeosPrevios`** — dependen sólo del estado de entrada y de los parámetros: tangente no vertical, pitch de entrada, curvatura dentro y fuera del plano, compatibilidad de roll, estimación energética a priori, altura y radio nominales.
- **`ChequeosPosteriores`** — necesitan la geometría: radio alcanzado, altura real, suelo, bounding box, interferencia y límites normativos.

La consigna pide que los chequeos corran "antes de generar". Los del segundo grupo **no se pueden evaluar sin la geometría**, y la velocidad mínima por bisección requiere generar decenas de veces. Se declara la distinción en vez de fingir lo contrario.

### Interferencia

Distancia mínima **segmento a segmento** entre polilíneas: punto a punto subestima el acercamiento, porque dos vías que se cruzan pueden tener todos sus nodos lejos y aun así tocarse entre nodos. Tres chequeos: autointerferencia (excluyendo pares vecinos por longitud de arco), contra la vía preexistente del layout, y suelo.

La envolvente **no es un ancho escalar**: es una sección orientada que rota con el roll. Se usa la simplificación conservadora del cilindro circunscripto para el criterio de pasa/no pasa, y además se reporta la separación que exigiría la sección orientada en el par crítico, calculada con la función soporte de la caja.

### Velocidad inicial mínima

Por bisección, con criterio combinado de G mínima sobre el eje vertical del carro **y** radio mínimo fabricable. El criterio no es $N = 0$: con ruedas de retención el carro no se cae, pero un margen nulo no tolera variación de fricción ni de temperatura. El radio entra al criterio porque en los modos que fijan la G objetivo la geometría se adapta a la velocidad y la G en la cúspide no cambia, así que la restricción que termina mordiendo es de fabricación y no energética.

## 9. Límites normativos

Cada curva de las Figs. 6 a 10 está implementada como interpolación lineal por tramos $G_{lim} = f(\text{duración})$. El límite **no es puntual**: para cada nivel $G^*$ se mide la duración del evento sostenido en que $G \geq G^*$ y se evalúa la curva ahí. Las duraciones del modelo se multiplican por $\sqrt{\lambda_{loop}}$ antes de entrar a las curvas, y los eventos de menos de 200 ms se descartan (§7.1.4.2).

También se verifican la elipse de dos ejes de §7.1.5.1 — con el semieje del signo correcto en cada eje, porque $+G_z$ admite 6 G y $-G_z$ sólo 2 — y el onset de §7.1.7.2, evaluado con su **alcance literal**: sólo transiciones desde 0 G o menos hacia 2 G o más.

Los gráficos de G llevan la banda de límite superpuesta, evaluada punto a punto con la duración del evento sostenido que contiene a cada nodo. Una curva desnuda no dice si el diseño pasa o no.

## 10. Escalado

`RadioLoop` y `LargoCarro` son parámetros **independientes** y cada uno tiene su propio $\lambda$. No hay ningún $\lambda$ único cableado. Se reporta la distorsión $\lambda_{carro}/\lambda_{loop}$ y el equivalente en carros reales.

## 11. Tests de validación

Los siete son ejecutables y `TestsValidacion.m` termina con error si alguno falla.

| # | Test | Resultado típico |
|---|---|---|
| 1 | Conservación de energía sin pérdidas contra $v^2 = v_0^2 - 2gh$ | error relativo $6\times10^{-9}$ |
| 2 | Curvatura impuesta contra recuperada de la polilínea | error relativo $2\times10^{-5}$ |
| 3 | Residual del endpoint y desplazamiento lateral | tangente $8.8\times10^{-5}$, desplazamiento lateral dentro del 0.01 % del objetivo |
| 4 | Continuidad en el empalme | los tres saltos exactamente 0 |
| 5 | Equivalencia de métodos A y B en modo clotoide | diferencia exactamente 0 |
| 6 | Ortonormalidad del marco | desvío $8\times10^{-13}$ |
| 7 | Cierre del loop de 360° | pitch final $-6\times10^{-5}$ rad; ángulo girado dentro de $6\times10^{-5}$ rad de $2\pi\cos\alpha$ |

**Test 2 excluye los nodos cuyo esquema de tres puntos cruza una frontera de sub-tramo.** Ahí $d\kappa/ds$ salta y la circunferencia por tres puntos devuelve un promedio de dos curvaturas distintas: el error sube a $4.6\times10^{-3}$. Es una limitación del estimador discreto, no de la geometría generada — y es exactamente la fragilidad que ya documenta `documentacion_analisis_energia.md` en su sección 4.

**Test 3 no compara contra el punto de entrada.** Un loop con clotoides de entrada y salida de distinta longitud no vuelve a su propio arranque. Lo que sí tiene que cerrar es la dirección de la tangente tras la vuelta completa; el desplazamiento lateral tampoco es un residual sino el objetivo de diseño que evita la autointerferencia, así que se verifica contra el valor pedido.

## 12. Hallazgos de ingeniería

### 12.1 Un loop plano de 360° se cruza consigo mismo — resuelto

Antes de introducir la inclinación helicoidal, el chequeo de autointerferencia fallaba en **todos** los casos, con distancia mínima del orden de $10^{-19}$ m: la pata de salida cruzaba la de entrada. No era un error del chequeo —está validado contra casos de distancia conocida— ni de la geometría: es intrínseco a un giro de $2\pi$ dentro de un plano.

Está resuelto con la construcción helicoidal de la sección 4. Con el desplazamiento lateral por defecto (16 cm, derivado de la envolvente) el caso de la demo pasa el chequeo con 0.142 m de separación libre contra 0.133 m exigidos, y **ningún criterio queda en falla**.

El costo es un ángulo de hélice de unos 7–8°, que es del mismo orden que el de un loop comercial. La inclinación es un parámetro reportado, no un número escondido.

### 12.2 Un loop circular no puede cumplir las dos puntas a la vez

Sin pérdidas, para un loop circular de radio $R$ vale $v_{abajo}^2 = v_{arriba}^2 + 4gR$, y de ahí:

$$G_{abajo} = \frac{v_{abajo}^2}{gR} + 1 = \frac{v_{arriba}^2}{gR} - 1 + 6 = G_{arriba} + 6$$

**La diferencia es exactamente 6 G, independiente de $R$ y de $v$.** Con el criterio de $G_{arriba} \geq 0.5$ queda $G_{abajo} \geq 6.5$, por encima del límite de 6.0 G de la Fig. 10 aun en su punto más permisivo. Un loop circular no puede satisfacer los dos criterios simultáneamente: por eso los loops reales son clotoides. El modo `FuerzaGConstante` resuelve el problema y produce la forma de lágrima característica.

### 12.3 `RadioLoop` es una entrada que en tres de los cuatro modos describe una salida

`RadioLoop` es la longitud característica de Froude: fija $\lambda_{loop}$ y con él el presupuesto de onset y la conversión de duraciones contra las curvas normativas. Pero en los modos que dependen de $v$ el radio de cúspide **sale** de la integración. Si el nominal y el alcanzado se apartan, esos dos números se calcularon con la longitud de referencia equivocada. Hay un chequeo posterior que lo detecta y avisa.

## 13. Discrepancias con la consigna

| Punto | Qué dice la consigna | Qué se implementó y por qué |
|---|---|---|
| Carros equivalentes | `CarrosEquivalentes = NumeroDeCarros * distorsion` | `NumeroDeCarros / distorsion`. Con carro de 10 cm y loop de 50 cm la memoria de cálculo (§9.6) da 2.3 carros reales; la fórmula de la consigna da 0.44. Un carro del modelo escalado por $\lambda_{loop}$ representa un largo $L\lambda_{loop}$, que dividido por el carro real $L\lambda_{carro}$ da $\lambda_{loop}/\lambda_{carro} = 1/\text{distorsión}$ |
| Equivalencia A/B en modo clotoide | "idénticos salvo error de máquina, porque en ese modo $\kappa$ no depende de $v$" | Cierto para $\kappa$, pero las **longitudes de las clotoides sí dependen de $v$**, porque salen del presupuesto de onset. Se resolvió dimensionándolas con la velocidad real de la marcha en vez del perfil supuesto, y entonces sí son idénticas bit a bit |
| Chequeos "antes de generar" | todos los chequeos corren antes de construir la geometría | Los de interferencia, radio real, altura alcanzada y límites normativos necesitan la geometría; la velocidad mínima por bisección necesita generar decenas de veces. Se separaron en `ChequeosPrevios` y `ChequeosPosteriores` |

## 14. Limitación abierta: el término de curvatura de la heartline

Las fórmulas de heartline implementadas son las de la consigna, que son las de la memoria de cálculo §3.5:

$$a_{L,heartline} = d\,(a_t\phi' + v^2\phi''), \qquad a_{U,heartline} = -d\,v^2\phi'^2$$

Las dos salen de tomar $\boldsymbol\omega \approx \Omega_T\mathbf{T}$ (memoria §3.4), es decir, de quedarse **sólo con la rotación de roll**. La transferencia completa de cuerpo rígido incluye además la rotación que impone la curvatura, $\Omega_L = \kappa v$ alrededor de $\mathbf{L}$, cuyo término centrípeto vale:

$$\boldsymbol\omega\times(\boldsymbol\omega\times d\,\mathbf{U}) = -(\kappa v)^2 d\;\mathbf{U} \quad\Longrightarrow\quad G_{z,heartline} = \frac{v^2\kappa}{g}\,(1 - \kappa d) + U_z$$

que es simplemente decir que el pasajero gira a radio $R - d$ y no a radio $R$.

**A la escala de este modelo el término no es chico.** En el caso de la demo, $\kappa_{max} = 9.4$ m⁻¹ y $d = 3$ cm, o sea $\kappa d = 0.28$: el pasajero de la heartline siente un **28 % menos** de aceleración centrípeta que el riel en la cúspide. En una atracción real $d/R \approx 1.1/8 = 0.14$, que tampoco es despreciable — precisamente por eso existe el heartlining.

**No lo implementé porque la consigna especifica las otras dos fórmulas y la memoria declara la aproximación explícitamente.** Es una decisión que conviene tomar antes de usar los números contra la norma: hoy las G que se comparan contra las curvas de F2291 son conservadoras en el eje vertical (sobreestiman lo que sentiría el pasajero) por ese 28 %.

## 15. Otras limitaciones y próximos pasos

- **§7.1.7.1 simplificada.** Si aparece un evento de $-G_z$ de más de 3 s, se aplica la columna reducida de $+G_z$ a todo el elemento en vez de arrastrar el reloj de los 6 s. Es conservador y evita que el reloj cruce entre elementos.
- **Modelo de partícula.** El tren se trata como un punto. Con $N$ carros la velocidad es común y la altura relevante es la del conjunto; la arquitectura está preparada para $N$ pero el reparto no está.
- **Reparto entre juegos de ruedas.** Ya se hace correctamente proyectando la normal sobre $\mathbf{U}$ y $\mathbf{L}$ del marco del carro, pero los tres $C_{rr}$ y el $C_d$ siguen siendo provisorios y **requieren calibración experimental**.
- **Modo inverso**, elemento conector y tren de $N$ carros quedan fuera de alcance, igual que el backend web.
- **Modo `GMaximas`**: la interfaz está completa pero el seguimiento de duración de exposición trata el arco como un único evento sostenido.
