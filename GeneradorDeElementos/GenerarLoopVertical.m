function [Track, Diagnostico] = GenerarLoopVertical(EstadoEntrada, Parametros, PerfilVelocidad)
%GENERARLOOPVERTICAL Nucleo de generacion de la geometria del loop vertical.
%   Lo usan los dos metodos de acoplamiento: el metodo A no pasa perfil de
%   velocidad (la curvatura se evalua con la v que lleva la marcha) y el
%   metodo B pasa el perfil supuesto de la iteracion anterior.
%
%   Sub-tramos, en orden:
%     AcondicionamientoEntrada  lleva a cero la curvatura fuera del plano del
%                               loop y el roll al que el loop necesita
%     ClotoideEntrada           rampa de curvatura desde kappa_0 (clotoide
%                               desplazada si la entrada ya venia curvada)
%     ArcoLoop                  curvatura segun el modo elegido
%     ClotoideSalida            rampa de curvatura de vuelta a cero
%
%   El arco se corta cuando el angulo ya girado mas lo que va a girar la
%   clotoide de salida llega a 2*pi. Esa prediccion no es exacta cuando la
%   curvatura depende de v, asi que el residual de cierre se corrige con unas
%   pocas iteraciones de secante y se reporta siempre.

    if nargin < 3
        PerfilVelocidad = [];
    end

    Escala = EscalasDeFroude(Parametros);

    %% ---------------- Marco y curvatura del estado de entrada -------------
    VersorTangenteEntrada = EstadoEntrada.VersorTangente;
    if norm(VersorTangenteEntrada(1:2)) < 1e-9
        error('GenerarLoopVertical:TangenteVertical', ...
             ['La tangente de entrada es vertical pura: el plano del loop queda ' ...
              'indeterminado. Hace falta dar el azimut del plano como dato.']);
    end

    [VersorArribaTransporteEntrada, VersorLateralTransporteEntrada] = MarcoTransporteDesdeCarro( ...
        EstadoEntrada.VersorArribaCarro, EstadoEntrada.VersorLateral, EstadoEntrada.AnguloRoll);

    NormalEnPlano = NormalDelPlanoVertical(VersorTangenteEntrada);
    Beta = atan2(dot(NormalEnPlano, VersorLateralTransporteEntrada), ...
                 dot(NormalEnPlano, VersorArribaTransporteEntrada));

    %% ---------------- Plan del elemento -----------------------------------
    Plan.Parametros          = Parametros;
    Plan.Escala              = Escala;
    Plan.Onset               = Escala.OnsetMaximo;
    Plan.EstadoEntrada       = EstadoEntrada;
    Plan.PerfilVelocidad     = PerfilVelocidad;
    Plan.NormalEnPlano       = NormalEnPlano;
    Plan.Beta                = Beta;
    Plan.CurvaturaEnPlano    = dot(EstadoEntrada.VectorCurvatura, NormalEnPlano);
    Plan.CurvaturaFueraPlano = dot(EstadoEntrada.VectorCurvatura, ...
                                   cross(VersorTangenteEntrada, NormalEnPlano));
    Plan.EstadoInicialY = [EstadoEntrada.Posicion, VersorTangenteEntrada, ...
                           VersorArribaTransporteEntrada, VersorLateralTransporteEntrada, ...
                           EstadoEntrada.Velocidad^2, 0, 0];

    RollObjetivo = Beta + Parametros.RollObjetivoLoop;
    DeltaRoll    = AjustarAngulo(RollObjetivo - EstadoEntrada.AnguloRoll);

    %% ---------------- Generacion ------------------------------------------
    % Tres lazos anidados, los tres chicos:
    %   externo  ajusta a la vez la longitud de las transiciones (para
    %            respetar el presupuesto de onset) y la torsion (para llegar
    %            al desplazamiento lateral pedido).
    %   interno  corrige por secante el residual de cierre del loop.
    %
    % La inclinacion helicoidal arranca en cero y se corrige con un paso de
    % Newton: el desplazamiento lateral vale sin(alfa)*L, asi que la longitud
    % del loop es la pendiente. Converge en una o dos pasadas.
    FactorLongitud = 1;
    AjustarInclinacion = isempty(Parametros.InclinacionHelicoidalImpuesta) && ...
                         Parametros.DesplazamientoLateralLoop ~= 0;
    if isempty(Parametros.InclinacionHelicoidalImpuesta)
        Inclinacion = 0;
    else
        Inclinacion = Parametros.InclinacionHelicoidalImpuesta;
    end
    ResidualCierre   = NaN;
    InclinacionUsada = 0;
    FactorUsado      = 1;
    for IteracionAjuste = 1:Parametros.MaxIteracionesAjuste
        Plan.Onset       = Escala.OnsetMaximo / FactorLongitud;
        Plan.Inclinacion = Inclinacion;
        InclinacionUsada = Inclinacion;
        FactorUsado      = FactorLongitud;

        Plan.LongitudAcondicionamiento = LongitudTransicionDeRoll(DeltaRoll, EstadoEntrada.Velocidad, ...
                                                                  Plan.Onset(2), Parametros);
        if abs(Plan.CurvaturaFueraPlano) > 1e-9
            LongitudPorCurvatura = LongitudDeClotoide(EstadoEntrada.Velocidad, Plan.CurvaturaFueraPlano, ...
                                                      Plan.Onset(2), Parametros);
            Plan.LongitudAcondicionamiento = max(Plan.LongitudAcondicionamiento, LongitudPorCurvatura);
        end
        Plan.FuncionRoll = @(Arco, AnguloGirado) PerfilRollDelLoop(Arco, AnguloGirado, ...
                               EstadoEntrada, RollObjetivo, Plan.LongitudAcondicionamiento, Inclinacion);

        AjusteCierre = 0;
        for IteracionCierre = 1:Parametros.MaxIteracionesCierre
            Recorrido = RecorrerElemento(Plan, AjusteCierre);
            ResidualCierre = Recorrido.ResidualCierre;
            if abs(ResidualCierre) < Parametros.TolCierrePitch || ~isempty(Recorrido.Aviso)
                break
            end
            AjusteCierre = AjusteCierre + ResidualCierre;
        end

        OnsetMedido = OnsetVerticalDelRecorrido(Recorrido.Registro);
        if ~isempty(Recorrido.Aviso)
            break
        end

        % Puntos fijos, NO cortes al primer valor que cumple. Cortar por
        % cumplimiento haria que la geometria dependiera de forma discontinua
        % de los datos de entrada, y ahi los metodos A y B dejan de coincidir
        % aunque los dos esten bien.
        FactorSiguiente = (1 + Parametros.MargenDeOnset) * FactorLongitud ...
                          * OnsetMedido / Escala.OnsetMaximo(3);

        InclinacionSiguiente = Inclinacion;
        if AjustarInclinacion && Recorrido.LongitudDelLoop > 0
            FaltaDesplazamiento = Parametros.DesplazamientoLateralLoop - Recorrido.DesplazamientoLateral;
            InclinacionSiguiente = Inclinacion + FaltaDesplazamiento / Recorrido.LongitudDelLoop;
        end

        if abs(FactorSiguiente - FactorLongitud) < 1e-6*FactorLongitud && ...
           abs(InclinacionSiguiente - Inclinacion) < 1e-8
            break
        end
        FactorLongitud = FactorSiguiente;
        Inclinacion    = InclinacionSiguiente;
    end
    Inclinacion    = InclinacionUsada;
    FactorLongitud = FactorUsado;

    %% ---------------- Armado del Track ------------------------------------
    Registro = RecortarRegistro(Recorrido.Registro);

    Track.Nombre                  = 'LoopVertical';
    Track.ModoCurvatura           = Parametros.ModoCurvatura;
    Track.Puntos                  = Registro.Posicion;
    Track.LongitudArco            = Registro.Arco;
    Track.VersorTangente          = Registro.VersorTangente;
    Track.VersorArribaTransporte  = Registro.VersorArribaTransporte;
    Track.VersorLateralTransporte = Registro.VersorLateralTransporte;
    Track.VersorArribaCarro       = Registro.VersorArribaCarro;
    Track.VersorLateral           = Registro.VersorLateral;
    Track.VectorCurvatura         = Registro.VectorCurvatura;
    Track.Curvatura               = Registro.Curvatura;
    Track.AnguloRoll              = Registro.AnguloRoll;
    Track.VelocidadRoll           = Registro.VelocidadRoll;
    % La parte helicoidal del roll aporta a phi' pero su phi'' depende de
    % dkappa/ds, que no esta disponible dentro del paso: se recupera derivando
    % phi' sobre la polilinea ya construida.
    Track.AceleracionRoll         = gradient(Registro.VelocidadRoll, Registro.Arco);
    Track.AnguloGirado            = Registro.AnguloGirado;
    Track.SubTramos               = Recorrido.SubTramos;
    Track.VelocidadDeDiseno       = EstadoEntrada.Velocidad;
    Track.PasoGeneracion          = Parametros.PasoGeneracion;
    Track.NormalDelPlano          = NormalEnPlano;
    Track.InclinacionHelicoidal   = Inclinacion;
    Track.AnguloPeralte           = AnguloDePeralte(Registro.VersorTangente, Registro.VersorArribaCarro);
    Track.DerivadaCurvatura       = gradient(Registro.Curvatura, Registro.Arco);

    %% ---------------- Diagnostico -----------------------------------------
    Diagnostico.ResidualCierrePitch        = ResidualCierre;
    Diagnostico.IteracionesCierre          = IteracionCierre;
    Diagnostico.IteracionesAjuste          = IteracionAjuste;
    Diagnostico.AjusteCierre               = AjusteCierre;
    Diagnostico.InclinacionHelicoidal      = Inclinacion;
    Diagnostico.DesplazamientoLateral      = Recorrido.DesplazamientoLateral;
    Diagnostico.Aviso                      = Recorrido.Aviso;
    Diagnostico.CurvaturaEntradaEnPlano    = Plan.CurvaturaEnPlano;
    Diagnostico.CurvaturaEntradaFueraPlano = Plan.CurvaturaFueraPlano;
    Diagnostico.CurvaturaResidualFueraPlano = Recorrido.CurvaturaResidualFueraPlano;
    Diagnostico.LongitudAcondicionamiento  = Plan.LongitudAcondicionamiento;
    Diagnostico.LongitudClotoideEntrada    = Recorrido.LongitudClotoideEntrada;
    Diagnostico.LongitudClotoideSalida     = Recorrido.LongitudClotoideSalida;
    Diagnostico.DeltaRoll                  = DeltaRoll;
    Diagnostico.Escala                     = Escala;
    Diagnostico.FactorLongitudTransicion   = FactorLongitud;
    Diagnostico.OnsetVerticalGenerado      = OnsetMedido;

    % Perfil de velocidad que salio de la marcha acoplada. Es lo que el
    % metodo B realimenta en la iteracion siguiente.
    Diagnostico.PerfilVelocidad = struct('Arco', Registro.Arco, 'Velocidad', Registro.Velocidad);
    Diagnostico.TiempoDeRecorrido = Registro.Tiempo;
    Diagnostico.GArribaRiel       = Registro.GArribaRiel;
    Diagnostico.GLateralRiel      = Registro.GLateralRiel;
