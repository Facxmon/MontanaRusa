function [FuerzaTotal, Rodadura, Arrastre] = ResistenciaAlAvance(Velocidad, GArribaRiel, GLateralRiel, Parametros)
%RESISTENCIAALAVANCE Rodadura de los tres juegos de ruedas mas arrastre.
%   La componente de la normal sobre U va a las portantes si es positiva y a
%   las de retencion si es negativa; la componente sobre L va a las de guia.
%   El arrastre no depende de la normal, asi que se puede evaluar incluso
%   donde la curvatura todavia no esta definida.

    Peso = Parametros.Masa * Parametros.Gravedad;

    CargaPortantes = max( GArribaRiel, 0) * Peso;
    CargaRetencion = max(-GArribaRiel, 0) * Peso;
    CargaGuia      = abs(GLateralRiel)    * Peso;

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
