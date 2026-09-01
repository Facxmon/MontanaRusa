# Consigna para Claude Code — Reestructuración de la documentación del repo `MontanaRusa`

## 0. Contexto del proyecto (leer entero antes de tocar nada)

El repositorio es el modelo de cálculo de una **montaña rusa en miniatura** que se está construyendo
como pieza de portfolio de ingeniería mecánica. El objetivo del modelo físico no es un circuito largo
sino un modelo compacto que implemente muchos mecanismos de atracciones reales (motor sincrónico
lineal para el lanzamiento, switch tracks, frenos de Foucault) para demostrar profundidad de ingeniería.

El repo contiene hoy dos cosas separadas:

1. **`analisis_energia.m`** — script preliminar ("rough model"): toma una trayectoria 3D *ya dada* y
   calcula velocidad, radio de curvatura, fuerzas normales en G y pérdidas por resistencia al avance.
   Documentado en `documentacion_analisis_energia.md`.
2. **`GeneradorDeElementos/`** — el generador de geometría de vía propiamente dicho (loop vertical,
   hélice, over-banked turn, dive loop), con integración RK4 sobre marco de transporte paralelo,
   modos de curvatura, chequeos de factibilidad y verificación contra ASTM F2291.
   Documentado en `documentacion_generador_elementos.md`. Scripts de demo: `DemoElemento.m`,
   `DemoLayout.m`. Tests: `TestsValidacion.m`.

Y un tercer documento, **`memoria_de_calculo.md`**, que no documenta código sino los **criterios de
diseño y sus derivaciones**: continuidad C^n/G^n, marco de referencia, cinemática de heartline,
semejanza de Froude, límites de ASTM F2291-06a §7, política de continuidad por eje, longitudes de
transición y dimensionamiento del carro / decisión de escalado.

Decisiones de proyecto ya cerradas y que la documentación debe reflejar sin contradicciones:

- **Modelo distorsionado** (λ_loop ≠ λ_carro), no semejanza geométrica estricta. `RadioLoop` y
  `LargoCarro` son parámetros independientes; no hay ningún λ único cableado.
- Altura máxima del loop: **1 m** (restricción binding, por espacio en la casa).
- Fabricación de la vía: **impresión 3D**. Disponibilidad de rodamientos en Argentina condiciona
  ruedas y dimensiones del carro; todavía sin cerrar.
- Marco de referencia: **transporte paralelo (Bishop)**, no Frenet-Serret, con roll φ(s) explícito.
- Continuidad: **G² en la curva + C² en el roll** (smoothstep quíntico), con presupuesto de
  *onset* (tasa de aparición de G) por eje en vez de un criterio binario continuo/discontinuo.
- Los límites de ASTM F2291 son **autoimpuestos** (maqueta sin pasajeros), adoptados como criterio
  de diseño. Los valores tabulados son de F2291-06a leídos de las Figs. 6 a 10; la versión vigente
  es F2291-25c.
- Método A (marcha acoplada) es el método por defecto; el Método B (punto fijo sobre v(s)) es una
  envoltura opcional para comparar y para habilitar el modo inverso a futuro.

## 1. Objetivo de esta tarea

Reestructurar **toda la documentación .md del repo** para que quede ordenada, consistente y fácil de
leer, y —requisito explícito y no negociable del usuario— **que no quede ninguna variable ambigua sin
definir**. Todo símbolo matemático y todo nombre de variable/campo que aparezca en la documentación
tiene que estar definido, con unidad, y desambiguado cuando el mismo símbolo se usa para dos cosas
distintas.

**No se cambia el código MATLAB.** Esta tarea es exclusivamente de documentación. Si al leer el
código encontrás una discrepancia entre lo que dice el .md y lo que hace el .m, **la documentación se
corrige para reflejar el código**, y la discrepancia se anota en una lista al final del trabajo para
que el usuario decida. Nunca al revés.

## 2. Estructura destino (decidida por el usuario)

