# Resumen — diagnóstico del desvío de Gz, gráficos vs tiempo, roll, factor de seguridad y dive loop

Rama: `feat/graficos-tiempo-roll-fs-diagnostico-gz`, a partir de `feat/gnormativa-eje-de-roll-y-parametros` (3504fb7).
Commits separados por punto; ver `git log` al final.

**MATLAB R2026a estaba disponible en la máquina (`D:\Program Files\MATLAB\R2026a`), así que todo lo que
sigue está verificado por ejecución, no por análisis estático.** `TestsValidacion.m` pasa 14/14 después
del último commit (13 originales + 1 nuevo del factor de seguridad). `DemoElemento.m` corre de punta a
punta con `@ElementoLoopVertical` en `GNormativaMaxima` y genera las 9 figuras.

---

## 1. El desvío de Gz (5.842 G): no se reproduce, y ninguna hipótesis es capaz de producirlo

### 1.1 El criterio de aceptación funciona

`"Gz objetivo del modo alcanzado"` vive en `ConstruirElemento.m/CriterioDeObjetivoDeG` (no en
`ChequeosPosteriores.m` como decía la consigna). Reconstruido de forma independiente en
`Diagnostico/DiagnosticoDesvioGz.m` da exactamente el mismo número que el reporte: **0.0041 G** para el
loop vertical con los defaults de `DemoElemento` (v₀ = 4.60 m/s, z₀ = 1.00 m, `RadioDelLoop` = 0.11 m,
método A, brazo 0.030 m). Con un desvío de 0.158 G el criterio daría **FALLA** (0.158 > 0.05). No hay bug
en el rango, en el objetivo ni en el filtrado de NaN.

### 1.2 El 5.842 no aparece en ninguna configuración probada

| Caso | Gz máx [G] | desvío [G] | criterio |
|---|---|---|---|
| defaults (v 4.6, R 0.11, A) | **6.0007** | 0.0041 | PASA |
| v = 3.5 / 4.0 / 4.5 / 5.0 / 6.0 | 6.017 / 6.005 / 6.001 / 5.9999 / 5.9996 | ≤ 0.019 | PASA |
| método B | 6.0007 | 0.0041 | PASA |
| R = 0.30 / 0.45 | 6.010 / 6.012 | ≤ 0.012 | PASA |
| `PuntoDeVerificacionNormativa = 'Cabeza'` | 6.004 | 0.009 | PASA |
| encadenado tras `layout_circuito.mat` | 6.0003 | 0.0033 | PASA |
| loop plano, roll extra 10°, d = 0, paso 0.01, 3 carros | 6.000 – 6.013 | ≤ 0.016 | PASA |
| HEAD~1, ~2, ~3, ~4 (79cf754 … aa6965a) | 6.0007 | 0.0041 | PASA |

El archivo `layout_de_un_elemento.mat` que quedó de la última corrida del usuario (22:12) era un **dive loop**
(Gz máx 6.0000), no un loop vertical, así que no se pudo recuperar la corrida exacta del 5.842.

**Candidato más plausible para el número:** la Gz máxima **en la cabeza** del dive loop a 6.0 m/s da
**5.841 G** (`GzCabeza`, brazo d + e = 0.060 m, informativo). Con brazo mayor la G del pasajero baja por el
factor (1 − b·κ) y la centrípeta del roll, y no hay ningún objetivo que la lleve a 6.0: es la lectura
esperada de esa curva. Si el 5.842 salió de otra combinación de parámetros, el script de diagnóstico
está parametrizado (`Constructores`, `VelocidadInicial`, `PosicionInicial`) para correrla.

### 1.3 Aporte de cada hipótesis al desvío de Gz en el arco (loop vertical, defaults)

Salida de `Diagnostico/DiagnosticoDesvioGz.m`:

