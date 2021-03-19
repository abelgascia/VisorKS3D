const fs = require('fs');
const path = require('path');
const db = require('../db');

const config = require('../config');

function chunks(arr, size){
    var results = [];
    while (arr.length)
        results.push(arr.splice(0, size));
    return results;
}

async function processChunk(files) {
    let files_in_db = await db.query(`SELECT md5, uploaded FROM input_files WHERE md5 IN (?)`, [files.map(x => x[0])]);
    let files_to_delete = [];

    for(let file of files) {
        let matches = files_in_db.filter(x => x.md5 === file[0]);
        if(matches.length === 0)
            continue; // custom file, non related to this

        let latest_upload = matches.sort((a, b) => b.uploaded - a.uploaded)[0].uploaded;

        /*
        console.log("matches: ");
        for(let m of matches)
            console.log(m.uploaded);
        console.log("latest: ", latest_upload);
        */
        
        if((new Date().getTime() - latest_upload) / 1000 > config.UPLOAD_EVICT_AFTER_SECONDS)
            files_to_delete.push(file[1]);
    }
	
	if(files_to_delete.length > 0) {
		console.log("Evicting", files_to_delete.length, "files");
	}

    for(let filepath of files_to_delete) {
        try {
            fs.unlinkSync(filepath);
        } catch(ex) { }
    }
}

async function cleanUp() {
    let files = fs.readdirSync(config.STORAGE_DIR)
        .map(filename => [filename, path.join(config.STORAGE_DIR, filename)])
        .filter((file) => !fs.statSync(file[1]).isDirectory());

    if(files.length === 0)
        return;
    
    let files_chunks = chunks(files, 100);

    for(let chunk of files_chunks) {
        await processChunk(chunk);
    }
}

module.exports = {
    cleanUp
};