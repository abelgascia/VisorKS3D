const path = require('path');
const fs = require('fs');
const debug = require('debug')("Model Loader");

/*
    https://en.wikipedia.org/wiki/STL_(file_format)

    Ver sección Binary STL:

    UINT8[80] – Header
    UINT32 – Number of triangles

    foreach triangle
    REAL32[3] – Normal vector
    REAL32[3] – Vertex 1
    REAL32[3] – Vertex 2
    REAL32[3] – Vertex 3
    UINT16 – Attribute byte count
    end
*/
const readBinarySTL = (stl_filepath) => {
    debug("Reading binary STL", stl_filepath);

    const buffer = fs.readFileSync(stl_filepath);

    if(buffer.byteLength < 84)
        throw new Error("File is corrupted");

    let offset = 80; // 80 mide el header
    let number_of_triangles = buffer.readUInt32LE(offset); offset += 4;

    const parseVector = () => {
        let vec = [
            buffer.readFloatLE(offset + 0),
            buffer.readFloatLE(offset + 4),
            buffer.readFloatLE(offset + 8)
        ];
        offset += 12; // 4 * 3
        return vec;
    };

    if(buffer.byteLength < offset + number_of_triangles * (12 * 4 + 2))
        throw new Error("File is corrupted");
    
    let coords = [];
    let vertices = [];
    let indices = [];

    function findOrInsert(point) {
        for(let i = Math.max(0, vertices.length - 1000); i < vertices.length; i++) {
            if(vertices[i][0] == point[0] &&
               vertices[i][1] == point[1] &&
               vertices[i][2] == point[2])
               return i;
        }
        vertices.push(point);
        coords.push(point[0], point[1], point[2]);
        return vertices.length - 1;
    }
    
    for(let i = 0; i < number_of_triangles; i++) {
        // no uso la normal ya que prefiero calcularla a mano
        // el VRML no trae la información de la normal así que
        // iba a tener que calcularla de todas maneras
        let normal = parseVector();
        let points = [parseVector(), parseVector(), parseVector()];

        indices.push(
            findOrInsert(points[0]),
            findOrInsert(points[1]),
            findOrInsert(points[2])
        );

        let attribute_byte_count = buffer.readUInt16LE(offset); offset += 2;
        // TODO:
        //   ver si attribute_by_count no es 0
        //   todos los ejemplos que vi son 0
        //   podría haber información de color
        //   en algunos se ve que hay, pero es full blanco
        //   lo ignoro
        // if(attribute_byte_count != 0) debug("DETECTED NON ZERO");
    }

    // debug("Found", number_of_triangles, "tris and", vertices.length, "vertices");
    // debug("Optimized from", number_of_triangles * 9, "coords to", coords.length);

    return {
        texture: null,
        coords: coords,
        uv_coords: null,
        indexes: indices
    };
};

