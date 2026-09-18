# Nomenclatura — tabla maestra de símbolos y variables

Tabla única de referencia para los tres documentos del repo: [`memoria_de_calculo.md`](memoria_de_calculo.md),
[`documentacion_generador_elementos.md`](documentacion_generador_elementos.md) y
[`documentacion_analisis_energia.md`](documentacion_analisis_energia.md). Si un símbolo aparece en cualquiera de
los tres, tiene que tener una fila acá. Ver [`README.md`](README.md) para el mapa de lectura general del repo.

Convención de esta tabla: **Símbolo** es el LaTeX tal como aparece en los documentos; **Nombre en código** es el
identificador MATLAB exacto (o `—` si el símbolo es puramente matemático); **Definido en** apunta a la sección
donde se deriva o se introduce por primera vez.

## 0. Colisiones resueltas

Antes de leer las tablas: nueve símbolos se usaban para dos o tres cosas distintas en los documentos originales.
Esta es la desambiguación adoptada; se aplica en todo el texto reescrito.

| # | Símbolo en colisión | Qué se hizo |
|---|---|---|
| 1 | `d` | Se conserva **d** exclusivamente para el offset **riel → heartline** (centro de masa del pasajero). La distancia de discretización de `analisis_energia.m` pasa a llamarse **δ** (`DistanciaDeDiscretizacion`). El offset **heartline → cabeza**, que es una magnitud distinta y no hay que colapsar con $d$, se nota **e** (`DistanciaHeartlineACabeza`); el brazo con el que se verifica la norma se nota **b** (`BrazoDeVerificacion`, igual a $d$ o a $d+e$). |
| 2 | `t` | Se conserva **t** exclusivamente para tiempo. El parámetro libre de la curva paramétrica de `analisis_energia.m` pasa a llamarse **p**, con $p\in[p_{min},p_{max}]$ (código: `TMin`, `TMax` — el nombre de código no cambia, sólo el símbolo). |
| 3 | `L` | **L** a secas queda reservada para la longitud característica genérica de Froude ($Fr=v/\sqrt{gL}$), uso abstracto. En todo uso concreto se exige subíndice: $L_{trans}$ (longitud de transición), $L_{carro}$ (largo del carro, código `LargoCarro`), $L_{loop}$ / $R$ (radio del loop, ver colisión 8). |
| 4 | `T` | **T** (negrita) queda exclusivamente para el versor tangente. Los extremos del parámetro libre pasan a ser $p_{min}/p_{max}$ (ver colisión 2). El torque del rodamiento, que en una versión anterior de memoria §9.2 se notaba $T_{rodamiento}$ (símbolo LaTeX, no identificador de código — no existe como variable MATLAB), pasa a notarse $M_b$. |
| 5 | `α` | **α** queda exclusivamente para el ángulo de la hélice del loop. El vector aceleración angular de la transferencia de cuerpo rígido pasa a notarse $\dot{\boldsymbol\omega}$ (derivada de la velocidad angular, ya definida), en vez de introducir un símbolo nuevo. |
| 6 | `N` | La fuerza normal pasa a notarse $F_N$. `NumeroDeCarros` pasa a notarse $n_{carros}$. El versor normal de Frenet **N** conserva su símbolo porque su uso está confinado a memoria §2.1 (la sección que explica por qué Frenet *no* se usa en el resto del proyecto). |
| 7 | `G` | **G** queda exclusivamente para la fuerza G (múltiplos de $g$). La continuidad geométrica pasa a notarse $\mathcal{G}^n$ (script G), distinguible de $C^n$ (continuidad paramétrica) y de $G$ (fuerza). |
| 8 | `R` | **R** a secas queda reservado para el radio de curvatura de la vía (asociado a $\kappa=1/R$). El radio de rueda se escribe siempre con subíndice: $R_{rueda}$. |
| 9 | `g` / `G` (unidades de onset) | Se unifica a **G/s** en todo el texto propio. Donde se cita literalmente una tabla de la norma que usa minúscula ("5 g/s"), se conserva la grafía original de la cita con una nota aclarando que $g$ y $G$ denotan lo mismo: múltiplos de 9.81 m/s² (§7.1.4.1). |

---

## 1. Geometría y parametrización