Se mantienen los tres documentos con su alcance actual, reescritos, **y se agregan dos archivos
nuevos**:

```
README.md                              <- NUEVO: índice y mapa de lectura del repo
NOMENCLATURA.md                        <- NUEVO: tabla maestra de símbolos y variables
memoria_de_calculo.md                  <- reescrito
documentacion_generador_elementos.md   <- reescrito
documentacion_analisis_energia.md      <- reescrito
```

### 2.1 `README.md` (nuevo)

Corto, de una pantalla y media. Contenido:

- Qué es el proyecto, en tres o cuatro oraciones (usar el contexto de §0 de esta consigna).
- **Mapa de lectura**: qué documento leer según lo que uno quiera saber, con una tabla
  `¿Qué buscás? → Documento → Sección`.
- **Estructura del repo**: árbol de carpetas con una línea por carpeta (la tabla de carpetas ya
  existe en `documentacion_generador_elementos.md` §2, reusarla).
- **Cómo correr**: los tres `run(...)` de demo y tests, y dónde se configuran los parámetros
  (`GeneradorDeElementos/ParametrosPorDefecto.m`).
- **Estado del proyecto**: qué está implementado y qué no, en una tabla corta. No repetir las
  listas largas de pendientes: linkear a la sección correspondiente de cada documento.
- Link explícito a `NOMENCLATURA.md` señalando que ahí está la definición de todo símbolo.

### 2.2 `NOMENCLATURA.md` (nuevo) — el archivo central de esta tarea

Tabla maestra única. **Cada fila = un símbolo o una variable.** Columnas obligatorias:

| Columna | Contenido |
|---|---|
| Símbolo | El símbolo matemático como aparece en los .md (en LaTeX) |
| Nombre en código | El identificador MATLAB exacto, o `—` si no existe en el código |
| Significado | Una línea, sin ambigüedad |
| Unidad | SI explícita, o `—` si es adimensional (y aclarar "adimensional") |
| Definido en | Documento y sección donde se deriva o se introduce |
| Notas | Rango típico, valor por defecto, si es entrada o salida, si es provisorio |

Organizada en subtablas por bloque temático, en este orden:

1. **Geometría y parametrización** (s, arco; T, U_pt, L_pt, U, L; κ, κ_U, κ_L; τ; r(s); φ y derivadas)
2. **Cinemática y dinámica** (v, a_t, a_n, ω, Ω_T, t tiempo, G_x, G_y, G_z, jerk/onset)
3. **Parámetros de entrada del generador** (todo lo que vive en `ParametrosPorDefecto.m`)
4. **Campos de las estructuras** (`Estado`, `Track`, `Sim`, `Layout`, `Elemento`, `Reporte`,
   `Punto`, `SubTramos`) — un ítem por campo, con su tipo y unidad
5. **Parámetros y variables del script de análisis energético** (`analisis_energia.m`)
6. **Escalado y semejanza** (λ, λ_loop, λ_carro, distorsión, Fr, Re)
7. **Normativa** (G_lim, duración de evento sostenido, cláusulas §7.1.x citadas)
8. **Tolerancias y parámetros numéricos** (TolArea, TolCierrePitch, TolPuntoFijo, PasoGeneracion,
   MaxIteraciones*, PasosEntreOrtonormalizaciones, ε_maq)

**Cómo poblarla:** leyendo el código, no adivinando. Como mínimo hay que abrir
`GeneradorDeElementos/ParametrosPorDefecto.m`, `Nucleo/EstadoInicial.m`, `Nucleo/RegistroVacio.m`,
`Nucleo/AgregarNodo.m`, `Nucleo/PuntoCinematico.m`, `Nucleo/DerivadaDeVia.m`,
`Elementos/ConstruirElemento.m`, `Elementos/GenerarGeometria.m`, `Fisica/CurvaturaDelModo.m`,
`Fisica/CargasEnLaVia.m`, `Fisica/ResistenciaAlAvance.m`, `Fisica/EscalasDeFroude.m`,
`Verificacion/LimiteNormativo.m`, `Salida/ReportarElemento.m` y `analisis_energia.m`.
Si un parámetro está marcado **SIN CERRAR** en `ParametrosPorDefecto.m`, esa marca tiene que
aparecer en la columna Notas.

