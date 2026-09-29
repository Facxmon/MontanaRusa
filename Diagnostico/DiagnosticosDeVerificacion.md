# Diagnósticos de verificación y del panel (2026-09-29)

Reporte de lo que se investigó **sin cambiar geometría ni física**: el origen del límite 0 del
bounding box (A3), dónde vive el radio de referencia (A5), la auditoría de categorías del panel (A6),
la ley de curvatura de las "clotoides" (B1), el peralte del over-banked turn (B2) y la línea de base
de las líneas de límite normativo de los gráficos (B3), que es la referencia del reporte antes/después
de la corrección de los límites normativos.

Todos los números salen de los golden files generados por MATLAB (`golden/`) y del port en TypeScript
(`web/src/nucleo/`), que los reproduce dentro de las tolerancias del contrato (§8). Donde se dice
"DemoLayout" es `golden/circuito-demolayout.json`: `RadioDelLoop = 0.30 m`, entrada en `[0 0 1]` a
4,5 m/s, Clotoide, LoopVertical → OverBankedTurn → Hélice → DiveLoop. Es el mismo diseño que el
guardado del visualizador `{"v":1,"p":{"RadioDelLoop":0.3},...}` con los cuatro elementos por defecto.

Tiempos de referencia del DemoLayout (tiempo del modelo acumulado, `t`, y del prototipo, `tp`):

| Elemento | Empieza en `t` | Duración del modelo | `factorTiempo` = √λ | Empieza en `tp` |
|---|---|---|---|---|
| 1. LoopVertical | 0 s | 0,7272 s | 5,16398 | 0 s |
| 2. OverBankedTurn | 0,7272 s | 0,8290 s | 3,16228 | 3,755 s |
| 3. Hélice | 1,5562 s | 1,7715 s | 3,38062 | 6,377 s |
| 4. DiveLoop | 3,3276 s | 0,7394 s | 4,21637 | 12,366 s |

---

## A3. "Dentro del bounding box disponible": por qué el límite vale 0

**Conclusión: no es un bug del port ni de los defaults de JS. El valor viene así de MATLAB y no se
tocó.**

El criterio no compara una dimensión contra otra: compara el **desborde** contra cero.
`ChequeosPosteriores.m`, líneas 66-69 (y su port en `verificacion.ts`):

```matlab
Sobresale = max([Caja(:,1).' - min(Track.PuntosRiel, [], 1), max(Track.PuntosRiel, [], 1) - Caja(:,2).']);
Criterios = AgregarCriterio(Criterios, 'Dentro del bounding box disponible', 'MenorOIgual', Sobresale, 0, 'm', ...
    'Maximo desborde sobre cualquiera de las seis caras.');
```

`Valor` es cuánto sale el riel por la cara más comprometida de `BoundingBoxDisponible`
(`[-2 2; -2 2; 0 1.5]` m) y `Limite` es 0 por construcción: "0,017 m ≤ 0,000 m, margen −0,017 m" se lee
"el riel sale 17 mm de la caja". Los once golden de MATLAB traen `limite: 0` en este criterio (por
ejemplo, el LoopVertical del DemoLayout sale 0,179 m por la tapa: arranca en z = 1 m y la heartline
sube 0,619 m, con la caja hasta 1,5 m). El tamaño de la caja no se cambió.

Lo que sí confunde es la lectura "valor ≤ 0,000 m": queda anotado como propuesta de presentación en
A6 (fila de `BoundingBoxDisponible`), sin aplicar.

## A5. "Radio de referencia": ¿es un único valor por diseño?

**Conclusión: no. En el modelo `RadioDeReferencia` es por elemento, así que no se movió.**

- Cada constructor lo pisa con su propio radio antes de generar: `ElementoLoopVertical.m:26`
  (`= RadioDelLoop`), `ElementoDiveLoop.m:55`, `ElementoHelice.m:29`, `ElementoOverBankedTurn.m:31`;
  en JS, `elementos.ts` hace lo mismo en los cuatro constructores.
- Es la longitud característica de Froude **de cada elemento**: fija su λ (`EscalasDeFroude`), su
  presupuesto de onset y su `factorTiempo`. En el DemoLayout vale 0,30 / 0,80 / 0,70 / 0,45 m, y por
  eso los `factorTiempo` de la tabla de arriba son distintos.
- Consecuencia práctica: el campo "Radio de referencia" que el panel muestra en el modo Clotoide
  (lo declara `ParametrosDelModo('Clotoide')`) **no tiene efecto**: cualquier valor que se escriba lo
  sobrescribe el elemento. Queda como propuesta en A6.
