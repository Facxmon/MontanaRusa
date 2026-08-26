# Análisis de conservación de energía para diseño de montañas rusas

Documentación del proceso y las ecuaciones implementadas en [`untitled.m`](untitled.m). Es un modelo preliminar ("rough model"): a partir de una trayectoria 3D, calcula velocidad, radio de curvatura, fuerzas normales (en G's) y pérdidas por fricción a lo largo del recorrido.

## 1. Parámetros del modelo

| Variable | Significado | Unidad |
|---|---|---|
| `DistanciaDeDiscretizacion` | cada cuánto (medido sobre la curva) se pone un punto de análisis | m |
| `Gravedad` | aceleración de la gravedad | m/s² |
| `CoefFriccion` | coeficiente de fricción cinética entre el carrito y la vía | — |
| `Masa` | masa del carrito | kg |
| `VelocidadInicial` | velocidad en el primer punto de la trayectoria | m/s |

## 2. Trayectoria paramétrica

La vía se define como una curva paramétrica en función de una variable libre `t`:

$$X(t),\quad Y(t),\quad Z(t), \qquad t \in [T_{min}, T_{max}]$$

Parametrizar por `t` (en vez de usar `x` como parámetro) permite representar curvas que doblan hacia atrás, suben y bajan más de una vez para el mismo `x`, o hacen loops.

Se muestrea finamente (`NumPuntosFinos`, actualmente 2000 puntos) para aproximar la curva continua como una polilínea de segmentos muy cortos — `TrayectoriaFina`.

Trayectoria de prueba actual (debug):
$$X(t) = t\sin(t) + 1, \qquad Y(t) = t\cos(t) + 1, \qquad Z(t) = 10 - t$$

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

### Dirección (centro de curvatura)

Se calcula el centro exacto de esa misma circunferencia con la fórmula de **coordenadas baricéntricas del circuncentro** (válida en 2D o 3D):

$$\alpha = a^2(b^2+c^2-a^2), \quad \beta = b^2(c^2+a^2-b^2), \quad \gamma = c^2(a^2+b^2-c^2)$$

$$\text{CentroDeCurvatura} = \frac{\alpha P_{i-1} + \beta P_i + \gamma P_{i+1}}{\alpha+\beta+\gamma}$$

$$\text{DireccionRadioDeGiro} = \frac{\text{CentroDeCurvatura} - P_i}{\lVert \text{CentroDeCurvatura} - P_i \rVert}$$

Es el vector unitario que apunta, desde cada punto de la vía, hacia el centro de curvatura ("hacia dónde te empuja la curva").

## 5. Notación `[X Y Z Magnitud]`

Toda matriz que guarda **vectores** (no posiciones) en el documento sigue el mismo formato: las primeras 3 columnas son la dirección normalizada (vector unitario) y la 4ta columna es el módulo real. Para recuperar el vector completo de cualquier fila: `Magnitud .* [X Y Z]`.

Se aplica a `DireccionRadioDeGiro`, `VersorTangente`, `GravedadProyectada`, `NormalRadioDeGiro` y `NormalVia`.

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

## 8. Proceso iterativo: velocidad, normales y fricción

Fórmula de trabajo de fricción usada:

$$\text{EnergiaPerdidaPorFriccion} = \text{CoefFriccion}\cdot \text{FuerzaNormal} \cdot \text{DistanciaSegmento}$$

Como la energía disponible en el punto $k+1$ depende del rozamiento entre $k$ y $k+1$, que depende de la fuerza normal en $k$, que depende de la velocidad en $k$, que depende de la energía en $k$ — es una cadena que **no se puede vectorizar**: se recorre la trayectoria punto por punto (equivalente a un método de Euler explícito).

Para cada punto $k$ (de 1 a $n-1$), con `EnergiaTotal(1) = `$E_0$:

1. $\text{EnergiaCinetica}_k = \text{EnergiaTotal}_k - \text{EnergiaPotencial}_k$
   - Si es negativa: el carrito no tiene energía suficiente para llegar ahí → **se corta el cálculo** (`PuntoDeParada`) y se grafica solo hasta ese punto.
2. $\text{Velocidad}_k = \sqrt{2\,\text{EnergiaCinetica}_k / \text{Masa}}$
3. Aceleración centrípeta, proyectada sobre el plano perpendicular:
   $$\text{NormalRadioDeGiro}_k = \text{proy}_{\perp}\left(\text{DireccionRadioDeGiro}_k \cdot \frac{\text{Velocidad}_k^2}{\text{RadioDeGiro}_k}\right)$$
4. Equilibrio en el plano perpendicular — se despeja la aceleración que debe aportar la vía:
   $$\text{GravedadProyectada} + \text{NormalVia} + \text{NormalRadioDeGiro} = 0$$
   $$\text{NormalVia}_k = -(\text{GravedadProyectada}_k + \text{NormalRadioDeGiro}_k)$$
5. Fuerza normal real (recién acá se reintroduce la masa, ya que todo lo anterior está en unidades de aceleración):
   $$\text{FuerzaNormal}_k = \text{Masa} \cdot \lVert \text{NormalVia}_k \rVert$$
6. Pérdida de energía en el tramo $k \to k+1$ y actualización del contador:
   $$\text{EnergiaTotal}_{k+1} = \text{EnergiaTotal}_k - \text{CoefFriccion}\cdot\text{FuerzaNormal}_k\cdot\text{DistanciaSegmento}$$

**Caso de borde:** el primer punto no tiene curvatura definida (no tiene vecino anterior), así que se asume sin pérdida en el primer tramito (`EnergiaTotal(2) = EnergiaTotal(1)`) — error despreciable al ser 1 segmento de ~150.

## 9. Unidades en G's

Ni `Gravedad` ni $v^2/R$ están multiplicados por `Masa`, así que toda la ecuación de equilibrio queda en unidades de aceleración. Dividiendo `GravedadProyectada`, `NormalRadioDeGiro` y `NormalVia` por `Gravedad`, quedan expresadas en **G's** — independiente de qué tan pesado sea el carrito.

## 10. Signo de la fuerza centrípeta sentida

Como `NormalRadioDeGiro` y `DireccionRadioDeGiro` ya están normalizadas, el producto punto entre sus direcciones da el signo:

$$\text{signo} = \text{sign}\big(\widehat{\text{NormalRadioDeGiro}} \cdot \widehat{\text{DireccionRadioDeGiro}}\big)$$

$$\text{FuerzaGRadioDeGiro} = \text{signo} \times \lVert \text{NormalRadioDeGiro} \rVert$$

Positivo: la fuerza empuja en el sentido del radio de giro (hacia el centro de curvatura). Negativo: en sentido opuesto.

## 11. Gráficos generados

1. **Trayectoria 3D — radio de giro**: vía en gris, puntos coloreados por curvatura ($1/R$), flechas con la dirección del radio de giro.
2. **Energía vs Longitud Recorrida**: energía potencial, recta de energía inicial ($E_0$) y energía total real (decreciente por fricción), con marca en el punto donde el carrito se queda sin energía (si aplica).
3. **Trayectoria 3D — velocidades**: vía en gris, puntos coloreados por velocidad, flechas con la dirección de avance (tangente).
4. **Fuerza G por radio de giro** (con signo) vs Longitud Recorrida.
5. **Trayectoria 3D — G's sobre la vía**: vía en gris, puntos coloreados por la magnitud de `NormalVia`, flechas con su dirección.

En todos los gráficos que dependen de la energía, los puntos posteriores a `PuntoDeParada` quedan en `NaN` y la línea se corta sola ahí — no se inventan datos donde el carrito no llegó.

## 12. Limitaciones actuales / posibles próximos pasos

- La trayectoria hoy se genera en el propio script (debug); falta la importación de una lista real de puntos.
- El esquema de integración es Euler explícito (orden 1): usa la normal al **principio** de cada segmento para estimar la pérdida de todo el tramo. Podría refinarse (p. ej. promediando la normal entre extremos del segmento).
- La fricción se modela solo a partir de la componente normal a la trayectoria (no hay modelo de fricción lateral ni de rodadura detallado).
- El primer segmento de la vía no computa pérdida por fricción (no hay curvatura definida en el extremo inicial).