end

%% ========================= recorrido del elemento =========================
function Recorrido = RecorrerElemento(Plan, AjusteCierre)

    Parametros = Plan.Parametros;

    Contexto.Parametros                 = Parametros;
    Contexto.FuncionRoll                = Plan.FuncionRoll;
    Contexto.PerfilVelocidad            = Plan.PerfilVelocidad;
    Contexto.VelocidadMinimaDeSeguridad = 1e-3;
    Contexto.InclinacionHelicoidal      = 0;   % la fija el loop, no el acondicionamiento
    Contexto.FuncionCurvatura           = @(Punto) deal(0, 0);

    y    = Plan.EstadoInicialY;
    Arco = Plan.EstadoEntrada.LongitudAcumulada;

    Recorrido.Registro  = RegistroVacio(4000);
    Recorrido.SubTramos = struct('Nombre', {}, 'IndiceInicio', {}, 'IndiceFin', {});
    Recorrido.Aviso     = '';
    Recorrido.LongitudClotoideEntrada = 0;
    Recorrido.LongitudClotoideSalida  = 0;
    Recorrido.CurvaturaResidualFueraPlano = 0;
    Recorrido.ResidualCierre              = 0;
    Recorrido.DesplazamientoLateral       = 0;
    Recorrido.LongitudDelLoop             = 0;
    Recorrido.NormalArco   = Plan.NormalEnPlano;
    Recorrido.TangenteArco = Plan.EstadoEntrada.VersorTangente;
    Recorrido.PosicionArco = Plan.EstadoEntrada.Posicion;
    Recorrido.BinormalArco = cross(Plan.EstadoEntrada.VersorTangente, Plan.NormalEnPlano);

    %% --- AcondicionamientoEntrada ---
    if Plan.LongitudAcondicionamiento > 0
        ArcoInicio = Arco;
        Contexto.FuncionCurvatura = @(Punto) CurvaturaDeAcondicionamiento(Punto, ArcoInicio, Plan);
        Indice = Recorrido.Registro.NumeroDeNodos + 1;
        [Recorrido.Registro, y, Arco] = IntegrarTramo(Recorrido.Registro, y, Arco, Contexto, ...
                                                      Plan.LongitudAcondicionamiento, []);
        Recorrido.SubTramos(end+1) = struct('Nombre', 'AcondicionamientoEntrada', ...
            'IndiceInicio', Indice, 'IndiceFin', Recorrido.Registro.NumeroDeNodos);

        if y(13) <= 0
            Recorrido = TerminarSinEnergia(Recorrido, y, Arco, Contexto, 'el acondicionamiento');
            return
        end
    end

    %% --- El plano de referencia del loop se fija recien aca: el
    %%     acondicionamiento pudo haber sacado la tangente del plano de entrada. ---
    NormalArco = NormalDelPlanoVertical(y(4:6));
    BetaArco   = atan2(dot(NormalArco, y(10:12)), dot(NormalArco, y(7:9)));

    Recorrido.NormalArco    = NormalArco;
    Recorrido.TangenteArco  = y(4:6);
    Recorrido.PosicionArco  = y(1:3);
    Recorrido.BinormalArco  = cross(y(4:6), NormalArco);
    ArcoInicioLoop = Arco;

    % La direccion de la curvatura gira dentro del marco de transporte a razon
    % kappa*tan(alfa). Con alfa nulo el loop es plano, y un giro de 2*pi dentro
    % de un plano vuelve a pasar por donde entro: la via se choca consigo misma
    % siempre. La inclinacion helicoidal es lo que separa la pata de salida de
    % la de entrada.
    %
    % Por que proporcional al GIRO ACUMULADO y no al arco: se busca una helice
    % de eje horizontal B, o sea que la tangente mantenga T.B = sin(alfa)
    % constante. Eso exige que el vector curvatura no tenga componente sobre B,
    % y de ahi sale torsion = kappa*tan(alfa). Con torsion constante en su
    % lugar, el desplazamiento lateral deja de ser monotono en cuanto kappa
    % varia -- se va para un lado y vuelve -- y el loop se sigue chocando.
    AnguloGiradoInicio = y(14);
    AnguloDeCurvatura = @(Punto) BetaArco + Plan.Inclinacion*(Punto.AnguloGirado - AnguloGiradoInicio);
    Contexto.InclinacionHelicoidal = Plan.Inclinacion;

    [CurvaturaArriba, CurvaturaLateral] = Contexto.FuncionCurvatura(PuntoCinematico(Arco, y, Contexto));
    VectorCurvatura = CurvaturaArriba*y(7:9) + CurvaturaLateral*y(10:12);
    CurvaturaInicialArco = dot(VectorCurvatura, NormalArco);
    Recorrido.CurvaturaResidualFueraPlano = dot(VectorCurvatura, cross(y(4:6), NormalArco));

    %% --- ClotoideEntrada ---
    % Las longitudes de las transiciones se dimensionan con la velocidad REAL
    % de la marcha, no con el perfil supuesto del metodo B. Son decisiones
    % geometricas de diseno: lo que el perfil supuesto rompe es el lazo de la
    % LEY DE CURVATURA, no el dimensionamiento. Ademas, con esto la geometria
    % del modo Clotoide queda completamente independiente del perfil supuesto
    % y los dos metodos coinciden exactamente, que es lo que el test pide.
    PuntoInicial = PuntoCinematico(Arco, y, Contexto);
    CurvaturaObjetivo = CurvaturaDelModo(PuntoInicial, Parametros, Plan.Escala, PuntoInicial.Tiempo);
    LongitudEntrada = LongitudDeClotoide(PuntoInicial.Velocidad, ...
                                         CurvaturaObjetivo - CurvaturaInicialArco, Plan.Onset(3), Parametros);
    Recorrido.LongitudClotoideEntrada = LongitudEntrada;

    ArcoInicio = Arco;
    TiempoReferencia = y(15);
    Contexto.FuncionCurvatura = @(Punto) ProyectarCurvatura( ...
        MezclaDeClotoide(Punto, ArcoInicio, LongitudEntrada, CurvaturaInicialArco, ...
                         Parametros, Plan.Escala, TiempoReferencia), AnguloDeCurvatura(Punto));

    Indice = Recorrido.Registro.NumeroDeNodos + 1;
    [Recorrido.Registro, y, Arco] = IntegrarTramo(Recorrido.Registro, y, Arco, Contexto, LongitudEntrada, []);
    Recorrido.SubTramos(end+1) = struct('Nombre', 'ClotoideEntrada', ...
        'IndiceInicio', Indice, 'IndiceFin', Recorrido.Registro.NumeroDeNodos);

    if y(13) <= 0
        Recorrido = TerminarSinEnergia(Recorrido, y, Arco, Contexto, 'la clotoide de entrada');
        return
    end

    %% --- ArcoLoop ---
    TiempoReferenciaArco = y(15);
    Contexto.FuncionCurvatura = @(Punto) ProyectarCurvatura( ...
        CurvaturaDelModo(Punto, Parametros, Plan.Escala, TiempoReferenciaArco), AnguloDeCurvatura(Punto));

    ArcoQueFalta = @(Punto) (2*pi - AjusteCierre - Punto.AnguloGirado ...
                             - GiroDeLaClotoideDeSalida(Punto, Plan)) / max(Punto.Curvatura, eps);

    Indice = Recorrido.Registro.NumeroDeNodos + 1;
    [Recorrido.Registro, y, Arco] = IntegrarTramo(Recorrido.Registro, y, Arco, Contexto, 50, ArcoQueFalta);
    Recorrido.SubTramos(end+1) = struct('Nombre', 'ArcoLoop', ...
        'IndiceInicio', Indice, 'IndiceFin', Recorrido.Registro.NumeroDeNodos);

    if y(13) <= 0
        Recorrido = TerminarSinEnergia(Recorrido, y, Arco, Contexto, 'el arco del loop');
        return
    end

    %% --- ClotoideSalida ---
    [~, PuntoFinArco] = DerivadaDeVia(Arco, y, Contexto);
    CurvaturaFinArco = PuntoFinArco.Curvatura;
    LongitudSalida = LongitudDeClotoide(PuntoFinArco.Velocidad, CurvaturaFinArco, ...
                                        Plan.Onset(3), Parametros);
    Recorrido.LongitudClotoideSalida = LongitudSalida;

    ArcoInicio = Arco;
    Contexto.FuncionCurvatura = @(Punto) ProyectarCurvatura( ...
        CurvaturaFinArco * (1 - FraccionDeTramo(Punto.Arco, ArcoInicio, LongitudSalida)), AnguloDeCurvatura(Punto));

    Indice = Recorrido.Registro.NumeroDeNodos + 1;
    [Recorrido.Registro, y, Arco] = IntegrarTramo(Recorrido.Registro, y, Arco, Contexto, LongitudSalida, []);

    [~, Recorrido.PuntoFinal] = DerivadaDeVia(Arco, y, Contexto);
    Recorrido.Registro = AgregarNodo(Recorrido.Registro, Recorrido.PuntoFinal);
    Recorrido.SubTramos(end+1) = struct('Nombre', 'ClotoideSalida', ...
        'IndiceInicio', Indice, 'IndiceFin', Recorrido.Registro.NumeroDeNodos);

    % El cierre se mide sobre la ROTACION DENTRO DEL PLANO del loop, no sobre
    % el angulo total girado: con torsion la tangente sale con una componente
    % lateral chica y el angulo total ya no vuelve a 2*pi cuando el pitch si
    % cerro. Proyectar sobre la base {T_arco, N_arco} aisla el pitch.
    TangenteFinal = Recorrido.PuntoFinal.VersorTangente;
    Recorrido.ResidualCierre = atan2(dot(TangenteFinal, Recorrido.NormalArco), ...
                                     dot(TangenteFinal, Recorrido.TangenteArco));
    Recorrido.DesplazamientoLateral = dot(Recorrido.PuntoFinal.Posicion - Recorrido.PosicionArco, ...
                                          Recorrido.BinormalArco);

    % Longitud del loop propiamente dicho. Como la tangente mantiene
    % T.B = sin(alfa) constante, el desplazamiento lateral vale sin(alfa) por
    % esta longitud: es la pendiente exacta para el paso de Newton.
    Recorrido.LongitudDelLoop = Arco - ArcoInicioLoop;
