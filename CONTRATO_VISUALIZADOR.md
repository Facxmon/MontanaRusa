# Contrato del visualizador — esquema JSON del layout

Este documento define el **único punto de contacto** entre el cálculo de geometría y el visualizador
web. Es un contrato de datos: un archivo de texto con una forma fija. Quien lo produce y quien lo
consume no se conocen entre sí.

| Rol | Hoy (v1) | Mañana (v2) |
|---|---|---|
| **Productor** | MATLAB (`LayoutAJson.m`) exporta un `.json` | El núcleo porteado a JS/TS genera el mismo objeto en memoria |
| **Consumidor** | El visualizador web lo lee y lo dibuja | Idéntico, sin un solo cambio |

Ese es todo el propósito del contrato: **el frontend no cambia cuando cambia el motor de cálculo**.
Permite construir el visualizador completo — display 3D, mapas de calor, botón play, cámara on-board,
panel de criterios — antes de haber porteado una sola línea de física, y desacopla el riesgo del port
del progreso visible del proyecto.

> Fuente de verdad de los nombres: este documento fija los nombres **JSON**.
> El mapeo JSON ↔ MATLAB ↔ símbolo está en [`NOMENCLATURA.md`](NOMENCLATURA.md).
> Ninguna clave de este esquema puede quedar sin entrada ahí.

---

## 1. Decisiones de diseño (y por qué)

Cada una de estas es barata de cambiar hoy y cara después. Están acá para que se discutan una vez y
no se vuelvan a discutir.

### 1.1 Formato columnar, no array de objetos

```jsonc
// SÍ                                    // NO
"nodos": {                               "nodos": [
  "arco":      [0, 0.01, 0.02, ...],       {"arco": 0,    "x": 0, ...},
  "x":         [0, 0.009, 0.019, ...],     {"arco": 0.01, "x": 0.009, ...},
  "gz":        [1.0, 1.02, ...]            ...
}                                        ]
```

Tres razones, en orden de peso:

1. **Se mapea directo a la GPU.** `new Float32Array(nodos.x)` es un `BufferAttribute` de Three.js sin
   ningún reordenamiento. Con array de objetos hay que recorrer y copiar cada nodo en cada recálculo.
2. **Pesa entre 3 y 5 veces menos**, porque la clave no se repite por nodo.
3. **Es la forma que el repo ya tiene.** `TablaDeResultados()` en `ConstruirElemento.m` produce
   exactamente esto (una `table` de columnas nombradas), y `RegistroVacio.m` reserva por columna.

### 1.2 SI y radianes, siempre

El JSON es **metros, segundos, kilogramos, radianes, adimensional (G)**. Sin excepciones.

`TablaDeResultados` hoy exporta `RollGrados` y `PeralteGrados`; en el JSON van en radianes como
`anguloRoll` y `anguloPeralte`. La conversión a grados es decisión de presentación y vive en el
frontend. Un contrato con unidades mixtas es una fuente inagotable de bugs silenciosos.

Cada bloque de nodos declara sus unidades en `meta.unidades`, de modo que el archivo es
autodescriptivo y legible sin este documento.

### 1.3 Curvatura, no radio

`TablaDeResultados` exporta `Radio` y `RadioRiel`, que valen `Inf` en tramos rectos. **JSON no tiene
`Infinity`.** En vez de inventar una codificación, el contrato exporta únicamente **curvatura**
(`curvatura`, `curvaturaRiel`), que es finita siempre y vale 0 en la recta. El radio se deriva en el
frontend con `1/κ`, que es una división, no un problema de serialización.

### 1.4 Las dos curvas van siempre

- `x, y, z` → **heartline**: donde va el pasajero, donde se evalúan las G, contra qué se compara la norma.
- `xRiel, yRiel, zRiel` → **riel**: la curva que se integra, el eje de roll, lo que se imprime en 3D.

El visualizador tiene que poder mostrar las dos y el vector que las une (`d·U`). Son curvas distintas
y confundirlas es el error conceptual más caro de este proyecto.

