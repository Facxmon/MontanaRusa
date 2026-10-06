function P = EvaluarGeometriaDelTren(Geo, Arco)
%EVALUARGEOMETRIADELTREN Escalares de la via en los arcos pedidos (vector).
%   Dentro de la via, los interpolantes de GeometriaDelTren. Antes del inicio
%   y despues del final, la recta por la tangente del extremo: la altura del
%   riel cambia con la pendiente de esa tangente, el marco del carro queda
%   fijo y la curvatura y el roll son nulos (J = 1).

    Arco = Arco(:);
    Antes   = Arco < Geo.Inicio;
    Despues = Arco > Geo.Fin;
    Dentro  = ~Antes & ~Despues;

    n = numel(Arco);
    P.TangenteVertical      = zeros(n, 1);
    P.ArribaVertical        = zeros(n, 1);
    P.LateralVertical       = zeros(n, 1);
    P.CurvaturaArribaCarro  = zeros(n, 1);
    P.CurvaturaLateralCarro = zeros(n, 1);
    P.VelocidadRoll         = zeros(n, 1);
    P.AceleracionRoll       = zeros(n, 1);
    P.AlturaRiel            = zeros(n, 1);
    P.FactorCuadrado        = ones(n, 1);
    P.DerivadaFactorCuadrado = zeros(n, 1);

    if any(Dentro)
        s = Arco(Dentro);
        P.TangenteVertical(Dentro)      = Geo.TangenteVertical(s);
        P.ArribaVertical(Dentro)        = Geo.ArribaVertical(s);
        P.LateralVertical(Dentro)       = Geo.LateralVertical(s);
        P.CurvaturaArribaCarro(Dentro)  = Geo.CurvaturaArribaCarro(s);
        P.CurvaturaLateralCarro(Dentro) = Geo.CurvaturaLateralCarro(s);
        P.VelocidadRoll(Dentro)         = Geo.VelocidadRoll(s);
        P.AceleracionRoll(Dentro)       = Geo.AceleracionRoll(s);
        P.AlturaRiel(Dentro)            = Geo.AlturaRiel(s);
        P.FactorCuadrado(Dentro)        = Geo.FactorCuadrado(s);
        P.DerivadaFactorCuadrado(Dentro) = Geo.DerivadaFactorCuadrado(s);
    end
    P = Recta(P, Antes,   Arco, Geo.Inicio, Geo.Antes);
    P = Recta(P, Despues, Arco, Geo.Fin,    Geo.Despues);
end

function P = Recta(P, Mascara, Arco, Borde, Extremo)
    if ~any(Mascara)
        return
    end
    P.TangenteVertical(Mascara) = Extremo.TangenteVertical;
    P.ArribaVertical(Mascara)   = Extremo.ArribaVertical;
    P.LateralVertical(Mascara)  = Extremo.LateralVertical;
    P.AlturaRiel(Mascara)       = Extremo.AlturaRiel + Extremo.TangenteVertical*(Arco(Mascara) - Borde);
end
