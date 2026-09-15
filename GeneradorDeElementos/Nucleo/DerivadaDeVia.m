function [Derivada, Punto] = DerivadaDeVia(Arco, y, Contexto)
%DERIVADADEVIA Ecuaciones de la via y de la energia, acopladas.
%
%   Vector de estado y (1x15), parametrizado por el arco s DEL RIEL:
%       1:3    Posicion del riel
%       4:6    VersorTangente del riel
%       7:9    VersorArribaTransporte
%      10:12   VersorLateralTransporte
%      13      Velocidad^2 del CENTRO DE MASA (sobre la heartline, no del riel)
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
%
%   Hipotesis del eje de roll: la curva integrada es el RIEL y el roll gira el
%   marco del carro alrededor de su tangente. El centro de masa del pasajero
%   va sobre la heartline, r_h = r + d*U, y como U gira con el roll y con la
%   curvatura, la heartline no es unit-speed en s:
%       d r_h/ds = (1 - d*ku)*T + d*phi'*L,    J = |d r_h/ds|
%   con ku la curvatura del riel sobre U y phi' el roll por unidad de arco.
%   La energia que se conserva es la del centro de masa, asi que y(13) lleva
%   v_cm^2 y la velocidad del punto del riel es v = v_cm/J. Esa v es la que
%   fija el tiempo (dt/ds = 1/v) y la velocidad angular del marco.

    Parametros = Contexto.Parametros;
    g = Parametros.Gravedad;
    d = Parametros.DistanciaHeartline;

    Punto = PuntoCinematico(Arco, y, Contexto);

    [CurvaturaArriba, CurvaturaLateral] = Contexto.FuncionCurvatura(Punto);
    VectorCurvatura = CurvaturaArriba*Punto.VersorArribaTransporte ...
                    + CurvaturaLateral*Punto.VersorLateralTransporte;
    Curvatura = hypot(CurvaturaArriba, CurvaturaLateral);

    % Componentes de la curvatura sobre el marco del CARRO: son las que entran
    % en la G del pasajero y en la velocidad de la heartline.
    CurvaturaArribaCarro  = dot(VectorCurvatura, Punto.VersorArribaCarro);
    CurvaturaLateralCarro = dot(VectorCurvatura, Punto.VersorLateral);

    % Roll total por unidad de arco: la transicion quintica mas la parte
    % helicoidal, que recien se conoce ahora porque vale kappa*tan(alfa).
    VelocidadRoll = Punto.VelocidadRoll + Contexto.InclinacionHelicoidal*Curvatura;

    FactorVelocidadHeartline = hypot(1 - d*CurvaturaArribaCarro, d*VelocidadRoll);
    VelocidadRiel = Punto.VelocidadCentroDeMasa / FactorVelocidadHeartline;

    % La aceleracion tangencial del punto del riel entra solo en el termino
    % de Euler del roll, Brazo*a_t*phi'/g, que en el arco es chico: ahi se
    % usa la componente de la gravedad sola. La resistencia al avance
    % (~0.1 g) multiplicada por d*phi' queda muy por debajo de la tolerancia
    % de los chequeos; la verificacion posterior usa la a_t numerica completa.
    AceleracionTangencialEstimada = -g*Punto.VersorTangente(3);

    % Cargas en el centro de masa (brazo d): fuerza normal y reparto entre
    % juegos de ruedas.
    [GArribaHeartline, GLateralHeartline] = CargasEnLaVia( ...
        CurvaturaArribaCarro, CurvaturaLateralCarro, VelocidadRiel, ...
        VelocidadRoll, Punto.AceleracionRoll, AceleracionTangencialEstimada, ...
        Punto.VersorArribaCarro(3), Punto.VersorLateral(3), d, g);
    [FuerzaResistencia, Rodadura, Arrastre] = ResistenciaAlAvance(VelocidadRiel, ...
                                                GArribaHeartline, GLateralHeartline, Parametros);

    % Cargas en el punto de verificacion (brazo b): las que el modo persigue y
    % las que realimentan la longitud de las transiciones. Coinciden con las
    % del centro de masa salvo que se pida verificar en la cabeza.
    Brazo = BrazoDeVerificacion(Parametros);
    if Brazo == d
        GArribaVerificacion  = GArribaHeartline;
        GLateralVerificacion = GLateralHeartline;
    else
        [GArribaVerificacion, GLateralVerificacion] = CargasEnLaVia( ...
            CurvaturaArribaCarro, CurvaturaLateralCarro, VelocidadRiel, ...
            VelocidadRoll, Punto.AceleracionRoll, AceleracionTangencialEstimada, ...
            Punto.VersorArribaCarro(3), Punto.VersorLateral(3), Brazo, g);
    end

    % Energia del centro de masa: d(v_cm^2)/ds = -2*g*dz_cm/ds - 2*F_res/m,
    % con la altura del centro de masa z_cm = z + d*Uz y su derivada sacada
    % de d r_h/ds. La resistencia trabaja sobre el arco del riel, que es donde
    % ruedan las ruedas.
    DerivadaAlturaCentroDeMasa = (1 - d*CurvaturaArribaCarro)*Punto.VersorTangente(3) ...
                               + d*VelocidadRoll*Punto.VersorLateral(3);
    DerivadaVelocidadCuadrado  = -2*g*DerivadaAlturaCentroDeMasa - 2*FuerzaResistencia/Parametros.Masa;

    Punto.CurvaturaArriba       = CurvaturaArriba;
    Punto.CurvaturaLateral      = CurvaturaLateral;
    Punto.VectorCurvatura       = VectorCurvatura;
    Punto.Curvatura             = Curvatura;
    Punto.CurvaturaArribaCarro  = CurvaturaArribaCarro;
    Punto.CurvaturaLateralCarro = CurvaturaLateralCarro;
    Punto.VelocidadRoll         = VelocidadRoll;
    Punto.Velocidad             = VelocidadRiel;
    Punto.FactorVelocidadHeartline = FactorVelocidadHeartline;
    Punto.GArribaHeartline      = GArribaHeartline;
    Punto.GLateralHeartline     = GLateralHeartline;
    Punto.GArribaVerificacion   = GArribaVerificacion;
    Punto.GLateralVerificacion  = GLateralVerificacion;
    % dv_cm/dt: es la aceleracion a lo largo del recorrido del centro de masa.
    Punto.AceleracionTangencial = VelocidadRiel * DerivadaVelocidadCuadrado / max(2*Punto.VelocidadCentroDeMasa, 1e-6);
    Punto.PerdidaRodadura       = Rodadura;
    Punto.PerdidaArrastre       = Arrastre;

    Derivada = [ Punto.VersorTangente, ...
                 VectorCurvatura, ...
                -CurvaturaArriba*Punto.VersorTangente, ...
                -CurvaturaLateral*Punto.VersorTangente, ...
                 DerivadaVelocidadCuadrado, ...
                 Curvatura, ...
                 FactorVelocidadHeartline/max(Punto.VelocidadCentroDeMasa, 1e-6) ];
end
