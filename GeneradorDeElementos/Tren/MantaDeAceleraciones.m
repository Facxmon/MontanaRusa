function Manta = MantaDeAceleraciones(Layout, CantidadDePuntos)
%MANTADEACELERACIONES G en cada punto del tren a lo largo de toda la via.
%   La superficie G(X, y):
%       X  arco de la via (el global del riel, Track.LongitudArco);
%       y  posicion en el tren respecto del centro del tren, positiva hacia
%          adelante: el paragolpe delantero esta en +LargoTren/2 y el
%          trasero en -LargoTren/2.
%
%   Modelo de tren continuo: cada punto del tren va sobre el riel, a y de
%   arco del centro, y todo el tren comparte la velocidad del riel. Cuando
%   el punto y pasa por X, el centro del tren esta en X - y: la G del punto
%   es la de la geometria en X recorrida con la velocidad que tiene el tren
%   en ese instante. Es el mismo calculo completo de MagnitudesDinamicas
%   (curvatura, roll, velocidad angular del marco, transporte al brazo de
%   verificacion, gravedad), no solo v^2/R; lo unico que cambia con y es la
%   velocidad.
%
%   En el centro de cada carro la manta es exactamente la linea de ese
%   carro (SimDelCarro). Con un carro, la columna y = 0 es la particula.
%
%   El tren se simula aca de nuevo (SimularTren) y no se toma Layout.Tren:
%   con un carro no existe, y la cola necesita LargoCarro/2 mas de
%   prolongacion recta que el centro del ultimo carro para terminar de
%   salir. La velocidad es la del tren entero, no la de una particula
%   suelta: con varios carros difieren porque la energia esta repartida.
%
%   Quedan en NaN los puntos sin estado: el frente del tren pasa por los
%   primeros nodos antes de t = 0 (el tren arranca con el centro del primer
%   carro en el inicio de la via) y, si el tren se para, todo lo que sigue.
%
%   CantidadDePuntos (41 por defecto) es la grilla uniforme en y; se le
%   agregan el centro del tren y el centro de cada carro, para que esas
%   columnas sean exactas.
%
%   Manta.Carros trae aparte, para dibujarlas encima, las G que el layout
%   ya tenia calculadas para cada carro (SimCarros, o el Sim de la particula
%   con un carro): no salen de la manta.

    if nargin < 2
        CantidadDePuntos = 41;
    end
    if isempty(Layout.Elementos)
        error('MantaDeAceleraciones:LayoutVacio', 'El layout no tiene elementos.');
    end

    Parametros = Layout.Elementos{1}.Elemento.Parametros;
    Distancias = DistanciasDelTren(Parametros);
    DistanciaExtremos = Distancias(end);   % del centro del primer carro al del ultimo
    Largo = Parametros.LargoCarro;
    MitadDelTren = DistanciaExtremos/2 + Largo/2;

    Tracks = cellfun(@(R) R.Elemento.Track, Layout.Elementos, 'UniformOutput', false);
    Geo = GeometriaDelTren(Tracks, Parametros);
    Inicio = InicioDelTren(Layout.Elementos{1}.Elemento.EstadoEntrada, Tracks{1}, Parametros);
    Tren = SimularTren(Geo, Parametros, Inicio, Geo.Fin + DistanciaExtremos + Largo/2);

    % Grilla en y: la uniforme mas las columnas exactas (centro del tren y de
    % cada carro), sin columnas casi repetidas.
    PosicionDeCarros = DistanciaExtremos/2 - Distancias.';
    Exactas = uniquetol([PosicionDeCarros, 0], 1e-12, 'DataScale', 1);
    Grilla = linspace(-MitadDelTren, MitadDelTren, CantidadDePuntos);
    Lejos = min(abs(Grilla - Exactas.'), [], 1) > 1e-9;
    Posicion = sort([Grilla(Lejos), Exactas]);

    % Nodos de la via sin repetir el de cada empalme (como GeometriaDelTren).
    NumeroDeElementos = numel(Tracks);
    Desde = 1 + ((1:NumeroDeElementos) > 1);
    Cantidades = cellfun(@(T) numel(T.LongitudArco), Tracks) - Desde + 1;
    Fin = cumsum(Cantidades);
    Comienzo = Fin - Cantidades + 1;
    Arco = zeros(Fin(end), 1);
    for e = 1:NumeroDeElementos
        Arco(Comienzo(e):Fin(e)) = Tracks{e}.LongitudArco(Desde(e):end);
    end

    Forma = [numel(Arco), numel(Posicion)];
    Manta.Gx = nan(Forma);
    Manta.Gy = nan(Forma);
    Manta.Gz = nan(Forma);
    Manta.Velocidad = nan(Forma);   % del riel, la de todo el tren cuando el punto y pasa por X
    for j = 1:numel(Posicion)
        % Cuanto arco va el primer carro por delante del punto y.
        Desfase = DistanciaExtremos/2 - Posicion(j);
        for e = 1:NumeroDeElementos
            ParametrosDelElemento = Layout.Elementos{e}.Elemento.Parametros;
            Sim = MarchaEnElTren(Tracks{e}, Tren, Desfase, ParametrosDelElemento);
            % Las fuerzas solo entran en la energia disipada, no en las G.
            Sim.FuerzaRodadura = zeros(size(Sim.VelocidadCentroDeMasa));
            Sim.FuerzaArrastre = zeros(size(Sim.VelocidadCentroDeMasa));
            Sim = MagnitudesDinamicas(Tracks{e}, Sim, ParametrosDelElemento);

            Filas = Comienzo(e):Fin(e);
            Manta.Gx(Filas, j) = Sim.Gx(Desde(e):end);
            Manta.Gy(Filas, j) = Sim.Gy(Desde(e):end);
            Manta.Gz(Filas, j) = Sim.Gz(Desde(e):end);
            Manta.Velocidad(Filas, j) = Sim.Velocidad(Desde(e):end);
        end
    end
    Manta.GModulo = sqrt(Manta.Gx.^2 + Manta.Gy.^2 + Manta.Gz.^2);

    Manta.Arco = Arco;
    Manta.Posicion = Posicion;
    Manta.PosicionDeCarros = PosicionDeCarros;
    [~, Manta.ColumnaDeCarros] = min(abs(Posicion - PosicionDeCarros.'), [], 2);
    Manta.ColumnaDeCarros = Manta.ColumnaDeCarros.';
    [~, Manta.ColumnaDelCentro] = min(abs(Posicion));
    Manta.LargoTren = 2*MitadDelTren;
    Manta.Brazo = BrazoDeVerificacion(Parametros);
    Manta.FilasDeEmpalmes = Comienzo(2:end);
    Manta.Empalmes = Arco(Manta.FilasDeEmpalmes);
    Manta.NombresDeElementos = cellfun(@(R) R.Elemento.Nombre, Layout.Elementos, 'UniformOutput', false);
    Manta.Carros = CarrosDelLayout(Layout, Desde, Comienzo, Fin, PosicionDeCarros);
end

%% ========================= auxiliares =====================================
function Carros = CarrosDelLayout(Layout, Desde, Comienzo, Fin, PosicionDeCarros)
%CARROSDELLAYOUT Las G que el layout ya tiene calculadas para cada carro.
%   No se recalculan: son las de la verificacion del layout, sobre los mismos
%   nodos que la manta, para dibujarlas encima y ver que la manta pasa por
%   ellas. Con varios carros, Elemento.SimCarros{i} (VerificarTrenDelLayout);
%   con uno, el Sim del elemento, que es el de la particula. Solo los carros
%   calculados (CalcularTodosLosCarros).
    Elementos = Layout.Elementos;
    if isempty(Elementos{1}.Elemento.SimCarros)
        Carros.Fuente = 'Sim de la particula';
        Carros.Numero = 1;
        SimDe = @(e, i) Elementos{e}.Elemento.Sim;
    else
        Carros.Fuente = 'SimCarros';
        Carros.Numero = find(~cellfun(@isempty, Elementos{1}.Elemento.SimCarros));
        SimDe = @(e, i) Elementos{e}.Elemento.SimCarros{i};
    end
    Carros.Posicion = PosicionDeCarros(Carros.Numero);

    Forma = [Fin(end), numel(Carros.Numero)];
    Carros.Gx = nan(Forma);
    Carros.Gy = nan(Forma);
    Carros.Gz = nan(Forma);
    for k = 1:numel(Carros.Numero)
        for e = 1:numel(Elementos)
            Sim = SimDe(e, Carros.Numero(k));
            Filas = Comienzo(e):Fin(e);
            Carros.Gx(Filas, k) = Sim.Gx(Desde(e):end);
            Carros.Gy(Filas, k) = Sim.Gy(Desde(e):end);
            Carros.Gz(Filas, k) = Sim.Gz(Desde(e):end);
        end
    end
    Carros.GModulo = sqrt(Carros.Gx.^2 + Carros.Gy.^2 + Carros.Gz.^2);
end
