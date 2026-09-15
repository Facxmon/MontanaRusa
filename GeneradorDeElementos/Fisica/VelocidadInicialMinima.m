function [VelocidadMinima, Busqueda] = VelocidadInicialMinima(EstadoEntrada, Parametros, Receta)
%VELOCIDADINICIALMINIMA Menor v_0 que permite recorrer el elemento completo
%   respetando la G minima sobre el eje vertical del carro y el radio minimo
%   fabricable.
%
%   El criterio NO es N = 0. Con ruedas de retencion el carro no se cae, pero
%   un margen nulo no tolera variacion de friccion ni de temperatura: por eso
%   GMinimaCuspide es un parametro de entrada.
%
%   El radio minimo entra al criterio porque en los modos que fijan la G
%   objetivo la geometria se adapta a la velocidad: bajar v achica el loop y
%   la G en la cuspide no cambia, asi que la restriccion que termina mordiendo
%   no es energetica sino de fabricacion.
%
%   Se resuelve por biseccion, con paso de generacion grueso: lo que interesa
%   es el valor de la velocidad, no la geometria fina. Las dos condiciones son
%   crecientes en v, asi que la biseccion esta bien planteada.

    ParametrosBusqueda = Parametros;
    ParametrosBusqueda.PasoGeneracion = Parametros.PasoBusquedaVelocidad;

    Holgura = @(Velocidad) HolguraDeCuspide(EstadoEntrada, ParametrosBusqueda, Receta, Velocidad);

    %% --- Bracketing --------------------------------------------------------
    % Se acota la busqueda: por encima de unas pocas veces la velocidad de
    % entrada las transiciones se alargan como v^3 y cada generacion tarda
    % minutos, y una velocidad asi no es una respuesta util de todos modos.
    VelocidadAlta = max(EstadoEntrada.Velocidad, 0.5);
    VelocidadTope = 3*VelocidadAlta;
    Evaluaciones = 0;
    while Holgura(VelocidadAlta) < 0
        VelocidadAlta = 1.5*VelocidadAlta;
        Evaluaciones = Evaluaciones + 1;
        if VelocidadAlta > VelocidadTope
            VelocidadMinima = NaN;
            Busqueda = struct('Convergio', false, 'Evaluaciones', Evaluaciones, ...
                              'Motivo', sprintf(['Ninguna velocidad hasta %.1f m/s satisface la G minima ' ...
                                                 'de cuspide y el radio fabricable a la vez.'], VelocidadTope));
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

function Holgura = HolguraDeCuspide(EstadoEntrada, Parametros, Receta, Velocidad)
%HOLGURADECUSPIDE Margen combinado de G en la cuspide y de radio fabricable,
%   normalizado para poder tomar el mas chico de los dos. Negativo = no sirve.

    Estado = EstadoEntrada;
    Estado.Velocidad    = Velocidad;
    Estado.EnergiaTotal = 0.5*Parametros.Masa*Velocidad^2 ...
                        + Parametros.Masa*Parametros.Gravedad*Estado.Posicion(3);

    Advertencia = warning('off', 'all');
    try
        [Track, Diagnostico] = GenerarGeometria(Estado, Parametros, Receta, []);
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

    % La G en el punto de verificacion, medida desde la clotoide de entrada en
    % adelante: es la holgura de CUSPIDE. La transicion de roll queda afuera
    % porque ahi la G baja por la centripeta de girar alrededor del riel
    % (-v^2*b*phi'^2/g), que no depende de la velocidad de entrada de forma
    % que una biseccion pueda corregir; ese valle lo reporta el chequeo
    % posterior de G minima sobre el elemento completo. El radio es el del
    % RIEL (curva integrada), que es el que limita la impresora.
    Desde = 1;
    IndiceClotoide = find(strcmp({Track.SubTramos.Nombre}, 'ClotoideEntrada'), 1);
    if ~isempty(IndiceClotoide)
        Desde = Track.SubTramos(IndiceClotoide).IndiceInicio;
    end
    HolguraDeG      = min(Diagnostico.GArribaVerificacion(Desde:end)) - Parametros.GMinimaCuspide;
    RadioAlcanzado  = 1/max(max(Track.Curvatura), eps);
    HolguraDeRadio  = (RadioAlcanzado - Parametros.RadioMinimoFabricable) / Parametros.RadioMinimoFabricable;

    Holgura = min(HolguraDeG, HolguraDeRadio);
end