end

%% ========================= auxiliares =====================================
function Recorrido = TerminarSinEnergia(Recorrido, y, Arco, Contexto, DondeTexto)
    [~, Recorrido.PuntoFinal] = DerivadaDeVia(Arco, y, Contexto);
    Recorrido.Registro = AgregarNodo(Recorrido.Registro, Recorrido.PuntoFinal);
    if ~isempty(Recorrido.SubTramos)
        Recorrido.SubTramos(end).IndiceFin = Recorrido.Registro.NumeroDeNodos;
    end
    Recorrido.Aviso = sprintf('El carro se quedo sin energia en %s.', DondeTexto);
end

function [CurvaturaArriba, CurvaturaLateral] = ProyectarCurvatura(Curvatura, AnguloDeCurvatura)
%PROYECTARCURVATURA Reparte la curvatura sobre el marco de transporte segun el
%   angulo que forma con el. En una curva plana ese angulo es constante; que
%   avance linealmente con el arco es exactamente imponer torsion constante, y
%   es lo que convierte el loop plano en helicoidal.
    CurvaturaArriba  = Curvatura * cos(AnguloDeCurvatura);
    CurvaturaLateral = Curvatura * sin(AnguloDeCurvatura);
end

function [CurvaturaArriba, CurvaturaLateral] = CurvaturaDeAcondicionamiento(Punto, ArcoInicio, Plan)
%CURVATURADEACONDICIONAMIENTO Rampa a cero la componente de curvatura que
%   sale del plano del loop, manteniendo la que ya esta en el plano.
    Fraccion = FraccionDeTramo(Punto.Arco, ArcoInicio, Plan.LongitudAcondicionamiento);
    CurvaturaFuera = (1 - Fraccion) * Plan.CurvaturaFueraPlano;
    CurvaturaArriba  = Plan.CurvaturaEnPlano*cos(Plan.Beta) - CurvaturaFuera*sin(Plan.Beta);
    CurvaturaLateral = Plan.CurvaturaEnPlano*sin(Plan.Beta) + CurvaturaFuera*cos(Plan.Beta);
