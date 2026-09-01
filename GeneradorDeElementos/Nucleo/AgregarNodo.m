function Registro = AgregarNodo(Registro, Punto)
%AGREGARNODO Vuelca un punto evaluado en las tablas del registro.

    Indice = Registro.NumeroDeNodos + 1;
    if Indice > numel(Registro.Arco)
        Registro = CrecerRegistro(Registro);
    end

    Registro.Arco(Indice)                    = Punto.Arco;
    Registro.Posicion(Indice,:)              = Punto.Posicion;
    Registro.VersorTangente(Indice,:)        = Punto.VersorTangente;
    Registro.VersorArribaTransporte(Indice,:)  = Punto.VersorArribaTransporte;
    Registro.VersorLateralTransporte(Indice,:) = Punto.VersorLateralTransporte;
    Registro.VersorArribaCarro(Indice,:)     = Punto.VersorArribaCarro;
    Registro.VersorLateral(Indice,:)         = Punto.VersorLateral;
    Registro.VectorCurvatura(Indice,:)       = Punto.VectorCurvatura;
    Registro.CurvaturaArriba(Indice)         = Punto.CurvaturaArriba;
    Registro.CurvaturaLateral(Indice)        = Punto.CurvaturaLateral;
    Registro.Curvatura(Indice)               = Punto.Curvatura;
    Registro.AnguloRoll(Indice)              = Punto.AnguloRoll;
    Registro.VelocidadRoll(Indice)           = Punto.VelocidadRoll;
    Registro.AceleracionRoll(Indice)         = Punto.AceleracionRoll;
    Registro.Velocidad(Indice)               = Punto.Velocidad;
    Registro.AceleracionTangencial(Indice)   = Punto.AceleracionTangencial;
    Registro.GArribaHeartline(Indice)        = Punto.GArribaHeartline;
    Registro.GLateralHeartline(Indice)       = Punto.GLateralHeartline;
    Registro.PerdidaRodadura(Indice)         = Punto.PerdidaRodadura;
    Registro.PerdidaArrastre(Indice)         = Punto.PerdidaArrastre;
    Registro.AnguloGirado(Indice)            = Punto.AnguloGirado;
    Registro.Tiempo(Indice)                  = Punto.Tiempo;

    Registro.NumeroDeNodos = Indice;
end

function Registro = CrecerRegistro(Registro)
    Campos = fieldnames(Registro);
    for i = 1:numel(Campos)
        if strcmp(Campos{i}, 'NumeroDeNodos'); continue; end
        Valor = Registro.(Campos{i});
        Registro.(Campos{i}) = [Valor; nan(size(Valor))];
    end
end
