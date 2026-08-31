%% Análisis de conservación de energía sobre una trayectoria (rough model)
% Modelo preliminar para diseño de montañas rusas.
% Se importa (o, por ahora en debug, se genera) una trayectoria ordenada
% de puntos, se discretiza por longitud de arco, y se analiza la energía
% mecánica a lo largo del recorrido.
%
% ---------------------------------------------------------------------
% BRANCH "correcciones menores" -- cambios respecto de la versión previa:
%   (C1) Resistencia al avance reescrita: rodadura (3 juegos de ruedas)
%        + arrastre aerodinámico, en vez de un único mu de deslizamiento.
%   (C2) Protección contra NaN en todas las normalizaciones de vectores.
%   (C3) Guarda numérica en el radio de giro (triángulos degenerados).
%   (C4) Curvatura de referencia analítica para validar la discreta.
% ---------------------------------------------------------------------

%% ===================== PARÁMETROS DE ENTRADA =========================
DistanciaDeDiscretizacion = 0.05;  % [m] separación entre puntos de análisis
Gravedad = 9.81;                   % [m/s^2]

% --- Resistencia a la rodadura: un coeficiente por juego de ruedas ---
% (C1) Reemplaza al mu = 0.18 anterior, que era un coeficiente de
% DESLIZAMIENTO. El carro va sobre ruedas con rodamientos: el mecanismo
% de pérdida es rodadura + fricción de rodamiento, típicamente un orden
% de magnitud menor. Valores provisorios -- CALIBRAR EXPERIMENTALMENTE.
CoefRodaduraPortantes = 0.030;   % ruedas de carga (road wheels)
CoefRodaduraGuia      = 0.035;   % ruedas laterales (guide wheels)
CoefRodaduraRetencion = 0.035;   % ruedas de retención (up-stop wheels)

% --- Arrastre aerodinámico ---
% (C1) Antes se despreciaba. A la escala del modelo NO es despreciable:
% se vuelve comparable a la rodadura en torno a los 4-5 m/s.
ModelarArrastre   = true;
DensidadAire      = 1.20;    % [kg/m^3] aire a ~20 °C, nivel del mar
CoefArrastre      = 0.90;    % [-] cuerpo romo, provisorio
AreaFrontal       = 0.0036;  % [m^2] 0.06 m x 0.06 m
FactorTren        = 0.25;    % [-] contribución de cada carro detrás del primero

% --- Datos del móvil ---
Masa = 0.15;             % [kg]
VelocidadInicial = 0;    % [m/s]
NumeroDeCarros = 1;

% --- Tolerancias numéricas ---
TolNorma = 1e-12;   % (C2) por debajo de esto, un vector se considera nulo
TolArea  = 1e-14;   % (C3) por debajo de esto, el triángulo es degenerado

%% ===================== TRAYECTORIA (DEBUG) ===========================
% Parametrizada por t: X(t), Y(t), Z(t). Al parametrizar por un t libre
% (en vez de usar x directamente) la curva puede doblar hacia atrás,
% subir y bajar más de una vez para el mismo x, o hacer loops.
TMin = 0;
TMax = 10*pi;
NumPuntosFinos = 20000;   % muestreo fino para estimar bien la longitud de arco

TFino = linspace(TMin, TMax, NumPuntosFinos)';
XFino = sin(TFino);
YFino = 2*cos(TFino);
ZFino = 10 - TFino + 20*cos(TFino/10);
TrayectoriaFina = [XFino, YFino, ZFino];

%% ============ DISCRETIZACIÓN POR LONGITUD DE ARCO ====================
DeltaSegmentos    = vecnorm(diff(TrayectoriaFina), 2, 2);
LongitudAcumulada = [0; cumsum(DeltaSegmentos)];
LongitudTotal     = LongitudAcumulada(end);
LongitudRecorrida = (0:DistanciaDeDiscretizacion:LongitudTotal)';

TrayectoriaDePuntos = interp1(LongitudAcumulada, TrayectoriaFina, LongitudRecorrida, 'linear');
% TrayectoriaDePuntos: matriz n x 3 (x, y, z), un punto cada
% DistanciaDeDiscretizacion metros de recorrido real sobre la curva.

