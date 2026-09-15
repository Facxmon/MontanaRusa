# Consigna para Claude Code — corrección del modo `GMaximas`

## Contexto del proyecto

Repositorio: `MontanaRusa` (GitHub del usuario). Es un generador de elementos de vía para una
montaña rusa **en miniatura** (modelo de escritorio, no una atracción real), escrito en MATLAB.
Rama de trabajo actual: `fix/heartline-como-curva-de-diseno`. Todo el código y los comentarios
están en español sin tildes; respetar esa convención y el estilo de nomenclatura existente
(nombres largos en CamelCase castellano, documentado en `NOMENCLATURA.md`).

Estructura relevante:

```
DemoElemento.m                       script demo de UN elemento
DemoLayout.m                         script demo del circuito encadenado
TestsValidacion.m                    suite de tests
memoria_de_calculo.md                criterios de diseno
documentacion_generador_elementos.md documentacion del generador
NOMENCLATURA.md                      convenciones de nombres
GeneradorDeElementos/
  ParametrosPorDefecto.m             bloque unico de parametros
  Elementos/
    ElementoLoopVertical.m  ElementoHelice.m
    ElementoOverBankedTurn.m  ElementoDiveLoop.m
    ConstruirElemento.m  GenerarGeometria.m
    ResolverMetodoA.m  ResolverMetodoB.m  CompararMetodos.m
  Fisica/
    CurvaturaDelModo.m  SimularSobreTrack.m  EscalasDeFroude.m
    VelocidadInicialMinima.m  CargasEnLaVia.m  ResistenciaAlAvance.m
  Nucleo/            integracion RK4, marco de transporte paralelo, estado
  Verificacion/
    LimiteNormativo.m  VerificarLimitesNormativos.m
    ChequeosPrevios.m  ChequeosPosteriores.m
  Salida/            GraficarElemento.m  GraficarLayout.m  ReportarElemento.m
```

Modelo de física, en una línea: la curva que se integra es el **heartline** (el riel se deriva
restando `DistanciaHeartline*U`), el marco del carro es de **transporte paralelo con roll
explícito encima** (no Frenet), y las G que se verifican contra la norma se evalúan en un punto
desplazado `DistanciaEvaluacionPasajero*U` del heartline. La verificación normativa es contra
**ASTM F2291-06a, sección 7**, con las duraciones del modelo convertidas a duraciones del
prototipo multiplicando por `sqrt(lambda)` (Froude, modelo distorsionado).

Cada elemento arma una `Receta` y llama a `ConstruirElemento`. Los campos de la Receta hoy son:
`Nombre`, `GiroObjetivo`, `DesfasajeDeCurvatura`, `RollDelElemento`, `DesplazamientoObjetivo`.
`DesfasajeDeCurvatura` vale 0 para el loop vertical, `pi` para el dive loop y `±pi/2` para
hélice y over-banked turn.

---

## Problema 1 — `GMaximas` proyecta mal la curvatura

En `GeneradorDeElementos/Fisica/CurvaturaDelModo.m`, el modo `GMaximas` hace:

```matlab
DuracionModelo = max(Punto.Tiempo - ArcoTiempoDeReferencia, 0);
DuracionReal   = DuracionModelo * Escala.RaizLambdaLoop;
GLimite = LimiteNormativo(Parametros.CurvaLimiteGMaximas, DuracionReal);
Curvatura = g*(GLimite - ArribaVertical) / Velocidad^2;
```

donde `ArribaVertical = Punto.VersorArribaCarro(3)`.

Esa expresión sale de despejar `Gz = kappa*v^2/g + U_z` y **supone que el vector curvatura está
alineado con el eje `U` del carro**. Eso es exacto para el loop vertical y el dive loop
(`DesfasajeDeCurvatura` 0 o `pi`), pero es **falso para hélice y over-banked turn**, donde la
curvatura es horizontal y `U` está peraltado: ahí la componente de la aceleración normal sobre
`U` vale `kappa*v^2*dot(n,U)`, no `kappa*v^2`. En esos dos elementos el modo `GMaximas` le está
errando al objetivo por un factor `1/dot(n,U)`.

La forma general correcta es:

```
kappa = g*(GLimite - U_z) / (v^2 * dot(n_curvatura, U))
```

Para una curva peraltada un ángulo `beta` se reduce a `kappa = g*(GLimite - cos(beta)) / (v^2*sin(beta))`,
que diverge cuando `beta -> 0`: una curva sin peraltar **no puede** generar +Gz por más curvatura
que se le ponga, genera Gy. Hace falta una guarda explícita para ese caso, con un mensaje que
diga eso, no un `NaN` silencioso.

