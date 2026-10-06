function Valores = EvaluarEnArco(Arco, Datos, Consulta)
%EVALUARENARCO pchip de los datos del tren en los arcos pedidos.
%   griddedInterpolant pchip (el mismo que usa toda la dinamica y que el
%   port reproduce); fuera de [Arco(1), Arco(end)] devuelve NaN. Con un solo
%   nodo, el valor de ese nodo donde coincide.
    Valores = nan(size(Consulta));
    if numel(Arco) < 2
        Valores(abs(Consulta - Arco(1)) < 1e-12) = Datos(1);
        return
    end
    Interpolante = griddedInterpolant(Arco, Datos, 'pchip', 'linear');
    Dentro = Consulta >= Arco(1) - 1e-12 & Consulta <= Arco(end) + 1e-12;
    Valores(Dentro) = Interpolante(Consulta(Dentro));
end
