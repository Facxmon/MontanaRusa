function [DistanciaMinima, IndiceA, IndiceB] = DistanciaMinimaEntrePolilineas(PuntosA, PuntosB, ArcoA, ArcoB, ArcoMinimoExcluido)
%DISTANCIAMINIMAENTREPOLILINEAS Distancia minima segmento a segmento.
%   Punto a punto subestima el acercamiento: dos vias que se cruzan pueden
%   tener todos sus nodos lejos y aun asi tocarse entre nodos. Hay que medir
%   segmento contra segmento.
%
%   ArcoMinimoExcluido sirve para la autointerferencia: ignora los pares de
%   segmentos cuya separacion medida SOBRE la curva sea menor que ese valor,
%   porque esos siempre estan cerca por construccion. Pasar [] para no
%   excluir nada (caso de dos vias distintas).

    if nargin < 5
        ArcoMinimoExcluido = [];
    end

    OrigenA    = PuntosA(1:end-1, :);
    DireccionA = diff(PuntosA, 1, 1);
    OrigenB    = PuntosB(1:end-1, :);
    DireccionB = diff(PuntosB, 1, 1);

    DistanciaMinima = Inf;
    IndiceA = NaN;
    IndiceB = NaN;

    if isempty(OrigenA) || isempty(OrigenB)
        return
    end

    ArcoSegmentoA = (ArcoA(1:end-1) + ArcoA(2:end))/2;
    ArcoSegmentoB = (ArcoB(1:end-1) + ArcoB(2:end))/2;

    for i = 1:size(OrigenA, 1)
        Distancias = DistanciaSegmentoContraSegmentos(OrigenA(i,:), DireccionA(i,:), OrigenB, DireccionB);

        if ~isempty(ArcoMinimoExcluido)
            Distancias(abs(ArcoSegmentoB - ArcoSegmentoA(i)) < ArcoMinimoExcluido) = Inf;
        end

        [Menor, j] = min(Distancias);
        if Menor < DistanciaMinima
            DistanciaMinima = Menor;
            IndiceA = i;
            IndiceB = j;
        end
    end
end

function Distancias = DistanciaSegmentoContraSegmentos(Origen1, Direccion1, Origen2, Direccion2)
%DISTANCIASEGMENTOCONTRASEGMENTOS Un segmento contra muchos, vectorizado.
%   Minimiza |(O1 + s*D1) - (O2 + t*D2)| con s y t en [0,1], resolviendo el
%   interior y despues recortando contra los bordes del cuadrado.

    Diferencia = Origen1 - Origen2;

    a = dot(Direccion1, Direccion1);
    b = Direccion2 * Direccion1.';
    c = Diferencia * Direccion1.';
    e = sum(Direccion2.^2, 2);
    f = sum(Direccion2 .* Diferencia, 2);

    Denominador = a*e - b.^2;

    % Con los segmentos paralelos el denominador se anula: ahi se fija s = 0
    % (cualquier punto del primer segmento sirve) y se recorta despues.
    s = zeros(size(e));
    Regular = Denominador > 1e-18;
    s(Regular) = (b(Regular).*f(Regular) - c(Regular).*e(Regular)) ./ Denominador(Regular);
    s = min(max(s, 0), 1);

    t = zeros(size(e));
    ConLongitud = e > 1e-18;
    t(ConLongitud) = (b(ConLongitud).*s(ConLongitud) + f(ConLongitud)) ./ e(ConLongitud);

    % Recorte contra t = 0 y t = 1, recalculando s sobre ese borde.
    PorDebajo = t < 0;
    t(PorDebajo) = 0;
    PorEncima = t > 1;
    t(PorEncima) = 1;
    if a > 1e-18
        s(PorDebajo) = min(max(-c(PorDebajo)/a, 0), 1);
        s(PorEncima) = min(max((b(PorEncima) - c(PorEncima))/a, 0), 1);
    end

    Vector = Diferencia + s.*Direccion1 - t.*Direccion2;
    Distancias = vecnorm(Vector, 2, 2);
end
