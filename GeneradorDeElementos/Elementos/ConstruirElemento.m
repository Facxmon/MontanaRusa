function [EstadoSalida, Elemento, Reporte] = ConstruirElemento(EstadoEntrada, Parametros, Receta, Layout)
%CONSTRUIRELEMENTO Elemento de via: consume un Estado y produce un Estado.
%   Es la parte comun a todos los elementos: chequeos, generacion, simulacion,
%   verificacion normativa y armado del reporte. Lo unico que cambia entre un
%   loop, una helice, un over-banked turn y un dive loop es la Receta, que
%   arma cada ElementoXxx y describe GenerarGeometria.
%
%   Normalmente no se la llama directo sino a traves de ElementoLoopVertical,
%   ElementoHelice, ElementoOverBankedTurn o ElementoDiveLoop.
%
%   Layout trae la polilinea de la via ya construida, que hace falta para el
%   chequeo de interferencia.
%
%   Devuelve:
%     EstadoSalida  estado para encadenar el elemento siguiente
%     Elemento      Track (geometria congelada) + Sim (estado dinamico)
%     Reporte       factibilidad estructurada y numeros de salida

    if nargin < 4
        Layout = [];
    end

    Reporte.Previos = ChequeosPrevios(EstadoEntrada, Parametros, Receta);

    %% ---------------- Generacion ------------------------------------------
    % El metodo B itera y tarda alrededor de tres veces mas que el A. Solo se
    % corre si se lo pide: con 'Ambos' se corren los dos y se reporta la
    % comparacion, que es lo que hace falta para el reporte del proyecto, pero
    % no es lo que uno quiere en cada corrida de trabajo.
    Reporte.Comparacion = [];
    switch upper(Parametros.MetodoDeAcoplamiento)
        case 'A'
            [Track, Diagnostico] = ResolverMetodoA(EstadoEntrada, Parametros, Receta);
        case 'B'
            [Track, Diagnostico] = ResolverMetodoB(EstadoEntrada, Parametros, Receta);
        case 'AMBOS'
            Reporte.Comparacion = CompararMetodos(EstadoEntrada, Parametros, Receta, false);
            Track       = Reporte.Comparacion.TrackA;
            Diagnostico = Reporte.Comparacion.DiagnosticoA;
        otherwise
            error('ConstruirElemento:MetodoDesconocido', ...
                 ['Metodo de acoplamiento no reconocido: %s. ' ...
                  'Las opciones son ''A'', ''B'' o ''Ambos''.'], Parametros.MetodoDeAcoplamiento);
    end

    Sim = SimularSobreTrack(Track, EstadoEntrada, Parametros);

    [Reporte.Posteriores, Reporte.Normativo] = ChequeosPosteriores(Track, Sim, Parametros, Layout);

    % Si las dos clotoides juntas giran mas que el objetivo del elemento, el
    % arco principal queda de longitud nula y el giro se pasa haga lo que haga
    % la correccion de cierre: no hay geometria que cumpla. Pasa cuando el
    % radio es chico para la velocidad de entrada, porque la longitud de las
    % transiciones va como DeltaG*v/onset y DeltaG como v^2/(g*R).
    Reporte.Posteriores = AgregarCriterio(Reporte.Posteriores, 'Giro objetivo alcanzado', ...
        'MenorOIgual', abs(Diagnostico.ResidualCierrePitch), Parametros.TolCierrePitch, 'rad', ...
        ['Si falla, las transiciones consumen mas giro que el que pide el elemento: ' ...
         'hay que agrandar el radio o entrar mas lento.']);

    Reporte.Posteriores = CriterioDeObjetivoDeG(Reporte.Posteriores, Track, Sim, Diagnostico, Receta, Parametros);

    %% ---------------- Estado de salida -------------------------------------
    % El estado que se encadena viaja sobre el RIEL: es la curva que integra
    % el elemento siguiente. La heartline se deriva de el, nunca al reves. La
    % velocidad es la del centro de masa, que es la que conserva energia.
    Ultimo = size(Track.PuntosRiel, 1);
    EstadoSalida.Posicion          = Track.PuntosRiel(Ultimo, :);
    EstadoSalida.VersorTangente    = Track.VersorTangente(Ultimo, :);
    EstadoSalida.VersorArribaCarro = Track.VersorArribaCarro(Ultimo, :);
    EstadoSalida.VersorLateral     = Track.VersorLateral(Ultimo, :);
    EstadoSalida.VectorCurvatura   = Track.VectorCurvatura(Ultimo, :);
    EstadoSalida.DerivadaCurvatura = Track.DerivadaCurvatura(Ultimo);
    EstadoSalida.AnguloRoll        = Track.AnguloRoll(Ultimo);
    EstadoSalida.VelocidadRoll     = Track.VelocidadRoll(Ultimo);
    EstadoSalida.AceleracionRoll   = Track.AceleracionRoll(Ultimo);
    EstadoSalida.LongitudAcumulada = Track.LongitudArco(Ultimo);
    EstadoSalida.Velocidad         = Sim.VelocidadCentroDeMasa(Ultimo);
    EstadoSalida.EnergiaTotal      = Sim.EnergiaTotal(Ultimo);

    %% ---------------- Numeros de salida ------------------------------------
    Escala = Diagnostico.Escala;
    AlturaRelativa = Track.PuntosHeartline(:,3) - Track.PuntosHeartline(1,3);

    Resumen.Metodo                 = Diagnostico.Metodo;
    Resumen.LongitudRecorrida      = Track.LongitudArco(end) - Track.LongitudArco(1);
    % Lo que se imprime es el riel, asi que el material se mide sobre el riel.
    Resumen.LongitudDeMaterial     = LongitudDePolilinea(Track.PuntosRiel);
    Resumen.AlturaMaxima           = max(AlturaRelativa);
    % El radio del riel es exacto (curvatura impuesta); el de la heartline se
    % recupera numericamente de la curva derivada.
    Resumen.RadioMinimoRiel        = 1/max(max(Track.Curvatura),          eps);
    Resumen.RadioMinimo            = 1/max(max(Track.CurvaturaHeartline), eps);
    Resumen.FuerzaNormalMaxima     = max(Sim.FuerzaNormal);
    Resumen.VelocidadMinima        = min(Sim.VelocidadCentroDeMasa);
    Resumen.TiempoDeRecorrido      = Sim.Tiempo(end);
    Resumen.EnergiaDisipadaRodadura = Sim.EnergiaDisipadaRodadura(end);
    Resumen.EnergiaDisipadaArrastre = Sim.EnergiaDisipadaArrastre(end);
    Resumen.GzMaxima               = max(Sim.Gz);
    Resumen.GzMinima               = min(Sim.Gz);
    Resumen.GyMaximaAbsoluta       = max(abs(Sim.Gy));
    Resumen.GzMaximaCabeza         = max(Sim.GzCabeza);
    Resumen.GyMaximaAbsolutaCabeza = max(abs(Sim.GyCabeza));
    Resumen.BrazoDeVerificacion    = Sim.BrazoDeVerificacion;
    Resumen.PeralteFinal           = Track.AnguloPeralte(end);
    Resumen.PeralteMaximo          = max(abs(Track.AnguloPeralte));

    % Residual del endpoint. El punto de entrada NO es el endpoint esperado:
    % un loop con clotoides de entrada y salida de distinta longitud no vuelve
    % a su propio punto de arranque. Lo que si tiene que cerrar es la rotacion
    % de la tangente dentro del plano del loop tras 2*pi.
    Resumen.ResidualCierrePitch    = Diagnostico.ResidualCierrePitch;
    Resumen.ResidualCierreTangente = norm(Track.VersorTangente(end,:) - Track.VersorTangente(1,:));
    Resumen.PosicionFinal          = Track.PuntosRiel(end,:);

    % Avance sobre el eje de la helice. En el loop es la separacion entre la
    % pata de entrada y la de salida, que es lo que evita que se choque consigo
    % mismo; en la helice es directamente cuanto sube. Es un objetivo de
    % diseno, no un residual: se lo impone la inclinacion helicoidal.
    Resumen.DesplazamientoLateral         = Diagnostico.DesplazamientoLateral;
    Resumen.DesplazamientoLateralObjetivo = Receta.DesplazamientoObjetivo;
    Resumen.InclinacionHelicoidal         = Diagnostico.InclinacionHelicoidal;

    % Continuidad en el empalme con el estado de entrada.
    Resumen.SaltoDeTangente  = norm(Track.VersorTangente(1,:) - EstadoEntrada.VersorTangente);
    Resumen.SaltoDeCurvatura = norm(Track.VectorCurvatura(1,:) - EstadoEntrada.VectorCurvatura);
    Resumen.SaltoDePosicion  = norm(Track.PuntosRiel(1,:) - EstadoEntrada.Posicion);

    % Escalado del modelo distorsionado.
    Resumen.LambdaLoop         = Escala.LambdaLoop;
    Resumen.LambdaCarro        = Escala.LambdaCarro;
    Resumen.Distorsion         = Escala.Distorsion;
    Resumen.CarrosEquivalentes = Escala.CarrosEquivalentes;
    Resumen.OnsetMaximoModelo  = Escala.OnsetMaximo;

    if Parametros.CalcularVelocidadMinima
        [Resumen.VelocidadInicialMinima, Resumen.BusquedaVelocidad] = ...
            VelocidadInicialMinima(EstadoEntrada, Parametros, Receta);
    else
        Resumen.VelocidadInicialMinima = NaN;
        Resumen.BusquedaVelocidad = struct('Convergio', false, 'Evaluaciones', 0, ...
                                           'Motivo', 'No se pidio el calculo.');
    end

    Reporte.Resumen = Resumen;

    %% ---------------- Elemento ---------------------------------------------
    Elemento.Nombre       = Receta.Nombre;
    Elemento.Track        = Track;
    Elemento.Sim          = Sim;
    Elemento.SubTramos    = Track.SubTramos;
    Elemento.Diagnostico  = Diagnostico;
    Elemento.Parametros   = Parametros;
    Elemento.Receta       = Receta;
    Elemento.EstadoEntrada = EstadoEntrada;
    Elemento.EstadoSalida  = EstadoSalida;
    Elemento.Resultados   = TablaDeResultados(Track, Sim);
