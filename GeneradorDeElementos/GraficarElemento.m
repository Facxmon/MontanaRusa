function Figuras = GraficarElemento(Elemento, Reporte)
%GRAFICARELEMENTO Graficos de salida del elemento.
%   Los sub-tramos se distinguen por color en las trayectorias y quedan
%   marcados con lineas verticales en los graficos contra distancia. Los
%   graficos de G llevan superpuesta la banda de limite normativo: una curva
%   desnuda no dice si el diseno pasa o no.

    Track = Elemento.Track;
    Sim   = Elemento.Sim;
    Parametros = Elemento.Parametros;
    Escala = Elemento.Diagnostico.Escala;

    Arco = Track.LongitudArco;
    Colores = lines(max(numel(Track.SubTramos), 4));
    Figuras = gobjects(0);

    %% --- Trayectorias -----------------------------------------------------
    Figuras(end+1) = figure('Name', 'Trayectoria del elemento');

    subplot(2,2,1); hold on; grid on; axis equal
    DibujarPorSubTramo(Track, Colores, 1, 3);
    xlabel('x [m]'); ylabel('z [m]'); title('Vista lateral (X,Z)')
    legend({Track.SubTramos.Nombre}, 'Location', 'best', 'Interpreter', 'none')

    subplot(2,2,2); hold on; grid on; axis equal
    DibujarPorSubTramo(Track, Colores, 2, 3);
    xlabel('y [m]'); ylabel('z [m]'); title('Vista frontal (Y,Z)')

    subplot(2,2,3); hold on; grid on; axis equal
    DibujarPorSubTramo(Track, Colores, 1, 2);
    xlabel('x [m]'); ylabel('y [m]'); title('Vista en planta (X,Y)')

    subplot(2,2,4); hold on; grid on; axis equal; view(45, 20)
    for i = 1:numel(Track.SubTramos)
        Rango = RangoDelSubTramo(Track, i);
        plot3(Track.Puntos(Rango,1), Track.Puntos(Rango,2), Track.Puntos(Rango,3), ...
              'Color', Colores(i,:), 'LineWidth', 2)
    end
    xlabel('x [m]'); ylabel('y [m]'); zlabel('z [m]'); title('Trayectoria 3D')

    %% --- Velocidad y aceleracion tangencial --------------------------------
    Figuras(end+1) = figure('Name', 'Velocidad y aceleracion tangencial');

    subplot(2,1,1)
    plot(Arco, Sim.Velocidad, 'LineWidth', 2); grid on; hold on
    MarcarSubTramos(Track);
    xlabel('Longitud recorrida [m]'); ylabel('Velocidad [m/s]')
    title('Velocidad sobre el elemento')

    subplot(2,1,2)
    plot(Arco, Sim.AceleracionTangencial, 'LineWidth', 2); grid on; hold on
    yline(0, 'k:');
    MarcarSubTramos(Track);
    xlabel('Longitud recorrida [m]'); ylabel('a_t [m/s^2]')
    title('Aceleracion tangencial')

    %% --- G por eje con banda normativa -------------------------------------
    Figuras(end+1) = figure('Name', 'Fuerzas G con limites normativos');
    FactorTiempo = Escala.RaizLambdaLoop;

    subplot(3,1,1)
    GraficarGConBanda(Arco, Sim.Gx, Sim.Tiempo, FactorTiempo, 'MasGxBase', 'MenosGxBase', Track);
    ylabel('G_x [G]'); title('G_x -- limites Figs. 6 y 7')

    subplot(3,1,2)
    GraficarGConBanda(Arco, Sim.Gy, Sim.Tiempo, FactorTiempo, 'GyBase', 'GyBase', Track);
    ylabel('G_y [G]'); title('G_y -- limite Fig. 8')

    subplot(3,1,3)
    GraficarGConBanda(Arco, Sim.Gz, Sim.Tiempo, FactorTiempo, ...
                      Reporte.Normativo.CurvaMasGzAplicada, 'MenosGzBase', Track);
    ylabel('G_z [G]'); xlabel('Longitud recorrida [m]')
    title(sprintf('G_z -- limites Figs. 9 y 10 (curva +G_z aplicada: %s)', ...
                  Reporte.Normativo.CurvaMasGzAplicada))

    %% --- Jerk con presupuesto de onset --------------------------------------
    Figuras(end+1) = figure('Name', 'Jerk y presupuesto de onset');
    Ejes = {'G_x', 'G_y', 'G_z'};
    Jerks = {Sim.JerkGx, Sim.JerkGy, Sim.JerkGz};
    for i = 1:3
        subplot(3,1,i)
        plot(Arco, Jerks{i}, 'LineWidth', 1.5); grid on; hold on
        yline( Escala.OnsetMaximo(i), 'r--', 'LineWidth', 1.5);
        yline(-Escala.OnsetMaximo(i), 'r--', 'LineWidth', 1.5);
        MarcarSubTramos(Track);
        ylabel(sprintf('dj/dt de %s [G/s]', Ejes{i}))
        title(sprintf('Jerk de %s -- presupuesto del modelo %.1f G/s = sqrt(lambda) x %.1f G/s', ...
                      Ejes{i}, Escala.OnsetMaximo(i), Parametros.OnsetNormativoPorEje(i)))
    end
    xlabel('Longitud recorrida [m]')

    %% --- Roll ---------------------------------------------------------------
    Figuras(end+1) = figure('Name', 'Perfil de roll');
    subplot(2,1,1)
    plot(Arco, rad2deg(Track.AnguloRoll), 'LineWidth', 2); grid on; hold on
    MarcarSubTramos(Track);
    ylabel('\phi [grados]'); title('Angulo de roll (smoothstep quintico en la transicion)')

    subplot(2,1,2)
    plot(Arco, rad2deg(Track.VelocidadRoll), 'LineWidth', 2); grid on; hold on
    plot(Arco, rad2deg(Track.AceleracionRoll), 'LineWidth', 1.5);
    MarcarSubTramos(Track);
    legend('d\phi/ds [grados/m]', 'd^2\phi/ds^2 [grados/m^2]', 'Location', 'best')
    xlabel('Longitud recorrida [m]')
    title('Derivadas del roll -- la G lateral de la heartline depende de la segunda')

    %% --- Radio de curvatura ------------------------------------------------
    Figuras(end+1) = figure('Name', 'Radio de curvatura');
    Radio = 1 ./ max(Track.Curvatura, eps);
    Radio(Track.Curvatura < 1e-9) = NaN;   % tramo recto: radio infinito, no se dibuja
    semilogy(Arco, Radio, 'LineWidth', 2); grid on; hold on
    yline(Parametros.RadioMinimoFabricable, 'r--', 'LineWidth', 2);
    MarcarSubTramos(Track);
    xlabel('Longitud recorrida [m]'); ylabel('Radio de curvatura [m]')
    legend('Radio de la via', 'Radio minimo fabricable', 'Location', 'best')
    title('Radio de curvatura contra el limite de fabricacion')
