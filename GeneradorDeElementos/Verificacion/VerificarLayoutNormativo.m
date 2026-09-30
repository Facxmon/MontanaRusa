function Layout = VerificarLayoutNormativo(Layout)
%VERIFICARLAYOUTNORMATIVO Recalcula el bloque normativo de cada elemento
%   sobre la linea de tiempo continua del layout.
%
%   Los eventos sostenidos de ASTM F2291 no terminan en un empalme: un -Gz
%   que empieza en un over-banked turn y sigue en la helice es un solo
%   evento, y su duracion es la de los dos tramos juntos. Cada elemento se
%   construye y se verifica solo (ConstruirElemento), sin saber que viene
%   despues, asi que esa verificacion es provisoria: esta pasada arma la
%   serie de todo el circuito (SerieNormativaDelLayout) y vuelve a correr
%   VerificarLimitesNormativos para CADA elemento con esa serie de contexto.
%   Cada elemento evalua los eventos que tocan al menos uno de sus nodos,
%   con la duracion completa del evento, asi que el contrato sigue teniendo
%   los criterios por elemento.
%
%   Reemplaza Reporte.Normativo y las lineas de Reporte.Posteriores que
%   arma CriteriosNormativos (mismos nombres, mismo orden). Lo demas del
%   reporte no depende de la linea de tiempo y no se toca.
%
%   Se corre entera cada vez que el layout cambia (LayoutAgregarElemento,
%   LayoutResimular): un elemento nuevo puede alargar un evento del anterior
%   y cambiar su veredicto. Con un solo elemento el resultado es el de
%   ConstruirElemento.

    NumeroDeElementos = numel(Layout.Elementos);
    if NumeroDeElementos == 0
        return
    end

    Sims = cell(1, NumeroDeElementos);
    Escalas = cell(1, NumeroDeElementos);
    FactoresTiempo = zeros(1, NumeroDeElementos);
    for i = 1:NumeroDeElementos
        Elemento = Layout.Elementos{i}.Elemento;
        Sims{i} = Elemento.Sim;
        Escalas{i} = EscalasDeFroude(Elemento.Parametros);
        FactoresTiempo(i) = Escalas{i}.RaizLambdaLoop;
    end
    Contexto = SerieNormativaDelLayout(Sims, FactoresTiempo);

    for i = 1:NumeroDeElementos
        Registro = Layout.Elementos{i};
        if isempty(Registro.Reporte)
            continue
        end
        Contexto.Elemento = i;
        Normativo = VerificarLimitesNormativos(Registro.Elemento.Sim, Escalas{i}, ...
                                               Registro.Elemento.Parametros, Contexto);
        Nuevos = CriteriosNormativos(Normativo);

        Posteriores = Registro.Reporte.Posteriores;
        Desde = find(strcmp({Posteriores.Nombre}, Nuevos(1).Nombre), 1);
        Hasta = Desde + numel(Nuevos) - 1;
        if isempty(Desde) || Hasta > numel(Posteriores) ...
                || ~isequal({Posteriores(Desde:Hasta).Nombre}, {Nuevos.Nombre})
            error('VerificarLayoutNormativo:ReporteSinBloqueNormativo', ...
                  ['El reporte del elemento %d (%s) no trae las lineas normativas de ' ...
                   'CriteriosNormativos en el orden esperado.'], i, Registro.Elemento.Nombre);
        end
        Posteriores(Desde:Hasta) = Nuevos;

        Registro.Reporte.Posteriores = Posteriores;
        Registro.Reporte.Normativo = Normativo;
        Layout.Elementos{i} = Registro;
    end
end
