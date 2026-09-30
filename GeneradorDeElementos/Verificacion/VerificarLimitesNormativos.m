function Normativo = VerificarLimitesNormativos(Sim, Escala, Parametros, Contexto)
%VERIFICARLIMITESNORMATIVOS Chequeo de las G contra ASTM F2291-06a, seccion 7.
%   El limite no es puntual: para cada nivel G* hay que medir la duracion del
%   evento sostenido en que G >= G* y evaluar la curva limite en esa duracion.
%   Un pico de 6 G durante 0.5 s es admisible; el mismo 6 G durante 3 s no.
%
%   Las duraciones del modelo se convierten a duracion equivalente del
%   prototipo multiplicando por sqrt(lambda) antes de entrar a las curvas: el
%   modelo recorre la misma experiencia sqrt(lambda) veces mas rapido.
%
%   LINEA DE TIEMPO DEL LAYOUT. Los eventos se miden de corrido en todo el
%   circuito: un evento que cruza un empalme es uno solo, y su duracion es la
%   suma de sus tramos, cada uno escalado con el factorTiempo de su elemento.
%   Contexto es la serie del layout (SerieNormativaDelLayout) con
%   Contexto.Elemento, el indice de este elemento; lo arma
%   VerificarLayoutNormativo. El elemento evalua todos los eventos que tocan
%   al menos uno de sus nodos, con la duracion COMPLETA del evento. Sin
%   Contexto (un elemento suelto, ConstruirElemento) la serie es la del
%   propio elemento.
%
%   EVENTOS DE MENOS DE 200 ms. La norma no los cubre (7.1.4.2: 3.1.1 los
%   llama impactos). El proyecto adopta un criterio MAS CONSERVADOR: se
%   evaluan como si duraran 0.2 s, o sea contra el limite de 200 ms de la
%   curva (memoria_de_calculo.md, 5.7). Asi un pico de 6.4 G que dura
%   0.19 s no pasa contra 6.0 G, cuando antes quedaba fuera del alcance.
%
%   RUIDO NUMERICO. Por debajo de GMinimaEvaluable (0.01 G) no se evalua:
%   la grilla de niveles arranca en max(GMinimaEvaluable, maximo/60) y un
%   lado cuyo maximo no llega al umbral no tiene evento critico.
%
%   7.1.6 (reversiones en X e Y) se evalua en ReversionesSostenidas.

    if nargin < 4 || isempty(Contexto)
        Contexto = SerieNormativaDelLayout({Sim}, Escala.RaizLambdaLoop);
        Contexto.Elemento = 1;
    end

    Valido = ~isnan(Sim.Gz) & ~isnan(Sim.Tiempo);
    Tiempo = Sim.Tiempo(Valido);
    Gx = Sim.Gx(Valido);
    Gy = Sim.Gy(Valido);
    Gz = Sim.Gz(Valido);

    FactorTiempo = Escala.RaizLambdaLoop;
    Normativo.FactorTiempo = FactorTiempo;
    Normativo.DuracionModelo = Tiempo(end) - Tiempo(1);
    Normativo.DuracionRealEquivalente = Normativo.DuracionModelo * FactorTiempo;

    Rango = Contexto.Rango(Contexto.Elemento, :);
    TiempoLayout = Contexto.TiempoPrototipo;
    Nodos = Rango(1):Rango(2);

    % 7.1.7.1, literal y sobre la linea de tiempo del layout: la curva
    % reducida rige en los 6 s de prototipo que siguen a un -Gz de mas de
    % 3 s (VentanasMasGzReducido). El elemento declara MasGzReducido si al
    % menos uno de sus nodos cae en una de esas ventanas.
    Normativo.HuboAirtimeSostenido = any(Contexto.EnAirtimeLargo(Nodos));
    if any(Contexto.Reducida(Nodos))
        CurvaMasGz = 'MasGzReducido';
    else
        CurvaMasGz = 'MasGzTodas';
    end
    Normativo.CurvaMasGzAplicada = CurvaMasGz;

    Normativo.MasGz   = PeorEventoSostenido(Contexto.Gz,      TiempoLayout, Rango, 'MasGzTodas',  +1, Contexto.Reducida);
    Normativo.MenosGz = PeorEventoSostenido(Contexto.Gz,      TiempoLayout, Rango, 'MenosGzBase', -1, []);
    Normativo.Gy      = PeorEventoSostenido(abs(Contexto.Gy), TiempoLayout, Rango, 'GyBase',      +1, []);
    Normativo.MasGx   = PeorEventoSostenido(Contexto.Gx,      TiempoLayout, Rango, 'MasGxBase',   +1, []);
    Normativo.MenosGx = PeorEventoSostenido(Contexto.Gx,      TiempoLayout, Rango, 'MenosGxBase', -1, []);

    %% --- 7.1.6: reversiones en X e Y ---------------------------------------
    Normativo.ReversionGx = ReversionesSostenidas(Contexto.Gx, TiempoLayout, Rango, 'MasGxBase', 'MenosGxBase');
    Normativo.ReversionGy = ReversionesSostenidas(Contexto.Gy, TiempoLayout, Rango, 'GyBase',    'GyBase');

    %% --- 7.1.5.1: combinacion de dos ejes dentro de una elipse ------------
    % Semiejes iguales a los limites de 200 ms multiplicados por 1.1. Cada eje
    % tiene semiejes distintos hacia cada lado -- +Gz admite 6 G y -Gz solo
    % 2 G -- asi que el semieje se elige segun el signo del valor.
    SemiejeGx = SemiejePorSigno(Gx, 'MasGxBase', 'MenosGxBase');
    SemiejeGy = SemiejePorSigno(Gy, 'GyBase',    'GyBase');
    SemiejeGz = SemiejePorSigno(Gz, CurvaMasGz,  'MenosGzBase');

    Normativo.Elipse.ValorMaximoGyGz = max((Gy./SemiejeGy).^2 + (Gz./SemiejeGz).^2);
    Normativo.Elipse.ValorMaximoGxGz = max((Gx./SemiejeGx).^2 + (Gz./SemiejeGz).^2);
    Normativo.Elipse.ValorMaximoGxGy = max((Gx./SemiejeGx).^2 + (Gy./SemiejeGy).^2);
    Normativo.Elipse.Semiejes = [1.1*LimiteNormativo('MasGxBase', 0.2), ...
                                 1.1*LimiteNormativo('GyBase',    0.2), ...
                                 1.1*LimiteNormativo(CurvaMasGz,  0.2)];

    %% --- 7.1.7.2: tasa de aparicion de 0 G o menos hacia 2 G o mas --------
    Normativo.OnsetDeCarga = OnsetDeTransicionCritica(Gz, Sim.JerkGz(Valido));
    Normativo.OnsetNormativoReal = Parametros.OnsetNormativoPorEje(3);
    Normativo.OnsetPresupuestoModelo = Escala.OnsetMaximo;

    Normativo.OnsetMaximoPorEje = [max(abs(Sim.JerkGx(Valido))), ...
                                   max(abs(Sim.JerkGy(Valido))), ...
                                   max(abs(Sim.JerkGz(Valido)))];
