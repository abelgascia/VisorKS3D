import $ from "jquery";
import prettyBytes from 'pretty-bytes';

let names_uploaded = [];
let files = [];
let pending_uploads = 0;
let is_submitting = false;

function update() {
    // $("input").prop('disabled', is_submitting);
    $("#submit").prop("disabled", is_submitting || pending_uploads !== 0 || files.length === 0);
    $("#done-files").text(files.length);
    $("#total-files").text(names_uploaded.length);
}

function uploadFile(file) {
    if(is_submitting)
        return;
    
    let file_container = $(`
        <tr>
            <td class="filename" title="${file.name}">${file.name}</td>
            <td class="filesize">${prettyBytes(file.size || 0)}</td>
            <td class="progress processing">-</td>
        </tr>
    `);
    $(".files-title, .files-list-container").show(200);
    $(".files-list tbody").prepend(file_container);

    let progress_element = file_container.find('.progress');

    function download() {
        var fd = new FormData();
        fd.append("file", file);

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/panel/upload/file", true);

        xhr.upload.onprogress = function(e) {
            var percentComplete = Math.ceil((e.loaded / e.total) * 100);
            progress_element.html(`<i class="fas fa-spinner fa-spin"></i> ${percentComplete} %`);
        };
        xhr.onload = function() {
            if(this.status == 200) {
                progress_element.addClass("success").html(`<i class="fas fa-check-circle"></i>`);
                files.push(this.responseText);
            } else {
                progress_element.addClass("failure").html(`<i class="fas fa-times"></i>`);

                let retry_element = $(`<button class="retry"><i class="fas fa-sync"></i></button>`);
                retry_element.on('click', function() {
                    progress_element.removeClass("failure").html(`-`);
                    download();
                });
                progress_element.append(retry_element);
            }
            pending_uploads--;
            update();
        };

        pending_uploads++;
        xhr.send(fd);
        update();
    }
    download();
}

function processFiles(files) {
    for(let file of files) {
        if(!file.name.toLowerCase().match(/\.(stl|wrl|jpg|xml|csv)$/i)) {
            console.log("Skipping file with invalid extension", file.name);
            continue;
        }
        if(names_uploaded.includes(file.name))
            continue;
        names_uploaded.push(file.name);
        uploadFile(file);
    }
}

function submit() {
    is_submitting = true;
    update();

    var fd = new FormData();
    fd.append("files", JSON.stringify(files));
    $('.data input, .data select').each(function(i, input) {
        fd.append($(input).attr("name"), $(input).val());
    });

    var xhr = new XMLHttpRequest();
    xhr.open("POST", "/panel/upload/submit", true);
    // xhr.timeout = 30000;

    function fail() {
        alert("La carga falló, vuelva a intentarlo.");
        is_submitting = false;
        update();
    }
    
    xhr.onload = function() {
        if(this.status == 200) {
            window.location = `/panel/${this.responseText}`;
        } else {
            fail();
        }
    };
    xhr.ontimeout = fail;

    xhr.send(fd);
}

let drop_area = $(".drop-area");

drop_area.on('drag dragstart dragend dragover dragenter dragleave drop', function(e) {
    e.preventDefault();
    e.stopPropagation();
})
.on('dragover dragenter', function() {
    drop_area.addClass('is-dropping');
})
.on('dragleave dragend drop', function() {
    drop_area.removeClass('is-dropping');
})
.on('click', function(e) {
    $('#file-input').trigger('click');
})
.on('drop', function(e) {
    processFiles(e.originalEvent.dataTransfer.files);
});
$('#file-input').on('change', function() {
    processFiles($(this).prop('files'));
});
$("#submit").on('click', submit);

update();