function Parametros = ParametrosPorDefecto()
%PARAMETROSPORDEFECTO Bloque unico de parametros de entrada del generador.
%   Todo valor configurable del proyecto vive aca. Los marcados como
%   "SIN CERRAR" dependen de investigacion pendiente (disponibilidad de
%   componentes en Argentina, tolerancia de la impresora 3D) y estan puestos
%   como valores por defecto razonables, no como decisiones tomadas.

%% ------------------------- Constantes fisicas -------------------------
Parametros.Gravedad = 9.81;    % [m/s^2]
Parametros.RhoAire  = 1.20;    % [kg/m^3] aire a ~20 C, nivel del mar

%% --------------------- Resistencia al avance --------------------------
% Un coeficiente por juego de ruedas. No es un mu de deslizamiento: el carro
% va sobre ruedas con rodamientos. PROVISORIOS -- CALIBRAR EXPERIMENTALMENTE.
Parametros.CrrPortantes = 0.030;   % ruedas de carga
Parametros.CrrGuia      = 0.035;   % ruedas laterales
Parametros.CrrRetencion = 0.035;   % ruedas de retencion (up-stop)

Parametros.ModelarArrastre = true;
Parametros.CoefArrastre    = 0.90;   % [-] cuerpo romo, provisorio
Parametros.FactorTren      = 0.25;   % [-] arrastre de cada carro detras del primero

%% ------------------------- Tren y carro -------------------------------
Parametros.NumeroDeCarros = 1;       % arquitectura preparada para N

% SIN CERRAR: dependen de la disponibilidad local de rodamientos y de la
% tolerancia alcanzable por impresion 3D.
Parametros.Masa               = 0.15;    % [kg]
Parametros.LargoCarro         = 0.10;    % [m]
Parametros.AltoCarro          = 0.06;    % [m]
Parametros.AnchoVia           = 0.06;    % [m] trocha
Parametros.Holgura            = 0.010;   % [m] margen sobre la envolvente
Parametros.DiametroRueda      = 0.0136;  % [m] piso impuesto por el rodamiento minimo
Parametros.DistanciaHeartline = 0.030;   % [m] parametro virtual de evaluacion, no fisico
Parametros.AreaFrontal        = 0.0036;  % [m^2] proyeccion frontal de un carro

%% -------------------- Geometria del loop ------------------------------
% SIN CERRAR: la altura definitiva depende de la huella total disponible.
Parametros.RadioLoop        = 0.21;   % [m] radio de cuspide objetivo
Parametros.AlturaMaximaLoop = 1.00;   % [m] restriccion dura del proyecto
Parametros.RollObjetivoLoop = 0;      % [rad] 0 = loop vertical estandar

% Desplazamiento lateral entre la pata de entrada y la de salida. NO es
% opcional: un giro de 2*pi contenido en un plano vuelve a pasar por donde
% entro, asi que un loop plano se choca consigo mismo siempre. El generador
% impone la torsion necesaria para llegar a este valor. Poner 0 fuerza el loop
% plano, que sirve de referencia pero no es fabricable.
% El valor por defecto se calcula al final del archivo a partir de la
% envolvente, para que quede siempre por encima de la separacion exigida.

% Modo de curvatura del arco:
%   'AceleracionNormalConstante' | 'Clotoide' | 'FuerzaGConstante' | 'GMaximas'
Parametros.ModoCurvatura              = 'Clotoide';

% Metodo de acoplamiento geometria-dinamica: 'A' marcha acoplada, 'B' punto fijo.
Parametros.MetodoDeAcoplamiento = 'A';
Parametros.CalcularVelocidadMinima = true;
Parametros.AceleracionNormalObjetivo  = 20;    % [m/s^2] modo 1
Parametros.FuerzaGObjetivo            = 3.0;   % [G] modo 3, G neta incluida la gravedad
Parametros.CurvaLimiteGMaximas        = 'MasGzTodas';   % modo 4

