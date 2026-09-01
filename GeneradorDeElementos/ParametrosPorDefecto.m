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
% SIN CERRAR: las dimensiones definitivas dependen de la huella disponible.
Parametros.AlturaMaximaDelElemento = 1.00;   % [m] restriccion dura del proyecto

% RadioDeReferencia es la longitud caracteristica de Froude: fija lambda, el
% presupuesto de onset y la conversion de duraciones contra las curvas de la
% norma. Cada elemento lo pisa con su propio radio antes de generar, asi que
% este valor es solo el que queda si se llama al motor a mano.
Parametros.RadioDeReferencia = 0.21;   % [m]

%% ------------------- Geometria de cada elemento -----------------------
% --- Loop vertical ---
Parametros.RadioDelLoop     = 0.11;   % [m] radio de cuspide objetivo
Parametros.RollExtraDelLoop = 0;      % [rad] 0 = loop vertical estandar
% La separacion entre patas NO es opcional: un giro de 2*pi contenido en un
% plano vuelve a pasar por donde entro, asi que un loop plano se choca consigo
% mismo siempre. El generador impone la inclinacion helicoidal necesaria para
% llegar a este valor. Poner 0 fuerza el loop plano, que sirve de referencia
% pero no es fabricable. El valor por defecto se calcula al final del archivo
% a partir de la envolvente, para que supere la separacion exigida.

% Los radios de abajo son grandes comparados con el loop, y no por capricho:
% la G centripeta vale v^2/(g*R), asi que a 4.5 m/s un radio de 0.3 m ya da
% 6.9 G. El loop se salva porque el carro sube y frena; un giro horizontal
% mantiene la velocidad todo el recorrido. A la escala del modelo los giros
% necesitan radios del orden del metro. SIN CERRAR: dependen de la huella.

% --- Dive loop: media vuelta hacia abajo, entrando invertido ---
% Gira pi y no llega a cruzarse consigo mismo, asi que no necesita separacion.
Parametros.RadioDelDiveLoop       = 0.45;   % [m]
Parametros.SeparacionDelDiveLoop  = 0;      % [m]

% --- Helice: giro sostenido subiendo o bajando ---
Parametros.RadioDeLaHelice   = 0.70;          % [m]
Parametros.VueltasDeLaHelice = 1.0;           % [-] puede no ser entero
Parametros.AvanceDeLaHelice  = -0.30;         % [m] sobre el eje de la helice;
                                              % con entrada a nivel es la altura.
                                              % Negativo = baja.
Parametros.PeralteDeLaHelice = deg2rad(55);   % [rad]

% --- Over-banked turn: giro peraltado mas de 90 grados ---
Parametros.RadioDelGiro   = 0.80;          % [m]
Parametros.AnguloDelGiro  = deg2rad(120);  % [rad] cambio de rumbo
Parametros.PeralteDelGiro = deg2rad(110);  % [rad] mas de 90 = over-banked
Parametros.AvanceDelGiro  = 0;             % [m] 0 = giro a nivel

% Sentido comun a helice, over-banked turn y cualquier giro futuro.
Parametros.SentidoDelGiro = 'Derecha';   % 'Derecha' | 'Izquierda'

% Modo de curvatura del arco:
%   'AceleracionNormalConstante' | 'Clotoide' | 'FuerzaGConstante' | 'GMaximas'
Parametros.ModoCurvatura              = 'Clotoide';

% Metodo de acoplamiento geometria-dinamica:
%   'A'      marcha acoplada hacia adelante, una sola pasada. Es el rapido.
%   'B'      punto fijo sobre el perfil de velocidad. Itera, tarda ~3 veces mas.
%   'Ambos'  corre los dos y reporta la comparacion. Solo para el reporte:
%            la geometria que queda es la del metodo A.
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
% dimension del modelo y la del prototipo. Modelo distorsionado: RadioDeReferencia y
% LargoCarro son independientes y cada uno tiene su propio lambda.
Parametros.RadioDeReferenciaReal  = 8.00;   % [m] atraccion de referencia -- SIN VERIFICAR
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
Parametros.VersoresEnGrafico3D = 40;   % flechas del marco del carro en la vista 3D
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
Parametros.SeparacionDePatas = 1.2*(DiametroEnvolvente + Parametros.DistanciaMinimaEntreVias);

% Alternativa: imponer la inclinacion helicoidal (tan del angulo entre la
% tangente y el plano del loop) en vez de pedir un desplazamiento.
Parametros.InclinacionHelicoidalImpuesta = [];
end
