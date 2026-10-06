function Resumen = ResumenDelTren(Resumen, Sims)
%RESUMENDELTREN Extremos del resumen sobre todos los carros calculados.
%   Con varios carros, la G maxima del elemento es la del carro que mas G
%   recibe, no la del carro 1. El tiempo de recorrido y la energia siguen
%   siendo los del Sim del elemento (carro 1, energia del tren).
    Extremo = @(f, Campo) f(cellfun(@(S) f(S.(Campo)), Sims));
    Resumen.FuerzaNormalMaxima     = Extremo(@max, 'FuerzaNormal');
    Resumen.VelocidadMinima        = Extremo(@min, 'VelocidadCentroDeMasa');
    Resumen.GzMaxima               = Extremo(@max, 'Gz');
    Resumen.GzMinima               = Extremo(@min, 'Gz');
    Resumen.GyMaximaAbsoluta       = max(cellfun(@(S) max(abs(S.Gy)), Sims));
    Resumen.GzMaximaCabeza         = Extremo(@max, 'GzCabeza');
    Resumen.GyMaximaAbsolutaCabeza = max(cellfun(@(S) max(abs(S.GyCabeza)), Sims));
end
