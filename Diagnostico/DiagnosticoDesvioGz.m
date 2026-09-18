%% Diagnostico del desvio de Gz en modo GNormativaMaxima
% Corre uno o mas elementos en modo GNormativaMaxima y descompone, nodo a
% nodo, la diferencia entre la Gz que el modo impuso y la que mide la
% simulacion, en las cuatro hipotesis de la consigna:
%
%   H1  phi'' inconsistente: DENTRO DEL PASO el diseno usa solo la parte
%       quintica (PuntoCinematico) y la medicion usa la derivada numerica
%       de phi' completo, que incluye Inclinacion*dkappa/ds. Desde que
%       GenerarGeometria completa phi'' sobre la polilinea al terminar cada
%       recorrido (CompletarAceleracionRoll), la G registrada y el lazo de
%       onset ya ven el termino: H1 mide lo que sigue faltando dentro del
%       paso, y H2b mide lo que queda entre el registro y la simulacion.
%   H2  formula cerrada (CargasEnLaVia, dentro del paso) contra transporte
%       de cuerpo rigido completo (SimularSobreTrack/GTransportada), con la
%       G registrada durante la marcha como tercer punto de comparacion.
%   H3  el objetivo no es constante: la curva de la norma baja despues de
%       1.0 s de prototipo, asi que el maximo de Gz se alcanza solo al
%       principio del arco.
%   H4  velocidad usada para la curvatura: metodo A (marcha) contra metodo B
%       (punto fijo).
%
% Ademas descompone Gx en sus tres aportes (cancelacion gravedad/a_t,
% resistencia al avance, transporte de cuerpo rigido) para confirmar que el
% Gx negativo es la resistencia y no un termino de transporte desbocado.
%
% NO corrige nada: imprime los numeros y una tabla final por hipotesis.
% Los resultados de referencia estan en
% Claude outputs/resumen-diagnostico-graficos-roll-fs.md.

clear; clc
addpath(genpath(fullfile(fileparts(mfilename('fullpath')), '..', 'GeneradorDeElementos')));

%% ===================== CASO A DIAGNOSTICAR ===========================
% Mismo estado sintetico que DemoElemento: via a nivel, carro derecho.
Constructores = {@ElementoLoopVertical, @ElementoDiveLoop};   % el loop es el del desvio; el dive loop, el del Gx negativo
PosicionInicial  = [0, 0, 1.00];   % [m]
VelocidadInicial = 4.60;           % [m/s]
DesvioReportado  = 0.158;          % [G] lo que observo el usuario: 6.0 - 5.842

Parametros = ParametrosPorDefecto();
Parametros.ModoCurvatura           = 'GNormativaMaxima';
Parametros.MetodoDeAcoplamiento    = 'A';
Parametros.CalcularVelocidadMinima = false;

g = Parametros.Gravedad;
b = BrazoDeVerificacion(Parametros);

