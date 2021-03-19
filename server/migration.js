const fetch = require('node-fetch');
const config = require('./config');
const db = require('./db');
const { generateModelFile } = require('./process/models');
const { uploadFile } = require('./process/uploader');

function parseModel(vert_buffer, index_buffer) {
	let offset;
    let coords = [];
    let indices = [];

	offset = 0;
	while(offset < vert_buffer.byteLength) {
		coords.push(
			vert_buffer.readFloatLE(offset + 0),
            vert_buffer.readFloatLE(offset + 4),
            vert_buffer.readFloatLE(offset + 8)
		);
        offset += 12; // 4 * 3
	}
	
	let _32i = index_buffer.readUInt32LE(0) === 0; // que trucazo (hackazo)

	offset = 0;
	while(offset < index_buffer.byteLength) {
		if(_32i) {
			indices.push(index_buffer.readUInt32LE(offset));
			offset += 4;
		} else {
			indices.push(index_buffer.readUInt16LE(offset));
			offset += 2;
		}
	}
	
	if(indices[0] !== 0 || indices[1] !== 1 || indices[2] !== 2) {
		console.log("======================================= BAD =======================================");
		/*
		console.log(vert_buffer);
		console.log(index_buffer);
		console.log(coords, indices);
		process.exit(1);
		*/
		throw new Error("BAD MODEL");
	}

    return {
        texture: null,
        coords: coords,
        uv_coords: null,
        indexes: indices
    };
}

const isTrueNumber = (str) => {
	return str.length > 0 && parseInt(str, 10).toString() === str;
};

async function processCase(plan) {
	if(plan.status !== 40 && plan.status !== 20)
		return false; // invalid status

	let uuid = plan.uuid;
	let tag = plan.ct_scan.patient_tag.replace("\t", " ").trim();
	let stage = plan.t_plan.plan_type.name;
	let created = new Date(plan.created);

	let tag_spaces = tag.split(" ").map(x => x.trim());

	let case_id;
	let name;

	if(
		// 1234
		isTrueNumber(tag_spaces[0]) ||
		(
			// P1234
			tag_spaces.length > 0 &&
			tag_spaces[0].length > 2 &&
			(tag_spaces[0].toUpperCase()[0] === 'P' || tag_spaces[0].toUpperCase()[0] === 'U') &&
			isTrueNumber(tag_spaces[0].slice(1))
		)
		) {
		case_id = tag_spaces[0].toUpperCase();
		name = tag.slice(case_id.length).trim();
	} else if(tag_spaces.length >= 2 && tag_spaces[0].length === 1 && isTrueNumber(tag_spaces[1])) {
		// P 1234
		case_id = tag_spaces[0] + tag_spaces[1];
		name = tag.split(tag_spaces[1])[1].trim();
	} else if(tag_spaces.length > 0 && tag_spaces[0] === "P399Engist") {
		// especiales
		case_id = "P999";
		name = "Engist Rene (Medium)"
	} else if(tag_spaces.length > 0 && tag_spaces[0] === "36563Laudani") {
		// especiales
		case_id = "36563";
		name = "Laudani Lucila"
	} else {
		case_id = "";
		name = tag;
	}
	
	// console.log(case_id.padEnd(10), " ============= ", name.padEnd(30), " ---------- ", tag);

	let results = await db.query(`SELECT id FROM cases WHERE uid=?`, [uuid]);
	if(results.length > 0)
		return false; // already present
	
	console.log(`${plan.uuid}: Fetching assets...`);

	let assets = (await fetch(`https://3d.keepsmilinglog.com/api/v1/viewer/${uuid}/assets/`).then(res => res.json())).assets;
	let assets_map = {};
	
	for(let asset of assets)
		assets_map[Object.keys(asset)[0]] = asset[Object.keys(asset)[0]];

	const downloadAsset = async(asset_name) => {
		console.log(`Downloading "${asset_name}"...`);
		return Buffer.from(new Uint8Array(await fetch(assets_map[asset_name]).then(res => res.arrayBuffer())))
	};

	const fetchModel = async(kind, step) => {
		console.log(`Fetching model ${kind}-${step}...`);

		let teeth = kind === "inferior" ? "lower_teeth" : "upper_teeth";
		
		let vert_data = await downloadAsset(`${teeth}_v_${step}`);
		let index_data = await downloadAsset(`${teeth}_t_${step}`);

		console.log(`Generating model file for ${kind}-${step}...`);
		return parseModel(vert_data, index_data);
	};

	let files = [];
	let files_uploaded = [];

	for(let asset_name in assets_map) {
		if(asset_name.includes("_v_")) {
			let kind = asset_name.includes("lower_teeth") ? "inferior" : "superior";
			let step = asset_name.split("_")[3];

			let model = await fetchModel(kind, step);
			let model_file = generateModelFile(model);

            let file_uid = await uploadFile(uuid, model_file);
			files_uploaded.push(file_uid);
			files.push({
				"filename": asset_name,
				"type": "model",
				"step": step,
				"kind": kind,
				"format": "migration",
				"md5": "00000000000000000000000000000000",
				"file_uid": file_uid
			});
		}
	}

    let r = await db.query(`INSERT INTO cases SET ?`, {
		uid: uuid,
		status: 'WAITING',
		created: created,
		result: "",
		csv_content: null,
		name: name,
		stage: stage,
		maxilars: "",
		user_id: 0,
		case_id: case_id
	});

	let internal_id = r.insertId;

    await db.query(`
        INSERT INTO cases_output_files (case_id, output_file_uid) VALUES ?;
        UPDATE cases SET status='READY', result=? WHERE id=?;
    `, [
        files_uploaded.map(uid => [internal_id, uid]),
        JSON.stringify(files),
        internal_id
	]);
	
	return true;
}

function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

async function run() {
	console.log("Requesting cases...");

	/*
	{
		let cases = require('../migration-input-sample.json');
		shuffle(cases);
		let r = cases.filter(x => x.uuid === "c8cdd080-926a-4fe8-a5e0-25767f3ee059");
		await processCase(r[0]);
		return;
	}
	*/
	
	console.log("Logging in...");
	let auth = await fetch(`https://3d.keepsmilinglog.com/api/v1/auth/login/`, {
		method: 'POST',
		headers: {
			"Authorization": "Basic bHVqYW46R0NzN3N7Yls=" // lujan GCs7s{b[
		}
	}).then(res => res.json());

	if(!auth.token) {
		console.log("Login failed", auth);
		return;
	}

	console.log("Logged in as", auth.user.username);
	
	console.log("Fetching cases...");
	let cases = await fetch(`https://3d.keepsmilinglog.com/api/v2/staff/job/?date_from=2010-01-01&date_to=2021-01-01`, {
		headers: {
			"Authorization": "Token " + auth.token
		}
	}).then(res => res.json());

	cases = cases.reverse(); // mas viejo al mas nuevo

	console.log(`Found ${cases.length} cases`);
	
	for(let plan of cases) {
		try {
			let success = await processCase(plan);
			if(success) {
				console.log(`${plan.uuid}: SUCCESS`);
			}
		} catch(ex) {
			console.log(`${plan.uuid}: ${ex}`);
		}
	}
}

(async() => {
	await run();
	process.exit(1);
})();
