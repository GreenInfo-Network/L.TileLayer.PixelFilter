var MAP, OVERLAY;
function init() {
    var MAP = L.map('map', {
        minZoom:1,
        maxZoom:3,
    }).setView([0,0],1);

    L.tileLayer('http://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
    }).addTo(MAP);

    // the PixelFilter tilelayer
    OVERLAY = L.tileLayerPixelFilter('tiles/{z}/{x}/{y}.png', {
        tms: true, // I used gdal2tiles.py so these tiles use TMS numbering, not WMS-C numbering
        matchRGBA: [ 255,  0,  0, 128 ], // fill in matching pixels with half-opaque pink
        missRGBA:  [ 0, 255, 255, 64 ], // fill in non-matching pixels with blue
    }).addTo(MAP);
}
