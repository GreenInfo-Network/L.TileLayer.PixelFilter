/*
 * L.TileLayer.PixelFilter
 * https://github.com/greeninfo/L.TileLayer.PixelFilter
 * http://greeninfo-network.github.io/L.TileLayer.PixelFilter/
 *
 * A Leaflet tile layer that intercepts each tile image and rewrites its pixels
 * according to a set of color-matching rules before the tile is ever painted on
 * the map.  The key design constraint is that changing a filter rule must update
 * already-visible tiles instantly and without any new network requests.
 *
 * How it works at a high level
 * ─────────────────────────────
 * 1. createTile() returns a <canvas> element (not the usual <img>).
 *    The source PNG is fetched into an off-DOM Image object.
 * 2. Once the Image loads, the raw RGBA bytes are captured and stored on the
 *    canvas element itself as tile._pixelFilterRaw (a Uint8ClampedArray).
 *    This frozen copy of the original data is kept for the lifetime of the tile.
 * 3. _renderFilteredTile() reads _pixelFilterRaw, applies the current color
 *    rules, and writes the result to the visible canvas.  This can be called
 *    any number of times on the same tile (e.g. when settings change) without
 *    going back to the server.
 * 4. When a filter option changes (setMatchRGBA / setMissRGBA / setPixelCodes),
 *    _refilterVisibleTiles() walks every tile currently in Leaflet's tile cache
 *    and calls _renderFilteredTile() on each one — producing an instant,
 *    flash-free update.
 * 5. When Leaflet evicts a tile, _disposeTile() deletes _pixelFilterRaw to free
 *    the memory.
 *
 * Filter options (passed in the options object or set via the public setters)
 * ───────────────────────────────────────────────────────────────────────────
 *  pixelCodes  — Array of [r,g,b] triplets that define which source colors are
 *                considered a "match".  If the array is empty every pixel matches.
 *  matchRGBA   — [r,g,b,a] to paint over pixels that matched pixelCodes.
 *                null means "leave the original color unchanged".
 *  missRGBA    — [r,g,b,a] to paint over pixels that did NOT match pixelCodes.
 *                null means "leave the original color unchanged".
 */
L.tileLayerPixelFilter = function (url, options) {
    return new L.TileLayer.PixelFilter(url, options);
};

