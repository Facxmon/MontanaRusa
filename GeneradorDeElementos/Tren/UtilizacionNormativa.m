function Uso = UtilizacionNormativa(Sim)
%UTILIZACIONNORMATIVA Cuanto de la norma usa un carro en su peor punto.
%   El mayor cociente, sobre los nodos con dato, entre la G en el punto de
%   verificacion y el limite de 200 ms de su eje y signo (+Gz Fig. 10, -Gz
%   Fig. 9, Gy Fig. 8, +Gx Fig. 6, -Gx Fig. 7). Es la medida de "carro mas
%   critico" con la que DisenarParaElTren elige para que carro se disena el
%   elemento: el que mas cerca anda de las G permitidas. No reemplaza a la
%   verificacion (que mide eventos sostenidos); solo ordena los carros, y es
%   barata, porque se evalua en cada iteracion del diseno.

    Valido = ~isnan(Sim.Gz) & ~isnan(Sim.Gy) & ~isnan(Sim.Gx);
    if ~any(Valido)
        Uso = NaN;
        return
    end
    Gx = Sim.Gx(Valido);
    Gy = Sim.Gy(Valido);
    Gz = Sim.Gz(Valido);
    Limite = @(Curva) abs(LimiteNormativo(Curva, 0.2));
    Uso = max([max(Gz)/Limite('MasGzTodas'), max(-Gz)/Limite('MenosGzBase'), ...
               max(abs(Gy))/Limite('GyBase'), max(Gx)/Limite('MasGxBase'), max(-Gx)/Limite('MenosGxBase')]);
end
