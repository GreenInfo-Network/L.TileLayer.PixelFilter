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
        tms: true, // I used gdal2tiles.py so these tiles use TMS numbering, not WMS-C numbering
        matchRGBA: [ 255,  0,  0, 128 ], // fill in matching pixels with half-opaque pink
        missRGBA:  [ 0, 255, 255, 64 ], // fill in non-matching pixels with blue
    }).addTo(MAP);
}


var OVERLAY2;
function init2() {
    var MAP = L.map('map2', {
        minZoom:1,
        maxZoom:3,
    }).setView([0,0],1);

    // the PixelFilter tilelayer
    OVERLAY2 = L.tileLayerPixelFilter('tiles/{z}/{x}/{y}.png', {
        tms: true, // I used gdal2tiles.py so these tiles use TMS numbering, not WMS-c numbering
        matchRGBA: null, // preserve whatever color was in the pixel previously
        missRGBA:  [ 255, 255, 255, 255 ], // fill non-matching pixels with solid white
    }).addTo(MAP);
}
