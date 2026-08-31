function [GArribaRiel, GLateralRiel] = CargasEnLaVia(VersorArribaCarro, VersorLateral, VectorCurvatura, Velocidad, Gravedad)
%CARGASENLAVIA G neta sobre los ejes U y L de un punto sobre el riel.
%   Aceleracion especifica: f = a - g_vec, con a = v^2*VectorCurvatura en el
%   plano normal. Incluye la gravedad, que es exactamente lo que limita la
%   ASTM F2291 7.1.4.5: un cuerpo en reposo sobre via a nivel mide 1 G.
%
%   No dependen de la aceleracion tangencial (es perpendicular a U y a L),
%   asi que se pueden calcular antes que la resistencia al avance y no hay
%   circularidad.

    GArribaRiel  = Velocidad^2 * dot(VectorCurvatura, VersorArribaCarro) / Gravedad + VersorArribaCarro(3);
    GLateralRiel = Velocidad^2 * dot(VectorCurvatura, VersorLateral)     / Gravedad + VersorLateral(3);
end
