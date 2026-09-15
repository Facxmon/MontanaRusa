function Constructores = CatalogoDeElementos()
%CATALOGODEELEMENTOS Los constructores de elemento disponibles.
%   Es la lista que recorren DescribirParametros y AjustarParametros para
%   saber que parametros geometricos existen en total y cuales no consume el
%   elemento elegido. Un elemento nuevo se agrega aca y en su propio archivo
%   (con su declaracion de parametros).
    Constructores = {@ElementoLoopVertical, @ElementoDiveLoop, @ElementoHelice, @ElementoOverBankedTurn};
end