- El parámetro que sí es único por diseño es `RadioDeReferenciaReal` ("Radio de referencia real
  (prototipo)", 8 m), y ya está en Parámetros generales. Si el pedido se refería a ese, no hay nada
  que mover.

## A6. Auditoría de categorías del panel (propuestas; **aplicadas** en la segunda tanda, ver Seguimiento)

Estado actual del panel: ficha de la instancia (modo de curvatura + parámetros del modo + geometría
del elemento) y parámetros globales en cuatro grupos: *Modo de curvatura*, *Criterios de aceptación*,
*Generales* y *Avanzado — numérico* (`etiquetas.ts`, `grupo: 'solver'`). Lo único condicional hoy es
lo que declara `ParametrosDelModo` y, desde esta rama, `FactorDeSeguridadNormativo` (A4).

| Parámetro | Grupo actual | Propuesta | Condición para mostrarlo | Motivo (evidencia) |
|---|---|---|---|---|
| `RadioDeReferencia` | Modo (Clotoide) y ficha | Mostrarlo de solo lectura como "= radio del elemento", o sacarlo del panel | — | Inerte: lo pisa cada elemento (A5). Sacarlo de `ParametrosDelModo` es un cambio de MATLAB. |
| `TolObjetivoDeG` | Criterios de aceptación | Igual | Modo `FuerzaGConstante` o `GNormativaMaxima` en uso | Solo lo leen `CurvaturaDelModo` (normativa) y el criterio "Gz objetivo del modo alcanzado", que existe en esos dos modos. |
| `FactorDeSeguridadNormativo` | Criterios de aceptación | Igual | `GNormativaMaxima` en uso | **Aplicado** (A4). |
| `SemianchoDeSuavizadoNormativo` | Modo | Igual | `GNormativaMaxima` | Ya condicional. |
| `OnsetMaximoModelo` | Criterios de aceptación | Avanzado | — | Override del presupuesto derivado de Froude; no es un criterio que se fije por diseño. |
| `ArcoMinimoAutointerferencia` | Criterios de aceptación | Avanzado — numérico | — | Es una exclusión de vecinos por construcción, no un criterio físico. |
| `AlturaMaximaDelElemento`, `RadioMinimoFabricable`, `AlturaMinimaSuelo`, `BoundingBoxDisponible`, `DistanciaMinimaEntreVias` | Criterios de aceptación | Subgrupo "Fabricación y espacio" | — | Así los agrupa `ParametrosPorDefecto.m` (bloque 3, "Fabricación y espacio", "Interferencia"). En `BoundingBoxDisponible`, aclarar en la ayuda que el criterio compara el **desborde** contra 0 (A3). |
| `GMinimaCuspide`, `PuntoDeVerificacionNormativa`, `OnsetNormativoPorEje` | Criterios de aceptación | Subgrupo "Norma" | — | Son los que fijan contra qué se verifica. |
| `MetodoDeAcoplamiento`, `CalcularVelocidadMinima` | Generales | Avanzado (resolución) | — | Opciones del solver, no del diseño (`ParametrosGenerales.m` los rotula "Resolución"). |
| `PasoGeneracion`, `PasoSimulacion` | Generales | Avanzado — numérico | — | Discretización. |
| `PasoBusquedaVelocidad` | Generales | Avanzado — numérico | `CalcularVelocidadMinima = true` | Solo lo lee la bisección de velocidad mínima (`elementos.ts`, `VelocidadInicialMinimaDe`). |
| `RhoAire`, `CoefArrastre`, `AreaFrontal` | Generales | Subgrupo "Resistencia al avance" | `ModelarArrastre = true` | Solo entran al término de arrastre (`basicos.ts`). |
| `FactorTren` | Generales | Subgrupo "Resistencia al avance" | `ModelarArrastre = true` y `NumeroDeCarros > 1` | Arrastre de cada carro detrás del primero. |
| `DiametroRueda` | Generales | Revisar si se muestra | — | No lo lee ningún cálculo (ni MATLAB ni JS): es solo documentación del piso de rodamientos. |
| `VersoresEnGrafico3D` | Avanzado — numérico | Ocultar en la web | — | Solo lo usan `GraficarElemento.m`/`GraficarLayout.m`; la vista 3D web no lo lee. |
| `ToleranciaVelocidadDeDiseno` | Avanzado — numérico | Igual | — | Solo dispara el aviso de re-simulación. |
| `InclinacionHelicoidalImpuesta` | Generales | Ficha de la instancia (geometría avanzada) | — | Es geometría (la lee `GenerarGeometria` para cualquier elemento) y ya se puede ajustar por instancia. |
| `RadioDeReferenciaReal`, `LargoCarroReal` | Generales | Subgrupo "Escala (prototipo)" | — | Anclan λ de Froude, y con él toda conversión de duración y onset; conviene que se vean juntos. |
| `DistanciaHeartlineACabeza` | Generales | Igual | — | Siempre se usa para la G informativa de la cabeza; con `PuntoDeVerificacionNormativa = 'Cabeza'` además se verifica. |
| `Gravedad` | Generales | Avanzado | — | Constante física. |
| Geometría de cada elemento | Ficha | Igual | Ya por elemento | Correcto. |

## B1. "Clotoide": ¿curvatura lineal en el arco?

**Conclusión: MATLAB y JS coinciden; ninguno tiene curvatura lineal, a propósito. No se tocó nada.**

Hay dos cosas distintas que se llaman "clotoide":

1. **El modo de curvatura `Clotoide`** no es una espiral: es un arco de **radio constante**. Lo dice
   `ParametrosPorDefecto.m` ("`'Clotoide'` radio de la heartline constante (no depende de v)"). El
   nombre viene de que el elemento se arma con transiciones de entrada y salida, no de la ley del arco.
   En el `ArcoPrincipal` la curvatura del riel es exactamente constante (dκ/ds = 0 en todos los nodos).
   Lo que se reporta ("tiene radio constante") es correcto y es el diseño.
2. **Los sub-tramos `ClotoideEntrada` y `ClotoideSalida`** son rampas **smoothstep** (entrada,
   3u² − 2u³) y **Hermite cúbica** (salida, que con el arco de radio constante se reduce a la misma
   smoothstep invertida), no lineales. Está documentado en `GenerarGeometria.m` (cabecera y
   `MezclaDeClotoide`: "Se las sigue llamando clotoides por su rol, no por su ley") y en
   `memoria_de_calculo.md` §7.8: con roll helicoidal, φ'' hereda dκ/ds y la rampa lineal daba un
   escalón de Gy de ~0,1 G.

Evidencia (curvatura del **riel**, que es la curva que se integra; u = fracción del sub-tramo):

| Caso | Sub-tramo | L [m] | κ₀ → κ₁ [1/m] | κ(0,25)/κ₁ | máx \|κ − lineal\| | máx \|κ − smoothstep\| |
|---|---|---|---|---|---|---|
| loop-clotoide, MATLAB | ClotoideEntrada | 0,736 | 0 → 3,0302 | 0,156 | 0,293 (9,7 %) | 7,2e-3 |
| loop-clotoide, JS | ClotoideEntrada | 0,736 | 0 → 3,0302 | 0,156 | 0,293 (9,7 %) | 7,2e-3 |
| loop-clotoide, MATLAB | ClotoideSalida | 0,518 | 3,0303 → 0 | 0,843 | 0,292 (9,6 %) | 1,7e-5 |
| loop-clotoide, JS | ClotoideSalida | 0,518 | 3,0303 → 0 | 0,843 | 0,292 (9,6 %) | 2,2e-15 |
| DemoLayout LoopVertical, MATLAB = JS | ClotoideSalida | 0,421 | 3,0303 → 0 | 0,842 | 0,292 (9,6 %) | 1,4e-5 / 1,2e-14 |
| DemoLayout OverBankedTurn, MATLAB = JS | ClotoideSalida | 0,157 | 1,2074 → 0 | 0,839 | 0,116 (9,6 %) | 5,7e-6 / 2,6e-15 |
| DemoLayout Hélice, MATLAB = JS | ClotoideSalida | 0,221 | 1,3801 → 0 | 0,841 | 0,133 (9,6 %) | 3,5e-4 / 5,8e-15 |
| DemoLayout DiveLoop, MATLAB = JS | ClotoideSalida | 0,684 | 2,0833 → 0 | 0,842 | 0,200 (9,6 %) | 5,5e-5 / 2,7e-15 |

Una rampa lineal daría κ(0,25)/κ₁ = 0,25 a la entrada y 0,75 a la salida; la smoothstep da 0,156 y
0,844, que es lo que se mide. El desvío máximo contra la recta es ≈ 9,6 % de Δκ, que es el máximo
teórico de 3u² − 2u³ contra u (0,096 en u ≈ 0,21). El residuo contra la smoothstep en la entrada
(≈ 1e-2) es porque el objetivo de la mezcla es la curvatura del modo proyectada, que varía un poco con
v y con U dentro de la rampa. La curvatura de la **heartline** (`nodos.curvatura`, derivada) oscila
alrededor de la del riel con picos de dκ/ds de ±400 1/m² nodo a nodo; eso es ruido de la derivación
numérica del export y no cambia esta conclusión.

## B2. Over-banked turn: peralte contra la fuerza específica

**Conclusión: hay sobreperalte, no subperalte, y el mecanismo no es el del dive loop. No se tocó
nada.**

Método: en cada nodo, en el plano normal a la tangente, se mide el ángulo de U respecto de la
vertical proyectada hacia el centro del giro (θ_U, "peralte real") y el de la fuerza específica total
**F** = g·(Gx·T + Gy·L + Gz·U) en el punto de verificación (θ_F, "peralte ideal": el que alinearía U
con F). Δθ = θ_U − θ_F > 0 es **sobreperalte**. Se separa además Gy en lo que aporta la aceleración
del riel más la gravedad, (v²κ + g·ẑ)·L/g, y lo que aporta el transporte por el roll (Euler y
centrípeta a la distancia d = 0,03 m del eje de roll, que es el riel).

DemoLayout, elemento 2 (OverBankedTurn, Clotoide, R = 0,80 m, peralte 110°, v de 3,78 a 3,20 m/s):

| Sub-tramo | `t` [s] | Peralte θ_U | θ_F | Δθ (sobreperalte) | Gy [G] | Aporte del roll a Gy [G] | ∠(κ, U) |
|---|---|---|---|---|---|---|---|
| AcondicionamientoEntrada (roll 0 → 110° en recta) | 0,727-1,030 | 0 → 110° | — (sin curvatura) | — | +0,33 → −1,39 | −0,41 a +0,40 | — |
| ClotoideEntrada | 1,032-1,080 | 110° | 17° → 60° | 93° → 50° | −1,04 → −1,53 | ≤ 0,02 | −20° |
| ArcoPrincipal | 1,09-1,50 | 110° | 59,5° → 53,2° | **50,5° → 56,8°** | **−1,52 → −1,40** | ≈ 0,02 | −20° |
| ClotoideSalida | 1,52-1,556 | 110° | 47° → 11° | 63° → 99° | −1,31 → −0,94 | ≈ 0 | −20° |

Elementos sueltos a 5 m/s y 240° (casos `obt-*`): en Clotoide el sobreperalte del arco es de 39° a 49°
con Gy entre −1,55 y −1,93 G (aporte del roll ≤ 0,035 G); en GNormativaMaxima es de 28,5° con
Gy = −3,23 G (aporte del roll ≈ 0,22 G).

Lectura:

- El peralte es un **parámetro geométrico fijo** (`PeralteDelGiro` = 110°), mientras que el que
  alinearía el carro con la fuerza en el arco es ≈ 53-60° a esas velocidades. El carro está ≈ 50-57°
  más volcado hacia el centro que la resultante, y la diferencia aparece como Gy ≈ −1,4 a −1,5 G.
- **Casi toda la Gy es del balance centrípeta + gravedad sobre el riel** (−1,44 a −1,55 G); el
  término de rotación alrededor del eje de roll aporta ≈ +0,02 G en el arco. No hay una desalineación
  con el centro instantáneo de rotación que infle la Gy: la infla el sobreperalte.
- ∠(κ, U) = −20° en todo el elemento, constante: es `DesfasajeDeCurvatura` (90°, curvatura
  horizontal) menos el roll (110°), por construcción. En el **dive loop en `GNormativaMaxima`** la
  desalineación ψ la **resuelve el modo** para producir un Gy objetivo (subperalte buscado); en el
  over-banked turn no la resuelve nadie, sale del peralte que se eligió. No es el mismo mecanismo.
- Donde el roll sí pesa es en el `AcondicionamientoEntrada` (el roll pasa de 0° a 110° sobre riel
  recto): ahí el transporte aporta hasta ±0,4 G y la gravedad, a medida que el carro se vuelca, lleva
  Gy a −1 G. El elemento termina peraltado a 110° en recta (Gy = −sen 110° = −0,94 G) y la Hélice que
  sigue lo lleva a su peralte en su propio acondicionamiento.
- En el DemoLayout (Clotoide) el dive loop no tiene Gy en el arco (≈ 0): la Gy del DiveLoop del
  circuito es solo la de su acondicionamiento de roll (de 55° a 180°), hasta −0,90 G.

## B3. Líneas de límite normativo: estado actual (línea de base)

Esta tabla describe el comportamiento **antes** de corregir los límites normativos; es la
referencia del reporte antes/después. Todo lo de esta sección se calcula en `web/src/graficos/series.ts`
(`figuraDeG`), por **tramo** (un tramo = un elemento) y en tiempo del **modelo** de cada elemento
escalado por su `factorTiempo`. El espejo en MATLAB es `GraficarElemento.m` con `LimitePorPunto.m`.

### Qué es cada línea

| Gráfico | Línea | Función | Tipo | Qué la hace cambiar | Valores |
|---|---|---|---|---|---|
| Gx | Admisible dure lo que dure | `limiteNormativo('MasGxBase' / 'MenosGxBase', 40)` | Fija (extremo largo de la tabla, 40 s) | Nada | +2,5 / −1,5 G |
| Gx | Límite a 200 ms | `limiteNormativo('MasGxBase' / 'MenosGxBase', 0.2)` | Ventana de 200 ms (extremo corto de la tabla) | Nada | +6,0 / −2,0 G |
| Gx | Límite aplicable | `limitePorPunto(Gx, t, curva, factorTiempo, ±1, 400)` | Dependiente del estado | Nivel de G del nodo (cuantizado en 400 niveles del máximo del elemento), duración del evento continuo que lo contiene **dentro del elemento**, `factorTiempo` del elemento | +6,0 / −1,5 a −2,0 G |
| Gy | Admisible dure lo que dure | `limiteNormativo('GyBase', 40)` | Fija | Nada | ±2,0 G |
| Gy | Límite a 200 ms | `limiteNormativo('GyBase', 0.2)` | Ventana de 200 ms | Nada | ±3,0 G |
| Gy | Límite aplicable | `limitePorPunto(Gy, t, 'GyBase', factorTiempo, ±1, 400)` | Dependiente del estado | Ídem Gx | +2,12 a +3,0 / −2,0 a −3,0 G |
| Gz | Admisible dure lo que dure | `limiteNormativo(curvaMasGz / 'MenosGzBase', 40)` | Fija | `curvaMasGzAplicada` del elemento (las dos curvas valen 2,0 a 40 s) | +2,0 / −1,1 G |
| Gz | Límite a 200 ms | `limiteNormativo(curvaMasGz / 'MenosGzBase', 0.2)` | Ventana de 200 ms | `curvaMasGzAplicada` del elemento: 6,0 (`MasGzTodas`) o 5,0 (`MasGzReducido`) | +6,0 / −2,0 G |
| Gz | Límite aplicable | `limitePorPunto(Gz, t, curvaMasGz, factorTiempo, ±1, 400)` | Dependiente del estado | Ídem Gx, más `curvaMasGzAplicada` | +3,0 a +6,0 / −1,5 a −2,0 G |

Las dos primeras de cada gráfico son constantes por tramo (`porTramo` + `constante`); en el DemoLayout
no cambian nunca (todos los elementos tienen `curvaMasGzAplicada = MasGzTodas`). Solo la tercera cambia
de valor. El veredicto **no** sale de estas líneas: sale de `PeorEventoSostenido` (60 niveles, descarta
eventos de menos de 0,2 s de prototipo), mientras que el gráfico lleva esos eventos a 0,2 s.

Cantidades en el DemoLayout (6877 nodos sin repetir los empalmes):

| Serie | Nodos con límite | Sin límite (NaN) | Cambios de valor | Rango |
|---|---|---|---|---|
| +Gx aplicable | 366 | 6511 | 0 | 6,000 (en nodos con Gx ≈ +0,001 G: ruido) |
| −Gx aplicable | 6509 | 368 | 761 | −2,000 a −1,500 |
| +Gy aplicable | 2428 | 4449 | 424 | 2,117 a 3,000 |
| −Gy aplicable | 4397 | 2480 | 346 | −3,000 a −2,000 |
| +Gz aplicable | 6046 | 831 | 772 | 3,000 a 6,000 |
| −Gz aplicable | 827 | 6050 | 343 | −2,000 a −1,500 |

### Dónde cambia el "Límite aplicable" en el DemoLayout (saltos de más de 0,2 G)

`t` es tiempo del modelo acumulado; `tp`, del prototipo. "G" es el valor del nodo donde cambia.

**+Gz**

| `t` [s] | `tp` [s] | Límite | G del nodo | Por qué |
|---|---|---|---|---|
| 0,353 / 0,371 | 1,82 / 1,91 | 4,37 → 4,00 → 4,32 | 0,69 | LoopVertical, cúspide (Gz mínima 0,68 G): esos nodos pertenecen al evento de todo el elemento (3,76 s de prototipo → 4,0 G); los vecinos, un poco más arriba, a eventos más cortos. |
| 0,728 | 3,76 | 4,85 → 6,00 | 1,00 | Empalme Loop → OBT: el evento se corta en el elemento y el OBT arranca uno nuevo, corto (→ límite de 200 ms). |
| 0,882 / 1,034 | 4,25 / 4,73 | 6,00 → sin límite → 4,81 | 0,00 | OBT: Gz pasa por cero (tramo de −Gz). |
| 1,539 / 1,676 | 6,32 / 6,78 | 4,81 → sin límite → 3,00 | 0,00 | Tramo de −Gz que cruza el empalme OBT → Hélice (1,556 s): queda partido en dos eventos, uno por elemento. |
| **1,835** | 7,32 | 3,14 → 6,00 | 1,478 | Hélice: nodos unas milésimas de G por encima del valle pertenecen a eventos cortos (joroba de 1,59 G). |
| **2,144** | 8,37 | 5,91 → 3,14 | 1,471 | Hélice: fondo del valle de 1,468 G; esos nodos pertenecen al evento de toda la meseta (1,83-3,27 s, 4,86 s de prototipo → 3,14 G). |
| **2,240** | 8,69 | 3,14 → 4,00 | 1,471 | Hélice: vuelve a un evento más corto (joroba de 1,80 G). |
| 3,273 | 12,18 | 4,00 → 3,14 | 1,462 | Hélice, fin de la meseta. |
| 3,328 | 12,37 | 3,00 → 6,00 | 0,57 | Empalme Hélice → DiveLoop: evento nuevo y corto en el DiveLoop. |
| 3,406 / 3,629 | 12,70 / 13,64 | 6,00 → sin límite → 4,31 | 0,01 / 0,04 | DiveLoop: Gz cruza cero (invertido). |

**−Gz**

| `t` [s] | `tp` [s] | Límite | G del nodo | Por qué |
|---|---|---|---|---|
| 0,883 / 1,034 | 4,25 / 4,73 | sin límite → −1,54 → sin límite | −0,002 / +0,016 | OBT: único tramo de −Gz del elemento. |
| 1,539 / 1,675 | 6,32 / 6,78 | sin límite → −2,00 … −1,67 → sin límite | −0,003 / +0,001 | Evento que cruza el empalme OBT → Hélice (1,556 s, Gz ≈ −0,34 G): partido en dos, cada mitad con su duración. |
| 3,407 / 3,628 | 12,70 / 13,63 | sin límite → −1,50 → sin límite | −0,006 / −0,002 | DiveLoop invertido. |

**+Gy / −Gy**: 77 y 14 saltos respectivamente. Los de +Gy se concentran en el DiveLoop entre
t = 3,620 y 3,747 s (tp = 13,60 a 14,12 s): la Gy positiva del elemento es ruido numérico (máximo
2,5e-13 G), y aun así `limitePorPunto` barre niveles desde ese máximo y dibuja un **peine** que alterna
entre 2,1 y 3,0 G nodo a nodo. Lo mismo, con otro origen, en −Gy: el tramo de la OBT
(t = 0,818-1,847 s) salta entre −2,0 / −3,0 / −2,31 G en los empalmes y en los bordes de la meseta de
−1,4 G. La verificación tiene el mismo síntoma: el LoopVertical reporta un nivel crítico de Gy de
0,0014 G.

**±Gx**: +Gx tiene límite (6,0 G) solo en dos tramos donde Gx ≈ +0,001 G (OBT, t = 0,850-0,944 s, y
DiveLoop, t = 3,393-3,521 s): ruido. −Gx salta entre −1,5 y −2,0 G en 18 lugares: en los empalmes
(0,728, 1,557 y 3,328 s, donde el evento se corta y el elemento siguiente arranca uno corto), en los
cruces por cero de esos mismos dos tramos y en bordes de mesetas de −0,05 a −0,07 G (Hélice,
1,785-2,965 s).

### Gráfico contra veredicto (antes)

- LoopVertical, +Gz: pico 6,42 G, por encima de 6,0 G durante 0,187 s de prototipo. La verificación lo
  descarta (< 0,2 s) y el loop **pasa**, con el peor evento en 5,887 G / 0,2147 s / exceso −0,113 G. El
  gráfico lo lleva a 0,2 s y dibuja 6,0 G: la curva de Gz queda **por encima** del límite aplicable en
  un elemento que pasa.
- Evento −Gz OBT → Hélice (t ≈ 1,52-1,66 s): partido en dos eventos, uno por elemento; la duración se
  subestima en los dos.
- 7.1.6 (reversiones en X e Y) no está implementado en ningún lado.

---

## Después: reporte antes/después de la corrección de los límites normativos

Estado después de aplicar, en MATLAB y en el port, las cinco reglas de la memoria de cálculo §5.7:
**A** eventos de menos de 200 ms contra el límite de 200 ms; **B** eventos de corrido en todo el layout;
**C** umbral de 0,01 G; **D** reversiones en X e Y (7.1.6); y 7.1.7.1 literal. Golden regenerados con
`GenerarGoldenFiles.m`.

### Veredictos

En los once golden cambia **un solo** `criterios[].pasa`:

| Caso | Elemento | Criterio | Antes | Después | Causa |
|---|---|---|---|---|---|
| circuito-demolayout (= caso de prueba) | LoopVertical | +Gz (Fig. 10) | pasa: 5,887 G / 0,215 s / exceso −0,113 G | **no pasa**: 6,422 G / 0,20 s / exceso **+0,422 G** | A: el pico de 6,42 G dura 0,187 s de prototipo por encima de 6,0 G y ya no se descarta |

Se agregan en todos los elementos `Reversiones de Gx (7.1.6)` y `Reversiones de Gy (7.1.6)`, informativos
(D): ningún par de eventos sostenidos de signo opuesto baja de 0,2 s entre picos en ningún golden. En el
caso de prueba el más rápido es 0,381 s (ver abajo). `+Gx (Fig. 6)` de los dos dive loop sueltos pasa de
`MenorOIgual` a `Informativo` (C: su +Gx máximo es 0,009 G, bajo el umbral); los dos pasan antes y después.

### Valores del DemoLayout que cambian (todos siguen pasando salvo el de arriba)

| Elemento | Criterio | Antes | Después | Causa |
|---|---|---|---|---|
| LoopVertical | Gy (Fig. 8) | nivel crítico **0,0014 G**, exceso −2,551 | nivel crítico 0,01 G, exceso −2,637 | C: la grilla arranca en 0,01 G |
| LoopVertical | −Gx (Fig. 7) | −1,326 | −1,328 | B: el evento sigue en el OBT (duración más larga 3,76 → 4,12 s) |
| OverBankedTurn | +Gz (Fig. 10) | 0,89 G / 1,44 s → exceso −4,235 | 0,74 G / 2,02 s → −3,258 | B: el evento +Gz que viene del loop sigue en el OBT |
| OverBankedTurn | −Gz (Fig. 9) | −0,15 G / 0,40 s → −1,513 | −0,12 G / 0,42 s → −1,514 | B y C |
| OverBankedTurn | +Gx (Fig. 6) | 0,02 G → −5,979 | 0,04 G → −5,956 | C (y A: eventos cortos a 0,2 s) |
| OverBankedTurn | −Gx (Fig. 7) | −1,395 | −1,394 | B |
| Hélice | −Gz (Fig. 9) | −0,18 G / 0,32 s → −1,622 | −0,13 G / 0,38 s → −1,560 | B: el −Gz que cruza el empalme OBT → Hélice (1,556 s) es un solo evento (0,398 → 0,448 s) |
| Hélice | Gy (Fig. 8) | 1,19 G / 0,21 s → −1,810 | 0,93 G / 2,53 s → −1,070 | B: la meseta de −Gy del OBT sigue en la Hélice (evento de 6,05 s) |
| DiveLoop | +Gz (Fig. 10) | 5,36 G / 0,20 s → −0,641 | 5,74 G / 0,20 s → −0,258 | A: el pico del arco (5,74 G, menos de 0,2 s) ahora se evalúa |
| DiveLoop | Gy (Fig. 8) | 0,84 G / 0,23 s → −2,160 | 0,90 G / 0,20 s → −2,099 | A |
| DiveLoop | ±Gx | −5,959 / −1,336 | −5,950 / −1,334 | A, B y C |

### Líneas de los gráficos (tabla B3, después)

| Línea | Antes | Después | Causa |
|---|---|---|---|
| Admisible y 200 ms | Constantes por elemento | Iguales en el DemoLayout; la de 200 ms de +Gz pasa a ser nodo a nodo (5,0 G en una ventana de 7.1.7.1) | 7.1.7.1 |
| +Gz aplicable, empalme Loop → OBT (0,728 s) | 4,85 → 6,00 G | sin salto | B |
| +Gz aplicable, empalme Hélice → DiveLoop (3,328 s) | 3,00 → 6,00 G | sin salto | B |
| −Gz aplicable, evento OBT → Hélice (1,539-1,675 s) | dos eventos: −2,00 y −1,67 G | un evento: −1,59 G de corrido | B |
| +Gz aplicable, valle de la Hélice (1,835 / 2,109 / 2,275 s) | 3,14 → 6,00 → 3,14 → 4,00 G | igual (3,135 → 6,0 → 3,135 → 4,0 G) | Correcto: es el límite a su propio nivel, no una envolvente; la leyenda ahora lo aclara |
| +Gz aplicable, jorobas de la Hélice (2,67-3,19 s) | escalera fina | escalera en pasos de 0,3-0,4 G | La grilla de 400 niveles es ahora sobre el máximo del layout (6,42 G), no del elemento (1,80 G) |
| +Gy aplicable, DiveLoop (3,62-3,75 s) | peine de 2,1 a 3,0 G, 77 saltos | sin límite (Gy máxima 2,5e-13 G) | C |
| +Gy aplicable, todo el layout | 2428 nodos, 424 cambios | 1341 nodos, 100 cambios | C |
| +Gx aplicable | 366 nodos (Gx ≈ 0,001 G) | 319 nodos, todos con Gx ≥ 0,01 G | C |
| LoopVertical, +Gz | la curva queda por encima del límite en un elemento que pasa | por encima del límite y el elemento no pasa | A |

### Reversiones (7.1.6) en el caso de prueba

Eventos sostenidos de Gy en la línea de tiempo del layout (tiempo del modelo acumulado; entre paréntesis,
del prototipo):

| Evento | Intervalo | Pico | Pico a pico con el anterior |
|---|---|---|---|
| −Gy (fin del Loop) | 0,648-0,719 s (3,346-3,713 s), 0,367 s | −0,035 G en 0,680 s | — |
| +Gy (acondicionamiento del OBT) | 0,728-0,816 s (3,758-4,035 s), 0,276 s | +0,326 G en 0,770 s | **0,381 s** |
| −Gy (OBT y Hélice, de corrido) | 0,818-2,691 s (4,041-10,212 s), 6,17 s | −1,527 G en 1,073 s | 0,959 s |

Ningún par baja de 0,2 s: la reducción no se activa, como se esperaba. **Diferencia con el valor
esperado de 0,54 s:** ese número mide desde +0,33 G (0,78 s) hasta el mínimo **local** de −1,39 G al final
del acondicionamiento (0,95 s). La implementación toma el pico del evento, que es el máximo de |Gy| de
todo el evento continuo, y ese evento sigue por el arco del OBT y la Hélice: su pico es −1,527 G a 1,073 s,
a 0,959 s. Además, con el umbral de 0,01 G, el −0,035 G del final del loop es un evento sostenido y forma
con el +0,33 G la reversión más rápida (0,381 s).

---

## Seguimiento (segunda tanda, 2026-09-29): qué se hizo con A6, B1, B2 y 7.1.7.1

Donde arriba dice "modo `Clotoide`" se refiere al modo que **hoy se llama `ArcoCircular`**: las tablas
de B1 y B2 son la foto de antes del cambio y no se reescribieron.

- **A6, aplicado entero.** Secciones, condiciones de visibilidad y lugar de cada parámetro según la tabla
  de A6 (`web/DISENO.md`, "Panel por secciones, modos de curvatura y peralte al CIR"). El radio de
  referencia se muestra de solo lectura como "= radio del elemento"; `VersoresEnGrafico3D` se oculta en
  la web; `InclinacionHelicoidalImpuesta` pasa a la ficha.
- **`DiametroRueda`.** Sigue sin entrar en ningún cálculo, y ahora la ayuda lo dice. Físicamente el
  diámetro influye en dos cosas que el modelo no desagrega: la resistencia a la rodadura (se modela como
  `Crr·N` con `Crr` calibrado; en la realidad `Crr ≈ δ/r` y el torque de fricción de rodamientos pesa
  como `1/r`, así que el diámetro está implícito en `Crr`) y la inercia de rotación de las ruedas (no
  modelada: con `I = k·m_w·r²` la energía de rotación es `½·k·m_w·v²`, que **no depende del diámetro**
  sino de la masa de las ruedas: suma `k·Σm_w` a la masa efectiva). Además cuenta para el
  dimensionamiento (memoria §9.2).
- **B1, resuelto con un renombre y un modo nuevo.** El arco de radio constante se llama `ArcoCircular`
  y `Clotoide` es una clotoide simétrica de verdad: κ lineal en el arco hasta `1/(R + d·cosψ)` en la
  mitad del giro y de vuelta a cero, sin arco constante (`documentacion_generador_elementos.md` §5.2).
  Los diseños guardados (v1) y los layouts de contrato < 1.2.0 se migran a `ArcoCircular`. Las rampas
  `ClotoideEntrada`/`ClotoideSalida` de los otros modos siguen siendo smoothstep/Hermite.
- **B2, opciones agregadas.** El over-banked turn conserva el peralte constante y suma
  `ModoDePeralteDelGiro` relativo al CIR con un desvío constante. Todos los elementos tienen dos ticks
  excluyentes para el peralte siempre alineado al CIR, con cualquiera de sus dos definiciones: **U hacia
  el centro de curvatura** (ψ = 0) o **eje del carro sobre la fuerza específica del riel** (Gy de
  balance nula) (§5.3 de la misma documentación). Con el segundo, la Gy que queda en el pasajero es la
  de la dinámica del roll (en el OBT de 240° a 5 m/s, entre −0,23 y +0,33 G, contra −1,9 G con 110°
  constantes).
- **7.1.7.1, sin reset.** Un evento de +Gz que empieza dentro de la ventana reducida y termina afuera se
  compara con la curva reducida dentro de la ventana y con la normal después, **siempre con la duración
  acumulada desde el inicio del evento** (`LimitesDelEvento.m`; memoria §5.7). Queda resuelto el TODO de
  `VentanasMasGzReducido`.
