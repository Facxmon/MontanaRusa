%% Constructor de elementos de via -- demo del loop vertical
% Genera un loop vertical a partir de un estado de entrada, lo verifica
% contra los criterios de aceptacion, grafica los resultados y compara los
% dos metodos de acoplamiento geometria-dinamica.
%
% La documentacion de los criterios esta en memoria_de_calculo.md y la del
% analisis energetico previo en documentacion_analisis_energia.md.

clear; close all; clc
addpath(fullfile(fileparts(mfilename('fullpath')), 'GeneradorDeElementos'));

%% ===================== PARAMETROS DE ENTRADA =========================
% El bloque completo, con las unidades y las marcas de "sin cerrar", vive en
% ParametrosPorDefecto. Aca solo se sobrescribe lo propio de este caso.
Parametros = ParametrosPorDefecto();

Parametros.ModoCurvatura          = 'FuerzaGConstante';   % 'Clotoide' | 'FuerzaGConstante' | 'AceleracionNormalConstante' | 'GMaximas'
% 'A' marcha acoplada (rapido) | 'B' punto fijo (~3 veces mas lento) |
% 'Ambos' corre los dos y reporta la comparacion, para el reporte del proyecto.
Parametros.MetodoDeAcoplamiento   = 'A';
Parametros.FuerzaGObjetivo        = 3.00;         % [G] G neta incluida la gravedad, constante en el arco
Parametros.GMinimaCuspide         = 0.50;         % [G]

% RadioLoop es la longitud caracteristica de Froude: fija lambda_loop, el
% presupuesto de onset y la conversion de duraciones contra las curvas de la
% norma. En los modos que dependen de v el radio de cuspide es una SALIDA, asi
% que hay que ponerlo cerca del que va a salir; el reporte avisa si se aparta.
Parametros.RadioLoop              = 0.11;         % [m]

% Estado de entrada del elemento: via a nivel, carro derecho.
PosicionInicial   = [0, 0, 0.20];   % [m]
TangenteInicial   = [1, 0, 0];
ArribaInicial     = [0, 0, 1];
VelocidadInicial  = 4.60;           % [m/s]

%% ===================== GENERACION Y VERIFICACION ======================
Estado = EstadoInicial(PosicionInicial, TangenteInicial, ArribaInicial, VelocidadInicial, Parametros);
Layout = LayoutNuevo(Estado, Parametros);

[EstadoSalida, Elemento, Reporte] = ElementoLoopVertical(Estado, Parametros, Layout);
ReportarElemento(Reporte, Elemento);

Layout = LayoutAgregarElemento(Layout, Elemento, EstadoSalida, Reporte);

%% ===================== ESTADO PARA EL ELEMENTO SIGUIENTE ==============
fprintf('\n--- Estado de salida (entrada del elemento siguiente) ---\n');
disp(EstadoSalida);

%% ===================== GRAFICOS =======================================
GraficarElemento(Elemento, Reporte);

%% ===================== GUARDADO DEL LAYOUT ===========================
LayoutGuardar(Layout, 'layout_loop_vertical.mat');
