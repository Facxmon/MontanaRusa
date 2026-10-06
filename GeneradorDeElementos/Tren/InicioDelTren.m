function Inicio = InicioDelTren(EstadoEntrada, Track, Parametros)
%INICIODELTREN Estado del tren con el primer carro al principio del elemento.
%   Si el elemento anterior lo dejo (EstadoSalida.Tren), es exacto: con el
%   primer carro en el empalme, todos los demas estan sobre via ya
%   terminada. Al principio del layout, el primer carro entra con la
%   velocidad del estado inicial y los demas estan en la estacion.
    Inicio.Arco = Track.LongitudArco(1);
    if isfield(EstadoEntrada, 'Tren') && ~isempty(EstadoEntrada.Tren)
        Inicio.VelocidadRielCuadrado = EstadoEntrada.Tren.VelocidadRielCuadrado;
        Inicio.Tiempo = EstadoEntrada.Tren.Tiempo;
    else
        d = Parametros.DistanciaHeartline;
        CurvaturaArribaCarro = dot(Track.VectorCurvatura(1,:), Track.VersorArribaCarro(1,:));
        Factor = hypot(1 - d*CurvaturaArribaCarro, d*Track.VelocidadRoll(1));
        Inicio.VelocidadRielCuadrado = (EstadoEntrada.Velocidad / Factor)^2;
        Inicio.Tiempo = 0;
    end
end
