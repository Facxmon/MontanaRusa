function Tren = SimularTren(Geo, Parametros, Inicio, ArcoFinal)
%SIMULARTREN Dinamica longitudinal del tren de NumeroDeCarros carros.
%   Los carros van rigidamente unidos a lo largo del riel: el carro i esta
%   Distancia(i) = (i-1)*(LargoCarro + SeparacionEntreCarros) de arco detras
%   del primero, y todos comparten la velocidad del riel v. La masa
%   puntual de SimularSobreTrack es un carro; el tren es la suma:
%
%       E = m * sum_i ( v^2*J_i^2/2 + g*z_cm,i ),      dE/ds = -F_res
%
%   con s el arco del PRIMER carro, J_i el factor de la heartline y z_cm,i
%   la altura del centro de masa del carro i (los dos en s - Distancia(i)).
%   Derivando, con w = v^2:
%
%       dw/ds = -( w*sum(dJ_i^2/ds) + 2*g*sum(dz_cm,i/ds) + 2*F_res/m ) / sum(J_i^2)
%
%   Con un carro es exactamente la ecuacion de la particula
%   (d(v_cm^2)/ds = -2*g*dz_cm/ds - 2*F/m, con v_cm = v*J). La resistencia
%   es la rodadura de cada carro con sus propias cargas (CargasEnLaVia en su
%   posicion) mas el arrastre del tren una sola vez (ResistenciaAlAvance ya
%   lo calcula con el area del tren entero).
%
%   Geo sale de GeometriaDelTren: fuera de la via los carros van en recta
%   (la estacion antes del inicio, la prolongacion despues del final). Es
%   causal: con el primer carro en s, todos los demas estan detras, sobre
%   via que ya existe.
%
%   Inicio: Arco (del primer carro), VelocidadRielCuadrado y Tiempo.
%   ArcoFinal: hasta donde se integra (fin de la via + Distancia del ultimo,
%   para que el ultimo carro termine de recorrerla).
%
%   Se integra con RK4 sobre los nodos de la via (los mismos que usa la
%   particula) y, en la prolongacion, cada PasoSimulacion.

    Distancias = DistanciasDelTren(Parametros);

    EnVia = Geo.Arco(Geo.Arco > Inicio.Arco + 1e-9 & Geo.Arco <= min(ArcoFinal, Geo.Fin));
    Arco = [Inicio.Arco; EnVia];
    if ArcoFinal > Arco(end) + 1e-9
        Paso = Parametros.PasoSimulacion;
        Cantidad = max(1, ceil((ArcoFinal - Arco(end)) / Paso));
        Arco = [Arco; Arco(end) + (ArcoFinal - Arco(end))*(1:Cantidad).'/Cantidad];
    end
    n = numel(Arco);

    Tren.Arco = Arco;
    Tren.Distancias = Distancias;
    Tren.VelocidadRielCuadrado = nan(n, 1);
    Tren.Tiempo         = nan(n, 1);
    Tren.FuerzaRodadura = zeros(n, 1);
    Tren.FuerzaArrastre = zeros(n, 1);
    Tren.EnergiaCinetica  = nan(n, 1);
    Tren.EnergiaPotencial = nan(n, 1);
    Tren.PuntoDeParada = [];

    w = Inicio.VelocidadRielCuadrado;
    t = Inicio.Tiempo;
    for k = 1:n
        if ~(w > 0)
            Tren.PuntoDeParada = k;
            break
        end
        Tren.VelocidadRielCuadrado(k) = w;
        Tren.Tiempo(k) = t;
        [~, Rodadura, Arrastre, Cinetica, Potencial] = DerivadaDelTren(Arco(k), w, Geo, Distancias, Parametros);
        Tren.FuerzaRodadura(k) = Rodadura;
        Tren.FuerzaArrastre(k) = Arrastre;
        Tren.EnergiaCinetica(k)  = Cinetica;
        Tren.EnergiaPotencial(k) = Potencial;
        if k == n
            break
        end

        h = Arco(k+1) - Arco(k);
        k1 = DerivadaDelTren(Arco(k),       w,             Geo, Distancias, Parametros);
        k2 = DerivadaDelTren(Arco(k) + h/2, w + h/2*k1(1), Geo, Distancias, Parametros);
        k3 = DerivadaDelTren(Arco(k) + h/2, w + h/2*k2(1), Geo, Distancias, Parametros);
        k4 = DerivadaDelTren(Arco(k) + h,   w + h*k3(1),   Geo, Distancias, Parametros);
        Incremento = (h/6)*(k1 + 2*k2 + 2*k3 + k4);
        w = w + Incremento(1);
        t = t + Incremento(2);
    end

    % Energia disipada acumulada desde Inicio, con la fuerza del nodo de
    % partida de cada paso (la misma regla que MagnitudesDinamicas).
    Fuerzas = [Tren.FuerzaRodadura, Tren.FuerzaArrastre];
    Disipada = cumsum([0 0; Fuerzas(1:end-1, :) .* diff(Arco)]);
    Tren.EnergiaDisipadaRodadura = Disipada(:,1);
    Tren.EnergiaDisipadaArrastre = Disipada(:,2);
end

function [Derivada, Rodadura, Arrastre, Cinetica, Potencial] = DerivadaDelTren(Arco, w, Geo, Distancias, Parametros)
    g = Parametros.Gravedad;
    d = Parametros.DistanciaHeartline;
    m = Parametros.Masa;
    w = max(w, 0);
    VelocidadRiel = sqrt(w);

    P = EvaluarGeometriaDelTren(Geo, Arco - Distancias);

    % Cargas del centro de masa de cada carro (CargasEnLaVia con brazo d y la
    % a_t aproximada por la componente de la gravedad, como la particula).
    Reduccion = 1 - d*P.CurvaturaArribaCarro;
    GArriba  = w*(P.CurvaturaArribaCarro.*Reduccion - d*P.VelocidadRoll.^2)/g + P.ArribaVertical;
    GLateral = w*P.CurvaturaLateralCarro.*Reduccion/g + P.LateralVertical ...
             + d*((-g*P.TangenteVertical).*P.VelocidadRoll + w*P.AceleracionRoll)/g;
    [~, RodaduraPorCarro, Arrastre] = ResistenciaAlAvance(VelocidadRiel, GArriba, GLateral, Parametros);
    Rodadura = sum(RodaduraPorCarro);

    DerivadaAltura = Reduccion.*P.TangenteVertical + d*P.VelocidadRoll.*P.LateralVertical;
    Derivada = [-(w*sum(P.DerivadaFactorCuadrado) + 2*g*sum(DerivadaAltura) + 2*(Rodadura + Arrastre)/m) / sum(P.FactorCuadrado), ...
                 1/max(VelocidadRiel, 1e-6)];

    Cinetica  = 0.5*m*w*sum(P.FactorCuadrado);
    Potencial = m*g*sum(P.AlturaRiel + d*P.ArribaVertical);
end