/*
    http://gun.teipir.gr/VRML-amgem/spec/vrmlspec.pdf (oficial, 1996)
    http://www.geocities.ws/daraujo14/vrml_araujo.pdf (en español)
    http://web.mit.edu/ivlib/www/iv/files.html (open inventor file format)

    Nota: notar que no hay coma entre UVs y coords
    Nota: notar que hay un -1 (opcional) entre cada cara

    Ejemplo:
    #VRML V2.0 utf8

    DEF FacetModel Shape {
      appearance Appearance {
        material Material {
          // otro datos generales
          ...
        }
        texture ImageTexture {
          url [ "*********.JPG" ]
        }
      }
      geometry IndexedFaceSet {
        coord Coordinate {
          point [
            x, y, z
            x, y ,z
          ]
        }
        coordIndex [
          a, b, c, -1, ...
        ]
        texCoord TextureCoordinate {
          point [
            u, v
            u, v
          ]
        }
      }
    }
*/
const readVRML = (wrl_filepath) => {
    debug("Reading VRML", wrl_filepath);
    
    let content = fs.readFileSync(wrl_filepath, { encoding: 'utf-8' });

    // check format VRML 2.0
    const IDENTIFIER = "#VRML V2.0 utf8";
    if(!content.startsWith(IDENTIFIER))
        throw new Error("File is corrupted or VRML version mismatch");

    content = content
        .substr(IDENTIFIER.length) // remove header
        .split(/\r?\n\r?/) // split by newlines
        .map(line => line.split("#")[0].trim()) // strip comments & trim lines
        .filter(line => line.length) // strip empty lines
        // .map(line => line.split('"').map((v,i) => i % 2 ? v : v.replace(/\s\s+/g, ' ')).join('"')) // remove more than 1 whitespace (outside quotes)
        .join(' '); // join into one line

    const TEXTURE_PATTERN = /ImageTexture\s*{\s*url\s*\[\s*"(.*?)"\s*\]/g;
    const COORDS_PATTERN = /coord\s*Coordinate\s*{\s*point\s*\[\s*(.*?)\s*\]\s*}/g;
    const UV_COORDS_PATTERN = /texCoord\s*TextureCoordinate\s*{\s*point\s*\[\s*(.*?)\s*\]\s*}/g;
    const INDEXES_PATTERN = /coordIndex\s*\[\s*(.*?)\s*\]/g;

    let texture_match = TEXTURE_PATTERN.exec(content);
    let coords_match = COORDS_PATTERN.exec(content);
    let uv_coords_match = UV_COORDS_PATTERN.exec(content);
    let indexes_match = INDEXES_PATTERN.exec(content);

    if(coords_match === null || indexes_match === null)
        throw new Error("File is corrupted, no coords or indices found");
    if(!uv_coords_match !== !texture_match)
        throw new Error("File is corrupted, not found matching UVs / texture coords");

    const readFloatStrip = (input) => {
        return input === null ? null : input.replace(',', ' ').trim().replace(/\s\s+/g, ' ').split(' ').map(x => parseFloat(x));
    };

    let texture = texture_match ? texture_match[1] : null;
    let coords = readFloatStrip(coords_match[1]);
    let uv_coords = uv_coords_match ? readFloatStrip(uv_coords_match[1]) : null;
    let indexes = readFloatStrip(indexes_match[1]).filter(x => x !== -1); // hay -1 que delimitan las caras, asumo triangulos

    return {
        texture,
        coords,
        uv_coords,
        indexes
    };
};

const DATA_TYPES = {
    NONE: 0,
    POSITIONS: 1,
    UV_COORDS: 2,
    INDEXES_16: 3,
    INDEXES_32: 4
};

const generateModelFile = (model) => {
    let buf_size = 0;
    // coords
    buf_size += 1 + 4;
    buf_size += 4 * model.coords.length;
    // uv coords
    if(model.uv_coords) {
        buf_size += 1 + 4;
        buf_size += 4 * model.uv_coords.length;
    }
    // indexes
    let indexes_size = model.coords.length > 65500 ? 4 : 2;
    buf_size += 1 + 4;
    buf_size += indexes_size * model.indexes.length;

    let buffer = Buffer.alloc(buf_size);
    let offset = 0;

    const writeArr = (type, arr, writeFunc) => {
        offset = buffer.writeUInt8(type, offset);
        offset = buffer.writeUInt32LE(arr.length, offset);
        for(let val of arr)
            offset = buffer[writeFunc](val, offset);
    };

    writeArr(DATA_TYPES.POSITIONS, model.coords, 'writeFloatLE');
    if(model.uv_coords)
        writeArr(DATA_TYPES.UV_COORDS, model.uv_coords, 'writeFloatLE');
    writeArr(
        indexes_size === 2 ? DATA_TYPES.INDEXES_16 : DATA_TYPES.INDEXES_32,
        model.indexes,
        indexes_size === 2 ? 'writeUInt16LE' : 'writeUInt32LE'
    );

    return buffer;
};

module.exports = {
    readBinarySTL,
    readVRML,
    generateModelFile
};