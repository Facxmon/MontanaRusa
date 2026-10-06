function Figuras = GraficarManta(Manta)
%GRAFICARMANTA Las mantas de aceleraciones del tren, una figura por magnitud.
%   Cuatro figuras: Gx, Gy, Gz y |G|, cada una una superficie sobre (X, y),
%   con X el arco de la via e y la posicion en el tren respecto de su centro
%   (MantaDeAceleraciones). Encima de cada una: la linea del centro del tren
%   (y = 0), la de cada carro con los datos que el layout ya tenia
%   (Manta.Carros, no la manta), un corte gris en cada empalme entre
%   elementos y el pico marcado.
%
%   Gx, Gy y Gz llevan un mapa divergente con el gris en 0: azul negativo,
%   rojo positivo y la misma intensidad por G de los dos lados, para que el
%   signo se lea (una Gz negativa es airtime). |G| lleva uno secuencial.

    Componentes = {
        'Gx',      'G_x longitudinal'
        'Gy',      'G_y lateral'
        'Gz',      'G_z vertical'
        'GModulo', '|G| modulo'};

    Figuras = gobjects(1, size(Componentes, 1));
    for i = 1:size(Componentes, 1)
        Figuras(i) = figure('Name', ['Manta de aceleraciones: ' Componentes{i,1}]);
        Ejes = axes(Figuras(i));
        hold(Ejes, 'on'); grid(Ejes, 'on')
        Valores = Manta.(Componentes{i,1});

        surf(Ejes, Manta.Arco, Manta.Posicion, Valores.', ...
             'EdgeColor', 'none', 'FaceColor', 'interp', 'HandleVisibility', 'off')
        Rango = [min(Valores, [], 'all', 'omitnan'), max(Valores, [], 'all', 'omitnan')];
        if Rango(2) - Rango(1) < 1e-6
            Rango = Rango + [-1 1]*1e-3;
        end
        if strcmp(Componentes{i,1}, 'GModulo')
            colormap(Ejes, MapaSecuencial(256));
        else
            colormap(Ejes, MapaDivergente(Rango, 256));
        end
        clim(Ejes, Rango)
        Barra = colorbar(Ejes);
        Barra.Label.String = [Componentes{i,2} ' [G]'];

        % Cortes en cada empalme entre elementos.
        for k = 1:numel(Manta.FilasDeEmpalmes)
            Fila = Manta.FilasDeEmpalmes(k);
            plot3(Ejes, repmat(Manta.Arco(Fila), size(Manta.Posicion)), Manta.Posicion, Valores(Fila, :), ...
                  'Color', [0.55 0.55 0.55], 'LineWidth', 0.8, 'HandleVisibility', 'off')
        end

        % Centro del tren, de la manta.
        Columna = Manta.ColumnaDelCentro;
        plot3(Ejes, Manta.Arco, repmat(Manta.Posicion(Columna), size(Manta.Arco)), Valores(:, Columna), ...
              'k', 'LineWidth', 1.8, 'DisplayName', 'Centro del tren (manta, y = 0)')

        % Cada carro con los datos que el layout ya tenia (no de la manta):
        % tienen que caer sobre la superficie. Rotulo al final de cada linea.
        Carros = Manta.Carros;
        DeLosCarros = Carros.(Componentes{i,1});
        for k = 1:numel(Carros.Numero)
            Visible = {'off', 'on'};
            plot3(Ejes, Manta.Arco, repmat(Carros.Posicion(k), size(Manta.Arco)), DeLosCarros(:, k), '--', ...
                  'Color', [0.15 0.15 0.15], 'LineWidth', 1.3, ...
                  'DisplayName', sprintf('Cada carro (%s)', Carros.Fuente), 'HandleVisibility', Visible{1 + (k == 1)})
            % Rotulo un poco mas alla del final de la via, fuera de la
            % superficie, para que no quede tapado.
            Ultimo = find(~isnan(DeLosCarros(:, k)), 1, 'last');
            text(Ejes, Manta.Arco(end) + 0.02*(Manta.Arco(end) - Manta.Arco(1)), Carros.Posicion(k), ...
                 DeLosCarros(Ultimo, k), sprintf('carro %d', Carros.Numero(k)), 'FontSize', 8, 'Clipping', 'off')
        end

        % Pico: el valor de mayor modulo de la manta.
        [~, Indice] = max(abs(Valores(:)));
        [Fila, Columna] = ind2sub(size(Valores), Indice);
        plot3(Ejes, Manta.Arco(Fila), Manta.Posicion(Columna), Valores(Indice), 'ko', ...
              'MarkerFaceColor', 'w', 'MarkerSize', 7, 'HandleVisibility', 'off')
        text(Ejes, Manta.Arco(Fila), Manta.Posicion(Columna), Valores(Indice), ...
             {sprintf('  %.2f G', Valores(Indice)), sprintf('  X = %.2f m, y = %+.3f m', Manta.Arco(Fila), Manta.Posicion(Columna))}, ...
             'FontSize', 9, 'VerticalAlignment', 'bottom')

        % La via es mucho mas larga que el tren: se estira X en la caja para
        % que la manta no quede como una pared.
        axis(Ejes, 'tight')
        pbaspect(Ejes, [3 1 1])
        view(Ejes, -20, 40)
        xlabel(Ejes, 'X en la via [m]')
        ylabel(Ejes, 'y en el tren [m]')
        zlabel(Ejes, [Componentes{i,2} ' [G]'])
        title(Ejes, sprintf('%s -- tren de %.3f m, %d carro(s), brazo %.3f m', ...
              Componentes{i,2}, Manta.LargoTren, numel(Manta.PosicionDeCarros), Manta.Brazo))
        subtitle(Ejes, ['y > 0 hacia el frente del tren. Empalmes en gris entre: ' ...
                 strjoin(Manta.NombresDeElementos, ' | ')], 'Interpreter', 'none')
        legend(Ejes, 'Location', 'southoutside', 'Orientation', 'horizontal')
    end
end

%% ========================= auxiliares =====================================
function Mapa = MapaDivergente(Rango, Cantidad)
%MAPADIVERGENTE Gris en 0, azul hacia negativo y rojo hacia positivo.
%   La intensidad depende de |G| sobre el mayor modulo del rango, asi que
%   con limites asimetricos el lado corto no llega al color extremo: la
%   misma G pesa lo mismo de los dos lados.
    Gris = [240 239 236]/255;
    Azul = [57 135 229; 24 79 149]/255;    % pasos 400 y 600 de la rampa azul
    Rojo = [227 73 72; 143 36 35]/255;
    Valores = linspace(Rango(1), Rango(2), Cantidad).';
    Intensidad = abs(Valores) / max(abs(Rango));
    Mapa = zeros(Cantidad, 3);
    Negativos = Valores < 0;
    Mapa(Negativos, :)  = interp1([0 0.5 1], [Gris; Azul], Intensidad(Negativos));
    Mapa(~Negativos, :) = interp1([0 0.5 1], [Gris; Rojo], Intensidad(~Negativos));
end

function Mapa = MapaSecuencial(Cantidad)
%MAPASECUENCIAL Un solo tono, de claro (poco) a oscuro (mucho).
    Pasos = [205 226 251; 109 167 236; 42 120 214; 24 79 149; 13 54 107]/255;
    Mapa = interp1(linspace(0, 1, size(Pasos, 1)), Pasos, linspace(0, 1, Cantidad).');
end
