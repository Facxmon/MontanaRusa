function Brazo = BrazoDeVerificacion(Parametros)
%BRAZODEVERIFICACION Distancia del riel al punto donde se aplica la norma.
%   Es el brazo de palanca respecto del eje de roll (el riel) del punto en el
%   que los modos de curvatura imponen la G objetivo y en el que
%   VerificarLimitesNormativos la compara contra las curvas de la ASTM. Los
%   dos usan este mismo numero: dimensionar en un punto y verificar en otro no
%   cierra.
%
%     'Heartline'  la heartline del pasajero, riel + d*U. Es donde se disena
%                  en la practica y donde mide el ensayo EN-SARC de EN 13814
%                  (Rohde, Development of Acceleration Limits, 2024, cap. 9).
%     'Cabeza'     riel + (d + e)*U, con e = DistanciaHeartlineACabeza. La
%                  cabeza no es el punto de la norma, pero es la parte mas
%                  sensible a las rotaciones y el disenador debe incluirlas
%                  (mismo texto, 7.6.2). Opcion conservadora.

    switch Parametros.PuntoDeVerificacionNormativa
        case 'Heartline'
            Brazo = Parametros.DistanciaHeartline;
        case 'Cabeza'
            Brazo = Parametros.DistanciaHeartline + Parametros.DistanciaHeartlineACabeza;
        otherwise
            error('BrazoDeVerificacion:PuntoDesconocido', ...
                  'PuntoDeVerificacionNormativa tiene que ser ''Heartline'' o ''Cabeza'', no ''%s''.', ...
                  Parametros.PuntoDeVerificacionNormativa);
    end
end