### 1.5 Los tres versores van explícitos

`versorTangente`, `versorArribaCarro`, `versorLateral`, uno por nodo.

**No son redundantes.** La orientación del carro *no se recupera* de la curva de posición: el roll es
un grado de libertad independiente de la geometría de la heartline. Sin `versorArribaCarro` el
visualizador no puede orientar el tubo de vía, ni el carro, ni la cámara on-board.

Cuesta 9 floats por nodo. La alternativa —exportar solo la tangente y el ángulo de roll contra el
marco de transporte paralelo, y reconstruir el marco de Bishop en el frontend (4 floats)— se deja
para v2, cuando el transporte paralelo ya esté porteado a JS y se pueda validar que reconstruye bit a
bit. En v1 se prioriza que no haya ambigüedad.

### 1.6 `null` para lo que no existe

JSON no admite `NaN` ni `Infinity`. Regla única: **cualquier valor no finito se serializa como
`null`**. El consumidor trata `null` como "sin dato" y no dibuja ese nodo, en vez de pintar un agujero
negro en la mitad de la vía.

Aplica principalmente a `gz`/`gy` después de un `puntoDeParada`, y a
`resumen.velocidadInicialMinima` cuando `calcularVelocidadMinima` estuvo en `false`.

### 1.7 camelCase en el JSON

MATLAB usa `PascalCase`, JavaScript usa `camelCase`. El contrato adopta `camelCase` porque el
consumidor de largo plazo es JS. La traducción es puramente mecánica (`PuntosHeartline` → `x/y/z`,
`GArribaHeartline` → `gz`) y queda registrada en `NOMENCLATURA.md`.

> **Decidido (2026-09-18): camelCase.** La regla y sus excepciones están en NOMENCLATURA.md §9.

### 1.8 Precisión: 6 cifras significativas

El export redondea a 6 cifras significativas. A escala de modelo eso es del orden del micrón, dos
órdenes de magnitud por debajo de la tolerancia de la impresora 3D, así que no pierde nada físico y
recorta el archivo de forma sustancial.

**Tamaño medido** (`golden/circuito-demolayout.json`, 4 elementos, 6880 nodos, JSON compacto,
commit `0517a37`): **2 199 944 bytes crudo, 735 868 bytes con gzip -6** (735 014 con `-9`). Son
~313 bytes por nodo crudos y ~107 gzipeados. El 98 % del archivo son los `nodos`; los tres versores
solos pesan 654 kB crudos (30 %), que es exactamente el costo que §1.5 acepta en v1. Los elementos
sueltos pesan entre 406 kB (`loop-normativa`) y 962 kB (`helice-clotoide`) crudos, 154–331 kB
gzipeados.

Lectura: servido con gzip (GitHub Pages lo hace por defecto) el circuito completo queda en ~0,7 MB,
del orden de una foto. **No hace falta binario en v1.** Si en v2 molesta, las dos palancas son
reconstruir el marco de Bishop en el frontend (§1.5, −30 %) y pasar los `nodos` a `.bin` +
`Float32Array` sin tocar la estructura lógica.

### 1.9 El bloque de parámetros es autodescriptivo — y esto es lo mejor del diseño

El repo ya tiene la infraestructura para que **el panel de parámetros de la web se genere solo**:

- `ParametrosDelModo(modo)` declara qué parámetros consume cada modo de curvatura.
- `ElementoXxx()` sin argumentos declara los parámetros geométricos de ese elemento
  (`DeclaracionDeParametros`).
- `ParametrosDeAceptacion()` declara los criterios de aceptación.
- `ParametrosGenerales()` declara el resto: física, carro, resolución, escalado, discretización,
  tolerancias.

Las cuatro devuelven la misma terna: **`Nombre`, `Unidad`, `Descripcion`**.

El export no manda solo los *valores*: manda también ese *esquema*. Resultado: el frontend construye
los menús expandibles, las etiquetas, las unidades y los tooltips leyendo el JSON, y **nunca se
desincroniza del MATLAB**. Si mañana agregás un parámetro a un elemento, aparece solo en la web sin
tocar el frontend.

