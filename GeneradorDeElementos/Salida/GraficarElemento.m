function Figuras = GraficarElemento(Elemento, Reporte)
%GRAFICARELEMENTO Graficos de salida del elemento.
%   Los sub-tramos se distinguen por color en las trayectorias y quedan
%   marcados con lineas verticales en los graficos contra distancia y contra
%   tiempo. Los graficos de G llevan superpuesta la banda de limite
%   normativo: una curva desnuda no dice si el diseno pasa o no.
%
%   Las G y el jerk se grafican dos veces: contra el arco del riel, que es
%   la lectura de fabricacion (donde en la pieza pasa cada cosa), y contra
%   el tiempo del prototipo, que es la variable en la que la norma define
%   sus curvas (las duraciones de las Figs. 6 a 10 son de prototipo, y el
%   modelo las recorre sqrt(lambda) veces mas rapido). Comparar las bandas
%   normativas sobre un eje de arco es una lectura aproximada; la de tiempo
%   es la literal.

    Track = Elemento.Track;
    Sim   = Elemento.Sim;
    Parametros = Elemento.Parametros;
    Escala = Elemento.Diagnostico.Escala;

    Arco = Track.LongitudArco;
    % Tiempo del prototipo: el del modelo por sqrt(lambda_loop). Es el eje en
    % el que estan definidas las curvas de la norma.
    TiempoPrototipo = Sim.Tiempo * Escala.RaizLambdaLoop;
    % Opciones de dibujo de las bandas: grilla fina de LimitePorPunto (solo
    % para dibujar; la verificacion usa la suya) y el factor de seguridad, que
    % si es distinto de 1 agrega la linea punteada del objetivo de diseno.
    OpcionesDeBanda.NumeroDeNiveles   = 400;
    OpcionesDeBanda.FactorDeSeguridad = Parametros.FactorDeSeguridadNormativo;
    Colores = lines(max(numel(Track.SubTramos), 4));
    Figuras = gobjects(0);

    %% --- Trayectorias -----------------------------------------------------
    Figuras(end+1) = figure('Name', 'Trayectoria del elemento');

    subplot(2,2,1); hold on; grid on; axis equal
    DibujarPorSubTramo(Track, Colores, 1, 3);
    xlabel('x [m]'); ylabel('z [m]'); title('Vista lateral (X,Z)')
    legend([{Track.SubTramos.Nombre}, {'Heartline'}], 'Location', 'best', 'Interpreter', 'none')

    subplot(2,2,2); hold on; grid on; axis equal
    DibujarPorSubTramo(Track, Colores, 2, 3);
    xlabel('y [m]'); ylabel('z [m]'); title('Vista frontal (Y,Z)')

    subplot(2,2,3); hold on; grid on; axis equal
    DibujarPorSubTramo(Track, Colores, 1, 2);
    xlabel('x [m]'); ylabel('y [m]'); title('Vista en planta (X,Y)')

    subplot(2,2,4); hold on; grid on; axis equal; view(45, 20)
    for i = 1:numel(Track.SubTramos)
        Rango = RangoDelSubTramo(Track, i);
        plot3(Track.PuntosRiel(Rango,1), Track.PuntosRiel(Rango,2), Track.PuntosRiel(Rango,3), ...
              'Color', Colores(i,:), 'LineWidth', 2)
    end
    plot3(Track.PuntosHeartline(:,1), Track.PuntosHeartline(:,2), Track.PuntosHeartline(:,3), ...
          ':', 'Color', [0.45 0.45 0.45], 'LineWidth', 1)
    xlabel('x [m]'); ylabel('y [m]'); zlabel('z [m]')
    title('Trayectoria 3D -- llena: riel, punteada: heartline')

    %% --- Orientacion del carro sobre la trayectoria -----------------------
    % En figura aparte y a tamano completo: en el 2x2 las flechas quedan
    % ilegibles. Es la forma de ver hacia donde apunta el carro, que el numero
    % del angulo de roll no deja leer directamente.
    Figuras(end+1) = figure('Name', 'Orientacion del carro');
    hold on; grid on; axis equal; view(45, 20)
    for i = 1:numel(Track.SubTramos)
        Rango = RangoDelSubTramo(Track, i);
        plot3(Track.PuntosRiel(Rango,1), Track.PuntosRiel(Rango,2), Track.PuntosRiel(Rango,3), ...
              'Color', Colores(i,:), 'LineWidth', 2)
    end
    plot3(Track.PuntosHeartline(:,1), Track.PuntosHeartline(:,2), Track.PuntosHeartline(:,3), ...
          ':', 'Color', [0.45 0.45 0.45], 'LineWidth', 1)
    DibujarMarcoDelCarro(Track, Parametros);
    xlabel('x [m]'); ylabel('y [m]'); zlabel('z [m]')
    title({'Marco del carro sobre el riel: U (arriba, hacia la heartline) y L (lateral)', ...
           sprintf('Punteada: heartline, a %.0f mm del riel sobre U', 1000*Parametros.DistanciaHeartline)})

    %% --- Velocidad y aceleracion tangencial --------------------------------
    Figuras(end+1) = figure('Name', 'Velocidad y aceleracion tangencial');

    subplot(2,1,1)
    plot(Arco, Sim.VelocidadCentroDeMasa, 'LineWidth', 2); grid on; hold on
    plot(Arco, Sim.Velocidad, '--', 'LineWidth', 1);
    MarcarSubTramos(Track, Arco);
    legend('Centro de masa (heartline)', 'Punto del riel', 'Location', 'best')
    xlabel('Longitud recorrida sobre el riel [m]'); ylabel('Velocidad [m/s]')
    title('Velocidad sobre el elemento')

    subplot(2,1,2)
    plot(Arco, Sim.AceleracionTangencial, 'LineWidth', 2); grid on; hold on
    yline(0, 'k:');
    MarcarSubTramos(Track, Arco);
    xlabel('Longitud recorrida [m]'); ylabel('a_t [m/s^2]')
    title('Aceleracion tangencial')

    %% --- G por eje con banda normativa, contra arco y contra tiempo ---------
    % La misma figura dos veces, con distinto eje horizontal. La de arco es
    % la lectura de fabricacion; la de tiempo del prototipo es la variable de
    % la norma, y ahi las bandas se leen literalmente.
    FactorTiempo = Escala.RaizLambdaLoop;
    Figuras(end+1) = figure('Name', 'Fuerzas G con limites normativos (arco)');
    GraficarGPorEje(Arco, 'Longitud recorrida sobre el riel [m]', Sim, Track, ...
                    FactorTiempo, Reporte.Normativo.CurvaMasGzAplicada, OpcionesDeBanda);
    Figuras(end+1) = figure('Name', 'Fuerzas G con limites normativos (tiempo del prototipo)');
    GraficarGPorEje(TiempoPrototipo, 'Tiempo del prototipo [s]', Sim, Track, ...
                    FactorTiempo, Reporte.Normativo.CurvaMasGzAplicada, OpcionesDeBanda);

    %% --- Jerk con presupuesto de onset, contra arco y contra tiempo ---------
    % CONVENCION, una sola por figura y sin mezclar:
    %   - contra arco se dibuja el jerk DEL MODELO contra el presupuesto del
    %     modelo, Escala.OnsetMaximo = sqrt(lambda) x norma;
    %   - contra tiempo del prototipo se dibuja el jerk DEL PROTOTIPO, que es
    %     el del modelo dividido por sqrt(lambda), contra el numero literal de
    %     la norma, Parametros.OnsetNormativoPorEje.
    % Las dos comparaciones son la misma desigualdad escrita en unidades
    % distintas; lo que no se puede hacer es cruzarlas.
    Ejes = {'G_x', 'G_y', 'G_z'};
    JerkModelo = {Sim.JerkGx, Sim.JerkGy, Sim.JerkGz};

    Figuras(end+1) = figure('Name', 'Jerk y presupuesto de onset (arco, modelo)');
    for i = 1:3
        subplot(3,1,i)
        plot(Arco, JerkModelo{i}, 'LineWidth', 1.5); grid on; hold on
        yline( Escala.OnsetMaximo(i), 'r--', 'LineWidth', 1.5);
        yline(-Escala.OnsetMaximo(i), 'r--', 'LineWidth', 1.5);
        MarcarSubTramos(Track, Arco);
        ylabel(sprintf('d%s/dt [G/s]', Ejes{i}))
        title(sprintf('Jerk de %s DEL MODELO -- presupuesto del modelo %.1f G/s = sqrt(lambda) x %.1f G/s de la norma', ...
                      Ejes{i}, Escala.OnsetMaximo(i), Parametros.OnsetNormativoPorEje(i)))
    end
    xlabel('Longitud recorrida sobre el riel [m]')

    Figuras(end+1) = figure('Name', 'Jerk y presupuesto de onset (tiempo del prototipo)');
    for i = 1:3
        subplot(3,1,i)
        plot(TiempoPrototipo, JerkModelo{i} / Escala.RaizLambdaLoop, 'LineWidth', 1.5); grid on; hold on
        yline( Parametros.OnsetNormativoPorEje(i), 'r--', 'LineWidth', 1.5);
        yline(-Parametros.OnsetNormativoPorEje(i), 'r--', 'LineWidth', 1.5);
        MarcarSubTramos(Track, TiempoPrototipo);
        ylabel(sprintf('d%s/dt [G/s]', Ejes{i}))
        title(sprintf('Jerk de %s DEL PROTOTIPO (modelo / sqrt(lambda) = / %.2f) -- limite de la norma %.1f G/s', ...
                      Ejes{i}, Escala.RaizLambdaLoop, Parametros.OnsetNormativoPorEje(i)))
    end
    xlabel('Tiempo del prototipo [s]')

    %% --- Roll ---------------------------------------------------------------
    % Tres angulos que miden cosas distintas y conviene no confundir:
    %   phi      roll del carro contra el marco de transporte paralelo. En una
    %            curva plana (torsion nula) Bishop coincide con Frenet y phi
    %            es CONSTANTE; solo crece por la torsion que mete la
    %            inclinacion helicoidal, a razon dphi/dtheta = tan(alfa).
    %   peralte  inclinacion de U contra la vertical del plano que contiene a
    %            T. En un loop vale 0, salta a +-180 al invertirse y no esta
    %            definido con T vertical (NaN): es lo que se ve en la via.
    %   psi      angulo entre el vector curvatura y U, en el plano normal del
    %            carro: el desalineamiento entre "hacia donde apunta el
    %            pasajero" y "hacia donde esta el centro instantaneo de
    %            giro". En loop y dive loop es 0 salvo el sub-peralte que
    %            impone el modo normativo; en los giros es el complemento
    %            del peralte. Es el angulo fisicamente significativo para la G.
    Figuras(end+1) = figure('Name', 'Perfil de roll');
    subplot(2,1,1)
    plot(Arco, rad2deg(Track.AnguloRoll), 'LineWidth', 2); grid on; hold on
    plot(Arco, rad2deg(Track.AnguloPeralte), 'LineWidth', 2)
    plot(Arco, rad2deg(Track.AnguloCurvaturaDesdeArriba), 'LineWidth', 2)
    MarcarSubTramos(Track, Arco);
    ylabel('grados')
    legend('\phi: roll contra el marco de transporte (constante si la curva es plana; crece con la torsion helicoidal)', ...
           'Peralte: U contra la vertical del plano de T (lo que se ve en la via; \pm180 invertido; NaN con T vertical)', ...
           '\psi: vector curvatura contra U (0 = el pasajero mira al centro de giro; \neq 0 en giros peraltados y sub-peralte)', ...
           'Location', 'best')
    title({'Tres angulos, tres referencias: \phi contra el marco de transporte, peralte contra la vertical, \psi contra el vector curvatura', ...
           sprintf('Inclinacion helicoidal tan(\\alpha) = %.3f: es la pendiente d\\phi/d\\theta, lo unico que hace crecer a \\phi', ...
                   Track.InclinacionHelicoidal)})

    subplot(2,1,2)
    plot(Arco, rad2deg(Track.VelocidadRoll), 'LineWidth', 2); grid on; hold on
    plot(Arco, rad2deg(Track.AceleracionRoll), 'LineWidth', 1.5);
    MarcarSubTramos(Track, Arco);
    legend('d\phi/ds [grados/m]', 'd^2\phi/ds^2 [grados/m^2]', 'Location', 'best')
    xlabel('Longitud recorrida [m]')
    title(['Derivadas del roll -- entran en la G del pasajero por el brazo ' ...
           'respecto del riel (eje de roll), y dimensionan la transicion'])

    %% --- Radio de curvatura ------------------------------------------------
    % Las dos curvas tienen radios distintos y la diferencia es el punto de
    % todo el modelo de heartline: el del riel es el impuesto (curva
    % integrada) y se compara contra el limite de la impresora; el de la
    % heartline es el que recorre el pasajero y se compara contra el nominal.
    Figuras(end+1) = figure('Name', 'Radio de curvatura');
    Radio = 1 ./ max(Track.CurvaturaHeartline, eps);
    Radio(Track.CurvaturaHeartline < 1e-9) = NaN;   % tramo recto: radio infinito, no se dibuja
    RadioRiel = 1 ./ max(Track.Curvatura, eps);
    RadioRiel(Track.Curvatura < 1e-9) = NaN;
    semilogy(Arco, RadioRiel, 'LineWidth', 2); grid on; hold on
    semilogy(Arco, Radio, '--', 'LineWidth', 1.5);
    yline(Parametros.RadioMinimoFabricable, 'r--', 'LineWidth', 2);
    MarcarSubTramos(Track, Arco);
    xlabel('Longitud recorrida [m]'); ylabel('Radio de curvatura [m]')
    legend('Radio del riel', 'Radio del heartline', 'Radio minimo fabricable', 'Location', 'best')
    title('Radio de curvatura: riel contra heartline y contra el limite de fabricacion')
