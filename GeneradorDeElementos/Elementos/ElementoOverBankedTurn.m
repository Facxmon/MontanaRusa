function [EstadoSalida, Elemento, Reporte] = ElementoOverBankedTurn(EstadoEntrada, Parametros, Layout)
%ELEMENTOOVERBANKEDTURN Giro peraltado mas alla de la vertical.
%   Geometricamente es una helice de menos de una vuelta: la curvatura queda
%   horizontal y el elemento cambia el rumbo. Lo que lo hace over-banked es el
%   peralte, que pasa de 90 grados y deja al pasajero mirando hacia adentro y
%   un poco hacia abajo.
%
%   Que el peralte sea un parametro aparte de la curvatura es justamente lo que
%   permite pasarse de 90 grados: la curva sigue siendo horizontal y lo unico
%   que cambia es como esta parado el carro sobre ella. Eso lo habilita el
%   marco de transporte paralelo con el roll explicito encima; con Frenet el
%   peralte quedaria atado a la geometria y no se podria elegir.
%
%   El peralte puede ser constante (PeralteDelGiro) o relativo al centro
%   instantaneo de rotacion con un desvio constante (ModoDePeralteDelGiro,
%   DesvioDePeralteDelGiro); ver PeralteDelElemento.
%
%   Llamado sin argumentos devuelve la declaracion de los parametros
%   geometricos que consume (ver DeclaracionDeParametros).

    if nargin == 0
        EstadoSalida = DeclaracionDeParametros( ...
            'RadioDelGiro',   'm',   ['radio de la heartline en el arco: en ArcoCircular es el que se impone y en Clotoide es el radio minimo; en los modos ' ...
                                      'dependientes de v es solo la longitud caracteristica de Froude y el radio real es una salida'], ...
            'AnguloDelGiro',  'rad', 'cambio de rumbo', ...
            'PeralteDelGiro', 'rad', 'roll del carro respecto de la vertical en el arco (mas de pi/2 = over-banked); solo con ModoDePeralteDelGiro = ''Constante''', ...
            'AvanceDelGiro',  'm',   'cuanto sube o baja sobre el eje vertical (0 = giro a nivel)', ...
            'SentidoDelGiro', '-',   '''Derecha'' o ''Izquierda''', ...
            'ModoDePeralteDelGiro',   '-',   ['''Constante'' (PeralteDelGiro), ''RelativoAlCentroDeCurvatura'' o ''RelativoALaFuerza'': ' ...
                                              'desvio constante respecto del CIR'], ...
            'DesvioDePeralteDelGiro', 'rad', ['desvio del peralte respecto del CIR en los modos relativos; positivo = mas volcado ' ...
                                              'hacia adentro del giro'], ...
            'PeralteAlineadoAlCentroDeCurvatura', '-', ['logico: U apunta siempre al centro de curvatura del riel (CIR como centro ' ...
                                                        'de curvatura); excluyente con PeralteAlineadoALaFuerza'], ...
            'PeralteAlineadoALaFuerza',           '-', ['logico: U sigue siempre a la fuerza especifica total, centripeta mas gravedad ' ...
                                                        '(CIR como direccion de la fuerza: Gy nula en el riel); excluyente con la anterior']);
        return
    end
    if nargin < 3
        Layout = [];
    end

    Parametros.RadioDeReferencia = Parametros.RadioDelGiro;
    Sentido = SignoDelSentido(Parametros.SentidoDelGiro);

    Receta.Nombre                 = 'OverBankedTurn';
    Receta.GiroObjetivo           = Parametros.AnguloDelGiro;
    Receta.DesfasajeDeCurvatura   = Sentido * pi/2;
    Receta.RollDelElemento        = Sentido * Parametros.PeralteDelGiro;
    Receta.DesplazamientoObjetivo = -Sentido * Parametros.AvanceDelGiro;
    Receta.CurvaLimiteGz          = 'MasGzTodas';   % Fig. 10: lo que persigue el modo normativo
    Receta = PeralteDelElemento(Receta, Parametros, Parametros.ModoDePeralteDelGiro, ...
                                Sentido * Parametros.DesvioDePeralteDelGiro, 0);

    [EstadoSalida, Elemento, Reporte] = ConstruirElemento(EstadoEntrada, Parametros, Receta, Layout);
end

function Signo = SignoDelSentido(Texto)
    if strcmpi(Texto, 'Izquierda')
        Signo = -1;
    elseif strcmpi(Texto, 'Derecha')
        Signo = +1;
    else
        error('ElementoOverBankedTurn:SentidoDesconocido', ...
              'SentidoDelGiro tiene que ser ''Derecha'' o ''Izquierda'', no ''%s''.', Texto);
    end
end
