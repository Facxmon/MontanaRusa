function [T, U, L] = Ortonormalizar(T, U)
%ORTONORMALIZAR Gram-Schmidt sobre el marco, con L = T x U.
%   La integracion numerica hace derivar la ortonormalidad del marco por
%   acumulacion de error de punto flotante. Reproyectar cada tantos pasos
%   la mantiene acotada.

    T = T / norm(T);
    U = U - dot(U, T)*T;
    U = U / norm(U);
    L = cross(T, U);
end
