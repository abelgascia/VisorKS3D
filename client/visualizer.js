import $ from "jquery";
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';
// import * as dat from 'dat.gui';
import report from './report';
import browser from 'browser-detect';

const OrbitControls = require('./external/three-orbit-controls')(THREE);

window.THREE = THREE; // make THREE available everywhere

import createBackground from 'three-vignette-background';

const browser_info = browser();

let TRUE_CENTER = { x: 0, y: 0, z: 0 }; // se computa con el bounding box

let renderer, scene, camera, controls;
let background = null;

let frame_request = true;
let frame_number = 0;
let min_step, max_step;
let step_selected;
let play_timeout = null;
let filter_kinds = ["superior", "inferior"];
let is_mouth_open = false, current_mouth_angle = 0;
let report_open = false;
let last_report_toggle = 0;

function init() {
    const canvas = document.getElementById("output");

	renderer = new THREE.WebGLRenderer({ canvas: canvas });
	renderer.setClearColor(new THREE.Color(0.8,0.8,0.8));
	renderer.shadowMap.enabled = true;

	scene = new THREE.Scene();
	camera = new THREE.OrthographicCamera(0, 0, 0, 0, 0.1, 2000);
    controls = new OrbitControls(camera, canvas);
    
    controls.minZoom = 3;
    controls.maxZoom = 1000;
    controls.enableDamping = true;
    controls.dampingFactor = 0.4;
    controls.rotateSpeed = 0.2;
    controls.keyPanSpeed = 2;
    controls.setZoom(getOptimalZoom());
    controls.addEventListener('change', () => frame_request = true);

	camera.position.x = 0;
	camera.position.y = 0;
	camera.position.z = 250;
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    controls.update();
}

function createLights() {
    var light = new THREE.AmbientLight(0x444444);
    scene.add(light);

    let point_lights = [
        // inside
        { color: 0xffffff, intensity: 0.4, distance: 40, x: TRUE_CENTER.x, y: TRUE_CENTER.y, z: TRUE_CENTER.z },

        // front
        { color: 0xffffff, intensity: 1, distance: 80, x: TRUE_CENTER.x, y: TRUE_CENTER.y, z: TRUE_CENTER.z + 60 },
        // sides
        { color: 0xffffff, intensity: 1, distance: 80, x: TRUE_CENTER.x - 60, y: TRUE_CENTER.y, z: TRUE_CENTER.z + 10 },
        { color: 0xffffff, intensity: 1, distance: 80, x: TRUE_CENTER.x + 60, y: TRUE_CENTER.y, z: TRUE_CENTER.z + 10 },

        // up & down (open)
        { color: 0xffffff, intensity: 0.7, distance: 80, x: TRUE_CENTER.x, y: TRUE_CENTER.y + 40, z: TRUE_CENTER.z - 10 },
        { color: 0xffffff, intensity: 0.7, distance: 80, x: TRUE_CENTER.x, y: TRUE_CENTER.y - 40, z: TRUE_CENTER.z - 10 },
        // far up & down (open)
        { color: 0xffffff, intensity: 1, distance: 80, x: TRUE_CENTER.x, y: TRUE_CENTER.y + 70, z: TRUE_CENTER.z - 30 },
        { color: 0xffffff, intensity: 1, distance: 80, x: TRUE_CENTER.x, y: TRUE_CENTER.y - 70, z: TRUE_CENTER.z - 30 },
    ];

    for(let light of point_lights) {
        var pl = new THREE.PointLight(light.color, light.intensity, light.distance);
        pl.position.set(light.x, light.y, light.z);
        scene.add(pl);
        
        // var plh = new THREE.PointLightHelper(pl, 1);
        // scene.add(plh);
    }
}

function resize() {
    let w = $(".viewer").width() || window.innerWidth;
    let h = window.innerHeight - $(".header").height();

    camera.left = w / -2;
    camera.right = w / 2;
    camera.top = h / 2;
    camera.bottom = h / -2;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    frame_request = true;
    
    // vignette effect
    if(browser_info.name !== 'safari' && !browser_info.mobile) {
        if(background)
            scene.remove(background);
        background = createBackground({
            aspect: camera.aspect,
            grainScale: 0.001,
            noiseAlpha: 0.2,
            scale: 1.0
        });
        background.renderOrder = -1;
        scene.add(background);
    }

    // alineador
    let num_steps = max_step - min_step + 1;
    let full_mode = window.innerWidth - 130 > 36 * num_steps && !(max_step - min_step == 0);
    if(full_mode) {
        $(".steps").addClass("full");
    } else {
        $(".steps").removeClass("full");
    }
}

