function Registro = RegistroVacio(NumeroDeNodos)
%REGISTROVACIO Reserva las tablas de salida del generador.
%   Struct con campos nombrados, nunca matrices de columnas anonimas.

    Escalares = {'Arco','Tiempo','CurvaturaArriba','CurvaturaLateral','Curvatura', ...
                 'AnguloRoll','VelocidadRoll','AceleracionRoll','Velocidad', ...
                 'AceleracionTangencial','GArribaRiel','GLateralRiel', ...
                 'PerdidaRodadura','PerdidaArrastre','AnguloGirado'};
    Vectoriales = {'Posicion','VersorTangente','VersorArribaTransporte', ...
                   'VersorLateralTransporte','VersorArribaCarro','VersorLateral', ...
                   'VectorCurvatura'};

    for i = 1:numel(Escalares)
        Registro.(Escalares{i}) = nan(NumeroDeNodos, 1);
    end
    for i = 1:numel(Vectoriales)
        Registro.(Vectoriales{i}) = nan(NumeroDeNodos, 3);
    end
    Registro.NumeroDeNodos = 0;
end
