function [Sim, VelocidadRielCuadrado] = MarchaEnElTren(Track, Tren, Desfase, Parametros)
%MARCHAENELTREN Velocidad y reloj de un punto del tren sobre los nodos de Track.
%   El punto va Desfase de arco detras del primer carro: el nodo k es ese
%   punto PARADO en el nodo k, cuando el primero esta Desfase mas adelante.
%   El tren (SimularTren) esta integrado con el arco del primer carro; de
%   ahi salen la velocidad del riel, comun a todo el tren, y el reloj.
%
%   Un carro es Desfase = Tren.Distancias(Carro) (SimDelCarro); la manta de
%   aceleraciones usa cualquier punto del tren (MantaDeAceleraciones).
%
%   Devuelve en Sim VelocidadCentroDeMasa, Tiempo (desde 0 en el primer
%   nodo con estado) y PuntoDeParada, y aparte la velocidad del riel al
%   cuadrado, NaN donde el tren ya se paro o todavia no habia arrancado.

    d = Parametros.DistanciaHeartline;
    Arco = Track.LongitudArco;
    ArcoDelPrimero = Arco + Desfase;

    Valido = ~isnan(Tren.VelocidadRielCuadrado);
    Conservar = Valido & [true; diff(Tren.Arco) > 1e-9];
    ArcoTren = Tren.Arco(Conservar);
    Hasta = ArcoTren(end);
    VelocidadRielCuadrado = EvaluarEnArco(ArcoTren, Tren.VelocidadRielCuadrado(Conservar), ArcoDelPrimero);
    Tiempo                = EvaluarEnArco(ArcoTren, Tren.Tiempo(Conservar),                ArcoDelPrimero);
    % Mas alla del ultimo nodo con velocidad el tren se paro (o no se
    % integro): no hay estado que reportar.
    Fuera = ArcoDelPrimero > Hasta + 1e-12 | ArcoDelPrimero < ArcoTren(1) - 1e-12;
    VelocidadRielCuadrado(Fuera) = NaN;
    Tiempo(Fuera) = NaN;

    CurvaturaArribaCarro = sum(Track.VectorCurvatura .* Track.VersorArribaCarro, 2);
    Factor = hypot(1 - d*CurvaturaArribaCarro, d*Track.VelocidadRoll);

    Sim.VelocidadCentroDeMasa = sqrt(max(VelocidadRielCuadrado, 0)) .* Factor;
    Sim.VelocidadCentroDeMasa(isnan(VelocidadRielCuadrado)) = NaN;

    % Un punto por delante del primer carro (Desfase < 0, el frente del tren
    % en la manta) pasa por los primeros nodos de la via antes de que el tren
    % arranque: esos nodos quedan NaN y no son una parada. Un carro
    % (Desfase >= 0) arranca siempre en el primer nodo.
    Arranque = find(~isnan(Sim.VelocidadCentroDeMasa), 1);
    if isempty(Arranque)
        Arranque = 1;
    end
    Sim.Tiempo = Tiempo - Tiempo(Arranque);
    Sim.PuntoDeParada = Arranque - 1 + find(isnan(Sim.VelocidadCentroDeMasa(Arranque:end)), 1);
    if ~isempty(Sim.PuntoDeParada)
        Sim.VelocidadCentroDeMasa(Sim.PuntoDeParada:end) = NaN;
        Sim.Tiempo(Sim.PuntoDeParada:end) = NaN;
    end
end
