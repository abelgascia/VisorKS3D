const express = require('express');
const fileUpload = require('express-fileupload');
const path = require('path');
const request = require('request');
const { v4: uuidv4 } = require('uuid');
const prettyBytes = require('pretty-bytes');

const config = require('./config');
const db = require('./db');
const classifier = require('./process/classifier');

let router = express.Router();

if(config.PRODUCTION) {
    router.use(require('express-basic-auth')({
        users: config.panel_users,
        challenge: true
    }));
}

router.use(fileUpload({
    useTempFiles : true,
    tempFileDir : config.PRODUCTION ? '/tmp/' : path.join(config.STORAGE_DIR, '/tmp'),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB per file
    abortOnLimit: true
}));

router.get('/', async (req, res) => {
    const PER_PAGE = 25;
    let page = Math.max(1, req.query.page || 1);
    let search_query = req.query.q || "";
    let where = "";
    let where_params = [];
    if(search_query.length > 0) {
        where = "WHERE ";
        if(parseInt(search_query, 10) > 0) {
            where += `cases.id=? OR cases.user_id=? OR `;
            where_params.push(search_query, search_query);
        }
        where += `cases.case_id=? OR cases.name LIKE ?`;
        where_params.push(search_query, `%${search_query}%`);
    }
    let result = await db.query(`
        SELECT * FROM cases ${where} ORDER BY created DESC LIMIT ?, ?;
        SELECT COUNT(*) AS total FROM cases ${where};
    `, [...where_params, (page - 1) * PER_PAGE, PER_PAGE, ...where_params]);
    res.render(path.join(config.PUBLIC_DIR, 'panel.html'), {
        cases: result[0],
        page,
        per_page: PER_PAGE,
        total_cases: result[1][0].total,
        search_query
    });
});

router.get('/upload', (req, res) => {
    res.render(path.join(config.PUBLIC_DIR, 'upload.html'), {
        params: req.query || {},
        default_stages: [
			'Primera Etapa',
			'Primera Etapa - Segunda Propuesta',
			'Primera Etapa - Tercer Propuesta',
			'Primera Etapa - Cuarta Propuesta',
			'Segunda Etapa',
			'Segunda Etapa - Segunda Propuesta',
			'Segunda Etapa - Tercer Propuesta',
			'Segunda Etapa - Cuarta Propuesta',
			'Tercer Etapa',
			'Tercer Etapa - Segunda Propuesta',
			'Tercer Etapa - Tercer Propuesta',
			'Tercer Etapa - Cuarta Propuesta',
			'Cuarta Etapa',
			'Cuarta Etapa - Segunda Propuesta',
			'Cuarta Etapa-Tercer Propuesta',
			'Cuarta Etapa-Cuarta Propuesta',
			'Tratamiento Medium',
			'Tratamiento Medium-Segunda Propuesta',
			'Tratamiento Medium-Tercer Propuesta',
			'Tratamiento Medium-Cuarta Propuesta',
			'Tratamiento Kids',
			'Tratamiento Kids-Segunda Propuesta',
			'Tratamiento Kids-Tercer Propuesta',
			'Tratamiento Kids-Cuarta Propuesta',
			'Tratamiento Teens',
			'Tratamiento Teens-Segunda Propuesta',
			'Tratamiento Teens-Tercer Propuesta',
			'Tratamiento Teens-Cuarta Propuesta',
			'Tratamiento Fast',
			'Tratamiento Fast - Segunda Propuesta',
			'Tratamiento Fast - Tercer Propuesta',
			'Tratamiento Fast - Cuarta Propuesta',
			'Otras Etapas'
        ],
        default_maxilars: [
            "",
            "Superior",
            "Inferior"
        ]
    });
});

router.get('/:uid', async (req, res) => {
    let result = await db.query(`
        SELECT * FROM cases WHERE uid=?;
        SELECT
            SUM(input_files.size) AS size,
            COUNT(*) AS count
        FROM input_files
        LEFT JOIN
            cases_input_files
            ON cases_input_files.input_file_id=input_files.id
        LEFT JOIN
            cases
            ON cases.id=cases_input_files.case_id
        WHERE
            cases.uid=?;
        SELECT
            SUM(output_files.size) AS size,
            COUNT(*) AS count
        FROM output_files
        LEFT JOIN
            cases_output_files
            ON cases_output_files.output_file_uid=output_files.uid
        LEFT JOIN
            cases
            ON cases.id=cases_output_files.case_id
        WHERE
            cases.uid=?;
    `, [req.params.uid, req.params.uid, req.params.uid]);
    if(result[0].length === 0)
        return res.redirect('/panel');
    res.render(path.join(config.PUBLIC_DIR, 'panel-status.html'), {
        case_result: result[0][0],
        input_count: parseInt(result[1][0].count),
        input_size: prettyBytes(parseInt(result[1][0].size || 0)),
        output_count: parseInt(result[2][0].count),
        output_size: prettyBytes(parseInt(result[2][0].size || 0)),
        host: config.PRODUCTION ? 'https://viewer3d.keepsmilinglog.com' : 'http://localhost:3000'
    });
});