end

function Curvatura = MezclaDeClotoide(Punto, ArcoInicio, Longitud, CurvaturaInicial, Parametros, Escala, TiempoReferencia)
%MEZCLADECLOTOIDE Rampa lineal entre la curvatura de entrada y la que pide el
%   modo. Con el modo Clotoide la curvatura objetivo es constante y esto es
%   exactamente una clotoide: dkappa/ds constante.
    Fraccion = FraccionDeTramo(Punto.Arco, ArcoInicio, Longitud);
    CurvaturaObjetivo = CurvaturaDelModo(Punto, Parametros, Escala, TiempoReferencia);
    Curvatura = (1 - Fraccion)*CurvaturaInicial + Fraccion*CurvaturaObjetivo;
end

function Giro = GiroDeLaClotoideDeSalida(Punto, Plan)
%GIRODELACLOTOIDEDESALIDA Angulo que va a girar la clotoide de salida si el
%   arco terminara en este punto. Con la rampa lineal es el area del
%   triangulo: kappa/2 * L.
    Longitud = LongitudDeClotoide(Punto.Velocidad, Punto.Curvatura, ...
                                  Plan.Onset(3), Plan.Parametros);
    Giro = 0.5 * Punto.Curvatura * Longitud;
end

function Fraccion = FraccionDeTramo(Arco, ArcoInicio, Longitud)
    Fraccion = min(max((Arco - ArcoInicio)/max(Longitud, eps), 0), 1);