Ese es el mecanismo que hace viable tu pedido de *"menús expandibles para elegir elementos y sus
respectivos parámetros"* y *"resetear a default con nuestros datos"* sin mantener dos listas a mano.

---

## 2. Estructura general

```jsonc
{
  "meta":       { ... },   // versión del contrato, origen, unidades
  "parametros": { ... },   // valores + esquema autodescriptivo
  "estadoInicial": { ... },// dónde y cómo arranca el circuito
  "elementos":  [ ... ],   // un objeto por elemento encadenado
  "resumenLayout": { ... } // agregados de todo el circuito
}
```

---

## 3. `meta`

```jsonc
{
  "versionContrato": "1.0.0",     // semver; el consumidor rechaza un MAJOR distinto
  "generadoPor":     "matlab",    // "matlab" | "js"
  "versionGenerador":"a3f91c2",   // hash de commit del repo que lo produjo
  "generadoEn":      "2026-09-18T14:22:31Z",
  "unidades": {
    "longitud": "m", "tiempo": "s", "masa": "kg",
    "angulo": "rad", "aceleracion": "G", "curvatura": "1/m",
    "jerk": "G/s", "fuerza": "N", "energia": "J"
  }
}
```

**Regla de compatibilidad:** el consumidor compara solo el MAJOR de `versionContrato`. Distinto MAJOR
→ se niega a cargar con un mensaje claro. Igual MAJOR, MINOR mayor → carga e ignora lo que no conoce.

---

## 4. `parametros`

Dos mitades: los valores y el esquema que los describe.

```jsonc
{
  "valores": {
    "modoCurvatura": "Clotoide",
    "metodoDeAcoplamiento": "A",
    "radioDelLoop": 0.30,
    "peralteDeLaHelice": 0.9599,        // rad, NO grados
    "boundingBoxDisponible": [[0,2.5],[0,2.0],[0,1.2]],
    "onsetNormativoPorEje": [2.0, 2.0, 2.0],
    // ... todo ParametrosPorDefecto(), aplanado, camelCase
  },

  "esquema": {
    "modo": {
      "nombre": "Clotoide",
      "opciones": ["AceleracionNormalConstante","Clotoide","FuerzaGConstante","GNormativaMaxima"],
      "nota": "",
      "parametros": [
        { "clave": "radioDeReferencia", "unidad": "m",
          "descripcion": "radio de la heartline en el arco (el riel va d*cos(psi) mas afuera)" }
      ]
    },

    "elementos": {
      "LoopVertical": [
        { "clave": "radioDelLoop",      "unidad": "m",   "descripcion": "radio de la heartline en la cuspide..." },
        { "clave": "rollExtraDelLoop",  "unidad": "rad", "descripcion": "roll adicional respecto de la vertical" },
        { "clave": "separacionDePatas", "unidad": "m",   "descripcion": "avance sobre el eje de la helice..." }
      ],
      "Helice":         [ /* ... */ ],
      "OverBankedTurn": [ /* ... */ ],
      "DiveLoop":       [ /* ... */ ]
    },

    "aceptacion": [
      { "clave": "gMinimaCuspide", "unidad": "G", "descripcion": "holgura minima de Gz en la cuspide..." }
      // ... ParametrosDeAceptacion()
    ],

    "generales": [
      { "clave": "masa", "unidad": "kg", "descripcion": "masa del carro con el pasajero" }
      // ... ParametrosGenerales(): bloque 4, fisica, carro, resolucion, escalado, discretizacion, tolerancias
    ]
  },

  "defaults": { /* ParametrosPorDefecto() sin overrides, en camelCase: alimenta el botón "resetear" */ }
}
```

`esquema.elementos` se arma llamando a cada constructor de `CatalogoDeElementos()` **sin argumentos**.
`esquema.modo` sale de `ParametrosDelModo()`, `esquema.aceptacion` de `ParametrosDeAceptacion()` y
`esquema.generales` de `ParametrosGenerales()`. Cero listas escritas a mano.