function render(time) {
    requestAnimationFrame(render);

    TWEEN.update(time);

    let current_time = Date.now();
    let d = current_time - last_report_toggle;
    if(d > 0 && d <= 400) {
        resize();
        frame_request = true;
    }
    
    if(!frame_request)
        return;
    frame_request = false;

    if(background && background.visible && background.material.program) {
        let gl = renderer.getContext();
        if(!gl.getProgramParameter(background.material.program.program, gl.LINK_STATUS)) {
            console.log("Disabling background, shader not compiled");
            background.visible = false;
        }
    }

    let shown = [];
    for(let entry of viewer_data.result) {
        if(entry.type === 'model') {
            // ocultar a partir del 2do frame
            // el primero se usa para subir el mesh a la GPU
            // para evitar un parpadeo más tarde
            entry.object.visible = frame_number == 0 || (parseInt(entry.step) === step_selected);
            // set the mouth angle
            entry.pivot.rotation.x = entry.kind === "inferior" ? current_mouth_angle : -current_mouth_angle;
            if(entry.object.visible) {
                shown.push(entry.kind);
            }
        }
    }

    const fallbackKind = (kind) => {
        if(shown.includes(kind))
            return; // no need to fallback
        
        let entries_to_fallback = viewer_data.result.filter(e => e.type === 'model' && e.kind === kind).sort((a, b) => a.step - b.step);
        let filter_before = entries_to_fallback.filter(e => e.step < step_selected);
        
        let entry = null;
        if(filter_before.length > 0)
            entry = filter_before[filter_before.length - 1];
        else if(entries_to_fallback.length > 0)
            entry = entries_to_fallback[0];
        
        if(entry)
            entry.object.visible = true;
    };

    fallbackKind('inferior');
    fallbackKind('superior');

    // hide filtered
    if(frame_number > 0) {
        for(let entry of viewer_data.result) {
            if(entry.type === 'model' && entry.object.visible && !filter_kinds.includes(entry.kind)) {
                entry.object.visible = false; // hide
            }
        }
    }

    controls.update();
    renderer.render(scene, camera);

    frame_number++;
}

function readModel(entry) {
    return new Promise((resolve, reject) => {
        let geom = new THREE.BufferGeometry();
        
        // see models.js
        const DATA_TYPES = {
            NONE: 0,
            POSITIONS: 1,
            UV_COORDS: 2,
            INDEXES_16: 3,
            INDEXES_32: 4
        };

        let files = viewer_data.files.filter(x => x.uid === entry.file_uid);
        if(files.length === 0)
            throw new Error(`File ${entry.file_uid} not found`);
        let file_buffer = files[0].result;
        let data_view = new DataView(file_buffer);

        let offset = 0;
        while(offset + 5 < file_buffer.byteLength) {
            let type = data_view.getUint8(offset); offset += 1;
            let length = data_view.getUint32(offset, true); offset += 4;

            switch(type) {
                case DATA_TYPES.POSITIONS:
                case DATA_TYPES.UV_COORDS:
                {
                    let are_vcoords = type === DATA_TYPES.POSITIONS;

                    let size = 4 * length;
                    let arr = file_buffer.slice(offset, offset + size);
                    offset += size;

                    geom.setAttribute(are_vcoords ? 'position' : 'uv', new THREE.BufferAttribute(new Float32Array(arr), are_vcoords ? 3 : 2));
                    break;
                }
                case DATA_TYPES.INDEXES_16:
                case DATA_TYPES.INDEXES_32:
                {
                    let idx_size = type === DATA_TYPES.INDEXES_16 ? 2 : 4;

                    let indexes = Array(length);
                    for(let i = 0; i < length; i++) {
                        indexes[i] =
                            idx_size === 2 ? data_view.getUint16(offset, true)
                                        : data_view.getUint32(offset, true);
                        offset += idx_size;
                    }

                    geom.setIndex(indexes);
                    break;
                }
                default:
                    throw new Error(`File is corrupted, model data type unknown ${type}`);
            }
        }

        geom.computeVertexNormals();
        geom.computeBoundingBox();

        let texture = null;

        function loaded() {
            let mat = new THREE.MeshStandardMaterial({
                roughness: 0.7,
                metalness: 0.05,
                flatShading: false,
                map: texture,
                color: 0xffffff
            });
    
            resolve(new THREE.Mesh(geom, mat));
        }

        if(entry.texture_uid) {
            let texs = viewer_data.files.filter(x => x.uid === entry.texture_uid);
            if(texs.length === 0)
                throw new Error(`Texture not found ${entry.texture_uid}`);
            let tex = texs[0];

            let imageBlob = new Blob([tex.result], { type: "image/png" });
            let url = URL.createObjectURL(imageBlob);
            texture = new THREE.TextureLoader().load(url, () => {
                const material = new THREE.MeshBasicMaterial();
                const geometry = new THREE.PlaneBufferGeometry();
                const scene = new THREE.Scene();
                const camera = new THREE.Camera();
                scene.add(new THREE.Mesh(geometry, material));
                
                // console.log("Preloading texture", entry.texture_uid);

                material.map = texture;
                renderer.render(scene, camera);
                loaded();
            });
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
        } else {
            loaded();
        }
    });
}