end

function Normal = NormalDelPlanoVertical(VersorTangente)
%NORMALDELPLANOVERTICAL Versor normal "hacia arriba" dentro del plano
%   vertical que contiene a la tangente: la tangente rotada +90 grados dentro
%   de ese plano. En una curva plana es exactamente lo que el transporte
%   paralelo propaga, asi que no hay conflicto entre las dos definiciones.
    Horizontal = [VersorTangente(1), VersorTangente(2), 0];
    Horizontal = Horizontal / norm(Horizontal);
    CosPitch   = norm(VersorTangente(1:2));
    Normal     = -VersorTangente(3)*Horizontal + CosPitch*[0 0 1];
    Normal     = Normal / norm(Normal);
end

function [AnguloRoll, VelocidadRoll, AceleracionRoll] = PerfilRollDelLoop(Arco, AnguloGirado, EstadoEntrada, RollBase, LongitudAcondicionamiento, Inclinacion)
%PERFILROLLDELLOOP Roll del elemento: transicion quintica al roll del loop y,
%   encima de eso, la parte helicoidal proporcional al angulo ya girado.
%
%   Que el numero del roll avance NO es un peralte agregado: el roll se mide
%   contra el marco de transporte, que gira respecto de la normal de la curva
%   a razon de la torsion. Seguir esa misma razon es exactamente mantener el
%   eje "arriba" del carro alineado con el vector curvatura, que es la
%   orientacion natural. Por eso el carro sale del loop derecho aunque el
%   numero de phi no termine en cero.
%
%   La derivada de la parte helicoidal la completa DerivadaDeVia, que es donde
%   recien se conoce la curvatura: dphi/ds = kappa*tan(alfa).

    ArcoLocal = Arco - EstadoEntrada.LongitudAcumulada;
    [AnguloRoll, VelocidadRoll, AceleracionRoll] = PerfilRollQuintico( ...
        EstadoEntrada.AnguloRoll, RollBase, LongitudAcondicionamiento, ArcoLocal);

    AnguloRoll = AnguloRoll + Inclinacion*AnguloGirado;
