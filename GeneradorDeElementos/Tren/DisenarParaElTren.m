function [Track, Diagnostico, Tren, Sims, Info] = DisenarParaElTren(EstadoEntrada, Parametros, Receta, Layout, Track, Diagnostico)
%DISENARPARAELTREN Asigna el elemento a un carro del tren y lo regenera para el.
%   El modo de curvatura persigue su objetivo (una G, una aceleracion normal)
%   con UNA velocidad, y en un tren cada carro pasa por cada punto a otra
%   velocidad: un solo carro puede seguir exactamente la curva que pidio el
%   modo. Este es el procedimiento para elegir cual y disenar para el.
%
%   Disenar para el carro c (DisenarParaCarro) es un punto fijo, como el
%   metodo B:
%     1. Se simula el tren completo sobre la via ya construida mas el Track
%        actual (SimularTren) y se calcula lo que vive cada carro en el
%        elemento (SimDelCarro).
%     2. Se regenera el elemento imponiendole a la marcha la velocidad del
%        carro c (GenerarGeometria con DerivadaImpuesta): el modo persigue su
%        objetivo con esa velocidad.
%     3. Se repite hasta que la velocidad de c sobre la via nueva difiere de
%        la impuesta en menos de TolVelocidadDelTren.
%   Arranca de la geometria de la particula.
%
%   CUAL CARRO (DisenoDelTren). 'PrimerCarro': el primero. 'CarroCritico': el
%   mas critico, definido como el que, al asignarle la curva, deja el MENOR pico
%   de utilizacion de la norma entre todos los carros (UtilizacionNormativa):
%   se disena para cada carro y se queda el de menor peor caso. Elegir "el
%   carro de mayor G" y redisenar para el no sirve: el ranking se invierte al
%   redisenar (el carro para el que se disena pasa a ir exacto y otro queda
%   arriba) y la iteracion cicla. Cuesta NumeroDeCarros disenos por elemento.
%   Ningun carro de diseno garantiza que los demas no superen el objetivo:
%   cada carro pasa por cada punto a otra velocidad. 'Particula': no se
%   rediseña; la via queda la de la masa puntual y solo se simula el tren
%   (CarroDeDiseno = 0, ninguno).
%
%   Con CalcularTodosLosCarros = false solo se calcula el primer carro (y la
%   busqueda no aplica).
%
%   Los carros que van DELANTE del carro de diseno pueden estar, en ese
%   instante, mas alla del final del elemento, sobre via que todavia no
%   existe: ahi se los supone en recta por la tangente de salida
%   (GeometriaDelTren). Es provisorio; la verificacion del layout
%   (VerificarTrenDelLayout) vuelve a simular el tren sobre la via completa.
%
%   Devuelve el Track final, el Tren y los Sims de los carros calculados
%   (los no calculados quedan vacios) sobre ese Track, e Info: CarroDeDiseno,
%   Iteraciones, Residuo, Convergio, Utilizacion (por carro, en el diseno
%   elegido), PeorUtilizacionPorCandidato y Calculados.

    Cronometro = tic;
    MetodoBase = Diagnostico.Metodo;
    Distancias = DistanciasDelTren(Parametros);
    Cantidad = numel(Distancias);
    if Parametros.CalcularTodosLosCarros
        Calculados = 1:Cantidad;
    else
        Calculados = 1;
    end
    switch Parametros.DisenoDelTren
        case 'Particula'
            Candidatos = [];
        case 'PrimerCarro'
            Candidatos = 1;
        case 'CarroCritico'
            Candidatos = Calculados;
        otherwise
            error('DisenarParaElTren:DisenoDesconocido', ...
                  'DisenoDelTren no reconocido: %s. Las opciones son ''Particula'', ''PrimerCarro'' o ''CarroCritico''.', ...
                  Parametros.DisenoDelTren);
    end

    TracksPrevios = {};
    if ~isempty(Layout) && isfield(Layout, 'Elementos')
        TracksPrevios = cellfun(@(R) R.Elemento.Track, Layout.Elementos, 'UniformOutput', false);
    end
    Contexto = struct('EstadoEntrada', EstadoEntrada, 'Parametros', Parametros, 'Receta', Receta, ...
                      'TracksPrevios', {TracksPrevios}, 'Distancias', Distancias, 'Calculados', Calculados);

    PeorUtilizacion = nan(1, Cantidad);
    if isempty(Candidatos)
        % Sin rediseno: el tren sobre la via de la particula.
        Mejor = SimularSinRedisenar(Track, Diagnostico, Contexto);
    else
        Mejor = [];
    end
    for c = Candidatos
        Diseno = DisenarParaCarro(c, Track, Diagnostico, Contexto);
        PeorUtilizacion(c) = max(Diseno.Utilizacion);
        if isempty(Mejor) || PeorUtilizacion(c) < max(Mejor.Utilizacion)
            Mejor = Diseno;
        end
    end

    Track = Mejor.Track;
    Diagnostico = Mejor.Diagnostico;
    Tren = Mejor.Tren;
    Sims = Mejor.Sims;

    if ~Mejor.Convergio && Mejor.Carro > 0
        warning('DisenarParaElTren:SinConvergencia', ...
                'El diseno para el carro %d no converge: residuo %.3e m/s tras %d iteraciones.', ...
                Mejor.Carro, Mejor.Residuo, Mejor.Iteraciones);
    end

    if Mejor.Carro > 0
        Diagnostico.Metodo = sprintf('%s; tren de %d carros, disenado para el carro %d', MetodoBase, Cantidad, Mejor.Carro);
    else
        Diagnostico.Metodo = sprintf('%s; tren de %d carros, disenado con la masa puntual', MetodoBase, Cantidad);
    end
    Diagnostico.IteracionesPuntoFijo = Mejor.Iteraciones;
    Diagnostico.ResiduoPuntoFijo     = Mejor.Residuo;
    Diagnostico.TiempoDeComputo      = toc(Cronometro);

    Info.CarroDeDiseno = Mejor.Carro;
    Info.Iteraciones   = Mejor.Iteraciones;
    Info.Residuo       = Mejor.Residuo;
    Info.Convergio     = Mejor.Convergio;
    Info.Utilizacion   = Mejor.Utilizacion;
    Info.PeorUtilizacionPorCandidato = PeorUtilizacion;
    Info.Calculados    = Calculados;
