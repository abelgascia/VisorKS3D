const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const db = require('../db');
const config = require('../config');

const spacesEndpoint = new AWS.Endpoint(config.spaces.endpoint);
const s3 = new AWS.S3({
    endpoint: spacesEndpoint,
    accessKeyId: config.spaces.key,
    secretAccessKey: config.spaces.secret
});

const uploadFile = async (case_uid, buffer) => {
    let uid = uuidv4();
    let url = null;
    let size = buffer.byteLength;
    
    let part = `${case_uid}/${uid}`;

    if(config.PRODUCTION) {
        await (s3.putObject({
            Bucket: config.spaces.bucket,
            Key: part,
            Body: buffer,
            ACL: "public-read"
        }).promise());
        url = `https://${config.spaces.bucket}.${config.spaces.edge_endpoint}/${part}`;
    } else {
        // save locally for debugging
        let local_path = path.join(config.STORAGE_DIR, '/local', uid);
        fs.writeFileSync(local_path, buffer);
        url = '/local/' + uid;
    }

    await db.query(`
        INSERT INTO output_files (uid, url, size, uploaded) VALUES (?, ?, ?, ?)
    `, [uid, url, size, new Date()]);
    
    return uid;
};

module.exports = {
    uploadFile
};