end

%% ========================= auxiliares =====================================
function Longitud = LongitudDePolilinea(Puntos)
    Longitud = sum(vecnorm(diff(Puntos, 1, 1), 2, 2));
end

function Criterios = CriterioDeObjetivoDeG(Criterios, Track, Sim, Diagnostico, Receta, Parametros)
%CRITERIODEOBJETIVODEG El pasajero recibio en el arco la G que pidio el modo.
%   Es el chequeo que cierra el transporte inverso: el modo resuelve la
%   curvatura del riel para que el punto de verificacion reciba la G
%   objetivo, y aca se mide, sobre la simulacion ya hecha, cuanto se aparto.
%   Falla si el objetivo era inalcanzable a esa velocidad (la cuadratica del
%   transporte inverso no tiene raiz real y devuelve la curvatura del maximo)
%   o si alguna aproximacion dentro del paso pesa mas de lo que deberia.
%   Solo aplica a los modos que persiguen una G; en Clotoide y
%   AceleracionNormalConstante es informativo y no se evalua.

    Indice = find(strcmp({Track.SubTramos.Nombre}, 'ArcoPrincipal'), 1);
    if isempty(Indice)
        return
    end
    Rango = Track.SubTramos(Indice).IndiceInicio : Track.SubTramos(Indice).IndiceFin;
    Rango = Rango(~isnan(Sim.Gz(Rango)));
    if isempty(Rango)
        Criterios = AgregarCriterio(Criterios, 'Gz objetivo del modo alcanzado', 'Informativo', NaN, NaN, 'G', ...
            'El arco principal quedo vacio: las clotoides consumieron todo el giro.');
        return
    end

    switch Parametros.ModoCurvatura
        case 'FuerzaGConstante'
            Objetivo = Parametros.FuerzaGObjetivo * ones(numel(Rango), 1);
            Detalle  = sprintf('FuerzaGObjetivo = %.2f G', Parametros.FuerzaGObjetivo);
        case 'GNormativaMaxima'
            % Misma definicion de duracion que el modo: desde el inicio del arco.
            DuracionReal = (Sim.Tiempo(Rango) - Sim.Tiempo(Rango(1))) * Diagnostico.Escala.RaizLambdaLoop;
            Objetivo = arrayfun(@(D) LimiteNormativo(Receta.CurvaLimiteGz, D), DuracionReal);
            Detalle  = sprintf('curva %s, de %.2f a %.2f G a lo largo del arco (%.2f s reales)', ...
                               Receta.CurvaLimiteGz, Objetivo(1), Objetivo(end), DuracionReal(end));
        otherwise
            return
    end

    Desvio = max(abs(Sim.Gz(Rango) - Objetivo));
    Criterios = AgregarCriterio(Criterios, 'Gz objetivo del modo alcanzado', 'MenorOIgual', ...
        Desvio, Parametros.TolObjetivoDeG, 'G', ...
        sprintf(['%s; medido en el punto de verificacion (brazo %.3f m). Si falla, el objetivo era ' ...
                 'inalcanzable a esa velocidad con ese brazo, o el arco es demasiado corto.'], ...
                Detalle, Sim.BrazoDeVerificacion));
