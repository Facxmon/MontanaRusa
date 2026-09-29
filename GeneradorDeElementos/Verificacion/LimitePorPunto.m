function Limite = LimitePorPunto(G, Tiempo, Curva, FactorTiempo, Signo, NumeroDeNiveles, Reducida)
%LIMITEPORPUNTO Limite normativo aplicable en cada punto del recorrido.
%   Para cada nodo se mide la duracion del evento sostenido que lo contiene a
%   su propio nivel de G, se convierte a duracion equivalente del prototipo
%   multiplicando por sqrt(lambda), y se evalua la curva limite ahi. Es la
%   aplicacion literal del criterio de la norma, punto por punto, y sirve para
%   superponer la banda sobre el grafico de G.
%
%   El nivel se cuantiza en una grilla fija en vez de usar el valor exacto de
%   cada nodo. Sobre una meseta de G casi constante, dos nodos que difieren en
%   una milesima pueden dar duraciones muy distintas -- uno abarca la meseta
%   entera y el otro se corta en el primer nodo que baja -- y el limite sale
%   picado sin que eso signifique nada fisico. Con la grilla, todos los nodos
%   de una meseta caen en el mismo nivel y el limite queda escalonado limpio.
%
%   DE DONDE SALE LA ESCALERA. La tabla de LimiteNormativo se interpola
%   LINEALMENTE en la duracion, asi que la curva de la norma es continua. Lo
%   que escalona el limite es esta cuantizacion de niveles: todos los nodos
%   de un mismo nivel comparten un evento sostenido, y por lo tanto una
%   duracion y un limite; al pasar al nivel siguiente la duracion salta y
%   con ella el limite. Con pocos niveles la escalera es grosera y parece
%   un error de interpolacion; no lo es.
%
%   NumeroDeNiveles es opcional. El valor por defecto, 40, es el que usa la
%   verificacion y preserva su comportamiento. Para graficar se puede pedir
%   una grilla mas fina (GraficarElemento usa 400): la escalera se vuelve
%   casi continua sin cambiar el criterio, porque el chequeo de cumplimiento
%   no pasa por aca (VerificarLimitesNormativos barre sus propios niveles).
%
%   Los eventos de menos de 200 ms no estan cubiertos (7.1.4.2); ahi se evalua
%   la curva en 0.2 s, que es su extremo mas permisivo. Es el mismo criterio
%   que usa la verificacion (VerificarLimitesNormativos), asi que un nodo
%   queda por encima de esta linea si y solo si su evento no cumple.
%
%   Por debajo de GMinimaEvaluable no hay limite: si el maximo del lado
%   evaluado no llega al umbral todo queda en NaN, y la grilla de niveles
%   arranca en max(GMinimaEvaluable, maximo/NumeroDeNiveles). Sin esto, una
%   Gy de 1e-13 G (ruido) dibujaba un limite en peine.
%
%   Para la linea de tiempo de todo el layout se pasa el tiempo del
%   prototipo acumulado con FactorTiempo = 1. Reducida (opcional, solo +Gz)
%   marca los nodos de las ventanas de 7.1.7.1 (VentanasMasGzReducido): ahi
%   rige MasGzReducido y despues la curva normal, con la duracion acumulada
%   del evento (LimitesDelEvento).

    if nargin < 6 || isempty(NumeroDeNiveles)
        NumeroDeNiveles = 40;
    end
    if nargin < 7
        Reducida = [];
    end

    H = Signo * G(:);
    Tiempo = Tiempo(:);
    NumeroDeNodos = numel(H);
    Limite = nan(NumeroDeNodos, 1);

    ValorMaximo = max(H(isfinite(H)));
    Umbral = GMinimaEvaluable();
    if isempty(ValorMaximo) || ValorMaximo < Umbral
        return
    end

    Niveles = linspace(max(Umbral, ValorMaximo/NumeroDeNiveles), ValorMaximo, NumeroDeNiveles);

    % Los niveles se recorren de menor a mayor, asi que cada nodo termina con
    % el limite del nivel mas alto que alcanza: el que efectivamente le aplica.
    for Nivel = Niveles
        Tramos = TramosContiguos(H >= Nivel);
        for k = 1:size(Tramos, 1)
            % Un limite por tramo de regimen de 7.1.7.1, con la duracion
            % acumulada desde el inicio del evento (LimitesDelEvento). Las
            % tablas de las curvas negativas vienen con signo: LimitesDelEvento
            % devuelve el modulo y aca se le pone el signo del lado evaluado.
            [Limites, ~, ~, Segmentos] = LimitesDelEvento(Tiempo * FactorTiempo, Tramos(k,1), Tramos(k,2), Curva, Reducida);
            for j = 1:numel(Limites)
                Limite(Segmentos(j,1):Segmentos(j,2)) = Signo * Limites(j);
            end
        end
    end
end

function Tramos = TramosContiguos(Mascara)
%TRAMOSCONTIGUOS Indices de inicio y fin de cada corrida de true.
    Mascara = Mascara(:).';
    Mascara(isnan(Mascara)) = false;
    Bordes  = diff([false, Mascara, false]);
    Inicios = find(Bordes == 1);
    Finales = find(Bordes == -1) - 1;
    Tramos  = [Inicios(:), Finales(:)];
end
