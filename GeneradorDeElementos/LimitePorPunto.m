function Limite = LimitePorPunto(G, Tiempo, Curva, FactorTiempo, Signo)
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
%   Es ademas el mismo barrido de niveles que usa el chequeo de cumplimiento,
%   asi que grafico y verificacion dicen lo mismo.
%
%   Los eventos de menos de 200 ms no estan cubiertos (7.1.4.2); ahi se evalua
%   la curva en 0.2 s, que es su extremo mas permisivo.

    H = Signo * G(:);
    Tiempo = Tiempo(:);
    NumeroDeNodos = numel(H);
    Limite = nan(NumeroDeNodos, 1);

    ValorMaximo = max(H(isfinite(H)));
    if isempty(ValorMaximo) || ValorMaximo <= 0
        return
    end

    NumeroDeNiveles = 40;
    Niveles = linspace(ValorMaximo/NumeroDeNiveles, ValorMaximo, NumeroDeNiveles);

    % Los niveles se recorren de menor a mayor, asi que cada nodo termina con
    % el limite del nivel mas alto que alcanza: el que efectivamente le aplica.
    for Nivel = Niveles
        Tramos = TramosContiguos(H >= Nivel);
        for k = 1:size(Tramos, 1)
            Duracion = max((Tiempo(Tramos(k,2)) - Tiempo(Tramos(k,1))) * FactorTiempo, 0.2);

            % Las tablas de las curvas negativas ya vienen con signo, asi que
            % se toma el modulo y se le pone el signo del lado evaluado.
            Limite(Tramos(k,1):Tramos(k,2)) = Signo * abs(LimiteNormativo(Curva, Duracion));
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
