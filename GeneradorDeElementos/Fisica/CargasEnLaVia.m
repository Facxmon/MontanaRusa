function [GArriba, GLateral] = CargasEnLaVia(CurvaturaArribaCarro, CurvaturaLateralCarro, VelocidadRiel, ...
                                             VelocidadRoll, AceleracionRoll, AceleracionTangencial, ...
                                             ArribaVertical, LateralVertical, Brazo, Gravedad)
%CARGASENLAVIA G neta sobre los ejes U y L en un punto a distancia Brazo del riel.
%   Aceleracion especifica f = a - g_vec, con la gravedad incluida: es
%   exactamente lo que limita la ASTM F2291 7.1.4.5 (un cuerpo en reposo
%   sobre via a nivel mide 1 G).
%
%   La curva integrada es el RIEL, que es el eje de roll. El pasajero va a
%   distancia Brazo sobre U y su aceleracion sale por transporte de cuerpo
%   rigido desde el punto del riel, con la velocidad angular completa del
%   marco del carro, w = v*(T x kappa_vec + phi'*T). Escrito en componentes
%   del carro (ku = kappa_vec.U, kl = kappa_vec.L, phi' por unidad de arco):
%
%       Gz = v^2*ku*(1 - Brazo*ku)/g + Uz - v^2*Brazo*phi'^2/g
%       Gy = v^2*kl*(1 - Brazo*ku)/g + Lz + Brazo*(a_t*phi' + v^2*phi'')/g
%
%   El factor (1 - Brazo*ku) es el pasajero recorriendo un radio distinto al
%   del riel: a R = 0.11 m y Brazo = 0.03 m son 27 %. El termino en phi'^2 es
%   la centripeta de girar alrededor del riel, y el de (a_t*phi' + v^2*phi'')
%   es el de Euler: la G lateral que produce una transicion de roll. Ninguno
%   de los dos necesita dkappa/ds, asi que la formula es cerrada y sirve
%   dentro del paso de integracion. La componente longitudinal si necesita
%   dkappa/ds y se calcula aparte, sobre la polilinea ya construida.
%
%   Con Brazo = DistanciaHeartline son las cargas del centro de masa: lo que
%   alimenta la fuerza normal y el reparto entre juegos de ruedas. Derivacion
%   completa en memoria_de_calculo.md, seccion 3.
%
%   No dependen de dkappa/ds ni (salvo el termino chico de Euler) de la
%   resistencia al avance, asi que se pueden calcular antes que ella y no hay
%   circularidad.

    Reduccion = 1 - Brazo*CurvaturaArribaCarro;
    GArriba  = VelocidadRiel^2*(CurvaturaArribaCarro*Reduccion - Brazo*VelocidadRoll^2)/Gravedad ...
             + ArribaVertical;
    GLateral = VelocidadRiel^2*CurvaturaLateralCarro*Reduccion/Gravedad + LateralVertical ...
             + Brazo*(AceleracionTangencial*VelocidadRoll + VelocidadRiel^2*AceleracionRoll)/Gravedad;
end
