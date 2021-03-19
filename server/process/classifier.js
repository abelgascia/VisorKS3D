const path = require('path');
const fs = require('fs');
const debug_obj = require('debug');
const debug = debug_obj("Parser");

debug_obj.enable("*");

/*
    Patrón de los archivos
    
    Ejemplos:
    40991_1era etapa_MOVER_3-3-2020__09-20-45_Subsetup7_Maxillary.stl
    40991_1era etapa_mover_3-3-2020__09-20-45_subsetup11_mandibular.wrl
*/
// const ORTH_SUBSTEP_PATTERN = /(\d\d?)-(\d\d?)-(\d\d\d\d)__(\d\d?)-(\d\d?)-(\d\d?)_subsetup([0-9]+)_(mandibular|mandibulary|maxillar|maxillary)\.(stl|wrl)$/i;
const ORTH_SUBSTEP_PATTERN = /_+subsetup([0-9]+)_+(mandibular|mandibulary|maxillar|maxillary)\.(stl|wrl)$/i;
/*
    Al parecer el WRL que no tiene _subsetup es el último keyframe
*/
const ORTH_LAST_PATTERN = /_+(mandibular|mandibulary|maxillar|maxillary)\.(stl|wrl)$/i; // excluyo manualmente original y subsetup
const PLAIN_STL_PATTERN = /(sup|inf) ([0-9]+)\.(stl)$/i;
const METADATA_PATTERN = /\.(xml)$/i;
const CSV_PATTERN = /\.(csv)$/i;

// Algunos archivos tienen el sufijo -ary, los normalizo
const NORMALIZE_KIND = {
    'mandibular': 'inferior',
    'mandibulary': 'inferior',
    'inf': 'inferior',

    'maxillar': 'superior',
    'maxillary': 'superior',
    'sup': 'superior'
};

/*
    Dada una lista:
    [{
        name: String, // nombre original
        md5: String //  hash md5 original
    }, ...]
    
    Retorna:
    [{
        filename: String, // nombre del archivo original
        md5: String, // hash md5 del archivo
        export_data: Date, // fecha y hora en la que se exportó (solo si está disponible)
        type: String, 'model' o 'metadata'
        step: Number, // número de la animación (solo si type es 'model')
        kind: String, // 'superior' o 'inferior' (solo si type es 'model')
        format: String // 'stl' 'wrl' 'jpg' 'xml'
    }, ...]
*/
const classifyFiles = (files) => {
    const filenames = files.map(f => f.name);

    let orth_files = filenames.map(filename => ORTH_SUBSTEP_PATTERN.exec(filename)).filter(x => x).map(match => ({
        filename: match.input,
        // export_date: new Date(match[3], parseInt(match[1]) - 1, match[2], match[4], match[5], match[6]),
        // los otros 7,8,9
        type: 'model',
        step: parseInt(match[1]),
        kind: NORMALIZE_KIND[match[2].toLowerCase()],
        format: match[3].toLowerCase()
    }));
    let last_step = orth_files.reduce((acc, curr) => Math.max(acc, curr.step), 0);
    let orth_files_last = filenames.map(filename => ORTH_LAST_PATTERN.exec(filename)).filter(x => x).filter(x => {
        let inp = `${x.input}`;
        return !inp.includes("original") && !inp.includes("subsetup");
    }).map(match => ({
        filename: match.input,
        type: 'model',
        step: last_step + 1,
        kind: NORMALIZE_KIND[match[1].toLowerCase()],
        format: match[2].toLowerCase()
    }));
    let plain_stl_files = filenames.map(filename => PLAIN_STL_PATTERN.exec(filename)).filter(x => x).map(match => ({
        filename: match.input,
        type: 'model',
        step: match[2],
        kind: NORMALIZE_KIND[match[1].toLowerCase()],
        format: 'stl'
    }));
    let metadata_files = filenames.map(filename => METADATA_PATTERN.exec(filename)).filter(x => x).map(match => ({
        filename: match.input,
        type: 'metadata',
        format: 'xml'
    }));
    let csv_files = filenames.map(filename => CSV_PATTERN.exec(filename)).filter(x => x).map(match => ({
        filename: match.input,
        type: 'metadata-csv',
        format: 'csv'
    }));
    
    let result = [].concat(orth_files, orth_files_last, plain_stl_files, metadata_files, csv_files);

    // set the md5 field again
    result = result.map(r => ({ ...r, md5: files.filter(x => x.name === r.filename)[0].md5 }));

    return result;
};

module.exports = classifyFiles;