**Garantía de cobertura.** El exportador verifica que *todo* campo de `Parametros` esté declarado en
alguna de las cuatro listas (todos los modos, todos los elementos, aceptación, generales); el único
exento es `ModoCurvatura`, que es el selector y lo describe `esquema.modo` (`nombre` + `opciones`).
Un parámetro nuevo en `ParametrosPorDefecto.m` sin declarar hace fallar el export con un mensaje que
dice dónde declararlo. Es lo que impide que el panel de la web muestre un valor sin etiqueta ni unidad.

Una limitación consciente de v1: `esquema.modo.parametros` trae solo los del modo **actual**. Cambiar
de modo en la web requiere recalcular, y quien recalcula (MATLAB hoy, el port mañana) produce el JSON
con las declaraciones del modo nuevo.

---

## 5. `estadoInicial`

```jsonc
{
  "posicion":          [0, 0, 1.00],   // sobre el RIEL
  "versorTangente":    [1, 0, 0],
  "versorArribaCarro": [0, 0, 1],
  "velocidad":         4.50,           // del centro de masa (heartline)
  "energiaTotal":      12.87
}
```

Espejo exacto de `EstadoInicial.m`. La `posicion` viaja sobre el **riel**; el pasajero queda
`distanciaHeartline` por encima, medido sobre `U`.

---

## 6. `elementos[]`

Un objeto por elemento. **El primer nodo de cada elemento coincide con el último del anterior**; el
consumidor lo descarta al concatenar, igual que hace `LayoutAgregarElemento.m` con la polilínea.

```jsonc
{
  "indice": 0,
  "tipo":   "LoopVertical",           // Receta.Nombre
  "parametrosUsados": { "radioDelLoop": 0.30, "rollExtraDelLoop": 0, "separacionDePatas": 0.08 },

  "nodos":     { ... },   // §6.1
  "subtramos": [ ... ],   // §6.2
  "resumen":   { ... },   // §6.3
  "criterios": { ... },   // §6.4
  "estadoSalida": { ... } // misma forma que estadoInicial
}
```

### 6.1 `nodos` — arrays columnares de igual largo

Todos los arrays de este bloque tienen exactamente `numeroDeNodos` elementos.

| Clave JSON | Unidad | Origen en MATLAB | Qué es |
|---|---|---|---|
| `numeroDeNodos` | – | `size(Track.PuntosRiel,1)` | largo de todos los arrays |
| `arco` | m | `Track.LongitudArco` | abscisa curvilínea acumulada desde el inicio del layout |
| `tiempo` | s | `Sim.Tiempo` | tiempo de recorrido — **el eje del botón play**. Arranca en 0 en **cada elemento** (así lo produce `SimularSobreTrack`); el acumulado del circuito lo suma el consumidor con `resumen.tiempoDeRecorrido` de los anteriores |
| `x`, `y`, `z` | m | `Track.PuntosHeartline` | heartline: donde va el pasajero |
| `xRiel`, `yRiel`, `zRiel` | m | `Track.PuntosRiel` | riel: lo que se fabrica |
| `versorTangente` | – | `Track.VersorTangente` | `[N][3]`, dirección de avance |
| `versorArribaCarro` | – | `Track.VersorArribaCarro` | `[N][3]`, asiento → cabeza |
| `versorLateral` | – | `Track.VersorLateral` | `[N][3]`, `L = T × U` |
| `velocidad` | m/s | `Sim.VelocidadCentroDeMasa` | del centro de masa — **la que usa el play** |
| `velocidadRiel` | m/s | `Sim.Velocidad` | del punto sobre el riel |
| `aceleracionTangencial` | m/s² | `Sim.AceleracionTangencial` | |
| `gx`, `gy`, `gz` | G | `Sim.Gx/Gy/Gz` | en el punto de verificación — **los mapas de calor** |
| `jerkGx`, `jerkGy`, `jerkGz` | G/s | `Sim.JerkGx/...` | |
| `gyCabeza`, `gzCabeza` | G | `Sim.GyCabeza/GzCabeza` | variante conservadora |
| `curvatura` | 1/m | `Track.CurvaturaHeartline` | de la heartline (radio = `1/κ` en el frontend) |
| `curvaturaRiel` | 1/m | `Track.Curvatura` | del riel |
| `anguloRoll` | **rad** | `Track.AnguloRoll` | contra el marco de transporte paralelo |
| `anguloPeralte` | **rad** | `Track.AnguloPeralte` | |
| `fuerzaNormal` | N | `Sim.FuerzaNormal` | |
| `energiaTotal` | J | `Sim.EnergiaTotal` | |

