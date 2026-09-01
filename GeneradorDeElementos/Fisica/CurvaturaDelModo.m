function Curvatura = CurvaturaDelModo(Punto, Parametros, Escala, ArcoTiempoDeReferencia)
%CURVATURADELMODO Curvatura objetivo del arco del loop segun el modo elegido.
%   Modos 1, 3 y 4 dependen de v: ahi esta el origen del acoplamiento entre
%   geometria y dinamica que obliga a los dos metodos de resolucion.
%
%   En los modos 3 y 4 aparece la componente vertical del versor "arriba del
%   carro", que en un loop plano vale cos(theta): en la cuspide es -1 y ahi
%   la velocidad es minima, asi que la curvatura es maxima. Eso es lo que da
%   la forma de lagrima del loop clotoide real. Si sale un circulo, hay error.

    Velocidad = max(Punto.VelocidadParaCurvatura, 1e-3);
    ArribaVertical = Punto.VersorArribaCarro(3);
    g = Parametros.Gravedad;

    switch Parametros.ModoCurvatura
        case 'AceleracionNormalConstante'
            Curvatura = Parametros.AceleracionNormalObjetivo / Velocidad^2;

        case 'Clotoide'
            Curvatura = 1 / Parametros.RadioDeReferencia;

        case 'FuerzaGConstante'
            Curvatura = g*(Parametros.FuerzaGObjetivo - ArribaVertical) / Velocidad^2;

        case 'GMaximas'
            DuracionModelo = max(Punto.Tiempo - ArcoTiempoDeReferencia, 0);
            DuracionReal   = DuracionModelo * Escala.RaizLambdaLoop;
            GLimite = LimiteNormativo(Parametros.CurvaLimiteGMaximas, DuracionReal);
            Curvatura = g*(GLimite - ArribaVertical) / Velocidad^2;

        otherwise
            error('CurvaturaDelModo:ModoDesconocido', 'Modo de curvatura no reconocido: %s', Parametros.ModoCurvatura);
    end

    Curvatura = max(Curvatura, 0);   % un loop no invierte el sentido de giro
end
