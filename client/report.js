import $ from "jquery";
import { parse } from 'fast-xml-parser';

export default (report_xml, report_csv) => {
    let input = parse(report_xml);
    let csv_lines = report_csv.split("\n");
    let result = { };

    console.log("Reporte", input, csv_lines);
    console.log('INPUT: ', input)
    console.log('CSV_LINES: ', csv_lines)
    
    function noData(tab_div) {
        tab_div.append(`
            <div class="no-data">No hay datos</div>
        `);
    }
    function extract(record, options) {
        for(let key of options)
            if(key in record)
                return record[key];
        return null;
    }
    function extractNum(record, options) {
        return parseFloat(extract(record, options) || 0);
    }
    function groupBy(arr, prop) {
        const map = new Map(Array.from(arr, obj => [obj[prop], []]));
        arr.forEach(obj => map.get(obj[prop]).push(obj));
        return Array.from(map.values());
    }
    function formatNumber(num) {
        return num.toFixed(2);
    }
    
    let bolton_tab = $(".tab[data-tab=bolton]");
    let espacio_tab = $(".tab[data-tab=espacio]");
    let teeth_movement_tab = $(".tab[data-tab=teeth-movement]");
    let tooth_width_tab = $(".tab[data-tab=tooth-width]");
    let arco_ideal_tab = $(".tab[data-tab=arco-ideal]");
    let botones_tab = $(".tab[data-tab=botones]");
    let stripping_tab = $(".tab[data-tab=stripping]");

    if(!input.Database)
        input = { Database: { } };

    let one_ok = false;

    if(input.Database.Bolton_analysis) {
        function createBoltonPanel(kind, records) {
            const OPTS_MAXI = [`${kind}RMaxillaryRWidth`, `${kind}RMaxillaryRWdth`];
            const OPTS_MAND = [`${kind}RMandibularRWidth`];
            const OPTS_RATIO = [`${kind}RRatio`];
    
            let total_max_width = 0;
            let total_man_width = 0;
            for(let record of records) {
                total_max_width += extractNum(record, OPTS_MAXI);
                total_man_width += extractNum(record, OPTS_MAND);
            }

            bolton_tab.append(`
            <div class="title">${kind} Bolton</div>
            <br>
            <div class="box">
                <table class="simple-table">
                    <tbody>
                        <tr><th>Ancho maxilar 6:</th><td>${formatNumber(total_max_width / records.length)}</td></tr>
                        <tr><th>Ancho mandibular 6:</th><td>${formatNumber(total_man_width / records.length)}</td></tr>
                        <tr><th>Radio:</th><td>${formatNumber(total_man_width / total_max_width)}</td></tr>
                    </tbody>
                </table>
            </div>
            <br>
            <table class="formatted-table">
                <thead>
                    <tr>
                        <th>Maxilar 6</th>
                        <th>Mandib. 6</th>
                        <th>Radio</th>
                    </tr>
                </thead>
                <tbody>
                    ${records.map(record => `
                        <tr>
                            <td>${formatNumber(extractNum(record, OPTS_MAXI))}</td>
                            <td>${formatNumber(extractNum(record, OPTS_MAND))}</td>
                            <td>${formatNumber(extractNum(record, OPTS_RATIO))}</td>
                        </tr>
                    `).join('\n')}
                </tbody>
            </table>
            <br>
            `);
        }

        one_ok = true;
        let records = Object.values(input.Database.Bolton_analysis);
        createBoltonPanel("Anterior", records);
        createBoltonPanel("OverAll", records);
        window.last_tab_open = "bolton";
    } else {
        noData(bolton_tab);
        $("li[data-tab=bolton]").remove();
    }

    if(input.Database.Space_analysis) {
        function createSpacePanel(kind, title, record) {
            espacio_tab.append(`
            <div class="title">${title}</div>
            <br>
            <div class="box">
                <table class="simple-table">
                    <tbody>
                        <tr><td>Espacio total disponible:</td><td style="text-align:center">${formatNumber(extractNum(record, [`${kind}RTotalRSpaceAailable`]))}</td></tr>
                        <tr><td>Suma de anchos de los incisivos:</td><td style="text-align:center">${formatNumber(extractNum(record, [`${kind}RIncisorWidths`]))}</td></tr>
                    </tbody>
                </table>
                <br>
                <div class="subtitle">Moyer</div>
                <table class="simple-table">
                    <tbody>
                        <tr><td>Suma de caninos izquierdos y premolares:</td><td>${formatNumber(extractNum(record, [`${kind}RMoyersRLeftCaninePremolars`]))}</td></tr>
                        <tr><td>Suma de caninos derechos y premolares:</td><td>${formatNumber(extractNum(record, [`${kind}RMoyersRRightCaninePremolars`]))}</td></tr>
                        <tr><td>Espacio total requerido:</td><td>${formatNumber(extractNum(record, [`${kind}RMoyersRTotalSpaceRequired`]))}</td></tr>
                        <tr><td>Discrepancia:</td><td>${formatNumber(extractNum(record, [`${kind}RMoyersRDiscrepancy`]))}</td></tr>
                    </tbody>
                </table>
                <br>
                <div class="subtitle">Tanaka & Johnston</div>
                <table class="simple-table">
                    <tbody>
                        <tr><td>Suma de caninos izquierdos y premolares:</td><td>${formatNumber(extractNum(record, [`${kind}RTanJonsRLeftCaninePremolars`]))}</td></tr>
                        <tr><td>Suma de caninos derechos y premolares:</td><td>${formatNumber(extractNum(record, [`${kind}RTanJonsRRightCaninePremolars`]))}</td></tr>
                        <tr><td>Espacio total requerido:</td><td>${formatNumber(extractNum(record, [`${kind}RTanJonsRTotalSpaceRequired`]))}</td></tr>
                        <tr><td>Discrepancia:</td><td>${formatNumber(extractNum(record, [`${kind}RTanJonsRDiscrepancy`]))}</td></tr>
                    </tbody>
                </table>
            </div>
            <br>
            `);
        }

        let records = Object.values(input.Database.Space_analysis);
        if(records.length > 0) {
            one_ok = true;
            createSpacePanel("Max", "Análisis Espacio Maxilar", records[0]);
            createSpacePanel("Man", "Análisis Espacio Mandibular", records[0]);
            window.last_tab_open = "espacio";
        } else
            noData(espacio_tab);
    } else {
        noData(espacio_tab);
        $("li[data-tab=espacio]").remove();
    }

    if(input.Database.TeethMovement) {
        let records = Object.values(input.Database.TeethMovement);
        if(records.length > 0) {
            one_ok = true;

            let steps_list = $(`<ul class="steps-list"></ul>`);
            teeth_movement_tab.append(steps_list);

            function createAlignerTable(number, aligner_records) {
                steps_list.append(`
                    <li class="circle" data-teeth-movement-index="${number}">${number}</li>
                `);
                teeth_movement_tab.append(`
                <div class="box" data-teeth-movement-index="${number}">
                    <div class="title">Alineador ${number}</div>
                    <div class="table-scroll">
                        <table class="formatted-table">
                            <thead>
                                <tr>
                                    <th>Tooth Number</th>
                                    <th>Rotación</th>
                                    <th>Angulación</th>
                                    <th>Inclinación</th>
                                    <th>Derecha / Izquierda</th>
                                    <th>Extrusión / Intrusión</th>
                                    <th>Forward / Backward</th>
                                </tr>
                            </thead>
                            <tbody>
                            ${aligner_records.map(record => `
                                <tr>
                                    <td>${extract(record, [`ToothRNumber`])}</td>
                                    <td>${extract(record, [`Rotation`])}</td>
                                    <td>${extract(record, [`Angulation`])}</td>
                                    <td>${extract(record, [`Inclination`])}</td>
                                    <td>${extract(record, [`LeftRRight`])}</td>
                                    <td>${extract(record, [`ExtrusionRIntrusion`])}</td>
                                    <td>${extract(record, [`ForwardRBackward`])}</td>
                                </tr>
                            `).join('\n')}
                            </tbody>
                        </table>
                    </div>
                </div>
                `);
            }

            // Los registros estan todos seguidos, hay que agruparlos por CaptionRSetupRName
            let aligners = groupBy(records, "CaptionRSetupRName").filter(x => x.length > 1);

            for(let i = 0; i < aligners.length; i++)
                createAlignerTable(i+1, aligners[i]);
            
            $("li[data-teeth-movement-index]").click(function() {
                let index = $(this).data("teeth-movement-index");
                $(".box[data-teeth-movement-index]").removeClass("visible");
                $(`.box[data-teeth-movement-index=${index}]`).addClass("visible");
                $("li[data-teeth-movement-index]").removeClass("active");
                $(`li[data-teeth-movement-index=${index}]`).addClass("active");
            });
            $("li[data-teeth-movement-index]:first").click(); // open first
            window.last_tab_open = "teeth-movement";
        } else
            noData(teeth_movement_tab);
    } else {
        noData(teeth_movement_tab);
        $("li[data-tab=teeth-movement]").remove();
    }

    if(csv_lines.length >= 40) {
        one_ok = true;

        let tables_cont = $(`<div class="stripping-boxes"></div>`);

        function createStrippingTable(kind, first_row, num_rows, num_cols) {
            let rows = [];
            for(let i = first_row; i < first_row + num_rows + 1; i++) {
                let csv_line = csv_lines[i].split(";");
                let row = [];
                for(let c = 0; c < num_cols; c++) {
                    if(c < csv_line.length) {
                        row.push(`<td>${csv_line[c]}</td>`);
                    }
                }
                rows.push(`<tr>${row.join("")}</tr>`);
            }
            tables_cont.append(`
            <div class="box">
                <div class="part-img part-img-${kind}"></div>
                <table class="colored-table">
                    <thead>
                        ${rows[0]}
                    </thead>
                    <tbody>
                        ${rows.slice(1).join("")}
                    </tbody>
                </table>
            </div>
            `);
        }

        createStrippingTable('superior', 5, 15, 3);
        createStrippingTable('inferior', 22, 15, 3);

        stripping_tab.append(`
            <div class="title">Stripping</div>
        `, tables_cont, `
            <div class="small-notice">El desgaste es <strong>siempre 0,1 mm</strong> por vez</div>
        `);
        window.last_tab_open = "stripping";
    } else {
        noData(stripping_tab);
        $("li[data-tab=stripping]").remove();
    }

    if(csv_lines.length >= 58) {
        one_ok = true;

        console.log('ULTIMO DATO DEL CSV ', csv_lines[csv_lines.length - 1])
        console.log('ANTEULTIMO DATO DEL CSV ', csv_lines[csv_lines.length - 2])
        console.log('ANTE ANTEULTIMO DATO DEL CSV ', csv_lines[csv_lines.length - 3])

        const MARKS_OFFSETS_TOP = [
            3.8,
            10.5,
            17.5,
            24.2,
            29,
            34.3,
            39.6,
            45,
            51,
            56.2,
            61.5,
            67,
            71.7,
            78.1,
            85.5,
            92
        ];
        const MARKS_OFFSETS_BOTTOM = [
            4.6,
            12,
            19.5,
            26.4,
            31.7,
            37,
            41.7,
            45.8,
            50,
            54.2,
            58.8,
            64.2,
            69.4,
            76.4,
            83.8,
            91.2
        ];

        let box_cont = $(`
        <div class="box" style="padding-left: 0;padding-right: 0;">
            <div class="title">Botones-Attachments</div>
        </div>
        `);
        function createDiagram(kind, header_line) {
            let botones_cont = $(`<div class="botones botones-${kind}"></div>`)
            

            // botones_cont = kind === 'temporal-bucal' || kind === 'temporal-lingual' 
            // ? $(`<div class="botones botones-${kind} hidden"></div>`)
            // : $(`<div class="botones botones-${kind}"></div>`)

            function generateMarks(marks_line, top, offsets, position) {
                let marks_data = csv_lines[marks_line].split(";");

                for(let i = 0; i < 16; i++) {
                    let first_half = i <= 7;
                    let mark_index = 3 + i;
                    if(mark_index < marks_data.length && marks_data[mark_index].length < 5) {
                        let mark = marks_data[mark_index].toUpperCase();
                        let left = offsets[i] + "%";

                        switch(mark) {
                            case "RM":
                                mark = first_half ? "R-RIGHT" : "R-LEFT";
                            break;
                            case "RD":
                                mark = first_half ? "R-LEFT" : "R-RIGHT";
                            break;
                        }

                        botones_cont.append(`
                            <div class="mark mark-${mark} ${mark === "EI" && position === 'bottom' ? "rot180" : ''}" data-idx="${mark_index}" style="top:${top};left:${left}"></div>
                        `);
                    }
                }
            }

            

            generateMarks(header_line + 3, '13.5%', MARKS_OFFSETS_TOP, 'top');
            generateMarks(header_line + 6, '79%', MARKS_OFFSETS_BOTTOM, 'bottom');

            kind === 'temporal-bucal' || kind === 'temporal-lingual'
            ? box_cont.append($(`<ddiv class="botones-cont hidden"></div>`).append(botones_cont))
            : box_cont.append($(`<ddiv class="botones-cont"></div>`).append(botones_cont))
        }

        console.log('CSV LINES 41 ', csv_lines[41])
        console.log('CSV LINES 49 ', csv_lines[49])
        
        createDiagram('bucal', 41);
        createDiagram('lingual', 49);

        // KIDS ADAPTATION

        createDiagram('temporal-bucal', 41)
        createDiagram('temporal-lingual', 49)

        // KIDS ADAPTATION


        box_cont.append(`
            <div class="small-notice">*La ubicación de los botones es de carácter ilustrativo</div>
            <div class="title">Referencias</div>
            <div class="references">
                <div class="item">
                    <div class="mark mark-T"></div>
                    <span>Tip</span>
                </div>
                <div class="item">
                    <div class="mark mark-M"></div>
                    <span>Molar</span>
                </div>
                <div class="item">
                    <div class="mark mark-R-RIGHT"></div>
                    <span>Rotar</span>
                </div>
                <div class="item">
                    <div class="mark mark-EI"></div>
                    <span>Extruir-Intruir</span>
                </div>
                <div class="item">
                    <div class="mark mark-DT"></div>
                    <span>Doble Tip</span>
                </div>
                <div class="item">
                    <div class="mark mark-BP"></div>
                    <span>Barra de Presión</span>
                </div>
                <div class="item">
                    <div class="mark mark-EX"></div>
                    <span>Extracción</span>
                </div>
                <div class="item">
                    <div class="mark mark-A"></div>
                    <span>Ausente</span>
                </div>
            </div>
            </div>
        `)

        botones_tab.append(box_cont);
        window.last_tab_open = "botones";
    } else {
        noData(botones_tab);
        $("li[data-tab=botones]").remove();
    }

    noData(tooth_width_tab);
    $("li[data-tab=tooth-width]").remove();
    noData(arco_ideal_tab);
    $("li[data-tab=arco-ideal]").remove();

    if(one_ok) {
        $(".report").addClass("ready");
        $(".viewer").addClass("report-ready");
    } else {
        $(".report-cont").remove();
    }

    return result;
};



const MARKS_TEMPORALS_OFFSETS_TOP = [
    17.5,
    25.5,
    33,
    39,
    45,
    50.5,
    56.5,
    62.5,
    70,
    77.5,
];

const MARKS_TEMPORALS_OFFSETS_BOTTOM = [
    20.5,
    28.5,
    35.5,
    41,
    45.5,
    49.5,
    54,
    59.5,
    66.5,
    74,
];