for c = 1:numel(Constructores)
    Elegido = Constructores{c};
    Estado  = EstadoInicial(PosicionInicial, [1 0 0], [0 0 1], VelocidadInicial, Parametros);
    [~, Elemento, Reporte] = Elegido(Estado, Parametros);
    Track = Elemento.Track;  Sim = Elemento.Sim;  Diag = Elemento.Diagnostico;  Receta = Elemento.Receta;
    Arco = Track.LongitudArco;

    fprintf('\n=====================================================================\n');
    fprintf(' %s -- modo %s -- v0 = %.2f m/s -- RadioDeReferencia = %.3f m -- brazo %.3f m\n', ...
            Elemento.Nombre, Track.ModoCurvatura, VelocidadInicial, Elemento.Parametros.RadioDeReferencia, b);
    fprintf('=====================================================================\n');
    if ~isempty(Diag.Aviso)
        fprintf('  AVISO del generador: %s\n', Diag.Aviso);
    end

    IndiceArco = find(strcmp({Track.SubTramos.Nombre}, 'ArcoPrincipal'), 1);
    if isempty(IndiceArco)
        fprintf('  El elemento no tiene arco principal: nada que diagnosticar.\n');
        continue
    end
    Rango = Track.SubTramos(IndiceArco).IndiceInicio : Track.SubTramos(IndiceArco).IndiceFin;
    Rango = Rango(~isnan(Sim.Gz(Rango)));

    %% ---------------- 0. El criterio de aceptacion --------------------------
    % Se reconstruye el desvio con la misma definicion que ConstruirElemento
    % (CriterioDeObjetivoDeG) y se compara con lo que el reporte informa: si
    % los dos numeros no coinciden, el criterio esta mal tomado.
    DuracionReal = (Sim.Tiempo(Rango) - Sim.Tiempo(Rango(1))) * Diag.Escala.RaizLambdaLoop;
    Objetivo     = LimiteDeDiseno(Receta.CurvaLimiteGz, DuracionReal, Parametros.SemianchoDeSuavizadoNormativo);
    DesvioMedido = max(abs(Sim.Gz(Rango) - Objetivo));
    [GzMaxima, NodoMaximo] = max(Sim.Gz);

    Criterio = Reporte.Posteriores(strcmp({Reporte.Posteriores.Nombre}, 'Gz objetivo del modo alcanzado'));
    fprintf('\n--- 0. Criterio "Gz objetivo del modo alcanzado" ---\n');
    fprintf('  Reporte: %s, valor %.4f G contra TolObjetivoDeG = %.3f G\n', ...
            EstadoDelCriterio(Criterio), Criterio.Valor, Parametros.TolObjetivoDeG);
    fprintf('  Reconstruido aca: max|Gz - Objetivo| sobre el arco = %.4f G (%d nodos)\n', DesvioMedido, numel(Rango));
    fprintf('  Gz maxima del elemento: %.4f G en el nodo %d (arco %.4f m, %s)\n', GzMaxima, NodoMaximo, ...
            Arco(NodoMaximo), SubTramoDelNodo(Track, NodoMaximo));
    fprintf('  Desvio reportado por el usuario: %.3f G  -->  %s\n', DesvioReportado, ...
            VeredictoDelCriterio(DesvioReportado, Parametros.TolObjetivoDeG));
    if abs(Criterio.Valor - DesvioMedido) > 1e-9
        fprintf('  ** El valor del reporte no coincide con la reconstruccion: revisar el rango o el objetivo del criterio.\n');
    else
        fprintf('  El criterio mide lo que dice medir: con un desvio de %.3f G daria %s.\n', ...
                DesvioReportado, VeredictoDelCriterio(DesvioReportado, Parametros.TolObjetivoDeG));
    end

    %% ---------------- H3. El objetivo no es 6.0 en todo el arco ------------
    fprintf('\n--- H3. Objetivo a lo largo del arco (curva %s) ---\n', Receta.CurvaLimiteGz);
    fprintf('  Duracion real (prototipo) del arco: %.3f s  (modelo %.3f s x sqrt(lambda) = %.3f)\n', ...
            DuracionReal(end), DuracionReal(end)/Diag.Escala.RaizLambdaLoop, Diag.Escala.RaizLambdaLoop);
    fprintf('  Objetivo al inicio del arco: %.3f G   al final: %.3f G   minimo: %.3f G\n', ...
            Objetivo(1), Objetivo(end), min(Objetivo));
    NodoObjetivoBaja = find(Objetivo < Objetivo(1) - 1e-9, 1);
    if isempty(NodoObjetivoBaja)
        fprintf('  El objetivo es constante en todo el arco: H3 no aporta.\n');
    else
        fprintf('  El objetivo empieza a bajar en el nodo %d del arco (%.3f s reales): a partir de ahi\n', ...
                NodoObjetivoBaja, DuracionReal(NodoObjetivoBaja));
        fprintf('  un Gz menor que %.1f es lo que el modo pidio, no un desvio.\n', Objetivo(1));
    end
    fprintf('  Gz en el nodo de maximo: %.4f G; objetivo ahi: %.4f G; diferencia %+.4f G\n', ...
            GzMaxima, ObjetivoEnNodo(NodoMaximo, Rango, Objetivo), GzMaxima - ObjetivoEnNodo(NodoMaximo, Rango, Objetivo));
    % Que pasaria si el reloj arrancara en la clotoide de entrada, que es
    % donde la verificacion posterior empieza a contar el evento sostenido.
    IndiceClotoide = find(strcmp({Track.SubTramos.Nombre}, 'ClotoideEntrada'), 1);
    if ~isempty(IndiceClotoide)
        TiempoClotoide = Sim.Tiempo(Track.SubTramos(IndiceClotoide).IndiceInicio);
        DuracionDesdeClotoide = (Sim.Tiempo(Rango) - TiempoClotoide) * Diag.Escala.RaizLambdaLoop;
        ObjetivoDesdeClotoide = LimiteDeDiseno(Receta.CurvaLimiteGz, DuracionDesdeClotoide, Parametros.SemianchoDeSuavizadoNormativo);
        fprintf('  Si el reloj arrancara en la clotoide de entrada (%.3f s reales antes), el objetivo\n', ...
                DuracionDesdeClotoide(1));
        fprintf('  cambiaria hasta %.4f G respecto del que uso el modo (H3 alternativa).\n', ...
                max(abs(ObjetivoDesdeClotoide - Objetivo)));
    end

    %% ---------------- H1. phi'' de diseno contra phi'' medido --------------
    % phi'' de diseno: solo la transicion quintica, que es lo unico que
    % devuelve PuntoCinematico.AceleracionRoll y lo unico que entra en
    % CargasEnLaVia dentro del paso. Se reconstruye con los mismos datos que
    % uso el generador (Diagnostico.DeltaRoll y LongitudAcondicionamiento).
    ArcoLocal = Arco - Arco(1);
    [~, ~, AceleracionRollDiseno] = PerfilRollQuintico(0, Diag.DeltaRoll, Diag.LongitudAcondicionamiento, ArcoLocal);
    AceleracionRollDiseno = AceleracionRollDiseno(:) .* ones(size(Arco));
    DeltaAceleracionRoll = Track.AceleracionRoll - AceleracionRollDiseno;

    CurvaturaArribaCarro  = sum(Track.VectorCurvatura .* Track.VersorArribaCarro, 2);
    CurvaturaLateralCarro = sum(Track.VectorCurvatura .* Track.VersorLateral,     2);
    AceleracionTangencialRiel = DerivadaPorArco(Sim.Velocidad, Arco) .* Sim.Velocidad;
    AceleracionTangencialEstimada = -g*Track.VersorTangente(:,3);

    % CargasEnLaVia es escalar (se llama dentro del paso): se evalua nodo a nodo.
    [GzConDiseno, GyConDiseno] = CargasPorNodo(CurvaturaArribaCarro, CurvaturaLateralCarro, Sim.Velocidad, ...
        Track.VelocidadRoll, AceleracionRollDiseno, AceleracionTangencialEstimada, ...
        Track.VersorArribaCarro(:,3), Track.VersorLateral(:,3), b, g);
    [GzConMedido, GyConMedido] = CargasPorNodo(CurvaturaArribaCarro, CurvaturaLateralCarro, Sim.Velocidad, ...
        Track.VelocidadRoll, Track.AceleracionRoll, AceleracionTangencialEstimada, ...
        Track.VersorArribaCarro(:,3), Track.VersorLateral(:,3), b, g);

    H1.DeltaPhi2Arco     = max(abs(DeltaAceleracionRoll(Rango)));
    H1.DeltaPhi2Elemento = max(abs(DeltaAceleracionRoll));
    H1.AporteGzArco      = max(abs(GzConMedido(Rango) - GzConDiseno(Rango)));
    H1.AporteGyArco      = max(abs(GyConMedido(Rango) - GyConDiseno(Rango)));
    H1.AporteGyElemento  = max(abs(GyConMedido - GyConDiseno));

    fprintf('\n--- H1. phi'''' de diseno (quintica sola) contra phi'''' medido (gradiente de phi'' completo) ---\n');
    fprintf('  Inclinacion helicoidal tan(alfa) = %.4f  (phi''_helice = tan(alfa)*kappa, phi''''_helice = tan(alfa)*dkappa/ds)\n', ...
            Diag.InclinacionHelicoidal);
    fprintf('  max|phi''''_medido - phi''''_diseno|: %.3f rad/m^2 en el arco, %.3f rad/m^2 en todo el elemento\n', ...
            H1.DeltaPhi2Arco, H1.DeltaPhi2Elemento);
    fprintf('  Propagado por CargasEnLaVia:  Gz %.2e G (phi'''' no entra en Gz: es exactamente cero)\n', H1.AporteGzArco);
    fprintf('                                Gy %.4f G en el arco, %.4f G en todo el elemento (termino b*v^2*phi''''/g)\n', ...
            H1.AporteGyArco, H1.AporteGyElemento);

    %% ---------------- H2. Formula cerrada contra transporte completo -------
    % (a) CargasEnLaVia evaluada sobre el Track y la velocidad simulada, con
    %     el phi'' que consume la simulacion, contra Sim.Gz (GTransportada).
    % (b) La G registrada durante la marcha (Diagnostico.GArribaVerificacion,
    %     velocidad de la marcha, phi'' de diseno) contra Sim.Gz.
    % (c) La aproximacion a_t ~ -g*Tz del termino de Euler, sola.
    H2.CerradaVsTransporteGz = max(abs(GzConMedido(Rango) - Sim.Gz(Rango)));
    H2.CerradaVsTransporteGy = max(abs(GyConMedido(Rango) - Sim.Gy(Rango)));
    H2.DisenoVsSimuladoGz    = max(abs(Diag.GArribaVerificacion(Rango) - Sim.Gz(Rango)));
    H2.DisenoVsSimuladoGy    = max(abs(Diag.GLateralVerificacion(Rango) - Sim.Gy(Rango)));
    H2.DisenoVsObjetivoGz    = max(abs(Diag.GArribaVerificacion(Rango) - Objetivo));
    DeltaAceleracionTangencial = AceleracionTangencialRiel - AceleracionTangencialEstimada;
    H2.AporteAtEnGy = max(abs(b*DeltaAceleracionTangencial(Rango).*Track.VelocidadRoll(Rango)/g));
    H2.DeltaAt      = max(abs(DeltaAceleracionTangencial(Rango)));

    fprintf('\n--- H2. Formula cerrada (CargasEnLaVia) contra transporte de cuerpo rigido (GTransportada) ---\n');
    fprintf('  (a) cerrada sobre Track+Sim contra Sim.Gz:            Gz %.4f G   Gy %.4f G   (sobre el arco)\n', ...
            H2.CerradaVsTransporteGz, H2.CerradaVsTransporteGy);
    fprintf('  (b) G de diseno (marcha RK4) contra Sim.Gz:           Gz %.4f G   Gy %.4f G\n', ...
            H2.DisenoVsSimuladoGz, H2.DisenoVsSimuladoGy);
    fprintf('      G de diseno contra el objetivo del modo:          Gz %.4f G   (lo que el transporte inverso erro al disenar)\n', ...
            H2.DisenoVsObjetivoGz);
    fprintf('  (c) a_t estimada (-g*Tz) contra numerica: hasta %.3f m/s^2; via el termino de Euler b*a_t*phi''/g\n', H2.DeltaAt);
    fprintf('      aporta a Gy hasta %.4f G y a Gz nada (a_t no entra en Gz).\n', H2.AporteAtEnGy);

    %% ---------------- H4. Metodo A contra metodo B --------------------------
    ParametrosB = Parametros;
    ParametrosB.MetodoDeAcoplamiento = 'B';
    [~, ElementoB] = Elegido(Estado, ParametrosB);
    TrackB = ElementoB.Track;  SimB = ElementoB.Sim;
    IndiceArcoB = find(strcmp({TrackB.SubTramos.Nombre}, 'ArcoPrincipal'), 1);
    RangoB = TrackB.SubTramos(IndiceArcoB).IndiceInicio : TrackB.SubTramos(IndiceArcoB).IndiceFin;
    RangoB = RangoB(~isnan(SimB.Gz(RangoB)));
    DuracionRealB = (SimB.Tiempo(RangoB) - SimB.Tiempo(RangoB(1))) * ElementoB.Diagnostico.Escala.RaizLambdaLoop;
    ObjetivoB = LimiteDeDiseno(Receta.CurvaLimiteGz, DuracionRealB, Parametros.SemianchoDeSuavizadoNormativo);
    H4.DesvioB   = max(abs(SimB.Gz(RangoB) - ObjetivoB));
    H4.GzMaximaB = max(SimB.Gz);
    [ArcoBUnico, IndicesUnicos] = unique(TrackB.LongitudArco, 'stable');
    H4.GzAvsB    = max(abs(interp1(ArcoBUnico, SimB.Gz(IndicesUnicos), Arco(Rango), 'linear', 'extrap') - Sim.Gz(Rango)));

    fprintf('\n--- H4. Velocidad usada para la curvatura: metodo A (marcha) contra B (punto fijo) ---\n');
    fprintf('  Metodo B: %d iteraciones, residuo %.2e m/s\n', ...
            ElementoB.Diagnostico.IteracionesPuntoFijo, ElementoB.Diagnostico.ResiduoPuntoFijo);
    fprintf('  Gz maxima: A %.4f G, B %.4f G.  max|Gz_A - Gz_B| sobre el arco: %.4f G\n', ...
            GzMaxima, H4.GzMaximaB, H4.GzAvsB);
    fprintf('  Desvio contra el objetivo: A %.4f G, B %.4f G\n', DesvioMedido, H4.DesvioB);

    %% ---------------- Gx: cancelacion, resistencia y transporte ------------
    % Gx = (a_P.T + g*Tz)/g. El centro de masa recorre la heartline con
    % velocidad v_cm a lo largo de tau_h = [(1 - d*ku)*T + d*phi'*L]/J, y su
    % aceleracion tangencial sale de la energia:
    %     dv_cm/dt = (1/J)*(-g*dz_cm/ds - F_res/m) = -g*tau_hz - F_res/(m*J)
    % asi que  dv_cm/dt + g*Tz = g*(Tz - tau_hz) - F_res/(m*J):
    %   - la gravedad se cancela contra a_t salvo la diferencia entre la
    %     tangente del riel y la de la heartline (cero en via recta sin roll);
    %   - lo que sobra es la resistencia al avance, negativa por construccion;
    %   - el resto de Gx es transporte de cuerpo rigido: la aceleracion normal
    %     del centro de masa proyectada sobre T, que no es cero porque la
    %     heartline no es paralela al riel, mas el transporte d -> b si el
    %     punto de verificacion no es la heartline.
    d = Parametros.DistanciaHeartline;
    Valido = ~isnan(Sim.Gx);
    FactorJ = Sim.FactorVelocidadHeartline;
    TangenteHeartlineZ = ((1 - d*CurvaturaArribaCarro).*Track.VersorTangente(:,3) ...
                          + d*Track.VelocidadRoll.*Track.VersorLateral(:,3)) ./ FactorJ;
    GxResistencia = -(Sim.FuerzaRodadura + Sim.FuerzaArrastre) ./ (Parametros.Masa*g*FactorJ);
    GxCancelacion = Track.VersorTangente(:,3) - TangenteHeartlineZ;
    GxTransporte  = Sim.Gx - GxResistencia - GxCancelacion;
    % Control: la suma cancelacion + resistencia tiene que ser (dv_cm/dt + g*Tz)/g
    % con la a_t numerica de la simulacion.
    ResiduoControl = max(abs((Sim.AceleracionTangencial(Valido) + g*Track.VersorTangente(Valido,3))/g ...
                             - GxResistencia(Valido) - GxCancelacion(Valido)));
    [GxMinimo, NodoGxMinimo] = min(Sim.Gx);

    fprintf('\n--- Gx: descomposicion en sus tres aportes (brazo %.3f m, d = %.3f m) ---\n', b, d);
    fprintf('  %-50s %10s %10s\n', '', 'max|.| [G]', 'en Gx min');
    fprintf('  %-50s %10.4f %10.4f\n', 'Cancelacion gravedad/a_t: Tz - tau_hz', ...
            max(abs(GxCancelacion(Valido))), GxCancelacion(NodoGxMinimo));
    fprintf('  %-50s %10.4f %10.4f\n', 'Resistencia al avance -F_res/(m*g*J)', ...
            max(abs(GxResistencia(Valido))), GxResistencia(NodoGxMinimo));
    fprintf('  %-50s %10.4f %10.4f\n', 'Transporte de cuerpo rigido (resto)', ...
            max(abs(GxTransporte(Valido))), GxTransporte(NodoGxMinimo));
    fprintf('  %-50s %10.4f %10.4f\n', 'Gx total', max(abs(Sim.Gx(Valido))), GxMinimo);
    fprintf('  Control (dv_cm/dt + g*Tz)/g - cancelacion - resistencia: %.2e G (derivada numerica)\n', ResiduoControl);
    fprintf('  Gx minimo %.4f G en el nodo %d (%s). Crr maximo %.3f x Gz ahi (%.2f G) = %.4f G; arrastre a v0: %.4f G.\n', ...
            GxMinimo, NodoGxMinimo, SubTramoDelNodo(Track, NodoGxMinimo), ...
            max([Parametros.CrrPortantes, Parametros.CrrGuia, Parametros.CrrRetencion]), Sim.Gz(NodoGxMinimo), ...
            max([Parametros.CrrPortantes, Parametros.CrrGuia, Parametros.CrrRetencion])*abs(Sim.Gz(NodoGxMinimo)), ...
            0.5*Parametros.RhoAire*Parametros.CoefArrastre*Parametros.AreaFrontal*VelocidadInicial^2/(Parametros.Masa*g));
    if max(abs(GxTransporte(Valido))) > max(abs(GxResistencia(Valido)))
        fprintf('  ** El transporte domina sobre la resistencia: hay algo que revisar.\n');
    else
        fprintf('  La resistencia domina y el transporte queda por debajo: el Gx negativo es la resistencia.\n');
    end

    %% ---------------- Tabla final -------------------------------------------
    fprintf('\n--- Tabla: cuanto aporta cada hipotesis al desvio de Gz en el arco ---\n');
    fprintf('  %-52s %12s %12s\n', 'Hipotesis', 'Gz [G]', 'Gy [G]');
    fprintf('  %-52s %12.4f %12.4f\n', 'H1 phi'''' diseno vs medido',                     H1.AporteGzArco, H1.AporteGyArco);
    fprintf('  %-52s %12.4f %12.4f\n', 'H2a cerrada vs transporte completo',               H2.CerradaVsTransporteGz, H2.CerradaVsTransporteGy);
    fprintf('  %-52s %12.4f %12.4f\n', 'H2b G de diseno (marcha) vs G simulada',           H2.DisenoVsSimuladoGz, H2.DisenoVsSimuladoGy);
    fprintf('  %-52s %12s %12.4f\n',   'H2c a_t estimada vs numerica (Euler)',             '0', H2.AporteAtEnGy);
    fprintf('  %-52s %12s %12s\n',     sprintf('H3 objetivo %.2f -> %.2f G en %.2f s reales', Objetivo(1), Objetivo(end), DuracionReal(end)), 'no es desvio', '-');
    fprintf('  %-52s %12.4f %12s\n',   'H4 metodo A vs B',                                 H4.GzAvsB, '-');
    fprintf('  %-52s %12.4f %12s\n',   'Desvio medido max|Gz - Objetivo| (metodo A)',      DesvioMedido, '-');
    fprintf('  %-52s %12.4f %12s\n',   'Desvio reportado por el usuario',                  DesvioReportado, '-');
    fprintf('  Ninguna hipotesis mueve la Gz del arco mas de %.4f G en este caso.\n', ...
            max([H1.AporteGzArco, H2.CerradaVsTransporteGz, H2.DisenoVsSimuladoGz, H4.GzAvsB]));
