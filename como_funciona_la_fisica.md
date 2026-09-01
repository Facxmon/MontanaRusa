# Cómo funciona la física del generador (guía de orientación)

Este documento no es una memoria de cálculo nueva — es un mapa de lectura de la que ya existe, pensado para volver a agarrar el hilo después de muchos cambios. Cubre cinco preguntas concretas:

1. [Cómo se pierde energía](#1-cómo-se-pierde-energía)
2. [Cómo se calcula la fuerza de roce](#2-cómo-se-calcula-la-fuerza-de-roce)
3. [Cómo varía el radio del loop, y en qué se basa](#3-cómo-varía-el-radio-del-loop-y-en-qué-se-basa)
4. [Cómo se forma una hélice en vez de un loop plano](#4-cómo-se-forma-una-hélice-en-vez-de-un-loop-plano)
5. [Cómo se calculan las fuerzas en los ejes del carro](#5-cómo-se-calculan-las-fuerzas-en-los-ejes-del-carro)

Cada sección apunta al archivo `.m` real donde vive esa cuenta. Si algo de acá no coincide con el código, manda el código — este documento se puede desactualizar, el código no.

> **Documentos hermanos:** [`memoria_de_calculo.md`](memoria_de_calculo.md) tiene los criterios de diseño normativos y las justificaciones formales; [`documentacion_generador_elementos.md`](documentacion_generador_elementos.md) documenta el generador completo, elemento por elemento. Este documento es más chico: solo las cinco cuentas de físicas del núcleo, explicadas para releer rápido.

---

## 1. Cómo se pierde energía

**Idea intuitiva:** en vez de calcular fuerza → aceleración → velocidad → posición como se haría con Newton "a mano", el programa integra directamente la **energía**. En cada metro de vía se pregunta: "¿cuánta energía cinética le queda al carro después de perder altura (o ganarla) y después de que el roce se la coma?"

**La ecuación madre**, en [`SimularSobreTrack.m`](GeneradorDeElementos/Fisica/SimularSobreTrack.m) y su gemela [`DerivadaDeVia.m`](GeneradorDeElementos/Nucleo/DerivadaDeVia.m):

$$\frac{d(v^2)}{ds} = -2g\,T_z - \frac{2F_{resistencia}}{m}$$

Donde:
- $v$ es la velocidad del carro, $s$ es la distancia recorrida sobre el riel (no el tiempo).
- $T_z$ es la componente vertical del versor tangente a la vía — en criollo, "qué tan empinada está la vía en ese punto" (subiendo, $T_z>0$, frena; bajando, $T_z<0$, acelera).
- $F_{resistencia}$ es rodadura + arrastre (sección 2).

> **¿Por qué en $v^2$ y no en $v$?** Porque así la ecuación queda lineal en la variable de estado, y se evita dividir por $v$ en algún paso intermedio — division que sería peligrosa cerca de la cúspide de un loop, donde la velocidad puede ser chica.

Esto se integra numéricamente con **Runge-Kutta de orden 4 (RK4)**, en pasos de longitud `Parametros.PasoGeneracion` a lo largo del arco. El tiempo transcurrido sale de la misma integración, agregando una variable de estado extra ($dt/ds = 1/v$).

**La energía disipada** que después se grafica es literalmente la acumulación del trabajo de esa fuerza de resistencia:

$$E_{rodadura}(s) = \sum F_{rodadura} \cdot \Delta s \qquad\qquad E_{arrastre}(s) = \sum F_{arrastre} \cdot \Delta s$$

(ver [`SimularSobreTrack.m:75-76`](GeneradorDeElementos/Fisica/SimularSobreTrack.m)). Como chequeo de sanidad, en todo punto debería cumplirse:

$$\underbrace{\tfrac12 m v^2}_{E_{cinética}} + \underbrace{mgz}_{E_{potencial}} + E_{rodadura} + E_{arrastre} = E_{total,\,inicial}$$

Si ese balance no cierra, hay un bug — no un efecto físico nuevo.

---

## 2. Cómo se calcula la fuerza de roce

Vive en [`ResistenciaAlAvance.m`](GeneradorDeElementos/Fisica/ResistenciaAlAvance.m). Son **dos fenómenos distintos** sumados.

### 2.1 Rodadura (roce de las ruedas contra el riel)

Una montaña rusa tiene tres juegos de ruedas, y cada uno roza distinto porque cada uno apoya sobre una carga distinta:

| Juego de ruedas | Cuándo trabaja | Carga que soporta |
|---|---|---|
| **Portantes** | el carro empuja "hacia abajo" contra el riel (caso normal) | $\max(G_{arriba}, 0)\cdot Peso$ |
| **Retención** *(up-stop)* | el carro "cuelga" del riel — típico en la cúspide de un loop | $\max(-G_{arriba}, 0)\cdot Peso$ |
| **Guía** | el carro empuja hacia un costado (curvas horizontales, roll) | $\lvert G_{lateral}\rvert \cdot Peso$ |

$G_{arriba}$ y $G_{lateral}$ son las G netas sobre esos ejes del carro — se calculan en la sección 5, y **la rodadura las necesita como insumo**. Cada juego tiene su propio coeficiente de roce ($C_{rr}$), porque son ruedas físicamente distintas:

$$F_{rodadura} = C_{rr,portantes}\cdot Carga_{portantes} + C_{rr,retención}\cdot Carga_{retención} + C_{rr,guía}\cdot Carga_{guía}$$

### 2.2 Arrastre aerodinámico

El clásico de fluidos:

$$F_{arrastre} = \tfrac12\,\rho_{aire}\,C_d\,A_{efectiva}\,v^2$$

$A_{efectiva}$ agranda el área frontal según cuántos carros tiene el tren — cada carro detrás del primero aporta solo una fracción (`FactorTren`) del área, como una estela que "protege" al que viene atrás:

$$A_{efectiva} = A_{frontal}\cdot\big(1 + FactorTren\cdot(N_{carros}-1)\big)$$

### 2.3 Total

$$F_{resistencia} = F_{rodadura} + F_{arrastre}$$

Esta es la $F_{resistencia}$ que aparece en la ecuación de energía de la sección 1.

---

## 3. Cómo varía el radio del loop, y en qué se basa

Acá está la clave de por qué el loop **no es un círculo**. Vive en [`CurvaturaDelModo.m`](GeneradorDeElementos/Fisica/CurvaturaDelModo.m).

La curvatura objetivo $\kappa = 1/R$ (radio chico → curvatura grande → curva cerrada) se recalcula **en cada paso de la integración**, según uno de cuatro modos elegibles. Tres de los cuatro dependen de la velocidad instantánea — y ahí está el acoplamiento entre geometría y dinámica que obliga a resolver el problema con dos métodos (no es un detalle menor, está señalado en el propio código).

| Modo | Fórmula | Idea |
|---|---|---|
| `Clotoide` | $\kappa = 1/R_{loop}$ (constante) | Círculo puro — caso de referencia/debug |
| `AceleracionNormalConstante` | $\kappa = a_{objetivo}/v^2$ | Mantiene fija la aceleración centrípeta |
| `FuerzaGConstante` | $\kappa = g\,(G_{objetivo} - U_z)/v^2$ | Mantiene fija la G **sobre el eje del carro**, no del laboratorio |
| `GMaximas` | igual al anterior pero $G_{objetivo}$ sale de una curva normativa que depende del tiempo | Respeta un límite tipo ASTM en función de cuánto tiempo lleva el pasajero sometido a esa G |

Los modos 3 y 4 son los que realmente se usan para loops "de verdad", y valen la pena entender por qué dan la forma de lágrima:

> En un loop plano, la componente vertical del versor "arriba del carro" es $U_z = \cos\theta$, con $\theta$ el ángulo ya recorrido. En la base del loop, $U_z=1$; en la cúspide, $U_z=-1$.
>
> Al mismo tiempo, la velocidad es **mínima** justo en la cúspide (ahí el carro tiene más altura y por lo tanto menos energía cinética disponible, sección 1).
>
> En la fórmula $\kappa = g(G_{objetivo}-U_z)/v^2$, en la cúspide el numerador es máximo ($G_{objetivo}-(-1)$) y el denominador es mínimo ($v^2$ chico) — los dos efectos empujan la curvatura hacia arriba **al mismo tiempo**. Resultado: el radio se cierra mucho arriba y se abre abajo. Esa es la forma de lágrima (clotoide) de un loop real, y es la razón por la que si te sale un círculo con estos modos, hay un error en algún lado.

Nota: la curvatura se recorta a $\kappa \geq 0$ siempre — el loop nunca invierte el sentido de giro.

---

## 4. Cómo se forma una hélice en vez de un loop plano

Esto ocurre en dos capas independientes que se combinan. Los archivos clave son [`DerivadaDeVia.m`](GeneradorDeElementos/Nucleo/DerivadaDeVia.m), [`MarcoCarroDesdeTransporte.m`](GeneradorDeElementos/Nucleo/MarcoCarroDesdeTransporte.m), [`PuntoCinematico.m`](GeneradorDeElementos/Nucleo/PuntoCinematico.m) y [`PerfilRollQuintico.m`](GeneradorDeElementos/Nucleo/PerfilRollQuintico.m).

### 4.1 Capa 1 — el marco de referencia (transporte paralelo)

La geometría de la vía **no** se integra con el marco de Frenet-Serret clásico (el que usa curvatura + torsión + binormal), porque ese marco se rompe donde la curvatura pasa por cero — típico en inflexiones. En su lugar se usa un **marco de transporte paralelo (Bishop frame)**:

$$\frac{dT}{ds} = \kappa_U\, U_{transporte} + \kappa_L\, L_{transporte} \qquad
\frac{dU_{transporte}}{ds} = -\kappa_U\, T \qquad
\frac{dL_{transporte}}{ds} = -\kappa_L\, T$$

Por construcción, este marco **no gira alrededor de la tangente** $T$ — es "neutro". Si toda la curvatura estuviera en $\kappa_U$ (arriba) y $\kappa_L$ (lateral) fuera siempre cero, este marco solo ya te daría una curva perfectamente plana.

### 4.2 Capa 2 — el roll, atado al ángulo ya girado

Encima de ese marco neutro se aplica una rotación de **roll** explícita (giro del carro sobre su propio eje longitudinal):

$$U_{carro} = \cos\varphi\; U_{transporte} + \sin\varphi\; L_{transporte} \qquad
L_{carro} = -\sin\varphi\; U_{transporte} + \cos\varphi\; L_{transporte}$$

Acá está el truco de la hélice ([`PuntoCinematico.m`](GeneradorDeElementos/Nucleo/PuntoCinematico.m) y [`DerivadaDeVia.m`](GeneradorDeElementos/Nucleo/DerivadaDeVia.m)): el ángulo de roll $\varphi$ no depende solo de la distancia recorrida $s$, sino que además crece con el **ángulo que ya giró la tangente**:

$$\frac{d\varphi}{ds} = \kappa \cdot \tan(\alpha)$$

donde $\alpha$ es la `InclinacionHelicoidal` (parámetro de diseño) y $\kappa$ es la curvatura total del punto 3.

> **En criollo:** por cada radián que la trayectoria gira alrededor del loop, el carro rota un poquito más sobre su propio eje. Con $\alpha=0$ (loop plano), después de una vuelta completa ($2\pi$ radianes girados) el marco vuelve exactamente a como empezó — cierra sobre sí mismo, sin desplazamiento. Con $\alpha\neq0$, después de esa misma vuelta el carro ya rotó un ángulo extra proporcional a $\alpha$: el "plano" del loop ya no coincide consigo mismo al cerrar el círculo, se corre — como una rosca de tornillo. Eso, repetido vuelta tras vuelta, es la hélice.

### 4.3 La transición entre tramos de roll distinto

Cuando el diseño pide pasar de un roll a otro (por ejemplo, entrar con roll 0° y salir con roll 180°), esa transición usa un **smoothstep quíntico** ([`PerfilRollQuintico.m`](GeneradorDeElementos/Nucleo/PerfilRollQuintico.m)):

$$\varphi(u) = \varphi_0 + \Delta\varphi\,(6u^5 - 15u^4 + 10u^3), \qquad u = \frac{s}{L_{transición}}$$

Se eligió esta curva (y no una rampa lineal, ni un coseno) porque cumple $\varphi'(0)=\varphi'(1)=0$ **y también** $\varphi''(0)=\varphi''(1)=0$ — es decir, empalma con continuidad $C^2$ (posición, velocidad angular *y* aceleración angular) contra los tramos de roll constante a los costados.

> **¿Por qué importa la continuidad $C^2$ y no solo $C^1$?** Porque, como se ve en la sección 5, la G lateral que siente el pasajero depende de $\varphi''$ (la aceleración de roll). Un perfil que solo fuera $C^1$ (como una rampa coseno) tendría un salto instantáneo en $\varphi''$ en los extremos de la transición — y ese salto se sentiría como un golpe brusco de G lateral, no como algo suave.

---

## 5. Cómo se calculan las fuerzas en los ejes del carro

Esto se arma en dos etapas: primero la G "cruda" que da la geometría del riel, después una corrección fina por el roll.

### 5.1 Etapa base — G sobre el riel

En [`CargasEnLaVia.m`](GeneradorDeElementos/Fisica/CargasEnLaVia.m). La física de base: la aceleración específica que siente el carro (lo que marcaría un acelerómetro) es

$$\vec f = \vec a - \vec g$$

donde $\vec a = v^2 \cdot \vec\kappa$ es la aceleración centrípeta (curvatura vectorial por velocidad al cuadrado). Proyectando esa $\vec f$ sobre los ejes "arriba" y "lateral" del carro, y dividiendo por $g$ para expresarlo en G:

$$G_{arriba} = \frac{v^2(\vec\kappa \cdot U_{carro})}{g} + U_{carro,z} \qquad\qquad G_{lateral} = \frac{v^2(\vec\kappa \cdot L_{carro})}{g} + L_{carro,z}$$

El término $+\,eje_z$ es literalmente la gravedad proyectada sobre ese eje. Es por eso que un carro **parado** en riel horizontal marca 1G — no 0G — tal como lo exige la norma ASTM F2291 §7.1.4.5 (citada en el propio código).

### 5.2 Etapa fina — corrección por heartline y roll

En [`SimularSobreTrack.m:83-93`](GeneradorDeElementos/Fisica/SimularSobreTrack.m). El asiento del pasajero no está exactamente sobre la línea que se integra (la **heartline**, línea imaginaria a la altura del pecho/corazón del pasajero) — está desplazado una distancia `DistanciaHeartline`. Si el carro está rotando en roll, ese desplazamiento actúa como un brazo de palanca girando, y agrega aceleración extra:

$$Aporte_{lateral} = \frac{D\,(a_{tangencial}\,\varphi' + v^2\,\varphi'')}{g} \qquad\qquad Aporte_{vertical} = -\frac{D\,v^2\,(\varphi')^2}{g}$$

Acá aparece el $\varphi''$ que motivaba la continuidad $C^2$ del punto 4.3.

### 5.3 Los tres ejes finales

$$G_x = \frac{a_{tangencial}}{g} + T_z \qquad\text{(longitudinal — avance/frenado y efecto de la pendiente)}$$

$$G_y = G_{lateral} + Aporte_{lateral} \qquad\text{(lateral — empuje hacia los costados)}$$

$$G_z = G_{arriba} + Aporte_{vertical} \qquad\text{(vertical del carro — el eje del asiento)}$$

Donde $a_{tangencial}$ es la misma aceleración tangencial de la ecuación de energía de la sección 1:

$$a_{tangencial} = -g\,T_z - \frac{F_{resistencia}}{m}$$

---

## Resumen de una línea por pregunta

| Pregunta | Respuesta corta |
|---|---|
| Pérdida de energía | Se integra $d(v^2)/ds$ con RK4; la pérdida es el trabajo acumulado de rodadura + arrastre |
| Fuerza de roce | Rodadura (tres juegos de ruedas, cada uno con su carga y su $C_{rr}$) + arrastre aerodinámico ($\tfrac12\rho C_d A v^2$) |
| Radio variable | La curvatura target depende de $v^2$ en la mayoría de los modos → se cierra donde el carro va lento (cúspide) y se abre donde va rápido |
| Hélice vs. loop plano | Marco de transporte paralelo (neutro) + roll que crece con el ángulo ya girado ($d\varphi/ds = \kappa\tan\alpha$) → el plano del loop no cierra sobre sí mismo |
| Fuerzas en los ejes | G del riel (curvatura + gravedad proyectadas) + corrección por heartline-roll ($\propto \varphi', \varphi''$) |
