function [Curvatura, AnguloDesdeArriba] = CurvaturaDelModo(Punto, Parametros, Escala, Reloj, Receta)
%CURVATURADELMODO Curvatura del RIEL que pide el modo elegido en un punto del arco.
%   Devuelve el modulo de la curvatura del riel y el angulo, medido desde U
%   hacia L en el plano normal del carro, en el que hay que ponerla. Los modos
%   AceleracionNormalConstante, FuerzaGConstante y GNormativaMaxima dependen
%   de v: ahi esta el origen del acoplamiento entre geometria y dinamica que
%   obliga a los dos metodos de resolucion.
%
%   Que parametros consume cada modo lo declara ParametrosDelModo, y tiene
%   que coincidir con lo que se lee aca. El modo normativo lee ademas la
%   curva limite de la Receta del elemento (Receta.CurvaLimiteGz): cada
%   elemento persigue la suya, no hay una curva global. Si la Receta trae
%   ademas Receta.CurvaLimiteGy (el dive loop), el modo persigue un Gy a la
%   vez que el Gz desalineando la curvatura respecto de U (sub-peralte): en
%   ese caso el angulo que devuelve es el resuelto, no el que pide la Receta.
%
%   Todos los objetivos de G son del PASAJERO, no del riel. El riel es el eje
%   de roll y el pasajero va a distancia Brazo sobre U, asi que su Gz vale
%   (CargasEnLaVia)
%
%       Gz = v^2*[kappa*c*(1 - Brazo*kappa*c) - Brazo*phi'^2]/g + Uz
%
%   con c = cos(angulo entre la curvatura y U) y v = v_cm/J la velocidad del
%   punto del riel, J = |d r_heartline/ds| = hypot(1 - d*kappa*c, d*phi').
%   Despejar kappa de ahi es una cuadratica por punto, cerrada; la unica
%   iteracion es sobre phi', que lleva un termino kappa*tan(alfa) de la parte
%   helicoidal y converge en dos o tres pasadas (es exacta si no hay helice).
%
%   Consecuencias que vale la pena tener presentes:
%     - c multiplica a kappa: una curva peraltada un angulo beta con la
%       curvatura horizontal tiene c = sin(beta), y una curva sin peraltar
%       (c = 0) NO puede generar +Gz por mas curvatura que se le ponga: genera
%       Gy. Hay una guarda explicita para ese caso.
%     - el factor (1 - Brazo*kappa*c) hace que la G del pasajero tenga un
%       maximo alcanzable, v^2/(4*Brazo*g), mas alla del cual acercar mas el
%       pasajero al centro de giro la baja. Si el objetivo esta por encima se
%       devuelve la curvatura de ese maximo y el chequeo posterior de "Gz
%       objetivo alcanzado" lo reporta con el motivo.
%
%   En FuerzaGConstante y GNormativaMaxima aparece Uz, la componente vertical
%   del versor "arriba del carro", que en un loop plano vale cos(theta): en la
%   cuspide es -1 y ahi la velocidad es minima, asi que la curvatura es
%   maxima. Eso es lo que da la forma de lagrima del loop clotoide real. Si
%   sale un circulo, hay error.
%
%   GNormativaMaxima pide en cada punto el +Gz de la curva limite para la
%   duracion del evento sostenido. Reloj dice como se mide esa duracion:
%     - numerico: instante del modelo desde el que se cuenta (x sqrt(lambda)
%       para entrar a la curva). Con Inf la duracion es cero: es lo que usa
%       la rampa de entrada, que apunta al nivel de evento corto.
%     - struct de ObjetivoNormativoPorNiveles: la tabla del arco, con el
%       reloj de cada nivel arrancando donde la G registrada antes del arco
%       lo cruzo. Es lo que hace que la verificacion por nivel de
%       VerificarLimitesNormativos cierre con lo que el modo diseno.
%   En los dos casos el objetivo lleva descontado TolObjetivoDeG, el error
%   que el chequeo posterior le tolera al transporte inverso.
%
%   El limite que persigue va dividido por Parametros.FactorDeSeguridadNormativo:
%   es el objetivo de DISENO, con margen. El factor se aplica aca y en el
%   criterio que reconstruye el objetivo (ConstruirElemento), y en ningun
%   otro lado: la verificacion compara contra la norma literal. En el dive
%   loop se dividen tambien los dos semiejes de la elipse y la curva de Gy,
%   para que el Gy objetivo quede escalado igual que el Gz.

    g = Parametros.Gravedad;
    d = Parametros.DistanciaHeartline;
    Brazo = BrazoDeVerificacion(Parametros);

    VelocidadCentroDeMasa = max(Punto.VelocidadParaCurvatura, 1e-3);
    ArribaVertical = Punto.VersorArribaCarro(3);
    AnguloDesdeArriba = Punto.AnguloCurvaturaDesdeArriba;
    Coseno = cos(AnguloDesdeArriba);

    switch Parametros.ModoCurvatura
        case 'Clotoide'
            % Radio de referencia del PASAJERO: el riel va d*c mas afuera.
            RadioRiel = max(Parametros.RadioDeReferencia + d*Coseno, 0.5*Parametros.RadioDeReferencia);
            Curvatura = 1 / RadioRiel;
            return

        case 'AceleracionNormalConstante'
            % a_n es la aceleracion centripeta del pasajero sobre U, sin la gravedad.
            ObjetivoSinGravedad = Parametros.AceleracionNormalObjetivo / VelocidadCentroDeMasa^2;

        case 'FuerzaGConstante'
            ObjetivoSinGravedad = g*(Parametros.FuerzaGObjetivo - ArribaVertical) / VelocidadCentroDeMasa^2;

        case 'GNormativaMaxima'
            if nargin < 5 || ~isfield(Receta, 'CurvaLimiteGz') || isempty(Receta.CurvaLimiteGz)
                error('CurvaturaDelModo:SinCurvaLimite', ...
                     ['El modo GNormativaMaxima necesita Receta.CurvaLimiteGz: cada elemento ' ...
                      'declara que curva de la norma persigue (ver ElementoLoopVertical y companeros).']);
            end
            % Objetivo de diseno: la curva de la norma con los quiebres
            % redondeados por debajo (LimiteDeDiseno), el margen del factor
            % y la tolerancia del chequeo posterior descontada.
            FactorDeSeguridad = Parametros.FactorDeSeguridadNormativo;
            Semiancho = Parametros.SemianchoDeSuavizadoNormativo;
            if isstruct(Reloj)
                % Arco: la tabla por niveles ya trae el factor y el margen.
                % La duracion desde el arco solo la usa la curva de Gy.
                GLimite      = EvaluarObjetivoNormativo(Reloj, Punto.Tiempo);
                DuracionReal = max(Punto.Tiempo - Reloj.TiempoInicioArco, 0) * Escala.RaizLambdaLoop;
            else
                DuracionReal = max(Punto.Tiempo - Reloj, 0) * Escala.RaizLambdaLoop;
                GLimite = LimiteDeDiseno(Receta.CurvaLimiteGz, DuracionReal, Semiancho) / FactorDeSeguridad ...
                        - Parametros.TolObjetivoDeG;
            end
            ObjetivoSinGravedad = g*(GLimite - ArribaVertical) / VelocidadCentroDeMasa^2;

            if isfield(Receta, 'CurvaLimiteGy') && ~isempty(Receta.CurvaLimiteGy)
                GyObjetivo = ObjetivoDeGyDentroDeLaElipse(GLimite, DuracionReal, Receta, ...
                                                          Parametros.TolObjetivoDeG, FactorDeSeguridad, Semiancho);
                [Curvatura, AnguloDesdeArriba] = CurvaturaDelRielParaGzYGyObjetivo( ...
                    ObjetivoSinGravedad, (GyObjetivo - Punto.VersorLateral(3))*g/VelocidadCentroDeMasa^2, ...
                    Brazo, d, VelocidadCentroDeMasa, Punto.VelocidadRoll, Punto.AceleracionRoll, ...
                    -g*Punto.VersorTangente(3), Punto.InclinacionHelicoidal);
                return
            end

        otherwise
            error('CurvaturaDelModo:ModoDesconocido', 'Modo de curvatura no reconocido: %s', Parametros.ModoCurvatura);
    end

    if abs(Coseno) < 0.1
        error('CurvaturaDelModo:CurvaturaSinComponenteArriba', ...
             ['El modo %s pide +Gz pero la curvatura forma %.0f grados con el eje arriba del carro ' ...
              '(cos = %.3f): una curva sin peraltar no puede generar +Gz, genera Gy. ' ...
              'Hay que peraltar el elemento o cambiar de modo.'], ...
              Parametros.ModoCurvatura, rad2deg(AnguloDesdeArriba), Coseno);
    end

    Curvatura = CurvaturaDelRielParaGzObjetivo(ObjetivoSinGravedad, Coseno, Brazo, d, ...
                                                Punto.VelocidadRoll, Punto.InclinacionHelicoidal);
    Curvatura = max(Curvatura, 0);   % un loop no invierte el sentido de giro
end

%% ========================= auxiliares =====================================
function GyObjetivo = ObjetivoDeGyDentroDeLaElipse(GzLimite, DuracionReal, Receta, Tolerancia, FactorDeSeguridad, Semiancho)
%OBJETIVODEGYDENTRODELAELIPSE Gy maximo admisible dado el Gz que ya se pide.
%   Apuntar a la vez al +Gz maximo de la Fig. 10 y al |Gy| maximo de la
%   Fig. 8 viola la elipse de dos ejes de 7.1.5.1 por construccion:
%   (3.0/3.3)^2 + (6.0/6.6)^2 = 1.65 > 1. Decision del usuario: se prioriza
%   el Gz al maximo y el Gy es lo que deja la elipse, o la curva de la
%   Fig. 8 si es mas restrictiva. Los semiejes son los limites de 200 ms
%   multiplicados por 1.1, igual que en VerificarLimitesNormativos. El lado
%   lo fija Receta.SentidoDeGy (+1 hacia el versor lateral del carro).
%
%   GzLimite llega ya dividido por el factor de seguridad (y con la
%   tolerancia descontada: es el Gz que de verdad va a haber), y aca se
%   dividen tambien los dos semiejes y la curva de Gy: la elipse entera se escala y
%   el Gy objetivo queda con el mismo margen que el Gz. Dividir solo el Gz
%   dejaria la elipse sin escalar y el Gy objetivo inconsistente. La curva
%   de Gy es la de diseno (quiebres redondeados, LimiteDeDiseno); los
%   semiejes son los literales de 200 ms, que son constantes.
%
%   Se le descuenta al objetivo la tolerancia con la que el chequeo posterior
%   admite que el transporte inverso erre (TolObjetivoDeG): un objetivo
%   exactamente sobre la elipse la viola con el ruido numerico de la
%   simulacion, y el chequeo de 7.1.5.1 es estricto.
    SemiejeGz = 1.1*abs(LimiteNormativo(Receta.CurvaLimiteGz, 0.2)) / FactorDeSeguridad;
    SemiejeGy = 1.1*abs(LimiteNormativo(Receta.CurvaLimiteGy, 0.2)) / FactorDeSeguridad;
    GyDeLaElipse = SemiejeGy*sqrt(max(1 - (GzLimite/SemiejeGz)^2, 0));
    GyDeLaCurva  = abs(LimiteDeDiseno(Receta.CurvaLimiteGy, DuracionReal, Semiancho)) / FactorDeSeguridad;
    GyObjetivo   = Receta.SentidoDeGy * max(min(GyDeLaElipse, GyDeLaCurva) - Tolerancia, 0);
end

function [Curvatura, AnguloDesdeArriba] = CurvaturaDelRielParaGzYGyObjetivo(ObjetivoZ, ObjetivoY, Brazo, d, ...
        VelocidadCentroDeMasa, VelocidadRollBase, AceleracionRoll, AceleracionTangencial, Inclinacion)
%CURVATURADELRIELPARAGZYGYOBJETIVO Dos objetivos, dos incognitas: ku y kl.
%   ObjetivoZ = (Gz_obj - Uz)*g/v_cm^2 y ObjetivoY = (Gy_obj - Lz)*g/v_cm^2.
%   Gz depende solo de ku (CargasEnLaVia), asi que ku sale de la misma
%   cuadratica del caso de un objetivo con c = 1. Con ku conocido, la
%   ecuacion de Gy es lineal en kl:
%       kl*(1 - Brazo*ku) = J^2*(ObjetivoY - Brazo*a_t*phi'/v_cm^2) - Brazo*phi''
%   con J^2 = (1 - d*ku)^2 + d^2*phi'^2. El angulo de la curvatura respecto
%   de U queda resuelto, no prescripto: es el sub-peralte. Si hay helice,
%   phi' lleva Inclinacion*kappa y se cierra por punto fijo.

    Curvatura = 0;
    for Iteracion = 1:4
        VelocidadRoll = VelocidadRollBase + Inclinacion*Curvatura;
        CurvaturaArribaCarro = CurvaturaDelRielParaGzObjetivo(ObjetivoZ, 1, Brazo, d, VelocidadRoll, 0);
        FactorJ2 = (1 - d*CurvaturaArribaCarro)^2 + (d*VelocidadRoll)^2;
        CurvaturaLateralCarro = (FactorJ2*(ObjetivoY - Brazo*AceleracionTangencial*VelocidadRoll/VelocidadCentroDeMasa^2) ...
                                 - Brazo*AceleracionRoll) / (1 - Brazo*CurvaturaArribaCarro);
        CurvaturaNueva = hypot(CurvaturaArribaCarro, CurvaturaLateralCarro);
        if Inclinacion == 0 || abs(CurvaturaNueva - Curvatura) < 1e-10
            Curvatura = CurvaturaNueva;
            break
        end
        Curvatura = CurvaturaNueva;
    end
    AnguloDesdeArriba = atan2(CurvaturaLateralCarro, CurvaturaArribaCarro);
end

function Curvatura = CurvaturaDelRielParaGzObjetivo(Objetivo, Coseno, Brazo, d, VelocidadRollBase, Inclinacion)
%CURVATURADELRIELPARAGZOBJETIVO Cuadratica del transporte inverso.
%   Objetivo = (Gz_objetivo - Uz)*g/v_cm^2, o sea la centripeta que hay que
%   darle al pasajero medida con la velocidad del centro de masa. Con
%   v^2 = v_cm^2/J^2 y J^2 = (1 - d*kappa*c)^2 + d^2*phi'^2 la ecuacion
%       kappa*c*(1 - Brazo*kappa*c) - Brazo*phi'^2 = Objetivo*J^2
%   es cuadratica en kappa para phi' dado:
%       a2*kappa^2 + a1*kappa + a0 = 0
%       a2 = -c^2*(Brazo + Objetivo*d^2)
%       a1 =  c*(1 + 2*Objetivo*d)
%       a0 = -(Objetivo*(1 + d^2*phi'^2) + Brazo*phi'^2)
%   Se toma la raiz que tiende a Objetivo/c cuando los brazos van a cero,
%   escrita como 2*a0/(-a1 - sqrt(disc)) para no restar numeros parecidos.
%   phi' = phi'_transicion + Inclinacion*kappa se cierra por punto fijo.

    Curvatura = 0;
    for Iteracion = 1:3
        VelocidadRoll = VelocidadRollBase + Inclinacion*Curvatura;

        a2 = -Coseno^2*(Brazo + Objetivo*d^2);
        a1 =  Coseno*(1 + 2*Objetivo*d);
        a0 = -(Objetivo*(1 + d^2*VelocidadRoll^2) + Brazo*VelocidadRoll^2);

        if abs(a2) < 1e-12
            CurvaturaNueva = -a0/a1;
        else
            Discriminante = a1^2 - 4*a2*a0;
            if Discriminante < 0
                % Objetivo inalcanzable: el pasajero esta tan cerca del centro
                % de giro que acercarlo mas ya no sube su G. Se devuelve la
                % curvatura del maximo; el chequeo posterior lo reporta.
                CurvaturaNueva = -a1/(2*a2);
            else
                CurvaturaNueva = 2*a0/(-a1 - sqrt(Discriminante));
            end
        end

        if Inclinacion == 0 || abs(CurvaturaNueva - Curvatura) < 1e-10
            Curvatura = CurvaturaNueva;
            break
        end
        Curvatura = CurvaturaNueva;
    end
end
