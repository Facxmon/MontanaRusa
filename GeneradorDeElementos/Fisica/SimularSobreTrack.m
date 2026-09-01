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

    % Geometria condensada en los escalares que necesita la dinamica. Se
    % interpola con pchip y no lineal: los estadios intermedios de RK4 caen
    % entre nodos y el error de orden ds^2 de la interpolacion lineal se veia
    % directamente en el balance de energia.
    CurvaturaSobreArriba  = sum(Track.VectorCurvatura .* Track.VersorArribaCarro, 2);
    CurvaturaSobreLateral = sum(Track.VectorCurvatura .* Track.VersorLateral,     2);

    Geometria.Arco = Arco;
    Geometria.TangenteVertical = Interpolante(Arco, Track.VersorTangente(:,3));
    Geometria.ArribaVertical   = Interpolante(Arco, Track.VersorArribaCarro(:,3));
    Geometria.LateralVertical  = Interpolante(Arco, Track.VersorLateral(:,3));
    Geometria.CurvaturaSobreArriba  = Interpolante(Arco, CurvaturaSobreArriba);
    Geometria.CurvaturaSobreLateral = Interpolante(Arco, CurvaturaSobreLateral);

    GeometriaNodos.TangenteVertical = Track.VersorTangente(:,3);
    GeometriaNodos.CurvaturaSobreArriba  = CurvaturaSobreArriba;
    GeometriaNodos.CurvaturaSobreLateral = CurvaturaSobreLateral;
    GeometriaNodos.ArribaVertical  = Track.VersorArribaCarro(:,3);
    GeometriaNodos.LateralVertical = Track.VersorLateral(:,3);

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
    Sim.AceleracionTangencial = -g*GeometriaNodos.TangenteVertical - FuerzaResistencia/Parametros.Masa;
    Sim.AceleracionTangencial(isnan(Velocidad)) = NaN;

    Sim.GArribaHeartline  = VelocidadCuadradoNodos.*GeometriaNodos.CurvaturaSobreArriba/g  + GeometriaNodos.ArribaVertical;
    Sim.GLateralHeartline = VelocidadCuadradoNodos.*GeometriaNodos.CurvaturaSobreLateral/g + GeometriaNodos.LateralVertical;

    % G reportadas: transporte de cuerpo rigido desde el heartline hasta el
    % punto donde se evalua al pasajero. NO son las del heartline pelado.
    %
    % El heartline es el eje de roll, asi que un punto matematico ahi no
    % recibe aporte de la rotacion. Pero el pasajero no es un punto: cabeza y
    % hombros quedan fuera del eje y si sienten la rotacion. Por eso la G que
    % se verifica contra la norma se evalua desplazada e*U del eje.
    [Sim.Gx, Sim.Gy, Sim.Gz] = GEnPuntoDeEvaluacion(Track, Sim, Parametros);

    % Masa puntual con el centro de masa en el heartline: la fuerza que el
    % riel le hace al carro vale m*(a_cm - g_vec).
    Sim.FuerzaNormal = Parametros.Masa*g*hypot(Sim.GArribaHeartline, Sim.GLateralHeartline);

    Sim.EnergiaCinetica  = 0.5*Parametros.Masa*VelocidadCuadradoNodos;
    Sim.EnergiaPotencial = Parametros.Masa*g*Track.PuntosHeartline(:,3);
    Sim.EnergiaTotal     = Sim.EnergiaCinetica + Sim.EnergiaPotencial;

    % Jerk por eje, en G/s: dG/dt = (dG/ds)*v.
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
function [Gx, Gy, Gz] = GEnPuntoDeEvaluacion(Track, Sim, Parametros)
%GENPUNTODEEVALUACION G sentida en el punto donde se evalua al pasajero.
%   Transporte de cuerpo rigido desde el heartline, que es a la vez la curva
%   integrada, el eje de roll y el centro de masa supuesto:
%
%       a_e = a_h + dw/dt x r + w x (w x r),      r = e*U
%
%   La velocidad angular del marco del carro tiene DOS aportes y no uno:
%
%       w = v * ( T x kappa_vec  +  phi' * T )
%           \_______________/     \_________/
%            giro del marco de      roll
%            transporte, que da
%            vueltas con la via
%
%   El primero es el que la version anterior no tenia. Solo se sumaba el
%   termino de roll e*(a_t*phi' + v^2*phi'')/g, y por eso el aporte de
%   rotacion quedaba incompleto justo donde la via curva y rola a la vez, que
%   es todo el interes de un over-banked turn o un dive loop.
%
%   Con e = 0 esto se reduce exactamente a GArribaHeartline / GLateralHeartline
%   / Gx del heartline, y el test 10 lo verifica.
%
%   Que e NO sea DistanciaHeartline es deliberado: DistanciaHeartline mide del
%   riel al heartline (geometria de la via) y e mide del heartline al cuerpo
%   del pasajero (donde se evalua el confort). Son dos cosas distintas que
%   antes estaban colapsadas en un solo numero.

    g = Parametros.Gravedad;
    Arco = Track.LongitudArco;
    T = Track.VersorTangente;
    U = Track.VersorArribaCarro;
    L = Track.VersorLateral;

    VelocidadCuadrado = Sim.Velocidad.^2;

    % Aceleracion del heartline: tangencial mas centripeta.
    Aceleracion = Sim.AceleracionTangencial.*T + VelocidadCuadrado.*Track.VectorCurvatura;

    Offset = Parametros.DistanciaEvaluacionPasajero;
    if Offset ~= 0
        OmegaPorArco = cross(T, Track.VectorCurvatura, 2) + Track.VelocidadRoll.*T;
        Omega        = Sim.Velocidad .* OmegaPorArco;

        % dw/dt = v * dw/ds. La derivada se toma sobre la polilinea ya
        % construida porque phi'' del tramo helicoidal depende de dkappa/ds,
        % que no esta disponible dentro del paso de integracion.
        DerivadaOmega = Sim.Velocidad .* DerivadaPorArco(Omega, Arco);

        Brazo = Offset * U;
        Aceleracion = Aceleracion ...
                    + cross(DerivadaOmega, Brazo, 2) ...
                    + cross(Omega, cross(Omega, Brazo, 2), 2);
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
    VelocidadCuadrado = max(VelocidadCuadrado, 0);
    Velocidad = sqrt(VelocidadCuadrado);
    FuerzaResistencia = ResistenciaEnArco(Arco, VelocidadCuadrado, Geometria, Parametros);
    Derivada = [-2*Parametros.Gravedad*Geometria.TangenteVertical(Arco) - 2*FuerzaResistencia/Parametros.Masa, ...
                 1/max(Velocidad, 1e-6)];
end

function [FuerzaResistencia, Rodadura, Arrastre] = ResistenciaEnArco(Arco, VelocidadCuadrado, Geometria, Parametros)
    VelocidadCuadrado = max(VelocidadCuadrado, 0);
    Velocidad = sqrt(VelocidadCuadrado);

    GArribaHeartline  = VelocidadCuadrado*Geometria.CurvaturaSobreArriba(Arco) /Parametros.Gravedad ...
                      + Geometria.ArribaVertical(Arco);
    GLateralHeartline = VelocidadCuadrado*Geometria.CurvaturaSobreLateral(Arco)/Parametros.Gravedad ...
                      + Geometria.LateralVertical(Arco);

    [FuerzaResistencia, Rodadura, Arrastre] = ResistenciaAlAvance(Velocidad, GArribaHeartline, GLateralHeartline, Parametros);
end

function Objeto = Interpolante(Arco, Valores)
%INTERPOLANTE Interpolante pchip precompilado. Se evalua decenas de miles de
%   veces dentro de RK4, asi que rehacer el ajuste en cada llamada -- que es
%   lo que hace interp1 -- seria carisimo. Se filtran los nodos demasiado
%   juntos, que aparecen cuando un sub-tramo termina con un paso acortado.
    Conservar = [true; diff(Arco(:)) > 1e-9];
    Objeto = griddedInterpolant(Arco(Conservar), Valores(Conservar), 'pchip', 'linear');
end