L.TileLayer.PixelFilter = L.TileLayer.extend({

    // ─── Initialization ──────────────────────────────────────────────────────

    initialize: function (url, options) {
        // Merge caller-supplied options with defaults.  crossOrigin must be
        // 'Anonymous' so that getImageData() can read cross-origin tile pixels
        // without the browser throwing a security error.
        options = L.extend({}, L.TileLayer.prototype.options, {
            matchRGBA: null,
            missRGBA: null,
            pixelCodes: [],
            crossOrigin: 'Anonymous',
        }, options);

        L.TileLayer.prototype.initialize.call(this, url, options);

        // _pixelCodeSet is the Set-based lookup structure built from pixelCodes.
        // It is rebuilt whenever pixelCodes changes via _setPixelCodes().
        // Initialise it before calling _setPixelCodes() below.
        this._pixelCodeSet = new Set();

        // Validate and store initial filter values using the private setters.
        // The private setters validate without triggering a repaint (no tiles
        // exist yet) whereas the public setters also call _refilterVisibleTiles.
        this._setMatchRGBA(this.options.matchRGBA);
        this._setMissRGBA(this.options.missRGBA);
        this._setPixelCodes(this.options.pixelCodes);

        // Free the cached raw pixel buffer when Leaflet removes a tile from the
        // DOM (pan away, zoom change, etc.) so memory is not leaked.
        this.on('tileunload', function (event) {
            this._disposeTile(event.tile);
        });
    },

    // ─── Public API ──────────────────────────────────────────────────────────

    // setMatchRGBA / setMissRGBA / setPixelCodes are the public API for changing
    // filter rules at runtime.  Each one updates the stored setting and then
    // immediately repaints all visible tiles without fetching new ones.

    // Set the RGBA color to paint over pixels that match a pixelCode entry.
    // Pass null to leave matching pixels with their original color.
    setMatchRGBA: function (rgba) {
        this._setMatchRGBA(rgba);
        this._refilterVisibleTiles();
        return this;
    },

    // Set the RGBA color to paint over pixels that do NOT match any pixelCode.
    // Pass null to leave non-matching pixels with their original color.
    setMissRGBA: function (rgba) {
        this._setMissRGBA(rgba);
        this._refilterVisibleTiles();
        return this;
    },

    // Replace the list of pixel codes that define a "match".
    // pixelcodes must be an array of [r,g,b] triplets, e.g. [[255,0,0],[0,128,0]].
    // An empty array means every opaque pixel is treated as a match.
    setPixelCodes: function (pixelcodes) {
        this._setPixelCodes(pixelcodes);
        this._refilterVisibleTiles();
        return this;
    },

    // ─── Tile creation ───────────────────────────────────────────────────────

    // Override Leaflet's default createTile() so each tile is a <canvas> element
    // instead of an <img>.  This allows us to write filtered pixels directly to
    // the element that appears on the map, ensuring the raw (unfiltered) image is
    // never visible to the user even for a single frame.
    createTile: function (coords, done) {
        // Create the canvas that will live in the map DOM.
        var tile = L.DomUtil.create('canvas', 'leaflet-tile');
        var size = this.getTileSize();
        tile.width = size.x;
        tile.height = size.y;

        // Fetch the source PNG into an off-DOM Image.  The Image is a temporary
        // object used only to decode the PNG; it is never added to the DOM.
        var image = new Image();

        // Mirror the crossOrigin setting so getImageData() works for tiles served
        // from a different origin (e.g. a tile CDN).
        if (this.options.crossOrigin || this.options.crossOrigin === '') {
            image.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
        }

        image.onload = L.bind(function () {
            try {
                // Snapshot the raw, unfiltered pixels from the decoded Image.
                // Storing them on the tile element means _renderFilteredTile()
                // can repaint the same tile later (when settings change) without
                // another network round-trip.
                tile._pixelFilterRaw = this._captureRawPixels(image, size.x, size.y);

                // Apply the current filter rules and paint the result onto the canvas.
                this._renderFilteredTile(tile);

                // Signal to Leaflet that this tile is ready to display.
                done(null, tile);
            } catch (error) {
                done(error, tile);
            }
        }, this);

        image.onerror = function () {
            done(new Error('L.TileLayer.PixelFilter could not load tile image'), tile);
        };

        // Kick off the network request for the tile PNG.
        image.src = this.getTileUrl(coords);

        // Return the canvas immediately; Leaflet will show it once done() fires.
        return tile;
    },

    // ─── Private setters (validate only, no repaint) ─────────────────────────

    _setMatchRGBA: function (rgba) {
        this._validateRGBA(rgba, 'matchRGBA');
        this.options.matchRGBA = rgba;
    },

    _setMissRGBA: function (rgba) {
        this._validateRGBA(rgba, 'missRGBA');
        this.options.missRGBA = rgba;
    },

    // Shared validation for matchRGBA / missRGBA values.
    // Accepts null (pass-through) or a four-element array of integers 0–255.
    _validateRGBA: function (rgba, name) {
        if (rgba === null) {
            return;
        }
        if (typeof rgba !== 'object' || typeof rgba.length !== 'number' || rgba.length !== 4) {
            throw new Error('L.TileLayer.PixelFilter expected ' + name + ' to be RGBA [r,g,b,a] array or else null');
        }
        for (var i = 0; i < 4; i++) {
            if (typeof rgba[i] !== 'number' || rgba[i] < 0 || rgba[i] > 255 || (rgba[i] % 1 !== 0)) {
                throw new Error('L.TileLayer.PixelFilter expected each channel of ' + name + ' to be an integer in 0–255');
            }
        }
    },

    _setPixelCodes: function (pixelcodes) {
        if (typeof pixelcodes !== 'object' || typeof pixelcodes.length !== 'number') {
            throw new Error('L.TileLayer.PixelFilter expected pixelCodes to be a list of triplets: [ [r,g,b], [r,g,b], ... ]');
        }

        this.options.pixelCodes = pixelcodes;

        // Rebuild the Set from scratch.  Each RGB triplet is converted to a
        // single integer hash so membership tests in the pixel loop are O(1).
        this._pixelCodeSet = new Set();
        for (var i = 0, l = pixelcodes.length; i < l; i++) {
            var triplet = pixelcodes[i];
            if (!Array.isArray(triplet) || triplet.length !== 3 ||
                    typeof triplet[0] !== 'number' || typeof triplet[1] !== 'number' || typeof triplet[2] !== 'number') {
                throw new Error('L.TileLayer.PixelFilter expected each pixelCode entry to be a numeric [r,g,b] triplet');
            }
            this._pixelCodeSet.add(this._pixelCodeHash(triplet[0], triplet[1], triplet[2]));
        }
    },

    // ─── Helpers ─────────────────────────────────────────────────────────────

    // Convert an RGB triplet to a unique integer via bitwise packing.
    // Formula: (R << 16) | (G << 8) | B
    // With R, G, B each in 0–255 the result is a 24-bit integer and no two
    // distinct valid (r,g,b) values can collide.
    _pixelCodeHash: function (r, g, b) {
        return (r << 16) | (g << 8) | b;
    },

    // Retrieve a 2D canvas context, with a graceful fallback for browsers that
    // do not support the willReadFrequently hint introduced in newer specs.
    _getCanvasContext: function (canvas, options) {
        var context = canvas.getContext('2d', options);
        // If the browser rejected the options object, retry without it.
        if (!context && options) {
            context = canvas.getContext('2d');
        }
        if (!context) {
            throw new Error('L.TileLayer.PixelFilter could not get a 2D canvas context');
        }
        return context;
    },

    // Draw the source Image into a temporary off-screen canvas and extract a
    // copy of its raw RGBA bytes as a Uint8ClampedArray.
    // The willReadFrequently hint asks the browser to keep the canvas in CPU
    // memory (not GPU memory) so getImageData() is faster.
    _captureRawPixels: function (image, width, height) {
        var scratchCanvas = document.createElement('canvas');
        scratchCanvas.width = width;
        scratchCanvas.height = height;

        var scratchContext = this._getCanvasContext(scratchCanvas, { willReadFrequently: true });
        scratchContext.drawImage(image, 0, 0, width, height);

        try {
            // Copy the pixel data so the scratch canvas can be garbage-collected.
            return new Uint8ClampedArray(scratchContext.getImageData(0, 0, width, height).data);
        } catch (error) {
            console.error(error);
            throw new Error('L.TileLayer.PixelFilter getImageData() failed. Likely a cross-domain issue?');
        }
    },

    // Read the raw pixel buffer stored on a tile, apply the current filter
    // rules, and paint the result into the tile's visible canvas.
    // This is called both on first load and whenever filter settings change.
    _renderFilteredTile: function (tile) {
        // Guard: nothing to do if the tile has no cached raw pixels yet.
        if (!tile || !tile._pixelFilterRaw) {
            return;
        }

        var width = tile.width;
        var height = tile.height;
        var context = this._getCanvasContext(tile);

        // createImageData allocates a fresh zeroed RGBA buffer for the output.
        var output = context.createImageData(width, height);
        var source = tile._pixelFilterRaw;   // original pixels — never mutated
        var target = output.data;             // output pixels — written below

        // Snapshot option values to avoid repeated property lookups in the loop.
        var pixelCodeSet = this._pixelCodeSet;
        // When pixelCodes is empty every opaque pixel is treated as a match,
        // so missRGBA will never be applied.  Warn if the caller set it anyway.
        var filterByCodes = pixelCodeSet.size > 0;
        var matchRGBA = this.options.matchRGBA;
        var missRGBA = this.options.missRGBA;
        if (!filterByCodes && missRGBA !== null) {
            console.warn('L.TileLayer.PixelFilter: missRGBA is set but pixelCodes is empty — missRGBA has no effect because every opaque pixel is treated as a match.');
        }

        // Iterate over every pixel (4 bytes each: R, G, B, A).
        for (var i = 0, n = source.length; i < n; i += 4) {
            var r = source[i];
            var g = source[i + 1];
            var b = source[i + 2];
            var a = source[i + 3];

            // Fully transparent pixels are nodata / outside the dataset boundary.
            // Keep them transparent regardless of any filter setting.
            // target[] is already zeroed by createImageData, so no assignment needed.
            if (a === 0) {
                continue;
            }

            // Determine whether this pixel's color is in the pixelCodes list.
            // When no codes are configured (filterByCodes === false) every pixel
            // is considered a match, so matchRGBA applies universally.
            var match = true;
            if (filterByCodes) {
                match = pixelCodeSet.has(this._pixelCodeHash(r, g, b));
            }

            // Choose the output color for this pixel.
            // A null RGBA option means "pass through the original channel value".
            var rgba = match ? matchRGBA : missRGBA;
            target[i]     = rgba === null ? r : rgba[0];
            target[i + 1] = rgba === null ? g : rgba[1];
            target[i + 2] = rgba === null ? b : rgba[2];
            target[i + 3] = rgba === null ? a : rgba[3];
        }

        // Commit the filtered pixel buffer to the visible canvas.
        context.putImageData(output, 0, 0);
    },

    // Walk every tile currently tracked by Leaflet and repaint it with the
    // current filter settings.  Called after any filter option changes so
    // visible tiles update immediately without reloading from the server.
    _refilterVisibleTiles: function () {
        if (!this._tiles) {
            return;
        }

        for (var key in this._tiles) {
            // Skip inherited properties from the prototype chain.
            if (!Object.prototype.hasOwnProperty.call(this._tiles, key)) {
                continue;
            }

            var tileRecord = this._tiles[key];
            if (tileRecord && tileRecord.el) {
                this._renderFilteredTile(tileRecord.el);
            }
        }
    },

    // Delete the cached raw pixel buffer from a tile when Leaflet evicts it.
    // Without this, the Uint8ClampedArray (up to ~768 KB per 256×256 tile at
    // 4 bytes/pixel) would stay in memory long after the tile left the screen.
    _disposeTile: function (tile) {
        if (!tile) {
            return;
        }
        delete tile._pixelFilterRaw;
    }
});
