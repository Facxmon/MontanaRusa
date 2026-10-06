function Criterios = CriteriosDelTren(Track, Parametros)
%CRITERIOSDELTREN Lo que limita la separacion entre carros, sobre el riel del elemento.
%   Los carros van a arco constante p = LargoCarro + Separacion sobre el
%   riel, cada uno orientado con el marco de su nodo. Se evalua nodo a nodo
%   con la curvatura local, como si fuera un arco de circunferencia de radio
%   R = 1/kappa (aproximacion: la curvatura cambia a lo largo de p).
%
%   MINIMO: interferencia entre cajas. En una curva, las caras enfrentadas
%   de dos carros vecinos convergen hacia el centro de curvatura. Para dos
%   cajas de largo l, con su punto mas saliente hacia el centro a una altura
%   h sobre el riel, no se tocan si
%
%       (R - h) * tan(p/(2R)) >= l/2   =>   p >= 2R*atan( l / (2(R - h)) )
%
%   h es la funcion soporte de la seccion del carro (AltoCarro sobre U,
%   AnchoVia/2 a cada lado sobre L) en la direccion de la curvatura: en una
%   curva vertical que mira hacia el pasajero manda el alto, en una lateral
%   el semiancho. Se exige ademas Holgura de luz entre los dos carros en el
%   punto mas cercano (se suma al largo). En recta queda Separacion >= Holgura.
%
%   MAXIMO: angulo del acople. La barra que une dos carros forma con el eje
%   de cada uno la mitad del giro relativo entre ellos, p*kappa/2.

    l = Parametros.LargoCarro;
    g = Parametros.SeparacionEntreCarros;
    p = l + g;

    Curvatura = vecnorm(Track.VectorCurvatura, 2, 2);
    Direccion = Track.VectorCurvatura ./ max(Curvatura, eps);
    HaciaArriba  = sum(Direccion .* Track.VersorArribaCarro, 2);
    HaciaLateral = sum(Direccion .* Track.VersorLateral, 2);
    Altura = Parametros.AltoCarro*max(HaciaArriba, 0) + Parametros.AnchoVia/2*abs(HaciaLateral);

    Radio = 1 ./ max(Curvatura, eps);
    PasoExigido = 2*Radio .* atan((l + Parametros.Holgura) ./ (2*(Radio - Altura)));
    PasoExigido(Radio <= Altura) = Inf;
    PasoExigido(Curvatura < 1e-9) = l + Parametros.Holgura;
    [SeparacionExigida, Critico] = max(PasoExigido - l);

    Criterios = CriteriosVacios();
    Criterios = AgregarCriterio(Criterios, 'Separacion entre carros sin interferencia', 'MayorOIgual', ...
        g, SeparacionExigida, 'm', ...
        sprintf(['Peor nodo: radio del riel %.4f m, saliente hacia el centro %.4f m. Cajas de %.3f m de ' ...
                 'largo con %.3f m de luz entre ellas (Holgura); curvatura local como arco de circunferencia.'], ...
                Radio(Critico), Altura(Critico), l, Parametros.Holgura));

    Angulo = p*max(Curvatura)/2;
    Criterios = AgregarCriterio(Criterios, 'Angulo del acople entre carros', 'MenorOIgual', ...
        Angulo, Parametros.AnguloMaximoDeAcople, 'rad', ...
        sprintf(['(LargoCarro + Separacion) x kappa / 2 en la curva mas cerrada del riel (radio %.4f m). ' ...
                 'AnguloMaximoDeAcople es provisorio: falta el dato del acople real.'], 1/max(max(Curvatura), eps)));
end