end

function Diseno = SimularSinRedisenar(Track, Diagnostico, Contexto)
%SIMULARSINREDISENAR El tren sobre la via tal cual vino (la de la particula).
    Parametros = Contexto.Parametros;
    Cantidad = numel(Contexto.Distancias);
    Geo = GeometriaDelTren([Contexto.TracksPrevios, {Track}], Parametros);
    Inicio = InicioDelTren(Contexto.EstadoEntrada, Track, Parametros);
    Tren = SimularTren(Geo, Parametros, Inicio, Track.LongitudArco(end) + Contexto.Distancias(end));
    Sims = cell(1, Cantidad);
    Utilizacion = nan(1, Cantidad);
    for i = Contexto.Calculados
        Sims{i} = SimDelCarro(Track, Tren, i, Parametros);
        Utilizacion(i) = UtilizacionNormativa(Sims{i});
    end
    Diseno = struct('Carro', 0, 'Track', Track, 'Diagnostico', Diagnostico, 'Tren', Tren, ...
                    'Sims', {Sims}, 'Utilizacion', Utilizacion, 'Iteraciones', 0, ...
                    'Residuo', 0, 'Convergio', true);
end

function Diseno = DisenarParaCarro(Carro, Track, Diagnostico, Contexto)
%DISENARPARACARRO Punto fijo: el elemento disenado con la velocidad del carro Carro.
    Parametros = Contexto.Parametros;
    Cantidad = numel(Contexto.Distancias);
    PerfilUsado = [];
    Residuo = Inf;
    Convergio = false;
    for Iteracion = 1:Parametros.MaxIteracionesPuntoFijo
        Geo = GeometriaDelTren([Contexto.TracksPrevios, {Track}], Parametros);
        Inicio = InicioDelTren(Contexto.EstadoEntrada, Track, Parametros);
        Tren = SimularTren(Geo, Parametros, Inicio, Track.LongitudArco(end) + Contexto.Distancias(end));

        Sims = cell(1, Cantidad);
        Utilizacion = nan(1, Cantidad);
        for i = Contexto.Calculados
            Sims{i} = SimDelCarro(Track, Tren, i, Parametros);
            Utilizacion(i) = UtilizacionNormativa(Sims{i});
        end

        Perfil = Sims{Carro}.VelocidadCentroDeMasa;
        if ~isempty(PerfilUsado)
            Residuo = max(abs(Perfil - PerfilUsado(Track.LongitudArco)));
            if Residuo < Parametros.TolVelocidadDelTren
                Convergio = true;
                break
            end
        end
        % Si el carro se queda sin energia en el elemento no hay velocidad
        % que imponer: queda la ultima geometria y la verificacion lo marca
        % ("El carro completa el elemento").
        if any(isnan(Perfil))
            break
        end

        Arco = Track.LongitudArco;
        Conservar = [true; diff(Arco) > 1e-9];
        PerfilUsado = griddedInterpolant(Arco(Conservar), Perfil(Conservar), 'pchip', 'linear');
        Derivada = griddedInterpolant(Arco(Conservar), DerivadaPorArco(Perfil(Conservar).^2, Arco(Conservar)), 'pchip', 'linear');

        EstadoDiseno = Contexto.EstadoEntrada;
        EstadoDiseno.Velocidad = Perfil(1);
        [Track, Diagnostico] = GenerarGeometria(EstadoDiseno, Parametros, Contexto.Receta, [], Derivada);
    end

    Diseno = struct('Carro', Carro, 'Track', Track, 'Diagnostico', Diagnostico, 'Tren', Tren, ...
                    'Sims', {Sims}, 'Utilizacion', Utilizacion, 'Iteraciones', Iteracion, ...
                    'Residuo', Residuo, 'Convergio', Convergio);
end
