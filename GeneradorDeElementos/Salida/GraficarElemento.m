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

    %% --- Orientacion del carro sobre la trayectoria -----------------------
    % En figura aparte y a tamano completo: en el 2x2 las flechas quedan
    % ilegibles. Es la forma de ver hacia donde apunta el carro, que el numero
    % del angulo de roll no deja leer directamente.
    Figuras(end+1) = figure('Name', 'Orientacion del carro');
    hold on; grid on; axis equal; view(45, 20)
    for i = 1:numel(Track.SubTramos)
        Rango = RangoDelSubTramo(Track, i);
        plot3(Track.Puntos(Rango,1), Track.Puntos(Rango,2), Track.Puntos(Rango,3), ...
              'Color', Colores(i,:), 'LineWidth', 2)
    end
    DibujarMarcoDelCarro(Track, Parametros);
    xlabel('x [m]'); ylabel('y [m]'); zlabel('z [m]')
    title('Marco del carro: U de asiento a cabeza, L lateral')

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
    plot(Arco, rad2deg(Track.AnguloPeralte), 'LineWidth', 2)
    MarcarSubTramos(Track);
    ylabel('grados')
    legend('\phi contra el marco de transporte', 'Peralte contra la vertical', 'Location', 'best')
    title(['Angulo de roll. Los dos miden lo mismo contra referencias distintas: ' ...
           '\phi crece porque el marco de transporte gira, el peralte es lo que se ve en la via'])

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

function DibujarMarcoDelCarro(Track, Parametros)
%DIBUJARMARCODELCARRO Flechas del marco del carro sobre la trayectoria.
%   U es el eje del asiento a la cabeza del pasajero y L el lateral. Sirve
%   para ver de un vistazo hacia donde apunta el carro, que es lo que el
%   numero del angulo de roll no deja leer directamente.

    NumeroDeNodos = size(Track.Puntos, 1);
    Cantidad = min(Parametros.VersoresEnGrafico3D, NumeroDeNodos);
    Indices  = unique(round(linspace(1, NumeroDeNodos, Cantidad)));

    Extension = max(max(Track.Puntos, [], 1) - min(Track.Puntos, [], 1));
    Longitud  = 0.06 * Extension;

    Base = Track.Puntos(Indices, :);
    Arriba  = Longitud * Track.VersorArribaCarro(Indices, :);
    Lateral = Longitud * Track.VersorLateral(Indices, :);

    quiver3(Base(:,1), Base(:,2), Base(:,3), Arriba(:,1), Arriba(:,2), Arriba(:,3), ...
            0, 'Color', [0.15 0.15 0.15], 'LineWidth', 1.1)
    quiver3(Base(:,1), Base(:,2), Base(:,3), Lateral(:,1), Lateral(:,2), Lateral(:,3), ...
            0, 'Color', [0.60 0.60 0.85], 'LineWidth', 0.8)
    legend([{Track.SubTramos.Nombre}, {'U: arriba del carro', 'L: lateral'}], ...
           'Location', 'best', 'Interpreter', 'none')
end

function GraficarGConBanda(Arco, G, Tiempo, FactorTiempo, CurvaPositiva, CurvaNegativa, Track)
%GRAFICARGCONBANDA Superpone los limites normativos, que dependen de la
%   duracion del evento sostenido y por lo tanto NO son un escalar.
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

    Extremos = [Arco(1), Arco(end)];
    hold on; grid on

    fill([Extremos, fliplr(Extremos)], ...
         [LimiteLargoInferior LimiteLargoInferior LimiteLargoSuperior LimiteLargoSuperior], ...
         [0.88 0.94 0.88], 'EdgeColor', 'none', 'HandleVisibility', 'off')

    Trazos = gobjects(0);
    Etiquetas = {};

    Trazos(end+1) = plot(Extremos, [LimiteCortoSuperior LimiteCortoSuperior], 'r--', 'LineWidth', 1.2);
    Etiquetas{end+1} = sprintf('Limite a 200 ms (%+.1f / %+.1f G)', LimiteCortoSuperior, LimiteCortoInferior);
    plot(Extremos, [LimiteCortoInferior LimiteCortoInferior], 'r--', 'LineWidth', 1.2, 'HandleVisibility', 'off')

    LimiteAplicableSuperior = LimitePorPunto(G, Tiempo, CurvaPositiva, FactorTiempo, +1);
    LimiteAplicableInferior = LimitePorPunto(G, Tiempo, CurvaNegativa, FactorTiempo, -1);

    HayAplicable = false;
    if any(~isnan(LimiteAplicableSuperior))
        Trazos(end+1) = plot(Arco, LimiteAplicableSuperior, 'r-', 'LineWidth', 1.6);
        HayAplicable = true;
    end
    if any(~isnan(LimiteAplicableInferior))
        if HayAplicable
            plot(Arco, LimiteAplicableInferior, 'r-', 'LineWidth', 1.6, 'HandleVisibility', 'off')
        else
            Trazos(end+1) = plot(Arco, LimiteAplicableInferior, 'r-', 'LineWidth', 1.6);
            HayAplicable = true;
        end
    end
    if HayAplicable
        Etiquetas{end+1} = 'Limite aplicable segun la duracion del evento';
    end

    Trazos(end+1) = plot(Arco, G, 'LineWidth', 2);
    Etiquetas{end+1} = 'Valor calculado';

    yline(0, 'k:', 'HandleVisibility', 'off');
    MarcarSubTramos(Track);
    legend(Trazos, Etiquetas, 'Location', 'best')
end
