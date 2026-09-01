%% Constructor de elementos de via -- demo del circuito encadenado
% Encadena los cuatro elementos: cada uno consume el estado que dejo el
% anterior. Es la demostracion del contrato de Estado, que es lo que permite
% seguir agregando elementos sin rediseniar nada.
%
% Para el detalle de un solo elemento (G contra la norma, jerk, roll, radios)
% esta DemoElemento.m.

clear; close all; clc
addpath(genpath(fullfile(fileparts(mfilename('fullpath')), 'GeneradorDeElementos')));

%% ===================== PARAMETROS DE ENTRADA =========================
Parametros = ParametrosPorDefecto();

Parametros.ModoCurvatura           = 'Clotoide';
Parametros.MetodoDeAcoplamiento    = 'A';
Parametros.CalcularVelocidadMinima = false;   % la biseccion no aporta aca y cuesta

Parametros.RadioDelLoop     = 0.30;
Parametros.RadioDelGiro     = 0.80;
Parametros.RadioDeLaHelice  = 0.70;
Parametros.RadioDelDiveLoop = 0.45;

% El circuito arranca alto: el dive loop del final baja casi un metro.
PosicionInicial  = [0, 0, 1.00];
TangenteInicial  = [1, 0, 0];
ArribaInicial    = [0, 0, 1];
VelocidadInicial = 4.50;

Secuencia = {@ElementoLoopVertical, @ElementoOverBankedTurn, @ElementoHelice, @ElementoDiveLoop};

%% ===================== ENCADENADO =====================================
Estado = EstadoInicial(PosicionInicial, TangenteInicial, ArribaInicial, VelocidadInicial, Parametros);
Layout = LayoutNuevo(Estado, Parametros);

fprintf('%-16s %9s %9s %9s %9s %9s %9s\n', ...
        'Elemento', 'L [m]', 'dz [m]', 'v sal', 'Gz max', 'Gy max', 'R min');
fprintf('%s\n', repmat('-', 1, 76));

for i = 1:numel(Secuencia)
    [Estado, Elemento, Reporte] = Secuencia{i}(Estado, Parametros, Layout);
    Layout = LayoutAgregarElemento(Layout, Elemento, Estado, Reporte);

    Resumen = Reporte.Resumen;
    NoPasan = sum(~[Reporte.Posteriores.Pasa]);
    fprintf('%-16s %9.3f %9.3f %9.3f %9.2f %9.2f %9.3f', Elemento.Nombre, ...
            Resumen.LongitudRecorrida, ...
            Elemento.Track.Puntos(end,3) - Elemento.Track.Puntos(1,3), ...
            Estado.Velocidad, Resumen.GzMaxima, Resumen.GyMaximaAbsoluta, Resumen.RadioMinimo);
    if NoPasan > 0
        fprintf('   <-- %d criterios no pasan', NoPasan);
    end
    fprintf('\n');
end

fprintf('\nVia total: %.3f m en %d elementos. Velocidad final %.3f m/s.\n', ...
        sum(vecnorm(diff(Layout.Puntos,1,1), 2, 2)), numel(Layout.Elementos), Estado.Velocidad);

%% ===================== REPORTE DEL ULTIMO ELEMENTO ====================
% El detalle completo de uno solo, para no llenar la consola con cuatro.
ReportarElemento(Reporte, Elemento);

%% ===================== GRAFICOS =======================================
GraficarLayout(Layout);

%% ===================== GUARDADO =======================================
LayoutGuardar(Layout, 'layout_circuito.mat');
