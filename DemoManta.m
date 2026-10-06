%% Manta de aceleraciones del tren -- demo
% G en cada punto del tren a lo largo de toda la via. X es el arco de la
% via; y es la posicion en el tren respecto de su centro, positiva hacia
% adelante. Para cada X, el punto y usa la geometria de la via en X y la
% velocidad que tiene el tren cuando su centro esta en X - y
% (MantaDeAceleraciones). La linea y = 0 es la del centro del tren.
%
% El circuito es el de DemoLayout, recorrido por un tren de varios carros.

clear; close all; clc
addpath(genpath(fullfile(fileparts(mfilename('fullpath')), 'GeneradorDeElementos')));

%% ===================== PARAMETROS DE ENTRADA =========================
Parametros = ParametrosPorDefecto();

Parametros.ModoCurvatura           = 'ArcoCircular';
Parametros.MetodoDeAcoplamiento    = 'A';
Parametros.CalcularVelocidadMinima = false;

Parametros.RadioDelLoop     = 0.30;
Parametros.RadioDelGiro     = 0.80;
Parametros.RadioDeLaHelice  = 0.70;
Parametros.RadioDelDiveLoop = 0.45;

% El tren. 'Particula' disena cada elemento con la masa puntual y sin
% redisenar para un carro (lo mas rapido); el tren recorre despues esa via.
Parametros.NumeroDeCarros = 4;
Parametros.DisenoDelTren  = 'Particula';

CantidadDePuntos = 41;   % grilla uniforme en y (se agregan los centros de carro)

PosicionInicial  = [0, 0, 1.00];
TangenteInicial  = [1, 0, 0];
ArribaInicial    = [0, 0, 1];
VelocidadInicial = 4.50;

Secuencia = {@ElementoLoopVertical, @ElementoOverBankedTurn, @ElementoHelice, @ElementoDiveLoop};

%% ===================== CIRCUITO =======================================
Estado = EstadoInicial(PosicionInicial, TangenteInicial, ArribaInicial, VelocidadInicial, Parametros);
Layout = LayoutNuevo(Estado, Parametros);
for i = 1:numel(Secuencia)
    [Estado, Elemento, Reporte] = Secuencia{i}(Estado, Parametros, Layout);
    Layout = LayoutAgregarElemento(Layout, Elemento, Estado, Reporte);
    fprintf('%-16s generado\n', Elemento.Nombre);
end

%% ===================== MANTA ==========================================
Manta = MantaDeAceleraciones(Layout, CantidadDePuntos);
GraficarManta(Manta);

fprintf('\nTren de %.3f m (%d carros); %d puntos de via por %d posiciones en el tren.\n', ...
        Manta.LargoTren, numel(Manta.PosicionDeCarros), numel(Manta.Arco), numel(Manta.Posicion));
fprintf('%-8s %8s %9s %9s   %8s %9s %9s   %s\n', ...
        '', 'max [G]', 'X [m]', 'y [m]', 'min [G]', 'X [m]', 'y [m]', 'mayor diferencia a lo largo del tren');
fprintf('%s\n', repmat('-', 1, 112));
Componentes = {'Gx', 'Gy', 'Gz', 'GModulo'};
for i = 1:numel(Componentes)
    Valores = Manta.(Componentes{i});
    [Maximo, IndiceMaximo] = max(Valores(:));
    [Minimo, IndiceMinimo] = min(Valores(:));
    [FilaMaximo, ColumnaMaximo] = ind2sub(size(Valores), IndiceMaximo);
    [FilaMinimo, ColumnaMinimo] = ind2sub(size(Valores), IndiceMinimo);
    % Cuanto cambia la G de punta a punta del tren en un mismo punto de la via.
    [Diferencia, FilaDiferencia] = max(max(Valores, [], 2) - min(Valores, [], 2));
    fprintf('%-8s %8.3f %9.3f %+9.3f   %8.3f %9.3f %+9.3f   %.3f G en X = %.3f m\n', Componentes{i}, ...
            Maximo, Manta.Arco(FilaMaximo), Manta.Posicion(ColumnaMaximo), ...
            Minimo, Manta.Arco(FilaMinimo), Manta.Posicion(ColumnaMinimo), ...
            Diferencia, Manta.Arco(FilaDiferencia));
end
