function [Curvatura, AnguloDesdeArriba] = CurvaturaDelModo(Punto, Parametros, Escala, ArcoTiempoDeReferencia)
%CURVATURADELMODO Curvatura del RIEL que pide el modo elegido en un punto del arco.
%   Devuelve el modulo de la curvatura del riel y el angulo, medido desde U
%   hacia L en el plano normal del carro, en el que hay que ponerla. Los modos
%   1, 3 y 4 dependen de v: ahi esta el origen del acoplamiento entre
%   geometria y dinamica que obliga a los dos metodos de resolucion.
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
%   En los modos 3 y 4 aparece Uz, la componente vertical del versor "arriba
%   del carro", que en un loop plano vale cos(theta): en la cuspide es -1 y
%   ahi la velocidad es minima, asi que la curvatura es maxima. Eso es lo que
%   da la forma de lagrima del loop clotoide real. Si sale un circulo, hay
%   error.

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

        case 'GMaximas'
            DuracionModelo = max(Punto.Tiempo - ArcoTiempoDeReferencia, 0);
            DuracionReal   = DuracionModelo * Escala.RaizLambdaLoop;
            GLimite = LimiteNormativo(Parametros.CurvaLimiteGMaximas, DuracionReal);
            ObjetivoSinGravedad = g*(GLimite - ArribaVertical) / VelocidadCentroDeMasa^2;

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