async function processFiles() {
    console.time("Read Models");
    let boundingBox = new THREE.Box3();
    for(let entry of viewer_data.result) {
        if(entry.type === 'model') {
            entry.pivot = new THREE.Group();
            entry.object = await readModel(entry);
            entry.pivot.add(entry.object);
            scene.add(entry.pivot);
            boundingBox.union(entry.object.geometry.boundingBox);
        }
    }
    TRUE_CENTER = boundingBox.getCenter(new THREE.Vector3());
    let size = boundingBox.getSize(new THREE.Vector3());
    
    console.log("True center", TRUE_CENTER, "Size", size);
    for(let entry of viewer_data.result) {
        if(entry.type === 'model') {
            entry.object.position.set(0, size.y / 2, size.z / 2 + 2);
        }
    }
    TRUE_CENTER.y += size.y / 2;
    TRUE_CENTER.z += size.z / 2 + 2;
    console.timeEnd("Read Models");
}

function selectStep(step_number) {
    // console.log("Step selected", step_number);
    frame_request = true;
    step_selected = step_number;
    $(".steps-bar li, .bottom .steps-list li")
        .removeClass("active")
        .removeClass("current")
        .filter((i, el) => $(el).data('step') <= step_number)
        .addClass("active")
        .filter((i, el) => $(el).data('step') == step_number)
        .addClass("current");
    
    $(".control-play").toggle(play_timeout == null);
    $(".control-pause").toggle(play_timeout != null);

    $(".step-current").text(step_number + (min_step == 0 ? 1 : 0));
    
    $(".control-fast-backward, .control-fast-forward, .control-backward, .control-forward").removeClass('disabled');
    if(step_number <= min_step)
        $(".control-fast-backward, .control-backward").addClass('disabled');
    if(step_number >= max_step)
        $(".control-fast-forward, .control-forward").addClass('disabled');
}

function moveCamera(position, target, duration, zoom = null) {
    let from = {
        cam_x: camera.position.x,
        cam_y: camera.position.y,
        cam_z: camera.position.z,
        target_x: controls.target.x,
        target_y: controls.target.y,
        target_z: controls.target.z,
        zoom: controls.getZoom() || getOptimalZoom()
    };
    let to = {
        cam_x: position.x,
        cam_y: position.y,
        cam_z: position.z,
        target_x: target.x,
        target_y: target.y,
        target_z: target.z,
        zoom: zoom || getOptimalZoom()
    };

    // console.log(window.innerWidth / window.innerHeight, getOptimalZoom());
    
    let tween = new TWEEN.Tween(from)
        .to(to, duration)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate(() => {
            camera.position.set(from.cam_x, from.cam_y, from.cam_z);
            camera.lookAt(new THREE.Vector3(from.target_x, from.target_y, from.target_z));
            controls.setZoom(from.zoom);
            controls.target = new THREE.Vector3(from.target_x, from.target_y, from.target_z);
            frame_request = true;
        })
        .start();
}
function mouthAngle(angle, duration) {
    let from = {
        angle: current_mouth_angle
    };
    let to = {
        angle: angle
    };

    let tween = new TWEEN.Tween(from)
        .to(to, duration)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate(() => {
            current_mouth_angle = from.angle;
            frame_request = true;
        })
        .start();
}

