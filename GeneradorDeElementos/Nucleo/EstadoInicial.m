function Estado = EstadoInicial(Posicion, VersorTangente, VersorArribaCarro, Velocidad, Parametros)
%ESTADOINICIAL Arma un Estado valido para arrancar un layout.
%   Contrato de Estado -- lo consume y lo produce todo elemento de via.
%
%   La Posicion viaja sobre el RIEL: es la curva que integra el generador y
%   el eje de roll. La heartline del pasajero se deriva de ella sumando d*U,
%   asi que el pasajero va a quedar DistanciaHeartline por encima del punto
%   que se pase aca, medido sobre U. La Velocidad es la del centro de masa
%   del pasajero (sobre la heartline), que es la que conserva energia; en
%   via recta sin roll coincide con la del riel.
%
%     Posicion            [x y z]                   (m)  sobre el riel
%     VersorTangente      [Tx Ty Tz]                direccion de avance
%     VersorArribaCarro   [Ux Uy Uz]                asiento -> cabeza
%     VersorLateral       [Lx Ly Lz]                L = T x U
%     VectorCurvatura     [kx ky kz]                modulo = kappa, direccion = normal
%     DerivadaCurvatura   dkappa/ds                 (1/m^2)
%     AnguloRoll          phi                       (rad)
%     VelocidadRoll       dphi/ds                   (rad/m)
%     AceleracionRoll     d2phi/ds2                 (rad/m^2)
%     LongitudAcumulada   s desde el inicio del layout (m)
%     Velocidad           v                         (m/s) del centro de masa
%     EnergiaTotal        E                         (J)
%
%   El roll se mide contra el marco de transporte paralelo. En el punto de
%   arranque se elige U_pt = U, de modo que phi = 0 por definicion.

    VersorTangente    = VersorTangente    / norm(VersorTangente);
    VersorArribaCarro = VersorArribaCarro - dot(VersorArribaCarro, VersorTangente)*VersorTangente;
    VersorArribaCarro = VersorArribaCarro / norm(VersorArribaCarro);

    Estado.Posicion          = Posicion(:).';
    Estado.VersorTangente    = VersorTangente(:).';
    Estado.VersorArribaCarro = VersorArribaCarro(:).';
    Estado.VersorLateral     = cross(Estado.VersorTangente, Estado.VersorArribaCarro);
    Estado.VectorCurvatura   = [0 0 0];
    Estado.DerivadaCurvatura = 0;
    Estado.AnguloRoll        = 0;
    Estado.VelocidadRoll     = 0;
    Estado.AceleracionRoll   = 0;
    Estado.LongitudAcumulada = 0;
    Estado.Velocidad         = Velocidad;
    % Energia del centro de masa, que esta d*U por encima del riel.
    Estado.EnergiaTotal      = 0.5*Parametros.Masa*Velocidad^2 ...
                             + Parametros.Masa*Parametros.Gravedad*(Estado.Posicion(3) ...
                               + Parametros.DistanciaHeartline*Estado.VersorArribaCarro(3));
end