end

%% ========================= auxiliares =====================================
function Rango = RangoDelSubTramo(Track, Indice)
    Rango = Track.SubTramos(Indice).IndiceInicio : Track.SubTramos(Indice).IndiceFin;
end

function DibujarPorSubTramo(Track, Colores, EjeHorizontal, EjeVertical)
%DIBUJARPORSUBTRAMO Riel en linea llena y heartline en trazos finos.
%   El riel es la pieza que se fabrica, asi que es el que va destacado; el
%   heartline se dibuja al lado para que se vea cuanto se separan, que en las
%   partes de radio chico no es poco.
    for i = 1:numel(Track.SubTramos)
        Rango = RangoDelSubTramo(Track, i);
        plot(Track.PuntosRiel(Rango, EjeHorizontal), Track.PuntosRiel(Rango, EjeVertical), ...
             'Color', Colores(i,:), 'LineWidth', 2)
    end
    plot(Track.PuntosHeartline(:, EjeHorizontal), Track.PuntosHeartline(:, EjeVertical), ...
         ':', 'Color', [0.45 0.45 0.45], 'LineWidth', 1)
end

function MarcarSubTramos(Track, EjeHorizontal)
%MARCARSUBTRAMOS Lineas verticales en las fronteras de sub-tramo, sobre el
%   eje horizontal que use la figura (arco o tiempo): la frontera es un nodo,
%   y su abscisa es la de ese nodo en el eje elegido.
    for i = 1:numel(Track.SubTramos)-1
        xline(EjeHorizontal(Track.SubTramos(i).IndiceFin), 'k:', 'HandleVisibility', 'off');
    end