end

%% ========================= auxiliares =====================================
function Semieje = SemiejePorSigno(G, CurvaPositiva, CurvaNegativa)
    SemiejePositivo = 1.1*abs(LimiteNormativo(CurvaPositiva, 0.2));
    SemiejeNegativo = 1.1*abs(LimiteNormativo(CurvaNegativa, 0.2));
    Semieje = SemiejePositivo*(G >= 0) + SemiejeNegativo*(G < 0);
end

function Evento = PeorEventoSostenido(G, Tiempo, Rango, Curva, Signo, Reducida)
%PEOREVENTOSOSTENIDO Barre niveles y busca el evento sostenido peor parado
%   contra la curva limite. Trabaja siempre con H = Signo*G, de modo que el
%   criterio es "H >= Nivel durante D segundos exige Nivel <= Limite(D)".
%
%   G y Tiempo son la linea de tiempo del layout, con el tiempo ya en
%   PROTOTIPO; Rango, los nodos [primero, ultimo] del elemento. Los niveles
%   salen del maximo del elemento y se evaluan los eventos que tocan al menos
%   un nodo suyo. Reducida (solo +Gz) marca los nodos de las ventanas de
%   7.1.7.1: dentro de la ventana rige MasGzReducido y despues la curva
%   normal, sin resetear la duracion del evento (LimitesDelEvento).

    H = Signo * G(:);
    HElemento = H(Rango(1):Rango(2));
    Evento.Curva = Curva;
    Evento.Signo = Signo;
    Evento.NivelCritico   = 0;
    Evento.DuracionReal   = 0;
    Evento.LimiteAplicado = NaN;
    Evento.Exceso         = -Inf;
    Evento.DuracionMasLarga = 0;
    Evento.PicoG = Signo * max(HElemento);

    HMaximo = max(HElemento);
    Umbral = GMinimaEvaluable();
    if isempty(HMaximo) || ~(HMaximo >= Umbral) || numel(HElemento) < 2
        return   % nada evaluable de este signo: solo ruido numerico o nada
    end

    Niveles = linspace(max(Umbral, HMaximo/60), HMaximo, 60);
    for Nivel = Niveles
        Tramos = TramosContiguos(H >= Nivel);
        Tramos = Tramos(Tramos(:,2) >= Rango(1) & Tramos(:,1) <= Rango(2), :);
        for k = 1:size(Tramos, 1)
            DuracionReal = Tiempo(Tramos(k,2)) - Tiempo(Tramos(k,1));
            if DuracionReal > Evento.DuracionMasLarga
                Evento.DuracionMasLarga = DuracionReal;
            end
            % 7.1.4.2 no cubre los eventos de menos de 200 ms; el proyecto
            % los evalua contra el limite de 200 ms (criterio conservador).
            % Con ventanas de 7.1.7.1 el evento tiene un limite por tramo de
            % regimen, con la duracion acumulada desde su inicio
            % (LimitesDelEvento).
            [Limites, Duraciones, Curvas] = LimitesDelEvento(Tiempo, Tramos(k,1), Tramos(k,2), Curva, Reducida);
            for j = 1:numel(Limites)
                Exceso = Nivel - Limites(j);
                if Exceso > Evento.Exceso
                    Evento.Exceso         = Exceso;
                    Evento.NivelCritico   = Signo * Nivel;
                    Evento.DuracionReal   = Duraciones(j);
                    Evento.LimiteAplicado = Signo * Limites(j);
                    Evento.Curva          = Curvas{j};
                end
            end
        end
    end