Los vectoriales van como `[[x,y,z], [x,y,z], ...]` — array de tripletes, no tres arrays sueltos. Es
lo que `BufferAttribute` con `itemSize: 3` espera después de aplanar.

**Campo opcional.** `puntoDeParada` (índice entero o `null`): si la simulación detectó que el carro se
queda sin energía, marca dónde. El visualizador lo pinta y corta la animación ahí.

### 6.2 `subtramos`

```jsonc
[
  { "nombre": "ClotoideEntrada", "indiceInicio": 0,   "indiceFin": 340 },
  { "nombre": "ArcoPrincipal",   "indiceInicio": 340, "indiceFin": 1660 },
  { "nombre": "ClotoideSalida",  "indiceInicio": 1660,"indiceFin": 2000 }
]
```

Copia de `Track.SubTramos`, con **índices base 0** (MATLAB es base 1: el exportador resta 1).
Los usa el visualizador para colorear por sub-tramo y para marcar visualmente dónde empieza y termina
cada transición clotoidal — que es justamente lo que hace falta para *ver* la continuidad C².

### 6.3 `resumen`

Volcado plano de `Reporte.Resumen`, con las mismas claves en camelCase. Alimenta el panel numérico
lateral. Las importantes para la UI:

`longitudRecorrida`, `longitudDeMaterial`, `alturaMaxima`, `radioMinimo`, `radioMinimoRiel`,
`velocidadMinima`, `tiempoDeRecorrido`, `gzMaxima`, `gzMinima`, `gyMaximaAbsoluta`,
`fuerzaNormalMaxima`, `peralteMaximo`, `posicionFinal`, `saltoDePosicion`, `saltoDeTangente`,
`saltoDeCurvatura`, `residualCierrePitch`, `desplazamientoLateral`, `desplazamientoLateralObjetivo`,
`inclinacionHelicoidal`, `lambdaLoop`, `lambdaCarro`, `distorsion`, `velocidadInicialMinima`.

Los tres `salto*` son los que le dicen al usuario, de un vistazo, si el empalme con el elemento
anterior es limpio. Merecen tratamiento visual destacado: son la razón de ser de todo el trabajo de
continuidad.

Dos campos que no son escalares: `posicionFinal` es un `[x,y,z]` y **`onsetMaximoModelo` es un
`[Gx,Gy,Gz]`** (copia de `Escala.OnsetMaximo`, el presupuesto de onset por eje del modelo, en G/s).
`busquedaVelocidad` es un objeto (`convergio`, `evaluaciones`, `motivo`) que documenta la bisección de
`velocidadInicialMinima`; llega también cuando el cálculo no se pidió.

### 6.4 `criterios`

`AgregarCriterio.m` ya produce **exactamente** la estructura que necesita la UI. Se exporta tal cual:

```jsonc
{
  "previos": [
    { "nombre": "Radio minimo fabricable", "sentido": "MayorOIgual", "pasa": true,
      "valor": 0.30, "limite": 0.05, "margen": 0.25, "unidad": "m",
      "detalle": "Si falla, la impresora no puede..." }
  ],
  "posteriores": [ /* idem */ ],
  "normativo":   { /* ChequeosPosteriores → Reporte.Normativo */ },
  "todosPasan":  true
}
```