%% ==================== RADIO DE GIRO (CURVATURA) ======================
% Circunferencia que pasa por cada punto interior y sus dos vecinos.
PuntoAnterior  = TrayectoriaDePuntos(1:end-2, :);
PuntoActual    = TrayectoriaDePuntos(2:end-1, :);
PuntoSiguiente = TrayectoriaDePuntos(3:end,   :);

LadoA = vecnorm(PuntoActual    - PuntoAnterior, 2, 2);   % opuesto a PuntoSiguiente
LadoB = vecnorm(PuntoSiguiente - PuntoActual,   2, 2);   % opuesto a PuntoAnterior
LadoC = vecnorm(PuntoSiguiente - PuntoAnterior, 2, 2);   % opuesto a PuntoActual

AreaTriangulo = 0.5*vecnorm(cross(PuntoActual - PuntoAnterior, ...
                                  PuntoSiguiente - PuntoAnterior, 2), 2, 2);

% (C3) Guarda numérica: con paso chico y trayectoria casi recta, el
% triángulo se aplana y AreaTriangulo se calcula restando números casi
% iguales -> se pierden casi todos los dígitos significativos y el radio
% resultante es ruido. Por debajo de TolArea se declara recta (R = Inf)
% en vez de devolver un número inventado.
TrianguloDegenerado = AreaTriangulo < TolArea;
RadioDeGiro = (LadoA .* LadoB .* LadoC) ./ (4*AreaTriangulo);
RadioDeGiro(TrianguloDegenerado) = Inf;
Curvatura = 1 ./ RadioDeGiro;

LongitudRecorridaRadio = LongitudRecorrida(2:end-1);

% Dirección del radio de giro vía circuncentro en coordenadas
% baricéntricas: el peso de cada vértice usa el lado OPUESTO a ese
% vértice. (Esta es la convención correcta; el .md previo la tenía mal
% etiquetada -- el código siempre estuvo bien.)
PesoAnterior  = LadoB.^2 .* (LadoC.^2 + LadoA.^2 - LadoB.^2);
PesoActual    = LadoC.^2 .* (LadoA.^2 + LadoB.^2 - LadoC.^2);
PesoSiguiente = LadoA.^2 .* (LadoB.^2 + LadoC.^2 - LadoA.^2);
SumaPesos     = PesoAnterior + PesoActual + PesoSiguiente;

CentroDeCurvatura = (PesoAnterior.*PuntoAnterior + PesoActual.*PuntoActual ...
                   + PesoSiguiente.*PuntoSiguiente) ./ SumaPesos;

DireccionRadioDeGiro = VersorSeguro(CentroDeCurvatura - PuntoActual, TolNorma);
% (C2) VersorSeguro devuelve [0 0 0] donde el vector es nulo, en vez de
% 0/0 = NaN. En un tramo recto el centro de curvatura está en el
% infinito y esta dirección no está definida.
DireccionRadioDeGiro(TrianguloDegenerado, :) = 0;

%% ================= MARCO LOCAL Y GRAVEDAD PROYECTADA =================
VersorTangente = VersorSeguro(PuntoSiguiente - PuntoActual, TolNorma);

VectorGravedad     = [0, 0, -Gravedad];
GravedadProyectada = VectorGravedad - sum(VectorGravedad.*VersorTangente, 2).*VersorTangente;

%% ============ VELOCIDAD, NORMALES Y ENERGÍA (ITERATIVO) ==============
% La energía en k+1 depende de la resistencia entre k y k+1, que depende
% de la normal en k, que depende de la velocidad en k, que depende de la
% energía en k. Es una cadena: se recorre punto por punto (Euler explícito).

E_0 = 0.5*Masa*VelocidadInicial^2 + Masa*Gravedad*TrayectoriaDePuntos(1,3);
EnergiaPotencial = Masa*Gravedad*TrayectoriaDePuntos(:,3);
EnergiaInicial   = E_0*ones(size(LongitudRecorrida));

DistanciaSegmento = DistanciaDeDiscretizacion;
NumPuntos = size(TrayectoriaDePuntos, 1);

