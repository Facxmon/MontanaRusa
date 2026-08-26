%% Análisis de conservación de energía sobre una trayectoria (rough model)
% Modelo preliminar para diseño de montañas rusas.
% Se importa (o, por ahora en debug, se genera) una trayectoria ordenada
% de puntos, se discretiza por longitud de arco, y se analiza la energía
% mecánica a lo largo del recorrido.

%% Parámetros
DistanciaDeDiscretizacion = 0.1;   % [m] separación entre puntos de análisis a lo largo de la trayectoria
Gravedad = 9.81;                   % [m/s^2]
CoefFriccion=0.18;

%% Trayectoria (debug), parametrizada por t: X(t), Y(t), Z(t)
% Al parametrizar por un t libre (en vez de usar x directamente como
% parámetro) la curva puede doblar hacia atrás, subir y bajar más de una
% vez para el mismo x, o hacer loops -- alcanza con que X(t), Y(t), Z(t)
% sean funciones válidas de t, no hace falta que la trayectoria sea
% "función de x". Para probar una curva nueva, solo hay que cambiar las
% 3 líneas de XFino/YFino/ZFino de acá abajo.
TMin = 0;
TMax = 10*pi;
NumPuntosFinos = 2000;             % muestreo fino para estimar bien la longitud de arco

TFino = linspace(TMin, TMax, NumPuntosFinos)';
XFino = sin(TFino);
YFino = 2*cos(TFino);
ZFino = 10-TFino+20*cos(TFino/10);
TrayectoriaFina = [XFino, YFino, ZFino];
% TrayectoriaFina: la "vía" dibujada con muchísimos puntos pegados entre
% sí (2000), tan juntos que para todo propósito práctico es una curva
% continua. Es el original del cual vamos a sacar copias más espaciadas.

%% Discretización de la trayectoria por longitud de arco
DeltaSegmentos = vecnorm(diff(TrayectoriaFina), 2, 2);
% DeltaSegmentos: cuánto mide, en metros, cada tramito entre dos puntos
% consecutivos de TrayectoriaFina. Es la "regla" con la que después vamos
% a medir cuánto llevamos recorrido.

LongitudAcumulada = [0; cumsum(DeltaSegmentos)];
% LongitudAcumulada: el cuentakilómetros. Para cada punto de
% TrayectoriaFina, dice cuánto se recorrió desde el arranque hasta llegar
% ahí (sumando todos los tramitos anteriores).

LongitudTotal = LongitudAcumulada(end);

LongitudRecorrida = (0:DistanciaDeDiscretizacion:LongitudTotal)';
% LongitudRecorrida: la lista de "marcas" donde queremos poner un punto
% de análisis (0, 0.1, 0.2, 0.3... metros recorridos). Todavía no son
% puntos (x,y,z), son solo las distancias a las que los queremos.

TrayectoriaDePuntos = interp1(LongitudAcumulada, TrayectoriaFina, LongitudRecorrida, 'linear');
% TrayectoriaDePuntos: la trayectoria ya discretizada. Matriz n x 3
% (columnas x, y, z), con un punto cada DistanciaDeDiscretizacion metros
% de recorrido real sobre la curva. Es el resultado final de esta sección
% y lo que se usa de acá en adelante para todos los cálculos de energía.

%% Radio de giro de la trayectoria
% Para cada punto interior de TrayectoriaDePuntos, se estima el radio de
% la circunferencia que pasa por él y por sus dos vecinos (anterior y
% siguiente). Ese radio es la curvatura local de la vía en ese tramo.
PuntoAnterior  = TrayectoriaDePuntos(1:end-2, :);
PuntoActual    = TrayectoriaDePuntos(2:end-1, :);
PuntoSiguiente = TrayectoriaDePuntos(3:end,   :);

LadoA = vecnorm(PuntoActual - PuntoAnterior, 2, 2);
LadoB = vecnorm(PuntoSiguiente - PuntoActual, 2, 2);
LadoC = vecnorm(PuntoSiguiente - PuntoAnterior, 2, 2);
AreaTriangulo = 0.5*vecnorm(cross(PuntoActual - PuntoAnterior, PuntoSiguiente - PuntoAnterior, 2), 2, 2);

RadioDeGiro = (LadoA .* LadoB .* LadoC) ./ (4*AreaTriangulo);
% RadioDeGiro: radio de curvatura estimado en cada punto interior (n-2
% valores, ya que el primer y el último punto no tienen dos vecinos).
% Cuanto más chico, más cerrada la curva; en un tramo recto el triángulo
% se aplana (AreaTriangulo -> 0) y el radio tiende a infinito.
LongitudRecorridaRadio = LongitudRecorrida(2:end-1);
% LongitudRecorridaRadio: longitud recorrida asociada a cada valor de
% RadioDeGiro, para poder graficarlo o cruzarlo con otras magnitudes.