La dirección de la curvatura ya se construye en `GenerarGeometria.m` (ver `AnguloDeCurvatura`,
`ProyectarCurvatura`, `DireccionDeGiro`); hay que hacerle llegar a `CurvaturaDelModo` la
información suficiente para calcular `dot(n,U)` en cada punto, probablemente vía el struct
`Punto` que arma `PuntoCinematico.m`. Evaluar si conviene pasar el ángulo entre la dirección de
curvatura y `U` como campo del `Punto`.

## Problema 2 — `GMaximas` no dice a qué G apunta

Hoy la curva límite es un único parámetro global, `Parametros.CurvaLimiteGMaximas = 'MasGzTodas'`.
El nombre del modo sugiere "todas las G máximas", cosa que un elemento solo no puede hacer, y el
parámetro global no permite que cada elemento persiga lo suyo.

Objetivo pedido por el usuario:

- **Loop vertical, hélice y over-banked turn**: apuntar a las **+Gz máximas** de la norma
  (`LimiteNormativo('MasGzTodas', ...)`, o la curva reducida si corresponde por 7.1.7.1).
- **Dive loop**: apuntar a las **+Gz máximas y a las ±Gy máximas** de la norma simultáneamente
  (`MasGzTodas` y `GyBase`).

La curva límite (o el par de curvas) debe pasar a ser **parte de la Receta de cada elemento**,
no un parámetro global suelto. Mantener `CurvaLimiteGMaximas` solo como valor por defecto para
quien llame al motor a mano, o eliminarlo si queda redundante.

Elegir un nombre de modo que diga lo que hace. `GMaximas` es ambiguo; algo del tipo
`LimiteNormativo` / `GNormativaMaxima` es más honesto. Si se renombra, actualizar todas las
referencias, incluidos `ParametrosPorDefecto.m`, `DemoElemento.m`, `DemoLayout.m`,
`TestsValidacion.m` y la documentación en markdown.

## Problema 3 — cómo alcanzar el ±Gy en el dive loop

**Decisión del usuario: por sub-peralte de la curvatura, NO por aceleración de roll.**

Descartar explícitamente la vía del roll violento. En este modelo el heartline *es* el eje de
roll, así que el Gy que produce una rotación aparece solo en `GEnPuntoDeEvaluacion`
(`SimularSobreTrack.m`) por el término `dOmega/dt x r` con brazo `DistanciaEvaluacionPasajero`.
Ese parámetro está marcado **SIN CERRAR** en `ParametrosPorDefecto.m`, así que dimensionar
geometría contra un límite normativo usando ese brazo como palanca ataría el diseño a un número
todavía no decidido. No hacerlo.

El mecanismo correcto es dejar la curvatura **desalineada del eje `U`** un ángulo `psi`, de modo
que parte de la aceleración normal caiga sobre el eje lateral. Con la curvatura de módulo `kappa`
formando un ángulo `psi` con `U` dentro del plano `U-L`:

```
Gz = kappa*v^2*cos(psi)/g + U_z
Gy = -kappa*v^2*sin(psi)/g + L_z      (verificar el signo contra la convencion de SimularSobreTrack)
```

Son dos ecuaciones con dos incógnitas (`kappa`, `psi`) y dos objetivos (el +Gz límite y el ±Gy
límite, cada uno evaluado en su curva normativa con la duración escalada por `sqrt(lambda)`).
Resolverlas punto a punto sobre el arco principal.

Consideraciones que hay que resolver, no ignorar:

1. `psi` deja de ser un parámetro fijo y pasa a ser un **perfil a lo largo del arco**. Eso
   implica un `phi'` y un `phi''` inducidos que hay que chequear contra el presupuesto de onset
   (`Plan.Onset`, derivado de Froude en `EscalasDeFroude.m`). Si el perfil de `psi` que sale de
   resolver el sistema viola el onset lateral, hay que suavizarlo o avisar — nunca devolver
   geometría que no cumple sin decirlo.
2. Verificar la compatibilidad con `RollDelElemento = pi` del dive loop y con el sub-tramo de
   acondicionamiento que hoy hace el medio tonel con smoothstep quíntico. El `psi` resuelto se
   superpone a ese roll, no lo reemplaza.
3. El sistema puede no tener solución (targets incompatibles a esa velocidad y radio). Ese caso
   va reportado como criterio que no pasa, con el motivo, igual que el resto de los chequeos.
