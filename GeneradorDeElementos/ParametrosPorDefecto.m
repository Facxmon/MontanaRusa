function Parametros = ParametrosPorDefecto()
%PARAMETROSPORDEFECTO Bloque unico de parametros de entrada del generador.
%   Todo valor configurable del proyecto vive aca. Los marcados como
%   "SIN CERRAR" dependen de investigacion pendiente (disponibilidad de
%   componentes en Argentina, tolerancia de la impresora 3D) y estan puestos
%   como valores por defecto razonables, no como decisiones tomadas.
%
%   El archivo esta ordenado en cuatro bloques, y los tres primeros son los
%   que DemoElemento muestra y valida:
%     1. PARAMETROS DEL MODO DE CURVATURA   que declara ParametrosDelModo
%     2. PARAMETROS GEOMETRICOS DE CADA ELEMENTO   que declara cada ElementoXxx
%     3. CRITERIOS DE ACEPTACION   que declara ParametrosDeAceptacion
%     4. PARAMETROS GENERALES   fisica, carro, resolucion, escalado,
%                               discretizacion y tolerancias numericas
%   Un valor del bloque 1 solo hace algo en su modo, y uno del bloque 2 solo
%   en su elemento: AjustarParametros avisa si se carga uno que la corrida no
%   va a leer.

%% =================================================================
%% 1. PARAMETROS DEL MODO DE CURVATURA
%% =================================================================
% Modo de curvatura del arco principal. Cada modo fija que G quiere en el
% PASAJERO y CurvaturaDelModo resuelve la curvatura del riel que la produce.
%   'AceleracionNormalConstante'  centripeta del pasajero constante
%   'Clotoide'                    radio de la heartline constante (no depende de v)
%   'FuerzaGConstante'            Gz del pasajero constante
%   'GNormativaMaxima'            Gz del pasajero igual al +Gz maximo que admite
%                                 la curva de la norma para la duracion transcurrida
Parametros.ModoCurvatura = 'Clotoide';

Parametros.AceleracionNormalObjetivo = 20;    % [m/s^2] solo AceleracionNormalConstante
Parametros.FuerzaGObjetivo           = 3.0;   % [G]     solo FuerzaGConstante; G neta incluida la gravedad
% GNormativaMaxima no tiene parametro global: la curva de la norma que persigue
% es parte de la Receta de cada elemento (Receta.CurvaLimiteGz en los cuatro;
% CurvaLimiteGy y SentidoDeGy en el dive loop, acotado por la elipse de 7.1.5.1).
% Clotoide usa el radio del elemento (bloque 2) como radio de la heartline.

%% =================================================================
%% 2. PARAMETROS GEOMETRICOS DE CADA ELEMENTO
%% =================================================================
% El radio de cada elemento cumple dos roles y conviene tenerlos separados:
%   - en el modo Clotoide es el radio que la heartline efectivamente toma;
%   - en TODOS los modos es la longitud caracteristica de Froude: fija lambda,
%     el presupuesto de onset y la conversion de duraciones contra las curvas
%     de la norma. En los modos que dependen de v el radio real es una SALIDA
%     y el chequeo posterior avisa si se aparta del nominal.
% Cada ElementoXxx copia su radio en RadioDeReferencia antes de generar.

% --- Loop vertical ---
Parametros.RadioDelLoop     = 0.11;   % [m] SIN CERRAR
Parametros.RollExtraDelLoop = 0;      % [rad] 0 = loop vertical estandar
% La separacion entre patas NO es opcional: un giro de 2*pi contenido en un
% plano vuelve a pasar por donde entro, asi que un loop plano se choca consigo
% mismo siempre. El generador impone la inclinacion helicoidal necesaria para
% llegar a este valor. Poner 0 fuerza el loop plano, que sirve de referencia
% pero no es fabricable. El valor por defecto se calcula al final del archivo
% a partir de la envolvente, para que supere la separacion exigida.
%   Parametros.SeparacionDePatas  -- ver "Derivados de la envolvente"

% Los radios de abajo son grandes comparados con el loop, y no por capricho:
% la G centripeta vale v^2/(g*R), asi que a 4.5 m/s un radio de 0.3 m ya da
% 6.9 G. El loop se salva porque el carro sube y frena; un giro horizontal
% mantiene la velocidad todo el recorrido. A la escala del modelo los giros
% necesitan radios del orden del metro. SIN CERRAR: dependen de la huella.