% Dirección del radio de giro: en vez de solo el radio (un número),
% calculamos el centro exacto de esa misma circunferencia y la dirección
% es simplemente "desde el punto hacia ese centro". Se usa la fórmula de
% coordenadas baricéntricas del circuncentro, que funciona igual en 2D o
% en 3D (no hace falta definir un plano ni un "arriba" a mano).
PesoAnterior  = LadoB.^2 .* (LadoC.^2 + LadoA.^2 - LadoB.^2);
PesoActual    = LadoC.^2 .* (LadoA.^2 + LadoB.^2 - LadoC.^2);
PesoSiguiente = LadoA.^2 .* (LadoB.^2 + LadoC.^2 - LadoA.^2);
SumaPesos = PesoAnterior + PesoActual + PesoSiguiente;

CentroDeCurvatura = (PesoAnterior.*PuntoAnterior + PesoActual.*PuntoActual + PesoSiguiente.*PuntoSiguiente) ./ SumaPesos;
% CentroDeCurvatura: coordenadas (x,y,z) del centro de la misma
% circunferencia cuyo radio es RadioDeGiro.

DireccionRadioDeGiro = (CentroDeCurvatura - PuntoActual) ./ vecnorm(CentroDeCurvatura - PuntoActual, 2, 2);
% DireccionRadioDeGiro: vector unitario (n-2 x 3) que apunta, desde cada
% punto de la trayectoria, hacia el centro de curvatura. Es "hacia dónde
% te empuja la curva" en ese punto -- por ejemplo, en un valle apunta
% hacia arriba, y en la cresta de una loma apunta hacia abajo.

%% Gráfico 3D: trayectoria con dirección y magnitud del radio de giro
Curvatura = 1 ./ RadioDeGiro;
% Curvatura: inversa del radio (1/RadioDeGiro), en 1/m. Se usa solo para
% pintar la magnitud con un color, porque el radio se va a infinito en
% los tramos rectos y eso no se puede representar bien en una escala de
% colores.

EspaciadoFlechas = 5;   % dibujar 1 de cada 5 flechas, para que no se amontonen
IndicesFlechas = 1:EspaciadoFlechas:length(RadioDeGiro);

figure
plot3(TrayectoriaDePuntos(:,1), TrayectoriaDePuntos(:,2), TrayectoriaDePuntos(:,3), ...
      'Color', [0.6 0.6 0.6], 'LineWidth', 1)
hold on
scatter3(PuntoActual(:,1), PuntoActual(:,2), PuntoActual(:,3), 25, Curvatura, 'filled')
quiver3(PuntoActual(IndicesFlechas,1), PuntoActual(IndicesFlechas,2), PuntoActual(IndicesFlechas,3), ...
        DireccionRadioDeGiro(IndicesFlechas,1), DireccionRadioDeGiro(IndicesFlechas,2), DireccionRadioDeGiro(IndicesFlechas,3), ...
        0.5, 'r', 'LineWidth', 1.2)
hold off
xlabel('x [m]')
ylabel('y [m]')
zlabel('z [m]')
colormap(jet)
BarraColor = colorbar;
BarraColor.Label.String = 'Curvatura [1/m]';
title('Trayectoria 3D: dirección (flechas) y magnitud (color) del radio de giro')
axis equal
grid on
view(45, 30)

%% Datos del móvil y energía inicial
Masa = 1;               % [kg]
VelocidadInicial = 0;   % [m/s]

E_0 = 1/2*Masa*VelocidadInicial^2 + Masa*Gravedad*TrayectoriaDePuntos(1,3);

%% Energía potencial gravitatoria a lo largo de la trayectoria
EnergiaPotencial = Masa*Gravedad*TrayectoriaDePuntos(:,3);
% EnergiaPotencial: cuánta energía potencial gravitatoria tiene el móvil
% en cada uno de los puntos de TrayectoriaDePuntos, calculada a partir de
% la altura (columna z) de cada punto. Un valor por punto de análisis.

EnergiaInicial = E_0*ones(size(LongitudRecorrida));
% EnergiaInicial: el mismo valor E_0 repetido n veces, solo para poder
% dibujarlo como una recta horizontal en el gráfico (la energía total
% disponible, que en este modelo sin fricción se mantiene constante).