end

function DibujarMarcoDelCarro(Track, Parametros)
%DIBUJARMARCODELCARRO Flechas del marco del carro sobre la trayectoria.
%   Nacen en el RIEL, que es el eje de roll, y van a escala del dibujo: U es
%   la flecha larga y oscura, L la corta y clara. La separacion riel-heartline
%   no se lee de la flecha sino de la polilinea punteada de la heartline, que
%   la figura dibuja aparte; dibujar U con su longitud real (d = 30 mm) la
%   dejaba ilegible sin aportar nada que la punteada no muestre.

    NumeroDeNodos = size(Track.PuntosRiel, 1);
    Cantidad = min(Parametros.VersoresEnGrafico3D, NumeroDeNodos);
    Indices  = unique(round(linspace(1, NumeroDeNodos, Cantidad)));

    Extension = max(max(Track.PuntosRiel, [], 1) - min(Track.PuntosRiel, [], 1));
    Longitud  = 0.06 * Extension;

    Base = Track.PuntosRiel(Indices, :);
    Arriba  = Longitud     * Track.VersorArribaCarro(Indices, :);
    Lateral = 0.4*Longitud * Track.VersorLateral(Indices, :);

    quiver3(Base(:,1), Base(:,2), Base(:,3), Arriba(:,1), Arriba(:,2), Arriba(:,3), ...
            0, 'Color', [0.15 0.15 0.15], 'LineWidth', 1.1)
    quiver3(Base(:,1), Base(:,2), Base(:,3), Lateral(:,1), Lateral(:,2), Lateral(:,3), ...
            0, 'Color', [0.60 0.60 0.85], 'LineWidth', 0.8)
    legend([{Track.SubTramos.Nombre}, ...
            {sprintf('Heartline (riel + %.0f mm sobre U)', 1000*Parametros.DistanciaHeartline), ...
             'U: arriba del carro (a escala del dibujo)', 'L: lateral (a escala del dibujo)'}], ...
           'Location', 'best', 'Interpreter', 'none')