### 2.3 Sección de símbolos locales en cada documento

Cada uno de los tres documentos arranca, después de su párrafo de alcance, con una tabla
**"Símbolos usados en este documento"** — sólo los que aparecen ahí, con significado y unidad, y una
línea que remita a `NOMENCLATURA.md` para la tabla completa. No es duplicación inútil: el usuario
tiene que poder leer un documento suelto sin saltar a otro archivo.

## 3. Colisiones de símbolos detectadas — hay que resolverlas explícitamente

Éstas son reales y están hoy en los documentos. Para cada una: elegir un símbolo distinto para uno de
los dos usos, aplicarlo consistentemente en todos los .md, y dejar constancia de la desambiguación en
`NOMENCLATURA.md`. Si el símbolo está atado a un nombre de variable del código, el que cambia es el
otro.

| # | Símbolo | Uso A | Uso B | Dónde chocan |
|---|---|---|---|---|
| 1 | `d` | Offset de heartline (distancia del pasajero al eje de vía, m) | `DistanciaDeDiscretizacion` en la fórmula de longitudes objetivo | memoria §3 vs energía §3 |
| 2 | `t` | Parámetro libre de la curva paramétrica X(t),Y(t),Z(t) | Tiempo | energía §2 vs todo lo demás |
| 3 | `L` | Longitud característica de Froude | Longitud de transición (`L_trans`) **y** largo del carro (`L_carro`) — tres usos | memoria §4, §7, §9 |
| 4 | `T` | Versor tangente **T** | `T_min`/`T_max` (extremos del parámetro) **y** torque del rodamiento `T_rodamiento` — tres usos | memoria §2, §9.2 vs energía §2 |
| 5 | `α` | Ángulo de la hélice del loop | Vector aceleración angular **α** en la transferencia de cuerpo rígido | generador §4 vs memoria §3.2 |
| 6 | `N` | Fuerza normal | `NumeroDeCarros` **y** versor normal de Frenet **N** — tres usos | energía §8 vs memoria §2.1 |
| 7 | `G` | Fuerza G (adimensional, múltiplos de g) | Continuidad geométrica `G^n` | memoria §1 vs todo lo demás |
| 8 | `R` | Radio de curvatura de la vía | `R_rueda` radio de rueda | energía §4 vs memoria §9.2 |
| 9 | `g` vs `G` en unidades de onset | Las tablas de la norma escriben "5 g/s" y "15 G/s" indistintamente | — | memoria §5.2, §6.1, §7.5 |

Sobre la #9: unificar a **G/s** en todo el texto propio, y donde se cita literalmente la norma,
mantener la grafía de la norma pero aclarar en nota que G y g denotan lo mismo (múltiplos de
9.81 m/s², §7.1.4.1).

## 4. Variables que hoy aparecen sin definición y hay que definir

Lista no exhaustiva de lo detectado. Buscar además cualquier otra que se te escape en la lectura.

- **`d`** (heartline): aparece en memoria §3 y en generador §7 y §14 con valor 3 cm en §14, pero
  nunca se dice a qué parámetro de `ParametrosPorDefecto.m` corresponde ni que es un parámetro
  *virtual de evaluación* al principio. Definirlo la primera vez que aparece.
- **`a_n`** del modo `AceleracionNormalConstante` (generador §5): nunca se dice de dónde sale ni cuál
  es su parámetro.
- **`G_obj`** del modo `FuerzaGConstante`: ídem.
- **`G_lim(duración)`** y "duración equivalente del prototipo": la conversión ×√λ_loop está descrita
  en prosa en tres lugares distintos con palabras distintas. Definirla una vez, con fórmula, y
  referenciarla desde los otros dos.
