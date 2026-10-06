function Distancias = DistanciasDelTren(Parametros)
%DISTANCIASDELTREN Arco del riel de cada carro detras del primero (columna).
%   El carro 1 es la referencia (0); el i esta (i-1)*(LargoCarro +
%   SeparacionEntreCarros) atras. La separacion es de paragolpe a paragolpe
%   y se mide como arco sobre el riel: los carros van a arco constante.
    if Parametros.SeparacionEntreCarros < 0
        error('DistanciasDelTren:SeparacionNegativa', 'SeparacionEntreCarros no puede ser negativa (vale %g m).', Parametros.SeparacionEntreCarros);
    end
    Paso = Parametros.LargoCarro + Parametros.SeparacionEntreCarros;
    Distancias = (0:max(1, round(Parametros.NumeroDeCarros)) - 1).' * Paso;
end
