function Gz = EvaluarObjetivoNormativo(Objetivo, Tiempo)
%EVALUAROBJETIVONORMATIVO Gz objetivo del arco en instantes del modelo.
%   Evalua la cubica de Hermite por intervalo (pchip) que
%   ObjetivoNormativoPorNiveles dejo sobre su tabla uniforme: el indice sale
%   de una division, sin interp1, porque se llama en cada etapa del RK4 del
%   arco. Cubica y no lineal para que la pendiente del objetivo sea
%   continua: el modo la convierte en dkappa/ds, y una pendiente escalonada
%   es un peine en el jerk lateral del roll helicoidal. Fuera de la tabla se
%   extiende constante por los dos lados: antes del primer instante es el
%   nivel maximo (la meseta), despues del ultimo es el piso de la curva.

    NumeroDeNodos = numel(Objetivo.Tiempo);
    Posicion = (Tiempo(:) - Objetivo.Tiempo(1)) / Objetivo.Paso;
    Posicion = min(max(Posicion, 0), NumeroDeNodos - 1);
    Indice   = min(floor(Posicion) + 1, NumeroDeNodos - 1);
    Local    = (Posicion - (Indice - 1)) * Objetivo.Paso;
    C  = Objetivo.Coeficientes(Indice, :);
    Gz = ((C(:,1).*Local + C(:,2)).*Local + C(:,3)).*Local + C(:,4);
    Gz = reshape(Gz, size(Tiempo));
end
