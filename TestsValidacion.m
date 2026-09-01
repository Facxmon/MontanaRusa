%% Tests de validacion del constructor de elementos de via
% Ejecutables, no comentarios. Corre con:  run('TestsValidacion.m')
% Termina con error si alguno falla, para poder usarlo en verificacion
% automatica. Todo pasa por la API publica de los elementos, para que lo que se
% verifica sea el mismo camino que usa el usuario.

clear; clc
addpath(genpath(fullfile(fileparts(mfilename('fullpath')), 'GeneradorDeElementos')));

Resultados = struct('Nombre', {}, 'Pasa', {}, 'Detalle', {});

ParametrosBase = ParametrosPorDefecto();
ParametrosBase.RadioDelLoop = 0.30;
ParametrosBase.CalcularVelocidadMinima = false;
VelocidadDeEnsayo = 4.60;

EstadoDeEnsayo = @(Parametros) EstadoInicial([0 0 0.20], [1 0 0], [0 0 1], VelocidadDeEnsayo, Parametros);

fprintf('=====================================================================\n');
fprintf(' Tests de validacion\n');
fprintf('=====================================================================\n');

%% --- Test 1: conservacion de energia ---------------------------------
% Sin resistencia y con loop circular, v^2 tiene que valer exactamente
% v_0^2 - 2*g*h en todo punto.
Parametros = ParametrosBase;
Parametros.CrrPortantes = 0; Parametros.CrrGuia = 0; Parametros.CrrRetencion = 0;
Parametros.ModelarArrastre = false;
Parametros.ModoCurvatura = 'Clotoide';

Estado = EstadoDeEnsayo(Parametros);
[~, Elemento] = ElementoLoopVertical(Estado, Parametros);
Track = Elemento.Track;  Sim = Elemento.Sim;

AlturaRelativa = Track.Puntos(:,3) - Track.Puntos(1,3);
VelocidadAnalitica = sqrt(Estado.Velocidad^2 - 2*Parametros.Gravedad*AlturaRelativa);
ErrorRelativo = max(abs(Sim.Velocidad.^2 - VelocidadAnalitica.^2) ./ VelocidadAnalitica.^2);

Resultados = Anotar(Resultados, 'Conservacion de energia sin perdidas', ErrorRelativo < 1e-6, ...
    sprintf('error relativo maximo en v^2 = %.3e (limite 1e-6)', ErrorRelativo));

%% --- Test 2: curvatura impuesta contra curvatura recuperada -----------
% Se recupera la curvatura de la polilinea con la circunferencia que pasa por
% cada punto y sus dos vecinos, y se compara contra la impuesta al generar.
Parametros = ParametrosBase;
Parametros.ModoCurvatura = 'FuerzaGConstante';
Estado = EstadoDeEnsayo(Parametros);
[~, Elemento] = ElementoLoopVertical(Estado, Parametros);
Track = Elemento.Track;

CurvaturaRecuperada = CurvaturaDiscretaDePolilinea(Track.Puntos);
Interiores = (2:size(Track.Puntos,1)-1).';

% Se excluyen los nodos cuyo esquema de 3 puntos cruza una frontera de
% sub-tramo: ahi dkappa/ds salta y la circunferencia por 3 puntos devuelve un
% promedio de dos curvaturas distintas. Es una limitacion del estimador
% discreto, no un error de la geometria generada.
CruzaFrontera = false(size(Track.Puntos,1), 1);
for k = 1:numel(Track.SubTramos)-1
    Frontera = Track.SubTramos(k).IndiceFin;
    CruzaFrontera(max(1,Frontera-1):min(end,Frontera+2)) = true;
end

Comparables = Interiores(Track.Curvatura(Interiores) > 0.1 & ~CruzaFrontera(Interiores));
ErrorCurvatura = max(abs(CurvaturaRecuperada(Comparables) - Track.Curvatura(Comparables)) ...
                     ./ Track.Curvatura(Comparables));

Resultados = Anotar(Resultados, 'Curvatura impuesta contra recuperada', ErrorCurvatura < 1e-3, ...
    sprintf('error relativo maximo = %.3e sobre %d nodos, fronteras de sub-tramo excluidas (limite 1e-3)', ...
            ErrorCurvatura, numel(Comparables)));

%% --- Test 3: residual del endpoint ------------------------------------
% El punto de entrada NO es el endpoint esperado: con clotoides de entrada y
% salida de distinta longitud el loop no vuelve a su propio arranque. Lo que
% si tiene que cerrar es la direccion de la tangente tras la vuelta completa.
% El avance sobre el eje tampoco es un residual: es el objetivo de diseno que
% evita que el loop se choque consigo mismo.
Parametros = ParametrosBase;
Parametros.ModoCurvatura = 'Clotoide';
Estado = EstadoDeEnsayo(Parametros);
[~, Elemento, Reporte] = ElementoLoopVertical(Estado, Parametros);
Track = Elemento.Track;

