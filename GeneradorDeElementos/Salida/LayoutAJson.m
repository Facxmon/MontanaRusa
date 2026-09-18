function Documento = LayoutAJson(Layout, RutaDeSalida)
%LAYOUTAJSON Serializa un Layout al contrato del visualizador (esquema v1).
%   Documento = LayoutAJson(Layout, RutaDeSalida) arma la estructura que fija
%   CONTRATO_VISUALIZADOR.md (formalizada en esquema/layout-v1.schema.json),
%   la escribe como JSON en RutaDeSalida y la devuelve. Sin RutaDeSalida solo
%   la devuelve.
%
%   Es el unico punto de contacto entre el calculo y el visualizador web: lo
%   que sale de aca lo dibuja el frontend sin saber nada de MATLAB, y el dia
%   que el nucleo se portee a JS tiene que producir exactamente este objeto.
%   Reglas del contrato que este archivo hace cumplir:
%     - SI y radianes, siempre. Nada se convierte a grados.
%     - Curvatura y no radio: el radio vale Inf en recta y JSON no lo admite.
%     - Todo valor no finito (NaN, Inf, -Inf) se escribe como null.
%     - Indices de sub-tramos y punto de parada en base 0.
%     - Redondeo a 6 cifras significativas.
%     - Vectoriales como arrays de tripletes [[x,y,z],...].
%     - Claves en camelCase: la traduccion desde PascalCase es mecanica
%       (primera letra en minuscula) y las pocas claves que no siguen esa
%       regla (x, xRiel, velocidad, curvatura...) son las que fija la tabla
%       de la seccion 6.1 del contrato.
%
%   El bloque parametros.esquema NO se escribe a mano: sale de llamar a cada
%   constructor de CatalogoDeElementos() sin argumentos, a ParametrosDelModo(),
%   a ParametrosDeAceptacion() y a ParametrosGenerales(). Si se agrega un
%   parametro a un elemento, aparece solo en el JSON y en el panel de la web;
%   si se agrega a ParametrosPorDefecto sin declararlo en ningun lado, el
%   export falla con un mensaje que dice donde declararlo.
%
%   Decisiones que el contrato deja abiertas y que aca se toman asi:
%     - resumenLayout.alturaMaxima/alturaMinima son z del RIEL (lo que se
%       fabrica; es la curva contra la que se chequea AlturaMinimaSuelo).
%     - resumenLayout.boundingBox abarca riel y heartline juntas: su unico
%       proposito es encuadrar la camara y las dos curvas se dibujan.
%     - nodos.tiempo es Sim.Tiempo tal cual, que arranca en 0 en cada
%       elemento; el acumulado del circuito lo suma el consumidor.

    if nargin < 2
        RutaDeSalida = '';
    end
    if ~isfield(Layout, 'Elementos') || isempty(Layout.Elementos)
        error('LayoutAJson:LayoutVacio', ...
              'El layout no tiene elementos: el contrato exige al menos uno.');
    end

    Documento.meta          = MetaAJson();
    Documento.parametros    = ParametrosAJson(Layout.Parametros);
    Documento.estadoInicial = EstadoAJson(Layout.EstadoInicial);
    Documento.elementos     = cell(1, numel(Layout.Elementos));
    for i = 1:numel(Layout.Elementos)
        Documento.elementos{i} = ElementoAJson(Layout.Elementos{i}, i);
    end
    Documento.resumenLayout = ResumenLayoutAJson(Layout);

    Documento = Redondear(Documento, 6);

    if ~isempty(RutaDeSalida)
        EscribirJson(Documento, RutaDeSalida);
    end
end

%% ========================= bloques del contrato ===========================
function Meta = MetaAJson()
    Meta.versionContrato  = '1.0.0';
    Meta.generadoPor      = 'matlab';
    Meta.versionGenerador = VersionDelRepo();
    Meta.generadoEn       = char(datetime('now', 'TimeZone', 'UTC', ...
                                          'Format', 'yyyy-MM-dd''T''HH:mm:ss''Z'''));
    Meta.unidades = struct('longitud', 'm', 'tiempo', 's', 'masa', 'kg', ...
                           'angulo', 'rad', 'velocidad', 'm/s', ...
                           'aceleracion', 'G', 'aceleracionLineal', 'm/s^2', ...
                           'curvatura', '1/m', 'jerk', 'G/s', ...
                           'fuerza', 'N', 'energia', 'J');