%% Velocidad, Normales y Energía con fricción (proceso iterativo)
% A partir de acá la cuenta deja de poder vectorizarse: la energía en el
% punto k+1 depende de cuánto rozamiento hubo entre k y k+1, que depende
% de NormalVia en k, que depende de la Velocidad en k, que depende de la
% energía en k. Es una cadena, así que se recorre la trayectoria punto
% por punto (equivalente a un método de Euler explícito).

VectorTangente = PuntoSiguiente - PuntoActual;
VersorTangente = VectorTangente ./ vecnorm(VectorTangente, 2, 2);
% VersorTangente: dirección unitaria de la trayectoria en cada punto
% interior. No depende de la velocidad, así que se calcula una sola vez,
% vectorizado, antes del loop.

VectorGravedad = [0, 0, -Gravedad];
GravedadProyectada = VectorGravedad - sum(VectorGravedad.*VersorTangente, 2).*VersorTangente;
% GravedadProyectada: la parte de la gravedad que cae dentro del plano
% perpendicular a la vía. Tampoco depende de la velocidad, así que
% también se calcula de una sola vez, antes del loop.

DistanciaSegmento = DistanciaDeDiscretizacion;
% DistanciaSegmento: longitud de cada tramo entre puntos consecutivos de
% TrayectoriaDePuntos -- es constante e igual a DistanciaDeDiscretizacion
% porque así se armó la discretización por longitud de arco.

NumPuntos = size(TrayectoriaDePuntos, 1);
EnergiaTotal = nan(NumPuntos, 1);
Velocidad = nan(NumPuntos, 1);
EnergiaCinetica = nan(NumPuntos, 1);
EnergiaPerdidaPorFriccion = nan(NumPuntos-1, 1);
NormalRadioDeGiro = nan(NumPuntos-2, 3);
NormalVia = nan(NumPuntos-2, 3);
% Todo se precarga con NaN: si el carrito se queda sin energía a mitad
% de camino, las filas posteriores quedan en NaN, y los gráficos van a
% cortar la línea justo ahí en vez de mostrar datos inventados.

EnergiaTotal(1) = E_0;
PuntoDeParada = [];   % vacío si el carrito completa toda la trayectoria

for k = 1:NumPuntos-1
    EnergiaCinetica(k) = EnergiaTotal(k) - EnergiaPotencial(k);
    if EnergiaCinetica(k) < 0
        PuntoDeParada = k;
        break
    end
    Velocidad(k) = sqrt(2*EnergiaCinetica(k)/Masa);

    if k >= 2
        % Hay curvatura definida en este punto (RadioDeGiro, etc. están
        % indexados desde el punto 2 de la trayectoria: fila j = k-1).
        j = k - 1;
        NormalRadioDeGiroBruto = DireccionRadioDeGiro(j,:) * (Velocidad(k)^2 / RadioDeGiro(j));
        NormalRadioDeGiro(j,:) = NormalRadioDeGiroBruto - sum(NormalRadioDeGiroBruto.*VersorTangente(j,:))*VersorTangente(j,:);
        NormalVia(j,:) = -(GravedadProyectada(j,:) + NormalRadioDeGiro(j,:));

        FuerzaNormal = Masa * norm(NormalVia(j,:));
        EnergiaPerdidaPorFriccion(k) = CoefFriccion * FuerzaNormal * DistanciaSegmento;
        EnergiaTotal(k+1) = EnergiaTotal(k) - EnergiaPerdidaPorFriccion(k);
    else
        % k == 1: todavía no hay curvatura definida (primer punto, sin
        % vecino anterior) -- se asume sin pérdida en este primer
        % tramito, 1 de ~150 segmentos, error despreciable.
        EnergiaTotal(k+1) = EnergiaTotal(k);
    end
end

if isempty(PuntoDeParada)
    % El loop llegó hasta el final sin frenarse; falta chequear el
    % último punto, que tampoco tiene curvatura definida.
    EnergiaCinetica(NumPuntos) = EnergiaTotal(NumPuntos) - EnergiaPotencial(NumPuntos);
    if EnergiaCinetica(NumPuntos) < 0
        PuntoDeParada = NumPuntos;
    else
        Velocidad(NumPuntos) = sqrt(2*EnergiaCinetica(NumPuntos)/Masa);
    end
end

if ~isempty(PuntoDeParada)
    fprintf('El carrito se queda sin energía en el punto %d de %d (Longitud Recorrida = %.2f m).\n', ...
            PuntoDeParada, NumPuntos, LongitudRecorrida(PuntoDeParada));
