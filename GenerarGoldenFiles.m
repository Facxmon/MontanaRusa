%% Golden files del contrato del visualizador
% Genera golden/<caso>.json para los once casos canonicos de la seccion 8 de
% CONTRATO_VISUALIZADOR.md: diez elementos sueltos (cada elemento en Clotoide y
% en GNormativaMaxima, y el loop ademas en FuerzaGConstante y en
% AceleracionNormalConstante) mas el circuito de DemoLayout.m. Se versionan en
% el repo y son el arnes de validacion del port a JS: el nucleo porteado tiene
% que reproducir estos archivos campo por campo, con las tolerancias de la
% seccion 8 del contrato.
%
% Setup de los diez casos de un elemento, comun a todos para que lo unico que
% cambie entre archivos sea el elemento y el modo (salvo el giro del OBT):
%   - ParametrosPorDefecto con RadioDelLoop = 0.30 (el ParametrosBase de
%     TestsValidacion y el radio de DemoLayout), metodo A, sin biseccion de
%     velocidad minima;
%   - estado de entrada sintetico: riel en [0 0 1], a nivel, carro derecho, a
%     5.0 m/s. Se eligio midiendo: a 6.0 m/s (test 12) las transiciones del
%     dive loop en Clotoide dejan un arco de 8 nodos, y a 4.6 m/s (DemoElemento)
%     el loop normativo no cierra el giro con RadioDelLoop = 0.30. A 5.0 los
%     diez casos tienen arco principal y ninguno se queda sin energia;
%   - el over-banked turn gira 240 grados en vez de los 120 por defecto, en
%     los dos modos: con 120 las rampas consumen todo el giro en modo
%     normativo y el arco queda vacio (mismo motivo que en el test 12).
% No todos los criterios pasan en todos los casos: el loop de 0.30 m en
% Clotoide supera los 6 G de la Fig. 10 y varios elementos salen del bounding
% box arrancando en z = 1. Es a proposito -- un golden file con criterios que
% fallan verifica que el port tambien los haga fallar, y el veredicto `pasa`
% se compara sin tolerancia.
%
% Al final corre el validador de esquema (esquema/validar-layout.js) si node
% esta disponible.

clear; clc
Raiz = fileparts(mfilename('fullpath'));
addpath(genpath(fullfile(Raiz, 'GeneradorDeElementos')));

CarpetaGolden = fullfile(Raiz, 'golden');
if ~isfolder(CarpetaGolden)
    mkdir(CarpetaGolden);
end

%% ===================== CASOS DE UN ELEMENTO ===========================
VelocidadDeEntrada = 5.0;    % [m/s]
PosicionDeEntrada  = [0, 0, 1.00];

% Columnas: nombre del archivo, constructor, modo de curvatura, ajustes propios.
SinAjustes = struct();
GiroDelOBT = struct('AnguloDelGiro', deg2rad(240));
Casos = { ...
    'loop-clotoide',     @ElementoLoopVertical,   'Clotoide',                   SinAjustes; ...
    'loop-gconstante',   @ElementoLoopVertical,   'FuerzaGConstante',           SinAjustes; ...
    'loop-normativa',    @ElementoLoopVertical,   'GNormativaMaxima',           SinAjustes; ...
    'loop-anconstante',  @ElementoLoopVertical,   'AceleracionNormalConstante', SinAjustes; ...
    'helice-clotoide',   @ElementoHelice,         'Clotoide',                   SinAjustes; ...
    'helice-normativa',  @ElementoHelice,         'GNormativaMaxima',           SinAjustes; ...
    'obt-clotoide',      @ElementoOverBankedTurn, 'Clotoide',                   GiroDelOBT; ...
    'obt-normativa',     @ElementoOverBankedTurn, 'GNormativaMaxima',           GiroDelOBT; ...
    'diveloop-clotoide', @ElementoDiveLoop,       'Clotoide',                   SinAjustes; ...
    'diveloop-normativa',@ElementoDiveLoop,       'GNormativaMaxima',           SinAjustes};

fprintf('%-20s %-15s %-27s %6s %8s %8s %s\n', 'Caso', 'Elemento', 'Modo', 'nodos', 'Gz max', 'bytes', 'criterios');
fprintf('%s\n', repmat('-', 1, 100));

