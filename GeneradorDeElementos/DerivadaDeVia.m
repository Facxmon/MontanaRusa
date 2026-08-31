function [Derivada, Punto] = DerivadaDeVia(Arco, y, Contexto)
%DERIVADADEVIA Ecuaciones de la via y de la energia, acopladas.
%
%   Vector de estado y (1x14):
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

    Posicion              = y(1:3);
    VersorTangente        = y(4:6);
    VersorArribaTransporte  = y(7:9);
    VersorLateralTransporte = y(10:12);
    VelocidadCuadrado     = max(y(13), 0);
    Velocidad             = sqrt(VelocidadCuadrado);

    [AnguloRoll, VelocidadRoll, AceleracionRoll] = Contexto.FuncionRoll(Arco);
    [VersorArribaCarro, VersorLateral] = MarcoCarroDesdeTransporte( ...
        VersorArribaTransporte, VersorLateralTransporte, AnguloRoll);

    % El metodo A usa la velocidad que lleva la marcha; el metodo B usa el
    % perfil supuesto de la iteracion anterior. La energia se integra siempre
    % con la velocidad real.
    if isempty(Contexto.PerfilVelocidad)
        VelocidadParaCurvatura = Velocidad;
    else
        VelocidadParaCurvatura = interp1(Contexto.PerfilVelocidad.Arco, ...
                                         Contexto.PerfilVelocidad.Velocidad, ...
                                         Arco, 'linear', 'extrap');
        VelocidadParaCurvatura = max(VelocidadParaCurvatura, Contexto.VelocidadMinimaDeSeguridad);
    end

    Punto.Arco                    = Arco;
    Punto.Posicion                = Posicion;
    Punto.VersorTangente          = VersorTangente;
    Punto.VersorArribaTransporte  = VersorArribaTransporte;
    Punto.VersorLateralTransporte = VersorLateralTransporte;
    Punto.VersorArribaCarro       = VersorArribaCarro;
    Punto.VersorLateral           = VersorLateral;
    Punto.Velocidad               = Velocidad;
    Punto.VelocidadParaCurvatura  = VelocidadParaCurvatura;
    Punto.AnguloRoll              = AnguloRoll;
    Punto.VelocidadRoll           = VelocidadRoll;
    Punto.AceleracionRoll         = AceleracionRoll;
    Punto.AnguloGirado            = y(14);
    Punto.Tiempo                  = y(15);

    [CurvaturaArriba, CurvaturaLateral] = Contexto.FuncionCurvatura(Punto);
    VectorCurvatura = CurvaturaArriba*VersorArribaTransporte + CurvaturaLateral*VersorLateralTransporte;

    [GArribaRiel, GLateralRiel] = CargasEnLaVia(VersorArribaCarro, VersorLateral, ...
                                                VectorCurvatura, Velocidad, Parametros.Gravedad);
    [FuerzaResistencia, Rodadura, Arrastre] = ResistenciaAlAvance(Velocidad, GArribaRiel, GLateralRiel, Parametros);

    AceleracionTangencial = -Parametros.Gravedad*VersorTangente(3) - FuerzaResistencia/Parametros.Masa;

    Punto.CurvaturaArriba       = CurvaturaArriba;
    Punto.CurvaturaLateral      = CurvaturaLateral;
    Punto.VectorCurvatura       = VectorCurvatura;
    Punto.Curvatura             = hypot(CurvaturaArriba, CurvaturaLateral);
    Punto.GArribaRiel           = GArribaRiel;
    Punto.GLateralRiel          = GLateralRiel;
    Punto.AceleracionTangencial = AceleracionTangencial;
    Punto.PerdidaRodadura       = Rodadura;
    Punto.PerdidaArrastre       = Arrastre;

    Derivada = [ VersorTangente, ...
                 CurvaturaArriba*VersorArribaTransporte + CurvaturaLateral*VersorLateralTransporte, ...
                -CurvaturaArriba*VersorTangente, ...
                -CurvaturaLateral*VersorTangente, ...
                 2*AceleracionTangencial, ...
                 Punto.Curvatura, ...
                 1/max(Velocidad, 1e-6) ];
end
