var MAP, OVERLAY;
function init() {
    var MAP = L.map('map', {
        minZoom:1,
        maxZoom:3,
    }).setView([0,0],1);

    // the PixelFilter tilelayer
    OVERLAY = L.tileLayerPixelFilter('tiles/{z}/{x}/{y}.png', {
        tms: true, // I used gdal2tiles.py so these tiles use TMS numbering, not WMS-c numbering
        matchRGBA: null, // preserve whatever color was in the pixel previously
        missRGBA:  [ 255, 255, 255, 255 ], // fill non-matching pixels with solid white
    }).addTo(MAP);
}