Archivos = cell(size(Casos, 1) + 1, 1);
for i = 1:size(Casos, 1)
    Parametros = ParametrosPorDefecto();
    Parametros.RadioDelLoop            = 0.30;
    Parametros.MetodoDeAcoplamiento    = 'A';
    Parametros.CalcularVelocidadMinima = false;
    Parametros.ModoCurvatura           = Casos{i, 3};
    Parametros = AjustarParametros(Parametros, Casos{i, 4}, Casos{i, 2});

    Estado = EstadoInicial(PosicionDeEntrada, [1 0 0], [0 0 1], VelocidadDeEntrada, Parametros);
    Layout = LayoutNuevo(Estado, Parametros);
    [Estado, Elemento, Reporte] = Casos{i, 2}(Estado, Parametros, Layout);
    Layout = LayoutAgregarElemento(Layout, Elemento, Estado, Reporte);

    Archivos{i} = fullfile(CarpetaGolden, [Casos{i, 1} '.json']);
    Documento = LayoutAJson(Layout, Archivos{i});
    ImprimirFila(Casos{i, 1}, Elemento.Nombre, Casos{i, 3}, Documento, Archivos{i});
end

%% ===================== CIRCUITO DE DEMOLAYOUT ==========================
% Espejo exacto del setup de DemoLayout.m. Si cambia alla, cambia aca.
Parametros = ParametrosPorDefecto();
Parametros.ModoCurvatura           = 'Clotoide';
Parametros.MetodoDeAcoplamiento    = 'A';
Parametros.CalcularVelocidadMinima = false;
Parametros.RadioDelLoop     = 0.30;
Parametros.RadioDelGiro     = 0.80;
Parametros.RadioDeLaHelice  = 0.70;
Parametros.RadioDelDiveLoop = 0.45;

Secuencia = {@ElementoLoopVertical, @ElementoOverBankedTurn, @ElementoHelice, @ElementoDiveLoop};
Estado = EstadoInicial([0, 0, 1.00], [1, 0, 0], [0, 0, 1], 4.50, Parametros);
Layout = LayoutNuevo(Estado, Parametros);
for i = 1:numel(Secuencia)
    [Estado, Elemento, Reporte] = Secuencia{i}(Estado, Parametros, Layout);
    Layout = LayoutAgregarElemento(Layout, Elemento, Estado, Reporte);
end

Archivos{end} = fullfile(CarpetaGolden, 'circuito-demolayout.json');
Documento = LayoutAJson(Layout, Archivos{end});
ImprimirFila('circuito-demolayout', 'los cuatro', 'Clotoide', Documento, Archivos{end});

%% ===================== VALIDACION ======================================
Validador = fullfile(Raiz, 'esquema', 'validar-layout.js');
[SinNode, ~] = system('node --version');
if SinNode ~= 0
    fprintf('\nnode no esta en el PATH: validar a mano con  node esquema/validar-layout.js golden\n');
else
    fprintf('\n');
    [Fallo, Salida] = system(sprintf('node "%s" "%s"', Validador, CarpetaGolden));
    fprintf('%s', Salida);
    if Fallo ~= 0
        error('GenerarGoldenFiles:NoValidan', 'Algun golden file no valida contra el esquema.');
    end
end

%% ========================= auxiliares =================================
function ImprimirFila(Caso, Elemento, Modo, Documento, Archivo)
    Info = dir(Archivo);
    NoPasan = 0;
    Nodos = 0;
    for k = 1:numel(Documento.elementos)
        Criterios = Documento.elementos{k}.criterios;
        Pasan = cellfun(@(c) c.pasa, [Criterios.previos, Criterios.posteriores]);
        NoPasan = NoPasan + sum(~Pasan);
        Nodos = Nodos + double(Documento.elementos{k}.nodos.numeroDeNodos);
    end
    fprintf('%-20s %-15s %-27s %6d %8.2f %8d %s\n', Caso, Elemento, Modo, Nodos, ...
            Documento.resumenLayout.gzMaximaGlobal, Info.bytes, DescribirCriterios(NoPasan));
end

function Texto = DescribirCriterios(NoPasan)
    if NoPasan == 0
        Texto = 'todos pasan';
    else
        Texto = sprintf('%d no pasan', NoPasan);
    end
end