4. El resultado tiene que seguir cerrando el giro objetivo: la corrección de cierre de pitch
   (`ResidualCierrePitch`, `TolCierrePitch`) sigue siendo un criterio.

## Problema 4 — reestructurar el bloque de parámetros por modo

**Decisión del usuario: reestructurar, no solo avisar.**

Hoy `DemoElemento.m` deja cargar `FuerzaGObjetivo` estando en modo `GMaximas`, donde ese
parámetro no se lee nunca (`CurvaturaDelModo.m` solo lo usa en `FuerzaGConstante`). El usuario
carga un número creyendo que controla algo que no controla.

Cuidado con un matiz: **`GMinimaCuspide` NO es un parámetro del modo de curvatura**, es un
criterio de aceptación, y se usa en `VelocidadInicialMinima.m` (holgura de cúspide de la
bisección) y en `ChequeosPrevios.m` (estimación a priori de velocidad de entrada). Sigue siendo
válido en todos los modos. No moverlo al bloque de parámetros de modo.

Lo pedido:

- Que cada modo de curvatura **declare explícitamente qué parámetros consume**. Una sola fuente
  de verdad, consultable desde el código, no un comentario.
- Que `DemoElemento.m` arme y muestre solo los parámetros del modo elegido, con sus unidades.
- Que cargar un parámetro ajeno al modo elegido sea detectable: mínimo, un chequeo en
  `ChequeosPrevios.m` que lo nombre; idealmente, que la estructura misma lo impida.
- Mantener separados, y visiblemente separados, los tres grupos que hoy están mezclados en el
  bloque de `DemoElemento.m`: parámetros del modo de curvatura, parámetros geométricos del
  elemento, y criterios de aceptación.

## Problema 5 — `RadioDelLoop` en `DemoElemento.m`

En `DemoElemento.m`, con `Elegido = @ElementoDiveLoop`, la línea

```matlab
Parametros.RadioDelLoop = 0.11;   % [m] radio de cuspide
```

**no hace absolutamente nada**: `ElementoDiveLoop.m` hace
`Parametros.RadioDeReferencia = Parametros.RadioDelDiveLoop` (0.45 m por defecto).
`RadioDelLoop` lo consume únicamente `ElementoLoopVertical.m`.

Además el comentario "radio de cúspide" contradice lo que el propio script explica tres líneas
más arriba: en los modos dependientes de `v` el radio de cúspide es una **salida**, no una
entrada, y `RadioDeReferencia` es ahí solo la longitud característica de Froude (fija `lambda`,
el presupuesto de onset y la conversión de duraciones contra la norma).

Arreglar el script para que el radio que se carga sea siempre el del elemento efectivamente
elegido, y corregir el comentario para que diga qué rol cumple el radio en cada modo.

---

## Reglas de trabajo

- Trabajar sobre una rama nueva a partir de `fix/heartline-como-curva-de-diseno`.
- Antes de tocar nada, leer `documentacion_generador_elementos.md`, `memoria_de_calculo.md` y
  `NOMENCLATURA.md`. Son largos y están actualizados; las convenciones y las decisiones de
  diseño ya tomadas están ahí.
- Actualizar esa documentación con lo que cambie. La documentación es parte del entregable, no
  un extra.
- `TestsValidacion.m` tiene que seguir pasando, y hay que **agregar tests**: como mínimo, uno que
  verifique que en modo normativo el +Gz alcanzado coincide con el límite de la curva para la
  duración correspondiente, en los cuatro elementos (es el test que hubiera cazado el error de
  proyección de la hélice), y uno para el dive loop con el objetivo de Gy.
- Los métodos A y B (`ResolverMetodoA.m` / `ResolverMetodoB.m`) tienen que seguir coincidiendo
  donde hoy coinciden. Si el nuevo modo rompe la convergencia del punto fijo, decirlo.
- No inventar valores. Los parámetros marcados **SIN CERRAR** en `ParametrosPorDefecto.m` siguen
  sin cerrar: si un cálculo los necesita, usarlos como están y dejar la dependencia explícita.
- Las tablas de `LimiteNormativo.m` son valores leídos de las figuras 6 a 10 de ASTM F2291-06a.
  No modificarlas ni extrapolarlas.
- **No implementar un elemento batwing.** Queda fuera de alcance por decisión del usuario.
- Antes de empezar a escribir código, devolver un plan corto de los cambios por archivo.
