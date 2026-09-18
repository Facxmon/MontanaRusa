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
% v_0^2 - 2*g*h en todo punto. La energia es la del CENTRO DE MASA: v es la
% velocidad del centro de masa y h la altura de la heartline, no del riel.
Parametros = ParametrosBase;
Parametros.CrrPortantes = 0; Parametros.CrrGuia = 0; Parametros.CrrRetencion = 0;
Parametros.ModelarArrastre = false;
Parametros.ModoCurvatura = 'Clotoide';

Estado = EstadoDeEnsayo(Parametros);
[~, Elemento] = ElementoLoopVertical(Estado, Parametros);
Track = Elemento.Track;  Sim = Elemento.Sim;

AlturaRelativa = Track.PuntosHeartline(:,3) - Track.PuntosHeartline(1,3);
VelocidadAnalitica = sqrt(Estado.Velocidad^2 - 2*Parametros.Gravedad*AlturaRelativa);
ErrorRelativo = max(abs(Sim.VelocidadCentroDeMasa.^2 - VelocidadAnalitica.^2) ./ VelocidadAnalitica.^2);

Resultados = Anotar(Resultados, 'Conservacion de energia sin perdidas', ErrorRelativo < 1e-6, ...
    sprintf('error relativo maximo en v^2 = %.3e (limite 1e-6)', ErrorRelativo));

%% --- Test 2: curvatura impuesta contra curvatura recuperada -----------
% Se recupera la curvatura de la polilinea con la circunferencia que pasa por
% cada punto y sus dos vecinos, y se compara contra la impuesta al generar.
% La curva integrada es el riel, asi que es sobre el riel que la curvatura
% impuesta tiene que reaparecer.
Parametros = ParametrosBase;
Parametros.ModoCurvatura = 'FuerzaGConstante';
Estado = EstadoDeEnsayo(Parametros);
[~, Elemento] = ElementoLoopVertical(Estado, Parametros);
Track = Elemento.Track;

CurvaturaRecuperada = CurvaturaDiscretaDePolilinea(Track.PuntosRiel);
Interiores = (2:size(Track.PuntosRiel,1)-1).';

% Se excluyen los nodos cuyo esquema de 3 puntos cruza una frontera de
% sub-tramo: ahi d2kappa/ds2 salta (dkappa/ds es continua desde que las
% rampas son smoothstep) y la circunferencia por 3 puntos devuelve un
% promedio de dos curvaturas distintas. Es una limitacion del estimador
% discreto, no un error de la geometria generada. El error del estimador
% es de orden h^2*d2kappa/ds2, y en los extremos de las rampas suaves
% d2kappa/ds2 es maxima justo donde kappa es chica: por eso el error
% relativo maximo es del orden de 1e-3 y no de 1e-5 como con rampas
% lineales (d2kappa/ds2 = 0).
CruzaFrontera = false(size(Track.PuntosRiel,1), 1);
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
            100*ErrorDesplazamiento, Track.PuntosRiel(end,:)));

%% --- Test 4: continuidad en el empalme ---------------------------------
SaltoPosicion  = norm(Track.PuntosRiel(1,:)              - Estado.Posicion);
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

    Salto = norm(ElementoEncadenado.Track.PuntosRiel(1,:) - EstadoPrevio.Posicion) ...
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

%% --- Test 9: derivacion de la heartline a partir del riel ---------------
% La curva que se integra es el riel; la heartline es r_riel + d*U. Se
% verifican las dos cosas que esa construccion tiene que cumplir:
%   1. la separacion entre las dos curvas vale d en TODO nodo, exacto;
%   2. la heartline queda del lado de ADENTRO de la curva, o sea con radio
%      menor. En el loop el centro de curvatura esta del lado de +U, la
%      heartline esta d mas cerca de ese centro, y entonces
%      R_heartline = R_riel - d. Ese es exactamente el efecto que motiva el
%      transporte inverso de los modos de curvatura: dimensionar el riel para
%      la G del riel dejaria al pasajero recorriendo un radio d mas chico.
Parametros = ParametrosBase;
Parametros.ModoCurvatura = 'Clotoide';
Estado = EstadoDeEnsayo(Parametros);
[~, ElementoRiel] = ElementoLoopVertical(Estado, Parametros);
TrackRiel = ElementoRiel.Track;

