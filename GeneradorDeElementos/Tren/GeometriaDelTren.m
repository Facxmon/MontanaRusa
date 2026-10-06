function Geo = GeometriaDelTren(Tracks, Parametros)
%GEOMETRIADELTREN La via por la que anda el tren, condensada para la dinamica.
%   Tracks es un cell con los Track de los elementos, en orden y con el arco
%   del riel global y continuo (cada elemento arranca donde termina el
%   anterior). Se concatenan sin repetir el nodo de cada empalme y se arman
%   los interpolantes pchip de los escalares que necesita la ecuacion del
%   tren, los mismos que usa SimularSobreTrack para la particula.
%
%   Fuera de la via el tren sigue en linea recta por la tangente del
%   extremo, con el marco del carro de ese extremo: antes del inicio es la
%   estacion (los carros de atras arrancan ahi) y despues del final es la
%   prolongacion que deja salir al ultimo carro. En las dos la curvatura y el
%   roll son nulos. EvaluarGeometriaDelTren resuelve los dos casos.

    d = Parametros.DistanciaHeartline;

    Arco = zeros(0, 1);
    Columnas = zeros(0, 8);
    for i = 1:numel(Tracks)
        Track = Tracks{i};
        Desde = 1 + (i > 1);
        CurvaturaArribaCarro  = sum(Track.VectorCurvatura .* Track.VersorArribaCarro, 2);
        CurvaturaLateralCarro = sum(Track.VectorCurvatura .* Track.VersorLateral, 2);
        Nuevas = [Track.VersorTangente(:,3), Track.VersorArribaCarro(:,3), Track.VersorLateral(:,3), ...
                  CurvaturaArribaCarro, CurvaturaLateralCarro, Track.VelocidadRoll, Track.AceleracionRoll, ...
                  Track.PuntosRiel(:,3)];
        Arco = [Arco; Track.LongitudArco(Desde:end)]; %#ok<AGROW>
        Columnas = [Columnas; Nuevas(Desde:end, :)]; %#ok<AGROW>
    end

    % Factor de la heartline al cuadrado, J^2 = (1 - d*ku)^2 + (d*phi')^2, y su
    % derivada: la energia cinetica de cada carro es m*v_riel^2*J^2/2.
    FactorCuadrado = (1 - d*Columnas(:,4)).^2 + (d*Columnas(:,6)).^2;
    DerivadaFactorCuadrado = DerivadaPorArco(FactorCuadrado, Arco);

    Conservar = [true; diff(Arco) > 1e-9];
    Crear = @(Valores) griddedInterpolant(Arco(Conservar), Valores(Conservar), 'pchip', 'linear');
    Geo.TangenteVertical      = Crear(Columnas(:,1));
    Geo.ArribaVertical        = Crear(Columnas(:,2));
    Geo.LateralVertical       = Crear(Columnas(:,3));
    Geo.CurvaturaArribaCarro  = Crear(Columnas(:,4));
    Geo.CurvaturaLateralCarro = Crear(Columnas(:,5));
    Geo.VelocidadRoll         = Crear(Columnas(:,6));
    Geo.AceleracionRoll       = Crear(Columnas(:,7));
    Geo.AlturaRiel            = Crear(Columnas(:,8));
    Geo.FactorCuadrado        = Crear(FactorCuadrado);
    Geo.DerivadaFactorCuadrado = Crear(DerivadaFactorCuadrado);

    Geo.Arco   = Arco(Conservar);
    Geo.Inicio = Arco(1);
    Geo.Fin    = Arco(end);
    Geo.Antes   = Extremo(Columnas(1, :));
    Geo.Despues = Extremo(Columnas(end, :));
end

function E = Extremo(Fila)
    E.TangenteVertical = Fila(1);
    E.ArribaVertical   = Fila(2);
    E.LateralVertical  = Fila(3);
    E.AlturaRiel       = Fila(8);
end