`pasa` → semáforo. `margen` → **negativo se lee directo como cuánto falta**, así que la barra de
progreso del criterio sale gratis. `detalle` → tooltip que explica qué hacer si falla. No hace falta
diseñar nada: el modelo de datos de la verificación ya está bien.

#### 6.4.1 `normativo`

Volcado de `Reporte.Normativo` (`VerificarLimitesNormativos.m`) en camelCase. Es el detalle detrás de
los criterios `+Gz (Fig. 10)`, `-Gz (Fig. 9)`, `Gy (Fig. 8)`, `+Gx (Fig. 6)`, `-Gx (Fig. 7)`, las tres
elipses de 7.1.5.1 y los onsets, que ya están resumidos como `criterio` en `posteriores`.

```jsonc
{
  "factorTiempo": 5.16,                 // sqrt(lambda_loop): duración modelo → duración real
  "duracionModelo": 0.597,              // s, del elemento, en tiempo del modelo
  "duracionRealEquivalente": 3.08,      // s reales
  "huboAirtimeSostenido": false,        // -Gz sostenido > 3 s (7.1.7.1)
  "curvaMasGzAplicada": "MasGzTodas",   // o "MasGzReducido" si hubo airtime sostenido

  // Un evento sostenido por eje y sentido. Es el peor nivel G* contra la curva límite:
  "masGz":   { "curva": "MasGzTodas",  "signo":  1, "nivelCritico": 8.18, "duracionReal": 0.205,
               "limiteAplicado": 6.0, "exceso": 2.18, "duracionMasLarga": 3.08, "picoG": 8.47 },
  "menosGz": { /* idem, signo -1; limiteAplicado y exceso son null si no hubo evento de ese signo */ },
  "gy":      { /* sobre |Gy| */ },
  "masGx":   { /* ... */ },
  "menosGx": { /* ... */ },

  "elipse": { "valorMaximoGyGz": 1.65, "valorMaximoGxGz": 1.67, "valorMaximoGxGy": 0.02,   // ≤ 1 pasa
              "semiejes": [6.6, 3.3, 6.6] },                                             // [Gx, Gy, Gz], límites de 200 ms × 1.1
  "onsetDeCarga": 0,                     // G/s, solo transiciones de ≤0 G a ≥2 G (7.1.7.2)
  "onsetNormativoReal": 15,              // G/s, Parametros.OnsetNormativoPorEje(3)
  "onsetPresupuestoModelo": [25.8, 25.8, 77.5],   // G/s por eje, Escala.OnsetMaximo
  "onsetMaximoPorEje": [2.66, 1.68, 77.3]         // G/s por eje, medido
}
```

`exceso` **positivo** es cuánto se pasó de la curva de la norma en el peor evento; `-Inf` (sin evento
de ese signo) llega como `null`. Para la UI alcanza con los `criterio` de `posteriores`; este bloque es
para el panel de detalle normativo y para el arnés de golden files.

---

## 7. `resumenLayout`

```jsonc
{
  "numeroDeElementos": 4,
  "longitudTotal": 12.847,
  "tiempoTotal": 8.31,
  "velocidadFinal": 3.92,
  "gzMaximaGlobal": 4.87,
  "gyMaximaAbsolutaGlobal": 1.94,
  "alturaMaxima": 1.18,
  "alturaMinima": 0.12,
  "boundingBox": [[-0.4, 2.1], [-1.2, 0.9], [0.1, 1.2]],
  "todosLosCriteriosPasan": false
}
```

`boundingBox` le ahorra al frontend recorrer todos los nodos para encuadrar la cámara al abrir.