Separacion = vecnorm(TrackRiel.PuntosHeartline - TrackRiel.PuntosRiel, 2, 2);
ErrorSeparacion = max(abs(Separacion - Parametros.DistanciaHeartline));

% Se mide sobre el arco principal y lejos de sus bordes: en las clotoides la
% curvatura esta rampeando y el estimador por diferencias de la heartline
% arrastra el mismo efecto de frontera que el test 2.
IndiceArco = find(strcmp({TrackRiel.SubTramos.Nombre}, 'ArcoPrincipal'), 1);
RangoArco  = TrackRiel.SubTramos(IndiceArco).IndiceInicio : TrackRiel.SubTramos(IndiceArco).IndiceFin;
Margen     = round(0.10*numel(RangoArco));
RangoArco  = RangoArco(1+Margen : end-Margen);

RadioDelRiel   = 1 ./ TrackRiel.Curvatura(RangoArco);
RadioHeartline = 1 ./ TrackRiel.CurvaturaHeartline(RangoArco);
DiferenciaDeRadios = RadioDelRiel - RadioHeartline;
ErrorDiferencia = max(abs(DiferenciaDeRadios - Parametros.DistanciaHeartline)) ...
                  / Parametros.DistanciaHeartline;

Resultados = Anotar(Resultados, 'Derivacion de la heartline desde el riel', ...
    ErrorSeparacion < 1e-12 && all(DiferenciaDeRadios > 0) && ErrorDiferencia < 0.15, ...
    sprintf(['separacion constante con error %.3e m (limite 1e-12); ' ...
             'R_riel - R_heartline = %.4f m contra d = %.4f m esperado (%.1f %% de desvio)'], ...
            ErrorSeparacion, mean(DiferenciaDeRadios), Parametros.DistanciaHeartline, ...
            100*ErrorDiferencia));

%% --- Test 10: transporte de cuerpo rigido desde el riel -----------------
% Dos cosas en un solo test, porque son las dos caras del mismo criterio:
%   1. con brazo nulo el transporte tiene que reducirse EXACTAMENTE a la G
%      del punto del riel, v^2*ku/g + Uz. Es la verificacion de que la
%      formula general no introdujo nada espurio;
%   2. con brazo real la rotacion tiene que aportar de verdad. El riel es el
%      eje de roll y el pasajero va a distancia d: si el aporte diera cero,
%      el modelo estaria diciendo que rolear no se siente, que es falso.
Parametros = ParametrosBase;
Parametros.ModoCurvatura = 'Clotoide';

ParametrosSinBrazo = Parametros;
ParametrosSinBrazo.DistanciaHeartline        = 0;
ParametrosSinBrazo.DistanciaHeartlineACabeza = 0;
Estado = EstadoDeEnsayo(ParametrosSinBrazo);
[~, ElementoSinBrazo] = ElementoOverBankedTurn(Estado, ParametrosSinBrazo);
SimSinBrazo = ElementoSinBrazo.Sim;  TrackSinBrazo = ElementoSinBrazo.Track;

GzDelRiel = SimSinBrazo.Velocidad.^2 .* sum(TrackSinBrazo.VectorCurvatura .* TrackSinBrazo.VersorArribaCarro, 2) ...
            / Parametros.Gravedad + TrackSinBrazo.VersorArribaCarro(:,3);
GyDelRiel = SimSinBrazo.Velocidad.^2 .* sum(TrackSinBrazo.VectorCurvatura .* TrackSinBrazo.VersorLateral, 2) ...
            / Parametros.Gravedad + TrackSinBrazo.VersorLateral(:,3);
ErrorReduccion = max([ max(abs(SimSinBrazo.Gz - GzDelRiel)), max(abs(SimSinBrazo.Gy - GyDelRiel)) ]);

% El over-banked turn rola 110 grados mientras curva: es el caso donde el
% aporte de rotacion no puede ser despreciable.
Estado = EstadoDeEnsayo(Parametros);
[~, ElementoConBrazo] = ElementoOverBankedTurn(Estado, Parametros);
SimConBrazo = ElementoConBrazo.Sim;  TrackConBrazo = ElementoConBrazo.Track;

