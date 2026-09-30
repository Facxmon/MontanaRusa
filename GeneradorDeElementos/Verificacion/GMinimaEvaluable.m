function G = GMinimaEvaluable()
%GMINIMAEVALUABLE Umbral de |G| por debajo del cual no se evaluan limites.
%   0.01 G. Es un valor elegido para el proyecto, NO de la norma: separa el
%   ruido numerico (Gy de 1e-13 G en un elemento plano, Gx de milesimas en
%   una transicion) de una aceleracion con sentido fisico. Todas las curvas
%   de las Figs. 6-10 arrancan en 1.1 G o mas, asi que ningun veredicto real
%   depende de este numero.
%
%   Donde se usa:
%     - VerificarLimitesNormativos: si el maximo del lado evaluado es menor,
%       no hay evento critico; y la grilla de niveles arranca en
%       max(GMinimaEvaluable, maximo/N).
%     - LimitePorPunto: lo mismo para la linea que se grafica.
%     - Los eventos de 7.1.6 (reversiones) y de 7.1.7.1 (-Gz sostenido) son
%       intervalos con |G| >= GMinimaEvaluable.
%   Es una constante, no un parametro de usuario. El espejo en TypeScript es
%   G_MIN_EVALUABLE (web/src/nucleo/norma.ts), y tienen que coincidir.

    G = 0.01;   % [G]
end
