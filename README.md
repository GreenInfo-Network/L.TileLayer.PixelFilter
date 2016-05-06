# L.TileLayer.PixelFilter

A Leaflet TileLayer extension which will replace RGB codes in the tiles, so as to give highlighting and masking effects.

For a quick start, check out the demos at http://greeninfo-network.github.io/L.TileLayer.PixelFilter/

# Constructor and Options

Usage is almost exactly like a typical L.TileLayer, except for a few additional options.

    var filtered = L.tileLayerPixelFilter('https://mapbox-or-something/tiles/{z}/{x}/{y}.png', {
        matchRGBA: [ 255,  0,  0, 128 ],
        missRGBA:  [ 0, 0, 0, 0 ],
        pixelCodes: [ [255,0,2] ]
    }).addTo(MAP);

* **pixelCodes** -- Specify which RGB codes you want to match. See *setPixelCodes()* for more details.
* **matchRGBA** -- Specify which color to assign to pixels which *match* your stated pixelCodes. See *setMatchRGBA()* for more details.
* **missRGBA** -- Specify which color to assign to pixels which *do not match* your stated pixelCodes. See *setMissRGBA()* for details.

# Methods

**setPixelCodes([ [r,g,b], [r,g,b], [r,g,b], ... ])**

Define what RGB pixels are considered "matching". The tiles will then be re-evaluated and pixels will be reassigned the new matching or non-matching color based on this new list.

**setMatchRGBA([r,g,b,a])**

Set the RGBA code that will be applied to pixels which are on the provided list.


**setMissRGBA([r,g,b,a])**

Set the RGBA code that will be applied to non-matching pixels.

# Tips

* This sort of RGB-based pixel replacement is best suited for data whose RGB code indicates a discrete classification. JPEG images and photographs may give some interesting effects, but may not.

* When preparing your map tiles be sure to use the *nearest neighbor* resampling algorithm. This causes interpolated pixels to inherit a specific pre-existing RGB code from the nearest pre-existing pixel, rather than attempting to average out the color. Using a resampler that modifies the pixel values will result in pixel values that were not in your original dataset, and which may not match your filtering needs. For example:

        gdalwarp -t_srs esg:3857 -r near input.tif output.tif
        gdal2tiles.py -r near input.tif tiles

