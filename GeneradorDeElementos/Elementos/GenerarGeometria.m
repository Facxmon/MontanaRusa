function [Track, Diagnostico] = GenerarGeometria(EstadoEntrada, Parametros, Receta, PerfilVelocidad)
%GENERARGEOMETRIA Motor de generacion, comun a todos los elementos de via.
%   Lo usan los dos metodos de acoplamiento: el metodo A no pasa perfil de
%   velocidad (la curvatura se evalua con la v que lleva la marcha) y el
%   metodo B pasa el perfil supuesto de la iteracion anterior.
%
%   Sub-tramos, en orden:
%     AcondicionamientoEntrada  lleva a cero la curvatura fuera del plano de
%                               referencia y el roll al que el elemento pide
%     ClotoideEntrada           rampa de curvatura desde kappa_0 (desplazada
%                               si la entrada ya venia curvada)
%     ArcoPrincipal             curvatura segun el modo elegido
%     ClotoideSalida            rampa de curvatura de vuelta a cero
%
%   Las rampas de curvatura son suaves (smoothstep a la entrada, Hermite a
%   la salida) y no lineales: dkappa/ds es continua en todas las fronteras,
%   asi que el roll helicoidal (phi' = tan(alfa)*kappa) queda C2 y la G
%   lateral no da escalones. Se las sigue llamando clotoides por su rol,
%   no por su ley; ver MezclaDeClotoide y RampaDeSalida.
%
%   Todos los elementos son el mismo objeto geometrico: un giro de un angulo
%   dado alrededor de un eje, con una ley de roll encima. Lo que los distingue
%   entra por la Receta:
%
%     Receta.Nombre                 texto para el reporte y los graficos
%     Receta.GiroObjetivo           angulo total a girar [rad]
%     Receta.DesfasajeDeCurvatura   angulo entre el vector curvatura y el eje
%                                   "arriba" sin peralte. 0 deja la curvatura
%                                   en el plano vertical (loop, dive loop);
%                                   +-pi/2 la deja horizontal (giros, helice)
%     Receta.RollDelElemento        roll del carro respecto de la vertical:
%                                   0 loop, pi dive loop, el peralte en giros
%     Receta.DesplazamientoObjetivo avance sobre el eje de la helice [m]. En el
%                                   loop separa las dos patas; en la helice es
%                                   directamente cuanto sube
%
%   El arco se corta cuando el angulo ya girado mas lo que va a girar la
%   clotoide de salida llega a GiroObjetivo. Esa prediccion no es exacta cuando
%   la curvatura depende de v, asi que el residual de cierre se corrige con
%   unas pocas iteraciones de secante y se reporta siempre.
%
%   HIPOTESIS DEL EJE DE ROLL (la misma en todo el generador):
%     Se prescribe el RIEL: es la curva que se integra, unit-speed en s, y el
%     eje alrededor del cual rola el carro. La heartline del pasajero se
%     despeja de el, r_h = r + d*U, y por eso sobre un riel recto que rola la
%     heartline hace una helice: el pasajero rota respecto de la via.
%     Brazos de palanca, medidos desde el riel sobre U:
%       d      = DistanciaHeartline          centro de masa; energia, fuerza
%                                            normal y reparto entre ruedas
%       b      = BrazoDeVerificacion         punto donde los modos imponen la
%                                            G objetivo y donde se la verifica
%                                            contra la norma (d, o d + e si se
%                                            pide la cabeza)
%       d + e  = d + DistanciaHeartlineACabeza  cabeza; G informativa
%     Con brazo b la transicion de roll se dimensiona (LongitudTransicionDeRoll)
%     y con el mismo b se verifica (SimularSobreTrack). Derivacion en
%     memoria_de_calculo.md, seccion 3.

    if nargin < 4
        PerfilVelocidad = [];
    end

    Escala = EscalasDeFroude(Parametros);

    %% ---------------- Marco y curvatura del estado de entrada -------------
    VersorTangenteEntrada = EstadoEntrada.VersorTangente;
    if norm(VersorTangenteEntrada(1:2)) < 1e-9
        error('GenerarGeometria:TangenteVertical', ...
             ['La tangente de entrada es vertical pura: el plano del loop queda ' ...
              'indeterminado. Hace falta dar el azimut del plano como dato.']);
    end

    [VersorArribaTransporteEntrada, VersorLateralTransporteEntrada] = MarcoTransporteDesdeCarro( ...
        EstadoEntrada.VersorArribaCarro, EstadoEntrada.VersorLateral, EstadoEntrada.AnguloRoll);

    NormalEnPlano = NormalDelPlanoVertical(VersorTangenteEntrada);
    Beta = atan2(dot(NormalEnPlano, VersorLateralTransporteEntrada), ...
                 dot(NormalEnPlano, VersorArribaTransporteEntrada));

    % Direccion en la que el elemento impone la curvatura: la vertical del
    % plano rotada por el desfasaje. Todo lo que la curvatura de entrada tenga
    % perpendicular a esa direccion lo tiene que sacar el acondicionamiento.
    DireccionDeCurvatura = cos(Receta.DesfasajeDeCurvatura)*NormalEnPlano ...
                         + sin(Receta.DesfasajeDeCurvatura)*cross(VersorTangenteEntrada, NormalEnPlano);

    %% ---------------- Plan del elemento -----------------------------------
    Plan.Parametros          = Parametros;
    Plan.Receta              = Receta;
    Plan.Escala              = Escala;
    Plan.Onset               = Escala.OnsetMaximo;
    Plan.EstadoEntrada       = EstadoEntrada;
    Plan.PerfilVelocidad     = PerfilVelocidad;
    Plan.NormalEnPlano       = NormalEnPlano;
    Plan.Beta                = Beta;
    Plan.CurvaturaParalela      = dot(EstadoEntrada.VectorCurvatura, DireccionDeCurvatura);
    Plan.CurvaturaPerpendicular = dot(EstadoEntrada.VectorCurvatura, ...
                                      cross(VersorTangenteEntrada, DireccionDeCurvatura));
    Plan.EstadoInicialY = [EstadoEntrada.Posicion, VersorTangenteEntrada, ...
                           VersorArribaTransporteEntrada, VersorLateralTransporteEntrada, ...
                           EstadoEntrada.Velocidad^2, 0, 0];

    % El roll que pide el elemento y cuanto hay que girar para llegar. El
    % numero de phi es continuo entre elementos y puede traer vueltas
    % acumuladas, asi que la diferencia cruda puede superar pi en modulo: en
    % ese caso se envuelve a (-pi, pi] para ir por el camino corto. Si la
    % diferencia cruda ya esta dentro de [-pi, pi] se conserva tal cual,
    % incluido su signo en +-pi exacto (el dive loop entra con +pi y rola
    % hacia ese lado). La transicion quintica recorre ESTE DeltaRoll, el
    % mismo con el que se dimensiona su longitud: si recorriera la
    % diferencia cruda sin envolver, un objetivo a -5.9 rad se haria en una
    % longitud dimensionada para 0.37 rad y phi' saldria fuera de todo
    % presupuesto (pasaba al encadenar tras un dive loop que sale peraltado).
    DeltaRollCrudo = Beta + Receta.RollDelElemento - EstadoEntrada.AnguloRoll;
    if abs(DeltaRollCrudo) <= pi + 1e-9
        DeltaRoll = DeltaRollCrudo;
    else
        DeltaRoll = AjustarAngulo(DeltaRollCrudo);
    end
    RollObjetivo = EstadoEntrada.AnguloRoll + DeltaRoll;

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
                         Receta.DesplazamientoObjetivo ~= 0;
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
        if abs(Plan.CurvaturaPerpendicular) > 1e-9
            LongitudPorCurvatura = LongitudDeClotoide(EstadoEntrada.Velocidad, Plan.CurvaturaPerpendicular, ...
                                                      Plan.Onset(2), Parametros);
            Plan.LongitudAcondicionamiento = max(Plan.LongitudAcondicionamiento, LongitudPorCurvatura);
        end
        Plan.FuncionRoll = @(Arco, AnguloGirado) PerfilRollDelElemento(Arco, AnguloGirado, ...
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

        % phi'' completo y G lateral corregida sobre la polilinea, antes de
        % medir el onset: el lazo tiene que ver la misma G que la simulacion.
        Recorrido.Registro = CompletarAceleracionRoll(Recorrido.Registro, Parametros);
        [OnsetMedido, OnsetLateralMedido] = OnsetDelRecorrido(Recorrido.Registro);
        if ~isempty(Recorrido.Aviso)
            break
        end

        % Puntos fijos, NO cortes al primer valor que cumple. Cortar por
        % cumplimiento haria que la geometria dependiera de forma discontinua
        % de los datos de entrada, y ahi los metodos A y B dejan de coincidir
        % aunque los dos esten bien. Realimenta el eje que peor esta respecto
        % de su presupuesto: el vertical (clotoides) o el lateral (transicion
        % de roll y sub-peralte).
        OnsetRelativo = max(OnsetMedido / Escala.OnsetMaximo(3), OnsetLateralMedido / Escala.OnsetMaximo(2));
        FactorSiguiente = (1 + Parametros.MargenDeOnset) * FactorLongitud * OnsetRelativo;

        InclinacionSiguiente = Inclinacion;
        if AjustarInclinacion && Recorrido.LongitudDelGiro > 0
            FaltaDesplazamiento = Receta.DesplazamientoObjetivo - Recorrido.DesplazamientoLateral;
            InclinacionSiguiente = Inclinacion + FaltaDesplazamiento / Recorrido.LongitudDelGiro;
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

    Track.Nombre                  = Receta.Nombre;
    Track.ModoCurvatura           = Parametros.ModoCurvatura;
    Track.Receta                  = Receta;
    Track.PuntosRiel              = Registro.Posicion;
    Track.LongitudArco            = Registro.Arco;       % arco del RIEL
    Track.VersorTangente          = Registro.VersorTangente;
    Track.VersorArribaTransporte  = Registro.VersorArribaTransporte;
    Track.VersorLateralTransporte = Registro.VersorLateralTransporte;
    Track.VersorArribaCarro       = Registro.VersorArribaCarro;
    Track.VersorLateral           = Registro.VersorLateral;
    Track.VectorCurvatura         = Registro.VectorCurvatura;
    Track.Curvatura               = Registro.Curvatura;
    Track.AnguloRoll              = Registro.AnguloRoll;
    Track.VelocidadRoll           = Registro.VelocidadRoll;
    % phi'' completo: la parte helicoidal la recupero CompletarAceleracionRoll
    % derivando phi' sobre la polilinea, y es el mismo phi'' que vio el lazo
    % de onset.
    Track.AceleracionRoll         = Registro.AceleracionRoll;
    Track.AnguloGirado            = Registro.AnguloGirado;
    Track.SubTramos               = Recorrido.SubTramos;
    Track.VelocidadDeDiseno       = EstadoEntrada.Velocidad;
    Track.PasoGeneracion          = Parametros.PasoGeneracion;
    Track.NormalDelPlano          = NormalEnPlano;
    Track.InclinacionHelicoidal   = Inclinacion;
    Track.AnguloPeralte           = AnguloDePeralte(Registro.VersorTangente, Registro.VersorArribaCarro);
    % Angulo de la curvatura del riel medido desde U hacia L en el marco del
    % carro. En loop y dive loop es 0 salvo donde el modo lo desalinea a
    % proposito (sub-peralte); en los giros es el complemento del peralte.
    Track.AnguloCurvaturaDesdeArriba = atan2(Registro.CurvaturaLateralCarro, Registro.CurvaturaArribaCarro);
    Track.AnguloCurvaturaDesdeArriba(Registro.Curvatura < 1e-9) = 0;
    Track.DerivadaCurvatura       = gradient(Registro.Curvatura, Registro.Arco);

    % --- Heartline: la curva integrada es el riel, la heartline se deriva ----
    % La heartline va desplazada +d*U respecto del riel y es donde va el
    % centro de masa del pasajero. Como U gira con el roll, sobre un riel
    % recto que rola la heartline sale helicoidal. Su curvatura NO es la del
    % riel -- esa es exactamente la diferencia que motiva toda esta
    % separacion -- asi que se calcula aparte: es la que hay que contrastar
    % contra el radio nominal de diseno. La del riel (Track.Curvatura, exacta,
    % impuesta) es la que se contrasta contra el radio minimo fabricable.
    [Track.PuntosHeartline, Track.LongitudArcoHeartline, Track.CurvaturaHeartline] = ...
        DerivarHeartline(Registro.Posicion, Registro.VersorArribaCarro, Registro.Arco, Parametros);
    Track.VelocidadCentroDeMasa    = Registro.VelocidadCentroDeMasa;
    Track.FactorVelocidadHeartline = Registro.FactorVelocidadHeartline;

    %% ---------------- Diagnostico -----------------------------------------
    Diagnostico.ResidualCierrePitch        = ResidualCierre;
    Diagnostico.IteracionesCierre          = IteracionCierre;
    Diagnostico.IteracionesAjuste          = IteracionAjuste;
    Diagnostico.AjusteCierre               = AjusteCierre;
    Diagnostico.InclinacionHelicoidal      = Inclinacion;
    Diagnostico.DesplazamientoLateral      = Recorrido.DesplazamientoLateral;
    Diagnostico.Aviso                      = Recorrido.Aviso;
    Diagnostico.CurvaturaEntradaParalela      = Plan.CurvaturaParalela;
    Diagnostico.CurvaturaEntradaPerpendicular = Plan.CurvaturaPerpendicular;
    Diagnostico.CurvaturaResidualFueraPlano = Recorrido.CurvaturaResidualFueraPlano;
    Diagnostico.LongitudAcondicionamiento  = Plan.LongitudAcondicionamiento;
    Diagnostico.LongitudClotoideEntrada    = Recorrido.LongitudClotoideEntrada;
    Diagnostico.LongitudClotoideSalida     = Recorrido.LongitudClotoideSalida;
    Diagnostico.DeltaRoll                  = DeltaRoll;
    Diagnostico.Escala                     = Escala;
    Diagnostico.FactorLongitudTransicion   = FactorLongitud;
    Diagnostico.OnsetVerticalGenerado      = OnsetMedido;
    Diagnostico.OnsetLateralGenerado       = OnsetLateralMedido;

    % Perfil de velocidad que salio de la marcha acoplada. Es lo que el
    % metodo B realimenta en la iteracion siguiente.
    % Es la velocidad del centro de masa: la que usan los modos de curvatura.
    Diagnostico.PerfilVelocidad = struct('Arco', Registro.Arco, 'Velocidad', Registro.VelocidadCentroDeMasa);
    Diagnostico.TiempoDeRecorrido    = Registro.Tiempo;
    Diagnostico.GArribaHeartline     = Registro.GArribaHeartline;
    Diagnostico.GLateralHeartline    = Registro.GLateralHeartline;
    Diagnostico.GArribaVerificacion  = Registro.GArribaVerificacion;
    Diagnostico.GLateralVerificacion = Registro.GLateralVerificacion;
end

%% ========================= derivacion de la heartline =====================
function [PuntosHeartline, ArcoHeartline, CurvaturaHeartline] = DerivarHeartline(PuntosRiel, VersorArribaCarro, Arco, Parametros)
%DERIVARHEARTLINE Heartline a partir del riel: r_h = r_riel + d*U.
%   La curvatura de la heartline se saca con kappa = |r' x r''|/|r'|^3
%   derivando respecto del arco DEL RIEL. La formula del producto vectorial
%   vale para cualquier parametrizacion, asi que no hace falta reparametrizar
%   la heartline por su propio arco: alcanza con no suponer |r'| = 1, que es
%   justamente lo que deja de valer al desplazar la curva (|r'| es el factor
%   J de DerivadaDeVia).
%
%   Los nodos repetidos se filtran antes de derivar. Aparecen cuando un
%   sub-tramo termina con un paso acortado, y sobre una segunda derivada un
%   paso nulo no da ruido sino un infinito.

    Distancia       = Parametros.DistanciaHeartline;
    PuntosHeartline = PuntosRiel + Distancia*VersorArribaCarro;

    ArcoHeartline = [0; cumsum(vecnorm(diff(PuntosHeartline, 1, 1), 2, 2))] + Arco(1);

    Primera = DerivadaPorArco(PuntosHeartline, Arco);
    Segunda = DerivadaPorArco(Primera,         Arco);

    NormaPrimera       = vecnorm(Primera, 2, 2);
    CurvaturaHeartline = vecnorm(cross(Primera, Segunda, 2), 2, 2) ./ max(NormaPrimera.^3, eps);
end

%% ========================= recorrido del elemento =========================
function Recorrido = RecorrerElemento(Plan, AjusteCierre)

    Parametros = Plan.Parametros;

    Contexto.Parametros                 = Parametros;
    Contexto.FuncionRoll                = Plan.FuncionRoll;
    Contexto.PerfilVelocidad            = Plan.PerfilVelocidad;
    Contexto.VelocidadMinimaDeSeguridad = 1e-3;
    Contexto.InclinacionHelicoidal      = 0;   % la fija el arco, no el acondicionamiento
    Contexto.AnguloGiradoDeReferencia   = 0;
    Contexto.FuncionCurvatura           = @(Punto) deal(0, 0);
    % Direccion en la que el elemento pide la curvatura, en el marco de
    % transporte. Hasta que arranca el arco es la del plano de entrada; el
    % arco la reemplaza por la suya, que ademas gira con la helice.
    Contexto.FuncionAnguloDeCurvatura   = @(Punto) Plan.Beta + Plan.Receta.DesfasajeDeCurvatura;

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
    Recorrido.LongitudDelGiro             = 0;
    Recorrido.NormalArco      = Plan.NormalEnPlano;
    Recorrido.TangenteArco    = Plan.EstadoEntrada.VersorTangente;
    Recorrido.PosicionArco    = Plan.EstadoEntrada.Posicion;
    Recorrido.DireccionDeGiro = Plan.NormalEnPlano;
    Recorrido.EjeDeLaHelice   = cross(Plan.EstadoEntrada.VersorTangente, Plan.NormalEnPlano);

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

    Recorrido.NormalArco   = NormalArco;
    Recorrido.TangenteArco = y(4:6);
    Recorrido.PosicionArco = y(1:3);
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
    %
    % El desfasaje es lo que distingue las dos familias de elementos: con 0 la
    % curvatura queda en el plano vertical y sale un loop; con +-pi/2 queda
    % horizontal y sale un giro. El roll va por su lado, asi que un giro puede
    % estar peraltado lo que se quiera sin tocar la curvatura.
    AnguloGiradoInicio = y(14);
    Contexto.AnguloGiradoDeReferencia = AnguloGiradoInicio;
    AnguloDeCurvatura = @(Punto) BetaArco + Plan.Receta.DesfasajeDeCurvatura ...
                                 + Plan.Inclinacion*(Punto.AnguloGirado - AnguloGiradoInicio);
    Contexto.InclinacionHelicoidal    = Plan.Inclinacion;
    Contexto.FuncionAnguloDeCurvatura = AnguloDeCurvatura;

    % Base en la que se mide el giro y el avance sobre el eje de la helice:
    % e1 es la tangente al empezar el arco y e2 la direccion de la curvatura
    % ahi mismo. El eje de la helice es e1 x e2, que para un loop da la lateral
    % y para un giro da la vertical: el mismo parametro separa las patas del
    % loop y hace subir la helice.
    AnguloInicialCurvatura = AnguloDeCurvatura(PuntoCinematico(Arco, y, Contexto));
    Recorrido.DireccionDeGiro = cos(AnguloInicialCurvatura)*y(7:9) + sin(AnguloInicialCurvatura)*y(10:12);
    Recorrido.EjeDeLaHelice   = cross(y(4:6), Recorrido.DireccionDeGiro);

    [CurvaturaArriba, CurvaturaLateral] = Contexto.FuncionCurvatura(PuntoCinematico(Arco, y, Contexto));
    VectorCurvatura = CurvaturaArriba*y(7:9) + CurvaturaLateral*y(10:12);
    CurvaturaInicialArco = dot(VectorCurvatura, Recorrido.DireccionDeGiro);
    Recorrido.CurvaturaResidualFueraPlano = dot(VectorCurvatura, Recorrido.EjeDeLaHelice);

    %% --- ClotoideEntrada ---
    % Las longitudes de las transiciones se dimensionan con la velocidad REAL
    % de la marcha, no con el perfil supuesto del metodo B. Son decisiones
    % geometricas de diseno: lo que el perfil supuesto rompe es el lazo de la
    % LEY DE CURVATURA, no el dimensionamiento. Ademas, con esto la geometria
    % del modo Clotoide queda completamente independiente del perfil supuesto
    % y los dos metodos coinciden exactamente, que es lo que el test pide.
    % El punto inicial se evalua con DerivadaDeVia y no con PuntoCinematico
    % porque la velocidad del riel, que es la que dimensiona la clotoide,
    % recien se conoce con la curvatura (la del estado de entrada, aca).
    [~, PuntoInicial] = DerivadaDeVia(Arco, y, Contexto);
    [CurvaturaObjetivo, AnguloObjetivo] = CurvaturaDelModo(PuntoInicial, Parametros, Plan.Escala, ...
                                                           PuntoInicial.Tiempo, Plan.Receta);
    % La rampa va del vector de entrada al vector objetivo, y cada componente
    % en el marco del carro tiene su propio presupuesto de onset: manda la
    % que pida mas longitud.
    AnguloInicial = PuntoInicial.AnguloCurvaturaDesdeArriba;
    LongitudEntrada = LongitudDeClotoidePorEjes(PuntoInicial.Velocidad, ...
        CurvaturaObjetivo*cos(AnguloObjetivo) - CurvaturaInicialArco*cos(AnguloInicial), ...
        CurvaturaObjetivo*sin(AnguloObjetivo) - CurvaturaInicialArco*sin(AnguloInicial), Plan.Onset, Parametros);
    Recorrido.LongitudClotoideEntrada = LongitudEntrada;

    % La rampa apunta a la curvatura del modo con duracion CERO: el modo
    % normativo trata el arco como un unico evento sostenido que empieza al
    % arrancar el arco, asi que durante la rampa el objetivo es el limite de
    % evento corto, el mismo que el arco va a pedir en su primer punto. Si
    % el reloj de la rampa arrancara en su propio inicio (como antes), una
    % rampa de mas de 1.0 s de prototipo -- la helice a 6 m/s la tiene --
    % veria bajar la curva de la norma y la curvatura saltaria hacia arriba
    % al arrancar el arco: una rotura C0, no de dkappa/ds. Con la referencia
    % en +Inf la duracion queda en cero en toda la rampa (CurvaturaDelModo
    % la acota por abajo) y el empalme con el arco es exacto.
    ArcoInicio = Arco;
    TiempoReferenciaRampa = Inf;
    Contexto.FuncionCurvatura = @(Punto) MezclaDeClotoide(Punto, ArcoInicio, LongitudEntrada, ...
                                    CurvaturaInicialArco, Plan, TiempoReferenciaRampa);

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
    Contexto.FuncionCurvatura = @(Punto) CurvaturaDelModoProyectada(Punto, Plan, TiempoReferenciaArco);

    % La rampa de salida arranca con la pendiente dkappa/ds que traiga el
    % arco (rampa de Hermite, ver RampaDeSalida), y su giro depende de esa
    % pendiente: se la estima con el ultimo nodo registrado, que es por lo
    % que la prediccion recibe tambien el Registro.
    ArcoQueFalta = @(Punto, Registro) (Plan.Receta.GiroObjetivo - AjusteCierre ...
                             - (Punto.AnguloGirado - AnguloGiradoInicio) ...
                             - GiroDeLaRampaDeSalida(Punto, Registro, Plan)) / max(Punto.Curvatura, eps);

    Indice = Recorrido.Registro.NumeroDeNodos + 1;
    [Recorrido.Registro, y, Arco] = IntegrarTramo(Recorrido.Registro, y, Arco, Contexto, 50, ArcoQueFalta);
    Recorrido.SubTramos(end+1) = struct('Nombre', 'ArcoPrincipal', ...
        'IndiceInicio', Indice, 'IndiceFin', Recorrido.Registro.NumeroDeNodos);

    if y(13) <= 0
        Recorrido = TerminarSinEnergia(Recorrido, y, Arco, Contexto, 'el arco principal');
        return
    end

    %% --- ClotoideSalida ---
    [~, PuntoFinArco] = DerivadaDeVia(Arco, y, Contexto);
    CurvaturaFinArco = PuntoFinArco.Curvatura;
    LongitudSalida = LongitudDeClotoidePorEjes(PuntoFinArco.Velocidad, PuntoFinArco.CurvaturaArribaCarro, ...
                                               PuntoFinArco.CurvaturaLateralCarro, Plan.Onset, Parametros);
    Recorrido.LongitudClotoideSalida = LongitudSalida;
    DerivadaCurvaturaFinArco = DerivadaCurvaturaEnElUltimoTramo(PuntoFinArco, Recorrido.Registro, Parametros);

    % Si el modo desalineo la curvatura respecto de la direccion de la
    % Receta (sub-peralte), la rampa de salida conserva ese desvio: cambiar
    % la direccion de golpe al salir del arco seria un salto de Gy.
    DesvioFinArco = atan2(PuntoFinArco.CurvaturaLateralCarro, PuntoFinArco.CurvaturaArribaCarro) ...
                  - PuntoFinArco.AnguloCurvaturaDesdeArriba;
    ArcoInicio = Arco;
    Contexto.FuncionCurvatura = @(Punto) ProyectarCurvatura( ...
        RampaDeSalida(FraccionDeTramo(Punto.Arco, ArcoInicio, LongitudSalida), ...
                      CurvaturaFinArco, DerivadaCurvaturaFinArco, LongitudSalida), ...
        AnguloDeCurvatura(Punto) + DesvioFinArco);

    Indice = Recorrido.Registro.NumeroDeNodos + 1;
    [Recorrido.Registro, y, Arco] = IntegrarTramo(Recorrido.Registro, y, Arco, Contexto, LongitudSalida, []);

    [~, Recorrido.PuntoFinal] = DerivadaDeVia(Arco, y, Contexto);
    Recorrido.Registro = AgregarNodo(Recorrido.Registro, Recorrido.PuntoFinal);
    Recorrido.SubTramos(end+1) = struct('Nombre', 'ClotoideSalida', ...
        'IndiceInicio', Indice, 'IndiceFin', Recorrido.Registro.NumeroDeNodos);

    % El cierre se mide sobre la rotacion DENTRO DEL PLANO DE GIRO, no sobre el
    % angulo total girado: con torsion la tangente sale con una componente
    % fuera de plano chica y el angulo total ya no vuelve al objetivo cuando el
    % giro si cerro. Proyectar sobre la base {e1, e2} aisla lo que interesa.
    TangenteFinal = Recorrido.PuntoFinal.VersorTangente;
    AnguloMedido  = atan2(dot(TangenteFinal, Recorrido.DireccionDeGiro), ...
                          dot(TangenteFinal, Recorrido.TangenteArco));
    Recorrido.ResidualCierre = AjustarAngulo(AnguloMedido - Plan.Receta.GiroObjetivo);

    Recorrido.DesplazamientoLateral = dot(Recorrido.PuntoFinal.Posicion - Recorrido.PosicionArco, ...
                                          Recorrido.EjeDeLaHelice);

    % Longitud del loop propiamente dicho. Como la tangente mantiene
    % T.B = sin(alfa) constante, el desplazamiento lateral vale sin(alfa) por
    % esta longitud: es la pendiente exacta para el paso de Newton.
    Recorrido.LongitudDelGiro = Arco - ArcoInicioLoop;
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
%CURVATURADEACONDICIONAMIENTO Rampa a cero la componente de curvatura de
%   entrada que es perpendicular a la direccion que el elemento impone, y
%   mantiene la componente paralela, que la clotoide de entrada va a retomar.
%   La rampa es un smoothstep, como las demas: dkappa/ds continua en los dos
%   extremos (ver MezclaDeClotoide para el por que).
    Fraccion = Smoothstep(FraccionDeTramo(Punto.Arco, ArcoInicio, Plan.LongitudAcondicionamiento));
    CurvaturaPerpendicular = (1 - Fraccion) * Plan.CurvaturaPerpendicular;
    Angulo = Plan.Beta + Plan.Receta.DesfasajeDeCurvatura;
    CurvaturaArriba  = Plan.CurvaturaParalela*cos(Angulo) - CurvaturaPerpendicular*sin(Angulo);
    CurvaturaLateral = Plan.CurvaturaParalela*sin(Angulo) + CurvaturaPerpendicular*cos(Angulo);
end

function [CurvaturaArriba, CurvaturaLateral] = CurvaturaDelModoProyectada(Punto, Plan, TiempoReferencia)
%CURVATURADELMODOPROYECTADA Curvatura del modo repartida sobre el marco de
%   transporte. El modo devuelve el modulo y el angulo medido desde U del
%   carro; sumarle el roll lo lleva al marco de transporte.
    [Curvatura, AnguloDesdeArriba] = CurvaturaDelModo(Punto, Plan.Parametros, Plan.Escala, TiempoReferencia, Plan.Receta);
    [CurvaturaArriba, CurvaturaLateral] = ProyectarCurvatura(Curvatura, Punto.AnguloRoll + AnguloDesdeArriba);
end

function [CurvaturaArriba, CurvaturaLateral] = MezclaDeClotoide(Punto, ArcoInicio, Longitud, CurvaturaInicial, Plan, TiempoReferencia)
%MEZCLADECLOTOIDE Rampa suave entre la curvatura de entrada y la que pide el
%   modo. Se mezclan las dos COMPONENTES y no el modulo, para que si el modo
%   desalinea la curvatura respecto de U la direccion tambien entre en rampa
%   y no salte al arrancar el arco.
%
%   La mezcla es un smoothstep cubico y no una rampa lineal, y el motivo es
%   el roll: la parte helicoidal vale dphi/ds = tan(alfa)*kappa, asi que
%   d2phi/ds2 hereda dkappa/ds y el termino de Euler de la G lateral,
%   b*v^2*phi''/g, hereda sus saltos. Con la rampa lineal dkappa/ds saltaba
%   en los dos extremos de la transicion y Gy daba un escalon de
%   b*tan(alfa)*J_z/v (~0.1 G con los defaults), que es una discontinuidad
%   de G y viola la continuidad C2 del roll que exige la memoria (seccion
%   6.7). Con el smoothstep dkappa/ds es continua: nula al arrancar (la
%   curvatura de entrada es constante) y, al terminar, igual a la del modo
%   en el arco, porque el objetivo de la mezcla es la MISMA funcion de
%   curvatura que el arco va a seguir. El precio es que el pico de
%   dkappa/ds es 1.5 veces el de la rampa lineal de la misma longitud; lo
%   paga LongitudDeClotoide. Ya no es una clotoide en sentido estricto
%   (dkappa/ds no es constante); el sub-tramo conserva el nombre.
    Fraccion = Smoothstep(FraccionDeTramo(Punto.Arco, ArcoInicio, Longitud));
    [ArribaObjetivo, LateralObjetivo] = CurvaturaDelModoProyectada(Punto, Plan, TiempoReferencia);
    AnguloEntrada = Punto.AnguloRoll + Punto.AnguloCurvaturaDesdeArriba;
    [ArribaInicial, LateralInicial]   = ProyectarCurvatura(CurvaturaInicial, AnguloEntrada);
    CurvaturaArriba  = (1 - Fraccion)*ArribaInicial  + Fraccion*ArribaObjetivo;
    CurvaturaLateral = (1 - Fraccion)*LateralInicial + Fraccion*LateralObjetivo;
end

function Fraccion = Smoothstep(u)
%SMOOTHSTEP 3u^2 - 2u^3: vale 0 en 0 y 1 en 1, con derivada nula en los dos
%   extremos. Pendiente maxima 1.5 en u = 0.5.
    Fraccion = u.^2 .* (3 - 2*u);
end

function Curvatura = RampaDeSalida(Fraccion, CurvaturaInicial, DerivadaInicial, Longitud)
%RAMPADESALIDA Curvatura de la rampa de salida: Hermite cubica desde
%   (kappa, dkappa/ds) del fin del arco hasta (0, 0). Arranca con la
%   pendiente que traia el arco, para que dkappa/ds -- y con ella phi'' y la
%   G lateral -- no salten en la frontera, y termina con pendiente nula, asi
%   que el elemento siguiente arranca de kappa = 0 con dkappa/ds = 0 y su
%   propia rampa (que tambien arranca con pendiente nula) empalma C1.
    u = Fraccion;
    Pendiente = PendienteAcotada(DerivadaInicial, CurvaturaInicial, Longitud);
    Curvatura = CurvaturaInicial * (2*u.^3 - 3*u.^2 + 1) + Pendiente * (u.^3 - 2*u.^2 + u);
end

function Pendiente = PendienteAcotada(DerivadaInicial, CurvaturaInicial, Longitud)
%PENDIENTEACOTADA Pendiente inicial de la Hermite, en unidades de u, acotada
%   a +-3*kappa. Por debajo de -3*kappa la Hermite cruza por debajo de cero
%   antes del final, y una curvatura negativa invertiria el sentido de
%   giro; por encima de +3*kappa sobrepasa mucho la curvatura del arco y la
%   rampa deja de ser una descarga. Son casos extremos (dkappa/ds del arco
%   muy grande contra kappa) que con los presupuestos de onset no aparecen;
%   si aparecen, la rampa deja de ser C1 en esa frontera, que es preferible
%   a una via que se da vuelta.
    Pendiente = max(min(DerivadaInicial*Longitud, 3*CurvaturaInicial), -3*CurvaturaInicial);
end

function Derivada = DerivadaCurvaturaEnElUltimoTramo(Punto, Registro, Parametros)
%DERIVADACURVATURAENELULTIMOTRAMO dkappa/ds al final del arco, estimada por
%   diferencia hacia atras entre el punto actual y un nodo registrado.
%   Dentro del paso no hay dkappa/ds analitica (en los modos que dependen
%   de v la curvatura es funcion de la marcha). El nodo se elige a por lo
%   menos medio paso de generacion: el ultimo registrado puede estar a un
%   paso acortado -- microns, si un sub-tramo termino justo ahi -- y una
%   diferencia sobre esa distancia es ruido amplificado.
    n = Registro.NumeroDeNodos;
    DistanciaMinima = 0.5*Parametros.PasoGeneracion;
    k = n;
    while k >= 1 && Punto.Arco - Registro.Arco(k) < DistanciaMinima
        k = k - 1;
    end
    if k < 1
        Derivada = 0;
        return
    end
    Derivada = (Punto.Curvatura - Registro.Curvatura(k)) / (Punto.Arco - Registro.Arco(k));
end

function Giro = GiroDeLaRampaDeSalida(Punto, Registro, Plan)
%GIRODELARAMPADESALIDA Angulo que va a girar la rampa de salida si el arco
%   terminara en este punto: la integral de la Hermite de RampaDeSalida,
%   L*(kappa/2 + Pendiente/12), con la misma cota sobre la pendiente. Con
%   dkappa/ds = 0 se reduce al triangulo kappa/2*L de la rampa lineal.
    Longitud = LongitudDeClotoidePorEjes(Punto.Velocidad, Punto.CurvaturaArribaCarro, ...
                                         Punto.CurvaturaLateralCarro, Plan.Onset, Plan.Parametros);
    Pendiente = PendienteAcotada(DerivadaCurvaturaEnElUltimoTramo(Punto, Registro, Plan.Parametros), ...
                                 Punto.Curvatura, Longitud);
    Giro = Longitud * (0.5*Punto.Curvatura + Pendiente/12);
end

function Longitud = LongitudDeClotoidePorEjes(Velocidad, DeltaCurvaturaArriba, DeltaCurvaturaLateral, Onset, Parametros)
%LONGITUDDECLOTOIDEPOREJES Longitud de rampa que respeta el presupuesto de
%   onset de cada eje del carro. El cambio de la componente sobre U produce
%   onset de Gz y el de la componente sobre L, onset de Gy; cada uno tiene su
%   presupuesto (Onset(3) y Onset(2)) y manda el que pida mas longitud. Con
%   la curvatura alineada con U se reduce a la formula de un solo eje.
    Longitud = max(LongitudDeClotoide(Velocidad, DeltaCurvaturaArriba,  Onset(3), Parametros), ...
                   LongitudDeClotoide(Velocidad, DeltaCurvaturaLateral, Onset(2), Parametros));
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

function [AnguloRoll, VelocidadRoll, AceleracionRoll] = PerfilRollDelElemento(Arco, AnguloGirado, EstadoEntrada, RollBase, LongitudAcondicionamiento, Inclinacion)
%PERFILROLLDELELEMENTO Roll del elemento: transicion quintica al roll del
%   elemento y, encima de eso, la parte helicoidal proporcional al angulo ya
%   girado.
%
%   phi se mide contra el marco de transporte paralelo (Bishop). En una curva
%   PLANA la torsion es nula, el transporte paralelo coincide con Frenet y
%   phi es CONSTANTE: un loop con Inclinacion = 0 entra y sale con el mismo
%   numero de phi, y el eje "arriba" del carro queda alineado con el vector
%   curvatura sin que phi tenga que moverse. phi crece UNICAMENTE por el
%   termino Inclinacion*AnguloGirado, o sea por la torsion que introduce la
%   inclinacion helicoidal (la que impone SeparacionDePatas): el marco de
%   transporte gira respecto de la normal de la curva a razon de la torsion,
%   kappa*tan(alfa), y seguir esa misma razon es exactamente mantener U
%   alineado con la curvatura. Ese avance de phi NO es un peralte agregado,
%   y por eso el carro sale del loop derecho (peralte cero) aunque el numero
%   de phi no termine donde empezo.
%
%   La pendiente de phi respecto del giro acumulado es tan(alfa):
%       dphi/dtheta = Inclinacion = Diagnostico.InclinacionHelicoidal,
%   contrastable directamente en el grafico "Perfil de roll" (phi contra
%   AnguloGirado) o en el reporte, que imprime la inclinacion y su angulo.
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
%
%   Vive en (-pi, pi], asi que con el carro invertido el signo lo decide el
%   ruido y el numero salta entre +pi y -pi (en la cuspide de un loop, por
%   ejemplo). El reporte lo usa con signo donde el signo importa (peralte
%   final, sub-peralte de salida del dive loop); el grafico de roll dibuja
%   el modulo, que es continuo.

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

function Registro = CompletarAceleracionRoll(Registro, Parametros)
%COMPLETARACELERACIONROLL Completa phi'' sobre la polilinea y corrige la G lateral.
%   Dentro del paso PuntoCinematico solo conoce el phi'' de la transicion
%   quintica: la parte helicoidal vale tan(alfa)*dkappa/ds y dkappa/ds no
%   esta disponible ahi. Sobre la polilinea ya construida phi' completo si
%   esta registrado (DerivadaDeVia le suma tan(alfa)*kappa), asi que se lo
%   deriva, se reemplaza el phi'' de cada nodo y se corrige la G lateral
%   registrada con el termino de Euler que faltaba, b*v^2*Delta(phi'')/g,
%   en los dos brazos. Con esto la G de diseno que ve el lazo de onset y la
%   que reporta Diagnostico son las mismas que va a medir SimularSobreTrack
%   (salvo la velocidad re-simulada). Lo unico que sigue usando el phi''
%   incompleto es lo que se evalua dentro del paso: la carga de las ruedas
%   guia en la resistencia (Crr*|Gy|*peso, de segundo orden) y el Gy
%   objetivo del dive loop si tuviera helice (con los defaults no la tiene).
    n = Registro.NumeroDeNodos;
    if n < 3
        return
    end
    Arco = Registro.Arco(1:n);
    AceleracionCompleta = DerivadaPorArco(Registro.VelocidadRoll(1:n), Arco);
    Termino = Registro.Velocidad(1:n).^2 .* (AceleracionCompleta - Registro.AceleracionRoll(1:n)) / Parametros.Gravedad;
    Registro.AceleracionRoll(1:n)      = AceleracionCompleta;
    Registro.GLateralHeartline(1:n)    = Registro.GLateralHeartline(1:n)    + Parametros.DistanciaHeartline*Termino;
    Registro.GLateralVerificacion(1:n) = Registro.GLateralVerificacion(1:n) + BrazoDeVerificacion(Parametros)*Termino;
end

function [OnsetVertical, OnsetLateral] = OnsetDelRecorrido(Registro)
%ONSETDELRECORRIDO Tasa de aparicion de la G vertical y de la lateral en el
%   punto de verificacion, medidas sobre el recorrido recien generado. Se
%   usan para realimentar la longitud de las transiciones. Son las G que la
%   norma limita, ya transportadas desde el riel con el brazo de
%   verificacion; dG/dt sale de dG/ds por la velocidad del punto del riel,
%   que es la que marca el tiempo.
    n = Registro.NumeroDeNodos;
    if n < 3
        OnsetVertical = 0;
        OnsetLateral  = 0;
        return
    end
    Arco = Registro.Arco(1:n);
    OnsetVertical = max(abs(gradient(Registro.GArribaVerificacion(1:n),  Arco) .* Registro.Velocidad(1:n)));
    OnsetLateral  = max(abs(gradient(Registro.GLateralVerificacion(1:n), Arco) .* Registro.Velocidad(1:n)));
end

function Longitud = LongitudDeClotoide(Velocidad, DeltaCurvatura, Onset, Parametros)
%LONGITUDDECLOTOIDE L = DeltaG*v/Onset, escrita en funcion de la curvatura.
%   DeltaG = v^2*DeltaKappa/g, de modo que para una rampa lineal
%   L = v^3*|DeltaKappa|/(g*Onset): es la relacion dkappa/ds = Onset*g/v^3
%   escrita al reves. La rampa es un smoothstep (MezclaDeClotoide,
%   RampaDeSalida), cuyo pico de dkappa/ds es 1.5 veces el de la lineal de
%   la misma longitud, asi que para respetar el mismo presupuesto en el
%   pico la longitud lleva ese factor. El lazo de onset de GenerarGeometria
%   corrige lo que quede (variacion de v y de Uz dentro de la rampa).
    FactorSmoothstep = 1.5;
    Longitud = FactorSmoothstep * Velocidad^3 * abs(DeltaCurvatura) / (Parametros.Gravedad * Onset);
    Longitud = max(Longitud, 2*Parametros.PasoGeneracion);
end

function Longitud = LongitudTransicionDeRoll(DeltaRoll, Velocidad, Onset, Parametros)
%LONGITUDTRANSICIONDEROLL Dimensiona la transicion de roll por el onset lateral.
%   Con el smoothstep quintico max|phi'''| = 60*|DeltaRoll|/L^3, y la G lateral
%   de un punto a distancia b del eje de roll vale b*v^2*phi''/g, asi que su
%   tasa de aparicion es b*v^3*phi'''/g. Despejando L:
%       L = (60*b*v^3*|DeltaRoll| / (g*Onset))^(1/3)
%
%   El eje de roll es el RIEL y el brazo b es BrazoDeVerificacion: la
%   distancia del riel al punto donde la norma se aplica (la heartline, o la
%   cabeza si se pide). Es el mismo brazo con el que SimularSobreTrack
%   transporta la G, y tiene que serlo: dimensionar la transicion con un
%   brazo y despues verificarla con otro no cierra.
%
%   SIN CERRAR: el criterio normativo propio de la rotacion pura es un limite
%   de velocidad angular del carro (ASTM F2291 7.1.6), no un offset.
    if abs(DeltaRoll) < 1e-9
        Longitud = 0;
        return
    end
    Brazo = BrazoDeVerificacion(Parametros);
    if Brazo <= 0
        Longitud = Parametros.LargoCarro;   % sin brazo de palanca el criterio no aplica
        return
    end
    Longitud = (60*Brazo*Velocidad^3*abs(DeltaRoll) / (Parametros.Gravedad*Onset))^(1/3);
    Longitud = max(Longitud, Parametros.LargoCarro);
end