function getTrueSize() {
    let size = renderer.getSize(new THREE.Vector2(0, 0));
    let w = size.x;
    let h = size.y;
    let bs = $(".bottom.show");
    if(bs.length > 0)
        h -= bs.height();
    return { w, h };
}

function getOptimalZoom() {
    let size = getTrueSize();
    let formX = (Math.max(400, size.w) - 400) / 100 + 5;
    let formY = (Math.max(400, size.h) - 400) / 100 + 9;
    return Math.min(formX, formY);
}
function getZoomForMouthOpening() {
    let size = getTrueSize();
    let formX = (Math.max(400, size.w) - 400) / 100 + 5;
    let formY = (Math.max(400, size.h) - 400) / 120 + 1;
    return Math.min(formX, formY);
}
function getOptimalRadius() {
    let size = renderer.getSize(new THREE.Vector2(0, 0));
    let r = size.w / size.h;
    if(r < 0.5)
        return 180;
    else if(r < 1.0)
        return 160;
    else
        return 110;
}

function createUI() {
    let kinds_found = {};
    min_step = 99;
    max_step = 0;
    for(let entry of viewer_data.result) {
        if(entry.type === 'model') {
            let step = parseInt(entry.step);
            min_step = Math.min(min_step, step);
            max_step = Math.max(max_step, step);
            kinds_found[entry.kind] = 1;
        }
    }
    if(Object.keys(kinds_found).length < 2) {
        // si no encuentro inferior y superior,
        // falta un maxilar completamente, así
        // que borro los botones de visibilidad
        $(".control-inferior, .control-superior").remove();
    }
    
    function stop() {
        clearTimeout(play_timeout);
        play_timeout = null;
        selectStep(step_selected);
    }

    console.log("Steps", max_step - min_step + 1, "Min", min_step, "Max", max_step);

    for(let step = min_step; step <= max_step; step++) {
        let stepper_element_full = $(`<li></li>`);
        let stepper_element_simple = $(`<li></li>`);

        stepper_element_full.data('step', step);
        stepper_element_full.click(() => { stop(); selectStep(step); });
        stepper_element_simple.text(step + (min_step == 0 ? 1 : 0)).data('step', step);
        stepper_element_simple.click(() => { stop(); selectStep(step); });

        $(".steps-bar").append(stepper_element_full);
        $(".bottom .steps-list").append(stepper_element_simple);
    }

    selectStep(min_step);

    $(".step-max").text(max_step + (min_step == 0 ? 1 : 0));

    $(".control-fast-backward").click(() => { stop(); selectStep(min_step); });
    $(".control-fast-forward").click(() => { stop(); selectStep(max_step); });
    $(".control-backward").click(() => { if(step_selected > min_step) { stop(); selectStep(step_selected - 1); } });
    $(".control-forward").click(() => { if(step_selected < max_step) { stop(); selectStep(step_selected + 1); } });
    
    $(".control-zoom-in").click(() => { controls.zoomIn(1.1); });
    $(".control-zoom-out").click(() => { controls.zoomOut(1.1); });

    $(".control-play").click(() => {
        if(step_selected == max_step)
            selectStep(min_step);
        
        function next() {
            if(step_selected == max_step) {
                stop();
                return;
            }
            clearTimeout(play_timeout);
            play_timeout = setTimeout(() => {
                selectStep(step_selected + 1);
                next();
            }, 500);
        }
        next();
        selectStep(step_selected);
    });
    $(".control-pause").click(stop);

    function triggerMouthOpen() {
        mouthAngle(is_mouth_open ? 0 : Math.PI/2, 500);
        is_mouth_open = !is_mouth_open;
    }
    $(".control-open").click(() => {
        triggerMouthOpen();
        if(is_mouth_open)
            moveCamera({ x: TRUE_CENTER.x, y: TRUE_CENTER.y, z: TRUE_CENTER.z + getOptimalRadius() }, TRUE_CENTER, 500, getZoomForMouthOpening());
        else
            $(".control-center").click();
    });

    function triggerKind(current, other) {
        if(filter_kinds.includes(current)) {
            filter_kinds = filter_kinds.filter(x => x !== current);
            $(".control-" + current).addClass("light");
        } else {
            filter_kinds.push(current);
            $(".control-" + current).removeClass("light");
        }
        if(filter_kinds.length === 0) {
            $(".control-" + other).removeClass("light");
            filter_kinds.push(other);
        }
        frame_request = true;
    }
    $(".control-superior").click(() => triggerKind("superior", "inferior"));
    $(".control-inferior").click(() => triggerKind("inferior", "superior"));
    
    $(".control-left").click(() => {
        moveCamera({ x: TRUE_CENTER.x - getOptimalRadius(), y: TRUE_CENTER.y, z: TRUE_CENTER.z }, TRUE_CENTER, 500);
        if(is_mouth_open)
            triggerMouthOpen();
    });
    $(".control-center").click(() => {
        moveCamera({ x: TRUE_CENTER.x, y: TRUE_CENTER.y, z: TRUE_CENTER.z + getOptimalRadius() }, TRUE_CENTER, 500);
        if(is_mouth_open)
            triggerMouthOpen();
    });
    $(".control-right").click(() => {
        moveCamera({ x: TRUE_CENTER.x + getOptimalRadius(), y: TRUE_CENTER.y, z: TRUE_CENTER.z }, TRUE_CENTER, 500);
        if(is_mouth_open)
            triggerMouthOpen();
    });

    // Alineador small
    $(".step-small .indicator").click(function() { $(this).parent(".step-small").toggleClass("open"); });

    // Reporte
    window.last_tab_open = window.last_tab_open || "botones";
    function hideTabs() {
        report_open = false;
        last_report_toggle = Date.now();
        $(".bottom").addClass("show");
        $(".report").removeClass("open");
        $(".viewer").removeClass("report-open");
        $(".tabs .tab").stop().fadeOut(200);
        $(".nav li").removeClass("active");
    }
    function showTab(id) {
        hideTabs();
        $(`.tabs .tab[data-tab="${id}"]`).stop().fadeIn(300);
        $(`.nav li[data-tab="${id}"]`).addClass("active");
        $(".report").addClass("open");
        $(".viewer").addClass("report-open");

        // Esto ya no es necesario porque se pidió que el visor se colapse
        // cuando se abra el reporte
        //if(window.innerWidth < 600)
        //    $(".bottom").removeClass("show");

        last_report_toggle = Date.now();
        report_open = true;
        window.last_tab_open = id;
    }
    $(".report .toggle").click(() => report_open ? hideTabs() : showTab(window.last_tab_open));
    $(".nav li").click(function() {
        let tab = $(this).data("tab");
        if(report_open && window.last_tab_open == tab && window.innerWidth > 540) {
            hideTabs();
        } else {
            showTab(tab);
        }
    });

    // busco el XML y creo la UI del reporte
    function getOne(reg) {
        try{
            let fs = viewer_data.result.filter(x => x.filename.match(reg));
            return fs.length > 0 ? viewer_data.files.filter(x => x.uid === fs[0].file_uid)[0].result : "";
        } catch(ex) {
            console.log(ex);
            return "";
        }
    }
    report(getOne(/\.xml$/), viewer_data.csv_content || getOne(/\.csv$/));
}

export default async () => {
    console.log("Launch");
    console.log(viewer_data);

    init();
    resize();
    await processFiles();
    createUI();
    resize(); // yes, resize twice
    window.addEventListener('resize', resize, false);
    createLights();
    render(0);
    setInterval(resize, 1000); // avoid bugs

    // aca ya renderizamos al menos un frame, hacemos la animación
    $(".status").stop().fadeOut(300);
    $(".renderer").stop().fadeIn(300, function() {
        $(".control-center").click();
        mouthAngle(0, 500);

        $(".bottom").addClass('show');
        $(".controls-top, .controls-bottom").css('display', 'flex');
        setTimeout(() => {
            $(".controls-top, .controls-bottom").addClass('show');
        }, 500);
    });
};