% --- Dive loop: media vuelta hacia abajo, entrando invertido ---
% Gira pi y no llega a cruzarse consigo mismo, asi que no necesita separacion.
Parametros.RadioDelDiveLoop      = 0.45;   % [m]
Parametros.SeparacionDelDiveLoop = 0;      % [m]

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

% Sentido comun a helice, over-banked turn y cualquier giro futuro. El dive
% loop lo usa para elegir hacia que lado desalinea la curvatura cuando
% persigue un Gy en modo GNormativaMaxima.
Parametros.SentidoDelGiro = 'Derecha';   % 'Derecha' | 'Izquierda'

% Comun a todos: radio de referencia generico, que cada elemento pisa con el
% suyo. Es solo el que queda si se llama al motor a mano.
Parametros.RadioDeReferencia = 0.21;   % [m]

% Alternativa: imponer la inclinacion helicoidal (tan del angulo entre la
% tangente y el plano del giro) en vez de pedir un desplazamiento.
Parametros.InclinacionHelicoidalImpuesta = [];

%% =================================================================
%% 3. CRITERIOS DE ACEPTACION
%% =================================================================
% Valen en todos los modos y para todos los elementos. GMinimaCuspide NO es
% un parametro del modo de curvatura: es la holgura de cuspide que exige la
% biseccion de velocidad minima (VelocidadInicialMinima) y la estimacion a
% priori de ChequeosPrevios.
Parametros.GMinimaCuspide = 0.50;   % [G] margen en la cuspide; N = 0 no sirve como criterio

% Donde se aplica la norma: es el brazo con el que los modos de curvatura
% imponen la G objetivo y con el que se la verifica (BrazoDeVerificacion).
%   'Heartline'  riel + d*U: donde se disena y donde mide EN 13814
%   'Cabeza'     riel + (d + e)*U: opcion conservadora
Parametros.PuntoDeVerificacionNormativa = 'Heartline';

% Presupuesto de onset por eje, EN LA NORMA (prototipo). El presupuesto del
% modelo se obtiene multiplicando por sqrt(lambda_loop): un modelo fiel a
% Froude produce jerk mayor que el prototipo, no menor.
%   Gx: Fig. 6 nota 1 (+Gx sin apoyacabezas)
%   Gy: sin valor normativo propio; se adopta el mas restrictivo -- SIN CERRAR
%   Gz: 7.1.7.2 (de 0 G o menos hacia 2 G o mas)
Parametros.OnsetNormativoPorEje = [5, 5, 15];   % [G/s] reales
Parametros.OnsetMaximoModelo    = [];           % [G/s] override directo; vacio = derivar de Froude

Parametros.TolObjetivoDeG = 0.05;    % [G] desvio admitido entre la G del pasajero y la que pidio el modo
Parametros.TolCierrePitch = 1e-4;    % [rad] residual de cierre admitido en el giro objetivo

% --- Fabricacion y espacio ---
% SIN CERRAR: las dimensiones definitivas dependen de la huella disponible.
Parametros.AlturaMaximaDelElemento = 1.00;   % [m] restriccion dura del proyecto
Parametros.RadioMinimoFabricable   = 0.08;   % [m] SIN CERRAR, lo fija la impresora; se compara con el RIEL
Parametros.BoundingBoxDisponible   = [-2.0 2.0; -2.0 2.0; 0.0 1.5];   % [m] filas x, y, z
Parametros.AlturaMinimaSuelo       = 0.05;   % [m] z minimo admisible del riel

% --- Interferencia geometrica ---
Parametros.ArcoMinimoAutointerferencia = 0.30;   % [m] ignora vecinos por construccion
Parametros.DistanciaMinimaEntreVias    = 0.02;   % [m] separacion libre exigida

%% =================================================================
%% 4. PARAMETROS GENERALES
%% =================================================================
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
Parametros.AreaFrontal        = 0.0036;  % [m^2] proyeccion frontal de un carro