%% ------------------- Criterios de aceptacion --------------------------
Parametros.GMinimaCuspide = 0.50;   % [G] margen en la cuspide; N = 0 no sirve como criterio

% Presupuesto de onset por eje, EN LA NORMA (prototipo). El presupuesto del
% modelo se obtiene multiplicando por sqrt(lambda_loop): un modelo fiel a
% Froude produce jerk mayor que el prototipo, no menor.
%   Gx: Fig. 6 nota 1 (+Gx sin apoyacabezas)
%   Gy: sin valor normativo propio; se adopta el mas restrictivo -- SIN CERRAR
%   Gz: 7.1.7.2 (de 0 G o menos hacia 2 G o mas)
Parametros.OnsetNormativoPorEje = [5, 5, 15];   % [G/s] reales
Parametros.OnsetMaximoModelo    = [];           % [G/s] override directo; vacio = derivar de Froude

%% ------------------------ Escalado (Froude) ---------------------------
% lambda NO es una propiedad del modelo sino de un emparejamiento entre una
% dimension del modelo y la del prototipo. Modelo distorsionado: RadioLoop y
% LargoCarro son independientes y cada uno tiene su propio lambda.
Parametros.RadioLoopReal  = 8.00;   % [m] atraccion de referencia -- SIN VERIFICAR
Parametros.LargoCarroReal = 2.20;   % [m] atraccion de referencia -- SIN VERIFICAR

%% ---------------------- Fabricacion y espacio -------------------------
Parametros.RadioMinimoFabricable = 0.08;   % [m] SIN CERRAR, lo fija la impresora
Parametros.BoundingBoxDisponible = [-2.0 2.0; -2.0 2.0; 0.0 1.5];   % [m] filas x, y, z
Parametros.AlturaMinimaSuelo     = 0.05;   % [m] z minimo admisible

%% ------------------------ Discretizacion ------------------------------
% Pueden ser distintos: la generacion necesita paso fino para no acumular
% deriva en el endpoint; la simulacion y los graficos no.
Parametros.PasoGeneracion = 0.002;   % [m]
Parametros.PasoSimulacion = 0.005;   % [m]
Parametros.PasosEntreOrtonormalizaciones = 25;
Parametros.PasoBusquedaVelocidad = 0.010;   % [m] paso grueso para la biseccion de v0

%% ------------------------- Tolerancias --------------------------------
Parametros.TolNorma            = 1e-12;
Parametros.TolCierrePitch      = 1e-4;    % [rad]
Parametros.TolPuntoFijo        = 1e-8;    % [m/s] cambio maximo de v entre iteraciones
Parametros.MaxIteracionesPuntoFijo = 60;
Parametros.MaxIteracionesCierre    = 6;
Parametros.MaxIteracionesAjuste     = 8;
Parametros.MargenDeOnset           = 0.002;  % las transiciones se alargan este margen sobre lo justo
Parametros.ToleranciaVelocidadDeDiseno = 0.10;   % [m/s] dispara aviso al re-simular

%% ------------------ Interferencia geometrica --------------------------
Parametros.ArcoMinimoAutointerferencia = 0.30;   % [m] ignora vecinos por construccion
Parametros.DistanciaMinimaEntreVias    = 0.02;   % [m] separacion libre exigida

%% ------------- Derivados de la envolvente -----------------------------
% Diametro del cilindro que circunscribe la seccion de via mas la holgura.
DiametroEnvolvente = hypot(Parametros.AnchoVia  + 2*Parametros.Holgura, ...
                           Parametros.AltoCarro + 2*Parametros.Holgura);
Parametros.DesplazamientoLateralLoop = 1.2*(DiametroEnvolvente + Parametros.DistanciaMinimaEntreVias);

% Alternativa: imponer la inclinacion helicoidal (tan del angulo entre la
% tangente y el plano del loop) en vez de pedir un desplazamiento.
Parametros.InclinacionHelicoidalImpuesta = [];
end