GzDelRiel = SimConBrazo.Velocidad.^2 .* sum(TrackConBrazo.VectorCurvatura .* TrackConBrazo.VersorArribaCarro, 2) ...
            / Parametros.Gravedad + TrackConBrazo.VersorArribaCarro(:,3);
GyDelRiel = SimConBrazo.Velocidad.^2 .* sum(TrackConBrazo.VectorCurvatura .* TrackConBrazo.VersorLateral, 2) ...
            / Parametros.Gravedad + TrackConBrazo.VersorLateral(:,3);
AporteRotacion = max([ max(abs(SimConBrazo.Gz - GzDelRiel)), max(abs(SimConBrazo.Gy - GyDelRiel)) ]);

Resultados = Anotar(Resultados, 'Transporte de cuerpo rigido desde el riel', ...
    ErrorReduccion < 1e-9 && AporteRotacion > 1e-3, ...
    sprintf(['con brazo nulo se reduce a la G del punto del riel con error %.3e G (limite 1e-9); ' ...
             'con brazo de %.0f mm la rotacion y el radio distinto aportan hasta %.4f G (tiene que ser > 0)'], ...
            ErrorReduccion, 1000*Parametros.DistanciaHeartline, AporteRotacion));

%% --- Test 11: el riel es el eje de roll --------------------------------
% Fija la hipotesis del modelo: se prescribe el riel y el pasajero rota
% alrededor de el. Sobre el tramo de acondicionamiento del dive loop, que
% entra recto y rola 180 grados:
%   1. el riel sigue recto (su curvatura impuesta es exactamente cero);
%   2. la heartline hace una helice de radio d alrededor del riel: en el
%      punto de maximo phi' su curvatura vale d*phi'^2/(1 + d^2*phi'^2);
%   3. la G lateral que produce esa rotacion es lineal en el brazo: en la
%      cabeza (2d) vale exactamente el doble que en la heartline (d).
Parametros = ParametrosBase;
Parametros.ModoCurvatura = 'Clotoide';
Parametros.DistanciaHeartlineACabeza = Parametros.DistanciaHeartline;
Estado = EstadoInicial([0 0 1.0], [1 0 0], [0 0 1], VelocidadDeEnsayo, Parametros);
[~, ElementoRoll] = ElementoDiveLoop(Estado, Parametros);
TrackRoll = ElementoRoll.Track;  SimRoll = ElementoRoll.Sim;

IndiceRoll = find(strcmp({TrackRoll.SubTramos.Nombre}, 'AcondicionamientoEntrada'), 1);
RangoRoll  = TrackRoll.SubTramos(IndiceRoll).IndiceInicio : TrackRoll.SubTramos(IndiceRoll).IndiceFin;

CurvaturaRielEnElRoll = max(TrackRoll.Curvatura(RangoRoll));

[~, Medio] = max(abs(TrackRoll.VelocidadRoll(RangoRoll)));
Medio = RangoRoll(Medio);
d = Parametros.DistanciaHeartline;
CurvaturaHelice = d*TrackRoll.VelocidadRoll(Medio)^2 / (1 + d^2*TrackRoll.VelocidadRoll(Medio)^2);
ErrorHelice = abs(TrackRoll.CurvaturaHeartline(Medio) - CurvaturaHelice) / CurvaturaHelice;

GyRotacionHeartline = SimRoll.Gy(RangoRoll)       - TrackRoll.VersorLateral(RangoRoll, 3);
GyRotacionCabeza    = SimRoll.GyCabeza(RangoRoll) - TrackRoll.VersorLateral(RangoRoll, 3);
[~, Pico] = max(abs(GyRotacionHeartline));
RazonDeBrazos = GyRotacionCabeza(Pico) / GyRotacionHeartline(Pico);

Resultados = Anotar(Resultados, 'El riel es el eje de roll', ...
    CurvaturaRielEnElRoll < 1e-12 && ErrorHelice < 0.05 && abs(RazonDeBrazos - 2) < 1e-6, ...
    sprintf(['riel recto en la transicion (kappa max %.1e 1/m); heartline helicoidal con kappa %.4f 1/m ' ...
             'contra d*phi''^2/(1+d^2*phi''^2) = %.4f (%.1f %% de desvio); Gy de rotacion en la cabeza / ' ...
             'en la heartline = %.6f (tiene que ser 2); pico de %.3f G en la heartline'], ...
            CurvaturaRielEnElRoll, TrackRoll.CurvaturaHeartline(Medio), CurvaturaHelice, 100*ErrorHelice, ...
            RazonDeBrazos, GyRotacionHeartline(Pico)));

%% --- Test 12: el modo normativo pone el +Gz limite en el pasajero -------
% En los cuatro elementos, sobre el arco principal, la Gz del punto de
% verificacion tiene que coincidir con la curva limite de la Receta evaluada
% en la duracion desde el inicio del arco (x sqrt(lambda)). Es el test que
% hubiera cazado el error de proyeccion de la helice: con la curvatura
% horizontal y el carro peraltado beta, imponer la G sobre el eje de la
% curvatura en vez de sobre U le erraba al objetivo por 1/sin(beta).
Parametros = ParametrosBase;
Parametros.ModoCurvatura = 'GNormativaMaxima';
% Con 120 grados las rampas consumen todo el giro del over-banked turn a
% esta velocidad, y con 180 le dejan 0.05 s de arco: se usan 240 para que
% el arco tenga entidad. Un arco vacio es una falla del test, no un error.
Parametros.AnguloDelGiro = deg2rad(240);
Constructores = {@ElementoLoopVertical, @ElementoOverBankedTurn, @ElementoHelice, @ElementoDiveLoop};
Estado = EstadoInicial([0 0 1.0], [1 0 0], [0 0 1], 6.0, Parametros);

PeorDesvio = 0;
Detalles   = {};
CriteriosDeObjetivo = true;
for i = 1:numel(Constructores)
    [~, ElementoNormativo, ReporteNormativo] = Constructores{i}(Estado, Parametros);
    TrackN = ElementoNormativo.Track;  SimN = ElementoNormativo.Sim;
    IndiceArco = find(strcmp({TrackN.SubTramos.Nombre}, 'ArcoPrincipal'), 1);
    if isempty(IndiceArco) || TrackN.SubTramos(IndiceArco).IndiceFin < TrackN.SubTramos(IndiceArco).IndiceInicio
        PeorDesvio = Inf;
        Detalles{end+1} = sprintf('%s SIN ARCO (las rampas consumen todo el giro)', ElementoNormativo.Nombre); %#ok<SAGROW>
        continue
    end
    RangoArco  = TrackN.SubTramos(IndiceArco).IndiceInicio : TrackN.SubTramos(IndiceArco).IndiceFin;
    DuracionReal = (SimN.Tiempo(RangoArco) - SimN.Tiempo(RangoArco(1))) * ElementoNormativo.Diagnostico.Escala.RaizLambdaLoop;
    Objetivo = arrayfun(@(D) LimiteNormativo(ElementoNormativo.Receta.CurvaLimiteGz, D), DuracionReal);
    Desvio = max(abs(SimN.Gz(RangoArco) - Objetivo));
    PeorDesvio = max(PeorDesvio, Desvio);
    Criterio = ReporteNormativo.Posteriores(strcmp({ReporteNormativo.Posteriores.Nombre}, 'Gz objetivo del modo alcanzado'));
    CriteriosDeObjetivo = CriteriosDeObjetivo && ~isempty(Criterio) && Criterio.Pasa;
    Detalles{end+1} = sprintf('%s %.4f G (%d nodos, %.2f s reales)', ElementoNormativo.Nombre, Desvio, ...
                              numel(RangoArco), DuracionReal(end)); %#ok<SAGROW>
end

Resultados = Anotar(Resultados, 'El modo normativo pone el +Gz limite en el pasajero', ...
    PeorDesvio < 0.02 && CriteriosDeObjetivo, ...
    sprintf('desvio maximo |Gz - GLimite(t)| sobre el arco: %s (limite 0.02 G); criterio posterior pasa en los cuatro', ...
            strjoin(Detalles, ', ')));

%% --- Test 13: el dive loop alcanza su Gy objetivo por sub-peralte -------
% En modo normativo el dive loop persigue ademas un Gy lateral, desalineando
% la curvatura del riel respecto de U. Se verifica que sobre el arco el Gy
% del pasajero coincide con el objetivo (el maximo que deja la elipse de
% 7.1.5.1 dado el Gz de la Fig. 10, o la Fig. 8 si es mas restrictiva), que
% el sub-peralte no es trivial, que el giro sigue cerrando y que los chequeos
% de elipse y de onset lateral pasan: el perfil resuelto no viola el
% presupuesto porque las clotoides se dimensionan tambien por el eje lateral.
Parametros = ParametrosBase;
Parametros.ModoCurvatura = 'GNormativaMaxima';
Estado = EstadoInicial([0 0 1.0], [1 0 0], [0 0 1], 6.0, Parametros);
[~, ElementoGy, ReporteGy] = ElementoDiveLoop(Estado, Parametros);
TrackGy = ElementoGy.Track;  SimGy = ElementoGy.Sim;  RecetaGy = ElementoGy.Receta;

IndiceArco = find(strcmp({TrackGy.SubTramos.Nombre}, 'ArcoPrincipal'), 1);
RangoArco  = TrackGy.SubTramos(IndiceArco).IndiceInicio : TrackGy.SubTramos(IndiceArco).IndiceFin;
DuracionReal = (SimGy.Tiempo(RangoArco) - SimGy.Tiempo(RangoArco(1))) * ElementoGy.Diagnostico.Escala.RaizLambdaLoop;
GzLimite = arrayfun(@(D) LimiteNormativo(RecetaGy.CurvaLimiteGz, D), DuracionReal);
SemiejeGz = 1.1*LimiteNormativo(RecetaGy.CurvaLimiteGz, 0.2);
SemiejeGy = 1.1*LimiteNormativo(RecetaGy.CurvaLimiteGy, 0.2);
GyObjetivo = RecetaGy.SentidoDeGy * (min(arrayfun(@(D) LimiteNormativo(RecetaGy.CurvaLimiteGy, D), DuracionReal), ...
                                         SemiejeGy*sqrt(max(1 - (GzLimite/SemiejeGz).^2, 0))) - Parametros.TolObjetivoDeG);
DesvioGy = max(abs(SimGy.Gy(RangoArco) - GyObjetivo));
SubPeralteMaximo = max(abs(TrackGy.AnguloCurvaturaDesdeArriba(RangoArco)));

Nombres = {ReporteGy.Posteriores.Nombre};
Pasa = @(Nombre) ReporteGy.Posteriores(strcmp(Nombres, Nombre)).Pasa;
ChequeosQueImportan = Pasa('Gy objetivo del modo alcanzado') && Pasa('Gz objetivo del modo alcanzado') ...
                   && Pasa('Elipse de dos ejes Gy-Gz (7.1.5.1)') && Pasa('Onset maximo de Gy') ...
                   && Pasa('Giro objetivo alcanzado');

Resultados = Anotar(Resultados, 'El dive loop alcanza su Gy objetivo por sub-peralte', ...
    DesvioGy < 0.02 && SubPeralteMaximo > deg2rad(5) && ChequeosQueImportan, ...
    sprintf(['|Gy - objetivo| max %.4f G sobre el arco (objetivo %.2f G, limite 0.02); sub-peralte hasta %.1f grados; ' ...
             'residual de cierre %.2e rad; elipse 7.1.5.1 = %.3f; onset Gy %.1f de %.1f G/s'], ...
            DesvioGy, abs(GyObjetivo(1)), rad2deg(SubPeralteMaximo), ReporteGy.Resumen.ResidualCierrePitch, ...
            ReporteGy.Normativo.Elipse.ValorMaximoGyGz, ReporteGy.Normativo.OnsetMaximoPorEje(2), ...
            ReporteGy.Resumen.OnsetMaximoModelo(2)));

%% --- Test 14: el factor de seguridad escala el objetivo y no la verificacion
% Con FactorDeSeguridadNormativo > 1 el modo normativo tiene que poner en el
% pasajero la curva de la norma DIVIDIDA por el factor (y en el dive loop
% tambien el Gy, con la elipse entera escalada), el criterio "objetivo
% alcanzado" tiene que reconstruir el mismo objetivo y pasar, y la
% verificacion de cumplimiento tiene que seguir comparando contra la norma
% literal: los semiejes de la elipse de 7.1.5.1 no se mueven. Los tests 12
% y 13 corren con el default 1.0 y son los que garantizan que sea neutral.
Parametros = ParametrosBase;
Parametros.ModoCurvatura = 'GNormativaMaxima';
Parametros.FactorDeSeguridadNormativo = 1.25;
Estado = EstadoInicial([0 0 1.0], [1 0 0], [0 0 1], 6.0, Parametros);

Constructores = {@ElementoLoopVertical, @ElementoDiveLoop};
PeorDesvioFS = 0;
CriteriosFS  = true;
ElipseLiteral = true;
DetallesFS = {};
for i = 1:numel(Constructores)
    [~, ElementoFS, ReporteFS] = Constructores{i}(Estado, Parametros);
    TrackFS = ElementoFS.Track;  SimFS = ElementoFS.Sim;  RecetaFS = ElementoFS.Receta;
    IndiceArco = find(strcmp({TrackFS.SubTramos.Nombre}, 'ArcoPrincipal'), 1);
    RangoArco  = TrackFS.SubTramos(IndiceArco).IndiceInicio : TrackFS.SubTramos(IndiceArco).IndiceFin;
    DuracionReal = (SimFS.Tiempo(RangoArco) - SimFS.Tiempo(RangoArco(1))) * ElementoFS.Diagnostico.Escala.RaizLambdaLoop;
    ObjetivoFS = arrayfun(@(D) LimiteNormativo(RecetaFS.CurvaLimiteGz, D), DuracionReal) / Parametros.FactorDeSeguridadNormativo;
    DesvioFS = max(abs(SimFS.Gz(RangoArco) - ObjetivoFS));
    PeorDesvioFS = max(PeorDesvioFS, DesvioFS);

    NombresFS = {ReporteFS.Posteriores.Nombre};
    CriteriosFS = CriteriosFS && ReporteFS.Posteriores(strcmp(NombresFS, 'Gz objetivo del modo alcanzado')).Pasa;
    if isfield(RecetaFS, 'CurvaLimiteGy')
        SemiejeGzFS = 1.1*LimiteNormativo(RecetaFS.CurvaLimiteGz, 0.2) / Parametros.FactorDeSeguridadNormativo;
        SemiejeGyFS = 1.1*LimiteNormativo(RecetaFS.CurvaLimiteGy, 0.2) / Parametros.FactorDeSeguridadNormativo;
        GyCurvaFS   = arrayfun(@(D) LimiteNormativo(RecetaFS.CurvaLimiteGy, D), DuracionReal) / Parametros.FactorDeSeguridadNormativo;
        GyObjetivoFS = RecetaFS.SentidoDeGy * (min(GyCurvaFS, SemiejeGyFS*sqrt(max(1 - (ObjetivoFS/SemiejeGzFS).^2, 0))) ...
                                               - Parametros.TolObjetivoDeG);
        DesvioGyFS = max(abs(SimFS.Gy(RangoArco) - GyObjetivoFS));
        PeorDesvioFS = max(PeorDesvioFS, DesvioGyFS);
        CriteriosFS = CriteriosFS && ReporteFS.Posteriores(strcmp(NombresFS, 'Gy objetivo del modo alcanzado')).Pasa;
    end
    % La verificacion no ve el factor: semiejes literales de 200 ms x 1.1.
    SemiejesLiterales = [1.1*LimiteNormativo('MasGxBase', 0.2), 1.1*LimiteNormativo('GyBase', 0.2), ...
                         1.1*LimiteNormativo(ReporteFS.Normativo.CurvaMasGzAplicada, 0.2)];
    ElipseLiteral = ElipseLiteral && max(abs(ReporteFS.Normativo.Elipse.Semiejes - SemiejesLiterales)) < 1e-12;
    DetallesFS{end+1} = sprintf('%s Gz max %.3f G (objetivo %.3f), desvio %.4f G', ElementoFS.Nombre, ...
                                max(SimFS.Gz(RangoArco)), ObjetivoFS(1), DesvioFS); %#ok<SAGROW>
end

Resultados = Anotar(Resultados, 'El factor de seguridad escala el objetivo del modo y no la verificacion', ...
    PeorDesvioFS < 0.02 && CriteriosFS && ElipseLiteral, ...
    sprintf('FS = %.2f: %s (limite 0.02 G); criterios de objetivo pasan; semiejes de la elipse sin escalar', ...
            Parametros.FactorDeSeguridadNormativo, strjoin(DetallesFS, ', ')));

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