end

function Reversion = ReversionesSostenidas(G, Tiempo, Rango, CurvaPositiva, CurvaNegativa)
%REVERSIONESSOSTENIDAS 7.1.6: reversiones entre eventos sostenidos en X o Y.
%   "The peak-to-peak transition time between consecutive sustained events
%   in X and Y accelerations shall be greater than 200 ms, as measured by
%   the time between the peaks of the consecutive events. When the elapsed
%   time between consecutive sustained events is less than 200 ms, the
%   limit for the peak values shall be reduced by 50 %." (Fig. 19)
%
%   Sobre la linea de tiempo del layout, en tiempo del prototipo:
%     - un evento es un intervalo continuo de un mismo signo con
%       |G| >= GMinimaEvaluable; es sostenido si dura 0.2 s o mas (3.1.2);
%     - para cada par de eventos sostenidos consecutivos de signo opuesto,
%       el tiempo pico a pico es el que separa el extremo de cada uno;
%     - si es menor que 0.2 s, el limite del pico de cada uno de los dos
%       cae al 50 % del que le corresponde por su duracion (la del evento
%       entero, con la curva de su signo). Falla si un pico lo supera.
%   El elemento evalua los pares en que al menos uno de los dos eventos toca
%   uno de sus nodos, y los picos de los eventos que lo tocan.
%
%   TODO(7.1.6): dos eventos sostenidos consecutivos del MISMO signo (por
%   ejemplo, separados por un tramo casi nulo o por un evento corto de signo
%   contrario) no son una reversion y aca no se unen ni se evaluan. La norma
%   no dice si hay que tratarlos como uno solo.

    G = G(:);
    Tiempo = Tiempo(:);
    Umbral = GMinimaEvaluable();

    Reversion.TiempoPicoAPicoMinimo = Inf;   % entre los pares que tocan el elemento
    Reversion.Reducida = false;
    Reversion.TiempoPicoAPico = NaN;          % del par del evento critico
    Reversion.PicoG = NaN;
    Reversion.DuracionReal = NaN;
    Reversion.LimiteReducido = NaN;
    Reversion.Exceso = -Inf;

    Positivos = TramosContiguos(G >= Umbral);
    Negativos = TramosContiguos(G <= -Umbral);
    Eventos = [Positivos, ones(size(Positivos, 1), 1); Negativos, -ones(size(Negativos, 1), 1)];
    if isempty(Eventos)
        return
    end
    Eventos = sortrows(Eventos, 1);
    Sostenidos = Eventos(Tiempo(Eventos(:,2)) - Tiempo(Eventos(:,1)) >= 0.2, :);

    for k = 1:size(Sostenidos, 1) - 1
        Par = Sostenidos(k:k+1, :);
        if Par(1,3) == Par(2,3)
            continue   % mismo signo: no es una reversion (ver el TODO)
        end
        Toca = Par(:,2) >= Rango(1) & Par(:,1) <= Rango(2);
        if ~any(Toca)
            continue
        end
        Picos = zeros(2, 1);
        TiemposDePico = zeros(2, 1);
        for j = 1:2
            [~, Posicion] = max(abs(G(Par(j,1):Par(j,2))));
            Picos(j) = G(Par(j,1) + Posicion - 1);
            TiemposDePico(j) = Tiempo(Par(j,1) + Posicion - 1);
        end
        Separacion = abs(TiemposDePico(2) - TiemposDePico(1));
        Reversion.TiempoPicoAPicoMinimo = min(Reversion.TiempoPicoAPicoMinimo, Separacion);
        if Separacion >= 0.2
            continue
        end
        Reversion.Reducida = true;
        for j = find(Toca).'
            if Par(j,3) > 0
                Curva = CurvaPositiva;
            else
                Curva = CurvaNegativa;
            end
            Duracion = Tiempo(Par(j,2)) - Tiempo(Par(j,1));
            LimiteReducido = 0.5 * abs(LimiteNormativo(Curva, Duracion));
            Exceso = abs(Picos(j)) - LimiteReducido;
            if Exceso > Reversion.Exceso
                Reversion.Exceso = Exceso;
                Reversion.PicoG = Picos(j);
                Reversion.DuracionReal = Duracion;
                Reversion.LimiteReducido = Par(j,3) * LimiteReducido;
                Reversion.TiempoPicoAPico = Separacion;
            end
        end
    end