end

function Angulo = AjustarAngulo(Angulo)
    Angulo = mod(Angulo + pi, 2*pi) - pi;
end

function Peralte = AnguloDePeralte(VersorTangente, VersorArribaCarro)
%ANGULODEPERALTE Inclinacion del eje "arriba" del carro medida contra la
%   vertical, girando alrededor de la tangente. Es el peralte que se ve
%   mirando la via, y NO coincide con AnguloRoll: ese esta medido contra el
%   marco de transporte, que va girando por su cuenta a razon de la torsion.
%   Un roll de 50 grados con peralte casi nulo significa que giro la
%   referencia, no el carro.

    NumeroDeNodos = size(VersorTangente, 1);
    Horizontal = [VersorTangente(:,1), VersorTangente(:,2), zeros(NumeroDeNodos,1)];
    NormaHorizontal = vecnorm(Horizontal, 2, 2);

    Normal = -VersorTangente(:,3).*(Horizontal ./ max(NormaHorizontal, eps)) ...
           + NormaHorizontal.*[0 0 1];
    Normal = Normal ./ max(vecnorm(Normal, 2, 2), eps);
    Binormal = cross(VersorTangente, Normal, 2);

    Peralte = atan2(sum(VersorArribaCarro.*Binormal, 2), sum(VersorArribaCarro.*Normal, 2));
    Peralte(NormaHorizontal < 1e-9) = NaN;   % tangente vertical: no esta definido