- **`β`** (generador §3, ángulo entre marco de transporte y normal en el plano): se usa en cos β y
  sin β sin definir el signo ni el origen del ángulo.
- **`U_z`**: definido recién en generador §5, pero se usa antes. Moverlo o adelantarlo.
- **`FactorLongitud`**, **`Inclinacion`**, **`AjusteCierre`**: son las tres incógnitas de las capas
  del algoritmo. Definirlas en una tabla al abrir §4.1, antes de usarlas.
- **`J_max`** vs **`J_{y,max}`** vs **`OnsetMaximo`** (vector de 3): unificar notación y decir cuál
  componente es cuál.
- **`k_tren`** ↔ `FactorTren`, **`A_ef`** ↔ área frontal efectiva, **`C_rr`** genérico vs los tres
  coeficientes `CoefRodaduraPortantes/Guia/Retencion`: el `C_rr = 0.03` que aparece en la fórmula de
  `v_cruce` (energía §8) no corresponde a ninguno de los tres parámetros declarados. Aclarar de dónde
  sale o marcarlo como valor de referencia para el orden de magnitud.
- **`ε_maq`** (energía §4): decir que es el épsilon de máquina y su valor (≈2.2e-16 en doble
  precisión).
- **`μ_b`**, **`r_eje`**, **`R_rueda`**, **`T_rodamiento`** (memoria §9.2): definir en la tabla local.
- **`H_loop`**, **`L_carro`**, **`R` de cúspide** (memoria §9): aclarar que "altura del loop" es
  altura total y "R de cúspide" es el radio en el punto más alto, no el radio nominal.
- **`Track.AnguloRoll`** vs **`Track.AnguloPeralte`**: están bien explicados en generador §12.3 pero
  se usan antes sin distinguir. Adelantar la distinción.
- **`distorsión`** y **`CarrosEquivalentes`**: dar la fórmula explícita (`distorsión =
  λ_carro/λ_loop`, `CarrosEquivalentes = NumeroDeCarros / distorsión`) en la nomenclatura, no sólo
  en la tabla de discrepancias de generador §13.
- **`VelocidadParaCurvatura`** (campo de `Punto`): aparece en generador §4.1 entre paréntesis, sin
  definir.

## 5. Errores e inconsistencias concretas a corregir

1. **`documentacion_generador_elementos.md` §11 dice "Los ocho son ejecutables" y "ocho tests", pero
   la tabla lista siete.** Verificar contra `TestsValidacion.m` cuántos hay realmente y corregir el
   texto y/o completar la tabla.
2. **Numeración rota en `documentacion_generador_elementos.md` §4.1:** existe un `### 4.1.4 Método B`
   pero no hay 4.1.1, 4.1.2 ni 4.1.3 — las tres capas están como `### Capa 3`, `### Capa 2`,
   `### Capa 1` sin número. Numerarlas 4.1.1 (Capa 3, marcha), 4.1.2 (Capa 2, cierre), 4.1.3
   (Capa 1, ajuste de forma) — o renumerar como prefieras, pero que quede una secuencia sin huecos.
   Además las capas se presentan de adentro hacia afuera (3, 2, 1) mientras el diagrama de bloques
   las lista de afuera hacia adentro (1, 2, 3); dejar una frase que avise el cambio de orden y por
   qué (se explica de adentro hacia afuera porque la capa interna es la única que traza puntos).
3. **Contradicción entre documentos sobre el reparto de carga entre juegos de ruedas:**
   `documentacion_analisis_energia.md` §8 dice que se asume peralte perfecto y toda la carga va a
   las portantes; `documentacion_generador_elementos.md` §15 dice que el reparto "ya se hace
   correctamente proyectando la normal sobre U y L". Son dos códigos distintos y ambas afirmaciones
   pueden ser ciertas, pero hoy leídas juntas se contradicen. Verificar contra
   `Fisica/CargasEnLaVia.m` y contra `analisis_energia.m`, y en cada documento decir explícitamente
   **de qué script se está hablando**.