end

function Tabla = TablaDeResultados(Track, Sim)
%TABLADERESULTADOS Matriz de resultados por paso, con columnas nombradas.
%   Lleva las dos curvas: X,Y,Z es la heartline -- donde va el pasajero y
%   donde se evaluan las G -- y XRiel,YRiel,ZRiel es la via que se fabrica y
%   sobre la que se mide el arco. Velocidad es la del centro de masa.
    RadioHeartline = 1 ./ max(Track.CurvaturaHeartline, eps);
    RadioHeartline(Track.CurvaturaHeartline < eps) = Inf;

    RadioRiel = 1 ./ max(Track.Curvatura, eps);
    RadioRiel(Track.Curvatura < eps) = Inf;

    Tabla = table(Track.LongitudArco, ...
                  Track.PuntosHeartline(:,1), Track.PuntosHeartline(:,2), Track.PuntosHeartline(:,3), ...
                  Track.PuntosRiel(:,1), Track.PuntosRiel(:,2), Track.PuntosRiel(:,3), ...
                  Sim.Tiempo, Sim.VelocidadCentroDeMasa, Sim.AceleracionTangencial, ...
                  Sim.Gx, Sim.Gy, Sim.Gz, Sim.JerkGx, Sim.JerkGy, Sim.JerkGz, ...
                  Sim.GyCabeza, Sim.GzCabeza, ...
                  Track.CurvaturaHeartline, RadioHeartline, Track.Curvatura, RadioRiel, ...
                  rad2deg(Track.AnguloRoll), ...
                  rad2deg(Track.AnguloPeralte), Sim.FuerzaNormal, ...
        'VariableNames', {'Arco','X','Y','Z','XRiel','YRiel','ZRiel', ...
                          'Tiempo','Velocidad','AceleracionTangencial', ...
                          'Gx','Gy','Gz','JerkGx','JerkGy','JerkGz', ...
                          'GyCabeza','GzCabeza', ...
                          'Curvatura','Radio','CurvaturaRiel','RadioRiel', ...
                          'RollGrados','PeralteGrados','FuerzaNormal'});
end