end

function Parametros = ParametrosAJson(ParametrosDelLayout)
%PARAMETROSAJSON Valores de esta corrida, esquema autodescriptivo y defaults.
    VerificarCobertura(ParametrosDelLayout);
    Parametros.valores  = EstructuraACamelCase(ParametrosDelLayout);
    Parametros.esquema  = EsquemaDeParametros(ParametrosDelLayout.ModoCurvatura);
    Parametros.defaults = EstructuraACamelCase(ParametrosPorDefecto());
end

function Esquema = EsquemaDeParametros(Modo)
%ESQUEMADEPARAMETROS Las ternas Nombre/Unidad/Descripcion que declara el
%   propio codigo. Cero listas escritas a mano.
    [DelModo, Nota] = ParametrosDelModo(Modo);
    Esquema.modo = struct('nombre',     Modo, ...
                          'opciones',   {ParametrosDelModo()}, ...
                          'nota',       Nota, ...
                          'parametros', {DeclaracionesAJson(DelModo)});

    Esquema.elementos = struct();
    for Constructor = CatalogoDeElementos()
        Esquema.elementos.(NombreDelElemento(Constructor{1})) = DeclaracionesAJson(Constructor{1}());
    end

    Esquema.aceptacion = DeclaracionesAJson(ParametrosDeAceptacion());
    Esquema.generales  = DeclaracionesAJson(ParametrosGenerales());
end

function VerificarCobertura(Parametros)
%VERIFICARCOBERTURA Todo campo de Parametros esta declarado en alguna lista.
%   Es la garantia del contrato: el panel de la web se genera desde las
%   declaraciones, asi que un parametro sin declarar apareceria sin etiqueta
%   ni unidad. Se cubre con las cuatro fuentes (todos los modos, todos los
%   elementos, aceptacion, generales); ModoCurvatura es el selector del modo
%   y lo describe esquema.modo (nombre y opciones), no una terna.
    Declarados = {'ModoCurvatura'};
    for Modo = ParametrosDelModo()
        Declarados = [Declarados, {ParametrosDelModo(Modo{1}).Nombre}]; %#ok<AGROW>
    end
    for Constructor = CatalogoDeElementos()
        Declarados = [Declarados, {Constructor{1}().Nombre}]; %#ok<AGROW>
    end
    Declarados = [Declarados, {ParametrosDeAceptacion().Nombre}, {ParametrosGenerales().Nombre}];

    SinDeclarar = setdiff(fieldnames(Parametros), Declarados);
    if ~isempty(SinDeclarar)
        error('LayoutAJson:ParametroSinDeclarar', ...
              ['Parametros.%s no lo declara ningun modo, elemento, ParametrosDeAceptacion ni ' ...
               'ParametrosGenerales: sin terna Nombre/Unidad/Descripcion el panel de la web no lo ' ...
               'puede etiquetar. Declararlo donde se consume.'], strjoin(SinDeclarar, ', Parametros.'));
    end
    Inexistentes = setdiff(Declarados, fieldnames(Parametros));
    if ~isempty(Inexistentes)
        error('LayoutAJson:DeclaracionSinParametro', ...
              'Se declara %s pero no existe en Parametros: revisar el nombre en la declaracion.', ...
              strjoin(Inexistentes, ', '));
    end
end

function Estado = EstadoAJson(EstadoMatlab)
%ESTADOAJSON Espejo del contrato de Estado (EstadoInicial.m), en camelCase.
    Estado = EstructuraACamelCase(EstadoMatlab);
end

function Elemento = ElementoAJson(Registro, Posicion)
%ELEMENTOAJSON Un elemento del layout: nodos, sub-tramos, resumen, criterios.
    ElementoMatlab = Registro.Elemento;
    Reporte        = Registro.Reporte;
    if isempty(Reporte)
        error('LayoutAJson:SinReporte', ...
              ['El elemento %d (%s) se agrego al layout sin Reporte: el contrato ' ...
               'exige resumen y criterios de cada elemento.'], Posicion, ElementoMatlab.Nombre);
    end

    Elemento.indice           = int32(Posicion - 1);
    Elemento.tipo             = ElementoMatlab.Receta.Nombre;
    Elemento.parametrosUsados = ParametrosUsados(ElementoMatlab);
    Elemento.nodos            = NodosAJson(ElementoMatlab.Track, ElementoMatlab.Sim);
    Elemento.subtramos        = SubTramosAJson(ElementoMatlab.Track.SubTramos);
    Elemento.resumen          = EstructuraACamelCase(Reporte.Resumen);
    Elemento.criterios        = CriteriosAJson(Reporte);
    Elemento.estadoSalida     = EstadoAJson(Registro.EstadoSalida);
