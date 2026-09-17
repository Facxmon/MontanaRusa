%% Diagnostico de planitud del dive loop: torcido o no, y por que
% El dive loop en modo GNormativaMaxima sale "torcido": la trayectoria se
% va progresivamente del plano vertical de entrada. La hipotesis es que no
% es un bug sino el Gy objetivo materializandose: en ese modo la Receta
% trae CurvaLimiteGy, CurvaturaDelModo resuelve un sub-peralte psi y la
% curvatura del riel queda con una componente lateral sostenida en todo el
% arco, que es por definicion una trayectoria que abandona el plano.
%
% Se corre el mismo dive loop en Clotoide y en FuerzaGConstante (ninguno
% persigue Gy) y en GNormativaMaxima, y se mide la desviacion del plano con
% algo cuantitativo: el valor singular mas chico de PuntosRiel centrado,
% que es la distancia RMS al mejor plano por minimos cuadrados, y la
% distancia maxima a ese plano. Si en los modos sin Gy sale plano y en el
% normativo no, esta confirmado. Si sigue torcido sin Gy, hay un bug real
% en el armado del plano del elemento (GenerarGeometria, DireccionDeCurvatura
% con DesfasajeDeCurvatura = pi y RollDelElemento = pi).
%
% No corrige nada. Los resultados de referencia estan en
% Claude outputs/resumen-diagnostico-graficos-roll-fs.md.

clear; clc
addpath(genpath(fullfile(fileparts(mfilename('fullpath')), '..', 'GeneradorDeElementos')));

PosicionInicial  = [0, 0, 1.00];   % [m]
VelocidadInicial = 4.60;           % [m/s]
Modos = {'Clotoide', 'FuerzaGConstante', 'GNormativaMaxima'};

fprintf('%-18s %-10s %10s %10s %10s %10s %10s %10s %10s %10s\n', 'Modo', 'Sentido', 'RMS plano', 'max plano', 'sigma3/1', ...
        'inclin.', 'psi max', 'peralte fin', 'y salida', 'Gy max');
fprintf('%-18s %-10s %10s %10s %10s %10s %10s %10s %10s %10s\n', '', '', '[mm]', '[mm]', '[-]', '[grados]', '[grados]', '[grados]', '[m]', '[G]');
for m = 1:numel(Modos)
    Sentidos = {'Derecha'};
    if strcmp(Modos{m}, 'GNormativaMaxima')
        Sentidos = {'Derecha', 'Izquierda'};   % el torcido tiene que cambiar de lado con el sentido
    end
    for s = 1:numel(Sentidos)
        Parametros = ParametrosPorDefecto();
        Parametros.ModoCurvatura           = Modos{m};
        Parametros.MetodoDeAcoplamiento    = 'A';
        Parametros.CalcularVelocidadMinima = false;
        Parametros.SentidoDelGiro          = Sentidos{s};
        Estado = EstadoInicial(PosicionInicial, [1 0 0], [0 0 1], VelocidadInicial, Parametros);
        [~, Elemento] = ElementoDiveLoop(Estado, Parametros);
        Track = Elemento.Track;  Sim = Elemento.Sim;

        % Solo el arco y sus clotoides: la transicion de roll de entrada es
        % un tramo recto y no dice nada del plano del giro.
        Desde = Track.SubTramos(find(strcmp({Track.SubTramos.Nombre}, 'ClotoideEntrada'), 1)).IndiceInicio;
        [DistanciaRMS, DistanciaMaxima, RazonSingular, Inclinacion] = DesviacionDelPlano(Track.PuntosRiel(Desde:end, :));
        fprintf('%-18s %-10s %10.3f %10.3f %10.2e %10.2f %10.2f %10.2f %10.3f %10.3f\n', Modos{m}, Sentidos{s}, ...
                1000*DistanciaRMS, 1000*DistanciaMaxima, RazonSingular, rad2deg(Inclinacion), ...
                rad2deg(max(abs(Track.AnguloCurvaturaDesdeArriba))), rad2deg(Track.AnguloPeralte(end)), ...
                Track.PuntosRiel(end, 2), max(abs(Sim.Gy)));
    end
end

fprintf(['\nLectura. "RMS plano" y "max plano" son la distancia del riel a su mejor plano: si son del\n' ...
         'orden del paso de generacion (%.1f mm) o menores, el giro es PLANO en ese modo. "inclin." es\n' ...
         'cuanto se aparta ese plano de la vertical. En Clotoide y FuerzaGConstante tienen que dar\n' ...
         'plano y vertical: si no, hay un bug en el armado del plano. En GNormativaMaxima el giro\n' ...
         'tambien es plano, pero el plano esta inclinado psi respecto de la vertical: con el carro\n' ...
         'invertido a roll fijo, la unica forma de darle a la curvatura una componente lateral\n' ...
         'sostenida (el sub-peralte que produce el Gy objetivo) es inclinar el plano entero del\n' ...
         'giro. Consecuencias geometricas del Gy objetivo, no bugs: la salida queda desplazada\n' ...
         'lateralmente (y salida) y el carro sale peraltado 2*psi, porque U gira pi alrededor de la\n' ...
         'normal del plano inclinado. El signo cambia con SentidoDelGiro.\n'], ...
        1000*ParametrosPorDefecto().PasoGeneracion);

%% ========================= auxiliares =====================================
function [DistanciaRMS, DistanciaMaxima, RazonSingular, Inclinacion] = DesviacionDelPlano(Puntos)
%DESVIACIONDELPLANO Distancia de una polilinea a su mejor plano, e inclinacion
%   de ese plano respecto de la vertical.
%   Con los puntos centrados, la SVD da como tercer vector singular la
%   normal del plano de minimos cuadrados y como tercer valor singular la
%   raiz de la suma de cuadrados de las distancias a ese plano: dividido por
%   sqrt(n) es la distancia RMS. La razon sigma3/sigma1 es adimensional y
%   no depende del tamano del elemento. Un plano vertical tiene normal
%   horizontal: la inclinacion es el angulo de la normal con la horizontal.
    Centrados = Puntos - mean(Puntos, 1);
    [~, S, V] = svd(Centrados, 'econ');
    Sigma = diag(S);
    Normal = V(:, 3);
    Distancias = Centrados * Normal;
    DistanciaRMS    = Sigma(3) / sqrt(size(Puntos, 1));
    DistanciaMaxima = max(abs(Distancias));
    RazonSingular   = Sigma(3) / Sigma(1);
    Inclinacion     = asin(abs(Normal(3)));
end
