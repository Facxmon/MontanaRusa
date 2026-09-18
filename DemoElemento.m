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
Elegido = @ElementoLoopVertical;   % @ElementoLoopVertical | @ElementoHelice
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

% --- Parametros geometricos del elemento (ver ElementoXxx() sin argumentos) ---
% Cada elemento declara su propio parametro de radio (RadioDelLoop,
% RadioDelDiveLoop, RadioDeLaHelice, RadioDelGiro) y lo copia en
% Parametros.RadioDeReferencia antes de llamar a ConstruirElemento. Los
% demas parametros geometricos (separacion de patas, vueltas, peralte,
% avance, sentido) los lista cada elemento llamado sin argumentos.
%
% ADVERTENCIA sobre el radio. Solo en Clotoide es geometria: el radio que la
% heartline efectivamente toma en el arco. En los modos que dependen de v
% (FuerzaGConstante, GNormativaMaxima, AceleracionNormalConstante) el radio
% real es una SALIDA del transporte inverso, y este numero es unicamente la
% longitud caracteristica de Froude: fija lambda = RadioDeReferenciaReal/R, y
% con el sqrt(lambda), y con el TODAS las conversiones de duracion contra las
% curvas de la norma y TODO el presupuesto de onset. Editar el radio de un
% elemento que no es el elegido no da error -- AjustarParametros solo avisa --
% pero el elegido sigue usando su propio radio, y si ese esta lejos del que
% sale, los resultados normativos llevan un factor de escala equivocado.
% Conviene ponerlo cerca del que va a salir; el chequeo posterior "Radio
% alcanzado coherente con el nominal" avisa si se apartan mas de un 25 %.
Ajustes.RadioDelLoop = 0.14;   % [m] @ElementoLoopVertical: el que sale a 4.6 m/s en modo normativo (0.138 m)
% Ajustes.RadioDelDiveLoop = 0.45;   % [m] @ElementoDiveLoop
% Ajustes.RadioDeLaHelice  = 0.70;   % [m] @ElementoHelice
% Ajustes.RadioDelGiro     = 0.80;   % [m] @ElementoOverBankedTurn

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

% El mismo layout en el contrato del visualizador (CONTRATO_VISUALIZADOR.md).
LayoutAJson(Layout, 'layout_de_un_elemento.json');
