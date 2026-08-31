function [VelocidadMinima, Busqueda] = VelocidadInicialMinima(EstadoEntrada, Parametros)
%VELOCIDADINICIALMINIMA Menor v_0 que permite recorrer el elemento completo
%   manteniendo la G minima pedida sobre el eje vertical del carro.
%
%   El criterio NO es N = 0. Con ruedas de retencion el carro no se cae, pero
%   un margen nulo no tolera variacion de friccion ni de temperatura: por eso
%   GMinimaCuspide es un parametro de entrada.
%
%   Se resuelve por biseccion, con paso de generacion grueso: lo que interesa
%   es el valor de la velocidad, no la geometria fina.

    ParametrosBusqueda = Parametros;
    ParametrosBusqueda.PasoGeneracion = Parametros.PasoBusquedaVelocidad;

    Holgura = @(Velocidad) HolguraDeCuspide(EstadoEntrada, ParametrosBusqueda, Velocidad);

    %% --- Bracketing --------------------------------------------------------
    VelocidadAlta = max(EstadoEntrada.Velocidad, 0.5);
    Evaluaciones = 0;
    while Holgura(VelocidadAlta) < 0
        VelocidadAlta = 1.5*VelocidadAlta;
        Evaluaciones = Evaluaciones + 1;
        if Evaluaciones > 15
            VelocidadMinima = NaN;
            Busqueda = struct('Convergio', false, 'Evaluaciones', Evaluaciones, ...
                              'Motivo', 'No se encontro ninguna velocidad que complete el elemento.');
            return
        end
    end

    VelocidadBaja = VelocidadAlta;
    while Holgura(VelocidadBaja) >= 0
        VelocidadBaja = VelocidadBaja/1.5;
        Evaluaciones = Evaluaciones + 1;
        if VelocidadBaja < 1e-3
            break
        end
    end

    %% --- Biseccion ---------------------------------------------------------
    for Iteracion = 1:40
        VelocidadMedia = 0.5*(VelocidadBaja + VelocidadAlta);
        if Holgura(VelocidadMedia) >= 0
            VelocidadAlta = VelocidadMedia;
        else
            VelocidadBaja = VelocidadMedia;
        end
        Evaluaciones = Evaluaciones + 1;
        if (VelocidadAlta - VelocidadBaja) < 1e-3
            break
        end
    end

    VelocidadMinima = VelocidadAlta;
    Busqueda = struct('Convergio', true, 'Evaluaciones', Evaluaciones, ...
                      'Motivo', sprintf('Biseccion cerrada en %.4f m/s con tolerancia 1e-3 m/s.', VelocidadMinima));
end

function Holgura = HolguraDeCuspide(EstadoEntrada, Parametros, Velocidad)
%HOLGURADECUSPIDE Margen de G sobre el minimo pedido. Negativo = no sirve.

    Estado = EstadoEntrada;
    Estado.Velocidad    = Velocidad;
    Estado.EnergiaTotal = 0.5*Parametros.Masa*Velocidad^2 ...
                        + Parametros.Masa*Parametros.Gravedad*Estado.Posicion(3);

    Advertencia = warning('off', 'all');
    try
        [~, Diagnostico] = GenerarLoopVertical(Estado, Parametros, []);
    catch
        warning(Advertencia);
        Holgura = -Inf;
        return
    end
    warning(Advertencia);

    if ~isempty(Diagnostico.Aviso)
        Holgura = -Inf;
        return
    end

    Holgura = min(Diagnostico.GArribaRiel) - Parametros.GMinimaCuspide;
end
