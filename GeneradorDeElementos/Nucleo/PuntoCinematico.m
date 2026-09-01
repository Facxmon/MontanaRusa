function Punto = PuntoCinematico(Arco, y, Contexto)
%PUNTOCINEMATICO Campos geometricos de un punto, sin evaluar la curvatura.
%   Se separa de DerivadaDeVia porque los modos de curvatura necesitan el
%   marco del carro y la velocidad, y hay que poder evaluarlos antes de
%   arrancar un sub-tramo para dimensionar su longitud.

    Punto.Arco                    = Arco;
    Punto.Posicion                = y(1:3);
    Punto.VersorTangente          = y(4:6);
    Punto.VersorArribaTransporte  = y(7:9);
    Punto.VersorLateralTransporte = y(10:12);
    Punto.Velocidad               = sqrt(max(y(13), 0));
    Punto.AnguloGirado            = y(14);
    Punto.Tiempo                  = y(15);

    % El roll depende del angulo ya girado, no solo del arco: la parte
    % helicoidal del loop exige dphi/ds = kappa*tan(alfa), o sea phi
    % proporcional al giro acumulado. Su derivada la completa DerivadaDeVia,
    % que es donde recien se conoce la curvatura.
    [Punto.AnguloRoll, Punto.VelocidadRoll, Punto.AceleracionRoll] = ...
        Contexto.FuncionRoll(Arco, Punto.AnguloGirado);
    [Punto.VersorArribaCarro, Punto.VersorLateral] = MarcoCarroDesdeTransporte( ...
        Punto.VersorArribaTransporte, Punto.VersorLateralTransporte, Punto.AnguloRoll);

    % El metodo A usa la velocidad que lleva la marcha; el metodo B usa el
    % perfil supuesto de la iteracion anterior, que llega como interpolante ya
    % construido (pchip: la interpolacion lineal metia un error de orden ds^2
    % en los estadios intermedios de RK4). La energia se integra siempre con
    % la velocidad real, en los dos metodos.
    if isempty(Contexto.PerfilVelocidad)
        Punto.VelocidadParaCurvatura = Punto.Velocidad;
    else
        Punto.VelocidadParaCurvatura = max(Contexto.PerfilVelocidad(Arco), ...
                                           Contexto.VelocidadMinimaDeSeguridad);
    end
end
