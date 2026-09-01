%% Constructor de elementos de via -- demo de un elemento
% Genera UN elemento a partir de un estado de entrada, lo verifica contra los
% criterios de aceptacion y grafica los resultados. Para ver los cuatro
% elementos encadenados en un circuito, correr DemoLayout.m.
%
% La documentacion del generador esta en documentacion_generador_elementos.md,
% los criterios de diseno en memoria_de_calculo.md y el analisis energetico
% previo en documentacion_analisis_energia.md.

clear; close all; clc
addpath(genpath(fullfile(fileparts(mfilename('fullpath')), 'GeneradorDeElementos')));

%% ===================== PARAMETROS DE ENTRADA =========================
% El bloque completo, con las unidades y las marcas de "sin cerrar", vive en
% ParametrosPorDefecto. Aca solo se sobrescribe lo propio de este caso.
Parametros = ParametrosPorDefecto();

% Cual de los cuatro elementos se genera.
Elegido = @ElementoLoopVertical;   % @ElementoLoopVertical | @ElementoHelice
                                   % @ElementoOverBankedTurn | @ElementoDiveLoop

Parametros.ModoCurvatura          = 'FuerzaGConstante';   % 'Clotoide' | 'FuerzaGConstante' | 'AceleracionNormalConstante' | 'GMaximas'
% 'A' marcha acoplada (rapido) | 'B' punto fijo (~3 veces mas lento) |
% 'Ambos' corre los dos y reporta la comparacion, para el reporte del proyecto.
Parametros.MetodoDeAcoplamiento   = 'A';
Parametros.FuerzaGObjetivo        = 3.00;         % [G] G neta incluida la gravedad, constante en el arco
Parametros.GMinimaCuspide         = 0.50;         % [G]

% El radio es ademas la longitud caracteristica de Froude del elemento: fija
% lambda, el presupuesto de onset y la conversion de duraciones contra las
% curvas de la norma. En los modos que dependen de v el radio de cuspide es una
% SALIDA, asi que hay que ponerlo cerca del que va a salir; el reporte avisa.
Parametros.RadioDelLoop           = 0.11;         % [m] radio de cuspide

% Estado de entrada del elemento: via a nivel, carro derecho.
PosicionInicial   = [0, 0, 0.20];   % [m]
TangenteInicial   = [1, 0, 0];
ArribaInicial     = [0, 0, 1];
VelocidadInicial  = 4.60;           % [m/s]

%% ===================== GENERACION Y VERIFICACION ======================
Estado = EstadoInicial(PosicionInicial, TangenteInicial, ArribaInicial, VelocidadInicial, Parametros);
Layout = LayoutNuevo(Estado, Parametros);

[EstadoSalida, Elemento, Reporte] = Elegido(Estado, Parametros, Layout);
ReportarElemento(Reporte, Elemento);

Layout = LayoutAgregarElemento(Layout, Elemento, EstadoSalida, Reporte);

%% ===================== ESTADO PARA EL ELEMENTO SIGUIENTE ==============
fprintf('\n--- Estado de salida (entrada del elemento siguiente) ---\n');
disp(EstadoSalida);

%% ===================== GRAFICOS =======================================
GraficarElemento(Elemento, Reporte);

%% ===================== GUARDADO DEL LAYOUT ===========================
LayoutGuardar(Layout, 'layout_de_un_elemento.mat');
