function Punto = PuntoCinematico(Arco, y, Contexto)
%PUNTOCINEMATICO Campos geometricos de un punto del RIEL, sin evaluar la curvatura.
%   Se separa de DerivadaDeVia porque los modos de curvatura necesitan el
%   marco del carro y la velocidad, y hay que poder evaluarlos antes de
%   arrancar un sub-tramo para dimensionar su longitud.
%
%   La curva integrada es el riel. El estado y(13) lleva la velocidad al
%   cuadrado del CENTRO DE MASA del pasajero, que va sobre la heartline
%   (riel + d*U) y no sobre el riel: es la energia lo que se conserva, y la
%   energia es la del centro de masa. La velocidad del punto del riel
%   (ds/dt, la que fija el tiempo) sale de dividir por |d r_heartline/ds|, que
%   depende de la curvatura, asi que recien la completa DerivadaDeVia.

    Punto.Arco                    = Arco;
    Punto.Posicion                = y(1:3);          % sobre el riel
    Punto.VersorTangente          = y(4:6);
    Punto.VersorArribaTransporte  = y(7:9);
    Punto.VersorLateralTransporte = y(10:12);
    Punto.VelocidadCentroDeMasa   = sqrt(max(y(13), 0));
    Punto.AnguloGirado            = y(14);
    Punto.Tiempo                  = y(15);

    % El roll depende del angulo ya girado, no solo del arco: la parte
    % helicoidal del loop exige dphi/ds = kappa*tan(alfa), o sea phi
    % proporcional al giro acumulado. Su derivada la completa DerivadaDeVia,
    % que es donde recien se conoce la curvatura.
    [Punto.AnguloRoll, Punto.VelocidadRoll, Punto.AceleracionRoll] = ...
        Contexto.FuncionRoll(Arco, Punto.AnguloGirado - Contexto.AnguloGiradoDeReferencia);
    [Punto.VersorArribaCarro, Punto.VersorLateral] = MarcoCarroDesdeTransporte( ...
        Punto.VersorArribaTransporte, Punto.VersorLateralTransporte, Punto.AnguloRoll);
    Punto.InclinacionHelicoidal = Contexto.InclinacionHelicoidal;

    % Angulo, medido desde U hacia L dentro del plano normal del carro, en el
    % que el elemento pide la curvatura. Los modos que apuntan solo a Gz la
    % dejan ahi; el que ademas apunta a Gy la desalinea (sub-peralte).
    if isfield(Contexto, 'FuncionAnguloDeCurvatura') && ~isempty(Contexto.FuncionAnguloDeCurvatura)
        Punto.AnguloCurvaturaDesdeArriba = Contexto.FuncionAnguloDeCurvatura(Punto) - Punto.AnguloRoll;
    else
        Punto.AnguloCurvaturaDesdeArriba = 0;
    end

    % El metodo A usa la velocidad que lleva la marcha; el metodo B usa el
    % perfil supuesto de la iteracion anterior, que llega como interpolante ya
    % construido (pchip: la interpolacion lineal metia un error de orden ds^2
    % en los estadios intermedios de RK4). La energia se integra siempre con
    % la velocidad real, en los dos metodos. Las dos son velocidades del
    % centro de masa.
    if isempty(Contexto.PerfilVelocidad)
        Punto.VelocidadParaCurvatura = Punto.VelocidadCentroDeMasa;
    else
        Punto.VelocidadParaCurvatura = max(Contexto.PerfilVelocidad(Arco), ...
                                           Contexto.VelocidadMinimaDeSeguridad);
    end
end
