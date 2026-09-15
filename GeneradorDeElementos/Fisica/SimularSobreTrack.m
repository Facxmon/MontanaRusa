function Sim = SimularSobreTrack(Track, EstadoEntrada, Parametros)
%SIMULARSOBRETRACK Estado dinamico del carro sobre una geometria ya congelada.
%   Track es geometria y no cambia; Sim es recalculable. Si cambia la
%   velocidad de lanzamiento, la via ya fabricada sigue siendo la misma: por
%   eso la separacion es un requisito y no una comodidad.
%
%   La curva del Track es el RIEL y el estado que se integra es la energia
%   del CENTRO DE MASA, que va sobre la heartline (riel + d*U):
%       d(v_cm^2)/ds = -2*g*dz_cm/ds - 2*F_res/m,   v_riel = v_cm/J
%   con J = |d r_heartline/ds| = hypot(1 - d*ku, d*phi'). Es la misma ecuacion
%   que integra DerivadaDeVia al generar, con RK4 sobre la polilinea e
%   interpolando la geometria entre nodos.
%
%   Las G que se reportan salen por transporte de cuerpo rigido desde el
%   punto del riel, con la velocidad angular completa del marco del carro, a
%   tres brazos distintos: d (centro de masa: fuerza normal y ruedas), el de
%   verificacion (donde se aplica la norma) y d + e (cabeza, informativa).

    g = Parametros.Gravedad;
    d = Parametros.DistanciaHeartline;
    Arco = Track.LongitudArco;
    NumeroDeNodos = numel(Arco);

    % Geometria condensada en los escalares que necesita la dinamica. Se
    % interpola con pchip y no lineal: los estadios intermedios de RK4 caen
    % entre nodos y el error de orden ds^2 de la interpolacion lineal se veia
    % directamente en el balance de energia.
    CurvaturaArribaCarro  = sum(Track.VectorCurvatura .* Track.VersorArribaCarro, 2);
    CurvaturaLateralCarro = sum(Track.VectorCurvatura .* Track.VersorLateral,     2);

    Geometria.TangenteVertical      = Interpolante(Arco, Track.VersorTangente(:,3));
    Geometria.ArribaVertical        = Interpolante(Arco, Track.VersorArribaCarro(:,3));
    Geometria.LateralVertical       = Interpolante(Arco, Track.VersorLateral(:,3));
    Geometria.CurvaturaArribaCarro  = Interpolante(Arco, CurvaturaArribaCarro);
    Geometria.CurvaturaLateralCarro = Interpolante(Arco, CurvaturaLateralCarro);
    Geometria.VelocidadRoll         = Interpolante(Arco, Track.VelocidadRoll);
    Geometria.AceleracionRoll       = Interpolante(Arco, Track.AceleracionRoll);

    Sim.VelocidadCentroDeMasa = nan(NumeroDeNodos, 1);
    Sim.Tiempo         = nan(NumeroDeNodos, 1);
    Sim.FuerzaRodadura = zeros(NumeroDeNodos, 1);
    Sim.FuerzaArrastre = zeros(NumeroDeNodos, 1);
    Sim.PuntoDeParada  = [];

    VelocidadCuadrado = EstadoEntrada.Velocidad^2;   % del centro de masa
    Tiempo = 0;

    for k = 1:NumeroDeNodos
        if VelocidadCuadrado <= 0
            Sim.PuntoDeParada = k;
            break
        end
        Sim.VelocidadCentroDeMasa(k) = sqrt(VelocidadCuadrado);
        Sim.Tiempo(k) = Tiempo;

        [~, Rodadura, Arrastre] = ResistenciaEnArco(Arco(k), VelocidadCuadrado, Geometria, Parametros);
        Sim.FuerzaRodadura(k) = Rodadura;
        Sim.FuerzaArrastre(k) = Arrastre;

        if k == NumeroDeNodos
            break
        end

        Paso = Arco(k+1) - Arco(k);
        [VelocidadCuadrado, Tiempo] = PasoDeEnergia(Arco(k), VelocidadCuadrado, Tiempo, Paso, Geometria, Parametros);
    end

    if ~isempty(Sim.PuntoDeParada)
        Sim.VelocidadCentroDeMasa(Sim.PuntoDeParada:end) = NaN;
        Sim.Tiempo(Sim.PuntoDeParada:end) = NaN;
    end

    %% ------------- magnitudes derivadas, ya vectorizadas -----------------
    VelocidadRoll = Track.VelocidadRoll;
    FactorVelocidadHeartline = hypot(1 - d*CurvaturaArribaCarro, d*VelocidadRoll);
    Sim.FactorVelocidadHeartline = FactorVelocidadHeartline;

    % Velocidad del punto del RIEL: la que marca el tiempo y la velocidad
    % angular del marco.
    Sim.Velocidad = Sim.VelocidadCentroDeMasa ./ FactorVelocidadHeartline;
    Velocidad = Sim.Velocidad;
    VelocidadCuadradoNodos = Velocidad.^2;

    FuerzaResistencia = Sim.FuerzaRodadura + Sim.FuerzaArrastre;
    PasoEntreNodos = [diff(Arco); 0];
    Sim.EnergiaDisipadaRodadura = cumsum(Sim.FuerzaRodadura .* PasoEntreNodos);
    Sim.EnergiaDisipadaArrastre = cumsum(Sim.FuerzaArrastre .* PasoEntreNodos);

    % dv_cm/dt del centro de masa: es lo que se grafica como aceleracion
    % tangencial. La del punto del riel, dv/dt, es otra (el riel recorre un
    % arco distinto) y entra solo en el transporte de cuerpo rigido.
    Sim.AceleracionTangencial = DerivadaPorArco(Sim.VelocidadCentroDeMasa, Arco) .* Velocidad;
    AceleracionTangencialRiel = DerivadaPorArco(Velocidad, Arco) .* Velocidad;

    % Transporte de cuerpo rigido a los tres brazos. El centro de masa da la
    % fuerza normal; el brazo de verificacion, la G que se compara contra la
    % norma; la cabeza es informativa (Rohde 2024, 7.6.2: el disenador debe
    % incluir las rotaciones aunque la norma no mida ahi).
    BrazoVerificacion = BrazoDeVerificacion(Parametros);
    BrazoCabeza = d + Parametros.DistanciaHeartlineACabeza;

    [~, Sim.GLateralHeartline, Sim.GArribaHeartline] = GTransportada(Track, Sim, AceleracionTangencialRiel, d, Parametros);
    [Sim.Gx, Sim.Gy, Sim.Gz] = GTransportada(Track, Sim, AceleracionTangencialRiel, BrazoVerificacion, Parametros);
    [Sim.GxCabeza, Sim.GyCabeza, Sim.GzCabeza] = GTransportada(Track, Sim, AceleracionTangencialRiel, BrazoCabeza, Parametros);
    Sim.BrazoDeVerificacion = BrazoVerificacion;

    % Masa puntual con el centro de masa en la heartline: la fuerza que el
    % riel le hace al carro vale m*(a_cm - g_vec).
    Sim.FuerzaNormal = Parametros.Masa*g*hypot(Sim.GArribaHeartline, Sim.GLateralHeartline);

    Sim.EnergiaCinetica  = 0.5*Parametros.Masa*Sim.VelocidadCentroDeMasa.^2;
    Sim.EnergiaPotencial = Parametros.Masa*g*Track.PuntosHeartline(:,3);
    Sim.EnergiaTotal     = Sim.EnergiaCinetica + Sim.EnergiaPotencial;

    % Jerk por eje, en G/s: dG/dt = (dG/ds)*v, con v la del riel (ds es arco
    % del riel).
    Jerk = DerivadaPorArco([Sim.Gx, Sim.Gy, Sim.Gz], Arco) .* Velocidad;
    Sim.JerkGx = Jerk(:,1);
    Sim.JerkGy = Jerk(:,2);
    Sim.JerkGz = Jerk(:,3);

    Sim.VelocidadDeDiseno = Track.VelocidadDeDiseno;
    Sim.AvisoVelocidadDeDiseno = '';
    if abs(EstadoEntrada.Velocidad - Track.VelocidadDeDiseno) > Parametros.ToleranciaVelocidadDeDiseno
        Sim.AvisoVelocidadDeDiseno = sprintf( ...
            ['La velocidad de entrada (%.3f m/s) difiere de la de diseno (%.3f m/s) en mas de ' ...
             '%.3f m/s. La geometria no cambia, pero conviene regenerar el elemento.'], ...
            EstadoEntrada.Velocidad, Track.VelocidadDeDiseno, Parametros.ToleranciaVelocidadDeDiseno);
    end
end

%% ========================= auxiliares =====================================
function [Gx, Gy, Gz] = GTransportada(Track, Sim, AceleracionTangencialRiel, Brazo, Parametros)
%GTRANSPORTADA G en un punto a distancia Brazo del riel, sobre U.
%   Transporte de cuerpo rigido desde el punto del riel, que es la curva
%   integrada y el eje de roll:
%
%       a_P = a_riel + dw/dt x r + w x (w x r),      r = Brazo*U
%
%   La velocidad angular del marco del carro tiene DOS aportes y no uno:
%
%       w = v * ( T x kappa_vec  +  phi' * T )
%           \_______________/     \_________/
%            giro del marco de      roll
%            transporte, que da
%            vueltas con la via
%
%   Quedarse solo con el termino de roll pierde los terminos cruzados entre
%   curvatura y roll, que dominan justo donde la via curva y rola a la vez,
%   que es todo el interes de un over-banked turn o un dive loop.
%
%   Con Brazo = 0 esto se reduce exactamente a la G del punto del riel, y con
%   Brazo = d a las componentes que CargasEnLaVia calcula en forma cerrada
%   (salvo la aproximacion de a_t en el termino de Euler, que aca es
%   numerica). El test 10 verifica las dos cosas.

    g = Parametros.Gravedad;
    Arco = Track.LongitudArco;
    T = Track.VersorTangente;
    U = Track.VersorArribaCarro;
    L = Track.VersorLateral;

    VelocidadCuadrado = Sim.Velocidad.^2;

    % Aceleracion del punto del riel: tangencial mas centripeta.
    Aceleracion = AceleracionTangencialRiel.*T + VelocidadCuadrado.*Track.VectorCurvatura;

    if Brazo ~= 0
        OmegaPorArco = cross(T, Track.VectorCurvatura, 2) + Track.VelocidadRoll.*T;
        Omega        = Sim.Velocidad .* OmegaPorArco;

        % dw/dt = v * dw/ds. La derivada se toma sobre la polilinea ya
        % construida porque phi'' del tramo helicoidal depende de dkappa/ds,
        % que no esta disponible dentro del paso de integracion.
        DerivadaOmega = Sim.Velocidad .* DerivadaPorArco(Omega, Arco);

        r = Brazo * U;
        Aceleracion = Aceleracion ...
                    + cross(DerivadaOmega, r, 2) ...
                    + cross(Omega, cross(Omega, r, 2), 2);
    end

    % Fuerza especifica f = a - g_vec, con g_vec = -g*zhat. Es lo que mide un
    % acelerometro solidario al carro: en reposo sobre via a nivel da 1 G,
    % que es como la ASTM 7.1.4.5 define la magnitud que limita.
    Fuerza = Aceleracion;
    Fuerza(:,3) = Fuerza(:,3) + g;

    Gx = sum(Fuerza.*T, 2) / g;
    Gy = sum(Fuerza.*L, 2) / g;
    Gz = sum(Fuerza.*U, 2) / g;

    % Donde la marcha se quedo sin energia no hay estado dinamico que reportar.
    SinVelocidad = isnan(Sim.Velocidad);
    Gx(SinVelocidad) = NaN;
    Gy(SinVelocidad) = NaN;
    Gz(SinVelocidad) = NaN;
end

function [VelocidadCuadrado, Tiempo] = PasoDeEnergia(Arco, VelocidadCuadrado, Tiempo, Paso, Geometria, Parametros)
    k1 = DerivadaDeEnergia(Arco,          VelocidadCuadrado,               Geometria, Parametros);
    k2 = DerivadaDeEnergia(Arco + Paso/2, VelocidadCuadrado + Paso/2*k1(1), Geometria, Parametros);
    k3 = DerivadaDeEnergia(Arco + Paso/2, VelocidadCuadrado + Paso/2*k2(1), Geometria, Parametros);
    k4 = DerivadaDeEnergia(Arco + Paso,   VelocidadCuadrado + Paso*k3(1),   Geometria, Parametros);

    Incremento = (Paso/6)*(k1 + 2*k2 + 2*k3 + k4);
    VelocidadCuadrado = VelocidadCuadrado + Incremento(1);
    Tiempo            = Tiempo + Incremento(2);
end

function Derivada = DerivadaDeEnergia(Arco, VelocidadCuadrado, Geometria, Parametros)
%DERIVADADEENERGIA La misma ecuacion que DerivadaDeVia, sobre la geometria
%   interpolada: energia del centro de masa y tiempo del punto del riel.
    d = Parametros.DistanciaHeartline;
    VelocidadCuadrado = max(VelocidadCuadrado, 0);
    VelocidadCentroDeMasa = sqrt(VelocidadCuadrado);

    [FuerzaResistencia, ~, ~, FactorVelocidadHeartline] = ResistenciaEnArco(Arco, VelocidadCuadrado, Geometria, Parametros);

    DerivadaAlturaCentroDeMasa = (1 - d*Geometria.CurvaturaArribaCarro(Arco))*Geometria.TangenteVertical(Arco) ...
                               + d*Geometria.VelocidadRoll(Arco)*Geometria.LateralVertical(Arco);
    Derivada = [-2*Parametros.Gravedad*DerivadaAlturaCentroDeMasa - 2*FuerzaResistencia/Parametros.Masa, ...
                 FactorVelocidadHeartline/max(VelocidadCentroDeMasa, 1e-6)];
end

function [FuerzaResistencia, Rodadura, Arrastre, FactorVelocidadHeartline] = ResistenciaEnArco(Arco, VelocidadCuadrado, Geometria, Parametros)
    g = Parametros.Gravedad;
    d = Parametros.DistanciaHeartline;
    VelocidadCuadrado = max(VelocidadCuadrado, 0);

    CurvaturaArribaCarro  = Geometria.CurvaturaArribaCarro(Arco);
    CurvaturaLateralCarro = Geometria.CurvaturaLateralCarro(Arco);
    VelocidadRoll   = Geometria.VelocidadRoll(Arco);
    AceleracionRoll = Geometria.AceleracionRoll(Arco);
    TangenteVertical = Geometria.TangenteVertical(Arco);

    FactorVelocidadHeartline = hypot(1 - d*CurvaturaArribaCarro, d*VelocidadRoll);
    VelocidadRiel = sqrt(VelocidadCuadrado) / FactorVelocidadHeartline;

    [GArribaHeartline, GLateralHeartline] = CargasEnLaVia( ...
        CurvaturaArribaCarro, CurvaturaLateralCarro, VelocidadRiel, ...
        VelocidadRoll, AceleracionRoll, -g*TangenteVertical, ...
        Geometria.ArribaVertical(Arco), Geometria.LateralVertical(Arco), d, g);

    [FuerzaResistencia, Rodadura, Arrastre] = ResistenciaAlAvance(VelocidadRiel, GArribaHeartline, GLateralHeartline, Parametros);
end

function Objeto = Interpolante(Arco, Valores)
%INTERPOLANTE Interpolante pchip precompilado. Se evalua decenas de miles de
%   veces dentro de RK4, asi que rehacer el ajuste en cada llamada -- que es
%   lo que hace interp1 -- seria carisimo. Se filtran los nodos demasiado
%   juntos, que aparecen cuando un sub-tramo termina con un paso acortado.
    Conservar = [true; diff(Arco(:)) > 1e-9];
    Objeto = griddedInterpolant(Arco(Conservar), Valores(Conservar), 'pchip', 'linear');
end