end

function Onset = OnsetVerticalDelRecorrido(Registro)
%ONSETVERTICALDELRECORRIDO Tasa de aparicion de la G vertical sobre el riel,
%   medida sobre el recorrido recien generado. Se usa para realimentar la
%   longitud de las transiciones. Es la G del riel, no la de la heartline: el
%   aporte de heartline depende de phi'' y lo dimensiona el onset lateral.
    n = Registro.NumeroDeNodos;
    if n < 3
        Onset = 0;
        return
    end
    Arco = Registro.Arco(1:n);
    Onset = max(abs(gradient(Registro.GArribaRiel(1:n), Arco) .* Registro.Velocidad(1:n)));
end

function Longitud = LongitudDeClotoide(Velocidad, DeltaCurvatura, Onset, Parametros)
%LONGITUDDECLOTOIDE L = DeltaG*v/Onset, escrita en funcion de la curvatura.
%   DeltaG = v^2*DeltaKappa/g, de modo que L = v^3*|DeltaKappa|/(g*Onset).
%   Es la misma relacion que dkappa/ds = Onset*g/v^3, escrita al reves.
    Longitud = Velocidad^3 * abs(DeltaCurvatura) / (Parametros.Gravedad * Onset);
    Longitud = max(Longitud, 2*Parametros.PasoGeneracion);
end

function Longitud = LongitudTransicionDeRoll(DeltaRoll, Velocidad, Onset, Parametros)
%LONGITUDTRANSICIONDEROLL Dimensiona la transicion de roll por el onset lateral.
%   Con el smoothstep quintico max|phi'''| = 60*|DeltaRoll|/L^3, y la G lateral
%   de la heartline vale d*v^2*phi''/g, asi que su tasa de aparicion es
%   d*v^3*phi'''/g. Despejando L:
%       L = (60*d*v^3*|DeltaRoll| / (g*Onset))^(1/3)
    if abs(DeltaRoll) < 1e-9
        Longitud = 0;
        return
    end
    Distancia = Parametros.DistanciaHeartline;
    if Distancia <= 0
        Longitud = Parametros.LargoCarro;   % sin heartline el criterio de onset no aplica
        return
    end
    Longitud = (60*Distancia*Velocidad^3*abs(DeltaRoll) / (Parametros.Gravedad*Onset))^(1/3);
    Longitud = max(Longitud, Parametros.LargoCarro);
end