end

function GraficarGPorEje(EjeHorizontal, EtiquetaEje, Sim, Track, FactorTiempo, CurvaMasGz, Opciones)
%GRAFICARGPOREJE Los tres subplots de G con banda normativa, sobre el eje
%   horizontal que se le pase (arco del riel o tiempo del prototipo). La
%   banda se evalua siempre con Sim.Tiempo, que es lo que fija la duracion
%   de los eventos: el eje horizontal solo cambia contra que se dibuja.
    subplot(3,1,1)
    GraficarGConBanda(EjeHorizontal, Sim.Gx, Sim.Tiempo, FactorTiempo, 'MasGxBase', 'MenosGxBase', Track, Opciones);
    ylabel('G_x [G]'); title('G_x -- limites Figs. 6 y 7')

    subplot(3,1,2)
    GraficarGConBanda(EjeHorizontal, Sim.Gy, Sim.Tiempo, FactorTiempo, 'GyBase', 'GyBase', Track, Opciones);
    ylabel('G_y [G]'); title('G_y -- limite Fig. 8')

    subplot(3,1,3)
    GraficarGConBanda(EjeHorizontal, Sim.Gz, Sim.Tiempo, FactorTiempo, CurvaMasGz, 'MenosGzBase', Track, Opciones);
    ylabel('G_z [G]'); xlabel(EtiquetaEje)
    title(sprintf('G_z -- limites Figs. 9 y 10 (curva +G_z aplicada: %s)', CurvaMasGz))
