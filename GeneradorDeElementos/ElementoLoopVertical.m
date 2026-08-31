function [EstadoSalida, Elemento, Reporte] = ElementoLoopVertical(EstadoEntrada, Parametros, Layout)
%ELEMENTOLOOPVERTICAL Elemento de via: consume un Estado y produce un Estado.
%   Esta firma es el contrato que van a respetar todos los elementos futuros
%   (switch track, zero-G roll, helice, over-banked turn). Layout trae la
%   polilinea de la via ya construida, que hace falta para el chequeo de
%   interferencia.
%
%   Devuelve:
%     EstadoSalida  estado para encadenar el elemento siguiente
%     Elemento      Track (geometria congelada) + Sim (estado dinamico)
%     Reporte       factibilidad estructurada y numeros de salida

    if nargin < 3
        Layout = [];
    end

    Reporte.Previos = ChequeosPrevios(EstadoEntrada, Parametros);

    %% ---------------- Generacion ------------------------------------------
    switch upper(Parametros.MetodoDeAcoplamiento)
        case 'A'
            [Track, Diagnostico] = ResolverMetodoA(EstadoEntrada, Parametros);
        case 'B'
            [Track, Diagnostico] = ResolverMetodoB(EstadoEntrada, Parametros);
        otherwise
            error('ElementoLoopVertical:MetodoDesconocido', ...
                  'Metodo de acoplamiento no reconocido: %s', Parametros.MetodoDeAcoplamiento);
    end

    Sim = SimularSobreTrack(Track, EstadoEntrada, Parametros);

    [Reporte.Posteriores, Reporte.Normativo] = ChequeosPosteriores(Track, Sim, Parametros, Layout);

    %% ---------------- Estado de salida -------------------------------------
    Ultimo = size(Track.Puntos, 1);
    EstadoSalida.Posicion          = Track.Puntos(Ultimo, :);
    EstadoSalida.VersorTangente    = Track.VersorTangente(Ultimo, :);
    EstadoSalida.VersorArribaCarro = Track.VersorArribaCarro(Ultimo, :);
    EstadoSalida.VersorLateral     = Track.VersorLateral(Ultimo, :);
    EstadoSalida.VectorCurvatura   = Track.VectorCurvatura(Ultimo, :);
    EstadoSalida.DerivadaCurvatura = Track.DerivadaCurvatura(Ultimo);
    EstadoSalida.AnguloRoll        = Track.AnguloRoll(Ultimo);
    EstadoSalida.VelocidadRoll     = Track.VelocidadRoll(Ultimo);
    EstadoSalida.AceleracionRoll   = Track.AceleracionRoll(Ultimo);
    EstadoSalida.LongitudAcumulada = Track.LongitudArco(Ultimo);
    EstadoSalida.Velocidad         = Sim.Velocidad(Ultimo);
    EstadoSalida.EnergiaTotal      = Sim.EnergiaTotal(Ultimo);

    %% ---------------- Numeros de salida ------------------------------------
    Escala = Diagnostico.Escala;
    AlturaRelativa = Track.Puntos(:,3) - Track.Puntos(1,3);
    Binormal = cross(Track.VersorTangente(1,:), Track.NormalDelPlano);

    Resumen.Metodo                 = Diagnostico.Metodo;
    Resumen.LongitudRecorrida      = Track.LongitudArco(end) - Track.LongitudArco(1);
    Resumen.LongitudDeMaterial     = LongitudDePolilinea(Track.Puntos);
    Resumen.AlturaMaxima           = max(AlturaRelativa);
    Resumen.RadioMinimo            = 1/max(max(Track.Curvatura), eps);
    Resumen.FuerzaNormalMaxima     = max(Sim.FuerzaNormal);
    Resumen.VelocidadMinima        = min(Sim.Velocidad);
    Resumen.TiempoDeRecorrido      = Sim.Tiempo(end);
    Resumen.EnergiaDisipadaRodadura = Sim.EnergiaDisipadaRodadura(end);
    Resumen.EnergiaDisipadaArrastre = Sim.EnergiaDisipadaArrastre(end);
    Resumen.GzMaxima               = max(Sim.Gz);
    Resumen.GzMinima               = min(Sim.Gz);
    Resumen.GyMaximaAbsoluta       = max(abs(Sim.Gy));

    % Residual del endpoint. El punto de entrada NO es el endpoint esperado:
    % un loop con clotoides de entrada y salida de distinta longitud no vuelve
    % a su propio punto de arranque. Lo que si tiene que cerrar es la rotacion
    % de la tangente dentro del plano del loop tras 2*pi.
    Resumen.ResidualCierrePitch    = Diagnostico.ResidualCierrePitch;
    Resumen.ResidualCierreTangente = norm(Track.VersorTangente(end,:) - Track.VersorTangente(1,:));
    Resumen.PosicionFinal          = Track.Puntos(end,:);

    % Desplazamiento lateral entre la pata de entrada y la de salida. Es lo que
    % evita que el loop se choque consigo mismo, y es un objetivo de diseno, no
    % un residual: se lo impone la torsion del elemento.
    Resumen.DesplazamientoLateral    = abs(dot(Track.Puntos(end,:) - Track.Puntos(1,:), Binormal));
    Resumen.DesplazamientoLateralObjetivo = Parametros.DesplazamientoLateralLoop;
    Resumen.InclinacionHelicoidal    = Diagnostico.InclinacionHelicoidal;

    % Continuidad en el empalme con el estado de entrada.
    Resumen.SaltoDeTangente  = norm(Track.VersorTangente(1,:) - EstadoEntrada.VersorTangente);
    Resumen.SaltoDeCurvatura = norm(Track.VectorCurvatura(1,:) - EstadoEntrada.VectorCurvatura);
    Resumen.SaltoDePosicion  = norm(Track.Puntos(1,:) - EstadoEntrada.Posicion);

    % Escalado del modelo distorsionado.
    Resumen.LambdaLoop         = Escala.LambdaLoop;
    Resumen.LambdaCarro        = Escala.LambdaCarro;
    Resumen.Distorsion         = Escala.Distorsion;
    Resumen.CarrosEquivalentes = Escala.CarrosEquivalentes;
    Resumen.OnsetMaximoModelo  = Escala.OnsetMaximo;

    if Parametros.CalcularVelocidadMinima
        [Resumen.VelocidadInicialMinima, Resumen.BusquedaVelocidad] = ...
            VelocidadInicialMinima(EstadoEntrada, Parametros);
    else
        Resumen.VelocidadInicialMinima = NaN;
        Resumen.BusquedaVelocidad = struct('Convergio', false, 'Evaluaciones', 0, ...
                                           'Motivo', 'No se pidio el calculo.');
    end

    Reporte.Resumen = Resumen;

    %% ---------------- Elemento ---------------------------------------------
    Elemento.Nombre       = 'LoopVertical';
    Elemento.Track        = Track;
    Elemento.Sim          = Sim;
    Elemento.SubTramos    = Track.SubTramos;
    Elemento.Diagnostico  = Diagnostico;
    Elemento.Parametros   = Parametros;
    Elemento.EstadoEntrada = EstadoEntrada;
    Elemento.EstadoSalida  = EstadoSalida;
    Elemento.Resultados   = TablaDeResultados(Track, Sim);
end

%% ========================= auxiliares =====================================
function Longitud = LongitudDePolilinea(Puntos)
    Longitud = sum(vecnorm(diff(Puntos, 1, 1), 2, 2));
end

function Tabla = TablaDeResultados(Track, Sim)
%TABLADERESULTADOS Matriz de resultados por paso, con columnas nombradas.
    Radio = 1 ./ max(Track.Curvatura, eps);
    Radio(Track.Curvatura < eps) = Inf;

    Tabla = table(Track.LongitudArco, Track.Puntos(:,1), Track.Puntos(:,2), Track.Puntos(:,3), ...
                  Sim.Tiempo, Sim.Velocidad, Sim.AceleracionTangencial, ...
                  Sim.Gx, Sim.Gy, Sim.Gz, Sim.JerkGx, Sim.JerkGy, Sim.JerkGz, ...
                  Track.Curvatura, Radio, rad2deg(Track.AnguloRoll), Sim.FuerzaNormal, ...
        'VariableNames', {'Arco','X','Y','Z','Tiempo','Velocidad','AceleracionTangencial', ...
                          'Gx','Gy','Gz','JerkGx','JerkGy','JerkGz', ...
                          'Curvatura','Radio','RollGrados','FuerzaNormal'});
end