router.get('/:uid/details', async (req, res) => {
    let case_result = await db.query(`SELECT * FROM cases WHERE uid=?`, [req.params.uid]);
    if(case_result.length === 0)
        return res.sendStatus(404);
    let case_ = case_result[0];
    
    let results = await db.query(`
        SELECT * FROM input_files LEFT JOIN cases_input_files ON cases_input_files.input_file_id=input_files.id WHERE cases_input_files.case_id=?;
        SELECT * FROM output_files LEFT JOIN cases_output_files ON cases_output_files.output_file_uid=output_files.uid WHERE cases_output_files.case_id=?;
    `, [case_.id, case_.id]);

    let input_files_classified = classifier(results[0]);

    res.render(path.join(config.PUBLIC_DIR, 'panel-details.html'), {
        case_: case_,
        input_files: results[0],
        output_files: results[1],
        input_files_classified
    });
});

router.post('/upload/file', async (req, res) => {
    if(!req.files || !req.files.file)
        return res.sendStatus(403);
    const file = req.files.file;

    let result = await db.query(`
        INSERT INTO input_files
            (name, md5, size, uploaded)
            VALUES
            (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            name=VALUES(name),
            size=VALUES(size),
            uploaded=VALUES(uploaded)
    `, [file.name, file.md5, file.size, new Date()]);

    let inserted_id = result.insertId;

    // importante: hacer el move DESPUES de la query de arriba
    //             así nos aseguramos de que el clean up no se lo coma
    //             por bad timing
    await file.mv(path.join(config.STORAGE_DIR, file.md5));

    if(config.PRODUCTION || 1) { // ASAP
        res.send(""+inserted_id);
    } else { // delay & fail %
        setTimeout(function() {
            if(Math.random() > 0.7)
                return res.sendStatus(500);
            else
                res.send(""+inserted_id);
        }, 2000 + Math.random() * 1000);
    }

});

router.post('/upload/submit', async (req, res) => {
    let files = JSON.parse(req.body.files) || [];
    if(!files.length)
        return res.sendStatus(400);

    // dedupe
    files = Array.from(new Set(files));

    let count_result = await db.query(`SELECT COUNT(*) AS count FROM input_files WHERE id IN (?)`, [files]);
    if(files.length !== count_result[0].count)
        return res.status(400).send("File not found");

    let uuid = uuidv4();
    
    let result = await db.query(`
        INSERT INTO cases (uid, status, created, result, name, stage, maxilars, user_id, case_id) VALUES (?, 'WAITING', ?, "", ?, ?, ?, ?, ?);
        SELECT LAST_INSERT_ID() AS case_id;
    `, [
        uuid,
        new Date(),
        req.body.name || "Sin nombre",
        req.body.stage || "Sin especificar",
        req.body.maxilars || "",
        parseInt(req.body.user_id || "0"),
        req.body.case_id || ""
    ]);

    let case_id = result[1][0].case_id;

    await db.query(`
        INSERT IGNORE INTO cases_input_files (case_id, input_file_id) VALUES ?;
        UPDATE cases SET status='PROCESSING' WHERE id=?;
    `, [files.map(input_file_id => [case_id, input_file_id]), case_id]);

    res.send(uuid);
	
	let external_case_id = req.body.case_id;

	function pingKeep(retry) {
		request('https://keepsmilinglog.com/htmls/ping_csv_back.php?external_id=' + external_case_id, function (error, response, body) {
			if(error){
				console.error("Can't ping Keep", external_case_id, uuid, error, "retry=", retry);
				if(retry > 3)
					return;
				setTimeout(() => pingKeep(retry + 1), 1000 * 60);
			} else {
                console.log("Pinged Keep about case external =", external_case_id, "internal =", case_id);
            }
		});
	}
	
	pingKeep(0);
});

router.get('/remove/:uid', async (req, res) => {
    await db.query(`UPDATE cases SET status='REMOVED' WHERE uid=?;`, [req.params.uid]);
    // TODO: check if matches before redirect
    res.redirect(`/panel/${req.params.uid}`);
});

router.post('/update_csv/:uid', async (req, res) => {
    let content = req.body.csv_content || "";
    if(content.length === 0)
        content = null;
    await db.query(`UPDATE cases SET csv_content=? WHERE uid=?;`, [content, req.params.uid]);
    // TODO: check if matches before redirect
    res.redirect(`/panel/${req.params.uid}`);
});

module.exports = router;