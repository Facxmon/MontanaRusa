function [Limite, Tabla] = LimiteNormativo(Curva, Duracion)
%LIMITENORMATIVO Curvas limite de aceleracion de ASTM F2291-06a, seccion 7.
%   El limite NO es puntual: depende de cuanto tiempo lleva el pasajero por
%   encima de ese nivel. Interpolacion lineal por tramos, con extension
%   constante fuera de la tabla.
%
%   La duracion que entra aca es la del PROTOTIPO. Para evaluar un resultado
%   del modelo hay que multiplicar antes su duracion por sqrt(lambda).
%
%   El segundo argumento de salida es la tabla [duracion, limite] de la
%   curva, para quien necesite sus quiebres (LimiteDeDiseno). Esta es la
%   curva LITERAL, la que usa la verificacion; el objetivo de diseno del
%   modo normativo es LimiteDeDiseno, que la redondea por debajo.
%
%   Criterios autoimpuestos: una maqueta sin pasajeros no esta sujeta a la
%   norma. Se adoptan como criterio de diseno. Valores leidos de las Figs. 6
%   a 10 de la edicion 06a; la version vigente es la 25c. Las tablas de aca
%   tienen que coincidir fila por fila con memoria_de_calculo.md, seccion 5:
%   ese documento es la fuente y este archivo la transcribe.

    switch Curva
        case 'MasGzTodas'        % Fig. 10, todas las sujeciones
            Tabla = [0.2 6.0; 1.0 6.0; 1.5 5.0; 2.0 4.0; 2.5 4.0; 4.0 4.0; 5.0 3.0; 11.8 3.0; 12.0 2.0; 40 2.0];
        case 'MasGzReducido'     % Fig. 10, precedido por >= 3 s de -Gz (7.1.7.1)
            Tabla = [0.2 5.0; 1.0 5.0; 1.5 5.0; 2.0 4.0; 2.5 2.0; 4.0 2.0; 5.0 2.0; 11.8 2.0; 12.0 2.0; 40 2.0];
        case 'MenosGzBase'       % Fig. 9, base case
            Tabla = [0.2 -2.0; 0.5 -1.5; 1.0 -1.5; 3.0 -1.5; 4.0 -1.5; 7.0 -1.1; 40 -1.1];
        case 'MenosGzExtendido'  % Fig. 9, extended
            Tabla = [0.2 -2.8; 0.5 -2.5; 1.0 -2.2; 3.0 -1.5; 4.0 -1.5; 7.0 -1.1; 40 -1.1];
        case 'GyBase'            % Fig. 8, lateral
            Tabla = [0.2 3.0; 1.0 3.0; 2.0 2.0; 40 2.0];
        case 'MasGxBase'         % Fig. 6, eyes back
            Tabla = [0.2 6.0; 1.0 6.0; 2.0 4.0; 4.0 4.0; 5.0 3.0; 11.8 3.0; 12.0 2.5; 40 2.5];
        case 'MenosGxBase'       % Fig. 7, eyes front
            Tabla = [0.2 -2.0; 0.5 -1.5; 12.0 -1.5; 40 -1.5];
        case 'MenosGxOTS'        % Fig. 7, over-the-shoulder
            Tabla = [0.2 -2.0; 12.0 -2.0; 40 -2.0];
        case 'MenosGxProne'      % Fig. 7, prone
            Tabla = [0.2 -3.5; 2.0 -3.5; 3.0 -2.5; 4.0 -2.5; 5.0 -2.0; 40 -2.0];
        otherwise
            error('LimiteNormativo:CurvaDesconocida', 'Curva normativa no reconocida: %s', Curva);
    end

    DuracionAcotada = min(max(Duracion, Tabla(1,1)), Tabla(end,1));
    Limite = interp1(Tabla(:,1), Tabla(:,2), DuracionAcotada, 'linear');
end