EnergiaTotal        = nan(NumPuntos, 1);
Velocidad           = nan(NumPuntos, 1);
EnergiaCinetica     = nan(NumPuntos, 1);
PerdidaRodadura     = nan(NumPuntos-1, 1);
PerdidaArrastre     = nan(NumPuntos-1, 1);
NormalRadioDeGiro   = nan(NumPuntos-2, 3);
NormalVia           = nan(NumPuntos-2, 3);

% Área frontal efectiva del tren: el primer carro ve el flujo libre, los
% de atrás van en su estela y contribuyen sólo una fracción.
AreaFrontalTren = AreaFrontal * (1 + FactorTren*(NumeroDeCarros - 1));

EnergiaTotal(1) = E_0;
PuntoDeParada = [];

for k = 1:NumPuntos-1
    EnergiaCinetica(k) = EnergiaTotal(k) - EnergiaPotencial(k);
    if EnergiaCinetica(k) < 0
        PuntoDeParada = k;
        break
    end
    Velocidad(k) = sqrt(2*EnergiaCinetica(k)/Masa);

    % --- Arrastre aerodinámico: no depende de la normal, se calcula
    % siempre, incluso en el primer punto donde no hay curvatura. ---
    if ModelarArrastre
        FuerzaArrastre = 0.5*DensidadAire*CoefArrastre*AreaFrontalTren*Velocidad(k)^2;
    else
        FuerzaArrastre = 0;
    end
    PerdidaArrastre(k) = FuerzaArrastre * DistanciaSegmento;

    if k >= 2
        j = k - 1;   % índice en las tablas de puntos interiores

        if isfinite(RadioDeGiro(j))
            AceleracionCentripeta = DireccionRadioDeGiro(j,:) * (Velocidad(k)^2 / RadioDeGiro(j));
        else
            AceleracionCentripeta = [0 0 0];   % (C3) tramo recto
        end
        NormalRadioDeGiro(j,:) = AceleracionCentripeta ...
            - sum(AceleracionCentripeta.*VersorTangente(j,:))*VersorTangente(j,:);

        NormalVia(j,:) = -(GravedadProyectada(j,:) + NormalRadioDeGiro(j,:));
        FuerzaNormal   = Masa * norm(NormalVia(j,:));

        % --- Reparto de la normal entre los tres juegos de ruedas ---
        % PROVISORIO: hasta que exista el modelo de roll phi(s) no se
        % puede saber qué juego toma la carga. Con peralte perfecto
        % (G lateral nula) toda la normal va a las ruedas portantes.
        % Cuando entre el marco del carro, reemplazar por la proyección
        % de NormalVia sobre los ejes U (arriba) y L (lateral).
        CargaPortantes = FuerzaNormal;
        CargaGuia      = 0;
        CargaRetencion = 0;

        FuerzaRodadura = CoefRodaduraPortantes*CargaPortantes ...
                       + CoefRodaduraGuia*CargaGuia ...
                       + CoefRodaduraRetencion*CargaRetencion;

        PerdidaRodadura(k) = FuerzaRodadura * DistanciaSegmento;
    else
        PerdidaRodadura(k) = 0;   % primer punto: sin curvatura definida
    end

    EnergiaTotal(k+1) = EnergiaTotal(k) - PerdidaRodadura(k) - PerdidaArrastre(k);
end

if isempty(PuntoDeParada)
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

EnergiaPerdidaPorFriccion = PerdidaRodadura + PerdidaArrastre;

%% ================= ACELERACIÓN TANGENCIAL ============================
% a_t = (v_{k+1}^2 - v_k^2) / (2*ds). No alimenta ninguna otra cuenta,
% así que se calcula vectorizado con la Velocidad ya completa.
AceleracionTangencialEscalar = (Velocidad(3:end).^2 - Velocidad(2:end-1).^2) / (2*DistanciaSegmento);
AceleracionTangencial = AceleracionTangencialEscalar .* VersorTangente;

%% ============ EXPRESIÓN EN G's Y NOTACIÓN [X Y Z Magnitud] ===========
GravedadProyectada    = GravedadProyectada    / Gravedad;
NormalRadioDeGiro     = NormalRadioDeGiro     / Gravedad;
NormalVia             = NormalVia             / Gravedad;
AceleracionTangencial = AceleracionTangencial / Gravedad;

