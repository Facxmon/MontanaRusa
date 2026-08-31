function [Derivada, Punto] = DerivadaDeVia(Arco, y, Contexto)
%DERIVADADEVIA Ecuaciones de la via y de la energia, acopladas.
%
%   Vector de estado y (1x15):
%       1:3    Posicion
%       4:6    VersorTangente
%       7:9    VersorArribaTransporte
%      10:12   VersorLateralTransporte
%      13      Velocidad^2
%      14      angulo girado por la tangente (para cerrar el loop)
%      15      tiempo transcurrido
%
%   Marco de transporte paralelo (Bishop), con la curvatura expresada por sus
%   componentes sobre ese marco:
%       dT/ds    =  kU*Upt + kL*Lpt
%       dUpt/ds  = -kU*T
%       dLpt/ds  = -kL*T
%   Por construccion no tiene rotacion alrededor de T, asi que queda definido
%   donde la curvatura es nula y no salta en las inflexiones. Frenet falla en
%   las dos cosas.

    Parametros = Contexto.Parametros;

    Punto = PuntoCinematico(Arco, y, Contexto);

    [CurvaturaArriba, CurvaturaLateral] = Contexto.FuncionCurvatura(Punto);
    VectorCurvatura = CurvaturaArriba*Punto.VersorArribaTransporte ...
                    + CurvaturaLateral*Punto.VersorLateralTransporte;

    [GArribaRiel, GLateralRiel] = CargasEnLaVia(Punto.VersorArribaCarro, Punto.VersorLateral, ...
                                                VectorCurvatura, Punto.Velocidad, Parametros.Gravedad);
    [FuerzaResistencia, Rodadura, Arrastre] = ResistenciaAlAvance(Punto.Velocidad, ...
                                                GArribaRiel, GLateralRiel, Parametros);

    AceleracionTangencial = -Parametros.Gravedad*Punto.VersorTangente(3) - FuerzaResistencia/Parametros.Masa;

    Punto.CurvaturaArriba       = CurvaturaArriba;
    Punto.CurvaturaLateral      = CurvaturaLateral;
    Punto.VectorCurvatura       = VectorCurvatura;
    Punto.Curvatura             = hypot(CurvaturaArriba, CurvaturaLateral);
    Punto.VelocidadRoll         = Punto.VelocidadRoll + Contexto.InclinacionHelicoidal*Punto.Curvatura;
    Punto.GArribaRiel           = GArribaRiel;
    Punto.GLateralRiel          = GLateralRiel;
    Punto.AceleracionTangencial = AceleracionTangencial;
    Punto.PerdidaRodadura       = Rodadura;
    Punto.PerdidaArrastre       = Arrastre;

    Derivada = [ Punto.VersorTangente, ...
                 VectorCurvatura, ...
                -CurvaturaArriba*Punto.VersorTangente, ...
                -CurvaturaLateral*Punto.VersorTangente, ...
                 2*AceleracionTangencial, ...
                 Punto.Curvatura, ...
                 1/max(Punto.Velocidad, 1e-6) ];
end