Qué curva mide cada cosa (lo fija el exportador, `LayoutAJson.m`): `alturaMaxima` y `alturaMinima` son
el z **del riel**, absoluto — es la pieza que se fabrica y la que compara `AlturaMinimaSuelo`;
`boundingBox` abarca **riel y heartline juntas**, porque las dos se dibujan. `longitudTotal` y
`tiempoTotal` son las sumas de `resumen.longitudRecorrida` y `resumen.tiempoDeRecorrido`;
`gzMaximaGlobal`, `gzMinimaGlobal` y `gyMaximaAbsolutaGlobal` el máximo/mínimo de los `resumen` de
cada elemento; `velocidadFinal` la del centro de masa a la salida del último.

---

## 8. Protocolo de golden files

El contrato es también el formato del arnés de validación del port. Sin esto, "¿porté bien la
física?" es una opinión; con esto, es un test que corre solo.

**Casos canónicos** — `golden/<caso>.json`, generados por MATLAB, versionados en el repo:

| Caso | Elemento | Modo |
|---|---|---|
| `loop-clotoide` | LoopVertical | Clotoide |
| `loop-gconstante` | LoopVertical | FuerzaGConstante |
| `loop-normativa` | LoopVertical | GNormativaMaxima |
| `loop-anconstante` | LoopVertical | AceleracionNormalConstante |
| `helice-clotoide` | Helice | Clotoide |
| `helice-normativa` | Helice | GNormativaMaxima |
| `obt-clotoide` | OverBankedTurn | Clotoide |
| `obt-normativa` | OverBankedTurn | GNormativaMaxima |
| `diveloop-clotoide` | DiveLoop | Clotoide |
| `diveloop-normativa` | DiveLoop | GNormativaMaxima |
| `circuito-demolayout` | los cuatro encadenados | Clotoide |

Los genera `GenerarGoldenFiles.m`, que también los valida. El setup de los diez casos sueltos está
fijado ahí: `ParametrosPorDefecto` con `RadioDelLoop = 0.30`, método A, entrada en `[0 0 1]` a nivel a
5,0 m/s, y el over-banked turn a 240° (con los 120° por defecto el modo normativo no deja arco). El
circuito es el de `DemoLayout.m` tal cual. Cada archivo lleva en `meta.versionGenerador` el commit
que lo produjo; se regeneran cuando cambia la física, nunca a mano.

**Resultado de la primera corrida cruzada (2026-09-19).** El núcleo porteado a TypeScript
(`web/src/nucleo/`) reproduce los once casos con el mismo número de nodos, los mismos veredictos y todas
las magnitudes dentro del redondeo del export (ver §10, punto 3). La tabla de abajo queda como
referencia de lo que se esperaba; lo que efectivamente se usa es 6e-6 relativo + 1e-9 absoluto, porque
los golden tienen 6 cifras y no se puede exigir más que eso. Las "trampas conocidas" de más abajo se
confirmaron todas menos una: `fzero` no aparece en el repo (la bisección de `VelocidadInicialMinima`
es a mano), así que no hubo que portear un Brent.

**MATLAB es la referencia normativa; JS es un superconjunto (decidido 2026-09-20).** El núcleo en
TypeScript admite ajustes de parámetros **por instancia** de elemento (dos hélices con radios distintos
en la misma secuencia; §6, campos `ajustes` e `inertes`), cosa que MATLAB, con sus `Parametros`
globales, no hace. La regla es que con `ajustes` vacíos en todas las instancias el resultado tiene que
ser **idéntico** al de MATLAB: los golden se siguen generando con MATLAB, `golden-port.test.ts` no se
toca, y un cambio en JS que los rompa está mal por definición. MATLAB no cambia y sigue siendo la
memoria de cálculo para el caso de parámetros globales, que es al que JS se reduce exactamente.

**Tolerancias por campo, no global.** El orden de acumulación en punto flotante difiere entre MATLAB
y JS, así que un `assert` de igualdad exacta va a fallar por razones que no son físicas. Punto de
partida a calibrar con la primera corrida real:

