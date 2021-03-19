import $ from "jquery";
import webglDetect from 'webgl-detect';
import prettyBytes from 'pretty-bytes';

import loader from './loader';
import visualizer from './visualizer';

const boot = () => {
    const error = err => {
        $(".progress").hide();
        $(".error").fadeIn(200).text(err);
        throw err;
    };

    if(!window.viewer_data)
        return error("Caso no encontrado");
    if(!webglDetect)
        return error("WebGL no disponible");
    switch(window.viewer_data.status) {
        case 'PROCESSING': return error("El caso todavía se está procesando");
        case 'ERRORED': return error("La carga de este caso falló");
        case 'WAITING': return error("Esperando para iniciar carga");
        case 'REMOVED': return error("El caso ya no está disponible");
    }

    $(".progress").fadeIn(400);

    function progress(loaded, size) {
        let percentage = loaded / size * 100;
        $(".progress .percentage span").text(parseInt(percentage));
        // $(".progress .legend").text(`${prettyBytes(loaded)}/${prettyBytes(size)}`);
    }

    loader(progress).then(() => {
        $(".progress .percentage").text("Iniciando...");
        $(".progress .legend").text("");
        visualizer();
    }).catch(error);
}

boot();