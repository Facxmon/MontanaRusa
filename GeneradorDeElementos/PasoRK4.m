function [EstadoSiguiente, Punto] = PasoRK4(Arco, y, Paso, Contexto)
%PASORK4 Un paso de Runge-Kutta 4 sobre el sistema completo via + energia.
%   Con Euler el error de cada paso cae siempre para el mismo lado y despues
%   de miles de pasos el loop no cierra: sale una espiral. RK4 lleva el error
%   por paso de orden ds^2 a orden ds^5.

    [k1, Punto] = DerivadaDeVia(Arco,          y,                 Contexto);
     k2         = DerivadaDeVia(Arco + Paso/2, y + (Paso/2)*k1,   Contexto);
     k3         = DerivadaDeVia(Arco + Paso/2, y + (Paso/2)*k2,   Contexto);
     k4         = DerivadaDeVia(Arco + Paso,   y + Paso*k3,       Contexto);

    EstadoSiguiente = y + (Paso/6)*(k1 + 2*k2 + 2*k3 + k4);
end
