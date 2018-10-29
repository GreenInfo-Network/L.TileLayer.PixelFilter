var MAP, OVERLAY;
function init() {
    var MAP = L.map('map', {
        minZoom:1,
        maxZoom:8,
    }).setView([39.8283,-98.5795],3);

    // the PixelFilter tilelayer
    OVERLAY = L.tileLayerPixelFilter('tiles/{z}/{x}/{y}.png', {
        tms: true, // I used gdal2tiles.py so these tiles use TMS numbering, not WMS-c numbering
        matchRGBA: null, // preserve whatever color was in the pixel previously
        missRGBA:  [ 255, 255, 255, 255 ], // fill non-matching pixels with solid white
    }).addTo(MAP);
}
