function Parametros = AjustarParametros(Parametros, Ajustes, Elegido)
%AJUSTARPARAMETROS Sobrescribe parametros por defecto y avisa de los inertes.
%   Ajustes es un struct con solo los campos que se quieren cambiar. Un campo
%   que no existe en ParametrosPorDefecto es un error (probablemente un nombre
%   mal escrito). Un campo que existe pero que ni el modo de curvatura elegido
%   ni el elemento elegido consumen -- por ejemplo RadioDelLoop con
%   @ElementoDiveLoop, o FuerzaGObjetivo en modo GNormativaMaxima -- se aplica
%   igual pero con un aviso: cargar un numero que no hace nada es el error que
%   este chequeo existe para cazar.
%
%   Que consume cada modo lo declara ParametrosDelModo; que consume cada
%   elemento, el propio elemento llamado sin argumentos; el resto de los
%   parametros (fisica, carro, criterios de aceptacion, discretizacion) son
%   globales y no se cuestionan.

    Campos = fieldnames(Ajustes);
    for i = 1:numel(Campos)
        if ~isfield(Parametros, Campos{i})
            error('AjustarParametros:CampoDesconocido', ...
                  'Parametros.%s no existe en ParametrosPorDefecto: revisar el nombre.', Campos{i});
        end
        Parametros.(Campos{i}) = Ajustes.(Campos{i});
    end

    % Todo lo que consume algun modo o algun elemento, menos lo que consumen
    % el modo y el elemento elegidos: eso es lo que no hace nada en este caso.
    ModoElegido = Parametros.ModoCurvatura;
    DeTodosLosModos = {};
    for Modo = ParametrosDelModo()
        DeTodosLosModos = [DeTodosLosModos, {ParametrosDelModo(Modo{1}).Nombre}]; %#ok<AGROW>
    end
    DeTodosLosElementos = {};
    for Constructor = CatalogoDeElementos()
        DeTodosLosElementos = [DeTodosLosElementos, {Constructor{1}().Nombre}]; %#ok<AGROW>
    end
    Consumidos = [{ParametrosDelModo(ModoElegido).Nombre}, {Elegido().Nombre}];
    Inertes = setdiff([DeTodosLosModos, DeTodosLosElementos], Consumidos);

    for i = 1:numel(Campos)
        if any(strcmp(Campos{i}, Inertes))
            warning('AjustarParametros:ParametroInerte', ...
                    ['Parametros.%s no lo consume ni el modo %s ni %s: ese valor no tiene ningun efecto ' ...
                     'en esta corrida.'], Campos{i}, ModoElegido, func2str(Elegido));
        end
    end
end