end

function Usados = ParametrosUsados(ElementoMatlab)
%PARAMETROSUSADOS Solo los parametros geometricos que declara el constructor
%   del elemento, con los valores con los que efectivamente se genero.
    Constructores = CatalogoDeElementos();
    Nombres = cellfun(@NombreDelElemento, Constructores, 'UniformOutput', false);
    Indice = find(strcmp(Nombres, ElementoMatlab.Receta.Nombre), 1);
    if isempty(Indice)
        error('LayoutAJson:ElementoFueraDelCatalogo', ...
              'El elemento %s no corresponde a ningun constructor de CatalogoDeElementos.', ...
              ElementoMatlab.Receta.Nombre);
    end
    Declaracion = Constructores{Indice}();
    Usados = struct();
    for i = 1:numel(Declaracion)
        Usados.(ClaveCamel(Declaracion(i).Nombre)) = ElementoMatlab.Parametros.(Declaracion(i).Nombre);
    end
end

function Nodos = NodosAJson(Track, Sim)
%NODOSAJSON Arrays columnares de igual largo. Tabla de la seccion 6.1 del
%   contrato: heartline en x,y,z, riel en xRiel,yRiel,zRiel, curvatura y no
%   radio, angulos en radianes.
    NumeroDeNodos = size(Track.PuntosRiel, 1);

    Nodos.numeroDeNodos = int32(NumeroDeNodos);
    Nodos.arco          = Track.LongitudArco;
    Nodos.tiempo        = Sim.Tiempo;

    Nodos.x = Track.PuntosHeartline(:,1);
    Nodos.y = Track.PuntosHeartline(:,2);
    Nodos.z = Track.PuntosHeartline(:,3);

    Nodos.xRiel = Track.PuntosRiel(:,1);
    Nodos.yRiel = Track.PuntosRiel(:,2);
    Nodos.zRiel = Track.PuntosRiel(:,3);

    Nodos.versorTangente    = Track.VersorTangente;
    Nodos.versorArribaCarro = Track.VersorArribaCarro;
    Nodos.versorLateral     = Track.VersorLateral;

    Nodos.velocidad             = Sim.VelocidadCentroDeMasa;
    Nodos.velocidadRiel         = Sim.Velocidad;
    Nodos.aceleracionTangencial = Sim.AceleracionTangencial;

    Nodos.gx = Sim.Gx;
    Nodos.gy = Sim.Gy;
    Nodos.gz = Sim.Gz;

    Nodos.jerkGx = Sim.JerkGx;
    Nodos.jerkGy = Sim.JerkGy;
    Nodos.jerkGz = Sim.JerkGz;

    Nodos.gyCabeza = Sim.GyCabeza;
    Nodos.gzCabeza = Sim.GzCabeza;

    Nodos.curvatura     = Track.CurvaturaHeartline;
    Nodos.curvaturaRiel = Track.Curvatura;

    Nodos.anguloRoll    = Track.AnguloRoll;
    Nodos.anguloPeralte = Track.AnguloPeralte;

    Nodos.fuerzaNormal = Sim.FuerzaNormal;
    Nodos.energiaTotal = Sim.EnergiaTotal;

    if isempty(Sim.PuntoDeParada)
        Nodos.puntoDeParada = NaN;   % se escribe como null
    else
        Nodos.puntoDeParada = int32(Sim.PuntoDeParada - 1);
    end

    % El contrato promete que todos los arrays tienen numeroDeNodos filas y
    % que el consumidor puede asumirlo sin verificar. Se verifica aca.
    Columnas = setdiff(fieldnames(Nodos), {'numeroDeNodos', 'puntoDeParada'});
    for i = 1:numel(Columnas)
        Filas = size(Nodos.(Columnas{i}), 1);
        if Filas ~= NumeroDeNodos
            error('LayoutAJson:LargoDeColumna', ...
                  'nodos.%s tiene %d filas y el elemento tiene %d nodos.', ...
                  Columnas{i}, Filas, NumeroDeNodos);
        end
    end
end