| Grupo | Tolerancia relativa | Absoluta |
|---|---|---|
| Posiciones (`x,y,z,xRiel,...`) | 1e-9 | 1e-12 m |
| Versores | 1e-9 | 1e-12 |
| Curvaturas, ángulos | 1e-8 | 1e-11 |
| Velocidad, tiempo, energía | 1e-8 | 1e-11 |
| G y jerk (derivadas numéricas: **acumulan error**) | 1e-6 | 1e-9 |
| Resumen (máximos, mínimos) | 1e-7 | 1e-10 |
| `criterios[].pasa` | **igualdad exacta** | – |

`pasa` es booleano y no admite tolerancia: si el port cambia un veredicto de aceptación, es un bug,
por chico que sea el margen numérico.

**Trampas conocidas del cruce MATLAB → JS**, a vigilar cuando un campo no cierre:

- Indexado base 1 → base 0 (especialmente en `subtramos`, ver §6.2).
- Vector fila vs. columna: el repo normaliza con `(:).'` en `EstadoInicial.m`; JS no tiene el concepto.
- `fzero` → hay que implementar un Brent equivalente; converge a otro punto dentro de la misma
  tolerancia, lo cual desplaza todo aguas abajo. Es la causa más probable de una divergencia grande.
- `cumsum` sobre muchos nodos: el orden de suma importa.
- `eps` de MATLAB = `Number.EPSILON` de JS (ambos 2⁻⁵²), pero `max(x, eps)` aparece en varios lados y
  hay que portearlo literal, no "mejorarlo".

---

## 9. Qué NO está en este contrato, a propósito

- **Colores, escalas, paletas.** Son decisión de presentación. El contrato manda magnitudes físicas;
  el frontend decide cómo pintarlas.
- **Geometría de malla (tubo, durmientes, estructura).** Se genera en el frontend a partir de la
  polilínea y los versores. Mandarla por JSON multiplicaría el tamaño sin agregar información.
- **Estado de la UI** (qué toggles están prendidos, dónde está la cámara). Va en el `localStorage` o
  en el hash de la URL, no en el contrato de datos.
- **El propio layout como entrada editable.** Para *compartir* un layout alcanza con los
  `parametros.valores` (~40 números) codificados en el hash de la URL: el consumidor recalcula todo
  lo demás. Un archivo de 2 MB no se manda por link; 40 números sí.

---

## 10. Pendientes de decisión

1. ~~camelCase vs. nombres MATLAB verbatim~~ **Decidido: camelCase** (2026-09-18). Regla mecánica
   (primera letra en minúscula); las excepciones están en NOMENCLATURA.md §9.
2. ~~Medir el tamaño real~~ **Medido** (§1.8): 2,2 MB crudo, 0,73 MB gzip para el circuito de cuatro.
   No hace falta binario en v1.
3. ~~Tolerancias de §8~~ **Calibradas con la primera corrida cruzada** (2026-09-19, `web/test/golden-port.test.ts`):
   el port en TypeScript reproduce los once golden con el mismo número de nodos, los mismos veredictos
   `pasa` y toda magnitud dentro de **6e-6 relativo + 1e-9 absoluto**. Ese número no lo fija el port
   sino el export: los golden llevan 6 cifras significativas (§1.8), así que ninguna tolerancia puede
   ser más fina que media unidad de la sexta cifra. Las diferencias propias del port (orden de
   acumulación en punto flotante) quedan muy por debajo; si hiciera falta afinar, habría que exportar
   los golden con más cifras.
4. ~~`Reporte.Normativo`~~ **Detallado** en §6.4.1; el exportador lo vuelca entero.
5. ~~`parametros.esquema.generales` está vacío~~ **Resuelto** (2026-09-18): `ParametrosGenerales.m`
   declara el bloque 4 con ternas, `DescribirParametros` lo imprime como cuarto grupo y el
   exportador verifica la cobertura de todos los parámetros (§4).
6. ~~`nodos.tiempo` por elemento o acumulado~~ **Decidido: por elemento** (2026-09-18). `nodos.tiempo`
   es `Sim.Tiempo` tal cual, arranca en 0 en cada elemento; el eje continuo del botón play lo arma la
   web sumando `resumen.tiempoDeRecorrido` de los elementos anteriores (§6.1).