end

%% ========================= auxiliares =====================================
function Rango = RangoDelSubTramo(Track, Indice)
    Rango = Track.SubTramos(Indice).IndiceInicio : Track.SubTramos(Indice).IndiceFin;
end

function DibujarPorSubTramo(Track, Colores, EjeHorizontal, EjeVertical)
    for i = 1:numel(Track.SubTramos)
        Rango = RangoDelSubTramo(Track, i);
        plot(Track.Puntos(Rango, EjeHorizontal), Track.Puntos(Rango, EjeVertical), ...
             'Color', Colores(i,:), 'LineWidth', 2)
    end
end

function MarcarSubTramos(Track)
    for i = 1:numel(Track.SubTramos)-1
        xline(Track.LongitudArco(Track.SubTramos(i).IndiceFin), 'k:', 'HandleVisibility', 'off');
    end
end

function GraficarGConBanda(Arco, G, Tiempo, FactorTiempo, CurvaPositiva, CurvaNegativa, Track)
%GRAFICARGCONBANDA Superpone el limite aplicable punto a punto.
%   El limite depende de la duracion del evento sostenido, asi que no es una
%   recta: se evalua en cada nodo con la duracion de su propio evento.

    LimiteSuperior = LimitePorPunto(G, Tiempo, CurvaPositiva, FactorTiempo, +1);
    LimiteInferior = LimitePorPunto(G, Tiempo, CurvaNegativa, FactorTiempo, -1);

    % Donde la G nunca cruza ese signo el limite punto a punto no esta
    % definido. Se rellena con el limite evaluado en la duracion total del
    % elemento, que es el extremo mas restrictivo de la curva en ese rango.
    TiempoValido = Tiempo(~isnan(Tiempo));
    DuracionTotalReal = (TiempoValido(end) - TiempoValido(1)) * FactorTiempo;
    LimiteSuperior = RellenarHuecos(LimiteSuperior,  abs(LimiteNormativo(CurvaPositiva, DuracionTotalReal)));
    LimiteInferior = RellenarHuecos(LimiteInferior, -abs(LimiteNormativo(CurvaNegativa, DuracionTotalReal)));

    Valido = ~isnan(LimiteSuperior) & ~isnan(LimiteInferior) & ~isnan(Arco);
    hold on; grid on

    Trazos = gobjects(0);
    Etiquetas = {};
    if any(Valido)
        fill([Arco(Valido); flipud(Arco(Valido))], ...
             [LimiteSuperior(Valido); flipud(LimiteInferior(Valido))], ...
             [0.85 0.92 0.85], 'EdgeColor', 'none', 'HandleVisibility', 'off')
        Trazos(end+1) = plot(Arco, LimiteSuperior, 'r--', 'LineWidth', 1.2);
        Etiquetas{end+1} = 'Limite normativo aplicable';
        plot(Arco, LimiteInferior, 'r--', 'LineWidth', 1.2, 'HandleVisibility', 'off')
    end
    Trazos(end+1) = plot(Arco, G, 'LineWidth', 2);
    Etiquetas{end+1} = 'Valor calculado';

    yline(0, 'k:', 'HandleVisibility', 'off');
    MarcarSubTramos(Track);
    legend(Trazos, Etiquetas, 'Location', 'best')
end

function Valores = RellenarHuecos(Valores, ValorPorDefecto)
%RELLENARHUECOS Extiende el limite a los nodos donde el signo no aplica, para
%   que la banda se dibuje continua.
    Indices = find(~isnan(Valores));
    if isempty(Indices)
        Valores(:) = ValorPorDefecto;
        return
    end
    Valores = interp1(Indices, Valores(Indices), (1:numel(Valores)).', 'nearest', 'extrap');
    Valores(isnan(Valores)) = ValorPorDefecto;
end
