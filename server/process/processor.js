const path = require('path');
const fs = require('fs');

const db = require('../db');
const debug_obj = require('debug');
const debug = debug_obj("Processor");

debug_obj.enable("*");

const config = require('../config');
const classifier = require('./classifier');
const { readBinarySTL, readVRML, generateModelFile } = require('./models');
const { uploadFile } = require('./uploader');
const { cleanUp } = require('./cleanup');

let PROCESSING_ID;

const one = async () => {
    PROCESSING_ID = 0;

    let cases = await db.query(`SELECT * FROM cases WHERE status='PROCESSING' ORDER BY created ASC LIMIT 1`);
    if(cases.length === 0) return;

    let case_result = cases[0];
    let input_files = await db.query(`
        SELECT
            name, md5
        FROM input_files
        LEFT JOIN cases_input_files ON
            cases_input_files.input_file_id=input_files.id
        WHERE case_id=?
    `, [case_result.id]);

    PROCESSING_ID = case_result.id;

    debug("Processing #", case_result.id);

    let files_classified = classifier(input_files);
    
    // sanity checks
    let steps = files_classified.map(x => `${x.type}-${x.kind}-${x.step}`);
    if(steps.some((x, idx) => steps.indexOf(x) !== idx))
        throw new Error("Found two models for the same step");

    let textures_dedupe = {};
    let files_uploaded = [];

    for(let file of files_classified) {
        const input_file = path.join(config.STORAGE_DIR, file.md5);
        let model = null;

        try {
            switch(file.format) {
                case 'stl':
                model = readBinarySTL(input_file);
                break;
                case 'wrl':
                model = readVRML(input_file);
                break;
            }
        } catch(ex) {
            throw new Error(`Can't read model "${file.filename}": ${ex.message}`);
        }

        if(model) {
            // load texture (if any) & upload
            if(model.texture) {
                let texture_files = input_files.filter(x => x.name.toLowerCase() === model.texture.toLowerCase());
                if(texture_files.length === 0)
                    throw new Error(`Missing texture "${model.texture}" for model "${file.filename}"`);

                const texture_md5 = texture_files[0].md5;
                let texture_uid = textures_dedupe[texture_md5];

                if(!texture_uid) {
                    const texture_path = path.join(config.STORAGE_DIR, texture_md5);
                    const texture_buffer = fs.readFileSync(texture_path);

                    texture_uid = await uploadFile(case_result.uid, texture_buffer);
                    files_uploaded.push(texture_uid);

                    textures_dedupe[texture_md5] = texture_uid;
                }
                file.texture_uid = texture_uid;
            }

            // generate model file & upload
            let model_buffer = generateModelFile(model);
            file.file_uid = await uploadFile(case_result.uid, model_buffer);
            files_uploaded.push(file.file_uid);
        }

        if(file.format === 'xml' || file.format === 'csv') { // upload metadata
            const metadata_buffer = fs.readFileSync(input_file);
            file.file_uid = await uploadFile(case_result.uid, metadata_buffer);
            files_uploaded.push(file.file_uid);
        }
    }

    debug(files_uploaded.length, "files uploaded");

    if(files_uploaded.length == 0) {
        throw new Error("No files to upload. Maybe input files are corrupted?");
    }

    await db.query(`
        INSERT INTO cases_output_files (case_id, output_file_uid) VALUES ?;
        UPDATE cases SET status='READY', result=? WHERE id=?;
    `, [
        files_uploaded.map(uid => [case_result.id, uid]),
        JSON.stringify(files_classified),
        case_result.id
    ]);
    
    debug("Case #", PROCESSING_ID, "ready");
};

let last_cleanup = 0;

const run = async () => {
    try {
        await one();
    } catch(ex) {
        debug(PROCESSING_ID + ": " + ex);

        if(PROCESSING_ID > 0) {
            try {
                await db.query(`UPDATE cases SET status='ERRORED', result=? WHERE id=?`, [ex.stack, PROCESSING_ID]);
            } catch(ex) { throw ex; }
        }
    }
    if(Date.now() - last_cleanup > 1000 * config.UPLOAD_EVICT_INTERVAL_SECONDS) {
        try {
            await cleanUp();
        } catch(ex) { throw ex; }
        last_cleanup = Date.now();
    }
    setTimeout(run, 1000);
};

run();