% (C2) ConVersorYMagnitud usa VersorSeguro: donde el vector es nulo
% devuelve dirección [0 0 0] y magnitud 0, en vez de NaN.
GravedadProyectada    = ConVersorYMagnitud(GravedadProyectada,    TolNorma);
NormalRadioDeGiro     = ConVersorYMagnitud(NormalRadioDeGiro,     TolNorma);
NormalVia             = ConVersorYMagnitud(NormalVia,             TolNorma);
AceleracionTangencial = ConVersorYMagnitud(AceleracionTangencial, TolNorma);
DireccionRadioDeGiro  = ConVersorYMagnitud(DireccionRadioDeGiro,  TolNorma);
VersorTangente        = ConVersorYMagnitud(VersorTangente,        TolNorma);

%% ================== BALANCE ENERGÉTICO (VERIFICACIÓN) ===============
fprintf('\n--- Balance energético ---\n');
fprintf('  Energía inicial            : %8.4f J\n', E_0);
fprintf('  Pérdida por rodadura       : %8.4f J\n', sum(PerdidaRodadura, 'omitnan'));
fprintf('  Pérdida por arrastre       : %8.4f J  (%.1f %% del total)\n', ...
        sum(PerdidaArrastre, 'omitnan'), ...
        100*sum(PerdidaArrastre,'omitnan') / max(sum(EnergiaPerdidaPorFriccion,'omitnan'), eps));
fprintf('  Longitud recorrida         : %8.4f m\n', LongitudTotal);

%% ========================== GRÁFICOS =================================
EspaciadoFlechas = 5;
IndicesFlechas = 1:EspaciadoFlechas:size(PuntoActual,1);

% --- 3D: radio de giro ---
figure
plot3(TrayectoriaDePuntos(:,1), TrayectoriaDePuntos(:,2), TrayectoriaDePuntos(:,3), ...
      'Color', [0.6 0.6 0.6], 'LineWidth', 1)
hold on
scatter3(PuntoActual(:,1), PuntoActual(:,2), PuntoActual(:,3), 25, Curvatura, 'filled')
quiver3(PuntoActual(IndicesFlechas,1), PuntoActual(IndicesFlechas,2), PuntoActual(IndicesFlechas,3), ...
        DireccionRadioDeGiro(IndicesFlechas,1), DireccionRadioDeGiro(IndicesFlechas,2), DireccionRadioDeGiro(IndicesFlechas,3), ...
        0.5, 'r', 'LineWidth', 1.2)
hold off
xlabel('x [m]'); ylabel('y [m]'); zlabel('z [m]')
colormap(jet); BarraColor = colorbar; BarraColor.Label.String = 'Curvatura [1/m]';
title('Trayectoria 3D: dirección (flechas) y magnitud (color) del radio de giro')
axis equal; grid on; view(45, 30)

% --- Energía vs longitud recorrida ---
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
xlabel('Longitud Recorrida [m]'); ylabel('Energía [J]')
legend('Energía Potencial Gravitatoria', 'Energía Inicial (E_0)', 'Energía Total (con pérdidas)', 'Location', 'best')
title('Energía sobre la trayectoria'); grid on

% --- Reparto de pérdidas: rodadura vs arrastre ---
figure
plot(LongitudRecorrida(1:end-1), cumsum(PerdidaRodadura, 'omitnan'), 'LineWidth', 2)
hold on
plot(LongitudRecorrida(1:end-1), cumsum(PerdidaArrastre, 'omitnan'), 'LineWidth', 2)
hold off
xlabel('Longitud Recorrida [m]'); ylabel('Energía disipada acumulada [J]')
legend('Rodadura', 'Arrastre aerodinámico', 'Location', 'best')
title('Reparto de pérdidas por mecanismo'); grid on

% --- 3D: velocidades ---
VelocidadInterior = Velocidad(2:end-1);
figure
plot3(TrayectoriaDePuntos(:,1), TrayectoriaDePuntos(:,2), TrayectoriaDePuntos(:,3), ...
      'Color', [0.6 0.6 0.6], 'LineWidth', 1)