4. **Jerarquía de headings inconsistente:** `memoria_de_calculo.md` usa `#` (H1) para cada sección
   numerada y `##` para subsecciones; los otros dos usan `##` para secciones. Unificar: un solo `#`
   como título del documento y `##`/`###` para el resto, en los tres archivos.
5. **`memoria_de_calculo.md` §7 y §8 y §9 y §10 pierden los separadores `---`** que las secciones
   anteriores sí tienen. Unificar el uso de separadores (o quitarlos todos, o ponerlos entre todas
   las secciones de primer nivel).
6. **`documentacion_analisis_energia.md` §13 documenta las correcciones C1–C4 de la branch
   `correcciones menores`.** La branch actual del repo es `Correcciones-menores`. Verificar si esas
   correcciones ya están mergeadas; si lo están, la sección debe pasar a ser un changelog histórico
   (o moverse a un `CHANGELOG.md`) en vez de estar redactada como "esta branch corrige". Las marcas
   **(C1)** a **(C4)** dispersas en el texto molestan la lectura: sacarlas del cuerpo y dejar la
   referencia sólo en la tabla del changelog.
7. **La trayectoria de prueba de `analisis_energia.m` (la hélice de X=sin t, Y=2cos t, Z=10−t+20cos(t/10))
   está documentada como debug.** Verificar contra el .m si sigue siendo la trayectoria activa y
   dejarlo claro con una marca visible de que es una curva de prueba, no geometría de diseño.

## 6. Datos no verificados — marcarlos y listarlos aparte

El usuario pidió explícitamente: **marca visible en línea + una sección propia que los junte a todos.**

Usar la marca literal `**[SIN VERIFICAR]**` inmediatamente antes o después del dato, y agregar al
final de `memoria_de_calculo.md` una sección **"Datos pendientes de verificación"** con una tabla:

| Dato | Valor usado | Dónde se usa | Fuente pendiente |
|---|---|---|---|

Los que ya sé que van ahí (buscar si hay más):

- Dimensiones "típicas" de atracción real: loop de 25 m, carro de 2.2 m, alto de carro 1.5 m,
  trocha 1.3 m, rueda portante de ≈30 cm de diámetro. → Fuente pendiente: fijar una atracción de
  referencia concreta y usar sus dimensiones publicadas. (memoria §4.3, §9.1, §9.2)
- Todos los valores de las tablas de límites de las Figs. 6 a 10, leídos de la figura y no del texto
  normativo. → Fuente pendiente: F2291-06a original; y contrastar contra la versión vigente
  **F2291-25c**. Los puntos de quiebre de la Fig. 9 en 3.0 s y 4.0 s ya están señalados como la
  lectura más consistente pero no confirmada. (memoria §5.2 a §5.6)
- Factor altura/radio de un loop clotoide (2.2–2.6 × R de cúspide). (memoria §4.6)
- Atribución del loop clotoide a Werner Stengel, mediados de los 70, Revolution en Six Flags Magic
  Mountain. → Fuente primaria pendiente. (memoria §6.6)
- Cita a Pendrill y Eager (2020) — verificar referencia completa. (memoria §6.5)
- Los tres coeficientes de rodadura y el C_d: provisorios, requieren calibración experimental.
  (energía §15, generador §15)
- λ = 22 como valor de trabajo: provisorio, deriva de las dimensiones no verificadas de arriba.

**Importante:** los valores de las tablas de la norma **no se tocan ni se recalculan**. Se marcan.
Y no inventes valores para reemplazar los que faltan: si un dato no está, se marca como faltante.

## 7. Convenciones de redacción a aplicar en los tres documentos

- **Idioma: español rioplatense**, que es el que ya usan los documentos. Mantener el tono actual:
  técnico, directo, sin relleno. El usuario escribe así y quiere que se lea así.
- **Terminología en inglés**: mantener los términos de industria en inglés donde ya están
  (airtime, over-banked turn, dive loop, up-stop, smoothstep, Force Vector Design, heartline) pero
  la primera vez que aparecen en cada documento, glosarlos en una línea. El usuario pidió
  explícitamente que no se asuma que conoce toda la terminología.
