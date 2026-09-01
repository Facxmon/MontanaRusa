function Figuras = GraficarLayout(Layout)
%GRAFICARLAYOUT Circuito completo, con un color por elemento.
%   Para el detalle de un elemento (G, jerk, roll, radios) esta
%   GraficarElemento; esto es la vista de conjunto.

    Colores = lines(max(numel(Layout.Elementos), 4));
    Figuras = gobjects(0);

    %% --- Vista 3D con la orientacion del carro ---------------------------
    Figuras(end+1) = figure('Name', 'Layout completo');
    hold on; grid on; axis equal; view(40, 22)

    % Se dibuja el RIEL: es la geometria que se fabrica y sobre la que se
    % chequea la interferencia. El heartline va punteado de referencia.
    Etiquetas = cell(1, numel(Layout.Elementos));
    for i = 1:numel(Layout.Elementos)
        Elemento = Layout.Elementos{i}.Elemento;
        Track = Elemento.Track;
        plot3(Track.PuntosRiel(:,1), Track.PuntosRiel(:,2), Track.PuntosRiel(:,3), ...
              'Color', Colores(i,:), 'LineWidth', 2)
        Etiquetas{i} = sprintf('%d. %s', i, Elemento.Nombre);
    end

    for i = 1:numel(Layout.Elementos)
        Track = Layout.Elementos{i}.Elemento.Track;
        Indices = unique(round(linspace(1, size(Track.PuntosRiel,1), ...
                        Layout.Parametros.VersoresEnGrafico3D)));
        Arriba = Layout.Parametros.DistanciaHeartline * Track.VersorArribaCarro(Indices,:);
        quiver3(Track.PuntosRiel(Indices,1), Track.PuntosRiel(Indices,2), Track.PuntosRiel(Indices,3), ...
                Arriba(:,1), Arriba(:,2), Arriba(:,3), 0, ...
                'Color', [0.2 0.2 0.2], 'LineWidth', 0.8, 'HandleVisibility', 'off')
    end

    for i = 1:numel(Layout.Elementos)
        Track = Layout.Elementos{i}.Elemento.Track;
        plot3(Track.PuntosHeartline(:,1), Track.PuntosHeartline(:,2), Track.PuntosHeartline(:,3), ...
              ':', 'Color', [0.45 0.45 0.45], 'LineWidth', 1, 'HandleVisibility', 'off')
    end

    plot3(Layout.PuntosRiel(1,1), Layout.PuntosRiel(1,2), Layout.PuntosRiel(1,3), 'ko', ...
          'MarkerFaceColor', 'g', 'MarkerSize', 8, 'DisplayName', 'Inicio')
    plot3(Layout.PuntosRiel(end,1), Layout.PuntosRiel(end,2), Layout.PuntosRiel(end,3), 'ko', ...
          'MarkerFaceColor', 'r', 'MarkerSize', 8, 'DisplayName', 'Fin')

    legend([Etiquetas, {'Inicio', 'Fin'}], 'Location', 'best', 'Interpreter', 'none')
    xlabel('x [m]'); ylabel('y [m]'); zlabel('z [m]')
    title('Circuito completo (riel) y orientacion del carro')

    %% --- Velocidad y G a lo largo del circuito ---------------------------
    Figuras(end+1) = figure('Name', 'Circuito: velocidad y G');

    subplot(2,1,1); hold on; grid on
    subplot(2,1,2); hold on; grid on
    for i = 1:numel(Layout.Elementos)
        Track = Layout.Elementos{i}.Elemento.Track;
        Sim   = Layout.Elementos{i}.Elemento.Sim;
        subplot(2,1,1)
        plot(Track.LongitudArco, Sim.Velocidad, 'Color', Colores(i,:), 'LineWidth', 2)
        subplot(2,1,2)
        plot(Track.LongitudArco, Sim.Gz, 'Color', Colores(i,:), 'LineWidth', 2)
    end

    subplot(2,1,1)
    ylabel('Velocidad [m/s]'); title('Velocidad sobre el circuito')
    legend(Etiquetas, 'Location', 'best', 'Interpreter', 'none')
    subplot(2,1,2)
    yline(0, 'k:'); xlabel('Longitud recorrida [m]'); ylabel('G_z [G]')
    title('G vertical del pasajero sobre el circuito')
end
