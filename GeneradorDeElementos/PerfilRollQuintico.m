function [AnguloRoll, VelocidadRoll, AceleracionRoll] = PerfilRollQuintico(RollInicial, RollFinal, LongitudTransicion, ArcoDentroDeLaTransicion)
%PERFILROLLQUINTICO Smoothstep quintico para la transicion de roll.
%   phi(u) = phi_0 + Dphi*(6u^5 - 15u^4 + 10u^3), con u = s/LongitudTransicion.
%
%   Cumple phi'(0)=phi'(1)=0 y phi''(0)=phi''(1)=0, asi que empalma con C2
%   contra tramos de roll constante a ambos lados. La aceleracion lateral de
%   la heartline depende de phi'' (memoria de calculo, seccion 3.5), de modo
%   que un perfil solo C1 -- la rampa coseno, por ejemplo -- mete un salto de
%   G lateral en los extremos de la transicion.

    DeltaRoll = RollFinal - RollInicial;

    if LongitudTransicion <= 0
        AnguloRoll      = RollFinal;
        VelocidadRoll   = 0;
        AceleracionRoll = 0;
        return
    end

    u = min(max(ArcoDentroDeLaTransicion / LongitudTransicion, 0), 1);

    AnguloRoll      = RollInicial + DeltaRoll * (6*u.^5 - 15*u.^4 + 10*u.^3);
    VelocidadRoll   = DeltaRoll * (30*u.^4 - 60*u.^3 + 30*u.^2) / LongitudTransicion;
    AceleracionRoll = DeltaRoll * (120*u.^3 - 180*u.^2 + 60*u)   / LongitudTransicion^2;
end
