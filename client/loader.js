
const loadFile = (url, response_type, report_progress) => new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    xhr.responseType = response_type;
    if(response_type === 'text') {
        xhr.overrideMimeType('text/xml; charset=iso-8859-1');
    }
    xhr.open('GET', url);
    xhr.onload = function() {
        if(xhr.status === 200 || xhr.status === 304) {
            xhr = null;
            resolve(this.response);
        } else {
            reject("A file got " + xhr.status);
            xhr = null;
        }
    };
    xhr.onerror = (e) => {
        reject(e instanceof ProgressEvent ? "XHR Error" : e);
    };
    xhr.onprogress = function(e) {
        report_progress(e.loaded, e.lengthComputable ? e.total : 0);
    };
    xhr.send();
});

export default async (report_progress) => {
    const files = viewer_data.files;

    let individual_file_report = (file, loaded, total) => {
        if(total > 0) // por si cae en un 304
            file.size = total;
        file.loaded = loaded;

        let total_size = files.reduce((acc, f) => acc + f.size, 0);
        let total_loaded = files.reduce((acc, f) => acc + (f.loaded || 0), 0);
        report_progress(total_loaded, total_size);
    };
    
    await Promise.all(files.map(async file => {
        let response_type = 'arraybuffer';
        let matches = viewer_data.result.filter(x => x.file_uid === file.uid);
        let type = matches.length ? matches[0].type : 'unknown';
        if(type === "metadata" || type === "metadata-csv")
            response_type = 'text';
        file.result = await loadFile(file.url, response_type, (l, t) => individual_file_report(file, l, t));
    }));
};
