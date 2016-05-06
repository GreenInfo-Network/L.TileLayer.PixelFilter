var OVERLAY1;
function init1() {
    var MAP = L.map('map1', {
        minZoom:1,
        maxZoom:3,
    }).setView([0,0],1);

    L.tileLayer('http://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
    }).addTo(MAP);

    // the PixelFilter tilelayer
    OVERLAY1 = L.tileLayerPixelFilter('tiles/{z}/{x}/{y}.png', {
        tms: true, // I used gdal2tiles.py so these tiles use TMS numbering, not WMS-c numbering
        matchRGBA: [ 255,  0,  0, 128 ], // fill in matching pixels with this color & opacity
        missRGBA:  [ 0, 0, 0, 0 ], // fill non-matching pixels with this color & opacity
        //missRGBA:  [ 0, 255, 255, 64 ], // this version would fill non-matching with blue nistead of transparency
    }).addTo(MAP);
}


var OVERLAY2;
function init2() {
    var MAP = L.map('map2', {
        minZoom:1,
        maxZoom:3,
    }).setView([0,0],1);

    /*
    L.tileLayer('http://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
    }).addTo(MAP);
    */

    // the same map tiles as the PixelFilter layer below, but just a plain TileLayer without any filtering
    // the idea is that the fiiltered pixels will act as a mask
    L.tileLayer('tiles/{z}/{x}/{y}.png', {
        tms: true, // I used gdal2tiles.py so these tiles use TMS numbering, not WMS-c numbering
    }).addTo(MAP);

    // the PixelFilter tilelayer
    OVERLAY2 = L.tileLayerPixelFilter('tiles/{z}/{x}/{y}.png', {
        tms: true, // I used gdal2tiles.py so these tiles use TMS numbering, not WMS-c numbering
        matchRGBA: [ 0,  0,  0, 0 ], // fill in matching pixels with this color & opacity
        missRGBA:  [ 255, 255, 255, 255 ], // fill non-matching pixels with this color & opacity 
    }).addTo(MAP);
}