end

function Tramos = TramosContiguos(Mascara)
%TRAMOSCONTIGUOS Indices de inicio y fin de cada corrida de true.
    Mascara = Mascara(:).';
    Bordes = diff([false, Mascara, false]);
    Inicios = find(Bordes == 1);
    Finales = find(Bordes == -1) - 1;
    Tramos = [Inicios(:), Finales(:)];
end

function Onset = OnsetDeTransicionCritica(Gz, JerkGz)
%ONSETDETRANSICIONCRITICA Maxima tasa de aparicion dentro de las transiciones
%   que van de 0 G o menos hacia 2 G o mas. Es el alcance literal de 7.1.7.2:
%   una clotoide que entra a un valle desde via a nivel va de 1 G a 4 G y NO
%   cae bajo esa clausula.

    Onset = 0;
    Indice = 1;
    NumeroDeNodos = numel(Gz);
    while Indice <= NumeroDeNodos
        if Gz(Indice) <= 0
            Fin = Indice;
            while Fin < NumeroDeNodos && Gz(Fin) < 2
                Fin = Fin + 1;
                if Gz(Fin) <= 0
                    Indice = Fin;   % volvio a caer: la transicion no llego a 2 G
                    break
                end
            end
            if Fin > Indice && Gz(Fin) >= 2
                Onset = max(Onset, max(JerkGz(Indice:Fin)));
                Indice = Fin;
            end
        end
        Indice = Indice + 1;
    end
end
