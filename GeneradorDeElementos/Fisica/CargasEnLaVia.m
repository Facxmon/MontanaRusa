function [GArribaHeartline, GLateralHeartline] = CargasEnLaVia(VersorArribaCarro, VersorLateral, VectorCurvatura, Velocidad, Gravedad)
%CARGASENLAVIA G neta sobre los ejes U y L, evaluada en el heartline.
%   Aceleracion especifica: f = a - g_vec, con a = v^2*VectorCurvatura en el
%   plano normal. Incluye la gravedad, que es exactamente lo que limita la
%   ASTM F2291 7.1.4.5: un cuerpo en reposo sobre via a nivel mide 1 G.
%
%   La curva que integra el generador es el HEARTLINE, asi que esta es
%   directamente la G que siente el pasajero: no lleva ninguna correccion de
%   offset. El heartline es ademas el eje de roll, de modo que el pasajero
%   esta sobre el eje de rotacion y el roll no le aporta aceleracion.
%
%   El riel va desplazado -d*U respecto de esta curva, pero ese offset es
%   puramente geometrico: no cambia ninguna fuerza. El carro se modela como
%   masa puntual y la fuerza que el riel le hace vale m*(a_cm - g_vec), o sea
%   que la fija la aceleracion del centro de masa -- que aca se asume en el
%   heartline -- y no la del punto geometrico del riel. Por eso estas mismas
%   dos componentes son las que alimentan el reparto entre juegos de ruedas.
%
%   No dependen de la aceleracion tangencial (es perpendicular a U y a L),
%   asi que se pueden calcular antes que la resistencia al avance y no hay
%   circularidad.

    GArribaHeartline  = Velocidad^2 * dot(VectorCurvatura, VersorArribaCarro) / Gravedad + VersorArribaCarro(3);
    GLateralHeartline = Velocidad^2 * dot(VectorCurvatura, VersorLateral)     / Gravedad + VersorLateral(3);
end