end

% Aceleración tangencial: a_t = (v_{k+1}^2 - v_k^2) / (2*DistanciaSegmento),
% en el mismo rango de puntos interiores que el resto de las tablas de
% vectores. No hace falta que esté dentro del loop: no alimenta ninguna
% otra cuenta (a diferencia de NormalVia), es un resultado derivado que
% se puede calcular de una sola vez, vectorizado, con la Velocidad ya
% completa.
AceleracionTangencialEscalar = (Velocidad(3:end).^2 - Velocidad(2:end-1).^2) / (2*DistanciaSegmento);
AceleracionTangencial = AceleracionTangencialEscalar .* VersorTangente(:,1:3);
% AceleracionTangencial: si el carrito frena, AceleracionTangencialEscalar
% da negativo y el vector queda apuntando para atrás (opuesto a
% VersorTangente) -- eso se traduce solo al normalizar más abajo.

% Se expresan las tablas de vectores en G's (dividiendo por Gravedad) y
% en notación [X Y Z Magnitud] -- dirección unitaria en las primeras 3
% columnas, módulo en la 4ta. Se hace acá al final porque hasta acá
% DireccionRadioDeGiro y VersorTangente se seguían usando "en crudo" (3
% columnas) dentro del loop.
GravedadProyectada = GravedadProyectada / Gravedad;
NormalRadioDeGiro = NormalRadioDeGiro / Gravedad;
NormalVia = NormalVia / Gravedad;
AceleracionTangencial = AceleracionTangencial / Gravedad;

GravedadProyectada = [GravedadProyectada./vecnorm(GravedadProyectada,2,2), vecnorm(GravedadProyectada, 2, 2)];
NormalRadioDeGiro = [NormalRadioDeGiro./vecnorm(NormalRadioDeGiro,2,2), vecnorm(NormalRadioDeGiro, 2, 2)];
NormalVia = [NormalVia./vecnorm(NormalVia,2,2), vecnorm(NormalVia, 2, 2)];
AceleracionTangencial = [AceleracionTangencial./vecnorm(AceleracionTangencial,2,2), vecnorm(AceleracionTangencial,2,2)];
DireccionRadioDeGiro = [DireccionRadioDeGiro./vecnorm(DireccionRadioDeGiro,2,2), vecnorm(DireccionRadioDeGiro,2,2)];
VersorTangente = [VersorTangente./vecnorm(VersorTangente,2,2), vecnorm(VersorTangente,2,2)];
% DireccionRadioDeGiro y VersorTangente dan Magnitud = 1 en todas las
% filas (esperable, ya eran vectores unitarios).

%% Gráfico: Energía vs Longitud Recorrida
figure
plot(LongitudRecorrida, EnergiaPotencial, 'LineWidth', 2)
hold on
plot(LongitudRecorrida, EnergiaInicial, '--', 'LineWidth', 2)
plot(LongitudRecorrida, EnergiaTotal, 'LineWidth', 2)
if ~isempty(PuntoDeParada)
    plot(LongitudRecorrida(PuntoDeParada), EnergiaTotal(PuntoDeParada), 'rx', ...
         'MarkerSize', 12, 'LineWidth', 2, 'HandleVisibility', 'off')
end
hold off
xlabel('Longitud Recorrida [m]')
ylabel('Energía [J]')
legend('Energía Potencial Gravitatoria', 'Energía Inicial (E_0)', 'Energía Total (con fricción)', 'Location', 'best')
title('Energía sobre la trayectoria')
grid on

%% Gráfico 3D: trayectoria con velocidades
% Mismo estilo que el gráfico de radio de giro: la vía completa en gris
% (existe igual, la haya recorrido el carrito o no), los puntos
% alcanzados coloreados según su velocidad, y flechas que muestran la
% dirección de avance (tangente a la trayectoria) en esos puntos. Como
% Velocidad tiene NaN a partir de PuntoDeParada, esos puntos simplemente
% no se pintan -- no se inventa velocidad donde el carrito no llegó.
VelocidadInterior = Velocidad(2:end-1);
% VelocidadInterior: velocidad recortada a los mismos puntos donde hay
% dirección de tangente definida (VersorTangente), para poder graficarlas
% juntas.

figure
plot3(TrayectoriaDePuntos(:,1), TrayectoriaDePuntos(:,2), TrayectoriaDePuntos(:,3), ...
      'Color', [0.6 0.6 0.6], 'LineWidth', 1)
