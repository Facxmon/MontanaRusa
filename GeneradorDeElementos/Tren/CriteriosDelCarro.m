function [Criterios, Normativo] = CriteriosDelCarro(Sim, Escala, Parametros, Contexto)
%CRITERIOSDELCARRO Las lineas del reporte que dependen de la dinamica, para un carro.
%   Las mismas, con el mismo nombre y en el mismo orden relativo, que arma
%   ChequeosPosteriores con el Sim de la particula: marcha (completa el
%   elemento, G minima), onset, bloque normativo y cabeza. Contexto es la
%   serie normativa del layout de ESTE carro (SerieNormativaDelLayout con
%   sus Sims), o vacio para el elemento suelto.
    if nargin < 4
        Contexto = [];
    end
    Normativo = VerificarLimitesNormativos(Sim, Escala, Parametros, Contexto);
    Criterios = [CriteriosDeMarcha(Sim, Parametros), CriteriosDeOnset(Normativo, Escala, Parametros), ...
                 CriteriosNormativos(Normativo), CriteriosDeCabeza(Sim, Parametros)];
end