- **Fórmulas en LaTeX** con `$...$` y `$$...$$`, como ya están. No cambiar el estilo.
- **Toda tabla lleva unidades en el encabezado de columna.** Hoy varias no las tienen.
- **Cada sección arranca diciendo qué responde**, en una oración, antes de entrar en la derivación.
- **Cross-references explícitas**: cuando un documento remite a otro, el link tiene que incluir la
  sección, no sólo el archivo. Formato: `` [`memoria_de_calculo.md` §3.5](memoria_de_calculo.md#35-resultado) ``.
  Verificar que todos los anchors existan.
- **Índice al principio de cada documento** (lista de secciones con link), porque los tres son largos.
- No introducir contenido nuevo de ingeniería. Esta tarea es de estructura, definiciones y
  consistencia. Si detectás algo que parece un error físico o matemático, **no lo corrijas**:
  anotalo en la lista de hallazgos del final.

## 8. Orden de trabajo sugerido

1. Leer los tres .md completos y todo el código MATLAB listado en §2.2.
2. Construir `NOMENCLATURA.md` primero. Es la fuente de verdad de la que sale todo lo demás.
3. Resolver las colisiones de §3 tomando una decisión por cada una y anotándola.
4. Reescribir `memoria_de_calculo.md` (es el de más abajo en la pila de dependencias: define los
   criterios que los otros dos usan).
5. Reescribir `documentacion_generador_elementos.md`.
6. Reescribir `documentacion_analisis_energia.md`.
7. Escribir `README.md` al final, cuando ya sabés qué hay en cada lado.
8. Verificación final (§9).

## 9. Verificación antes de dar por terminado

Correr y reportar el resultado de cada uno de estos chequeos:

- [ ] Grep de todo símbolo LaTeX usado en los tres .md contra las filas de `NOMENCLATURA.md`.
      Listar los que no tienen fila. Meta: cero.
- [ ] Grep de todo identificador MATLAB mencionado en los .md (en backticks) contra los nombres
      reales del código. Listar los que no existen o están mal escritos. Meta: cero.
- [ ] Inverso del anterior: todo parámetro de `ParametrosPorDefecto.m` tiene fila en
      `NOMENCLATURA.md`. Listar los que faltan. Meta: cero.
- [ ] Todos los links internos (`archivo.md#anchor`) resuelven a un heading existente. Meta: cero rotos.
- [ ] Numeración de secciones sin huecos ni repeticiones en los tres documentos.
- [ ] Toda tabla tiene unidades en el encabezado o dice explícitamente "adimensional".
- [ ] Ninguna de las 9 colisiones de §3 sigue presente.

## 10. Entrega

- Trabajar en una branch nueva a partir de la branch actual: `docs/reestructuracion`.
- Un commit por documento, con mensaje descriptivo, más un commit final para `README.md` y
  `NOMENCLATURA.md` si conviene separarlos.
- **No mergear ni pushear a `main`.** Dejar la branch lista y decirle al usuario el nombre.
- Al terminar, entregar un resumen con:
  1. Qué archivos se crearon y cuáles se reescribieron.
  2. La decisión tomada para cada una de las 9 colisiones de símbolos.
  3. El resultado de cada chequeo de §9.
  4. **Lista de discrepancias documentación ↔ código** que encontraste (dónde el .md decía una cosa
     y el .m hacía otra), para que el usuario decida qué hacer con cada una.
  5. **Lista de hallazgos que parecen errores de ingeniería** y que dejaste sin tocar.
  6. Cualquier variable que no pudiste definir sin adivinar, con la pregunta concreta que hay que
     responder para cerrarla.

Si en algún punto necesitás inventar un dato para que algo cierre: **no lo inventes**. Dejalo marcado
como pendiente y ponelo en la lista del punto 6. El usuario prefiere una respuesta incompleta y
honesta antes que una completa y fabricada.
