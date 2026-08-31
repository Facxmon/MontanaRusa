function Sim = SimularSobreTrack(Track, EstadoEntrada, Parametros)
%SIMULARSOBRETRACK Estado dinamico del carro sobre una geometria ya congelada.
%   Track es geometria y no cambia; Sim es recalculable. Si cambia la
%   velocidad de lanzamiento, la via ya fabricada sigue siendo la misma: por
%   eso la separacion es un requisito y no una comodidad.
%
%   Integra dv^2/ds = -2*g*Tz - 2*F_resistencia/m con RK4 sobre la polilinea,
%   interpolando linealmente la geometria entre nodos.

    g = Parametros.Gravedad;
    Arco = Track.LongitudArco;
    NumeroDeNodos = numel(Arco);

    % Geometria condensada en los escalares que necesita la dinamica.
    Geometria.Arco             = Arco;
    Geometria.TangenteVertical = Track.VersorTangente(:,3);
    Geometria.ArribaVertical   = Track.VersorArribaCarro(:,3);
    Geometria.LateralVertical  = Track.VersorLateral(:,3);
    Geometria.CurvaturaSobreArriba  = sum(Track.VectorCurvatura .* Track.VersorArribaCarro, 2);
    Geometria.CurvaturaSobreLateral = sum(Track.VectorCurvatura .* Track.VersorLateral,     2);

    Sim.Velocidad       = nan(NumeroDeNodos, 1);
    Sim.Tiempo          = nan(NumeroDeNodos, 1);
    Sim.EnergiaTotal    = nan(NumeroDeNodos, 1);
    Sim.FuerzaRodadura = zeros(NumeroDeNodos, 1);
    Sim.FuerzaArrastre = zeros(NumeroDeNodos, 1);
    Sim.PuntoDeParada   = [];

    VelocidadCuadrado = EstadoEntrada.Velocidad^2;
    Tiempo = 0;

    for k = 1:NumeroDeNodos
        if VelocidadCuadrado <= 0
            Sim.PuntoDeParada = k;
            break
        end
        Sim.Velocidad(k) = sqrt(VelocidadCuadrado);
        Sim.Tiempo(k)    = Tiempo;

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
        Sim.Velocidad(Sim.PuntoDeParada:end) = NaN;
        Sim.Tiempo(Sim.PuntoDeParada:end)    = NaN;
    end

    %% ------------- magnitudes derivadas, ya vectorizadas -----------------
    Velocidad = Sim.Velocidad;
    VelocidadCuadradoNodos = Velocidad.^2;

    FuerzaResistencia = Sim.FuerzaRodadura + Sim.FuerzaArrastre;
    PasoEntreNodos = [diff(Arco); 0];
    Sim.EnergiaDisipadaRodadura = cumsum(Sim.FuerzaRodadura .* PasoEntreNodos);
    Sim.EnergiaDisipadaArrastre = cumsum(Sim.FuerzaArrastre .* PasoEntreNodos);
    Sim.AceleracionTangencial = -g*Geometria.TangenteVertical - FuerzaResistencia/Parametros.Masa;
    Sim.AceleracionTangencial(isnan(Velocidad)) = NaN;

    Sim.GArribaRiel  = VelocidadCuadradoNodos.*Geometria.CurvaturaSobreArriba/g  + Geometria.ArribaVertical;
    Sim.GLateralRiel = VelocidadCuadradoNodos.*Geometria.CurvaturaSobreLateral/g + Geometria.LateralVertical;

    % Aporte de la rotacion de roll sobre la heartline (memoria de calculo,
    % seccion 3.5). Es la razon por la que el perfil de roll tiene que ser C2:
    % la G lateral depende de phi''.
    Distancia = Parametros.DistanciaHeartline;
    AporteLateral  = Distancia*(Sim.AceleracionTangencial.*Track.VelocidadRoll ...
                              + VelocidadCuadradoNodos.*Track.AceleracionRoll) / g;
    AporteVertical = -Distancia*VelocidadCuadradoNodos.*Track.VelocidadRoll.^2 / g;

    Sim.Gx = Sim.AceleracionTangencial/g + Geometria.TangenteVertical;
    Sim.Gy = Sim.GLateralRiel + AporteLateral;
    Sim.Gz = Sim.GArribaRiel  + AporteVertical;

    Sim.FuerzaNormal = Parametros.Masa*g*hypot(Sim.GArribaRiel, Sim.GLateralRiel);

    Sim.EnergiaCinetica  = 0.5*Parametros.Masa*VelocidadCuadradoNodos;
    Sim.EnergiaPotencial = Parametros.Masa*g*Track.Puntos(:,3);
    Sim.EnergiaTotal     = Sim.EnergiaCinetica + Sim.EnergiaPotencial;

    % Jerk por eje, en G/s: dG/dt = (dG/ds)*v.
    Sim.JerkGx = gradient(Sim.Gx, Arco).*Velocidad;
    Sim.JerkGy = gradient(Sim.Gy, Arco).*Velocidad;
    Sim.JerkGz = gradient(Sim.Gz, Arco).*Velocidad;

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
    VelocidadCuadrado = max(VelocidadCuadrado, 0);
    Velocidad = sqrt(VelocidadCuadrado);
    TangenteVertical = interp1(Geometria.Arco, Geometria.TangenteVertical, Arco, 'linear', 'extrap');
    FuerzaResistencia = ResistenciaEnArco(Arco, VelocidadCuadrado, Geometria, Parametros);
    Derivada = [-2*Parametros.Gravedad*TangenteVertical - 2*FuerzaResistencia/Parametros.Masa, ...
                 1/max(Velocidad, 1e-6)];
end

function [FuerzaResistencia, Rodadura, Arrastre] = ResistenciaEnArco(Arco, VelocidadCuadrado, Geometria, Parametros)
    VelocidadCuadrado = max(VelocidadCuadrado, 0);
    Velocidad = sqrt(VelocidadCuadrado);

    ArribaVertical  = interp1(Geometria.Arco, Geometria.ArribaVertical,  Arco, 'linear', 'extrap');
    LateralVertical = interp1(Geometria.Arco, Geometria.LateralVertical, Arco, 'linear', 'extrap');
    CurvaturaArriba = interp1(Geometria.Arco, Geometria.CurvaturaSobreArriba,  Arco, 'linear', 'extrap');
    CurvaturaLateral= interp1(Geometria.Arco, Geometria.CurvaturaSobreLateral, Arco, 'linear', 'extrap');

    GArribaRiel  = VelocidadCuadrado*CurvaturaArriba /Parametros.Gravedad + ArribaVertical;
    GLateralRiel = VelocidadCuadrado*CurvaturaLateral/Parametros.Gravedad + LateralVertical;

    [FuerzaResistencia, Rodadura, Arrastre] = ResistenciaAlAvance(Velocidad, GArribaRiel, GLateralRiel, Parametros);
end
