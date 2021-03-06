(function (global, factory) {

    (typeof exports === 'object' && typeof module !== 'undefined')
        ? factory(exports)
        : ((typeof define === 'function' && define.amd)
            ? define(['exports'], factory)
            : factory(global.d3 = (global.d3 || {})));

}(this, function (exports) {

    'use strict';

    class Heatmap extends d3.Widget {

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

        initialize (data, options) {
            var me = this;
            options = (options || {});

            // the 'dims' hold all elements relevant to the columns and rows of the
            // data, separately
            var col = me.col = {};
            var row = me.row = {};
            var dims = me.dims = [col, row];

            // required
            me.data = me.parseDataset(data);

            // order options
            col.clustOrder = (options.colClustOrder || me.data.colnames);
            row.clustOrder = (options.rowClustOrder || me.data.rownames);

            // annotation options
            col.annotations = (options.colAnnotations === undefined ? null : options.colAnnotations);
            row.annotations = (options.rowAnnotations === undefined ? null : options.rowAnnotations);

            // color options
            me.loColor = (options.loColor || 'cornflowerblue');
            me.mdColor = (options.mdColor || 'black');
            me.hiColor = (options.hiColor || 'orange');
            me.numColors = (options.numColors || 256);
            me.colorsHeatmap = (options.colorsHeatmap || me.interpolateColors(me.loColor, me.mdColor, me.hiColor, me.numColors));
            me.colorsBucket = (options.colorsBucket || ['red', 'orange', 'yellow', 'gray', 'cornflowerblue']);
            me.dividersBucket = (options.dividersBucket || [25, 50, 100, 500]);
            col.catScheme = (options.colCatScheme || 'rainbow');
            col.conScheme = (options.colConScheme || 'rainbow');
            col.annoHeatScheme = (options.colAnnoHeatScheme || 'plasma');
            row.catScheme = (options.rowCatScheme || 'google');
            row.conScheme = (options.rowConScheme || 'cubehelix');
            row.annoHeatScheme = (options.rowAnnoHeatScheme || 'magma');
            me.categorical = (options.categorical === undefined ? true : options.categorical);

            // miscellaneous options
            me.scalingDim = (options.scalingDim || 'col');
            me.renderOnBrushEnd = (options.renderOnBrushEnd === undefined ? true : options.renderOnBrushEnd);

            me.container = me.newDefaultSVGContainer(options);

            //----------------------------------------------------------------------
            // REFERENCES BY DIM
            // Note that the row and col objects are mirror images of each other;
            // every field that col has, row also has, and vice-versa. They could be
            // made into objects of the same new class, but its much easier to just
            // build them as we go along and think of them more as growing lists
            // containing everything that's relevant to their respective dimension.
            //
            // For example, when we zoom and pan using the brush for the columns,
            // the only things that need to visually update are:
            //      * column labels
            //      * x-positions of the heatmap cells
            //      * widths of the heatmap cells
            //      * x-positions of the column side colors
            //      * widths of the column side colors
            // Similarly, when doing the same thing to the rows, we need only be
            // concerned with updating:
            //      * row labels
            //      * y-positions of the heatmap cells
            //      * heights of the heatmap cells
            //      * y-positions of the row side colors
            //      * heights of the row side colors
            // Grouping these another way, we see that there are different 'types'
            // of things that get updated:
            //      * labels (column, row)
            //      * positions (x, y)
            //      * sizes (width, height)
            //      * side colors (column, row)
            //      * heatmap cells
            // For each of these types, col and row should store a reference (with
            // the same name) to the value of that type that is relevant to them
            // (note that we update the heatmap cells regardless, so we can just
            // store this as a global variable):
            //      * col.labels = column labels
            //        row.labels = row labels
            //      * col.pos = x
            //        row.pos = y
            //      * col.size = width
            //        row.size = height
            //      * col.cellsSide = column side colors
            //        row.cellsSide = row side colors
            // We can thus create a function which handles the event where either
            // dim has been zoomed/panned, needing only parameter, the dim, whose
            // 'labels', 'pos', 'size', and 'cellsSide' fields will be used (along
            // with the global reference to the heatmap cells) to determine the
            // visual updates. NOTE the function that actually does this modifies
            // more variables than just those listed here, and additionally the
            // actual field names may be different than they are here.
            //----------------------------------------------------------------------

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
            col.orientation = 'bottom';
            row.orientation = 'right';
            col.offsetMultiplier = 2;
            row.offsetMultiplier = 3;
            col.angled = true;
            row.angled = false;
            col.sizeHeatmap = function () { return me.sizeHeatmap(row) - me.marginAnnoTotal; };
            row.sizeHeatmap = function () { return me.sizeHeatmap(col); };

            dims.forEach(function (dim) {
                dim.stats = me.data.stats[dim.self];
                dim.names = dim.clustOrder;
                dim.currentScope = [0, dim.names.length];
                dim.annotated = (dim.annotations ? true : false);

                if (dim.annotated) {
                    var annosParsed = me.parseAnnotations(dim.annotations);
                    dim.annotations = annosParsed.annotations;
                    dim.labelsAnnotated = annosParsed.labels;
                    dim.annotypes = Object.keys(dim.annotations).sort(function (a, b) { return a.localeCompare(b); });
                    dim.annoBy = dim.annotypes[0];
                    me.setColors(dim);
                }
            });

            //----------------------------------------------------------------------
            // MARGINS
            // A margin is an element's size (in pixels) along an axis (x or y).
            //----------------------------------------------------------------------

            me.setMargins();

            //----------------------------------------------------------------------
            // TOOLTIPS
            // Tooltips provide info on rows/columns, matrix data, and annotations
            // when hovering over the side colors, heatmap cells, and color key.
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

            dims.forEach(function (dim) {
                if (!dim.annotated) {
                    return;
                }

                dim.tooltip = d3.tip()
                    .attr('class', 'd3-tip')
                    .direction('se')
                    .offset([0, 0])
                    .html(function (d) {
                        var keys = Object.keys(d.annos);
                        var html = '<table>';

                        for (var j = 0; j < keys.length; j++) {
                            html += '<tr><td>' + keys[j] + '</td><td>' + d.annos[keys[j]] + '</td></tr>'
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
                            '<tr><td>' + dim.annoBy + '</td><td>' + d + '</td></tr>' +
                            '</table>';
                    });

                // invoke tooltips
                me.container.svg.call(dim.tooltip);
                me.container.svg.call(dim.annoTooltip);
            });

            //----------------------------------------------------------------------
            // SCALES
            // Scales are very useful for determining where visual elements should
            // be placed relative to each other. For example, to determine the sizes
            // and positions of the cells that make up the heatmap, a scale can map
            // an array of row or column names to a continuous range of pixels.
            //----------------------------------------------------------------------

            // scales for determining cell color
            me.scaleCellFill = d3.scaleQuantize();
            me.bucketizer = new d3.Bucketizer(me.dividersBucket, me.colorsBucket);
            me.scaleBucket = d3.scaleBand();
            me.scaleGradient = d3.scaleBand();

            dims.forEach(function (dim) {
                dim.scaleCellPosSize = d3.scaleBand();
                dim.scaleCellMiniPosSize = d3.scaleBand();
                dim.scaleCellMiniOtherPosSize = d3.scaleBand();

                if (dim.annotated) {
                    dim.scaleAnnoColor = d3.scaleBand();
                    dim.annoToNum = (me.categorical
                        ? d3.scaleOrdinal()
                            .domain(dim.annotations[dim.annoBy])
                            .range(d3.range(dim.annotations[dim.annoBy].length))
                        : d3.scalePoint()
                            .domain(dim.annotations[dim.annoBy])
                            .range([0, 0.9])); // must be within [0, 1]
                    dim.numToColor = dim.annoReg;
                }
            });

            me.setScaleDomains();
            me.setScaleRanges();

            //----------------------------------------------------------------------
            // COLOR KEY
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
                        d3.GraphicalElement.prototype.position.call({ group: elements[names[j]].group, anchor: me.anchors[type] });
                    }
                },

                updateCells: function () {
                    var me = this;
                    var names = Object.keys(me.cells);

                    for (var j = 0; j < names.length; j++) {
                        for (var k = 0; k < arguments.length; k++) {
                            me.cells[names[j]].updateVis(arguments[k]);
                        }
                    }
                },

                updateVisLabels: function () {
                    var me = this;
                    var names = Object.keys(me.labels);

                    for (var j = 0; j < names.length; j++) {
                        me.labels[names[j]].updateLabels();
                        me.labels[names[j]].updateVis();
                    }
                },

                addTitle: function (svg, name, text, fontSize) {
                    var me = this;

                    me.titles[name] = new d3.Title(svg, 'bold', text, fontSize);
                },

                addLabels: function (svg, name, labels, margin, fontSize, maxLabelLength) {
                    var me = this;

                    me.labels[name] = new d3.Labels(
                        svg,
                        'labels',
                        margin,
                        me.cells[name].attrs.height,
                        false,
                        fontSize,
                        maxLabelLength,
                        'right'
                    );
                    me.labels[name].updateLabels(labels);
                    me.labels[name].updateVis();
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
            // CELLS
            // These represent groupings of colorful rectangles (row side colors,
            // color keys, heatmap itself).
            //
            // In combination with the axes, these make up all the SVG elements.
            // With the exception of the annotation titles and axes, every visual
            // component can be decomposed into 2 parts:
            //      * group - a g element which gets positioned at an anchor point
            //      * cells - rect elements which live inside the group
            // When a group is tranlated to a new position, all the elements inside
            // of it move as well, and this makes it so that the coordinates (x and
            // y) of cells are relative their group, not to the SVG as a whole.
            //----------------------------------------------------------------------

            me.cells = new d3.ElementCollection(
                me.container.svg,
                'cells',
                'rect',
                {
                    x: function (d) { return col.scaleCellPosSize(d.col); },
                    y: function (d) { return row.scaleCellPosSize(d.row); },
                    width: function () { return col.scaleCellPosSize.bandwidth(); },
                    height: function () { return row.scaleCellPosSize.bandwidth(); },
                    fill: function (d) {
                        if (me.scalingDim === 'none') return me.scaleCellFill(d.value);
                        if (me.scalingDim === 'bucket') return me.bucketizer.bucketize(d.value);
                        var ref = me.data.stats[me.scalingDim][d3.htmlEscape(d[me.scalingDim])];
                        return me.scaleCellFill((d.value - ref.mean) / ref.stdev);
                    }
                },
                {
                    callbacks: {
                        mouseover: function (d) {
                            d3.select(this)
                                .style('opacity', 0.5);
                            dims.forEach(function (dim) {
                                dim.labels.group
                                    .select('#' + d3.htmlEscape(d[dim.self]))
                                    .classed('bold', true);
                                dim.labelsMini.group
                                    .select('#' + d3.htmlEscape(d[dim.self]))
                                    .classed('bold', true);
                            });
                            me.cellTooltip.show(d);
                        },
                        mouseout: function (d) {
                            d3.select(this)
                                .style('opacity', 1);
                            dims.forEach(function (dim) {
                                dim.labels.group
                                    .select('#' + d3.htmlEscape(d[dim.self]))
                                    .classed('bold', false);
                                dim.labelsMini.group
                                    .select('#' + d3.htmlEscape(d[dim.self]))
                                    .classed('bold', false);
                            });
                            me.cellTooltip.hide();
                        }
                    }
                }
            );

            col.cellsMini = new d3.ElementCollection(
                me.container.svg,
                'cells-mini-col',
                'rect',
                {
                    x: function (d) { return col.scaleCellMiniPosSize(d.col); },
                    y: function (d) { return row.scaleCellMiniOtherPosSize(d.row); },
                    width: function () { return col.scaleCellMiniPosSize.bandwidth(); },
                    height: function () { return row.scaleCellMiniOtherPosSize.bandwidth(); },
                    fill: me.cells.attrs.fill // inherit fill attribute from cells
                }
            );

            row.cellsMini = new d3.ElementCollection(
                me.container.svg,
                'cells-mini-row',
                'rect',
                {
                    x: function (d) { return col.scaleCellMiniOtherPosSize(d.col); },
                    y: function (d) { return row.scaleCellMiniPosSize(d.row); },
                    width: function () { return col.scaleCellMiniOtherPosSize.bandwidth(); },
                    height: function () { return row.scaleCellMiniPosSize.bandwidth(); },
                    fill: me.cells.attrs.fill // inherit fill attribute from cells
                }
            );

            me.colorKey.cells.none = new d3.ElementCollection(
                me.container.svg,
                'color-key-cells-none',
                'rect',
                {
                    x: me.zero,
                    y: function (d) { return me.scaleGradient(d); },
                    width: function () { return me.marginAnnoColor; },
                    height: function () { return me.scaleGradient.bandwidth(); },
                    fill: me.identity
                }
            );

            me.colorKey.cells.bucket = new d3.ElementCollection(
                me.container.svg,
                'color-key-cells-bucket',
                'rect',
                {
                    x: me.zero,
                    y: function (d) { return me.scaleBucket(d); },
                    width: function () { return me.marginAnnoColor; },
                    height: function () { return me.scaleBucket.bandwidth(); },
                    fill: me.identity
                }
            );

            // initialize data
            me.cells.updateData(me.data.matrix, me.key);
            col.cellsMini.updateData(me.data.matrix, me.key);
            row.cellsMini.updateData(me.data.matrix, me.key);
            me.colorKey.cells.none.updateData(me.colorsHeatmap, me.identity);
            me.colorKey.cells.bucket.updateData(me.colorsBucket, me.identity);

            // initialize fills
            me.cells.updateVis('fill');
            me.colorKey.cells.none.updateVis('fill');
            me.colorKey.cells.bucket.updateVis('fill');

            me.cells.bindEventListeners();

            dims.forEach(function (dim) {
                me.colorKey.cells[dim.self] = new d3.ElementCollection(
                    me.container.svg,
                    'color-key-cells-' + dim.self,
                    'rect',
                    {
                        x: me.zero,
                        y: function (d) { return me.scaleGradient(d); },
                        width: function () { return me.marginAnnoColor; },
                        height: function () { return me.scaleGradient.bandwidth(); },
                        fill: me.identity
                    }
                );
                me.colorKey.cells[dim.self].updateData(me.colorsHeatmap, me.identity);

                // initialize fills
                dim.cellsMini.updateVis('fill');
                me.colorKey.cells[dim.self].updateVis('fill');

                if (dim.annotated) {
                    dim.cellsSide = new d3.ElementCollection(
                        me.container.svg,
                        'cells-side' + dim.self,
                        'rect',
                        {
                            x: (dim.self === 'col' ? function (d) { return col.scaleCellPosSize(d.key); } : me.zero),
                            y: (dim.self === 'row' ? function (d) { return row.scaleCellPosSize(d.key); } : me.zero),
                            width: (dim.self === 'col' ? me.cells.attrs.width : function () { return row.marginSideColor - me.options.SIDE_COLOR_OFFSET; }),
                            height: (dim.self === 'row' ? me.cells.attrs.height : function () { return col.marginSideColor - me.options.SIDE_COLOR_OFFSET; }),
                            fill: function (d) { return dim.numToColor(dim.annoToNum(d.annos[dim.annoBy])); }
                        },
                        {
                            callbacks: {
                                mouseover: function (d) {
                                    d3.select(this)
                                        .style('opacity', 0.5);
                                    dim.tooltip.show(d);
                                },
                                mouseout: function () {
                                    d3.select(this)
                                        .style('opacity', 1);
                                    dim.tooltip.hide();
                                }
                            }
                        }
                    );
                    dim.cellsSide.updateData(dim.labelsAnnotated, me.key);
                    dim.cellsSide.bindEventListeners();

                    dim.cellsAnno = new d3.ElementCollection(
                        me.container.svg,
                        'cells-anno-' + dim.self,
                        'rect',
                        {
                            x: me.zero,
                            y: function (d) { return dim.scaleAnnoColor(d); },
                            width: function () { return me.marginAnnoColor; },
                            height: function () { return dim.scaleAnnoColor.bandwidth(); },
                            fill: function (d) { return dim.numToColor(dim.annoToNum(d)); }
                        },
                        {
                            callbacks: {
                                mouseover: function (d) {
                                    d3.select(this)
                                        .style('opacity', 0.5);
                                    dim.annoTooltip.show(d);
                                },
                                mouseout: function () {
                                    d3.select(this)
                                        .style('opacity', 1);
                                    dim.annoTooltip.hide();
                                }
                            }
                        }
                    );
                    dim.cellsAnno.updateData(dim.annotations[dim.annoBy], me.identity);
                    dim.cellsAnno.bindEventListeners();

                    // initialize fills
                    dim.cellsSide.updateVis('fill');
                    dim.cellsAnno.updateVis('fill');
                }
            });

            //----------------------------------------------------------------------
            // LABELS
            // These make up all the tickmark-prefaced pieces of text next to cells.
            //
            // The axes provide a visualization for the labels of rows, columns, and
            // annotations. There are 3 parts that go into making a visible axis:
            //      * scale - a d3.scalePoint object whose domain is the labels and
            //          range is the pixel coordinate extent in which to display
            //          them
            //      * axis component - a d3.axis object determining the axis
            //          orientation (top/bottom/left/right)
            //      * SVG element - a g element which makes the axis visible
            // When an axis is to be visually updated, first update its scale, then
            // call its axis component on its SVG element.
            //----------------------------------------------------------------------

            dims.forEach(function (dim) {
                dim.labels = new d3.Labels(
                    me.container.svg,
                    'labels',
                    dim.sizeHeatmap,
                    me.cells.attrs[dim.size],
                    dim.angled,
                    me.options.FONT_SIZE,
                    function () { return dim.marginLabel - dim.offsetMultiplier * me.options.AXIS_OFFSET; },
                    dim.orientation
                );
                dim.labels.updateLabels(dim.names);
                dim.labels.updateVis();

                dim.labelsMini = new d3.Labels(
                    me.container.svg,
                    'labels',
                    dim.sizeHeatmap,
                    me.cells.attrs[dim.size],
                    dim.angled,
                    me.options.FONT_SIZE,
                    function () { return dim.marginLabelMini - dim.offsetMultiplier * me.options.AXIS_OFFSET; },
                    dim.orientation
                );
                dim.labelsMini.updateLabels(dim.names);
                dim.labelsMini.updateVis();

                me.colorKey.addLabels(
                    me.container.svg,
                    dim.self,
                    [String(-me.data.stats.zMax[dim.self].toFixed(2)), '0', String(me.data.stats.zMax[dim.self].toFixed(2))],
                    function () { return me.marginColorKey; },
                    me.options.FONT_SIZE,
                    function () { return me.marginAnnoLabel - 4 * me.options.AXIS_OFFSET; }
                );

                if (dim.annotated) {
                    dim.labelsAnno = new d3.Labels(
                        me.container.svg,
                        'labels',
                        function () { return dim.marginAnnoHeight; },
                        dim.cellsAnno.attrs.height,
                        false,
                        me.options.FONT_SIZE,
                        function () { return me.marginAnnoLabel - 4 * me.options.AXIS_OFFSET; },
                        'right'
                    );
                    dim.labelsAnno.updateLabels(dim.annotations[dim.annoBy]);
                    dim.labelsAnno.updateVis();
                }
            });

            me.colorKey.addLabels(
                me.container.svg,
                'bucket',
                me.dividersBucket.concat([me.dividersBucket[me.dividersBucket.length - 1]]).map(function (d, i) {
                    return i < me.dividersBucket.length ? '< ' + d : '>= ' + d;
                }),
                function () { return me.marginColorKey; },
                me.options.FONT_SIZE,
                function () { return me.marginAnnoLabel - 4 * me.options.AXIS_OFFSET; }
            );

            me.colorKey.addLabels(
                me.container.svg,
                'none',
                [String(me.data.stats.totalMin), String((me.data.stats.totalMin + me.data.stats.totalMax ) / 2), String(me.data.stats.totalMax)],
                function () { return me.marginColorKey; },
                me.options.FONT_SIZE,
                function () { return me.marginAnnoLabel - 4 * me.options.AXIS_OFFSET; }
            );

            //----------------------------------------------------------------------
            // TITLES
            // These represent the titles on the columns of cells at the right.
            //----------------------------------------------------------------------

            me.colorKey.addTitle(me.container.svg, 'bucket', 'Buckets', me.options.FONT_SIZE_CK);
            me.colorKey.addTitle(me.container.svg, 'none', 'Linear Gradient', me.options.FONT_SIZE_CK);

            dims.forEach(function (dim) {
                me.colorKey.addTitle(me.container.svg, dim.self, dim.title + ' Z-Score', me.options.FONT_SIZE_CK);

                if (dim.annotated) {
                    dim.titleAnno = new d3.Title(
                        me.container.svg,
                        'bold',
                        dim.annoBy,
                        me.options.FONT_SIZE_CK
                    );
                }
            });

            //----------------------------------------------------------------------
            // ANCHORS
            // An anchor is a 2-element array describing the pixel coordinates
            // (relative to the SVG, not the webpage as a whole) of the upper-left
            // corner of a visual element. Using the 'transform' attribute of SVG
            // elements, we can position each group of visual elements (for example,
            // all the cells of the heatmap) by simply translating it to the right
            // by its anchor at index 0, and down by its anchor at index 1. Anchors
            // are determined by the margins.
            //----------------------------------------------------------------------

            me.setAnchors();

            //----------------------------------------------------------------------
            // BRUSHES
            // The brushes provide a way to zoom and pan on the main heatmap by
            // selecting regions on brushable heatmaps, and they are made up of 2
            // parts:
            //      * brush component - a d3.brush object (brushX of col, brushY for
            //          row) which defines important properties of the brush, namely
            //          its extent (the maximum pixel area that the user can brush)
            //          and its interactive behavior (what to do when the user
            //          starts/stops brushing, or while they are brushing)
            //      * SVG element - a g element which makes the brush visible and
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
                    me.setExtents();
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

                setExtents () {
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
                function () { return col.cellsMini.anchor; },
                function () { return [col.cellsMini.anchor[0] + col.sizeHeatmap(), col.cellsMini.anchor[1] + col.marginBrush]; },
                0
            );

            row.brusher = new Brush(
                me.container.svg,
                row,
                d3.brushY(),
                function () { me.onBrush(row); },
                function () { me.onEnd(row); },
                function () { return row.cellsMini.anchor; },
                function () { return [row.cellsMini.anchor[0] + row.marginBrush, row.cellsMini.anchor[1] + row.sizeHeatmap()]; },
                1
            );

            //----------------------------------------------------------------------
            // INITIALIZATION
            // One final resize completes the initial rendering of the widget.
            //----------------------------------------------------------------------

            me.resize();
        }

        //--------------------------------------------------------------------------
        // INTERACTIVITY FUNCTIONS
        // These functions determine all the things that can happen in the widget
        // once it is initially rendered.
        //
        // For the brushes (the tools used to zoom/pan), there are 2 functions,
        // onBrush and onEnd, which handle all the updates to the data structures
        // and DOM that are necessary to perform zoom/pan (with the help of helper
        // functions).
        //
        // For the dropdowns in the settings panel, there are 3 functions,
        // updateAnno, updateSort, and updateColorScaling.
        //--------------------------------------------------------------------------

        // updates the current scope of the given dimension and, if renderOnBrushEnd
        // is false, performs visual updates on the main heatmap and side colors
        onBrush (dim) {
            var me = this;

            if (!me.renderOnBrushEnd) {
                // bounds of brushed -> row/column
                var inverses = d3.event.selection.map(dim.brusher.inverter);
                dim.currentScope = [dim.names.indexOf(inverses[0]), dim.names.indexOf(inverses[1]) + 1];
                me.renderScope(dim);
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
                    me.renderScope(dim, me.options.ANIM_DURATION);
                }
            } else {

                // reset scope
                dim.currentScope = [0, dim.names.length];

                // scale updates
                dim.scaleCellPosSize.domain(dim.names);
                dim.labels.updateLabels(dim.names);

                // visual updates
                dim.labels.updateVis(me.options.ANIM_DURATION);
                me.cells.updateVis(dim.pos, dim.size);
                if (dim.annotated) {
                    dim.cellsSide.updateVis(dim.pos, dim.size);
                }
            }
        }

        // renders the currentScope for the given dim, with a transition of
        // animDuration milliseconds (no transition if animDuration is falsy)
        renderScope (dim, animDuration) {
            var me = this;
            var scopeArray = dim.names.slice(dim.currentScope[0], dim.currentScope[1]);
            var inScope = {};

            for (var j = 0; j < scopeArray.length; j++) {
                // NOTE undefined is falsy
                inScope[scopeArray[j]] = true;
            }

            // scale updates
            dim.scaleCellPosSize.domain(scopeArray);
            dim.labels.updateLabels(scopeArray);

            // visual updates
            dim.labels.updateVis(animDuration);
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
                dim.cellsSide.selection
                    .attr(dim.pos, function (d) { return (vis[d.key] ? dim.cellsSide.attrs[dim.pos](d) : 0); })
                    .attr(dim.size, function (d) { return (vis[d.key] ? dim.cellsSide.attrs[dim.size]() : 0); });
            }
        }

        // annotates the rows/columns (depending on dim) and updates the respective
        // annotation colors by the currently selected annotation option for the
        // given dimension
        updateAnno (dimKey, annotype) {
            var me = this;
            var dim = me[dimKey];

            dim.annoBy = annotype;
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
            dim.labelsAnno.updateLabels(values);

            // visual updates
            dim.titleAnno.setText(dim.annoBy);
            dim.cellsAnno.updateData(values, me.identity);
            dim.cellsAnno.updateVis('x', 'y', 'width', 'height', 'fill');
            dim.cellsAnno.bindEventListeners();
            dim.labelsAnno.updateVis();
            dim.cellsSide.selection
                .transition()
                .duration(me.options.ANIM_DURATION)
                .attr('fill', dim.cellsSide.attrs.fill);
        }

        // sorts the rows/columns (depending on dim) of the 3 heatmaps according to
        // the currently selected sorting option for the given dimension
        updateSort (dimKey, annotype) {
            var me = this;
            var dim = me[dimKey];

            // sort the rows/columns by the chosen annotype
            if (annotype === 'Clustered Order') {
                dim.names = dim.clustOrder;
            } else {
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

                dim.names = dim.labelsAnnotated.map(me.key);
            }

            // update scales
            dim.scaleCellPosSize.domain(dim.names);
            dim.scaleCellMiniPosSize.domain(dim.names);
            dim.brusher.inverter.range(dim.names);
            dim.labelsMini.updateLabels(dim.names);

            // visual updates for the brushable heatmaps
            dim.labelsMini.updateVis(me.options.ANIM_DURATION);
            dim.cellsMini.updateVis(dim.pos);
            dim.other.cellsMini.updateVis(dim.pos);
            me.renderScope(dim, me.options.ANIM_DURATION);
        }

        // updates the fill of the heatmap cells based on the currently selected
        // scaling option
        updateColorScaling (scalingDim) {
            var me = this;
            me.scalingDim = scalingDim;

            // scale update
            me.setScaleDomainCellFill();

            // visual updates
            me.colorKey.change(me.scalingDim);
            me.cells.updateVis('fill');
            me.col.cellsMini.updateVis('fill');
            me.row.cellsMini.updateVis('fill');
        }

        updateColors (loColor, hiColor) {
            var me = this;
            me.loColor = (loColor || me.loColor);
            me.hiColor = (hiColor || me.hiColor);
            me.colorsHeatmap = me.interpolateColors(me.loColor, me.mdColor, me.hiColor, me.numColors);

            // scale updates
            me.scaleGradient.domain(me.colorsHeatmap);
            me.setScaleRangesFill();

            // visual updates
            me.cells.updateVis('fill');
            me.dims.forEach(function (dim) {
                dim.cellsMini.updateVis('fill');
                me.colorKey.cells[dim.self].updateData(me.colorsHeatmap, me.identity);
                me.colorKey.cells[dim.self].updateVis('x', 'y', 'width', 'height', 'fill');
            });
        }

        setMargins () {
            var me = this;
            var col = me.col;
            var row = me.row;

            me.marginAnnoTotal = Math.max(Math.floor(me.container.svgWidth / 8), annoMax());
            me.marginAnnoColor = 20;
            me.marginAnnoLabel = me.marginAnnoTotal - me.marginAnnoColor;
            me.marginAnnoTitle = me.options.FONT_SIZE_CK + 2 * me.options.ANNO_TITLE_OFFSET;
            col.marginTotal = me.container.svgHeight;
            row.marginTotal = me.container.svgWidth;
            col.marginLabel = Math.floor(me.container.svgHeight / 10);
            row.marginLabel = Math.floor(me.container.svgWidth / 10);
            col.marginLabelMini = col.marginLabel;
            row.marginLabelMini = row.marginLabel;
            col.marginBrush = Math.floor(me.container.svgHeight / 10);
            row.marginBrush = Math.floor(me.container.svgHeight / 10);
            me.marginColorKey = Math.floor(me.container.svgHeight / 4) - me.marginAnnoTitle;

            me.dims.forEach(function (dim) {
                dim.marginSideColor = (dim.annotated ? Math.floor(me.container.svgHeight / 40) : 0);
                dim.marginAnnoTotal = (dim.annotated ? Math.floor(3 * me.container.svgHeight / 8) : 0);
                dim.marginAnnoHeight = (dim.annotated ? dim.marginAnnoTotal - me.marginAnnoTitle : 0);
            });

            function annoMax () {
                var colTitleLength = (col.titleAnno ? col.titleAnno.getBox().width : 0);
                var rowTitleLength = (row.titleAnno ? row.titleAnno.getBox().width : 0);
                var colorKeyTitleLength = (me.colorKey ? me.colorKey.titles[me.scalingDim].getBox().width : 0);

                return Math.ceil(Math.max(colTitleLength, rowTitleLength, colorKeyTitleLength) + 10);
            }
        }

        setAnchors () {
            var me = this;
            var cells = me.cells;
            var col = me.col;
            var row = me.row;
            var colorKey = me.colorKey;

            cells.anchor = [row.marginSideColor, col.marginSideColor];
            col.labels.anchor = [cells.anchor[0], cells.anchor[1] + row.sizeHeatmap() + me.options.AXIS_OFFSET];
            row.labels.anchor = [cells.anchor[0] + col.sizeHeatmap() + me.options.AXIS_OFFSET, cells.anchor[1]];
            col.cellsMini.anchor = [cells.anchor[0], col.labels.anchor[1] + col.marginLabel];
            row.cellsMini.anchor = [row.labels.anchor[0] + row.marginLabel, cells.anchor[1]];
            col.labelsMini.anchor = [cells.anchor[0], col.cellsMini.anchor[1] + col.marginBrush + me.options.AXIS_OFFSET];
            row.labelsMini.anchor = [row.cellsMini.anchor[0] + row.marginBrush + me.options.AXIS_OFFSET, cells.anchor[1]];

            if (col.annotated) {
                col.cellsSide.anchor = [cells.anchor[0], 0];
                col.cellsAnno.anchor = [row.labelsMini.anchor[0] + row.marginLabelMini, me.marginAnnoTitle];
                col.titleAnno.anchor = [col.cellsAnno.anchor[0], col.cellsAnno.anchor[1] - me.options.ANNO_TITLE_OFFSET];
                col.labelsAnno.anchor = [col.cellsAnno.anchor[0] + me.marginAnnoColor + me.options.AXIS_OFFSET, col.cellsAnno.anchor[1]];
            }

            if (row.annotated) {
                row.cellsSide.anchor = [0, cells.anchor[1]];
                row.cellsAnno.anchor = [row.labelsMini.anchor[0] + row.marginLabelMini, col.marginAnnoTotal + me.marginAnnoTitle];
                row.titleAnno.anchor = [row.cellsAnno.anchor[0], row.cellsAnno.anchor[1] - me.options.ANNO_TITLE_OFFSET];
                row.labelsAnno.anchor = [row.cellsAnno.anchor[0] + me.marginAnnoColor + me.options.AXIS_OFFSET, row.cellsAnno.anchor[1]];
            }

            colorKey.anchors.cells = [row.labelsMini.anchor[0] + row.marginLabelMini, col.marginAnnoTotal + row.marginAnnoTotal + me.marginAnnoTitle];
            colorKey.anchors.labels = [colorKey.anchors.cells[0] + me.marginAnnoColor + me.options.AXIS_OFFSET, colorKey.anchors.cells[1]];
            colorKey.anchors.titles = [colorKey.anchors.cells[0], colorKey.anchors.cells[1] - me.options.ANNO_TITLE_OFFSET];
        }

        setScaleDomains () {
            var me = this;

            me.setScaleDomainCellFill();
            me.scaleBucket.domain(me.colorsBucket);
            me.scaleGradient.domain(me.colorsHeatmap);

            me.dims.forEach(function (dim) {
                dim.scaleCellPosSize.domain(dim.names);
                dim.scaleCellMiniPosSize.domain(dim.names);
                dim.scaleCellMiniOtherPosSize.domain(dim.names);

                if (dim.annotated) {
                    dim.scaleAnnoColor.domain(dim.annotations[dim.annoBy]);
                }
            });
        }

        setScaleDomainCellFill () {
            var me = this;

            // NOTE no scale update for 'bucket'
            if (me.scalingDim === 'none') {
                me.scaleCellFill.domain([me.data.stats.totalMin, me.data.stats.totalMax]);
            } else if (me.scalingDim === 'col' || me.scalingDim === 'row') {
                me.scaleCellFill.domain([-me.data.stats.zMax[me.scalingDim], me.data.stats.zMax[me.scalingDim]]);
            }
        }

        setScaleRangesPositional () {
            var me = this;

            me.dims.forEach(function (dim) {
                dim.scaleCellPosSize.range([0, dim.sizeHeatmap()]);
                dim.scaleCellMiniPosSize.range([0, dim.sizeHeatmap()]);
                dim.scaleCellMiniOtherPosSize.range([0, dim.other.marginBrush]);

                if (dim.annotated) {
                    dim.scaleAnnoColor.range([0, dim.marginAnnoHeight]);
                }
            });

            me.scaleBucket.range([0, me.marginColorKey]);
            me.scaleGradient.range([0, me.marginColorKey]);
        }

        setScaleRangesFill () {
            var me = this;

            me.scaleCellFill.range(me.colorsHeatmap);
        }

        setScaleRanges () {
            var me = this;

            me.setScaleRangesPositional();
            me.setScaleRangesFill();
        }

        resize (width, height) {
            var me = this;
            me.container.resize(width, height);

            me.setMargins();
            me.setAnchors();
            me.setScaleRanges();

            me.dims.forEach(function (dim) {
                dim.brusher.setExtents();
            });

            me.positionElements();

            me.dims.forEach(function (dim) {
                if (dim.currentScope[0] !== 0 || dim.currentScope[1] !== dim.names.length) {
                    dim.brusher.brushToScope();
                } else {
                    dim.brusher.clearBrush();
                }
            });
        }

        positionElements () {
            var me = this;

            me.cells.position();
            me.cells.updateVis('x', 'y', 'width', 'height');
            me.colorKey.updateCells('x', 'y', 'width', 'height');
            me.colorKey.positionElements('cells');
            me.colorKey.positionElements('labels');
            me.colorKey.updateVisLabels();
            me.colorKey.positionElements('titles');
            me.colorKey.change(me.scalingDim);

            me.dims.forEach(function (dim) {
                dim.labels.position();
                dim.labels.updateVis();
                dim.labelsMini.position();
                dim.labelsMini.updateLabels();
                dim.labelsMini.updateVis();
                dim.cellsMini.position();
                dim.cellsMini.updateVis('x', 'y', 'width', 'height');
                dim.brusher.callBrush();

                if (dim.annotated) {
                    dim.labelsAnno.position();
                    dim.labelsAnno.updateLabels();
                    dim.labelsAnno.updateVis();
                    dim.cellsSide.position();
                    dim.cellsSide.updateVis('x', 'y', 'width', 'height');
                    dim.cellsAnno.position();
                    dim.cellsAnno.updateVis('x', 'y', 'width', 'height');
                    dim.titleAnno.position();
                }
            });
        }

        setColors (dim) {
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
            return dim.marginTotal - dim.marginSideColor - dim.marginLabel - dim.marginBrush - dim.marginLabelMini;
        }

        //--------------------------------------------------------------------------
        // PARSING FUNCTIONS
        // These take strings in CSV format (or objects) and turn them into the data
        // structures needed for the heatmap.
        //--------------------------------------------------------------------------

        // parses the given string into the data structures used for generating the
        // heatmap
        parseDataset (file) {
            var me = this;
            var matrix, colnames, rownames;

            // this will hold all relevant statistics for the data
            var stats = {
                col: {},
                row: {},
                zMax: {
                    col: 0,
                    row: 0
                },
                totalMin: Number.POSITIVE_INFINITY,
                totalMax: Number.NEGATIVE_INFINITY
            };

            // get matrix, colnames, rownames
            // TODO handle the case where 'file' is an array???
            if (typeof file === 'object') {

                // NOTE assume these have already been parsed
                matrix = file.matrix;
                colnames = file.colnames;
                rownames = file.rownames;
            } else if (typeof file === 'string') {

                // parse the string into an array of arrays
                var parsedRows = d3.csvParseRows(file);

                // column names should be stored in the first row
                colnames = parsedRows.shift();

                // remove whatever name was given to the column containing the row
                // names
                colnames.shift();

                // the array of rownames will grow as we process each row
                rownames = [];

                // traverse the parsed rows to create the matrix (a doubly-nested
                // array) for the heatmap, adding to the rownames array and updating
                // the stats object as we go
                matrix = d3.range(parsedRows.length).map(function (j) {
                    // grab the row name out of the parsed row. This makes
                    // parsedRows[j] the same length as colnames, with
                    // parsedRows[j][k] being the value in row 'rowname'
                    // and column 'colnames[k]'
                    var rowname = parsedRows[j].shift();

                    // add the new row name to the list of row names
                    rownames.push(rowname);

                    // traverse the parsed row, reformatting each element (a number)
                    return d3.range(colnames.length).map(function (k) {
                        return {
                            key: j + ' ' + k, // useful for d3 data joins
                            col: colnames[k], // position (x), size (width), fill
                            row: rowname, // position (y), size (height), fill
                            value: +parsedRows[j][k] // fill
                        };
                    });
                });
            }

            matrix.forEach(function (array) {
                array.forEach(function (element) {
                    updateStats(stats, 'col', d3.htmlEscape(element.col), element.value);
                    updateStats(stats, 'row', d3.htmlEscape(element.row), element.value);
                });
            });

            // perform final calculations of the stats for each column, and find the
            // totalMin and totalMax of the data (this could also be done in the
            // final calculations for the row stats)
            var cStatNames = Object.keys(stats.col);

            for (var j = 0; j < cStatNames.length; j++) {
                finalCalculations(stats, 'col', cStatNames[j], rownames.length);

                // reassign min/max if necessary
                stats.totalMin = Math.min(stats.totalMin, stats.col[cStatNames[j]].min);
                stats.totalMax = Math.max(stats.totalMax, stats.col[cStatNames[j]].max);
            }

            // perform final calculations of the stats for each row
            var rStatNames = Object.keys(stats.row);

            for (var j = 0; j < rStatNames.length; j++) {
                finalCalculations(stats, 'row', rStatNames[j], colnames.length);
            }

            // find the z-score in the data with the largest magnitude
            for (var j = 0; j < matrix.length; j++) {
                for (var k = 0; k < matrix[j].length; k++) {
                    // grab the value and compute its z-score for to its row/col
                    var value = matrix[j][k].value;
                    var colname = d3.htmlEscape(colnames[k]);
                    var rowname = d3.htmlEscape(rownames[j]);
                    var colZ = (value - stats.col[colname].mean) / stats.col[colname].stdev;
                    var rowZ = (value - stats.row[rowname].mean) / stats.row[rowname].stdev;

                    // reassign maxes if necessary
                    stats.zMax.col = Math.max(stats.zMax.col, Math.abs(colZ));
                    stats.zMax.row = Math.max(stats.zMax.row, Math.abs(rowZ));
                }
            }

            // updates the stats object for the given dimension at the given name
            // with the given value
            function updateStats (stats, dim, name, value) {
                if (stats[dim][name] === undefined) {
                    // if not yet seen, give it a fresh new stats object
                    // NOTE an stdev field will be added to this object during final
                    // calculations
                    stats[dim][name] = {
                        min: value, // helps to find most negative z-score
                        max: value, // helps to find most positive z-score
                        mean: 0, // used in calculating standard deviation/z-scores
                        meanOfSquares: 0 // used in calculating standard deviation
                    };
                }

                stats[dim][name].min = Math.min(stats[dim][name].min, value);
                stats[dim][name].max = Math.max(stats[dim][name].max, value);
                stats[dim][name].mean += value; // this will be averaged later
                stats[dim][name].meanOfSquares += value * value; // averaged later
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
                matrix: flatten(matrix), // array of objects (key, col, row, value)
                rownames: rownames, // array of strings
                colnames: colnames, // array of strings
                stats: stats // object with 5 fields: row and col (hashmaps from
                    // row/col name to object of statistics, zMax stores largest
                    // z-score (by magnitude) for both row and col, and
                    // totalMin/totalMax store min and max of the data
            };
        }

        // parses the given string into the data structures used for annotating and
        // sorting the heatmap
        parseAnnotations (file) {
            var me = this;

            // add a nameKey if there isn't one
            file = (file.charAt(0) === ',' ? 'Name' + file : file);

            // this will be used as a readable name if a cell only holds ''
            var NA = '{ no data }';

            // parse the file into an array of arrays
            var parsedRows = d3.csvParseRows(file);

            // the names of the different kinds of annotations should be stored in
            // the first row of the file
            var annotypes = parsedRows.shift(); // NOTE modifies parsedRows as well

            // periods in names of annotypes will mess up JS code
            annotypes = annotypes.map(d3.htmlEscape);

            // trims annotypes down to JUST the actual annotation types
            var nameKey = annotypes.shift();

            // each type of annotation will map to a sorted array of its unique
            // values
            var annotations = {};

            for (var j = 0; j < annotypes.length; j++) {
                annotations[annotypes[j]] = [];
            }

            // examine all values for each annotation type and add them to the
            // hashmap of annotation types -> array of unique values
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
                    // give a readable name if blank
                    var value = (values[k] || NA);

                    // add this value into the array of unique values for its
                    // corresponding annotation type
                    if (annotations[annotypes[k]].indexOf(value) < 0) {
                        annotations[annotypes[k]].push(value);
                    }
                }
            }

            // sort each annotation type's values (numerically if both numbers,
            // otherwise lexicographically)
            for (var j = 0; j < annotypes.length; j++) {

                annotations[annotypes[j]].sort(function (a, b) {
                    if (!isNaN(a) && !isNaN(b)) {
                        return (+a) - (+b);
                    }

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
                var objClean = {};
                var keys = Object.keys(obj);

                for (var j = 0; j < keys.length; j++) {
                    objClean[d3.htmlEscape(keys[j])] = (obj[keys[j]] || NA);
                }

                return {
                    key: objClean[nameKey], // corresponds to name of the row/column
                    annos: objClean
                };
            });

            return {
                annotations: annotations, // hash str -> str[] (annotypes -> values)
                labels: labels // array of objects (annotated dimension names)
            };
        }
    }

    exports.Heatmap = Heatmap;

    Object.defineProperty(exports, '__esModule', { value: true });
}));
