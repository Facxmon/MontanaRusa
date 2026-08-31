function Registro = RecortarRegistro(Registro)
%RECORTARREGISTRO Descarta las filas reservadas y no usadas.

    n = Registro.NumeroDeNodos;
    Campos = fieldnames(Registro);
    for i = 1:numel(Campos)
        if strcmp(Campos{i}, 'NumeroDeNodos'); continue; end
        Registro.(Campos{i}) = Registro.(Campos{i})(1:n, :);
    end
end
