function [FuerzaTotal, Rodadura, Arrastre] = ResistenciaAlAvance(Velocidad, GArribaHeartline, GLateralHeartline, Parametros)
%RESISTENCIAALAVANCE Rodadura de los tres juegos de ruedas mas arrastre.
%   La componente de la normal sobre U va a las portantes si es positiva y a
%   las de retencion si es negativa; la componente sobre L va a las de guia.
%   El arrastre no depende de la normal, asi que se puede evaluar incluso
%   donde la curvatura todavia no esta definida.
%
%   Las dos G entran evaluadas en la heartline (a d del riel) y no en el
%   punto del riel: el carro se modela como masa puntual con el centro de
%   masa ahi, y la carga que pasa por las ruedas vale m*(a_cm - g_vec).
%   CargasEnLaVia ya las transporta desde el riel con brazo d. Los versores U
%   y L son los mismos para las dos curvas, asi que el reparto entre juegos
%   de ruedas no depende de en cual se evalue.

    Peso = Parametros.Masa * Parametros.Gravedad;

    CargaPortantes = max( GArribaHeartline, 0) * Peso;
    CargaRetencion = max(-GArribaHeartline, 0) * Peso;
    CargaGuia      = abs(GLateralHeartline)    * Peso;

    Rodadura = Parametros.CrrPortantes*CargaPortantes ...
             + Parametros.CrrRetencion*CargaRetencion ...
             + Parametros.CrrGuia     *CargaGuia;

    if Parametros.ModelarArrastre
        AreaEfectiva = Parametros.AreaFrontal * (1 + Parametros.FactorTren*(Parametros.NumeroDeCarros - 1));
        Arrastre = 0.5 * Parametros.RhoAire * Parametros.CoefArrastre * AreaEfectiva * Velocidad^2;
    else
        Arrastre = 0;
    end

    FuerzaTotal = Rodadura + Arrastre;
end