hold on
scatter3(PuntoActual(:,1), PuntoActual(:,2), PuntoActual(:,3), 25, VelocidadInterior, 'filled')
quiver3(PuntoActual(IndicesFlechas,1), PuntoActual(IndicesFlechas,2), PuntoActual(IndicesFlechas,3), ...
        VersorTangente(IndicesFlechas,1), VersorTangente(IndicesFlechas,2), VersorTangente(IndicesFlechas,3), ...
        0.5, 'r', 'LineWidth', 1.2)
hold off
xlabel('x [m]')
ylabel('y [m]')
zlabel('z [m]')
colormap(jet)
BarraColorVelocidad = colorbar;
BarraColorVelocidad.Label.String = 'Velocidad [m/s]';
title('Trayectoria 3D: dirección de avance (flechas) y velocidad (color)')
axis equal
grid on
view(45, 30)

%% Gráfico: fuerza G que sienten los pasajeros (Normal Radio de Giro)
% Signo: como NormalRadioDeGiro y DireccionRadioDeGiro ya están
% normalizados (columnas 1:3 = dirección unitaria), el producto punto
% entre ambas direcciones da +1 si apuntan para el mismo lado (la fuerza
% empuja en el sentido del radio de giro) y -1 si apuntan para el lado
% opuesto. Multiplicando ese signo por la Magnitud se obtiene el valor
% con signo para graficar.
SignoRadioDeGiro = sign(sum(NormalRadioDeGiro(:,1:3) .* DireccionRadioDeGiro(:,1:3), 2));
FuerzaGRadioDeGiro = SignoRadioDeGiro .* NormalRadioDeGiro(:,4);

figure
plot(LongitudRecorridaRadio, FuerzaGRadioDeGiro, 'LineWidth', 2)
yline(0, 'k:')
xlabel('Longitud Recorrida [m]')
ylabel('Aceleración centrípeta con signo [G]')
title('Fuerza G por radio de giro sentida por los pasajeros (+ = sentido del radio de giro)')
grid on

%% Gráfico 3D: G's sobre la vía (Normal Via), con código de color
% Mismo estilo que los gráficos de radio de giro y velocidad: la vía
% completa en gris, los puntos alcanzados coloreados según la magnitud
% de NormalVia (la fuerza G total, en G's, que la vía le tiene que
% ejercer al carrito -- gravedad + centrípeta ya combinadas), y flechas
% que muestran hacia dónde apunta esa fuerza en cada punto.
figure
plot3(TrayectoriaDePuntos(:,1), TrayectoriaDePuntos(:,2), TrayectoriaDePuntos(:,3), ...
      'Color', [0.6 0.6 0.6], 'LineWidth', 1)
hold on
scatter3(PuntoActual(:,1), PuntoActual(:,2), PuntoActual(:,3), 25, NormalVia(:,4), 'filled')
quiver3(PuntoActual(IndicesFlechas,1), PuntoActual(IndicesFlechas,2), PuntoActual(IndicesFlechas,3), ...
        NormalVia(IndicesFlechas,1), NormalVia(IndicesFlechas,2), NormalVia(IndicesFlechas,3), ...
        0.5, 'r', 'LineWidth', 1.2)
hold off
xlabel('x [m]')
ylabel('y [m]')
zlabel('z [m]')
colormap(jet)
BarraColorNormalVia = colorbar;
BarraColorNormalVia.Label.String = 'Fuerza G sobre la vía [G]';
title('Trayectoria 3D: dirección (flechas) y magnitud (color) de las G sobre la vía')
axis equal
grid on
view(45, 30)

%% Limpieza de matrices de cálculo intermedias
% Estas matrices sólo se usaron como pasos intermedios para llegar a los
% resultados finales (TrayectoriaDePuntos, RadioDeGiro,
% DireccionRadioDeGiro, EnergiaPotencial, Velocidad, etc.). Se borran del
% workspace para no dejarlo lleno de variables auxiliares.
clear TFino XFino YFino ZFino TrayectoriaFina DeltaSegmentos LongitudAcumulada ...
      PuntoAnterior PuntoActual PuntoSiguiente LadoA LadoB LadoC AreaTriangulo ...
      PesoAnterior PesoActual PesoSiguiente SumaPesos CentroDeCurvatura ...
      Curvatura IndicesFlechas EnergiaCinetica VectorTangente VectorGravedad ...
      NormalRadioDeGiroBruto DistanciaSegmento NumPuntos FuerzaNormal j k ...
      VelocidadInterior SignoRadioDeGiro AceleracionTangencialEscalar
