function [EstadoSalida, Elemento, Reporte] = ElementoHelice(EstadoEntrada, Parametros, Layout)
%ELEMENTOHELICE Helice: giro peraltado sostenido, subiendo o bajando.
%   La curvatura queda horizontal (desfasaje +-pi/2) en vez de en el plano
%   vertical, asi que el eje del giro es vertical y el elemento cambia el rumbo
%   en vez del pitch. Es el mismo motor que el loop: lo que cambia es hacia
%   donde apunta el vector curvatura.
%
%   El avance sobre el eje de la helice es el mismo parametro que en el loop
%   separa las dos patas. Ahi el eje es lateral y sirve para no chocarse; aca
%   el eje es vertical y es directamente cuanto sube o baja el elemento.
%
%   Llamado sin argumentos devuelve la declaracion de los parametros
%   geometricos que consume (ver DeclaracionDeParametros).

    if nargin == 0
        EstadoSalida = DeclaracionDeParametros( ...
            'RadioDeLaHelice',   'm',   ['radio de la heartline en el arco: en Clotoide es el que se impone; en los modos ' ...
                                         'dependientes de v es solo la longitud caracteristica de Froude y el radio real es una salida'], ...
            'VueltasDeLaHelice', '-',   'vueltas del giro (puede no ser entero)', ...
            'AvanceDeLaHelice',  'm',   'cuanto sube (positivo) o baja (negativo) sobre el eje vertical', ...
            'PeralteDeLaHelice', 'rad', 'roll del carro respecto de la vertical en el arco', ...
            'SentidoDelGiro',    '-',   '''Derecha'' o ''Izquierda''');
        return
    end
    if nargin < 3
        Layout = [];
    end

    Parametros.RadioDeReferencia = Parametros.RadioDeLaHelice;
    Sentido = SignoDelSentido(Parametros.SentidoDelGiro);

    Receta.Nombre               = 'Helice';
    Receta.GiroObjetivo         = 2*pi * Parametros.VueltasDeLaHelice;
    Receta.DesfasajeDeCurvatura = Sentido * pi/2;
    Receta.RollDelElemento      = Sentido * Parametros.PeralteDeLaHelice;

    % El eje de la helice sale de T x (direccion de la curvatura), asi que
    % apunta hacia abajo en los giros a derecha y hacia arriba en los de
    % izquierda. Se le pone el signo para que AvanceDeLaHelice signifique
    % siempre "sube" cuando es positivo.
    Receta.DesplazamientoObjetivo = -Sentido * Parametros.AvanceDeLaHelice;
    Receta.CurvaLimiteGz          = 'MasGzTodas';   % Fig. 10: lo que persigue el modo normativo

    [EstadoSalida, Elemento, Reporte] = ConstruirElemento(EstadoEntrada, Parametros, Receta, Layout);
end

function Signo = SignoDelSentido(Texto)
%SIGNODELSENTIDO +1 hacia el versor lateral del carro, que con la via a nivel
%   es la derecha del pasajero.
    if strcmpi(Texto, 'Izquierda')
        Signo = -1;
    elseif strcmpi(Texto, 'Derecha')
        Signo = +1;
    else
        error('ElementoHelice:SentidoDesconocido', ...
              'SentidoDelGiro tiene que ser ''Derecha'' o ''Izquierda'', no ''%s''.', Texto);
    end
end