end

%% ========================= auxiliares =====================================
function [GArriba, GLateral] = CargasPorNodo(ku, kl, v, VelocidadRoll, AceleracionRoll, at, Uz, Lz, Brazo, g)
%CARGASPORNODO CargasEnLaVia evaluada sobre vectores columna, nodo a nodo.
    n = numel(ku);
    GArriba  = nan(n, 1);
    GLateral = nan(n, 1);
    for k = 1:n
        [GArriba(k), GLateral(k)] = CargasEnLaVia(ku(k), kl(k), v(k), VelocidadRoll(k), AceleracionRoll(k), ...
                                                  at(k), Uz(k), Lz(k), Brazo, g);
    end
end

function Texto = EstadoDelCriterio(Criterio)
    if strcmp(Criterio.Sentido, 'Informativo')
        Texto = 'informativo';
    elseif Criterio.Pasa
        Texto = 'PASA';
    else
        Texto = 'FALLA';
    end
end

function Texto = VeredictoDelCriterio(Desvio, Tolerancia)
    if Desvio <= Tolerancia
        Texto = 'PASA';
    else
        Texto = 'FALLA';
    end
end

function Nombre = SubTramoDelNodo(Track, Nodo)
    Nombre = 'fuera de los sub-tramos';
    for i = 1:numel(Track.SubTramos)
        if Nodo >= Track.SubTramos(i).IndiceInicio && Nodo <= Track.SubTramos(i).IndiceFin
            Nombre = Track.SubTramos(i).Nombre;
            return
        end
    end
end

function Valor = ObjetivoEnNodo(Nodo, Rango, Objetivo)
    Posicion = find(Rango == Nodo, 1);
    if isempty(Posicion)
        Valor = NaN;
    else
        Valor = Objetivo(Posicion);
    end
end
