function Versor = VersorSeguro(Vector, Tolerancia)
%VERSORSEGURO Normaliza por filas devolviendo [0 0 0] donde el vector es nulo.
%   Dividir un vector nulo por su propia norma da 0/0 = NaN, y el NaN se
%   propaga en silencio a todo lo que toca.

    if nargin < 2
        Tolerancia = 1e-12;
    end

    Norma  = vecnorm(Vector, 2, 2);
    Versor = zeros(size(Vector));
    Valido = Norma > Tolerancia;
    Versor(Valido, :) = Vector(Valido, :) ./ Norma(Valido);
end
