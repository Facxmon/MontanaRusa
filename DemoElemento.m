%% Constructor de elementos de via -- demo de UN elemento
% Genera UN elemento a partir de un estado de entrada, lo verifica contra los
% criterios de aceptacion y grafica los resultados. Para ver los cuatro
% elementos encadenados en un circuito, correr DemoLayout.m.
%
% ESTADO DE ENTRADA. Por defecto es SINTETICO: via a nivel, carro derecho,
% sin curvatura, a la velocidad que se pide abajo. Es deliberado: esta demo
% aisla un elemento para leer sus G, su jerk, su roll y sus radios sin que
% dependan de lo que vino antes, y por eso no carga ningun layout. Si lo que
% se quiere es ver el elemento a continuacion de una via ya construida, se
% le da a ArchivoLayoutPrevio un .mat guardado por LayoutGuardar (por
% ejemplo el layout_circuito.mat de DemoLayout): el elemento arranca del
% estado de salida de ese layout y el chequeo de interferencia lo ve. El
% encadenado sistematico sigue estando en DemoLayout.m.
%
% PARAMETROS. Viven en ParametrosPorDefecto, en tres bloques: los del modo
% de curvatura, los geometricos de cada elemento y los criterios de
% aceptacion. Aca se sobrescriben solo los propios de este caso, en un
% struct aparte, y AjustarParametros avisa si alguno no lo consume ni el
% modo ni el elemento elegidos (cargar RadioDelLoop con el dive loop, o
% FuerzaGObjetivo en modo normativo, no hace nada). DescribirParametros
% imprime los tres grupos con unidades antes de generar.
%
% La documentacion del generador esta en documentacion_generador_elementos.md,
% los criterios de diseno en memoria_de_calculo.md y el analisis energetico
% previo en documentacion_analisis_energia.md.

clear; close all; clc
addpath(genpath(fullfile(fileparts(mfilename('fullpath')), 'GeneradorDeElementos')));

%% ===================== ELECCION ======================================
% Cual de los cuatro elementos se genera y con que modo de curvatura.
Elegido = @ElementoDiveLoop;   % @ElementoLoopVertical | @ElementoHelice
                               % @ElementoOverBankedTurn | @ElementoDiveLoop

Parametros = ParametrosPorDefecto();
Parametros.ModoCurvatura        = 'GNormativaMaxima';   % 'Clotoide' | 'FuerzaGConstante' | 'AceleracionNormalConstante' | 'GNormativaMaxima'
Parametros.MetodoDeAcoplamiento = 'A';                  % 'A' rapido | 'B' punto fijo (~3x) | 'Ambos' compara, para el reporte

%% ===================== AJUSTES DE ESTE CASO ==========================
% Solo lo que se cambia respecto de ParametrosPorDefecto. Un campo que el
% modo o el elemento elegidos no consumen dispara un aviso.

% --- Parametros del modo de curvatura (ver ParametrosDelModo) ---
% En GNormativaMaxima no hay ninguno: la curva de la norma la trae la Receta
% del elemento. Descomentar si se cambia de modo:
% Ajustes.FuerzaGObjetivo           = 3.00;   % [G]     solo FuerzaGConstante
% Ajustes.AceleracionNormalObjetivo = 20;     % [m/s^2] solo AceleracionNormalConstante

% --- Parametros geometricos del elemento (ver ElementoDiveLoop() sin argumentos) ---
% El radio cumple dos roles. En Clotoide es el radio de la heartline en el
% arco. En los modos que dependen de v (FuerzaGConstante, GNormativaMaxima,
% AceleracionNormalConstante) el radio real de cuspide es una SALIDA que
% resuelve el transporte inverso, y este numero es solo la longitud
% caracteristica de Froude: fija lambda, el presupuesto de onset y la
% conversion de duraciones contra la norma. Conviene ponerlo cerca del que va
% a salir; el chequeo posterior avisa si se apartan mas de un 25 %.
Ajustes.RadioDelDiveLoop = 0.45;   % [m]

% --- Criterios de aceptacion (ver ParametrosDeAceptacion) ---
Ajustes.GMinimaCuspide = 0.50;   % [G] holgura de Gz en la cuspide; vale en todos los modos

Parametros = AjustarParametros(Parametros, Ajustes, Elegido);
DescribirParametros(Parametros, Elegido);

%% ===================== ESTADO DE ENTRADA =============================
% Vacio: estado sintetico (abajo). Con un archivo: arranca del estado de
% salida del layout guardado ahi y encadena sobre su via.
ArchivoLayoutPrevio = '';   % por ejemplo 'layout_circuito.mat'

if isempty(ArchivoLayoutPrevio)
    % Sintetico: via a nivel, carro derecho. La posicion es la del RIEL; el
    % pasajero queda DistanciaHeartline mas arriba. La velocidad es la del
    % centro de masa.
    PosicionInicial  = [0, 0, 1.00];   % [m]
    TangenteInicial  = [1, 0, 0];
    ArribaInicial    = [0, 0, 1];
    VelocidadInicial = 4.60;           % [m/s]

    Estado = EstadoInicial(PosicionInicial, TangenteInicial, ArribaInicial, VelocidadInicial, Parametros);
    Layout = LayoutNuevo(Estado, Parametros);
else
    Layout = LayoutCargar(ArchivoLayoutPrevio);
    Layout.Parametros = Parametros;
    Estado = Layout.EstadoActual;
    fprintf('\nArrancando desde %s: %d elementos previos, v = %.3f m/s en [%.3f %.3f %.3f].\n', ...
            ArchivoLayoutPrevio, numel(Layout.Elementos), Estado.Velocidad, Estado.Posicion);
end

%% ===================== GENERACION Y VERIFICACION ======================
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
