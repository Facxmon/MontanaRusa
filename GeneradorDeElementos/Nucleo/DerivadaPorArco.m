function Derivada = DerivadaPorArco(Matriz, Arco)
%DERIVADAPORARCO Derivada columna por columna respecto del arco.
%   Robusta a nodos repetidos: un sub-tramo que termina con un paso acortado
%   deja dos nodos al mismo arco, y ahi gradient divide por cero. Se deriva
%   solo sobre los nodos distintos y se interpola el resultado de vuelta a la
%   grilla completa.
%
%   Va columna por columna a proposito: sobre una matriz, gradient deriva en
%   las dos direcciones y devuelve primero la del eje equivocado.

    Arco = Arco(:);
    Conservar = [true; diff(Arco) > 1e-9];
    ArcoUtil  = Arco(Conservar);

    Derivada = nan(size(Matriz));
    if numel(ArcoUtil) < 2
        return
    end

    for j = 1:size(Matriz, 2)
        DerivadaUtil  = gradient(Matriz(Conservar, j), ArcoUtil);
        Derivada(:,j) = interp1(ArcoUtil, DerivadaUtil, Arco, 'linear', 'extrap');
    end
end
