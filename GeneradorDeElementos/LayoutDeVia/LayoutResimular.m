function [Layout, Avisos] = LayoutResimular(Layout, Parametros)
%LAYOUTRESIMULAR Recalcula la dinamica de todo el layout sin tocar la geometria.
%   Es la operacion que corresponde despues de cambiar un parametro global
%   (masa, coeficientes de rodadura, velocidad de lanzamiento): la via ya
%   fabricada no cambia. Si la velocidad de entrada de algun elemento se
%   aparta de la de diseno mas que la tolerancia, se avisa y se sugiere
%   regenerar, pero no se regenera solo.

    if nargin >= 2
        Layout.Parametros = Parametros;
    end
    Parametros = Layout.Parametros;

    Avisos = {};
    Estado = Layout.EstadoInicial;

    for i = 1:numel(Layout.Elementos)
        Elemento = Layout.Elementos{i}.Elemento;
        Sim = SimularSobreTrack(Elemento.Track, Estado, Parametros);

        if ~isempty(Sim.AvisoVelocidadDeDiseno)
            Avisos{end+1} = sprintf('Elemento %d (%s): %s', i, Elemento.Nombre, Sim.AvisoVelocidadDeDiseno); %#ok<AGROW>
        end
        if ~isempty(Sim.PuntoDeParada)
            Avisos{end+1} = sprintf('Elemento %d (%s): el carro se queda sin energia en el nodo %d.', ...
                                    i, Elemento.Nombre, Sim.PuntoDeParada); %#ok<AGROW>
        end

        Ultimo = size(Elemento.Track.PuntosRiel, 1);
        Estado = Elemento.EstadoSalida;
        Estado.Velocidad    = Sim.VelocidadCentroDeMasa(Ultimo);
        Estado.EnergiaTotal = Sim.EnergiaTotal(Ultimo);

        Elemento.Sim = Sim;
        Elemento.EstadoSalida = Estado;
        Layout.Elementos{i}.Elemento     = Elemento;
        Layout.Elementos{i}.EstadoSalida = Estado;
    end

    Layout.EstadoActual = Estado;

    for i = 1:numel(Avisos)
        warning('LayoutResimular:Aviso', '%s', Avisos{i});
    end
end
