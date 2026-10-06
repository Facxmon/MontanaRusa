function Layout = VerificarTrenDelLayout(Layout)
%VERIFICARTRENDELLAYOUT Simula el tren sobre la via completa y verifica cada carro.
%   Es el equivalente de VerificarLayoutNormativo con NumeroDeCarros > 1.
%   Cada elemento se diseno con el tren visto hasta su final, suponiendo en
%   recta lo que venia despues (DisenarParaElTren). Esta pasada simula el
%   tren UNA vez sobre todo el layout, con el primer carro desde el inicio
%   hasta que el ultimo termina de salir (prolongacion recta del final), y
%   rehace con eso:
%     - el Sim de cada elemento (carro 1, energia del tren) y los de cada
%       carro calculado (Elemento.SimCarros);
%     - la verificacion normativa de CADA carro sobre SU linea de tiempo
%       continua (un evento que cruza un empalme es uno solo, igual que con
%       la particula), con las lineas dinamicas de su reporte en
%       Reporte.Carros{i};
%     - en Reporte.Posteriores, cada linea dinamica es la del peor carro;
%     - los extremos del resumen.
%   No se rehace "Gz objetivo del modo alcanzado": mide al carro de diseno
%   contra el objetivo con el que se lo diseno, y se evalua al construir.
%
%   Deja en Layout.Tren la simulacion del tren y sus distancias, que el
%   exportador usa para los desfases de tiempo de cada carro.

    NumeroDeElementos = numel(Layout.Elementos);
    if NumeroDeElementos == 0
        return
    end
    Parametros = Layout.Elementos{1}.Elemento.Parametros;
    Distancias = DistanciasDelTren(Parametros);
    Cantidad = numel(Distancias);
    if Parametros.CalcularTodosLosCarros
        Calculados = 1:Cantidad;
    else
        Calculados = 1;
    end

    Tracks = cellfun(@(R) R.Elemento.Track, Layout.Elementos, 'UniformOutput', false);
    Geo = GeometriaDelTren(Tracks, Parametros);
    Inicio = InicioDelTren(Layout.Elementos{1}.Elemento.EstadoEntrada, Tracks{1}, Parametros);
    Tren = SimularTren(Geo, Parametros, Inicio, Geo.Fin + Distancias(end));

    % Lo que vive cada carro en cada elemento.
    Sims = cell(NumeroDeElementos, Cantidad);
    Escalas = cell(1, NumeroDeElementos);
    FactoresTiempo = zeros(1, NumeroDeElementos);
    for e = 1:NumeroDeElementos
        Elemento = Layout.Elementos{e}.Elemento;
        for i = Calculados
            Sims{e, i} = SimDelCarro(Elemento.Track, Tren, i, Elemento.Parametros);
        end
        Escalas{e} = EscalasDeFroude(Elemento.Parametros);
        FactoresTiempo(e) = Escalas{e}.RaizLambdaLoop;
    end

    % Verificacion normativa de cada carro sobre su propia linea de tiempo.
    Lineas = cell(NumeroDeElementos, Cantidad);
    Normativos = cell(NumeroDeElementos, Cantidad);
    for i = Calculados
        Contexto = SerieNormativaDelLayout(Sims(:, i).', FactoresTiempo);
        for e = 1:NumeroDeElementos
            Contexto.Elemento = e;
            [Lineas{e, i}, Normativos{e, i}] = CriteriosDelCarro(Sims{e, i}, Escalas{e}, ...
                Layout.Elementos{e}.Elemento.Parametros, Contexto);
        end
    end

    for e = 1:NumeroDeElementos
        Registro = Layout.Elementos{e};
        Elemento = Registro.Elemento;
        Elemento.Sim = ConEnergiaDelTren(Sims{e, 1}, Elemento.Track, Tren);
        Elemento.SimCarros = Sims(e, :);
        Registro.Elemento = Elemento;

        if ~isempty(Registro.Reporte)
            Reporte = Registro.Reporte;
            Reporte.Carros = cell(1, Cantidad);
            for i = Calculados
                Reporte.Carros{i} = struct('Posteriores', Lineas{e, i}, 'Normativo', Normativos{e, i});
            end
            Reporte.Posteriores = PeorCarroPorCriterio(Reporte.Posteriores, Lineas(e, Calculados), Calculados, Cantidad);
            Reporte.Normativo = Normativos{e, 1};
            Resumen = Reporte.Resumen;
            Resumen.TiempoDeRecorrido       = Elemento.Sim.Tiempo(end);
            Resumen.EnergiaDisipadaRodadura = Elemento.Sim.EnergiaDisipadaRodadura(end);
            Resumen.EnergiaDisipadaArrastre = Elemento.Sim.EnergiaDisipadaArrastre(end);
            Reporte.Resumen = ResumenDelTren(Resumen, Sims(e, Calculados));
            Registro.Reporte = Reporte;
        end
        Layout.Elementos{e} = Registro;
    end

    Layout.Tren = Tren;
end