| Hipótesis | Gz [G] | Gy [G] | Veredicto |
|---|---|---|---|
| **H1** φ'' de diseño (quíntica sola) vs medido (gradiente de φ' completo) | **0.0000** (analítico: φ'' no entra en Gz) | 0.051 arco / 0.096 elemento | no toca Gz; **sí explica otra falla, ver 1.4** |
| **H2a** fórmula cerrada `CargasEnLaVia` vs transporte completo `GTransportada` | 0.0000 | 0.009 | idénticas para Gz: ninguno de los términos de dω/dt tiene componente sobre U |
| **H2b** G registrada en la marcha RK4 vs G re-simulada (`SimularSobreTrack`) | 0.0041 | 0.054 | es todo el desvío: interpolación pchip de la geometría + velocidad de la marcha vs re-simulada |
| **H2c** a_t ≈ −g·Tz vs a_t numérica (hasta 5.3 m/s²) | 0 | 0.009 | solo entra en Gy por el término de Euler b·a_t·φ' |
| **H3** objetivo variable con la duración | 6.00 → 4.00 G en 3.89 s reales | — | el objetivo baja a partir de 1.00 s real (nodo 262 del arco); Gz máx 6.0007 está en el primer nodo del arco, donde el objetivo es 6.0 |
| **H4** método A vs B | 0.0000 | — | idénticos a 4 decimales (B: 11 iteraciones, residuo 1e-9) |

**Conclusión:** con el código actual, ninguna de las cuatro hipótesis mueve la Gz del arco más de
**0.004 G**. Un desvío de 0.158 G en el máximo no puede salir de H1 (φ'' no entra en Gz, exacto), de H2
(la fórmula cerrada y el transporte completo coinciden en Gz salvo interpolación) ni de H4 (A ≡ B). H3
sí explica que Gz **baje** de 6.0 después de 1 s real, pero no que el **máximo** sea menor que 6.0, porque
el máximo ocurre al inicio del arco.

Nota sobre H3 alternativa: si el reloj del modo arrancara en la clotoide de entrada (donde la
verificación empieza a contar el evento sostenido) el objetivo cambiaría hasta 0.74 G en el loop y 0.30 G
en el dive loop respecto del que usa el modo. Es la discrepancia ya documentada en
`documentacion_generador_elementos.md §5`; sigue sin corregirse, como pide la consigna.

### 1.4 Hallazgo colateral de H1: es la causa de la falla "Onset máximo de Gy" del loop vertical

El reporte del loop vertical en `GNormativaMaxima` tiene **`[FALLA] Onset maximo de Gy: 124.2 G/s`**
contra un presupuesto de 42.6 G/s. Descompuesto:

- jerk de Gy atribuible al término `b·v²·(φ''_medido − φ''_diseño)/g`: **114.6 G/s**, en el nodo 103
  (frontera clotoide de entrada → arco);
- jerk de Gy sin ese aporte: **9.6 G/s**, dentro del presupuesto;
- onset lateral que vio el lazo de diseño (`OnsetDelRecorrido`, que usa `GLateralVerificacion` con el
  φ'' incompleto): **2.6 G/s**.

Mecanismo: φ'' completo vale `φ''_quíntica + tan(α)·dκ/ds`. En las fronteras de sub-tramo `dκ/ds` salta
(11.1 1/m² en la clotoide → otro valor en el arco), con tan(α) = 0.111 el salto de φ'' es 1.23 rad/m², y
`b·v²·Δφ''/g` es un escalón de ~0.05–0.1 G en Gy que la simulación ve y el diseño no. El lazo de
realimentación de longitudes no puede corregirlo porque mide el onset sobre la G de diseño. **No se
corrigió** (fuera de la consigna); la corrección natural sería que `PuntoCinematico`/`DerivadaDeVia`
incluyan `tan(α)·dκ/ds` en `AceleracionRoll` (hace falta `dκ/ds` dentro del paso, que hoy no está
disponible) o que `OnsetDelRecorrido` mida sobre la G re-simulada.

### 1.5 Gx negativo (punto 9): es la resistencia, no el transporte

Descomposición en el punto de verificación (b = d), con `dv_cm/dt + g·Tz = g·(Tz − τ_hz) − F_res/(m·J)`:

| Aporte | Loop vertical máx / en Gx mín | Dive loop máx / en Gx mín |
|---|---|---|
| Cancelación gravedad/a_t (Tz − τ_hz, tangente del riel vs de la heartline) | 0.002 / 0.002 | 0.116 / 0.000 |
| Resistencia −F_res/(m·g·J) | **0.236 / −0.236** | **0.284 / −0.284** |
| Transporte de cuerpo rígido (resto) | 0.001 / −0.001 | 0.036 / −0.001 |
| Gx total | 0.234 / −0.234 | 0.284 / −0.284 |

El mínimo de Gx (−0.23 / −0.28 G) ocurre donde Gz = 6 G: la rodadura escala con la normal
(0.03–0.035 × 6 G ≈ 0.21 G) más el arrastre (0.028 G a v₀). Del orden de los `Crr` de `Parametros`, no
mayor. El transporte queda un orden de magnitud abajo (0.036 G en la transición de roll del dive loop).
El residuo de control de la descomposición es 1e-3 G (derivada numérica). **Nada que revisar.**

---

## 2. Dive loop "torcido" (punto 8): confirmado, no es un bug

`Diagnostico/DiagnosticoPlanitudDiveLoop.m`, distancia del riel a su mejor plano por SVD (arco y
clotoides), v₀ = 4.6 m/s, defaults:

| Modo | σ₃/σ₁ | RMS al plano | inclinación del plano vs vertical | ψ máx | peralte de salida | y de salida |
|---|---|---|---|---|---|---|
| Clotoide | 4e-31 | 0.000 mm | 0.00° | 0.00° | 0.00° | 0.000 m |
| FuerzaGConstante | 4e-31 | 0.000 mm | 0.00° | 0.00° | 0.00° | 0.000 m |
| GNormativaMaxima, Derecha | 2e-14 | 0.000 mm | **10.72°** | 10.72° | **−21.43°** | +0.181 m |
| GNormativaMaxima, Izquierda | 2e-14 | 0.000 mm | 10.72° | 10.72° | +21.43° | −0.181 m |

Lectura: en los tres modos la media vuelta es **plana** (a precisión de máquina). En los dos modos que
no persiguen Gy el plano es vertical y el carro sale derecho. En el normativo el plano queda inclinado
**exactamente ψ** respecto de la vertical: con el carro invertido a roll fijo, la única forma de sostener
una componente lateral de curvatura (el sub-peralte) es inclinar el plano entero del giro. Consecuencias
geométricas del Gy objetivo: salida desplazada 0.18 m de lado y carro peraltado **2ψ** (U gira π
alrededor de la normal del plano inclinado; el cálculo cierra: 21.43 / 10.72 = 2.00). El signo cambia con
`SentidoDelGiro`. Documentado en el docstring de `ElementoDiveLoop.m`.

---

## 3. Bugs encontrados de paso (reportados, NO corregidos)

### 3.1 La transición de roll gira "por el lado largo" cuando el roll de entrada y el objetivo cruzan ±π

`GenerarGeometria.m`: la longitud del acondicionamiento se dimensiona con `DeltaRoll` **envuelto** a
(−π, π] (`AjustarAngulo(RollObjetivo − EstadoEntrada.AnguloRoll)`), pero `PerfilRollDelElemento` llama a
`PerfilRollQuintico(EstadoEntrada.AnguloRoll, RollBase = RollObjetivo, …)`, que usa la diferencia
**sin envolver**. Caso que lo dispara: encadenar un loop vertical después del dive loop normativo (que sale
con roll = π y peralte −21.4°): Beta = −2.768, RollObjetivo = −2.768, DeltaRoll envuelto = +0.374 rad
(+21.4°), pero la quíntica recorre **−5.909 rad (−338.6°)** en una longitud dimensionada para 0.374 rad
→ φ' de hasta 6.9 rad/m, el lazo de onset infla `FactorLongitud` a 470, el acondicionamiento se alarga
a 5.0 m (Clotoide: 1.6 m) y **el carro se queda sin energía en la clotoide de entrada**. No aparece en
tests ni en `DemoLayout` porque el dive loop es siempre el último elemento y los otros salen con peralte
0. Corrección de una línea, pendiente de confirmación: en `PerfilRollDelElemento` usar
`RollBase = EstadoEntrada.AnguloRoll + DeltaRoll` (envuelto) en vez de `RollObjetivo`; los ángulos de
roll solo entran en cos/sin y en atan2 de componentes, así que un múltiplo de 2π no cambia nada aguas
abajo.

### 3.2 H1 como causa de la falla de onset lateral del loop vertical

Ver 1.4. Es un defecto real del lazo de diseño (la G de diseño no ve `tan(α)·dκ/ds`), pero solo afecta
Gy y solo en elementos helicoidales.

### 3.3 Menores

- El docstring de `LimitePorPunto` afirmaba que usaba "el mismo barrido de niveles que el chequeo de
  cumplimiento"; `VerificarLimitesNormativos` usa 60 niveles propios y `LimitePorPunto` 40. Corregido en
  el docstring (no en el código: el chequeo no pasa por `LimitePorPunto`).
- `CargasEnLaVia` es escalar (usa `^` y `*`); el diagnóstico la evalúa nodo a nodo. No se vectorizó.

---

## 4. Lo que se implementó, por punto

| Punto | Commit | Qué |
|---|---|---|
| 1 + 9 | `78a0a1e` | `Diagnostico/DiagnosticoDesvioGz.m`: H1–H4 nodo a nodo + descomposición de Gx, loop vertical y dive loop. No corrige nada. |
| 7 | `30f0c3b` | `AjustarParametros` **sí** emite `AjustarParametros:ParametroInerte` (verificado: avisa con `RadioDelDiveLoop` + loop, no avisa con dive loop ni con campos globales como `Masa`). `DemoElemento.m`: `Elegido = @ElementoLoopVertical`, `Ajustes.RadioDelLoop = 0.11` con los otros tres radios comentados, comentario genérico y advertencia explícita sobre el radio como longitud de Froude. |
| 6 | `a6227fb` | `LimitePorPunto(…, NumeroDeNiveles)` opcional, default 40; docstring sobre interpolación lineal vs escalera de cuantización. |
| 4 (doc) | `11d7c03` | Docstring de `PerfilRollDelElemento`: φ constante con torsión nula, crece solo por `Inclinacion·AnguloGirado`, pendiente dφ/dθ = tan(α). |
| 2, 3, 4, 6 | `46d3c93` | `GraficarElemento.m`: dos figuras nuevas (G y jerk contra tiempo del prototipo), `GraficarGConBanda`/`MarcarSubTramos` toman el eje horizontal; flechas U larga / L 0.4 + heartline punteada + leyenda corregida; ψ como tercera curva del roll con título y leyenda que distinguen φ / peralte / ψ; escalera con 400 niveles solo para dibujar. Un solo commit porque los cuatro puntos comparten el refactor del eje horizontal y no se separaban en commits que corrieran solos. |
| 5 | `5bd9ae1` | `Parametros.FactorDeSeguridadNormativo` (1.0, bloque 3, declarado en `ParametrosDeAceptacion`). Aplicado en `CurvaturaDelModo` (límite de Gz; en el dive loop los dos semiejes de la elipse y la curva de Gy) y en la reconstrucción del objetivo de `CriterioDeObjetivoDeG` (Gz y Gy). `VerificarLimitesNormativos` y `LimitePorPunto` sin tocar. Línea punteada "Objetivo de diseno: limite / FS" en los gráficos de G cuando FS ≠ 1. **Test 14** nuevo: con FS = 1.25 loop y dive loop ponen 4.80 G, criterios pasan, semiejes de la verificación sin escalar. Tests 12 y 13 (FS = 1.0) garantizan que el default es neutral: ningún test rompió. |
| 8 | `781147b` | `Diagnostico/DiagnosticoPlanitudDiveLoop.m` + docstring de `ElementoDiveLoop.m`. |
| — | `03e88d5` | README y `documentacion_generador_elementos.md §11`: 14 tests. |

**Convención del jerk contra tiempo (punto 2):** contra arco se dibuja el jerk **del modelo** contra
`Escala.OnsetMaximo` (= √λ × norma); contra tiempo del prototipo se dibuja el jerk **del prototipo**
(`Sim.JerkG* / Escala.RaizLambdaLoop`) contra `Parametros.OnsetNormativoPorEje` literal. Cada figura lo
dice en el título; no se mezclan.

**Lo que NO se hizo, a propósito:** no se corrigió el desvío de Gz (no hay desvío que corregir con el
código actual), no se aplicó el factor en la verificación, no se cambió la convención del eje de roll,
no se borraron los gráficos contra arco, no se arreglaron los bugs de la sección 3.

---

## 5. Cómo reproducir

```matlab
run('Diagnostico/DiagnosticoDesvioGz.m')         % H1-H4 + Gx, loop vertical y dive loop
run('Diagnostico/DiagnosticoPlanitudDiveLoop.m') % planitud del dive loop por modo
run('TestsValidacion.m')                          % 14/14
run('DemoElemento.m')                             % loop vertical normativo, 9 figuras
```

Para el bug 3.1: `DemoElemento.m` con `ArchivoLayoutPrevio = 'layout_de_un_elemento.mat'` después de haber
corrido el dive loop en `GNormativaMaxima`.

---

## 6. Commits de la rama

```
03e88d5 Docs: el conteo de tests pasa a catorce con el del factor de seguridad
781147b El dive loop torcido es el Gy objetivo, no un bug: plano inclinado psi, salida peraltada 2*psi
5bd9ae1 Factor de seguridad normativo: el modo persigue la norma / FS, la verificacion sigue literal
46d3c93 Graficos: G y jerk contra tiempo del prototipo, marco del carro legible, psi en el perfil de roll
11d7c03 GenerarGeometria: el docstring de PerfilRollDelElemento deja de sugerir que phi crece siempre
a6227fb LimitePorPunto: el numero de niveles es un argumento opcional
30f0c3b DemoElemento: el bloque de ajustes geometricos deja de mencionar un elemento fijo
78a0a1e Diagnostico del desvio de Gz en modo normativo: H1-H4 y descomposicion de Gx
```

Quedan sin commitear, como estaban: `ParametrosPorDefecto.m` con `CalcularVelocidadMinima = false` (cambio
local del usuario, no se tocó) y `Claude outputs/consigna-code-graficos-roll-fs.md`.