ResidualTangente = norm(Track.VersorTangente(end,:) - Track.VersorTangente(1,:));
ErrorDesplazamiento = abs(Reporte.Resumen.DesplazamientoLateral - Parametros.SeparacionDePatas) ...
                      / Parametros.SeparacionDePatas;

Resultados = Anotar(Resultados, 'Residual del endpoint', ...
    ResidualTangente < 1e-3 && ErrorDesplazamiento < 0.05, ...
    sprintf('tangente %.3e, avance sobre el eje %.4f m contra objetivo %.4f m (%.2f %%), posicion final [%.5f %.5f %.5f]', ...
            ResidualTangente, Reporte.Resumen.DesplazamientoLateral, Parametros.SeparacionDePatas, ...
            100*ErrorDesplazamiento, Track.Puntos(end,:)));

%% --- Test 4: continuidad en el empalme ---------------------------------
SaltoPosicion  = norm(Track.Puntos(1,:)          - Estado.Posicion);
SaltoTangente  = norm(Track.VersorTangente(1,:)  - Estado.VersorTangente);
SaltoCurvatura = norm(Track.VectorCurvatura(1,:) - Estado.VectorCurvatura);

Resultados = Anotar(Resultados, 'Continuidad en el empalme', ...
    SaltoPosicion < 1e-12 && SaltoTangente < 1e-12 && SaltoCurvatura < 1e-12, ...
    sprintf('posicion %.3e m, tangente %.3e, curvatura %.3e 1/m', ...
            SaltoPosicion, SaltoTangente, SaltoCurvatura));

%% --- Test 5: equivalencia de los metodos en modo clotoide --------------
% En modo Clotoide kappa no depende de v, y las longitudes de las clotoides se
% dimensionan con la velocidad real de la marcha y no con el perfil supuesto,
% asi que la geometria no depende en nada del perfil supuesto: los dos metodos
% tienen que dar exactamente lo mismo, no parecido.
Parametros = ParametrosBase;
Parametros.ModoCurvatura = 'Clotoide';
Parametros.MetodoDeAcoplamiento = 'Ambos';
Estado = EstadoDeEnsayo(Parametros);
[~, ~, ReporteAmbos] = ElementoLoopVertical(Estado, Parametros);
Comparacion = ReporteAmbos.Comparacion;

Resultados = Anotar(Resultados, 'Equivalencia de metodos A y B en modo clotoide', ...
    Comparacion.DiferenciaGeometrica < 1e-12 && Comparacion.DiferenciaGz < 1e-12, ...
    sprintf('geometria %.3e m, Gz %.3e G, %d iteraciones del punto fijo (residuo %.2e m/s)', ...
            Comparacion.DiferenciaGeometrica, Comparacion.DiferenciaGz, ...
            Comparacion.IteracionesMetodoB, Comparacion.ResiduoMetodoB));

%% --- Test 6: ortonormalidad del marco ---------------------------------
T = Track.VersorTangente; U = Track.VersorArribaCarro; L = Track.VersorLateral;
ErrorOrtonormalidad = max([ max(abs(vecnorm(T,2,2) - 1)), ...
                           max(abs(vecnorm(U,2,2) - 1)), ...
                           max(abs(vecnorm(L,2,2) - 1)), ...
                           max(abs(sum(T.*U, 2))), ...
                           max(abs(sum(T.*L, 2))), ...
                           max(abs(sum(U.*L, 2))), ...
                           max(vecnorm(cross(T, U, 2) - L, 2, 2)) ]);

Resultados = Anotar(Resultados, 'Ortonormalidad del marco a lo largo del recorrido', ...
    ErrorOrtonormalidad < 1e-9, sprintf('desvio maximo = %.3e (limite 1e-9)', ErrorOrtonormalidad));

%% --- Test 7: cierre del loop ------------------------------------------
Parametros = ParametrosBase;
Parametros.CrrPortantes = 0; Parametros.CrrGuia = 0; Parametros.CrrRetencion = 0;
Parametros.ModelarArrastre = false;
Parametros.ModoCurvatura = 'Clotoide';
Parametros.PasoGeneracion = 0.001;

Estado = EstadoDeEnsayo(Parametros);
[~, ElementoFino] = ElementoLoopVertical(Estado, Parametros);
TrackFino = ElementoFino.Track;

PitchInicial = asin(TrackFino.VersorTangente(1,3));
PitchFinal   = asin(TrackFino.VersorTangente(end,3));
AnguloTotal  = TrackFino.AnguloGirado(end);

% Con el loop helicoidal la tangente no gira 2*pi sino 2*pi*cos(alfa): recorre
% un circulo de radio cos(alfa) sobre la esfera unitaria, porque mantiene un
% angulo constante con el eje de la helice. Que ese numero salga sirve de
% verificacion independiente de la construccion helicoidal.
AnguloEsperado = 2*pi*cos(atan(TrackFino.InclinacionHelicoidal));