| Símbolo | Nombre en código | Significado | Unidad | Definido en | Notas |
|---|---|---|---|---|---|
| $s$ | `Arco` / `LongitudAcumulada` | longitud de arco medida sobre la vía, parámetro natural de toda la discretización | m | memoria §1.3 | siempre creciente monótonamente |
| $\mathbf{r}(s)$ | `Track.PuntosRiel` / `Punto.Posicion` / `Estado.Posicion` | **riel**: la curva que integra el generador, unit-speed en $s$. Es a la vez curva de diseño, eje de roll y pieza física que se fabrica | m | memoria §3.1 | curva primaria: la heartline se deriva de ella, nunca al revés |
| $\mathbf{r}_h(s)$ | `Track.PuntosHeartline` | **heartline**: $\mathbf{r}+d\,\mathbf{U}$. Centro de masa del pasajero y punto de verificación por defecto | m | memoria §3.1 | salida derivada; sobre un riel recto que rola sale helicoidal |
| $\mathbf{p}(s)$ | — (se evalúa al vuelo) | **cabeza**: $\mathbf{r}+(d+e)\,\mathbf{U}$ | m | memoria §3.1 | G informativa (`Sim.GzCabeza`), o punto de verificación si `PuntoDeVerificacionNormativa = 'Cabeza'`; no confundir con el parámetro libre $p$ de energía §2 (colisión 2) |
| $\kappa_h$ | `Track.CurvaturaHeartline` | curvatura de la heartline, $\lvert\mathbf{r}'_h\times\mathbf{r}''_h\rvert/\lvert\mathbf{r}'_h\rvert^3$ derivando respecto del arco del riel | 1/m | generador §14.2 | **no** es igual a $\kappa$; en el loop $R_h=R_{riel}-d$ |
| $s_h$ | `Track.LongitudArcoHeartline` | longitud de arco medida sobre la heartline | m | generador §14.1 | distinta de $s$: la heartline no es unit-speed en $s$ |
| $J$ | `FactorVelocidadHeartline` | $\lVert d\mathbf{r}_h/ds\rVert = \sqrt{(1-d\kappa_u)^2+d^2\phi'^2}$ | — | memoria §3.6 | $v_{cm} = J\,v$; vale 1 en vía recta sin roll |
| $\mathbf{T}$ | `VersorTangente` | versor tangente a la vía, $d\mathbf{r}/ds$ | adimensional (versor unitario) | memoria §2.1 | colisión 4 resuelta |
| $\mathbf{U}_{pt}$ | `VersorArribaTransporte` | versor "arriba" del marco de transporte paralelo (Bishop) | adimensional | memoria §2.2 | no tiene giro propio alrededor de **T** |
| $\mathbf{L}_{pt}$ | `VersorLateralTransporte` | versor lateral del marco de transporte paralelo | adimensional | memoria §2.2 | $=\mathbf{T}\times\mathbf{U}_{pt}$ |
| $\mathbf{U}$ | `VersorArribaCarro` | versor "arriba" del marco del carro (transporte paralelo rotado por $\phi$) | adimensional | memoria §2.3 | $U_z$ es su componente vertical, ver bloque 2 |
| $\mathbf{L}$ | `VersorLateral` | versor lateral del marco del carro | adimensional | memoria §2.3 | $=\mathbf{T}\times\mathbf{U}$ |
| $\kappa$ | `Curvatura` | módulo del vector curvatura, $1/R$ | 1/m | memoria §1.1 | — |
| $\kappa_U$ | `CurvaturaArriba` | componente de la curvatura sobre $\mathbf{U}_{pt}$ | 1/m | generador §3 | — |
| $\kappa_L$ | `CurvaturaLateral` | componente de la curvatura sobre $\mathbf{L}_{pt}$ | 1/m | generador §3 | — |
| $\boldsymbol\kappa$ | `VectorCurvatura` | vector curvatura completo, $\kappa_U\mathbf{U}_{pt}+\kappa_L\mathbf{L}_{pt}$ | 1/m | generador §3 | dirección = normal, módulo = $\kappa$ |
| $\tau$ | — | torsión de la curva (propiedad geométrica, nivel $\mathcal{G}^3$) | 1/m | memoria §1.1, §4.1.4* (generador) | *en el generador aparece como $\tau=\kappa\tan\alpha$, ver bloque 6 |
| $R$ | `RadioDeGiro` / `1/Curvatura` | radio de curvatura de la vía | m | memoria §1.1 | colisión 8 resuelta; bare $R$ nunca es radio de rueda |
| $\beta$ | `Beta` | ángulo, en el plano de transporte, entre la normal del plano vertical de referencia y $\mathbf{U}_{pt}$; se mide con `atan2` sobre las proyecciones de la normal en ese plano sobre $\mathbf{U}_{pt}$ y $\mathbf{L}_{pt}$ | rad | generador §3 | constante en una curva plana; fija cómo se reparte $\kappa$ en $\cos\beta$/$\sin\beta$ |
| $\phi(s)$ | `AnguloRoll` | ángulo de roll del carro, medido contra el marco de transporte paralelo | rad | memoria §1.4 | grado de libertad independiente de la curva |
| $\phi'$ | `VelocidadRoll` | $d\phi/ds$ | rad/m | memoria §3.3 | — |
| $\phi''$ | `AceleracionRoll` | $d^2\phi/ds^2$ | rad/m² | memoria §3.4 | de él depende la aceleración lateral de heartline |
| $\phi'''$ | — | $d^3\phi/ds^3$ | rad/m³ | generador §7 | usado sólo en la fórmula de $L_{roll}$ |
| $\theta_{girado}$ | `AnguloGirado` | ángulo total que giró la tangente desde el arranque del elemento | rad | generador §4.1 | componente 14 del vector de estado $y$ |
| Track.AnguloRoll | `Track.AnguloRoll` | ver $\phi$ arriba: registro a lo largo de todo el Track | rad | generador §12.3 | crece con la torsión aunque el carro salga derecho |
| Track.AnguloPeralte | `Track.AnguloPeralte` | roll medido contra la **vertical** (el que se ve mirando la vía) | rad | generador §12.3 | distinto de `Track.AnguloRoll`; ver bloque 4. Vive en $(-\pi,\pi]$: el gráfico de roll dibuja su módulo (generador §12.3) |
| $\beta_{peralte}$ | `PeralteDeLaHelice`, `PeralteDelGiro` | peralte de diseño de un elemento de giro horizontal | rad | generador §5 (recetas) | parámetro de entrada, no confundir con $\beta$ (transporte) |

## 2. Cinemática y dinámica

| Símbolo | Nombre en código | Significado | Unidad | Definido en | Notas |
|---|---|---|---|---|---|
| $v$ | `Velocidad` | rapidez del carro a lo largo de la vía | m/s | memoria §3.2 | — |
| $a_t$ | `AceleracionTangencial` | aceleración tangencial, $dv/dt$ | m/s² | memoria §3.2 | $=-g\,T_z - F_{res}/m$ |
| $a_n$ | — | aceleración normal objetivo del modo `AceleracionNormalConstante` | m/s² | generador §5 | sale de `Parametros.AceleracionNormalObjetivo`; $\kappa=a_n/v^2$ |
| $\boldsymbol\omega$ | — | velocidad angular del marco del carro | rad/s | memoria §3.3 | $=\Omega_T\mathbf{T}+\Omega_U\mathbf{U}+\Omega_L\mathbf{L}$ |
| $\dot{\boldsymbol\omega}$ | — | aceleración angular del marco del carro (transferencia de cuerpo rígido) | rad/s² | memoria §3.2 | antes notada $\boldsymbol\alpha$; colisión 5 resuelta |
| $\Omega_T$ | — | componente de $\boldsymbol\omega$ sobre **T** (velocidad de roll en el tiempo) | rad/s | memoria §3.3 | $=v\phi'$ |
| $\boldsymbol\omega$ | — (se arma al vuelo en `SimularSobreTrack`) | velocidad angular del marco del carro, $v(\mathbf{T}\times\boldsymbol\kappa+\phi'\mathbf{T})$ | rad/s | memoria §3.3 | **dos** aportes: giro del marco de transporte y roll. Quedarse sólo con el segundo pierde hasta 0.49 G |
| $\dot{\boldsymbol\omega}$ | — | aceleración angular del marco del carro | rad/s² | memoria §3.2 | colisión 5: antes se notaba $\boldsymbol\alpha$ |
| $\Omega_U,\Omega_L$ | — | componentes de $\boldsymbol\omega$ sobre **U**, **L**, impuestas por la curvatura | rad/s | memoria §3.3 | giran el marco a razón $\kappa v$ |
| $\kappa_u,\kappa_l$ | — | componentes de $\boldsymbol\kappa$ sobre **U**, **L** del marco del **carro** | 1/m | memoria §3.3 | distintas de $\kappa_U,\kappa_L$, que van sobre el marco de transporte |
| $t$ | `Tiempo` | tiempo transcurrido desde el arranque del layout | s | memoria §3.3 | colisión 2 resuelta: **t** es siempre tiempo |
| $G_x,G_y,G_z$ | `Gx`,`Gy`,`Gz` | fuerza G en los ejes del pasajero (longitudinal, lateral, vertical) | G (adimensional, múltiplos de $g$) | memoria §2.3 | incluyen gravedad, comparables directo contra F2291 |
| $G_{ArribaHeartline}$ | `GArribaHeartline` | G sobre el eje $\mathbf{U}$ en la heartline (brazo $d$), transportada desde el riel con la fórmula cerrada de memoria §3.4 | G | generador §14.1 | insumo de `ResistenciaAlAvance` y de `FuerzaNormal`: el centro de masa se supone acá |
| $G_{LateralHeartline}$ | `GLateralHeartline` | G sobre el eje $\mathbf{L}$ en la heartline | G | generador §14.1 | ídem |
| — | `GArribaVerificacion`, `GLateralVerificacion` | las mismas dos, en el punto de verificación (brazo $b$) | G | Nucleo/DerivadaDeVia.m | coinciden con las de heartline salvo `PuntoDeVerificacionNormativa = 'Cabeza'`; realimentan la longitud de las transiciones |
| — | `Sim.GxCabeza`, `Sim.GyCabeza`, `Sim.GzCabeza` | G en la cabeza (brazo $d+e$) | G | Fisica/SimularSobreTrack.m | informativas |
| $J$ | `JerkGx`,`JerkGy`,`JerkGz` (código); $J_{max}$ ≡ `OnsetMaximo` | jerk / tasa de aparición de G, $dG/dt$ | G/s | memoria §6.1 | también llamado "onset"; unificado en G/s (colisión 9) |
| $J_{max}$ | `OnsetMaximo` (por eje, vector de 3) / `OnsetNormativoPorEje` | presupuesto máximo de onset, por eje | G/s | memoria §6.7, §7.5 | $J_{x,max},J_{y,max},J_{z,max}$ son sus componentes; antes convivían "J_max", "J_{y,max}" y "OnsetMaximo" con notación distinta — se unifica a $J_{max}$ con subíndice de eje |
| $d$ | `DistanciaHeartline` | offset **riel → heartline** (centro de masa del pasajero), medido a lo largo de **U** | m | memoria §3.1 | colisión 1 resuelta. Es un offset **físico**: define dónde queda el pasajero respecto de la curva integrada, y es el brazo de la rotación alrededor del riel |
| $e$ | `DistanciaHeartlineACabeza` | offset **heartline → cabeza**, medido a lo largo de **U** | m | memoria §3.1 | chequeo de rotaciones (Rohde 2024, §7.6.2). NO es lo mismo que $d$ aunque hoy compartan valor por defecto |
| $b$ | `BrazoDeVerificacion(Parametros)` | brazo del riel al punto donde se aplica la norma: $d$, o $d+e$ | m | memoria §3.1 | el mismo $b$ dimensiona la transición de roll y transporta la G verificada |

## 3. Parámetros de entrada del generador (`ParametrosPorDefecto.m`)

Qué consume cada modo lo declara `ParametrosDelModo`; qué consume cada elemento, el propio `ElementoXxx` llamado sin argumentos; los criterios de aceptación, `ParametrosDeAceptacion`; el resto (física, carro, resolución, escalado, discretización, tolerancias), `ParametrosGenerales`. `AjustarParametros` avisa si un override no lo lee ni el modo ni el elemento elegidos; `LayoutAJson` falla si algún campo de `Parametros` no está declarado en ninguna de las cuatro listas. Nombres nuevos: `ParametrosDelModo`, `DeclaracionDeParametros`, `CatalogoDeElementos`, `ParametrosDeAceptacion`, `ParametrosGenerales`, `AjustarParametros`, `DescribirParametros`.

| Símbolo / campo | Nombre en código | Significado | Unidad | Definido en | Notas |
|---|---|---|---|---|---|
| $g$ | `Parametros.Gravedad` | aceleración de la gravedad | m/s² | memoria §5.1 | 9.81 |
| $\rho_{aire}$ | `Parametros.RhoAire` | densidad del aire | kg/m³ | energía §8 | 1.20, aire a ~20 °C nivel del mar |
| $C_{rr,port}$ | `Parametros.CrrPortantes` | coeficiente de rodadura, ruedas portantes (road/running wheels) | adimensional | energía §8 | 0.030, **[SIN VERIFICAR]** — provisorio, requiere calibración experimental |
| $C_{rr,guia}$ | `Parametros.CrrGuia` | coeficiente de rodadura, ruedas guía (guide/side wheels) | adimensional | energía §8 | 0.035, **[SIN VERIFICAR]** |
| $C_{rr,ret}$ | `Parametros.CrrRetencion` | coeficiente de rodadura, ruedas de retención (up-stop wheels) | adimensional | energía §8 | 0.035, **[SIN VERIFICAR]** |
| — | `Parametros.ModelarArrastre` | booleano: si se computa arrastre aerodinámico | — (lógico) | energía §8 | `true` por defecto |
| $C_d$ | `Parametros.CoefArrastre` | coeficiente de arrastre aerodinámico | adimensional | energía §8 | 0.90, cuerpo romo, **[SIN VERIFICAR]** |
| $A_{ef}$ (base) | `Parametros.AreaFrontal` | área frontal proyectada de un carro | m² | energía §8 | 0.0036 (0.06×0.06 m) |
| $k_{tren}$ | `Parametros.FactorTren` | fracción del arrastre de flujo libre que aporta cada carro detrás del primero | adimensional | energía §8 | 0.25; antes convivía con símbolo suelto "$k_{tren}$" sin ligar al parámetro — queda ligado acá |
| $n_{carros}$ | `Parametros.NumeroDeCarros` | número de carros del tren | adimensional (entero) | energía §1 | 1; colisión 6 resuelta (antes "N") |
| $m$ | `Parametros.Masa` | masa del carro | kg | energía §1 | 0.15 kg |
| $L_{carro}$ | `Parametros.LargoCarro` | largo del carro del modelo | m | memoria §9.1 | 0.10 m, **SIN CERRAR** en código |
| — | `Parametros.AltoCarro` | alto del carro del modelo | m | memoria §9.2 | 0.06 m, **SIN CERRAR** |
| — | `Parametros.AnchoVia` | trocha (ancho de vía) del modelo | m | generador §8 | 0.06 m, **SIN CERRAR** |
| — | `Parametros.Holgura` | margen sobre la envolvente del carro para el chequeo de interferencia | m | generador §8 | 0.010 m |
| $D_{rueda}$ | `Parametros.DiametroRueda` | diámetro de rueda, piso impuesto por el rodamiento mínimo | m | memoria §9.2 | 0.0136 m, **SIN CERRAR** |
| $d$ | `Parametros.DistanciaHeartline` | ver bloque 2 | m | memoria §3.1 | 0.030 m; offset físico riel → heartline |
| $e$ | `Parametros.DistanciaHeartlineACabeza` | ver bloque 2 | m | memoria §3.1 | 0.030 m, **SIN CERRAR** — no es una medida antropométrica. A $\lambda\approx22$ un offset corazón-cabeza real de ~0.25 m daría ~0.011 m |
| — | `Parametros.PuntoDeVerificacionNormativa` | dónde se aplica la norma: `'Heartline'` (brazo $d$) o `'Cabeza'` (brazo $d+e$) | — (enum) | memoria §3.1 | `'Heartline'` por defecto: es donde se diseña y donde mide EN 13814 |
| $A_{ef}$ (parám. duplicado) | `Parametros.AreaFrontal` | idéntico al de energía; mismo campo, usado también por el generador | m² | generador §7 | mismo valor que en energía |
| $H_{max}$ | `Parametros.AlturaMaximaDelElemento` | altura máxima admisible de un elemento | m | memoria §9.8 | 1.00 m, restricción dura del proyecto |
| $R_{ref}$ | `Parametros.RadioDeReferencia` | radio de referencia genérico (longitud característica de Froude si se llama al motor a mano) | m | generador §10 | 0.21 m; cada elemento lo pisa con su propio radio antes de generar |
| $R_{loop}$ | `Parametros.RadioDelLoop` | radio de cúspide objetivo del loop vertical | m | memoria §9.1 | 0.11 m, **SIN CERRAR** |
| — | `Parametros.RollExtraDelLoop` | roll adicional del loop vertical (0 = estándar) | rad | generador §5 (receta) | 0 |
| — | `Parametros.RadioDelDiveLoop` | radio de cúspide del dive loop | m | generador §2 | 0.45 m |
| — | `Parametros.SeparacionDelDiveLoop` | separación entre patas del dive loop (no obligatoria, gira sólo $\pi$) | m | generador §4.1 ("El loop no es plano") | 0 |
| — | `Parametros.RadioDeLaHelice` | radio de la hélice | m | generador §2 | 0.70 m |
| — | `Parametros.VueltasDeLaHelice` | vueltas de la hélice (puede no ser entero) | adimensional | generador §2 | 1.0 |
| — | `Parametros.AvanceDeLaHelice` | avance sobre el eje de la hélice; negativo = baja | m | generador §2 | −0.30 m |
| — | `Parametros.PeralteDeLaHelice` | peralte de la hélice | rad | generador §2 | 55° |
| — | `Parametros.RadioDelGiro` | radio del over-banked turn | m | generador §2 | 0.80 m |
| — | `Parametros.AnguloDelGiro` | cambio de rumbo del over-banked turn | rad | generador §2 | 120° |
| — | `Parametros.PeralteDelGiro` | peralte del over-banked turn (>90° = over-banked) | rad | generador §2 | 110° |
| — | `Parametros.AvanceDelGiro` | avance sobre el eje del over-banked turn (0 = a nivel) | m | generador §2 | 0 |
| — | `Parametros.SentidoDelGiro` | sentido del giro, `'Derecha'` \| `'Izquierda'` | — (enum) | generador §2 | `'Derecha'` |
| — | `Parametros.ModoCurvatura` | modo de curvatura del arco principal | — (enum, ver bloque 5) | generador §5 | `'Clotoide'` |
| — | `Parametros.MetodoDeAcoplamiento` | método de acoplamiento geometría-dinámica, `'A'`\|`'B'`\|`'Ambos'` | — (enum) | generador §6 | `'A'` |
| — | `Parametros.CalcularVelocidadMinima` | booleano: si se corre la búsqueda de velocidad inicial mínima | — (lógico) | generador §8 | `true` |
| $a_n^{obj}$ | `Parametros.AceleracionNormalObjetivo` | aceleración normal objetivo del modo 1 | m/s² | generador §5 | 20 |
| $G_{obj}$ | `Parametros.FuerzaGObjetivo` | G neta objetivo (incl. gravedad) del modo `FuerzaGConstante` | G | generador §5 | 3.0; corresponde al modo 3 de la tabla de curvatura |
| — | `Receta.CurvaLimiteGz` | qué curva normativa de $+G_z$ persigue el elemento en modo `GNormativaMaxima` | — (enum, ver bloque 7) | generador §5 | `'MasGzTodas'` en los cuatro elementos; la arma cada `ElementoXxx.m`, no es un parámetro global (antes `Parametros.CurvaLimiteGMaximas`) |
| — | `Parametros.TolObjetivoDeG` | desvío admitido entre la 197609y 197609 del pasajero y la que pidió el modo, en el arco; se descuenta del objetivo de  modo normativo y del  del dive loop, para que "objetivo alcanzado" garantice el cumplimiento | G | generador §5 | 0.05 |
| $FS$ | `Parametros.FactorDeSeguridadNormativo` | divide la curva de la norma que persigue el modo `GNormativaMaxima` (objetivo de diseño con margen); la verificación sigue siendo contra la norma literal | — | generador §5 | 1.0 |
| $w$ | `Parametros.SemianchoDeSuavizadoNormativo` | semiancho, en segundos de prototipo, con el que `LimiteDeDiseno` redondea por debajo los quiebres de la tabla de la norma para que el objetivo del modo sea $C^1$; 0 = tabla literal | s | memoria §7.8, generador §5 | 0.05 |
| — | `Receta.CurvaLimiteGy`, `Receta.SentidoDeGy` | curva de $G_y$ que persigue el dive loop en modo normativo (acotada por la elipse de 7.1.5.1) y hacia qué lado (+1 = hacia $\mathbf L$) | — (enum), — (±1) | generador §5.1, memoria §5.8 | `'GyBase'`; el sentido sale de `SentidoDelGiro` |
| $\psi$ | `Track.AnguloCurvaturaDesdeArriba` | ángulo de la curvatura del riel medido desde $\mathbf U$ hacia $\mathbf L$ en el marco del carro | rad | generador §5.1 | 0 en loop y dive loop salvo el sub-peralte; complemento del peralte en los giros |
| $G_{min,cúspide}$ | `Parametros.GMinimaCuspide` | margen mínimo de G en la cúspide (criterio ≠ $F_N=0$) | G | generador §8 | 0.50 |
| $J_{x,max},J_{y,max},J_{z,max}$ (real) | `Parametros.OnsetNormativoPorEje` | presupuesto de onset por eje, en la norma (prototipo) | G/s | memoria §6.7 | `[5, 5, 15]`; $G_y$ **SIN CERRAR** (sin valor normativo propio, se adopta el más restrictivo) |
| $J_{max}$ (modelo, override) | `Parametros.OnsetMaximoModelo` | override directo del presupuesto de onset del modelo; vacío = derivar de Froude | G/s | generador §7 | `[]` por defecto |
| $L_{loop,real}$ | `Parametros.RadioDeReferenciaReal` | radio de referencia de la atracción real usada como ancla de escala | m | memoria §4.3 | 8.00 m, **[SIN VERIFICAR]** |
| $L_{carro,real}$ | `Parametros.LargoCarroReal` | largo de carro real usado como ancla de escala | m | memoria §4.3 | 2.20 m, **[SIN VERIFICAR]** |
| — | `Parametros.RadioMinimoFabricable` | radio mínimo que la impresora puede fabricar | m | generador §8 | 0.08 m, **SIN CERRAR** |
| — | `Parametros.BoundingBoxDisponible` | caja disponible para el circuito, filas x/y/z | m | generador §8 | `[-2,2;-2,2;0,1.5]` |
| — | `Parametros.AlturaMinimaSuelo` | altura mínima admisible sobre el suelo | m | generador §8 | 0.05 m |
| — | `Parametros.PasoGeneracion` | paso de integración $\Delta s$ de la marcha RK4 (capa 3) | m | generador §4.1 | 0.002 m |
| — | `Parametros.PasoSimulacion` | paso de integración de `SimularSobreTrack` | m | generador §1 (arquitectura) | 0.005 m |
| — | `Parametros.PasosEntreOrtonormalizaciones` | cada cuántos pasos se reortonormaliza el marco (Gram-Schmidt) | adimensional (entero) | generador §3 | 25 |
| — | `Parametros.VersoresEnGrafico3D` | cuántas flechas de marco se dibujan en la vista 3D | adimensional (entero) | Salida/GraficarElemento.m | 40 |
| — | `Parametros.PasoBusquedaVelocidad` | paso de generación (grueso) usado dentro de la bisección de $v_0$ mínima | m | generador §8 | 0.010 m |
| — | `Parametros.TolNorma` | tolerancia por debajo de la cual un vector se considera nulo | m (norma de vector) | generador §3 | $10^{-12}$ |
| — | `Parametros.TolCierrePitch` | tolerancia del residual de cierre del loop (capa 2) | rad | generador §4.1 | $10^{-4}$ |
| — | `Parametros.TolPuntoFijo` | tolerancia de convergencia del punto fijo del método B | m/s | generador §4.1.4 | $10^{-8}$ |
| — | `Parametros.MaxIteracionesPuntoFijo` | tope de iteraciones del punto fijo del método B | adimensional (entero) | generador §4.1.4 | 60 |
| — | `Parametros.MaxIteracionesCierre` | tope de iteraciones de la capa 2 (cierre) | adimensional (entero) | generador §4.1 | 6 |
| — | `Parametros.MaxIteracionesAjuste` | tope de iteraciones de la capa 1 (ajuste de forma) | adimensional (entero) | generador §4.1 | 8 |
| — | `Parametros.MargenDeOnset` | margen relativo que se agrega sobre el `FactorLongitud` en cada iteración de la capa 1 | adimensional | generador §4.1 | 0.002 |
| — | `Parametros.ToleranciaVelocidadDeDiseno` | diferencia de velocidad de entrada que dispara aviso al re-simular | m/s | generador §1 (Track/Sim) | 0.10 m/s |
| — | `Parametros.ArcoMinimoAutointerferencia` | separación de arco por debajo de la cual dos segmentos se ignoran en el chequeo de autointerferencia | m | generador §8 | 0.30 m |
| — | `Parametros.DistanciaMinimaEntreVias` | separación libre exigida entre vías (o entre pasadas de la misma vía) | m | generador §8 | 0.02 m |
| — | `Parametros.SeparacionDePatas` | separación entre las dos patas del loop (derivada de la envolvente al final del archivo) | m | generador §4.1 ("El loop no es plano") | se calcula, no se declara directo |
| — | `Parametros.InclinacionHelicoidalImpuesta` | override de la inclinación helicoidal $\tan\alpha$; vacío = se resuelve por Newton | adimensional (o `[]`) | generador §4.1 | `[]` |

## 4. Campos de las estructuras (`Estado`, `Track`, `Sim`, `Layout`, `Elemento`, `Reporte`, `Punto`, `SubTramos`)

| Campo | Struct | Significado | Unidad | Definido en | Notas |
|---|---|---|---|---|---|
| `Posicion` | `Estado`, `Punto`, `Track.PuntosRiel` | posición 3D, **sobre el riel** | m | Nucleo/EstadoInicial.m | el `Estado` que se encadena entre elementos viaja sobre el riel |
| `PuntosRiel` | `Track` | polilínea del riel | m (matriz n×3) | Elementos/GenerarGeometria.m | curva integrada; lo que se fabrica y sobre lo que se chequea interferencia. `Track.Curvatura` es su curvatura, exacta |
| `PuntosHeartline` | `Track` | polilínea de la heartline, $\mathbf{r}+d\mathbf{U}$ | m (matriz n×3) | ídem | derivada; donde va el pasajero |
| `LongitudArcoHeartline` | `Track` | arco acumulado sobre la heartline | m | ídem | — |
| `CurvaturaHeartline` | `Track` | ver $\kappa_h$ | 1/m | ídem | contra esto se compara el radio nominal; contra `Track.Curvatura` se compara `RadioMinimoFabricable` |
| `FactorVelocidadHeartline` | `Track`, `Punto`, `Sim` | ver $J$ | — | Nucleo/DerivadaDeVia.m | — |
| `VersorTangente` | `Estado`, `Punto`, `Track` | ver $\mathbf{T}$ | adimensional | ídem | — |
| `VersorArribaCarro` | `Estado`, `Punto`, `Track` | ver $\mathbf{U}$ | adimensional | ídem | — |
| `VersorLateral` | `Estado`, `Punto`, `Track` | ver $\mathbf{L}$ | adimensional | ídem | $=\mathbf{T}\times\mathbf{U}$ |
| `VersorArribaTransporte` | `Punto`, `Track` | ver $\mathbf{U}_{pt}$ | adimensional | Nucleo/DerivadaDeVia.m | — |
| `VersorLateralTransporte` | `Punto`, `Track` | ver $\mathbf{L}_{pt}$ | adimensional | ídem | — |
| `VectorCurvatura` | `Estado`, `Punto`, `Track` | ver $\boldsymbol\kappa$ | 1/m | ídem | — |
| `DerivadaCurvatura` | `Estado`, `Track` | $d\kappa/ds$ a lo largo del Track | 1/m² | Elementos/GenerarGeometria.m | se recupera con `gradient` sobre la polilínea |
| `AnguloRoll` | `Estado`, `Punto`, `Track` | ver $\phi$ | rad | Nucleo/EstadoInicial.m | — |
| `VelocidadRoll` | `Estado`, `Punto`, `Track` | ver $\phi'$ | rad/m | ídem | — |
| `AceleracionRoll` | `Estado`, `Punto`, `Track` | ver $\phi''$ | rad/m² | ídem | en `Track` se recupera con `gradient` |
| `LongitudAcumulada` | `Estado` | ver $s$ | m | ídem | — |
| `Velocidad` | `Estado` | velocidad del **centro de masa** | m/s | ídem | es la que conserva energía; en vía recta sin roll coincide con la del riel |
| `Velocidad` | `Punto`, `Sim` | velocidad del **punto del riel**, $v = v_{cm}/J$ | m/s | Nucleo/DerivadaDeVia.m | marca el tiempo, la velocidad angular del marco y el jerk |
| `VelocidadCentroDeMasa` | `Punto`, `Track`, `Sim` | velocidad del centro de masa, $v_{cm}$ | m/s | ídem | estado que se integra (`y(13)` es $v_{cm}^2$); la que usan los modos de curvatura |
| `EnergiaTotal` | `Estado`, `Sim` | energía mecánica total | J | ídem | $=\frac12 m v^2 + mgz$ |
| `Arco` | `Registro`/`Track.LongitudArco`, `Punto` | ver $s$ | m | Nucleo/RegistroVacio.m | nombre de campo distinto según struct |
| `CurvaturaArriba`, `CurvaturaLateral`, `Curvatura` | `Registro`/`Track`, `Punto` | ver $\kappa_U,\kappa_L,\kappa$ | 1/m | ídem | — |
| `AnguloGirado` | `Registro`/`Track`, `Punto` | ver $\theta_{girado}$ | rad | ídem | — |
| `Tiempo` | `Registro`/`Track`, `Punto` | ver $t$ | s | ídem | — |
| `AceleracionTangencial` | `Registro`/`Track`, `Punto`, `Sim` | ver $a_t$ | m/s² | ídem | — |
| `GArribaHeartline`, `GLateralHeartline` | `Registro`, `Punto`, `Sim` | ver bloque 2 | G | Fisica/CargasEnLaVia.m | transportadas desde el riel con brazo $d$ |
| `PerdidaRodadura`, `PerdidaArrastre` | `Registro`/`Track`, `Punto`, `Sim` | pérdida de energía (nodo a nodo) por cada mecanismo | J | Fisica/ResistenciaAlAvance.m | en `Sim` van acumuladas: `EnergiaDisipadaRodadura`, `EnergiaDisipadaArrastre` |
| `NumeroDeNodos` | `Registro` | cuántas filas del registro están efectivamente escritas | adimensional (entero) | Nucleo/RegistroVacio.m | el resto de la reserva queda en NaN hasta `RecortarRegistro` |
| `PuntosRiel` | `Layout` | polilínea del riel acumulada de todo el layout | m (matriz n×3) | LayoutDeVia/LayoutNuevo.m | insumo del chequeo de interferencia del elemento siguiente; acumula el riel y no el heartline porque chocan las piezas físicas |
| `LongitudArcoRiel` | `Layout` | arco acumulado del riel de todo el layout | m | ídem | sirve para excluir vecinos por construcción en el chequeo de interferencia |
| `Elementos` | `Layout` | cell array con un registro por elemento encadenado | — (cell array) | ídem | cada entrada lleva `Elemento`, `EstadoEntrada`, `EstadoSalida`, `Reporte` |
| `EstadoInicial`, `EstadoActual` | `Layout` | estado al arrancar el layout y después del último elemento | — (struct `Estado`) | ídem | sobre el heartline |
| `Track.Nombre` | `Track` | nombre del elemento (`'LoopVertical'`, etc.) | texto | Elementos/GenerarGeometria.m | — |
| `Track.ModoCurvatura` | `Track` | modo de curvatura con que se generó | texto | ídem | copia de `Parametros.ModoCurvatura` |
| `Track.SubTramos` | `Track` | ver bloque `SubTramos` abajo | struct array | ídem | — |
| `Track.VelocidadDeDiseno` | `Track` | velocidad de entrada con la que se generó la geometría | m/s | ídem | usada por `LayoutResimular` para avisar desvíos |
| `Track.PasoGeneracion` | `Track` | copia de `Parametros.PasoGeneracion` usada en esta generación | m | ídem | — |
| `Track.NormalDelPlano` | `Track` | normal del plano vertical de referencia en el arranque del elemento | adimensional | ídem | — |
| `Track.InclinacionHelicoidal` | `Track` | $\tan\alpha$ resuelto | adimensional | ídem | ver $\alpha$, bloque 6 |
| `Track.AnguloPeralte` | `Track` | ver bloque 1 | rad | Elementos/GenerarGeometria.m (`AnguloDePeralte`) | — |
| `Track.ObjetivoNormativo` | `Track` | tabla $G_{z,obj}(t)$ que persiguió el modo `GNormativaMaxima` en el arco (reloj por nivel, / FS, menos `TolObjetivoDeG`), en tiempo del modelo con paso uniforme y coeficientes de la cúbica de Hermite; `[]` en los otros modos | G, s | Fisica/ObjetivoNormativoPorNiveles.m; se evalúa con `EvaluarObjetivoNormativo` | la usan el criterio "Gz objetivo del modo alcanzado", los tests 12–14 y el gráfico de $G_z$ |
| `VelocidadParaCurvatura` | `Punto` | velocidad que efectivamente entra a `CurvaturaDelModo`: la real (método A) o el perfil supuesto interpolado (método B) | m/s | Nucleo/PuntoCinematico.m | antes aparecía sin definir entre paréntesis en generador §4.1 |
| `Sim.FuerzaNormal` | `Sim` | fuerza normal real sobre la vía, $m\,g\,\sqrt{G_{ArribaRiel}^2+G_{LateralRiel}^2}$ | N | Fisica/SimularSobreTrack.m | — |
| `Sim.PuntoDeParada` | `Sim` | índice de nodo donde el carro se queda sin energía (vacío si completa) | adimensional (índice) o `[]` | ídem | — |
| `Sim.AvisoVelocidadDeDiseno` | `Sim` | texto de aviso si la velocidad de entrada actual difiere de `Track.VelocidadDeDiseno` | texto | ídem | vacío si no aplica |
| `SubTramos(k).Nombre` | `SubTramos` | `'AcondicionamientoEntrada'`\|`'ClotoideEntrada'`\|`'ArcoPrincipal'`\|`'ClotoideSalida'` | texto | generador §4 | — |
| `SubTramos(k).IndiceInicio/IndiceFin` | `SubTramos` | rango de índices de nodo del sub-tramo dentro del Track | adimensional (índices) | ídem | — |
| `Reporte.Previos`, `Reporte.Posteriores` | `Reporte` | arrays de criterios de factibilidad (ver campos de `AgregarCriterio`) | struct array | Verificacion/ChequeosPrevios.m, ChequeosPosteriores.m | — |
| `Reporte.Normativo` | `Reporte` | estructura de verificación normativa detallada (ver bloque 7) | struct | Verificacion/VerificarLimitesNormativos.m | — |
| `Reporte.Resumen` | `Reporte` | números de salida agregados del elemento | struct | Elementos/ConstruirElemento.m | ver filas sueltas de este bloque con prefijo `Resumen.` |
| `Resumen.LongitudRecorrida` | `Reporte.Resumen` | longitud de arco del elemento | m | ConstruirElemento.m | — |
| `Resumen.LongitudDeMaterial` | `Reporte.Resumen` | longitud real de la polilínea (suma de segmentos) | m | ídem | puede diferir mínimamente de `LongitudRecorrida` |
| `Resumen.AlturaMaxima` | `Reporte.Resumen` | altura máxima sobre el punto de entrada | m | ídem | — |
| `Resumen.RadioMinimo` | `Reporte.Resumen` | $1/\kappa_{max}$ del elemento | m | ídem | — |
| `Resumen.ResidualCierrePitch` | `Reporte.Resumen` | residual de cierre del giro dentro del plano del arco (ver generador §4.1) | rad | ídem | nunca se asume cero |
| `Resumen.DesplazamientoLateral`, `...LateralObjetivo` | `Reporte.Resumen` | avance sobre el eje de la hélice, medido y objetivo | m | ídem | ver `Receta.DesplazamientoObjetivo` |
| `Resumen.InclinacionHelicoidal` | `Reporte.Resumen` | ver $\alpha$: se reporta como $\tan\alpha$ | adimensional | ídem | — |
| `Resumen.LambdaLoop`, `LambdaCarro`, `Distorsion`, `CarrosEquivalentes` | `Reporte.Resumen` | ver bloque 6 | adimensional | ídem | — |
| `Resumen.OnsetMaximoModelo` | `Reporte.Resumen` | copia de `Escala.OnsetMaximo` | G/s (vector de 3) | ídem | — |
| `Resumen.VelocidadInicialMinima` | `Reporte.Resumen` | ver bloque 5 | m/s | Fisica/VelocidadInicialMinima.m | `NaN` si `CalcularVelocidadMinima = false` |
| `Elemento.Diagnostico` | `Elemento` | diagnóstico interno de la generación (factores de convergencia, escala, etc.) | struct | Elementos/GenerarGeometria.m | ver filas con prefijo `Diagnostico.` |
| `Diagnostico.FactorLongitudTransicion` | `Elemento.Diagnostico` | ver `FactorLongitud`, bloque 5 | adimensional | ídem | — |
| `Diagnostico.OnsetVerticalGenerado` | `Elemento.Diagnostico` | onset vertical efectivamente medido sobre la geometría ya generada | G/s | ídem | usado para realimentar `FactorLongitud` |
| `Receta.Nombre` | `Receta` | nombre del elemento | texto | Elementos/GenerarGeometria.m | — |
| `Receta.GiroObjetivo` | `Receta` | ángulo total a girar | rad | ídem | $2\pi$ loop, $\pi$ dive loop, etc. |
| `Receta.DesfasajeDeCurvatura` | `Receta` | ángulo entre el vector curvatura y el eje "arriba" sin peralte | rad | ídem | 0 = curvatura en plano vertical (loop); $\pm\pi/2$ = horizontal (giros) |
| `Receta.RollDelElemento` | `Receta` | roll del carro respecto de la vertical, objetivo del elemento | rad | ídem | 0 loop, $\pi$ dive loop, peralte en giros |
| `Receta.DesplazamientoObjetivo` | `Receta` | avance sobre el eje de la hélice del elemento | m | ídem | separa patas en el loop, sube/baja en la hélice |

## 5. Parámetros y variables del script de análisis energético (`analisis_energia.m`)

| Símbolo | Nombre en código | Significado | Unidad | Definido en | Notas |
|---|---|---|---|---|---|
| $\delta$ | `DistanciaDeDiscretizacion` | separación objetivo entre puntos de análisis, medida sobre la curva | m | energía §3 | colisión 1 resuelta (antes "d") |
| $p$ | `t` (variable MATLAB, mismo nombre que el código) | parámetro libre de la curva paramétrica $X(p),Y(p),Z(p)$ | adimensional | energía §2 | colisión 2 resuelta; código sigue usando la variable `t`, el símbolo del documento es $p$ |
| $p_{min},p_{max}$ | `TMin`, `TMax` | extremos del parámetro libre | adimensional | energía §2 | colisión 4 resuelta (antes $T_{min}/T_{max}$) |
| — | `NumPuntosFinos` | número de puntos del muestreo fino de la trayectoria | adimensional (entero) | energía §2 | 20000 |
| — | `TrayectoriaFina` | polilínea fina usada para medir longitud de arco | m (matriz n×3) | energía §2 | — |
| — | `TrayectoriaDePuntos` | polilínea final, un punto cada $\delta$ metros de recorrido real | m (matriz n×3) | energía §3 | — |
| $R$ | `RadioDeGiro` | radio de la circunferencia osculatriz discreta (3 puntos) | m | energía §4 | mismo símbolo que bloque 1: es el mismo radio de curvatura, estimado discretamente |
| — | `TolArea` | umbral de área de triángulo por debajo del cual se declara tramo recto | m² | energía §4 | $10^{-14}$ |
| — | `TolNorma` | umbral de norma de vector por debajo del cual se considera nulo | (unidad del vector) | energía §5 | $10^{-12}$ |
| $\varepsilon_{maq}$ | — | épsilon de máquina: menor número tal que `1 + eps ≠ 1` en punto flotante de doble precisión | adimensional | energía §4 | $\approx 2.22\times10^{-16}$; explica la fragilidad numérica de `RadioDeGiro` cuando el área es chica |
| — | `DireccionRadioDeGiro` | versor desde el punto hacia el centro de curvatura discreto | adimensional | energía §4 | vía coordenadas baricéntricas del circuncentro |
| $E_0$ | `E_0` | energía mecánica total en el punto de arranque | J | energía §6 | $=\frac12 m v_0^2 + mgz_1$ |
| — | `EnergiaPotencial`, `EnergiaCinetica`, `EnergiaTotal`, `EnergiaInicial` | energías a lo largo del recorrido | J | energía §6, §9 | `EnergiaInicial` es $E_0$ repetido, recta de referencia sin pérdidas |
| — | `VersorTangente` | ver $\mathbf{T}$ | adimensional | energía §7 | estimado por diferencia finita entre puntos consecutivos |
| — | `GravedadProyectada` | gravedad proyectada sobre el plano perpendicular a $\mathbf{T}$ | m/s² (luego G) | energía §7 | — |
| — | `NormalRadioDeGiro` | aceleración centrípeta proyectada sobre el plano perpendicular | m/s² (luego G) | energía §9 | — |
| — | `NormalVia` | G neta sobre la vía (gravedad + centrípeta), comparable directo contra F2291 §7.1.4.5 | G | energía §10 | — |
| $F_N$ | `FuerzaNormal` | fuerza normal real sobre la vía | N | energía §9 | colisión 6 resuelta; $=m\lVert\text{NormalVia}\rVert$ |
| — | `PerdidaRodadura`, `PerdidaArrastre` | pérdida de energía por tramo, por mecanismo | J | energía §8 | — |
| $C_{rr}$ (genérico, sólo en $v_{cruce}$) | — | valor de referencia usado únicamente para estimar el orden de magnitud de $v_{cruce}$ | adimensional | energía §8 | $C_{rr}=0.03$ **no corresponde a ninguno de los tres coeficientes declarados** (`CrrPortantes/Guia/Retencion`); es un valor de referencia para la estimación, no un parámetro del modelo — aclarado en §4 de esta consigna y en energía §8 |
| $v_{cruce}$ | — | velocidad a la que arrastre y rodadura aportan pérdidas comparables | m/s | energía §8 | $\approx 4.8$ m/s con los valores de referencia |
| — | `PuntoDeParada` | índice del punto donde el carro se queda sin energía | adimensional (índice) o `[]` | energía §9 | — |
| — | `FuerzaGRadioDeGiro` | G centrípeta con signo (hacia o contra el centro de curvatura) | G | energía §11 | — |

## 6. Escalado y semejanza

| Símbolo | Nombre en código | Significado | Unidad | Definido en | Notas |
|---|---|---|---|---|---|
| $Fr$ | — | número de Froude, $v/\sqrt{gL}$ | adimensional | memoria §4.1 | criterio de escalado adoptado |
| $\lambda$ | — | factor de escala genérico modelo↔real de **una** dimensión | adimensional | memoria §9.4 | no es propiedad del modelo entero, ver §9.4 |
| $\lambda_{loop}$ | `Escala.LambdaLoop` | $R_{loop,real}/R_{loop,modelo}$ (código: `RadioDeReferenciaReal/RadioDeReferencia`) | adimensional | Fisica/EscalasDeFroude.m | fija el presupuesto de onset y la conversión de duraciones |
| $\lambda_{carro}$ | `Escala.LambdaCarro` | $L_{carro,real}/L_{carro,modelo}$ | adimensional | ídem | — |
| distorsión | `Escala.Distorsion` | $\lambda_{carro}/\lambda_{loop}$ | adimensional | memoria §9.6, Fisica/EscalasDeFroude.m | 1.00 = modelo semejante |
| $CarrosEquivalentes$ | `Escala.CarrosEquivalentes` | $n_{carros}/\text{distorsión}$ | adimensional | Fisica/EscalasDeFroude.m | cuántos carros reales ocupa el tren del modelo en fracción de loop; ver discrepancia con la consigna original en generador §13 |
| $\sqrt\lambda_{loop}$ | `Escala.RaizLambdaLoop` | factor de conversión de tiempo/duración modelo→real | adimensional | Fisica/EscalasDeFroude.m | multiplica duraciones del modelo antes de evaluar curvas normativas |
| — | `Escala.FactorLongitud` | $1/\lambda_{loop}$ | adimensional | ídem | — |
| — | `Escala.FactorVelocidad`, `FactorTiempo` | $1/\sqrt\lambda_{loop}$ | adimensional | ídem | — |
| — | `Escala.FactorAceleracion` | 1 (las G son invariantes de Froude) | adimensional | ídem | — |
| — | `Escala.FactorJerk` | $\sqrt\lambda_{loop}$ | adimensional | ídem | — |
| $Re$ | — | número de Reynolds | adimensional | memoria §4.5 | conflicto clásico Froude-Reynolds, no se puede igualar junto con $Fr$ |

## 7. Normativa (ASTM F2291-06a §7)

| Símbolo / campo | Nombre en código | Significado | Unidad | Definido en | Notas |
|---|---|---|---|---|---|
| $G_{lim}(\text{dur})$ | `LimiteNormativo(Curva, Duracion)` | límite de G admisible en función de la duración del evento sostenido | G | memoria §5.7 | interpolación lineal por tramos; ver curvas abajo |
| — | `'MasGzTodas'` | Fig. 10, todas las sujeciones (+Gz, eyes down) | G | memoria §5.6 | curva que persiguen los cuatro elementos (`Receta.CurvaLimiteGz`) |
| — | `'MasGzReducido'` | Fig. 10, columna reducida (precedido por ≥3 s de −Gz, §7.1.7.1) | G | memoria §5.6 | se activa automáticamente si hubo airtime sostenido >3 s |
| — | `'MenosGzBase'` / `'MenosGzExtendido'` | Fig. 9, −Gz (airtime), base case / extended | G | memoria §5.5 | — |
| — | `'GyBase'` | Fig. 8, ±Gy lateral | G | memoria §5.4 | — |
| — | `'MasGxBase'` | Fig. 6, +Gx (eyes back) | G | memoria §5.2 | — |
| — | `'MenosGxBase'` / `'MenosGxOTS'` / `'MenosGxProne'` | Fig. 7, −Gx (eyes front): base / over-the-shoulder / prone | G | memoria §5.3 | — |
| — | `Normativo.OnsetDeCarga` | onset medido específicamente en transiciones de 0 G o menos hacia 2 G o más (§7.1.7.2, alcance literal) | G/s | generador §9, Verificacion/VerificarLimitesNormativos.m | — |
| — | `Normativo.Elipse.ValorMaximoGyGz` etc. | valor máximo de la combinación elíptica de dos ejes (§7.1.5.1), normalizado (≤1 = pasa) | adimensional | memoria §5.1, generador §9 | semiejes = límites de 200 ms × 1.1 |
| — | `Normativo.HuboAirtimeSostenido` | booleano: si hubo un evento de −Gz sostenido >3 s (dispara §7.1.7.1) | — (lógico) | Verificacion/VerificarLimitesNormativos.m | — |
| $t_{dur}$ (real equivalente) | `DuracionReal` | duración de un evento sostenido, convertida a escala real ($\times\sqrt{\lambda_{loop}}$) | s | memoria §5.7, generador §9 | la que efectivamente entra a `LimiteNormativo` |

## 8. Tolerancias y parámetros numéricos

| Símbolo | Nombre en código | Significado | Unidad | Definido en | Notas |
|---|---|---|---|---|---|
| — | `TolArea` | ver bloque 5 | m² | energía §4 | $10^{-14}$ |
| — | `TolCierrePitch` | ver bloque 3 | rad | generador §4.1 | $10^{-4}$ |
| — | `TolPuntoFijo` | ver bloque 3 | m/s | generador §4.1.4 | $10^{-8}$ |
| — | `PasoGeneracion` | ver bloque 3 | m | generador §4.1 | 0.002 m |
| — | `MaxIteraciones*` (Cierre, Ajuste, PuntoFijo) | ver bloque 3 | adimensional (entero) | generador §4.1 | 6, 8, 60 respectivamente |
| — | `PasosEntreOrtonormalizaciones` | ver bloque 3 | adimensional (entero) | generador §3 | 25 |
| $\varepsilon_{maq}$ | — | ver bloque 5 | adimensional | energía §4 | $\approx 2.22\times10^{-16}$ |
| — | `TolNorma` | ver bloques 3 y 5 (aparece en ambos módulos, con el mismo valor por defecto) | m (norma de vector) | generador §3, energía §5 | $10^{-12}$ |

## 9. Claves JSON del contrato del visualizador (`CONTRATO_VISUALIZADOR.md`)

El JSON que escribe `Salida/LayoutAJson.m` usa camelCase (§1.7 del contrato). **Regla general: la clave JSON es el
nombre MATLAB con la primera letra en minúscula**, sin excepciones en `parametros.valores`, `parametros.defaults`,
`estadoInicial`, `estadoSalida`, `resumen`, `criterios.previos/posteriores` y `criterios.normativo`
(`GzMaxima` → `gzMaxima`, `RadioDelLoop` → `radioDelLoop`, `Pasa` → `pasa`). Las unidades son las de las tablas de
arriba: SI y radianes, nunca grados. Las claves que **no** siguen la regla mecánica son las de `nodos` y las que el
exportador calcula, y son estas:

| Clave JSON | Nombre en código | Unidad | Notas |
|---|---|---|---|
| `nodos.arco` | `Track.LongitudArco` | m | acumulado desde el inicio del layout (arranca en `EstadoEntrada.LongitudAcumulada`) |
| `nodos.tiempo` | `Sim.Tiempo` | s | arranca en 0 en cada elemento |
| `nodos.x`, `y`, `z` | `Track.PuntosHeartline(:,1:3)` | m | heartline |
| `nodos.xRiel`, `yRiel`, `zRiel` | `Track.PuntosRiel(:,1:3)` | m | riel |
| `nodos.velocidad` | `Sim.VelocidadCentroDeMasa` | m/s | la del centro de masa |
| `nodos.velocidadRiel` | `Sim.Velocidad` | m/s | la del punto del riel |
| `nodos.curvatura` | `Track.CurvaturaHeartline` | 1/m | se exporta curvatura y no `Radio` (vale `Inf` en recta) |
| `nodos.curvaturaRiel` | `Track.Curvatura` | 1/m | ídem, no `RadioRiel` |
| `nodos.anguloRoll`, `anguloPeralte` | `Track.AnguloRoll`, `Track.AnguloPeralte` | rad | `TablaDeResultados` los exporta en grados; el JSON no |
| `nodos.puntoDeParada` | `Sim.PuntoDeParada` | índice base 0 | `null` si el carro completa el elemento |
| `nodos.numeroDeNodos` | `size(Track.PuntosRiel, 1)` | entero | largo de todos los arrays del bloque |
| `subtramos[].indiceInicio/indiceFin` | `SubTramos(k).IndiceInicio/IndiceFin` | índice base 0 | el exportador resta 1; rango inclusivo |
| `elementos[].tipo` | `Receta.Nombre` | texto | `'LoopVertical'`, `'Helice'`, `'OverBankedTurn'`, `'DiveLoop'` |
| `elementos[].indice` | posición en `Layout.Elementos` | índice base 0 | — |
| `elementos[].parametrosUsados` | `Elemento.Parametros.(Nombre)` para cada `Nombre` que declara `ElementoXxx()` | según parámetro | solo los geométricos del elemento |
| `parametros.esquema.*[].clave` | `Nombre` de `ParametrosDelModo`, `ElementoXxx()`, `ParametrosDeAceptacion`, `ParametrosGenerales` | — | en camelCase, apunta a `parametros.valores` |
| `criterios.todosPasan` | `all([Previos.Pasa]) && all([Posteriores.Pasa])` | lógico | lo calcula el exportador |
| `resumenLayout.alturaMaxima/alturaMinima` | `max/min(Layout.PuntosRiel(:,3))` | m | z del riel, absoluto |
| `resumenLayout.boundingBox` | mín/máx de riel y heartline juntas | m | `[[xmin,xmax],[ymin,ymax],[zmin,zmax]]` |
| `resumenLayout.longitudTotal`, `tiempoTotal` | suma de `Resumen.LongitudRecorrida`, `Resumen.TiempoDeRecorrido` | m, s | — |
| `resumenLayout.gzMaximaGlobal`, `gzMinimaGlobal`, `gyMaximaAbsolutaGlobal` | máx/mín de los `Resumen.*` de cada elemento | G | — |
| `resumenLayout.velocidadFinal` | `Layout.EstadoActual.Velocidad` | m/s | del centro de masa |
| `meta.versionGenerador` | `git rev-parse --short HEAD` (+ `-dirty`) | texto | `'desconocido'` si no hay git |

Todo valor `NaN`, `Inf` o `-Inf` se escribe como `null` (§1.6 del contrato); los índices van en base 0; los números
se redondean a 6 cifras significativas (§1.8).
