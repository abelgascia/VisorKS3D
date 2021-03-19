const express = require('express');
const path = require('path');
const babelify = require('express-babelify-middleware');
const expressLess = require('express-less');
const helmet = require('helmet');
const bodyParser = require('body-parser');

const config = require('./config');
const db = require('./db');

let app = express();

app.enable('trust proxy'); // nginx
app.use(helmet({
    frameguard: false
}));

app.use((req, res, next) => {
    res.header("X-Worker", `${config.workerID}`);
    res.header("X-Version", config.buildHash);
    res.locals.buildHash = config.buildHash;
    res.locals.workerID = config.workerID;
    res.locals.PRODUCTION = config.PRODUCTION;
    next();
});

app.use("/viewer.js", babelify(path.join(__dirname, '../client/viewer.js')));
app.use("/upload.js", babelify(path.join(__dirname, '../client/upload.js')));

app.use(expressLess(config.PUBLIC_DIR, { debug: !config.PRODUCTION, cache: config.PRODUCTION, compress: config.PRODUCTION }));
app.use(express.static(config.PUBLIC_DIR));
app.use("/webfonts", express.static(path.join(__dirname, '../node_modules/@fortawesome/fontawesome-free/webfonts')));
app.engine('html', require('ejs').renderFile);

if(!config.PRODUCTION) {
    // allow local upload for debugging
    app.use('/local', express.static(path.join(config.STORAGE_DIR, 'local')));
}

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use('/panel', require('./panel'));

app.get('/view/:id?', async (req, res) => {
    let results = await db.query(`
        SELECT uid, status, created, result, csv_content, name, stage, maxilars, user_id, case_id FROM cases WHERE cases.uid=?;
        SELECT
            output_files.uid,
            output_files.url,
            output_files.size
        FROM output_files
        LEFT JOIN cases_output_files ON
            cases_output_files.output_file_uid=output_files.uid
        LEFT JOIN cases ON
            cases.id=cases_output_files.case_id
        WHERE
            cases.uid=?;
    `, [req.params.id, req.params.id]);

    let viewer = null;
    if(results[0].length > 0) {
        const case_result = results[0][0];

        viewer = {
            ...case_result,
            files: null,
            result: null,
            csv_content: null
        };

        if(case_result.status === 'READY') {
            viewer.files = results[1];
            viewer.result = JSON.parse(case_result.result);
            viewer.csv_content = case_result.csv_content;
        }
    }

    res.render(path.join(config.PUBLIC_DIR, 'viewer.html'), { viewer });
});

app.post('/ping_csv', async (req, res) => {
    let external_id = parseInt(req.query.external_id || "0");
    let content = req.body.csv_content || "";
    console.log("Updating case id", external_id, content.length);
    await db.query(`UPDATE cases SET csv_content=? WHERE case_id=?`, [content, external_id]);
    res.send("OK");
});

app.listen(3000);
