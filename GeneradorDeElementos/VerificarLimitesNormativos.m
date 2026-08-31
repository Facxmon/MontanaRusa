function Normativo = VerificarLimitesNormativos(Sim, Escala, Parametros)
%VERIFICARLIMITESNORMATIVOS Chequeo de las G contra ASTM F2291-06a, seccion 7.
%   El limite no es puntual: para cada nivel G* hay que medir la duracion del
%   evento sostenido en que G >= G* y evaluar la curva limite en esa duracion.
%   Un pico de 6 G durante 0.5 s es admisible; el mismo 6 G durante 3 s no.
%
%   Las duraciones del modelo se convierten a duracion equivalente del
%   prototipo multiplicando por sqrt(lambda) antes de entrar a las curvas: el
%   modelo recorre la misma experiencia sqrt(lambda) veces mas rapido.
%
%   Impactos de menos de 200 ms no estan cubiertos por la norma (7.1.4.2), asi
%   que los eventos mas cortos que eso se descartan.

    Valido = ~isnan(Sim.Gz) & ~isnan(Sim.Tiempo);
    Tiempo = Sim.Tiempo(Valido);
    Gx = Sim.Gx(Valido);
    Gy = Sim.Gy(Valido);
    Gz = Sim.Gz(Valido);

    FactorTiempo = Escala.RaizLambdaLoop;
    Normativo.FactorTiempo = FactorTiempo;
    Normativo.DuracionModelo = Tiempo(end) - Tiempo(1);
    Normativo.DuracionRealEquivalente = Normativo.DuracionModelo * FactorTiempo;

    % 7.1.7.1: si hubo -Gz sostenido por mas de 3 s, los limites de +Gz caen a
    % la columna reducida durante los 6 s siguientes. Aca se aplica la columna
    % reducida a todo el elemento si el evento aparece: es conservador y evita
    % arrastrar el reloj de los 6 s entre elementos.
    EventoAirtimeLargo = PeorEventoSostenido(Gz, Tiempo, 'MenosGzBase', FactorTiempo, -1);
    Normativo.HuboAirtimeSostenido = EventoAirtimeLargo.DuracionMasLarga > 3.0;
    if Normativo.HuboAirtimeSostenido
        CurvaMasGz = 'MasGzReducido';
    else
        CurvaMasGz = 'MasGzTodas';
    end
    Normativo.CurvaMasGzAplicada = CurvaMasGz;

    Normativo.MasGz   = PeorEventoSostenido(Gz, Tiempo, CurvaMasGz,      FactorTiempo, +1);
    Normativo.MenosGz = PeorEventoSostenido(Gz, Tiempo, 'MenosGzBase',   FactorTiempo, -1);
    Normativo.Gy      = PeorEventoSostenido(abs(Gy), Tiempo, 'GyBase',   FactorTiempo, +1);
    Normativo.MasGx   = PeorEventoSostenido(Gx, Tiempo, 'MasGxBase',     FactorTiempo, +1);
    Normativo.MenosGx = PeorEventoSostenido(Gx, Tiempo, 'MenosGxBase',   FactorTiempo, -1);

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

function Evento = PeorEventoSostenido(G, Tiempo, Curva, FactorTiempo, Signo)
%PEOREVENTOSOSTENIDO Barre niveles y busca el evento sostenido peor parado
%   contra la curva limite. Trabaja siempre con H = Signo*G, de modo que el
%   criterio es "H >= Nivel durante D segundos exige Nivel <= Limite(D)".

    H = Signo * G;
    Evento.Curva = Curva;
    Evento.Signo = Signo;
    Evento.NivelCritico   = 0;
    Evento.DuracionReal   = 0;
    Evento.LimiteAplicado = NaN;
    Evento.Exceso         = -Inf;
    Evento.DuracionMasLarga = 0;
    Evento.PicoG = Signo * max(H);

    HMaximo = max(H);
    if HMaximo <= 0 || numel(H) < 2
        Evento.Exceso = -Inf;
        return
    end

    Niveles = linspace(HMaximo/60, HMaximo, 60);
    for Nivel = Niveles
        Tramos = TramosContiguos(H >= Nivel);
        for k = 1:size(Tramos, 1)
            DuracionReal = (Tiempo(Tramos(k,2)) - Tiempo(Tramos(k,1))) * FactorTiempo;
            if DuracionReal > Evento.DuracionMasLarga
                Evento.DuracionMasLarga = DuracionReal;
            end
            if DuracionReal < 0.2
                continue   % 7.1.4.2: impactos de menos de 200 ms no estan cubiertos
            end
            LimiteMagnitud = Signo * LimiteNormativo(Curva, DuracionReal);
            Exceso = Nivel - LimiteMagnitud;
            if Exceso > Evento.Exceso
                Evento.Exceso         = Exceso;
                Evento.NivelCritico   = Signo * Nivel;
                Evento.DuracionReal   = DuracionReal;
                Evento.LimiteAplicado = Signo * LimiteMagnitud;
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
