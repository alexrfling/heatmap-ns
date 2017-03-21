class Heatmap extends Widget {

    constructor (id) {
        super(id, {
            SVG_MARGINS: {
                top: 10,
                bottom: 10,
                left: 10,
                right: 10
            },
            ANIM_DURATION: 1200,
            ANNO_TITLE_OFFSET: 7,
            AXIS_OFFSET: 5,
            DEFAULT_HEIGHT: 400,
            FONT_SIZE: 9,
            FONT_SIZE_CK: 11,
            SIDE_COLOR_OFFSET: 3
        });
    }

    initializeVis (datasetFile, options) {
        var me = this;
        options = (options || {});

        me.dataset = me.parseDataset(datasetFile, options.parsed);
        me.colClustOrder = options.colClustOrder;
        me.rowClustOrder = options.rowClustOrder;
        me.renderOnBrushEnd = options.renderOnBrushEnd;
        me.categorical = options.categorical;
        me.bucketDividers = (options.bucketDividers || [25, 50, 100, 500]);
        me.bucketColors = (options.bucketColors || ['red', 'orange', 'yellow', 'gray', 'cornflowerblue']);
        me.lowColor = (options.lowColor || 'cornflowerblue');
        me.midColor = (options.midColor || 'black');
        me.highColor = (options.highColor || 'orange');
        me.numColors = (options.numColors || 256);
        me.heatmapColors = interpolateColors(me.lowColor, me.midColor, me.highColor, me.numColors);

        // clear out DOM elements inside parent
        me.destroy();

        // holds all HTML and SVG elements
        me.container = new SVGContainer(
            me.id,
            'heatmap',
            'heatmapSVG',
            function () { me.resize.call(me); },
            me.options.SVG_MARGINS,
            (options.height || me.options.DEFAULT_HEIGHT)
        );

        // the 'dims' hold all elements relevant to the columns and rows of the
        // data, separately
        var col = me.col = {};
        var row = me.row = {};

        col.stats = me.dataset.stats.col;
        row.stats = me.dataset.stats.row;
        col.clustOrder = (me.colClustOrder || me.dataset.colnames);
        row.clustOrder = (me.rowClustOrder || me.dataset.rownames);
        col.names = (me.colClustOrder || me.dataset.colnames);
        row.names = (me.rowClustOrder || me.dataset.rownames);
        col.catScheme = (options.colCatScheme || 'rainbow');
        col.conScheme = (options.colConScheme || 'rainbow');
        col.annoHeatScheme = (options.colAnnoHeatScheme || 'plasma');
        row.catScheme = (options.rowCatScheme || 'google');
        row.conScheme = (options.rowConScheme || 'cubehelix');
        row.annoHeatScheme = (options.rowAnnoHeatScheme || 'magma');
        col.annotated = (options.colAnnoFile ? true : false);
        row.annotated = (options.rowAnnoFile ? true : false);

        annoSetup(col, options.colAnnoFile);
        annoSetup(row, options.rowAnnoFile);

        function annoSetup (dim, annoFile) {
            if (!dim.annotated) {
                return;
            }

            var annosParsed = me.parseAnnotations(annoFile);
            dim.annotations = annosParsed.annotations;
            dim.labelsAnnotated = annosParsed.labels;
            me.colorsSetup(dim);
        }

        //----------------------------------------------------------------------
        //                              REFERENCES BY DIM
        //
        // Note that the row and col objects are mirror images of each other;
        // every field that col has, row also has, and vice-versa. They could be
        // made into objects of the same new class, but its much easier to just
        // build them as we go along and think of them more as growing lists
        // containing everything that's relevant to their respective dimension.
        //
        // For example, when we zoom and pan using the brush for the columns,
        // the only things that need to get visually updated are:
        //		* column labels
        //		* x-coordinates of the heatmap cells
        //		* widths of the heatmap cells
        //		* x-coordinates of the column side colors
        //		* heights of the column side colors
        // Similarly, when doing the same thing to the rows, we need only be
        // concerned with updating:
        //		* row labels
        //		* y-coordinates of the heatmap cells
        //		* heights of the heatmap cells
        //		* y-coordinates of the row side colors
        //		* heights of the row side colors
        // Grouping these another way, we see that there are different 'types'
        // of things that get updated:
        //		* labels (column, row)
        //		* coordinates (x, y)
        //		* lengths (width, height)
        //		* side colors (column, row)
        //		* heatmap cells
        // For each of these types, col and row should store a reference (with
        // the same name) to the value of that type that is relevant to them
        // (note that we update the heatmap cells regardless, so we can just
        // store this as a global variable):
        //		* col.labels = column labels
        //			row.labels = row labels
        //		* col.coordinate = x
        //			row.coordiante = y
        //		* col.length = width
        //			row.length = height
        //		* col.sideColors = column side colors
        //			row.sideColors = row side colors
        // We can thus create a function which handles the event where either
        // dim has been zoomed/panned, needing only parameter, the dim, whose
        // 'labels', 'coordinate', 'length', and 'sideColors' fields will be
        // used (along with the global reference to the heatmap cells) to
        // determine the visual updates. NOTE the function that actually does
        // this modifies more variables than just those listed here, and
        // additionally the actual field names may be different than they are
        // here.
        //
        // And that's the concept behind the 'dim'.
        //
        //----------------------------------------------------------------------

        // set the current scope for each dimension (these get modified by
        // interactivity functions)
        col.currentScope = [0, col.names.length];
        row.currentScope = [0, row.names.length];
        col.other = row;
        row.other = col;
        col.self = 'col';
        row.self = 'row';
        col.title = 'Column';
        row.title = 'Row';
        col.pos = 'x';
        row.pos = 'y';
        col.size = 'width';
        row.size = 'height';
        col.sizeHeatmap = function() { return me.sizeHeatmap(row) - me.marginAnnoColor - me.marginAnnoLabel; };
        row.sizeHeatmap = function() { return me.sizeHeatmap(col); };

        annotypesSetup(col);
        annotypesSetup(row);

        function annotypesSetup (dim) {
            if (!dim.annotated) {
                return;
            }

            dim.annotypes = Object.keys(dim.annotations).sort(function (a, b) {
                return a.localeCompare(b);
            });
            dim.annoBy = dim.annotypes[0];
        }

        //----------------------------------------------------------------------
        //                                  MARGINS
        // A margin describes a visual element's length in pixels along one
        // axis/dimension.
        //----------------------------------------------------------------------

        me.marginsSetup();

        //----------------------------------------------------------------------
        //                          TOOLTIPS/SETTINGS PANEL
        // Tooltips provide information for rows, columns, matrix data, and
        // annotations when hovering over the side colors, heatmap cells, and
        // color key.
        //----------------------------------------------------------------------

        me.cellTooltip = d3.tip()
            .attr('class', 'd3-tip')
            .direction('e')
            .offset([0, 10])
            .html(function (d) {
                return '<table>' +
                    '<tr><td>Value</td><td>' + d.value + '</td></tr>' +
                    '<tr><td>Row</td><td>' + d.row + '</td></tr>' +
                    '<tr><td>Column</td><td>' + d.col + '</td></tr>' +
                    '</table>';
            });

        // invoke tooltip
        me.container.svg.call(me.cellTooltip);

        tooltipSetupForDim(col);
        tooltipSetupForDim(row);

        function tooltipSetupForDim (dim) {
            if (!dim.annotated) {
                return;
            }

            dim.tooltip = d3.tip()
                .attr('class', 'd3-tip')
                .direction('se')
                .offset([0, 0])
                .html(function (d) {
                    var keys = Object.keys(d.annos);
                    var labels = keys.map(undersToSpaces);
                    var html = '<table>';

                    for (var j = 0; j < keys.length; j++) {
                        html += '<tr><td>' + labels[j] + '</td><td>' + d.annos[keys[j]] + '</td></tr>'
                    }

                    html += '</table>';

                    return html;
                });
            dim.annoTooltip = d3.tip()
                .attr('class', 'd3-tip')
                .direction('w')
                .offset([0, -10])
                .html(function (d) {
                    return '<table>' +
                        '<tr><td>' + undersToSpaces(dim.annoBy) + '</td><td>' + d + '</td></tr>' +
                        '</table>';
                });

            // invoke tooltips
            me.container.svg.call(dim.tooltip);
            me.container.svg.call(dim.annoTooltip);
        }

        me.settingsHidden = true;
        me.settingsPanel = me.settingsPanelSetup();

        //----------------------------------------------------------------------
        //                                  SCALES
        // Scales are very useful for determining where visual elements should
        // be placed relative to each other. For example, to determine the sizes
        // and positions of the cells that make up the heatmap, a scale can map
        // an array of row or column names to a continuous range of pixels.
        //----------------------------------------------------------------------

        // scales for determining cell color
        me.mainColorScale = d3.scaleQuantize()
            .domain([-me.dataset.stats.zMax[me.scalingDim], me.dataset.stats.zMax[me.scalingDim]])
            .range(me.heatmapColors);
        me.bucketizer = new Bucketizer(me.bucketDividers, me.bucketColors);

        colorScalesSetup(col);
        colorScalesSetup(row);

        function colorScalesSetup (dim) {
            if (!dim.annotated) {
                return;
            }

            dim.annoToNum = me.categorical ?
                d3.scaleOrdinal()
                    .domain(dim.annotations[dim.annoBy])
                    .range(d3.range(dim.annotations[dim.annoBy].length))
                : d3.scalePoint()
                    .domain(dim.annotations[dim.annoBy])
                    .range([0, 0.9]); // must be within [0, 1]
            dim.numToColor = dim.annoReg;
        }

        // for cell position/size - map row/col.names to x/y/width/height based on
        // the margins
        col.scaleCell = d3.scaleBand(); // col.names, col.sizeHeatmap -> x, width of cells
        row.scaleCell = d3.scaleBand(); // row.names, row.sizeHeatmap -> y, height of cells
        col.scaleCellSub = d3.scaleBand(); // col.names, row.marginBrush -> x, width of cellsRight
        row.scaleCellSub = d3.scaleBand(); // row.names, col.marginBrush -> y, height of cellsBottom
        if (col.annotated) {
            col.scaleAnnoColor = d3.scaleBand().domain(col.annotations[col.annoBy]);
        }
        if (row.annotated) {
            row.scaleAnnoColor = d3.scaleBand().domain(row.annotations[row.annoBy]);
        }
        me.scaleBucket = d3.scaleBand().domain(me.bucketColors);
        me.scaleGradient = d3.scaleBand().domain(me.heatmapColors);

        me.scalesSetup();

        //----------------------------------------------------------------------
        //                              COLOR KEY
        // This holds all the elements that make up the color keys for the
        // scaling options (row, col, none, and bucket).
        //----------------------------------------------------------------------

        me.colorKey = {
            anchors: {},
            cells: {},
            labels: {},
            titles: {},

            // type should be 'cells', 'labels', or 'titles'
            positionElements: function (type) {
                var me = this;
                var elements = me[type];
                var names = Object.keys(elements);

                for (var j = 0; j < names.length; j++) {
                    GraphicalElement.prototype.position.call({ group: elements[names[j]].group, anchor: me.anchors[type] });
                }
            },

            updateCells: function (attrs) {
                var me = this;
                var names = Object.keys(me.cells);

                for (var j = 0; j < names.length; j++) {
                    me.cells[names[j]].updateVis(attrs);
                }
            },

            updateVisLabels: function () {
                var me = this;
                var names = Object.keys(me.labels);

                for (var j = 0; j < names.length; j++) {
                    me.labels[names[j]].updateVis();
                }
            },

            addTitle: function (svg, name, text, fontSize) {
                var me = this;

                me.titles[name] = new Title(svg, 'annoTitle', text, fontSize);
            },

            addLabels: function (svg, name, labels, margin, fontSize) {
                var me = this;

                me.labels[name] = new Labels(
                    svg,
                    'axis',
                    labels,
                    margin,
                    me.cells[name].attrs.height,
                    false,
                    fontSize,
                    'right'
                );
            },

            change: function (type) {
                var me = this;
                var names = Object.keys(me.titles);

                for (var j = 0; j < names.length; j++) {
                    me.cells[names[j]].group.classed('hidden', names[j] !== type);
                    me.labels[names[j]].group.classed('hidden', names[j] !== type);
                    me.titles[names[j]].group.classed('hidden', names[j] !== type);
                }
            }
        };

        //----------------------------------------------------------------------
        //                                  CELLS
        // These represent groupings of colorful rectangles (row side colors,
        // color keys, heatmap itself).
        //
        // In combination with the axes, these make up all the SVG elements.
        // With the exception of the annotation titles and axes, every visual
        // component can be decomposed into 2 parts:
        //		* group - a g element which gets positioned at an anchor point
        //		* cells - rect elements which live inside the group
        // When a group is tranlated to a new position, all the elements inside
        // of it move as well, and this makes it so that the coordinates (x and
        // y) of cells are relative their group, not to the SVG as a whole.
        //----------------------------------------------------------------------

        me.cells = new Cells(
            me.container.svg,
            'heatmap-cells',
            me.dataset.matrix,
            key,
            function (d) { return col.scaleCell(d.col); },
            function (d) { return row.scaleCell(d.row); },
            function () { return col.scaleCell.bandwidth(); },
            function () { return row.scaleCell.bandwidth(); },
            function (d) {
                if (me.scalingDim === 'none') return me.mainColorScale(d.value);
                if (me.scalingDim === 'bucket') return me.bucketizer.bucketize(d.value);
                var ref = me.dataset.stats[me.scalingDim][dotsToUnders(d[me.scalingDim])];
                return me.mainColorScale((d.value - ref.mean) / ref.stdev);
            }
        );

        col.cellsSub = new Cells(
            me.container.svg,
            'col-cells-sub',
            me.dataset.matrix,
            key,
            me.cells.attrs.x, // inherit x attribute from cells
            function (d) { return row.scaleCellSub(d.row); },
            me.cells.attrs.width, // inherit width attribute from cells
            function () { return row.scaleCellSub.bandwidth(); },
            me.cells.attrs.fill // inherit fill attribute from cells
        );
        row.cellsSub = new Cells(
            me.container.svg,
            'row-cells-sub',
            me.dataset.matrix,
            key,
            function (d) { return col.scaleCellSub(d.col); },
            me.cells.attrs.y, // inherit y attribute from cells
            function () { return col.scaleCellSub.bandwidth(); },
            me.cells.attrs.height, // inherit height attribute from cells
            me.cells.attrs.fill // inherit fill attribute from cells
        );

        me.colorKey.cells.none = new Cells(
            me.container.svg,
            'color-key-cells-none',
            me.heatmapColors,
            identity,
            function () { return 0; },
            function (d) { return me.scaleGradient(d); },
            function () { return me.marginAnnoColor; },
            function () { return me.scaleGradient.bandwidth(); },
            identity
        );
        me.colorKey.cells.col = new Cells(
            me.container.svg,
            'color-key-cells-col',
            me.heatmapColors,
            identity,
            function () { return 0; },
            function (d) { return me.scaleGradient(d); },
            function () { return me.marginAnnoColor; },
            function () { return me.scaleGradient.bandwidth(); },
            identity
        );
        me.colorKey.cells.row = new Cells(
            me.container.svg,
            'color-key-cells-row',
            me.heatmapColors,
            identity,
            function () { return 0; },
            function (d) { return me.scaleGradient(d); },
            function () { return me.marginAnnoColor; },
            function () { return me.scaleGradient.bandwidth(); },
            identity
        );
        me.colorKey.cells.bucket = new Cells(
            me.container.svg,
            'color-key-cells-bucket',
            me.bucketColors,
            identity,
            function () { return 0; },
            function (d) { return me.scaleBucket(d); },
            function () { return me.marginAnnoColor; },
            function () { return me.scaleBucket.bandwidth(); },
            identity
        );

        // attach event listeners
        me.cells.selection
            .on('mouseover', me.cellTooltip.show)
            .on('mouseout', me.cellTooltip.hide)
            .on('click', function () { me.toggleSettingsPanel(this, me.cellTooltip); });

        // initialize fills
        me.cells.updateVis(['fill']);
        col.cellsSub.updateVis(['fill']);
        row.cellsSub.updateVis(['fill']);
        me.colorKey.cells.none.updateVis(['fill']);
        me.colorKey.cells.col.updateVis(['fill']);
        me.colorKey.cells.row.updateVis(['fill']);
        me.colorKey.cells.bucket.updateVis(['fill']);

        sideAndAnnoColorsSetup(col);
        sideAndAnnoColorsSetup(row);

        function sideAndAnnoColorsSetup (dim) {
            if (!dim.annotated) {
                return;
            }

            dim.sideColors = new Cells(
                me.container.svg,
                dim.self + '-side-colors',
                dim.labelsAnnotated,
                key,
                (dim.self === 'col' ? function (d) { return col.scaleCell(d.key); } : function () { return 0; }),
                (dim.self === 'row' ? function (d) { return row.scaleCell(d.key); } : function () { return 0; }),
                (dim.self === 'col' ? me.cells.attrs.width : function () { return row.marginSideColor - me.options.SIDE_COLOR_OFFSET; }),
                (dim.self === 'row' ? me.cells.attrs.height : function () { return col.marginSideColor - me.options.SIDE_COLOR_OFFSET; }),
                function (d) { return dim.numToColor(dim.annoToNum(d.annos[dim.annoBy])); }
            );
            dim.annoColors = new Cells(
                me.container.svg,
                dim.self + '-anno-colors',
                dim.annotations[dim.annoBy],
                identity,
                function () { return 0; },
                function (d) { return dim.scaleAnnoColor(d); },
                function () { return me.marginAnnoColor; },
                function () { return dim.scaleAnnoColor.bandwidth(); },
                function (d) { return dim.numToColor(dim.annoToNum(d)); }
            );

            // attach event listeners
            dim.sideColors.selection
                .on('mouseover', dim.tooltip.show)
                .on('mouseout', dim.tooltip.hide)
                .on('click', function () { me.toggleSettingsPanel(this, dim.tooltip); });
            dim.annoColors.selection
                .on('mouseover', dim.annoTooltip.show)
                .on('mouseout', dim.annoTooltip.hide);

            // initialize fills
            dim.sideColors.updateVis(['fill']);
            dim.annoColors.updateVis(['fill']);
        }

        //----------------------------------------------------------------------
        //                                  LABELS
        // These make up all the tickmark-prefaced pieces of text next to cells.
        //
        // The axes provide a visualization for the labels of rows, columns, and
        // annotations. There are 3 parts that go into making a visible axis:
        //		* scale - a d3.scalePoint object whose domain is the labels and
        //                  range is the pixel
        //                  coordinate extent in which to display them
        //		* axis component - a d3.axis object determining the axis
        //                          orientation (top/bottom/left/right)
        //		* SVG element - a g element which makes the axis visible
        // When an axis is to be visually updated, first update its scale, then
        // call its axis component on its SVG element.
        //----------------------------------------------------------------------

        row.labels = new Labels(
            me.container.svg,
            'axis',
            row.names,
            row.sizeHeatmap,
            me.cells.attrs.height,
            false,
            me.options.FONT_SIZE,
            'right'
        );
        col.labels = new Labels(
            me.container.svg,
            'axis',
            col.names,
            col.sizeHeatmap,
            me.cells.attrs.width,
            true,
            me.options.FONT_SIZE,
            'bottom'
        );
        row.labelsSub = new Labels(
            me.container.svg,
            'axis',
            row.names,
            row.sizeHeatmap,
            me.cells.attrs.height,
            false,
            me.options.FONT_SIZE,
            'right'
        );
        col.labelsSub = new Labels(
            me.container.svg,
            'axis',
            col.names,
            col.sizeHeatmap,
            me.cells.attrs.width,
            true,
            me.options.FONT_SIZE,
            'bottom'
        );

        if (row.annotated) {
            row.labelsAnno = new Labels(
                me.container.svg,
                'axis',
                row.annotations[row.annoBy],
                function () { return row.marginAnnoHeight; },
                row.annoColors.attrs.height,
                false,
                me.options.FONT_SIZE,
                'right'
            );
        }
        if (col.annotated) {
            col.labelsAnno = new Labels(
                me.container.svg,
                'axis',
                col.annotations[col.annoBy],
                function () { return col.marginAnnoHeight; },
                col.annoColors.attrs.height,
                false,
                me.options.FONT_SIZE,
                'right'
            );
        }

        me.colorKey.addLabels(
            me.container.svg,
            'bucket',
            me.bucketDividers.concat([me.bucketDividers[me.bucketDividers.length - 1]]).map(function (d, i) {
                return i < me.bucketDividers.length ? '< ' + d : '>= ' + d;
            }),
            function () { return me.marginColorKey; },
            me.options.FONT_SIZE
        );
        me.colorKey.addLabels(
            me.container.svg,
            'none',
            [me.dataset.stats.totalMin, (me.dataset.stats.totalMin + me.dataset.stats.totalMax ) / 2, me.dataset.stats.totalMax],
            function () { return me.marginColorKey; },
            me.options.FONT_SIZE
        );
        me.colorKey.addLabels(
            me.container.svg,
            'row',
            [-me.dataset.stats.zMax.row.toFixed(2), 0, me.dataset.stats.zMax.row.toFixed(2)],
            function () { return me.marginColorKey; },
            me.options.FONT_SIZE
        );
        me.colorKey.addLabels(
            me.container.svg,
            'col',
            [-me.dataset.stats.zMax.col.toFixed(2), 0, me.dataset.stats.zMax.col.toFixed(2)],
            function () { return me.marginColorKey; },
            me.options.FONT_SIZE
        );

        //----------------------------------------------------------------------
        //                                  TITLES
        // These represent the titles on the columns of cells at the right.
        //----------------------------------------------------------------------

        annoTitleSetup(col);
        annoTitleSetup(row);

        function annoTitleSetup (dim) {
            if (!dim.annotated) {
                return;
            }

            dim.annoTitle = new Title(
                me.container.svg,
                'annoTitle',
                undersToSpaces(dim.annoBy),
                me.options.FONT_SIZE_CK
            );
        }

        me.colorKey.addTitle(me.container.svg, 'bucket', 'Buckets', me.options.FONT_SIZE_CK);
        me.colorKey.addTitle(me.container.svg, 'none', 'Linear Gradient', me.options.FONT_SIZE_CK);
        me.colorKey.addTitle(me.container.svg, 'row', 'Row Z-Score', me.options.FONT_SIZE_CK);
        me.colorKey.addTitle(me.container.svg, 'col', 'Column Z-Score', me.options.FONT_SIZE_CK);

        //----------------------------------------------------------------------
        //                                  ANCHORS
        // An anchor is a 2-element array describing the pixel coordinates
        // (relative to the SVG, not the webpage as a whole) of the upper-left
        // corner of a visual element. Using the 'transform' attribute of SVG
        // elements, we can position each group of visual elements (for example,
        // all the cells of the heatmap) by simply translating it to the right
        // by its anchor at index 0, and down by its anchor at index 1. Anchors
        // are determined by the margins.
        //----------------------------------------------------------------------

        me.anchorsSetup();

        //----------------------------------------------------------------------
        //                                  BRUSHES
        // The brushes provide a way to zoom and pan on the main heatmap by
        // selecting regions on brushable heatmaps, and they are made up of 2
        // parts:
        //		* brush component - a d3.brush object (brushX of col, brushY for
        //          row) which defines important properties of the brush, namely
        //          its extent (the maximum pixel area that the user can brush)
        //          and its interactive behavior (what to do when the user
        //          starts/stops brushing, or while they are brushing)
        //		* SVG element - a g element which makes the brush visible and
        //          usable. By default, it contains 4 rect elements; an overlay
        //          which lets you create a selection, a selection which is
        //          draggable, and 2 'handles' on either side of the selection
        //          which allow it to be resized. The attributes of these
        //          elements can be programmatically controlled with CSS and JS
        //----------------------------------------------------------------------

        // TODO make this more general and move it to d3-helpers
        class Brush {

            constructor (svg, dim, brush, onBrush, onEnd, upperLeft, lowerRight, index) {
                var me = this;

                me.dim = dim;
                me.brush = brush;
                me.onBrush = onBrush;
                me.onEnd = onEnd;
                me.upperLeft = upperLeft;
                me.lowerRight = lowerRight;
                me.index = index;
                me.inverter = d3.scaleQuantize()
                    .range(me.dim.names);
                me.brush
                    .on('brush', me.onBrush)
                    .on('end', me.onEnd);
                me.group = svg
                    .append('g')
                    .attr('class', 'brush');
                me.callBrush();
                me.extentsSetup();
            }

            brushToScope () {
                var me = this;

                me.group.call(me.brush.move,
                    [me.inverter.invertExtent(me.dim.names[me.dim.currentScope[0]])[0],
                    me.inverter.invertExtent(me.dim.names[me.dim.currentScope[1] - 1])[1] - 1]);
            }

            callBrush () {
                var me = this;

                me.group.call(me.brush);
            }

            clearBrush () {
                var me = this;

                me.group.call(me.brush.move, null);
            }

            extentsSetup () {
                var me = this;

                me.brush.extent([me.upperLeft(), me.lowerRight()]);
                me.inverter.domain([me.upperLeft()[me.index], me.lowerRight()[me.index]]);
            }
        }

        col.brusher = new Brush(
            me.container.svg,
            col,
            d3.brushX(),
            function () { me.onBrush(col); },
            function () { me.onEnd(col); },
            function () { return col.cellsSub.anchor; },
            function () { return [col.cellsSub.anchor[0] + col.sizeHeatmap(), col.cellsSub.anchor[1] + col.marginBrush]; },
            0
        );
        row.brusher = new Brush(
            me.container.svg,
            row,
            d3.brushY(),
            function () { me.onBrush(row); },
            function () { me.onEnd(row); },
            function () { return row.cellsSub.anchor; },
            function () { return [row.cellsSub.anchor[0] + row.marginBrush, row.cellsSub.anchor[1] + row.sizeHeatmap()]; },
            1
        );

        //----------------------------------------------------------------------
        //                              INITIALIZATION
        // One final resize completes the initial rendering of the widget.
        //----------------------------------------------------------------------

        me.resize();
    }

    //--------------------------------------------------------------------------
    //                          INTERACTIVITY FUNCTIONS
    // These functions determine all the things that can happen in the widget
    // once it is initially rendered.
    //
    // For the brushes (the tools used to zoom/pan), there are 2 functions,
    // onBrush and onEnd, which handle all the updates to the data structures
    // and DOM that are necessary to perform zoom/pan (with the help of helper
    // functions).
    //
    // For the dropdowns in the settings panel, there are 3 functions,
    // annoUpdate, sortUpdate, and updateColorScaling.
    //--------------------------------------------------------------------------

    // updates the current scope of the given dimension and, if renderOnBrushEnd
    // is false, performs visual updates on the main heatmap and side colors
    onBrush (dim) {
        var me = this;

        // hide the settings panel in case it's visible
        me.settingsPanel.classed('hidden', true);
        me.settingsHidden = true;

        if (!me.renderOnBrushEnd) {
            // bounds of brushed -> row/column
            var inverses = d3.event.selection.map(dim.brusher.inverter);
            dim.currentScope = [dim.names.indexOf(inverses[0]), dim.names.indexOf(inverses[1]) + 1];
            me.renderScope(dim, false);
        }
    }

    // resets the scope of the given dim only if there is no current selection
    // (i.e., the user clicks off of the selected area, otherwise renders the
    // dim's current scope if renderOnBrushEnd is true
    onEnd (dim) {
        var me = this;

        if (d3.event.selection) {

            if (me.renderOnBrushEnd) {
                // pixel bounds -> row/column
                var inverses = d3.event.selection.map(dim.brusher.inverter);
                dim.currentScope = [dim.names.indexOf(inverses[0]), dim.names.indexOf(inverses[1]) + 1];
                me.renderScope(dim, true);
            }
        } else {

            // hide the settings panel in case it's visible
            me.settingsPanel.classed('hidden', true);
            me.settingsHidden = true;

            // reset scope
          	dim.currentScope = [0, dim.names.length];

            // scale updates
            dim.scaleCell.domain(dim.names);
            dim.labels.updateNames(dim.names);

            // visual updates
            dim.labels.updateVis(me.options.ANIM_DURATION);
            me.cells.updateVis([dim.pos, dim.size]);
            if (dim.annotated) {
                dim.sideColors.updateVis([dim.pos, dim.size]);
            }
        }
    }

    // renders the currentScope for the given dim. If transition is true, the
    // labels will update with a transition, else they will update without a
    // transition
    renderScope (dim, transition) {
        var me = this;
        var scopeArray = dim.names.slice(dim.currentScope[0], dim.currentScope[1]);
        var inScope = {};

        for (var j = 0; j < scopeArray.length; j++) {
            // NOTE undefined is falsy
            inScope[scopeArray[j]] = true;
        }

        // scale updates
        dim.scaleCell.domain(scopeArray);
        dim.labels.updateNames(scopeArray);

        // visual updates
        // TODO make 'transition' a numerical parameter
        if (transition) {
            dim.labels.updateVis(me.options.ANIM_DURATION);
        } else {
            dim.labels.updateVis();
        }
        me.updateVisualScope(dim, inScope);
    }

    // repositions and resizes the cells of the main heatmap and the side colors
    // of the given dimension, showing only those that are in visible (for which
    // vis[d[dim.self]] is true)
    updateVisualScope (dim, vis) {
        var me = this;

        me.cells.selection
            .attr(dim.pos, function (d) { return (vis[d[dim.self]] ? me.cells.attrs[dim.pos](d) : 0); })
            .attr(dim.size, function (d) { return (vis[d[dim.self]] ? me.cells.attrs[dim.size]() : 0); });
        if (dim.annotated) {
            dim.sideColors.selection
                .attr(dim.pos, function (d) { return (vis[d.key] ? dim.sideColors.attrs[dim.pos](d) : 0); })
                .attr(dim.size, function (d) { return (vis[d.key] ? dim.sideColors.attrs[dim.size]() : 0); });
        }
    }

    // annotates the rows/columns (depending on dim) and updates the respective
    // annotation colors by the currently selected annotation option for the
    // given dimension
    annoUpdate (dim, newAnnotype) {
        var me = this;
        dim.annoBy = newAnnotype;
        var values = dim.annotations[dim.annoBy];

        // scale updates
        dim.annoToNum.domain(values);
        if (me.categorical) {
            dim.annoToNum.range(d3.range(values.length));
        }
        if (values.every(function (value) { return !isNaN(value); }) && values.length > 2) {
            dim.numToColor = (me.categorical ? function (index) { return dim.annoHeat(index / values.length); } : dim.annoHeat);
        } else {
            dim.numToColor = dim.annoReg;
        }
        dim.scaleAnnoColor.domain(values);
        dim.labelsAnno.updateNames(values);

        // visual updates
        dim.annoTitle.setText(undersToSpaces(dim.annoBy));
        dim.annoColors.updateData(values, identity);
        dim.annoColors.updateVis(['x', 'y', 'width', 'height', 'fill']);
        dim.labelsAnno.updateVis();
        dim.sideColors.selection
            .transition()
            .duration(me.options.ANIM_DURATION)
            .attr('fill', dim.sideColors.attrs.fill);
    }

    // sorts the rows/columns (depending on dim) of the 3 heatmaps according to
    // the currently selected sorting option for the given dimension
    sortUpdate (dim, annotype) {
        var me = this;

        // sort the rows/columns by the chosen annotype
        if (annotype !== 'Clustered Order') {
            var values = dim.annotations[annotype];

            // hashmap to determine priority for sorting
            var valueToIndex = {};

            for (var j = 0; j < values.length; j++) {
                valueToIndex[values[j]] = j;
            }

            dim.labelsAnnotated.sort(function (a, b) {
                var val1 = valueToIndex[a.annos[annotype]];
                var val2 = valueToIndex[b.annos[annotype]];
                return (val1 === val2 ? a.key.localeCompare(b.key) : val1 - val2);
            });
        }

        dim.names = (annotype === 'Clustered Order' ? dim.clustOrder : dim.labelsAnnotated.map(key));

        // update scales
        dim.scaleCell.domain(dim.names);
        dim.scaleCellSub.domain(dim.names);
        dim.brusher.inverter.range(dim.names);
        dim.labelsSub.updateNames(dim.names);

        // visual updates for the brushable heatmaps
        dim.labelsSub.updateVis(me.options.ANIM_DURATION);
        dim.cellsSub.updateVis([dim.pos]);
        dim.other.cellsSub.updateVis([dim.pos]);
        me.renderScope(dim, true);
    }

    // updates the fill of the heatmap cells based on the currently selected
    // scaling option
    updateColorScaling (newScalingDim) {
        var me = this;
        me.scalingDim = newScalingDim;

        // scale update
        if (me.scalingDim !== 'bucket') {
            me.mainColorScale.domain(me.scalingDim === 'none' ? [me.dataset.stats.totalMin, me.dataset.stats.totalMax]
                : [-me.dataset.stats.zMax[me.scalingDim], me.dataset.stats.zMax[me.scalingDim]]);
        }

        // visual updates
        me.colorKey.change(me.scalingDim);
        me.cells.updateVis(['fill']);
        me.col.cellsSub.updateVis(['fill']);
        me.row.cellsSub.updateVis(['fill']);
    }

    marginsSetup () {
        var me = this;
        var col = me.col;
        var row = me.row;

        me.marginAnnoColor = Math.floor(me.container.svgWidth / 50);
        me.marginAnnoLabel = Math.min(Math.floor(me.container.svgWidth / 4), Math.floor(annoMax() + me.options.AXIS_OFFSET));
        me.marginAnnoTitle = me.options.FONT_SIZE_CK + 2 * me.options.ANNO_TITLE_OFFSET;
        col.marginTotal = me.container.svgHeight;
        row.marginTotal = me.container.svgWidth;
        col.marginLabel = (col.labels ? Math.ceil(col.labels.getBox().height + 2 * me.options.AXIS_OFFSET) : 0);
        row.marginLabel = (row.labels ? Math.ceil(row.labels.getBox().width + 2 * me.options.AXIS_OFFSET) : 0);
        col.marginLabelSub = (col.labelsSub ? Math.ceil(col.labelsSub.getBox().height + 2 * me.options.AXIS_OFFSET) : 0);
        row.marginLabelSub = (row.labelsSub ? Math.ceil(row.labelsSub.getBox().width + 2 * me.options.AXIS_OFFSET) : 0);
        col.marginBrush = Math.floor(me.container.svgHeight / 10);
        row.marginBrush = Math.floor(me.container.svgHeight / 10);
        me.marginColorKey = Math.floor(me.container.svgHeight / 4) - me.marginAnnoTitle;

        sideAndAnnoMarginsSetup(col);
        sideAndAnnoMarginsSetup(row);

        function sideAndAnnoMarginsSetup (dim) {
            dim.marginSideColor = (dim.annotated ? Math.floor(me.container.svgHeight / 40) : 0);
            dim.marginAnnoTotal = (dim.annotated ? Math.floor(3 * me.container.svgHeight / 8) : 0);
            dim.marginAnnoHeight = (dim.annotated ? dim.marginAnnoTotal - me.marginAnnoTitle : 0);
        }

        function annoMax () {
            var cM1 = (col.labelsAnno ? col.labelsAnno.getBox().width + 2 * me.options.AXIS_OFFSET : 0);
            var rM1 = (row.labelsAnno ? row.labelsAnno.getBox().width + 2 * me.options.AXIS_OFFSET : 0);
            var cM2 = (col.annoTitle ? col.annoTitle.getBox().width - me.marginAnnoColor + me.options.AXIS_OFFSET : 0);
            var rM2 = (row.annoTitle ? row.annoTitle.getBox().width - me.marginAnnoColor + me.options.AXIS_OFFSET : 0);
            var ck1 = (me.colorKey ? me.colorKey.labels[me.scalingDim].getBox().width + 2 * me.options.AXIS_OFFSET : 0);
            var ck2 = (me.colorKey ? me.colorKey.titles[me.scalingDim].getBox().width - me.marginAnnoColor + me.options.AXIS_OFFSET : 0);

            return Math.max(cM1, rM1, cM2, rM2, ck1, ck2);
        }
    }

    anchorsSetup () {
        var me = this;
        var cells = me.cells;
        var col = me.col;
        var row = me.row;
        var colorKey = me.colorKey;

        cells.anchor = [row.marginSideColor, col.marginSideColor];
        col.labels.anchor = [cells.anchor[0], cells.anchor[1] + row.sizeHeatmap() + me.options.AXIS_OFFSET];
        row.labels.anchor = [cells.anchor[0] + col.sizeHeatmap() + me.options.AXIS_OFFSET, cells.anchor[1]];
        col.cellsSub.anchor = [cells.anchor[0], col.labels.anchor[1] + col.marginLabel];
        row.cellsSub.anchor = [row.labels.anchor[0] + row.marginLabel, cells.anchor[1]];
        col.labelsSub.anchor = [cells.anchor[0], col.cellsSub.anchor[1] + col.marginBrush + me.options.AXIS_OFFSET];
        row.labelsSub.anchor = [row.cellsSub.anchor[0] + row.marginBrush + me.options.AXIS_OFFSET, cells.anchor[1]];

        if (col.annotated) {
            col.sideColors.anchor = [cells.anchor[0], 0];
            col.annoColors.anchor = [row.labelsSub.anchor[0] + row.marginLabelSub, me.marginAnnoTitle];
            col.annoTitle.anchor = [col.annoColors.anchor[0], col.annoColors.anchor[1] - me.options.ANNO_TITLE_OFFSET];
            col.labelsAnno.anchor = [col.annoColors.anchor[0] + me.marginAnnoColor + me.options.AXIS_OFFSET, col.annoColors.anchor[1]];
        }
        if (row.annotated) {
            row.sideColors.anchor = [0, cells.anchor[1]];
            row.annoColors.anchor = [row.labelsSub.anchor[0] + row.marginLabelSub, col.marginAnnoTotal + me.marginAnnoTitle];
            row.annoTitle.anchor = [row.annoColors.anchor[0], row.annoColors.anchor[1] - me.options.ANNO_TITLE_OFFSET];
            row.labelsAnno.anchor = [row.annoColors.anchor[0] + me.marginAnnoColor + me.options.AXIS_OFFSET, row.annoColors.anchor[1]];
        }

        colorKey.anchors.cells = [row.labelsSub.anchor[0] + row.marginLabelSub, col.marginAnnoTotal + row.marginAnnoTotal + me.marginAnnoTitle];
        colorKey.anchors.labels = [colorKey.anchors.cells[0] + me.marginAnnoColor + me.options.AXIS_OFFSET, colorKey.anchors.cells[1]];
        colorKey.anchors.titles = [colorKey.anchors.cells[0], colorKey.anchors.cells[1] - me.options.ANNO_TITLE_OFFSET];
    }

    scalesSetup () {
        var me = this;
        var col = me.col;
        var row = me.row;

        col.scaleCell.domain(col.names).range([0, col.sizeHeatmap()]);
        row.scaleCell.domain(row.names).range([0, row.sizeHeatmap()]);
        col.scaleCellSub.domain(col.names).range([0, row.marginBrush]);
        row.scaleCellSub.domain(row.names).range([0, col.marginBrush]);

        if (col.annotated) {
            col.scaleAnnoColor.range([0, col.marginAnnoHeight]);
        }
        if (row.annotated) {
            row.scaleAnnoColor.range([0, row.marginAnnoHeight]);
        }

        me.scaleBucket.range([0, me.marginColorKey]);
        me.scaleGradient.range([0, me.marginColorKey]);
    }

    resize () {
        var me = this;
        var col = me.col;
        var row = me.row;

        me.container.resize(me.initialHeight);
        me.marginsSetup();
        me.anchorsSetup();
        me.scalesSetup();
        // TODO position elements before extents setup?
        col.brusher.extentsSetup();
        row.brusher.extentsSetup();
        me.positionAllElements();
        resizeBrush(col);
        resizeBrush(row);

        function resizeBrush (dim) {
            if (dim.currentScope[0] !== 0 || dim.currentScope[1] !== dim.names.length) {
                dim.brusher.brushToScope();
            } else {
                dim.brusher.clearBrush();
            }
        }
    }

    //--------------------------------------------------------------------------
    //              TOOLTIP GENERATING/DISPLAYING FUNCTIONS + MISC
    // These handle the setup and displaying of various visual/interactive
    // elements in the heatmap.
    //--------------------------------------------------------------------------

    // TODO clean this up, hopefully by converting to d3-tip
    settingsPanelSetup () {
        var me = this;
        var col = me.col;
        var row = me.row;

        var panel = me.container.div
            .append('div')
            .attr('id', 'settings')
    		.attr('class', 'tooltip')
            .classed('hidden', true);
        panel.append('p').text('Settings');
        panel.append('button').text('Fit to Labels').on('click', function () { me.resize.call(me); });
        panel.append('button').text('Close Settings').on('click', function () {
            me.settingsHidden = !me.settingsHidden;
            panel.classed('hidden', me.settingsHidden);
        });
    	var table = panel.append('table');
    	var row1 = table.append('tr');
        row1.append('td').append('p').text('Scale by');
        var scaleBy = row1.append('td').append('select')
    	   .on('change', function () { me.updateColorScaling(this.value); });
    	scaleBy.selectAll('option')
            .data([
                { value: col.self, text: col.title },
                { value: row.self, text: row.title },
                { value: 'none', text: 'None' },
                { value: 'bucket', text: 'Buckets' }
            ])
            .enter()
            .append('option')
            .attr('value', function (d) { return d.value; })
            .text(function (d) { return d.text; });
    	me.scalingDim = col.self;

        if (row.annotated) controlsSetup(row);
        if (col.annotated) controlsSetup(col);

        function controlsSetup (dim) {
            var r1 = table.append('tr');
            var r2 = table.append('tr');
            r1.append('td').append('p').text(dim.title + 's: annotate by');
            r2.append('td').append('p').text(dim.title + 's: sort by');
            dim.annoByDropdown = selectorSetup(r1, dim, me.annoUpdate);
            dim.sortByDropdown = selectorSetup(r2, dim, me.sortUpdate);
            dim.annoByDropdown.selectAll('option')
                .data(dim.annotypes)
                .enter()
                .append('option')
                .attr('value', identity)
                .text(function (d) { return undersToSpaces(d); });
            dim.sortByDropdown.selectAll('option')
                .data(['Clustered Order'].concat(dim.annotypes))
                .enter()
                .append('option')
                .attr('value', identity)
                .text(function (d) { return undersToSpaces(d); });
        }

        function selectorSetup (s, dim, update) {
            return s.append('td').append('select').on('change', function () { update.call(me, dim, this.value); });
        }

        return panel;
    }

    // positions the settings panel at the lower-right corner of the cell
    // (clickedRect). Sets settingsHidden to !settingsHidden and then hides the
    // given tooltip if settingsHidden is false and hides the settings panel if
    // settingsHidden is true (else shows the settings panel)
    toggleSettingsPanel (clickedRect, tooltip) {
        var me = this;

        me.settingsHidden = !me.settingsHidden;
        if (!me.settingsHidden) {
            tooltip.hide();
        }
        var box = clickedRect.getBoundingClientRect();
        var anchor = [
            box.left + box.width + window.pageXOffset,
            box.top + box.height + window.pageYOffset
        ];
        me.settingsPanel
            .style('left', anchor[0] + 'px')
            .style('top', anchor[1] + 'px')
            .classed('hidden', me.settingsHidden);
    }

    positionAllElements () {
        var me = this;

        me.cells.position();
        me.cells.updateVis(['x', 'y', 'width', 'height']);
        me.colorKey.updateCells(['x', 'y', 'width', 'height']);
        me.colorKey.positionElements('cells');
        me.colorKey.positionElements('labels');
        me.colorKey.updateVisLabels();
        me.colorKey.positionElements('titles');
        me.colorKey.change(me.scalingDim);

        positionElementsForDim(me.col);
        positionElementsForDim(me.row);

        function positionElementsForDim (dim) {
            dim.labels.position();
            dim.labels.updateVis();
            dim.labelsSub.position();
            dim.labelsSub.updateVis();
            dim.cellsSub.position();
            dim.cellsSub.updateVis(['x', 'y', 'width', 'height']);
            dim.brusher.callBrush();

            if (dim.annotated) {
                dim.labelsAnno.position();
                dim.labelsAnno.updateVis();
                dim.sideColors.position();
                dim.sideColors.updateVis(['x', 'y', 'width', 'height']);
                dim.annoColors.position();
                dim.annoColors.updateVis(['x', 'y', 'width', 'height']);
                dim.annoTitle.position();
            }
        }
    }

    //--------------------------------------------------------------------------
    //                          OTHER HELPER FUNCTIONS
    //--------------------------------------------------------------------------

    colorsSetup (dim) {
        var me = this;

        var categoricalSchemes = {
            ns: [
                '#7fff00', '#eead0e', '#00b2ee', '#ee2c2c', '#bf3eff',
                '#d2b48c', '#6959cd', '#228b22', '#ff7f50', '#7a7a7a'
            ],
  			google: [
                '#3366cc', '#dc3912', '#ff9900', '#109618', '#990099',
                '#0099c6', '#dd4477', '#66aa00', '#b82e2e', '#316395',
                '#994499', '#22aa99', '#aaaa11', '#6633cc', '#e67300',
                '#8b0707', '#651067', '#329262', '#5574a6', '#3b3eac'
            ],
  			rainbow: [
                '#843c39', '#ad494a', '#d6616b', '#e7969c', '#e6550d',
                '#fd8d3c', '#fdae6b', '#fdd0a2', '#8c6d31', '#bd9e39',
                '#e7ba52', '#e7cb94', '#637939', '#8ca252', '#b5cf6b',
                '#cedb9c', '#31a354', '#74c476', '#a1d99b', '#c7e9c0',
                '#3182bd', '#6baed6', '#9ecae1', '#c6dbef', '#393b79',
                '#5254a3', '#6b6ecf', '#9c9ede', '#756bb1', '#9e9ac8',
                '#bcbddc', '#dadaeb',' #7b4173', '#a55194', '#ce6dbd',
                '#de9ed6', '#636363', '#969696', '#bdbdbd',' #d9d9d9'
            ]
  	  	};
  	  	var continuousSchemes = {
            cubehelix: d3.interpolateCubehelixDefault,
            rainbow: d3.interpolateRainbow
  	  	};
  	  	var annoHeatSchemes = {
            viridis: d3.interpolateViridis,
            inferno: d3.interpolateInferno,
            magma: d3.interpolateMagma,
            plasma: d3.interpolatePlasma,
            warm: d3.interpolateWarm,
            cool: d3.interpolateCool
        };
        var catColors = categoricalSchemes[dim.catScheme];
        var conColors = continuousSchemes[dim.conScheme];
        dim.annoReg = (me.categorical ? function (index) { return catColors[index % catColors.length]; } : conColors);
        dim.annoHeat = annoHeatSchemes[dim.annoHeatScheme];
    }

    // returns the size, in pixels, of the heatmap along the given dim
    // (height - col, width - row), but does not take into account margins used
    // for color keys
    sizeHeatmap (dim) {
        return dim.marginTotal - dim.marginSideColor - dim.marginLabel - dim.marginBrush - dim.marginLabelSub;
    }

    //--------------------------------------------------------------------------
    //                              PARSING FUNCTIONS
    // These take strings in CSV format and turn them into the data structures
    // needed for the heatmap.
    //--------------------------------------------------------------------------

    // parses the given string into the data structures used for generating the
    // heatmap
    parseDataset (file, parsed) {
        // TODO fix style...
        if (parsed) {
            var matrix = file.matrix;
            var rownames = file.rownames;
            var colnames = file.colnames;

            var stats = {
                col: {},
                row: {},
                zMax: { col: 0, row: 0 },
                totalMin: Number.POSITIVE_INFINITY,
                totalMax: Number.NEGATIVE_INFINITY
            };

            matrix.forEach(function (array) {
                array.forEach(function (element) {
                    updateStats(stats, 'col', dotsToUnders(element.col), element.value);
                    updateStats(stats, 'row', dotsToUnders(element.row), element.value);
                });
            });
        } else {
            var parsedRows = d3.csvParseRows(file); // parses the string into an array of arrays
            var colnames = parsedRows.shift(); // column names should be stored in the first row
            colnames.shift(); // removes whatever name was given to the column containing the row names
            var rownames = []; // the array of rownames will grow as we process each row
            // stats will hold all relevant statistics for the dataset
            var stats = {
                col: {},
                row: {},
                zMax: { col: 0, row: 0 },
                totalMin: Number.POSITIVE_INFINITY,
                totalMax: Number.NEGATIVE_INFINITY
            };

            // traverse the parsed rows to create the matrix (a doubly-nested
            // array) for the heatmap, adding to the rownames array and updating
            // the stats object as we go
            var matrix = d3.range(parsedRows.length).map(function (j) { // j = index of parsedRows
                // grab the row name out of the parsed row. This makes
                // parsedRows[j] the same length as colnames, with
                // parsedRows[j][k] being the value in row 'rowname'
                // and column 'colnames[k]'
                var rowname = parsedRows[j].shift();
                // add the new row name to the list of row names
                rownames.push(rowname);
                // traverse the parsed row, reformatting each element (a number)
                // and updating stats
                return d3.range(colnames.length).map(function (k) { // k = index of colnames
                    // the '+' converts parsedRows[j][k] to a number (since it
                    // was parsed as a string)
                    var value = +parsedRows[j][k];
                    // update the stats for the current column and the current
                    // row with this value
                    updateStats(stats, 'col', dotsToUnders(colnames[k]), value);
                    updateStats(stats, 'row', dotsToUnders(rowname), value);
                    return {
                        key: j + ' ' + k, // useful for d3 data joins
                        row: rowname, // determines cell attributes (position (y), size (height))
                        col: colnames[k], // determines cell attributes (position (x), size (width))
                        value: value // determines cell attributes (fill)
                    };
                });
            });
        }

        // perform final calculations of the stats for each column, and find the
        // totalMin and totalMax of the dataset (this could also be done in the
        // final calculations for the row stats)
        var cStatNames = Object.keys(stats.col);
        for (var j = 0; j < cStatNames.length; j++) {
            finalCalculations(stats, 'col', cStatNames[j], rownames.length);
            stats.totalMin = Math.min(stats.totalMin, stats.col[cStatNames[j]].min); // reassign if needed
            stats.totalMax = Math.max(stats.totalMax, stats.col[cStatNames[j]].max); // reassign if needed
        }
        // perform final calculations of the stats for each row
        var rStatNames = Object.keys(stats.row);
        for (var j = 0; j < rStatNames.length; j++) {
            finalCalculations(stats, 'row', rStatNames[j], colnames.length);
        }
        // find the z-score in the dataset with the largest magnitude
        for (var j = 0; j < matrix.length; j++) {
            for (var k = 0; k < matrix[j].length; k++) {
                var value = matrix[j][k].value; // grab the value and compute its z-score for to its row/col
                var colname = dotsToUnders(colnames[k]);
                var rowname = dotsToUnders(rownames[j]);
                var colZ = (value - stats.col[colname].mean) / stats.col[colname].stdev;
                var rowZ = (value - stats.row[rowname].mean) / stats.row[rowname].stdev;
                stats.zMax.col = Math.max(stats.zMax.col, Math.abs(colZ)); // reassign max if necessary
                stats.zMax.row = Math.max(stats.zMax.row, Math.abs(rowZ)); // reassign max if necessary
            }
        }

        // updates the stats object for the given dimension at the given name
        // with the given value
        function updateStats (stats, dim, name, value) {
            if (stats[dim][name] === undefined) { // if unseen, give it a fresh new stats object
                // an stdev field will be added to this object during final
                // calculations
                stats[dim][name] = {
                    min: value, // helps to find most negative z-score
                    max: value, // helps to find most positive z-score
                    mean: 0, // used in calculating standard deviation/z-scores for cell fills
                    meanOfSquares: 0 // used in calculating standard deviation
                };
            }
            if (value < stats[dim][name].min) stats[dim][name].min = value; // reassign min if necessary
            if (value > stats[dim][name].max) stats[dim][name].max = value; // reassign max if necessary
            stats[dim][name].mean += value; // this will be averaged later
            stats[dim][name].meanOfSquares += value * value; // this will be averaged later
        }

        // adds the stdev field to the stats object for the dimension at the
        // given name
        function finalCalculations (stats, dim, name, numVals) {
            stats[dim][name].mean *= (1 / numVals);
            stats[dim][name].meanOfSquares *= (1 / numVals);
            stats[dim][name].stdev = Math.sqrt(stats[dim][name].meanOfSquares - Math.pow(stats[dim][name].mean, 2));
        }

        function flatten (matrix) {
            return matrix.reduce(function (acc, array) {
                return acc.concat(array);
            }, []);
        }

        return {
            matrix: flatten(matrix), // array of arrays of objects (cells have value, row, col, key)
            rownames: rownames, // arrays of strings (list of all row names, assumed to be clustered)
            colnames: colnames, // arrays of strings (list of all column names, assumed to be clustered)
            stats: stats // object with 5 fields: row and col (hashmaps from row/col name to object
          	     // of statistics, zMax stores largest z-score (by magnitude) for both row
                 // and col, and totalMin/totalMax store min and max of the entire dataset
        };
    }

    // parses the given string into the data structures used for
    // annotating/sorting the heatmap
    parseAnnotations (file) {
        file = file.charAt(0) === ',' ? 'Name' + file : file; // add a nameKey if there isn't one
        var na = '{ no data }'; // this will be used as a readable name if a cell only holds ''
        var parsedRows = d3.csvParseRows(file); // parse the file into an array of arrays
        // the names of the different kinds of annotations should be stored in
        // the first row of the file
        var annotypes = parsedRows.shift(); // pops off the first element (ACTUALLY modifies parsedRows)
        annotypes = annotypes.map(dotsToUnders); // periods in names of annotypes will mess up JS code
        var nameKey = annotypes.shift(); // trims annotypes down to JUST the actual annotation types
        var annotations = {}; // each type of annotation will map to a sorted array of its unique values
        for (var j = 0; j < annotypes.length; j++) annotations[annotypes[j]] = [];

        // in these nested loops, examine all values for each annotation type
        // and add them to the hashmap of annotation types -> array of unique
        // values
        for (var j = 0; j < parsedRows.length; j++) {
            // toss out the first element in the row (the name of the dimension
            // for this value); what's left is an array of the same length as
            // the annotypes array, with values[k] being a value for the
            // annotation type annotypes[k]
            parsedRows[j].shift();
            var values = parsedRows[j];
            // associate new unique values with their corresponding annotation
            // types as necessary
            for (var k = 0; k < annotypes.length; k++) {
                var value = values[k] || na; // give a readable name if blank
                // add this value into the array of unique values for its
                // corresponding annotation type
                if (annotations[annotypes[k]].indexOf(value) < 0) annotations[annotypes[k]].push(value);
            }
        }

        // sort each annotation type's values (numerically if both numbers,
        // otherwise lexicographically)
        for (var j = 0; j < annotypes.length; j++) {
            annotations[annotypes[j]].sort(function (a, b) {
                if (!isNaN(a) && !isNaN(b)) return (+a) - (+b); // the '+' converts a and b to numbers
                return a.localeCompare(b);
            });
        }

        // parse the file into an array of objects (each dimension (row or
        // column) is grouped with all its values for each annotation type, with
        // the column names for the file being the keys). Then restructure and
        // reformat the elements so that each object is now a nested object,
        // with a key field holding the original object's value for the nameKey
        // and an annos holding the entire original object (reformatted). This
        // allows for easier lookup of the annotations for a given row/column
        // name, and makes d3 data joins easier
        var labels = d3.csvParse(file).map(function (obj) {
            // reformat so that keys contain no periods and values are renamed
            // if blank
            var objClean = {}, keys = Object.keys(obj);
            for (var j = 0; j < keys.length; j++) objClean[dotsToUnders(keys[j])] = obj[keys[j]] || na;
            return {
                key: objClean[nameKey], // this corresponds to the name of the row/column
                annos: objClean
            };
        });

        return {
            annotations: annotations, // hashmap string to string[] (annotation types -> values)
            labels: labels // array of objects (list of annotated dimension names)
        };
    }
}
