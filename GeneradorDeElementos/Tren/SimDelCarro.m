function Sim = SimDelCarro(Track, Tren, Carro, Parametros)
%SIMDELCARRO Lo que vive el carro Carro del tren al recorrer el elemento Track.
%   Misma forma que el Sim de SimularSobreTrack y sobre los mismos nodos:
%   el nodo k es el carro Carro PARADO en el nodo k. El tren (SimularTren)
%   esta integrado con el arco del primer carro, asi que ese instante es
%   cuando el primero esta Distancia(Carro) mas adelante; de ahi salen la
%   velocidad del riel y el reloj (MarchaEnElTren). La geometria del nodo
%   no cambia: un carro del tren es la misma via recorrida con otra
%   velocidad, y todo lo demas
%   (G, jerk, fuerza normal) lo calcula MagnitudesDinamicas igual que para
%   la particula.
%
%   El tiempo arranca en 0 cuando el carro entra al elemento, como en el
%   contrato. La energia del Sim es la del carro solo; la del tren la pone
%   ConEnergiaDelTren en el Sim que se exporta.

    d = Parametros.DistanciaHeartline;
    [Sim, VelocidadRielCuadrado] = MarchaEnElTren(Track, Tren, Tren.Distancias(Carro), Parametros);

    % Fuerzas de resistencia del carro en cada nodo (para su energia
    % disipada; la dinamica ya las conto en SimularTren). El arrastre del
    % tren se le asigna al primer carro.
    g = Parametros.Gravedad;
    w = max(VelocidadRielCuadrado, 0);
    CurvaturaArribaCarro = sum(Track.VectorCurvatura .* Track.VersorArribaCarro, 2);
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