Resultados = Anotar(Resultados, 'Cierre del loop de 360 grados', ...
    abs(PitchFinal - PitchInicial) < 1e-4 && abs(AnguloTotal - AnguloEsperado) < 1e-3, ...
    sprintf('pitch inicial %.3e rad, final %.3e rad, angulo girado %.6f rad contra 2*pi*cos(alfa) = %.6f', ...
            PitchInicial, PitchFinal, AnguloTotal, AnguloEsperado));

%% --- Test 8: los cuatro elementos generan y encadenan -------------------
% Cada elemento consume el estado del anterior. Se verifica que los cuatro
% cierran su giro objetivo y que el empalme con el siguiente no tiene saltos:
% ese contrato es lo que sostiene todo el layout.
Parametros = ParametrosBase;
Parametros.ModoCurvatura = 'Clotoide';

Constructores = {@ElementoLoopVertical, @ElementoOverBankedTurn, @ElementoHelice, @ElementoDiveLoop};
Estado = EstadoInicial([0 0 0.70], [1 0 0], [0 0 1], 6.0, Parametros);
LayoutDePrueba = LayoutNuevo(Estado, Parametros);

PeorResidual = 0;
PeorSalto    = 0;
Detalles     = {};
for i = 1:numel(Constructores)
    EstadoPrevio = Estado;
    [Estado, ElementoEncadenado, ReporteEncadenado] = Constructores{i}(EstadoPrevio, Parametros, LayoutDePrueba);
    LayoutDePrueba = LayoutAgregarElemento(LayoutDePrueba, ElementoEncadenado, Estado, ReporteEncadenado);

    Salto = norm(ElementoEncadenado.Track.Puntos(1,:) - EstadoPrevio.Posicion) ...
          + norm(ElementoEncadenado.Track.VersorTangente(1,:) - EstadoPrevio.VersorTangente);
    PeorResidual = max(PeorResidual, abs(ReporteEncadenado.Resumen.ResidualCierrePitch));
    PeorSalto    = max(PeorSalto, Salto);
    Detalles{end+1} = sprintf('%s %.0f grados', ElementoEncadenado.Nombre, ...
        rad2deg(ElementoEncadenado.Receta.GiroObjetivo)); %#ok<SAGROW>
end

Resultados = Anotar(Resultados, 'Los cuatro elementos generan y encadenan', ...
    PeorResidual < 1e-3 && PeorSalto < 1e-12 && ~isnan(Estado.Velocidad), ...
    sprintf('%s | peor residual de cierre %.2e rad, peor salto de empalme %.2e, v final %.3f m/s', ...
            strjoin(Detalles, ', '), PeorResidual, PeorSalto, Estado.Velocidad));

%% --- Resumen ----------------------------------------------------------
fprintf('\n');
NoPasan = 0;
for i = 1:numel(Resultados)
    if Resultados(i).Pasa
        Estado_ = 'PASA ';
    else
        Estado_ = 'FALLA';
        NoPasan = NoPasan + 1;
    end
    fprintf(' [%s] %d. %s\n', Estado_, i, Resultados(i).Nombre);
    fprintf('         %s\n', Resultados(i).Detalle);
end

fprintf('\n %d de %d tests pasan.\n', numel(Resultados) - NoPasan, numel(Resultados));
if NoPasan > 0
    error('TestsValidacion:Fallaron', '%d tests no pasan.', NoPasan);
end

%% ========================= auxiliares =================================
function Resultados = Anotar(Resultados, Nombre, Pasa, Detalle)
    Resultados(end+1) = struct('Nombre', Nombre, 'Pasa', logical(Pasa), 'Detalle', Detalle);
end

function Curvatura = CurvaturaDiscretaDePolilinea(Puntos)
%CURVATURADISCRETADEPOLILINEA Circunferencia que pasa por cada punto interior
%   y sus dos vecinos, R = a*b*c/(4*Area). Es la misma estimacion que usa
%   analisis_energia.m, aca en el rol de test de validacion contra la
%   curvatura impuesta al generar -- que es exactamente el uso para el que
%   sirve, porque la formula se degrada cuando el paso es chico y la via casi
%   recta.

    Anterior  = Puntos(1:end-2, :);
    Actual    = Puntos(2:end-1, :);
    Siguiente = Puntos(3:end,   :);

    LadoA = vecnorm(Actual    - Anterior, 2, 2);
    LadoB = vecnorm(Siguiente - Actual,   2, 2);
    LadoC = vecnorm(Siguiente - Anterior, 2, 2);
    Area  = 0.5*vecnorm(cross(Actual - Anterior, Siguiente - Anterior, 2), 2, 2);

    Curvatura = nan(size(Puntos,1), 1);
    Curvatura(2:end-1) = 4*Area ./ (LadoA .* LadoB .* LadoC);
end
