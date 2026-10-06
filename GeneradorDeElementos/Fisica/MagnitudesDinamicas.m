function Sim = MagnitudesDinamicas(Track, Sim, Parametros)
%MAGNITUDESDINAMICAS Todo lo que sale de la velocidad y el tiempo ya integrados.
%   Recibe un Sim con VelocidadCentroDeMasa, Tiempo, FuerzaRodadura,
%   FuerzaArrastre y PuntoDeParada sobre los nodos del Track, y completa la
%   velocidad del riel, la aceleracion tangencial, las G transportadas a los
%   tres brazos, la fuerza normal, la energia y el jerk.
%
%   Es la segunda mitad de SimularSobreTrack, separada para que el tren
%   (SimularTren, SimDelCarro) calcule cada carro con exactamente las mismas
%   cuentas: un carro del tren es la via del elemento recorrida con otra
%   velocidad y otro reloj.
%
%   La energia disipada se acumula con la fuerza del nodo de PARTIDA de cada
%   paso: en el nodo k vale lo disipado entre el primer nodo y el k (en el
%   primero, 0). Hasta 2026-10 se acumulaba un paso adelantado ([diff; 0]);
%   el total del elemento es el mismo.

    g = Parametros.Gravedad;
    d = Parametros.DistanciaHeartline;
    Arco = Track.LongitudArco;

    CurvaturaArribaCarro = sum(Track.VectorCurvatura .* Track.VersorArribaCarro, 2);
    VelocidadRoll = Track.VelocidadRoll;
    FactorVelocidadHeartline = hypot(1 - d*CurvaturaArribaCarro, d*VelocidadRoll);
    Sim.FactorVelocidadHeartline = FactorVelocidadHeartline;

    % Velocidad del punto del RIEL: la que marca el tiempo y la velocidad
    % angular del marco.
    Sim.Velocidad = Sim.VelocidadCentroDeMasa ./ FactorVelocidadHeartline;
    Velocidad = Sim.Velocidad;

    PasoDesdeElAnterior = [0; diff(Arco)];
    Sim.EnergiaDisipadaRodadura = cumsum([0; Sim.FuerzaRodadura(1:end-1)] .* PasoDesdeElAnterior);
    Sim.EnergiaDisipadaArrastre = cumsum([0; Sim.FuerzaArrastre(1:end-1)] .* PasoDesdeElAnterior);

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