hold on
scatter3(PuntoActual(:,1), PuntoActual(:,2), PuntoActual(:,3), 25, VelocidadInterior, 'filled')
quiver3(PuntoActual(IndicesFlechas,1), PuntoActual(IndicesFlechas,2), PuntoActual(IndicesFlechas,3), ...
        VersorTangente(IndicesFlechas,1), VersorTangente(IndicesFlechas,2), VersorTangente(IndicesFlechas,3), ...
        0.5, 'r', 'LineWidth', 1.2)
hold off
xlabel('x [m]'); ylabel('y [m]'); zlabel('z [m]')
colormap(jet); BarraColorVelocidad = colorbar; BarraColorVelocidad.Label.String = 'Velocidad [m/s]';
title('Trayectoria 3D: dirección de avance (flechas) y velocidad (color)')
axis equal; grid on; view(45, 30)

% --- Fuerza G por radio de giro (con signo) ---
SignoRadioDeGiro   = sign(sum(NormalRadioDeGiro(:,1:3) .* DireccionRadioDeGiro(:,1:3), 2));
FuerzaGRadioDeGiro = SignoRadioDeGiro .* NormalRadioDeGiro(:,4);

figure
plot(LongitudRecorridaRadio, FuerzaGRadioDeGiro, 'LineWidth', 2)
yline(0, 'k:')
xlabel('Longitud Recorrida [m]'); ylabel('Aceleración centrípeta con signo [G]')
title('Fuerza G por radio de giro (+ = sentido del radio de giro)'); grid on

% --- 3D: G's sobre la vía ---
figure
plot3(TrayectoriaDePuntos(:,1), TrayectoriaDePuntos(:,2), TrayectoriaDePuntos(:,3), ...
      'Color', [0.6 0.6 0.6], 'LineWidth', 1)
hold on
scatter3(PuntoActual(:,1), PuntoActual(:,2), PuntoActual(:,3), 25, NormalVia(:,4), 'filled')
quiver3(PuntoActual(IndicesFlechas,1), PuntoActual(IndicesFlechas,2), PuntoActual(IndicesFlechas,3), ...
        NormalVia(IndicesFlechas,1), NormalVia(IndicesFlechas,2), NormalVia(IndicesFlechas,3), ...
        0.5, 'r', 'LineWidth', 1.2)
hold off
xlabel('x [m]'); ylabel('y [m]'); zlabel('z [m]')
colormap(jet); BarraColorNormalVia = colorbar; BarraColorNormalVia.Label.String = 'Fuerza G sobre la vía [G]';
title('Trayectoria 3D: dirección (flechas) y magnitud (color) de las G sobre la vía')
axis equal; grid on; view(45, 30)

%% =================== LIMPIEZA DEL WORKSPACE ==========================
clear TFino XFino YFino ZFino TrayectoriaFina DeltaSegmentos LongitudAcumulada ...
      PuntoAnterior PuntoActual PuntoSiguiente LadoA LadoB LadoC AreaTriangulo ...
      PesoAnterior PesoActual PesoSiguiente SumaPesos CentroDeCurvatura ...
      IndicesFlechas EnergiaCinetica VectorGravedad AceleracionCentripeta ...
      DistanciaSegmento NumPuntos FuerzaNormal FuerzaRodadura FuerzaArrastre ...
      CargaPortantes CargaGuia CargaRetencion j k ...
      VelocidadInterior SignoRadioDeGiro AceleracionTangencialEscalar ...
      TrianguloDegenerado AreaFrontalTren

%% ======================= FUNCIONES LOCALES ===========================
function U = VersorSeguro(V, Tol)
% (C2) Normaliza por filas devolviendo [0 0 0] donde el vector es nulo.
% Dividir un vector nulo por su propia norma da 0/0 = NaN, y el NaN se
% propaga silenciosamente a todo lo que toca.
    N = vecnorm(V, 2, 2);
    U = zeros(size(V));
    Valido = N > Tol;
    U(Valido, :) = V(Valido, :) ./ N(Valido);
end

function M = ConVersorYMagnitud(V, Tol)
% Devuelve [ux uy uz |V|] -- dirección unitaria + módulo, con la misma
% protección contra vectores nulos.
    M = [VersorSeguro(V, Tol), vecnorm(V, 2, 2)];
end
