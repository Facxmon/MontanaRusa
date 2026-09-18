function Objetivo = ObjetivoNormativoPorNiveles(Curva, TiempoPrevio, GzPrevio, TiempoInicioArco, Escala, Parametros)
%OBJETIVONORMATIVOPORNIVELES Gz objetivo del arco con el reloj de cada nivel.
%   El modo GNormativaMaxima pide en el arco el +Gz que admite la curva de
%   la norma para la duracion del evento sostenido. La norma mide esa
%   duracion POR NIVEL: el evento "G >= G*" empieza cuando la G cruza G*, y
%   eso pasa en la clotoide de entrada, antes de que arranque el arco. Un
%   reloj unico que arranque en el arco le regala a cada nivel el tiempo que
%   la clotoide ya llevaba por encima de el, y la verificacion lo cobra: en
%   el loop vertical de DemoElemento eran 0.36 G de exceso al nivel 4.4 G,
%   sobre la misma G que el modo habia impuesto. Arrancar el reloj unico en
%   la clotoide arregla eso pero le quita a la meseta de 6 G toda la
%   duracion de la clotoide (la mitad, con los defaults): es pagar por todos
%   los niveles lo que solo deben los mas bajos.
%
%   Aca cada nivel lleva su propio reloj. Con t_c(G*) el primer instante en
%   que la G registrada antes del arco alcanza G* (o el inicio del arco si
%   no lo alcanzo, o el primer nodo si ya entro por encima), y L_d(D) la
%   curva de diseno -- LimiteDeDiseno / FactorDeSeguridadNormativo menos
%   TolObjetivoDeG --, el objetivo es la curva parametrica en D
%       t(D)  = t_c(L_d(D)) + D / sqrt(lambda),      Gz(D) = L_d(D):
%   el objetivo pasa por el nivel L_d(D) exactamente cuando ese nivel agota
%   su duracion admisible D, contada desde que se lo cruzo. Todo nivel queda
%   dentro de la norma por construccion. El margen TolObjetivoDeG es lo que
%   el chequeo "Gz objetivo del modo alcanzado" le tolera de error al
%   transporte inverso: descontarlo del objetivo es lo que hace que ese
%   chequeo garantice el de +Gz (Fig. 10), en vez de que un objetivo puesto
%   sobre la curva la viole con el ruido numerico (0.001 G bastaban). Es la
%   misma razon por la que el Gy objetivo del dive loop descuenta esa
%   tolerancia (CurvaturaDelModo/ObjetivoDeGyDentroDeLaElipse).
%
%   Continuidad. Con la clotoide corta (menos de ~1.2 s de prototipo) t(D)
%   es creciente y el objetivo es C1 donde L_d lo es: la clotoide llega al
%   maximo con pendiente nula y cruza los niveles cercanos con una raiz
%   cuadrada, y el quiebre redondeado de LimiteDeDiseno tiene la misma raiz
%   del otro lado, con mas peso. Si t(D) retrocede en algun tramo (clotoide
%   larga) se toma el nivel mas bajo de los que compiten por el mismo
%   instante -- conservador -- y Objetivo.HuboPliegue lo anota.
%
%   Devuelve una tabla en tiempo del MODELO con paso uniforme, que
%   EvaluarObjetivoNormativo interpola en cada etapa del RK4, y que queda en
%   Track.ObjetivoNormativo para que el criterio posterior, los tests y los
%   graficos usen exactamente lo que el modo persiguio. La duracion de la
%   curva de Gy del dive loop sigue contando desde el inicio del arco: su
%   arco dura menos de 1 s y la curva de la Fig. 8 es plana ahi.

    FactorTiempo      = Escala.RaizLambdaLoop;   % s de prototipo por s de modelo
    FactorDeSeguridad = Parametros.FactorDeSeguridadNormativo;
    Semiancho         = Parametros.SemianchoDeSuavizadoNormativo;
    Margen            = Parametros.TolObjetivoDeG;

    [~, Tabla]   = LimiteNormativo(Curva, 0.2);
    PasoDuracion = 0.002;                                   % [s] de prototipo
    Duracion     = (0:PasoDuracion:Tabla(end,1)).';
    GzDiseno     = LimiteDeDiseno(Curva, Duracion, Semiancho) / FactorDeSeguridad - Margen;

    % Primer cruce de cada nivel en lo registrado antes del arco: la inversa
    % del maximo acumulado de la G. Por encima de lo alcanzado, el nivel se
    % cruza recien al arrancar el arco; por debajo de la G de entrada, el
    % evento ya venia de antes y la verificacion lo cuenta desde el primer
    % nodo del elemento.
    Valido       = isfinite(TiempoPrevio(:)) & isfinite(GzPrevio(:));
    TiempoPrevio = TiempoPrevio(Valido);
    GzPrevio     = GzPrevio(Valido);
    TiempoDeCruce = TiempoInicioArco * ones(size(GzDiseno));
    Deficit = 0;
    if numel(TiempoPrevio) >= 2
        [NivelesCruzados, Primero] = unique(cummax(GzPrevio), 'first');
        % La rampa llega al maximo con pendiente nula, asi que t_c(G) tiene
        % una raiz cuadrada centrada en lo que la rampa ALCANZO. Si eso
        % quedo por debajo del maximo de diseno (el error del transporte
        % inverso, ~0.0004 G), la raiz de t_c y la del quiebre redondeado
        % de L_d quedan descentradas, t(D) retrocede y el objetivo arranca
        % el descenso con un escalon. Se corre el registro hacia arriba
        % hasta el maximo de diseno para que las dos raices coincidan: cada
        % nivel se da por cruzado cuando la rampa cruzo el nivel menos el
        % deficit, un poco ANTES de lo que lo cruzo de verdad (conservador,
        % 0.05 ms). No se baja la curva de diseno, que es lo que la rampa
        % apunta: el arco arranca en el mismo objetivo que la rampa termino
        % y kappa no salta en la frontera (un salto de 0.0004 G en el
        % objetivo era un pico de 7 G/s de jerk lateral a 1 mm de paso). Se
        % absorbe hasta 0.01 G -- un orden por encima de ese error y cinco
        % veces por debajo de TolObjetivoDeG -- para no tapar un objetivo
        % inalcanzable, que el criterio posterior tiene que seguir viendo.
        Deficit = min(max(GzDiseno(1) - NivelesCruzados(end), 0), 0.01);
        NivelesCruzados = NivelesCruzados + Deficit;
        if numel(NivelesCruzados) >= 2
            EnRango = GzDiseno > NivelesCruzados(1) & GzDiseno < NivelesCruzados(end);
            % pchip y no lineal: t_c(G) entra derivado en la pendiente del
            % objetivo (dt/dD = 1 + t_c' L_d'), y con la inversa lineal de un
            % registro a 2 mm cada nodo de la rampa era un salto de pendiente
            % en el objetivo, que el roll helicoidal convertia en un peine de
            % jerk lateral dependiente del paso.
            TiempoDeCruce(EnRango) = interp1(NivelesCruzados, TiempoPrevio(Primero), GzDiseno(EnRango), 'pchip');
        end
        TiempoDeCruce(GzDiseno <= NivelesCruzados(1)) = TiempoPrevio(1);
    end

    Paso         = PasoDuracion / FactorTiempo;               % [s] de modelo
    TiempoDiseno = TiempoDeCruce + Duracion / FactorTiempo;   % modelo

    % Monotonia: donde t(D) retrocede, gana el nivel mas bajo (el D mayor).
    TiempoMonotono = cummax(TiempoDiseno);
    HuboPliegue    = any(TiempoDiseno < TiempoMonotono - Paso);   % retrocesos de menos de un paso son la grilla
    [TiempoUnico, Ultimo] = unique(TiempoMonotono, 'last');

    % Tabla uniforme en tiempo del modelo, para interpolar sin interp1 en
    % la marcha (EvaluarObjetivoNormativo).
    Tiempo = (TiempoUnico(1):Paso:TiempoUnico(end)).';
    if numel(Tiempo) < 2
        Tiempo = [TiempoUnico(1); TiempoUnico(1) + Paso];
    end
    Gz = interp1(TiempoUnico, GzDiseno(Ultimo), Tiempo, 'linear', GzDiseno(Ultimo(end)));
    % Coeficientes de la cubica de Hermite (pchip) por intervalo, para que
    % la evaluacion en la marcha sea C1: la tabla lineal a trozos tiene la
    % pendiente escalonada y eso es dkappa/ds escalonada en el arco.
    Cubica = pchip(Tiempo, Gz);

    Objetivo.Curva            = Curva;
    Objetivo.Tiempo           = Tiempo;
    Objetivo.Gz               = Gz;
    Objetivo.Coeficientes     = Cubica.coefs;   % (numel(Tiempo)-1) x 4, potencias decrecientes de (t - Tiempo(i))
    Objetivo.Paso             = Paso;
    Objetivo.TiempoInicioArco = TiempoInicioArco;
    Objetivo.Margen           = Margen;
    Objetivo.Deficit          = Deficit;
    Objetivo.HuboPliegue      = HuboPliegue;
end