function Lista = SubTramosAJson(SubTramos)
%SUBTRAMOSAJSON Copia de Track.SubTramos con indices en base 0.
    Lista = cell(1, numel(SubTramos));
    for k = 1:numel(SubTramos)
        Lista{k} = struct('nombre',       SubTramos(k).Nombre, ...
                          'indiceInicio', int32(SubTramos(k).IndiceInicio - 1), ...
                          'indiceFin',    int32(SubTramos(k).IndiceFin - 1));
    end
end

function Criterios = CriteriosAJson(Reporte)
%CRITERIOSAJSON Los criterios tal como los produce AgregarCriterio, mas el
%   bloque normativo entero y el veredicto global.
    Criterios.previos     = ListaDeStructs(Reporte.Previos);
    Criterios.posteriores = ListaDeStructs(Reporte.Posteriores);
    if isempty(Reporte.Normativo)
        Criterios.normativo = NaN;   % null
    else
        Criterios.normativo = EstructuraACamelCase(Reporte.Normativo);
    end
    Criterios.todosPasan = all([Reporte.Previos.Pasa]) && all([Reporte.Posteriores.Pasa]);
end

function Resumen = ResumenLayoutAJson(Layout)
%RESUMENLAYOUTAJSON Agregados de todo el circuito.
    NumeroDeElementos = numel(Layout.Elementos);
    LongitudRecorrida = zeros(NumeroDeElementos, 1);
    TiempoDeRecorrido = zeros(NumeroDeElementos, 1);
    GzMaxima          = zeros(NumeroDeElementos, 1);
    GzMinima          = zeros(NumeroDeElementos, 1);
    GyMaximaAbsoluta  = zeros(NumeroDeElementos, 1);
    TodosPasan        = true(NumeroDeElementos, 1);
    PuntosHeartline   = zeros(0, 3);
    for i = 1:NumeroDeElementos
        Registro = Layout.Elementos{i};
        R = Registro.Reporte.Resumen;
        LongitudRecorrida(i) = R.LongitudRecorrida;
        TiempoDeRecorrido(i) = R.TiempoDeRecorrido;
        GzMaxima(i)          = R.GzMaxima;
        GzMinima(i)          = R.GzMinima;
        GyMaximaAbsoluta(i)  = R.GyMaximaAbsoluta;
        TodosPasan(i)        = all([Registro.Reporte.Previos.Pasa]) && all([Registro.Reporte.Posteriores.Pasa]);
        PuntosHeartline      = [PuntosHeartline; Registro.Elemento.Track.PuntosHeartline]; %#ok<AGROW>
    end
    PuntosRiel = Layout.PuntosRiel;

    Resumen.numeroDeElementos      = int32(NumeroDeElementos);
    Resumen.longitudTotal          = sum(LongitudRecorrida);
    Resumen.tiempoTotal            = sum(TiempoDeRecorrido);
    Resumen.velocidadFinal         = Layout.EstadoActual.Velocidad;
    Resumen.gzMaximaGlobal         = max(GzMaxima);
    Resumen.gzMinimaGlobal         = min(GzMinima);
    Resumen.gyMaximaAbsolutaGlobal = max(GyMaximaAbsoluta);
    Resumen.alturaMaxima           = max(PuntosRiel(:,3));
    Resumen.alturaMinima           = min(PuntosRiel(:,3));
    Todos = [PuntosRiel; PuntosHeartline];
    Resumen.boundingBox            = [min(Todos, [], 1); max(Todos, [], 1)].';   % [[xmin,xmax],[ymin,ymax],[zmin,zmax]]
    Resumen.todosLosCriteriosPasan = all(TodosPasan);
end

%% ========================= auxiliares =====================================
function Nombre = NombreDelElemento(Constructor)
%NOMBREDELELEMENTO 'LoopVertical' a partir de @ElementoLoopVertical.
%   Convencion de nombres del catalogo: cada constructor se llama
%   Elemento<Nombre> y arma una Receta con Receta.Nombre = '<Nombre>'.
    Texto   = func2str(Constructor);
    Prefijo = 'Elemento';
    if ~startsWith(Texto, Prefijo) || numel(Texto) <= numel(Prefijo)
        error('LayoutAJson:ConstructorFueraDeConvencion', ...
              'El constructor %s no sigue la convencion Elemento<Nombre> del catalogo.', Texto);
    end
    Nombre = Texto(numel(Prefijo)+1:end);
end

