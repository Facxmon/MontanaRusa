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
    % G, jerk, energia: lo mismo que se le calcula a cada carro del tren.
    Sim = MagnitudesDinamicas(Track, Sim, Parametros);

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