end

function GraficarGConBanda(EjeHorizontal, G, Tiempo, FactorTiempo, CurvaPositiva, CurvaNegativa, Track, Opciones)
%GRAFICARGCONBANDA Superpone los limites normativos, que dependen de la
%   duracion del evento sostenido y por lo tanto NO son un escalar.
%
%   EjeHorizontal es el vector contra el que se dibuja (arco del riel o
%   tiempo del prototipo), del mismo largo que G. Tiempo es siempre el del
%   modelo, Sim.Tiempo: es lo que define la duracion de cada evento, y no
%   depende de contra que se grafique. Opciones.NumeroDeNiveles es la
%   resolucion de la escalera de LimitePorPunto, solo para dibujar, y
%   Opciones.FactorDeSeguridad agrega, si es distinto de 1, la linea
%   punteada del objetivo de diseno (limite / factor).
%
%   Se dibujan tres cosas distintas, que antes estaban colapsadas en una sola
%   linea y daban una lectura enganosa:
%
%     banda verde      entre los limites de evento largo. Lo que cae adentro es
%                      admisible dure lo que dure: es el piso de la curva.
%     lineas de trazos los limites a 200 ms, el techo de lo que la norma llega
%                      a admitir. Para +Gx la curva de la Fig. 6 va de 6.0 G a
%                      200 ms hasta 2.5 G en regimen: esas son las dos lineas.
%     linea roja llena el limite que efectivamente aplica en cada punto, con la
%                      duracion del evento sostenido que contiene a ese nodo.
%                      Solo existe donde la G tiene ese signo; si la senal nunca
%                      entra en ese lado no se dibuja, en vez de inventar un
%                      valor y hacerlo pasar por el limite aplicable.

    LimiteCortoSuperior =  abs(LimiteNormativo(CurvaPositiva, 0.2));
    LimiteCortoInferior = -abs(LimiteNormativo(CurvaNegativa, 0.2));
    LimiteLargoSuperior =  abs(LimiteNormativo(CurvaPositiva, 40));
    LimiteLargoInferior = -abs(LimiteNormativo(CurvaNegativa, 40));

    % min/max ignoran los NaN del tramo donde la marcha se quedo sin energia.
    Extremos = [min(EjeHorizontal), max(EjeHorizontal)];
    hold on; grid on

    fill([Extremos, fliplr(Extremos)], ...
         [LimiteLargoInferior LimiteLargoInferior LimiteLargoSuperior LimiteLargoSuperior], ...
         [0.88 0.94 0.88], 'EdgeColor', 'none', 'HandleVisibility', 'off')

    Trazos = gobjects(0);
    Etiquetas = {};

    Trazos(end+1) = plot(Extremos, [LimiteCortoSuperior LimiteCortoSuperior], 'r--', 'LineWidth', 1.2);
    Etiquetas{end+1} = sprintf('Limite a 200 ms (%+.1f / %+.1f G)', LimiteCortoSuperior, LimiteCortoInferior);
    plot(Extremos, [LimiteCortoInferior LimiteCortoInferior], 'r--', 'LineWidth', 1.2, 'HandleVisibility', 'off')

    LimiteAplicableSuperior = LimitePorPunto(G, Tiempo, CurvaPositiva, FactorTiempo, +1, Opciones.NumeroDeNiveles);
    LimiteAplicableInferior = LimitePorPunto(G, Tiempo, CurvaNegativa, FactorTiempo, -1, Opciones.NumeroDeNiveles);

    HayAplicable = false;
    if any(~isnan(LimiteAplicableSuperior))
        Trazos(end+1) = plot(EjeHorizontal, LimiteAplicableSuperior, 'r-', 'LineWidth', 1.6);
        HayAplicable = true;
    end
    if any(~isnan(LimiteAplicableInferior))
        if HayAplicable
            plot(EjeHorizontal, LimiteAplicableInferior, 'r-', 'LineWidth', 1.6, 'HandleVisibility', 'off')
        else
            Trazos(end+1) = plot(EjeHorizontal, LimiteAplicableInferior, 'r-', 'LineWidth', 1.6);
            HayAplicable = true;
        end
    end
    if HayAplicable
        Etiquetas{end+1} = 'Limite aplicable segun la duracion del evento';
    end

    % Con factor de seguridad distinto de 1, el objetivo de diseno del modo
    % normativo es el limite dividido por el factor: se dibuja punteado para
    % distinguirlo de la linea roja llena, que sigue siendo la norma literal.
    if Opciones.FactorDeSeguridad ~= 1
        if HayAplicable
            ObjetivoSuperior = LimiteAplicableSuperior / Opciones.FactorDeSeguridad;
            ObjetivoInferior = LimiteAplicableInferior / Opciones.FactorDeSeguridad;
        else
            ObjetivoSuperior = LimiteCortoSuperior / Opciones.FactorDeSeguridad * ones(size(G));
            ObjetivoInferior = LimiteCortoInferior / Opciones.FactorDeSeguridad * ones(size(G));
        end
        Trazos(end+1) = plot(EjeHorizontal, ObjetivoSuperior, ':', 'Color', [0.75 0.15 0.15], 'LineWidth', 1.4);
        plot(EjeHorizontal, ObjetivoInferior, ':', 'Color', [0.75 0.15 0.15], 'LineWidth', 1.4, 'HandleVisibility', 'off')
        Etiquetas{end+1} = sprintf('Objetivo de diseno: limite / FS %.2f', Opciones.FactorDeSeguridad);
    end

    Trazos(end+1) = plot(EjeHorizontal, G, 'LineWidth', 2);
    Etiquetas{end+1} = 'Valor calculado';

    yline(0, 'k:', 'HandleVisibility', 'off');
    MarcarSubTramos(Track, EjeHorizontal);
    legend(Trazos, Etiquetas, 'Location', 'best')
end
