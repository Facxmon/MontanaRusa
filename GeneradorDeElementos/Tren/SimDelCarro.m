function Sim = SimDelCarro(Track, Tren, Carro, Parametros)
%SIMDELCARRO Lo que vive el carro Carro del tren al recorrer el elemento Track.
%   Misma forma que el Sim de SimularSobreTrack y sobre los mismos nodos:
%   el nodo k es el carro Carro PARADO en el nodo k. El tren (SimularTren)
%   esta integrado con el arco del primer carro, asi que ese instante es
%   cuando el primero esta Distancia(Carro) mas adelante; de ahi salen la
%   velocidad del riel y el reloj. La geometria del nodo no cambia: un carro
%   del tren es la misma via recorrida con otra velocidad, y todo lo demas
%   (G, jerk, fuerza normal) lo calcula MagnitudesDinamicas igual que para
%   la particula.
%
%   El tiempo arranca en 0 cuando el carro entra al elemento, como en el
%   contrato. La energia del Sim es la del carro solo; la del tren la pone
%   ConEnergiaDelTren en el Sim que se exporta.

    d = Parametros.DistanciaHeartline;
    Arco = Track.LongitudArco;
    ArcoDelPrimero = Arco + Tren.Distancias(Carro);

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
    Sim.Tiempo = Tiempo - Tiempo(1);
    Sim.PuntoDeParada = find(isnan(Sim.VelocidadCentroDeMasa), 1);
    if ~isempty(Sim.PuntoDeParada)
        Sim.VelocidadCentroDeMasa(Sim.PuntoDeParada:end) = NaN;
        Sim.Tiempo(Sim.PuntoDeParada:end) = NaN;
    end

    % Fuerzas de resistencia del carro en cada nodo (para su energia
    % disipada; la dinamica ya las conto en SimularTren). El arrastre del
    % tren se le asigna al primer carro.
    g = Parametros.Gravedad;
    w = max(VelocidadRielCuadrado, 0);
    Reduccion = 1 - d*CurvaturaArribaCarro;
    CurvaturaLateralCarro = sum(Track.VectorCurvatura .* Track.VersorLateral, 2);
    GArriba  = w.*(CurvaturaArribaCarro.*Reduccion - d*Track.VelocidadRoll.^2)/g + Track.VersorArribaCarro(:,3);
    GLateral = w.*CurvaturaLateralCarro.*Reduccion/g + Track.VersorLateral(:,3) ...
             + d*((-g*Track.VersorTangente(:,3)).*Track.VelocidadRoll + w.*Track.AceleracionRoll)/g;
    Peso = Parametros.Masa * g;
    Sim.FuerzaRodadura = Parametros.CrrPortantes*max(GArriba, 0)*Peso ...
                       + Parametros.CrrRetencion*max(-GArriba, 0)*Peso ...
                       + Parametros.CrrGuia*abs(GLateral)*Peso;
    if Carro == 1 && Parametros.ModelarArrastre
        AreaEfectiva = Parametros.AreaFrontal * (1 + Parametros.FactorTren*(Parametros.NumeroDeCarros - 1));
        Sim.FuerzaArrastre = 0.5 * Parametros.RhoAire * Parametros.CoefArrastre * AreaEfectiva * w;
    else
        Sim.FuerzaArrastre = zeros(size(w));
    end
    SinDato = isnan(Sim.VelocidadCentroDeMasa);
    Sim.FuerzaRodadura(SinDato) = 0;
    Sim.FuerzaArrastre(SinDato) = 0;

    Sim = MagnitudesDinamicas(Track, Sim, Parametros);
    Sim.VelocidadDeDiseno = Track.VelocidadDeDiseno;
    Sim.AvisoVelocidadDeDiseno = '';
    Sim.Carro = Carro;
end