% Distancia del riel al centro de masa del pasajero (la heartline), medida
% sobre U. NO es un parametro de evaluacion: es la separacion fisica que
% define la via. La curva que integra el generador ES el riel, que es el eje
% de roll, y la heartline se deriva de el sumando d*U. Consecuencias:
%   - los modos de curvatura resuelven la curvatura del riel para que el
%     PASAJERO reciba la G objetivo (transporte inverso, CurvaturaDelModo);
%   - sobre un riel recto que rola, la heartline hace una helice de radio d:
%     el pasajero rota respecto de la via y siente la centripeta y el Euler
%     de esa rotacion;
%   - el pasajero recorre un radio distinto al del riel, y esa diferencia
%     vale d/R -- a R = 0.11 m son 27 %, no es despreciable.
Parametros.DistanciaHeartline = 0.030;   % [m]

% Distancia de la heartline a la cabeza del pasajero, medida sobre U. La
% norma NO se aplica en la cabeza (F2137 mide a 30-41 cm sobre el asiento y
% EN 13814 en la heart line), pero es la parte mas sensible a las rotaciones
% y el disenador debe incluirlas (Rohde, Development of Acceleration Limits,
% 2024, 7.6.2). La G de la cabeza se reporta siempre como informativa; con
% PuntoDeVerificacionNormativa = 'Cabeza' ademas se verifica ahi.
%
% NO confundir con DistanciaHeartline: esa va del riel a la heartline y es
% geometria de la via; esta va de la heartline a la cabeza.
%
% SIN CERRAR: no es una medida antropometrica escalada. A escala del modelo
% (lambda ~ 22) un offset corazon-cabeza real de ~0.25 m daria ~0.011 m.
% Ademas, para la rotacion pura el criterio normativo propio es un limite de
% velocidad angular (ASTM F2291 7.1.6), no un offset equivalente.
Parametros.DistanciaHeartlineACabeza = 0.030;   % [m]

%% --------------------------- Resolucion -------------------------------
% Metodo de acoplamiento geometria-dinamica:
%   'A'      marcha acoplada hacia adelante, una sola pasada. Es el rapido.
%   'B'      punto fijo sobre el perfil de velocidad. Itera, tarda ~3 veces mas.
%   'Ambos'  corre los dos y reporta la comparacion. Solo para el reporte:
%            la geometria que queda es la del metodo A.
Parametros.MetodoDeAcoplamiento    = 'A';
Parametros.CalcularVelocidadMinima = true;   % biseccion de v0 minima; cuesta decenas de generaciones

%% ------------------------ Escalado (Froude) ---------------------------
% lambda NO es una propiedad del modelo sino de un emparejamiento entre una
% dimension del modelo y la del prototipo. Modelo distorsionado: RadioDeReferencia y
% LargoCarro son independientes y cada uno tiene su propio lambda.
Parametros.RadioDeReferenciaReal = 8.00;   % [m] atraccion de referencia -- SIN VERIFICAR
Parametros.LargoCarroReal        = 2.20;   % [m] atraccion de referencia -- SIN VERIFICAR

%% ------------------------ Discretizacion ------------------------------
% Pueden ser distintos: la generacion necesita paso fino para no acumular
% deriva en el endpoint; la simulacion y los graficos no.
Parametros.PasoGeneracion = 0.002;   % [m]
Parametros.PasoSimulacion = 0.005;   % [m]
Parametros.PasosEntreOrtonormalizaciones = 25;
Parametros.VersoresEnGrafico3D = 40;   % flechas del marco del carro en la vista 3D
Parametros.PasoBusquedaVelocidad = 0.010;   % [m] paso grueso para la biseccion de v0

%% ------------------------- Tolerancias numericas ----------------------
Parametros.TolNorma                = 1e-12;
Parametros.TolPuntoFijo            = 1e-8;    % [m/s] cambio maximo de v entre iteraciones
Parametros.MaxIteracionesPuntoFijo = 60;
Parametros.MaxIteracionesCierre    = 6;
Parametros.MaxIteracionesAjuste    = 8;
Parametros.MargenDeOnset           = 0.002;  % las transiciones se alargan este margen sobre lo justo
Parametros.ToleranciaVelocidadDeDiseno = 0.10;   % [m/s] dispara aviso al re-simular

%% ------------- Derivados de la envolvente -----------------------------
% Diametro del cilindro que circunscribe la seccion de via mas la holgura.
DiametroEnvolvente = hypot(Parametros.AnchoVia  + 2*Parametros.Holgura, ...
                           Parametros.AltoCarro + 2*Parametros.Holgura);
Parametros.SeparacionDePatas = 1.2*(DiametroEnvolvente + Parametros.DistanciaMinimaEntreVias);   % [m] loop vertical, bloque 2
end