function Lista = DeclaracionesAJson(Declaracion)
%DECLARACIONESAJSON Terna Nombre/Unidad/Descripcion -> clave/unidad/descripcion.
%   Devuelve un cell para que un solo parametro tambien salga como array.
    Lista = cell(1, numel(Declaracion));
    for i = 1:numel(Declaracion)
        Lista{i} = struct('clave',       ClaveCamel(Declaracion(i).Nombre), ...
                          'unidad',      Declaracion(i).Unidad, ...
                          'descripcion', Declaracion(i).Descripcion);
    end
end

function Lista = ListaDeStructs(Structs)
%LISTADESTRUCTS Struct array -> cell de structs en camelCase. jsonencode
%   escribe un struct array de un solo elemento como objeto y no como array
%   de uno; el cell lo fuerza a array siempre, incluso vacio.
    Lista = cell(1, numel(Structs));
    for k = 1:numel(Structs)
        Lista{k} = EstructuraACamelCase(Structs(k));
    end
end

function Salida = EstructuraACamelCase(Entrada)
%ESTRUCTURAACAMELCASE Renombra recursivamente los campos a camelCase.
%   Los valores no se tocan; los struct anidados se recorren y los struct
%   array se convierten en cell (ver ListaDeStructs).
    Salida = struct();
    Campos = fieldnames(Entrada);
    for i = 1:numel(Campos)
        Valor = Entrada.(Campos{i});
        if isstruct(Valor)
            if isscalar(Valor)
                Valor = EstructuraACamelCase(Valor);
            else
                Valor = ListaDeStructs(Valor);
            end
        end
        Salida.(ClaveCamel(Campos{i})) = Valor;
    end
end

function Clave = ClaveCamel(Nombre)
%CLAVECAMEL PascalCase de MATLAB -> camelCase del JSON: primera letra en
%   minuscula. GzMaxima -> gzMaxima, RadioDelLoop -> radioDelLoop.
    Clave = [lower(Nombre(1)), Nombre(2:end)];
end

function Valor = Redondear(Valor, Cifras)
%REDONDEAR Redondea a Cifras significativas todo lo que sea punto flotante,
%   recorriendo structs y cells. Los enteros (indices, conteos) van tipados
%   como int32 y no se tocan; NaN e Inf pasan de largo y jsonencode los
%   escribe como null. El +0 borra el -0, que JSON admite pero no aporta.
    if isstruct(Valor)
        Campos = fieldnames(Valor);
        for k = 1:numel(Valor)
            for i = 1:numel(Campos)
                Valor(k).(Campos{i}) = Redondear(Valor(k).(Campos{i}), Cifras);
            end
        end
    elseif iscell(Valor)
        for k = 1:numel(Valor)
            Valor{k} = Redondear(Valor{k}, Cifras);
        end
    elseif isfloat(Valor) && ~isempty(Valor)
        Valor = round(Valor, Cifras, 'significant') + 0;
    end
end

function Version = VersionDelRepo()
%VERSIONDELREPO Hash corto del commit del repo; '-dirty' si hay archivos
%   versionados con cambios sin commitear (los no versionados no cuentan,
%   igual que en git describe --dirty); 'desconocido' si git no esta.
    Raiz = fileparts(fileparts(fileparts(mfilename('fullpath'))));
    [EstadoHash, Hash] = system(sprintf('git -C "%s" rev-parse --short=7 HEAD', Raiz));
    if EstadoHash ~= 0 || isempty(strtrim(Hash))
        Version = 'desconocido';
        return
    end
    Version = strtrim(Hash);
    [EstadoArbol, Cambios] = system(sprintf('git -C "%s" status --porcelain --untracked-files=no', Raiz));
    if EstadoArbol == 0 && ~isempty(strtrim(Cambios))
        Version = [Version, '-dirty'];
    end
end

function EscribirJson(Documento, Ruta)
%ESCRIBIRJSON JSON compacto, UTF-8, con salto de linea final.
    Carpeta = fileparts(Ruta);
    if ~isempty(Carpeta) && ~isfolder(Carpeta)
        mkdir(Carpeta);
    end
    Archivo = fopen(Ruta, 'w', 'n', 'UTF-8');
    if Archivo < 0
        error('LayoutAJson:NoSePuedeEscribir', 'No se pudo abrir %s para escritura.', Ruta);
    end
    fprintf(Archivo, '%s\n', jsonencode(Documento));
    fclose(Archivo);
end
