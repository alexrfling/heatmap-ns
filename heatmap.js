//--------------------------------------------------------------------------------------------------
//                                      BEGIN HEATMAP FUNCTION
//--------------------------------------------------------------------------------------------------

function heatmap(id, datasetFile, colAnnoFile, rowAnnoFile, colClustOrder, rowClustOrder,
                 height, renderOnBrushEnd = false, categorical = true,
                 categoricalScheme = "google", continuousScheme = "rainbow",
                 annoHeatScheme = "plasma", animDuration = 1200,
                 sideColorPadding = 3, annoTitlePadding = 7, axisOffset = 5,
      					 fontSize = 9, fontSizeCK = 11,
      					 lowColor = "cornflowerblue", midColor = "black", highColor = "orange",
      					 numColors = 256) { // NOTE: ES6 needed to support default parameters

  var colors = getColors();

  var holder = document.getElementById(id),
      holderSize = holder.getBoundingClientRect(),
      width = holderSize.width;

  var margin = {top: 3, right: 3, bottom: 3, left: 3};
  width = width - margin.left - margin.right;
  height = height - margin.top - margin.bottom;

  // the "dims" will hold all elements relevant to the rows and columns of the data, separately
  var col = {}, row = {};

  // parse the files (.csv strings) and assign the data structures to col and row fields
  var dataset = parseDataMatrix(datasetFile);

  col.stats       = dataset.stats.col;
  col.clustOrder  = colClustOrder || dataset.colnames;
  col.names				= colClustOrder || dataset.colnames;

  row.stats       = dataset.stats.row;
  row.clustOrder  = rowClustOrder || dataset.rownames;
  row.names				= rowClustOrder || dataset.rownames;

  (function() {
    if (colAnnoFile) {
      var colAnnosParsed     = parseAnnotations(colAnnoFile); // TODO: optionalize
      col.annoTypesAndValues = colAnnosParsed.annoTypesAndValues;
      col.labelsAnnotated    = colAnnosParsed.labels;
    }
  })();

  (function() {
    if (rowAnnoFile) {
      var rowAnnosParsed     = parseAnnotations(rowAnnoFile); // TODO: optionalize
      row.annoTypesAndValues = rowAnnosParsed.annoTypesAndValues;
      row.labelsAnnotated    = rowAnnosParsed.labels;
    }
  })();

  col.annotated = col.annoTypesAndValues && col.labelsAnnotated ? true : false;
  row.annotated = row.annoTypesAndValues && row.labelsAnnotated ? true : false;

  //------------------------------------------------------------------------------------------------
  //                                 				REFERENCES BY DIM
  //
  // Note that the row and col objects are mirror images of each other; every field that col has,
  // row also has, and vice-versa. They could be made into objects of the same new class, but its
  // much easier to just build them as we go along and think of them more as growing lists
  // containing everything that's relevant to their respective dimension.
  //
  // For example, when we zoom and pan using the brush for the columns, the only things that need
  // to get visually updated are:
  //		* column labels
  //		* x-coordinates of the heatmap cells
  //		* widths of the heatmap cells
  //		* x-coordinates of the column side colors
  //		* heights of the column side colors
  // Similarly, when doing the same thing to the rows, we need only be concerned with updating:
  //		* row labels
  //		* y-coordinates of the heatmap cells
  //		* heights of the heatmap cells
  //		* y-coordinates of the row side colors
  //		* heights of the row side colors
  // Grouping these another way, we see that there are different "types" of things that get updated:
  //		* labels (column, row)
  //		* coordinates (x, y)
  //		* lengths (width, height)
  //		* side colors (column, row)
  //		* heatmap cells
  // For each of these types, col and row should store a reference (with the same name) to the value
  // of that type that is relevant to them (note that we update the heatmap cells regardless, so we
  // can just store this as a global variable):
  //		* col.labels = column labels
  //			row.labels = row labels
  //		* col.coordinate = x
  //			row.coordiante = y
  //		* col.length = width
  //			row.length = height
  //		* col.sideColors = column side colors
  //			row.sideColors = row side colors
  // We can thus create a function which handles the event where either dim has been zoomed/panned,
  // needing only parameter, the dim, whose "labels", "coordinate", "length", and "sideColors"
  // fields will be used (along with the global reference to the heatmap cells) to determine the
  // visual updates. NOTE: the function that actually does this modifies more variables than just
  // those that are listed here, and additionally the actual field names may be different than they
  // are here.
  //
  // And that's the concept behind the "dim".
  //
  //------------------------------------------------------------------------------------------------

  // set the current scope for each dimension (these get modified by interactivity functions)
  col.currentScope = [Math.floor(col.names.length / 32), Math.ceil(5 * col.names.length / 32)];
  row.currentScope = [Math.floor(row.names.length / 4), Math.ceil(7 * row.names.length / 8)];

  col.other 		= row;
  col.self   		= "col";
  col.title     = "Column";
  col.pos 			= "x";
  col.size 			= "width";
  col.factor    = 0.75;

  if (col.annotated) {
    col.idSortBy  = "colSortBy"; // TODO: optionalize
    col.idAnnoBy  = "colAnnoBy";
  }

  row.other 		= col;
  row.self  		= "row";
  row.title     = "Row";
  row.pos 			= "y";
  row.size 			= "height";
  row.factor    = 1;

  if (row.annotated) {
    row.idSortBy  = "rowSortBy"; // TODO: optionalize
    row.idAnnoBy  = "rowAnnoBy";
  }

  col.handles   = [".handle--w", ".handle--e"]; // TODO: remove these???
  row.handles   = [".handle--n", ".handle--s"];

  col.sizeHeatmap   	= widthHeatmap;
  row.sizeHeatmap   	= heightHeatmap;

  col.posCell       	= xCell;
  col.sizeCell      	= widthCell;
  col.posCellBrush   	= xCellRight;
  col.sizeCellBrush  	= widthCellRight;

  if (col.annotated) {
    col.sizeSideColor = widthColSideColor; // TODO: optionalize
    col.posSideColor 	= xColSideColor; // TODO: optionalize
  }

  row.posCell       	= yCell;
  row.sizeCell      	= heightCell;
  row.posCellBrush   	= yCellBottom;
  row.sizeCellBrush  	= heightCellBottom;

  if (row.annotated) {
    row.sizeSideColor = heightRowSideColor; // TODO: optionalize
    row.posSideColor 	= yRowSideColor; // TODO: optionalize
  }

  // TODO: optionalize
  col.xSideColor      = xColSideColor;
  col.ySideColor      = yColSideColor;
  col.widthSideColor  = widthColSideColor;
  col.heightSideColor = heightColSideColor;
  col.fillSideColor   = fillColSideColor;

  // TODO: optionalize
  row.xSideColor      = xRowSideColor;
  row.ySideColor      = yRowSideColor;
  row.widthSideColor  = widthRowSideColor
  row.heightSideColor = heightRowSideColor;
  row.fillSideColor   = fillRowSideColor;

  // TODO: optionalize
  col.xAnnoColor 			= xColAnnoColor;
  col.yAnnoColor      = yColAnnoColor;
  col.widthAnnoColor 	= widthColAnnoColor;
  col.heightAnnoColor = heightColAnnoColor;
  col.fillAnnoColor   = fillColAnnoColor;

  // TODO: optionalize
  row.xAnnoColor 			= xRowAnnoColor;
  row.yAnnoColor      = yRowAnnoColor;
  row.widthAnnoColor 	= widthRowAnnoColor;
  row.heightAnnoColor = heightRowAnnoColor;
  row.fillAnnoColor   = fillRowAnnoColor;

  col.updateAxis      = updateColAxis;
  col.updateAxisNT    = updateColAxisNT;

  row.updateAxis      = updateRowAxis;
  row.updateAxisNT    = updateRowAxisNT;

  //------------------------------------------------------------------------------------------------
  //                                              MARGINS
  //
  // A margin describes a visual element's length in pixels along one axis/dimension.
  //
  //------------------------------------------------------------------------------------------------

  var marginAnnoColor;
  var marginAnnoLabel;
  marginsSetup(width, height);

  function marginsSetup(w, h) {
  	var colLabelMax = lengthOfLongest(col.names);
    col.marginTotal 		= h;

    // TODO: optionalize
    col.marginSideColor = col.annotated ? h / 40 : 0;

    col.marginLabel     = axisOffset + colLabelMax * 5; // 5 = 7 / sqrt(2)
    col.marginBrush     = h / 10;
    col.marginSubLabel  = axisOffset + colLabelMax * 5; // 5 = 7 / sqrt(2)

    marginAnnoColor = col.annotated || row.annotated ? h / 20 : 0;
    marginAnnoLabel = col.annotated || row.annotated ?
                                    (col.annotypeAnno ? annoMax() * 7 : 76) : 0;

    // TODO: optionalize
    col.marginAnnoColor = col.annotated ? marginAnnoColor : 0;
    col.marginAnnoLabel = col.annotated ? marginAnnoLabel : 0;
    col.marginAnnoTitle = col.annotated ? fontSizeCK + 2 * annoTitlePadding : 0;
    col.marginAnnoHeight = col.annotated ? h / 2 - col.marginAnnoTitle : 0;

    var rowLabelMax = lengthOfLongest(row.names);
    row.marginTotal 		= w;

    // TODO: optionalize
    row.marginSideColor = row.annotated ? h / 40 : 0;

    row.marginLabel     = axisOffset + rowLabelMax * 7; // 7 is pretty good for this font
    row.marginBrush     = h / 10;
    row.marginSubLabel  = axisOffset + rowLabelMax * 7; // 7 is pretty good for this font

    // TODO: optionalize
    row.marginAnnoColor = row.annotated ? marginAnnoColor : 0;
    row.marginAnnoLabel = row.annotated ? marginAnnoLabel : 0;
    row.marginAnnoTitle = row.annotated ? fontSizeCK + 2 * annoTitlePadding : 0;
    row.marginAnnoHeight = row.annotated ? h / 2 - row.marginAnnoTitle : 0;
  }

  function annoMax() {
  	return Math.max(
  		lengthOfLongest(col.annoTypesAndValues[col.annotypeAnno]),
  		lengthOfLongest(row.annoTypesAndValues[row.annotypeAnno])
  	);
  }

  //------------------------------------------------------------------------------------------------
  //                                             ANCHORS
  //
  // An anchor is a 2-element array describing the pixel coordinates (relative to the SVG, not the
  // webpage as a whole) of the upper-left corner of a visual element. Using the "transform"
  // attribute of SVG elements, we can position each group of visual elements (for example, all the
  // cells of the heatmap) by simply translating it to the right by its anchor at index 0, and down
  // by its anchor at index 1. Anchors are determined by the margins.
  //
  //------------------------------------------------------------------------------------------------

  var anchorHeatmap; // the only anchor not associated with row or col
  anchorsSetup(width, height);

  function anchorsSetup(w, h) { // w not yet used
  	anchorHeatmap       = [row.marginSideColor, col.marginSideColor]; // TODO: optionalize

    // TODO: optionalize
    col.anchorSideColor = [anchorHeatmap[0], 0];
    row.anchorSideColor = [0, anchorHeatmap[1]];

    col.anchorLabel     = [anchorHeatmap[0], anchorHeatmap[1] + heightHeatmap() + axisOffset];
    row.anchorLabel     = [anchorHeatmap[0] + widthHeatmap() + axisOffset, anchorHeatmap[1]];
    col.anchorBrush     = [anchorHeatmap[0], col.anchorLabel[1] + col.marginLabel];
    row.anchorBrush     = [row.anchorLabel[0] + row.marginLabel, anchorHeatmap[1]];
    col.anchorSubLabel  = [anchorHeatmap[0], col.anchorBrush[1] + col.marginBrush + axisOffset];
    row.anchorSubLabel  = [row.anchorBrush[0] + row.marginBrush + axisOffset, anchorHeatmap[1]];

    // TODO: optionalize
    col.anchorAnnoColor = [row.anchorSubLabel[0] + row.marginSubLabel, col.marginAnnoTitle];
    row.anchorAnnoColor = [col.anchorAnnoColor[0], col.anchorAnnoColor[1] + col.marginAnnoHeight
    																																				+ row.marginAnnoTitle];
    col.anchorAnnoTitle = [col.anchorAnnoColor[0], col.anchorAnnoColor[1] - annoTitlePadding];
    row.anchorAnnoTitle = [row.anchorAnnoColor[0], row.anchorAnnoColor[1] - annoTitlePadding];
    col.anchorAnnoLabel = [col.anchorAnnoColor[0] + col.marginAnnoColor + axisOffset,
    																																				col.anchorAnnoColor[1]];
    row.anchorAnnoLabel = [row.anchorAnnoColor[0] + row.marginAnnoColor + axisOffset,
    																																				row.anchorAnnoColor[1]];
  }

  //------------------------------------------------------------------------------------------------
  //                               						CONTROL PANEL
  //
  //
  //
  //------------------------------------------------------------------------------------------------

  // TODO: implement resizability for real
  window.addEventListener("resize", resizeSVG);
  var boundsViewer = d3.select("body").append("p");

  var container = d3.select("#" + id),  // a d3 selection of the DOM element the user passed in
  		SVG = container.append("svg")     // the actual SVG
		  							.attr("width", width + margin.left + margin.right)
		  							.attr("height", height + margin.top + margin.bottom),
  		svg = SVG.append("g")             // the pseudo-SVG
  						.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  var scaleBy,
  		scalingDim;

  var settingsPanel = settingsPanelSetup();

  var settingsVisible = false;
  var button = svg.append("rect")
  	.attr("x", row.anchorBrush[0])
  	.attr("y", col.anchorBrush[1])
  	.attr("width", row.marginBrush)
  	.attr("height", col.marginBrush)
  	.attr("fill", "green")
  	.on("click", function() {
  		//var obj = container.getBoundingClientRect();//,
        	//anchor = [obj.left + anchorHeatmap[0] + window.pageXOffset,
          //        	obj.top + anchorHeatmap[1] + window.pageYOffset];
      //boundsViewer.text(obj.left);
  		settingsPanel.style("left", 0 + "px")
               		 .style("top", 	0 + "px")
  								 .classed("hidden", settingsVisible);
  		settingsVisible = !settingsVisible;
  	});

  function settingsPanelSetup() {
  	var panel = container.append("div").attr("id", "settings").attr("draggable", "true")
  								.attr("class", "tooltip").classed("hidden", true);
    panel.append("p").text("Settings");
  	var table = panel.append("table"),
  			row1 = table.append("tr");
  	if (col.annotated) {
      var row2 = table.append("tr"),
  		    row3 = table.append("tr");
    }
    if (row.annotated) {
      var row4 = table.append("tr"),
  		    row5 = table.append("tr");
    }
  	row1.append("td").append("p").text("Scale by");
  	if (col.annotated) row2.append("td").append("p").text("Annotate columns by");
  	if (col.annotated) row3.append("td").append("p").text("Sort columns by");
  	if (row.annotated) row4.append("td").append("p").text("Annotate rows by");
  	if (row.annotated) row5.append("td").append("p").text("Sort rows by");

  	scaleBy = row1.append("td").append("select").attr("id", "scaleBy")
  								.on("change", function() { updateColorScaling(this.value); });
  	scaleBy.selectAll("option")
      .data([{ value: col.self, text: col.title },
          	 { value: row.self, text: row.title },
          	 { value: "none", text: "None" }])
      .enter()
      .append("option")
      .attr("value", function(d) { return d.value; })
      .text(function(d) { return d.text; });

    if (col.annotated) {
      col.annoBy = controlsSetup(row2, col, col.idAnnoBy, annoUpdate);
      col.sortBy = controlsSetup(row3, col, col.idSortBy, sortUpdate);
      annoOptionsSetup(col.annoBy, col);
      sortOptionsSetup(col.sortBy, col);
    }

    if (row.annotated) {
    	row.annoBy = controlsSetup(row4, row, row.idAnnoBy, annoUpdate);
    	row.sortBy = controlsSetup(row5, row, row.idSortBy, sortUpdate);
    	annoOptionsSetup(row.annoBy, row);
    	sortOptionsSetup(row.sortBy, row);
    }

  	scalingDim = document.getElementById("scaleBy").value;
  	if (col.annotated) col.annotypeAnno = document.getElementById(col.idAnnoBy).value;
  	if (row.annotated) row.annotypeAnno = document.getElementById(row.idAnnoBy).value;

  	return panel;
  }

  //------------------------------------------------------------------------------------------------
  //                                            TOOLTIPS
  //
  // Tooltips provide information for rows, columns, matrix data, and annotations when hovering over
  // the side colors, heatmap cells, and color key.
  //
  //------------------------------------------------------------------------------------------------

  var cellTooltip = cellTooltipSetup();
  var annoTooltip = annoTooltipSetup();
  if (col.annotated) col.tooltip 		= sideTooltipSetup(col);
  if (row.annotated) row.tooltip 		= sideTooltipSetup(row);

  //------------------------------------------------------------------------------------------------
  //                                             	SCALES
  //
  // Scales are very useful for determining where visual elements should be placed relative to each
  // other. For example, to determine the sizes and positions of the cells that make up the heatmap,
  // a scale can map an array of row or column names to a continuous range of pixels.
  //
  //------------------------------------------------------------------------------------------------

  // scales for determining cell color
  var mainColorScale = d3.scaleQuantize()
                        .domain([-dataset.stats.zMax[scalingDim], dataset.stats.zMax[scalingDim]])
                        .range(colors.heatmap);
  if (!categorical) {
    if (col.annotated) {
      col.annoToNum = d3.scalePoint()
      									.domain(col.annoTypesAndValues[col.annotypeAnno])
      									.range([0, 0.9]); // must be within [0, 1]
      col.numToColor = colors.continuous;
    }
    if (row.annoated) {
      row.annoToNum = d3.scalePoint()
      									.domain(row.annoTypesAndValues[row.annotypeAnno])
      									.range([0, 0.9]); // must be within [0, 1]
      row.numToColor = colors.continuous;
    }
  } else {
    if (col.annotated) {
      col.annoToNum = d3.scaleOrdinal()
      									.domain(col.annoTypesAndValues[col.annotypeAnno])
      									.range(d3.range(col.annoTypesAndValues[col.annotypeAnno].length));
      col.numToColor = function(index) {
        return colors.categorical[index % colors.categorical.length];
      };
    }
    if (row.annotated) {
      row.annoToNum = d3.scaleOrdinal()
      									.domain(row.annoTypesAndValues[row.annotypeAnno])
      									.range(d3.range(row.annoTypesAndValues[row.annotypeAnno].length));
      row.numToColor = function(index) {
        return colors.categorical[index % colors.categorical.length];
      };
    }
  }

  // scales for cell dimensions/positioning. These will map row/col names to x/y/width/height based
  // on the margins in which the cells reside
  col.scaleCell      = d3.scaleBand(); // col.names, widthHeatmap -> x, width of cells
  row.scaleCell      = d3.scaleBand(); // row.names, heightHeatmap -> y, height of cells
  col.scaleCellBrush = d3.scaleBand(); // col.names, row.marginBrush -> x, width of cellsRight
  row.scaleCellBrush = d3.scaleBand(); // row.names, col.marginBrush -> y, height of cellsBottom
  if (col.annotated) col.scaleAnnoColor = d3.scaleBand().domain(col.annoTypesAndValues[col.annotypeAnno]);
  if (row.annotated) row.scaleAnnoColor = d3.scaleBand().domain(row.annoTypesAndValues[row.annotypeAnno]);

  // scales for the labels of the rows, columns, and annotations
  row.scaleLabel 		 = d3.scalePoint();
  col.scaleLabel 		 = d3.scalePoint();
  row.scaleSubLabel  = d3.scalePoint();
  col.scaleSubLabel  = d3.scalePoint();
  if (col.annotated) col.scaleAnnoLabel = d3.scalePoint();
  if (row.annotated) row.scaleAnnoLabel = d3.scalePoint();

  // these take in pixel coordinates from the brushed area and spit out the row/column names which
  // are to be displayed in the main heatmap
  row.scaleInverter = d3.scaleQuantize().range(row.names);
  col.scaleInverter = d3.scaleQuantize().range(col.names);

  scalesSetup(width, height);

  function scalesSetup(width, height) {
    col.scaleCell.domain(col.names).range([0, widthHeatmap()]);
    row.scaleCell.domain(row.names).range([0, heightHeatmap()]);
    col.scaleCellBrush.domain(col.names).range([0, row.marginBrush]);
    row.scaleCellBrush.domain(row.names).range([0, col.marginBrush]);
    if (col.annotated) col.scaleAnnoColor.range([0, col.marginAnnoHeight]);
    if (row.annotated) row.scaleAnnoColor.range([0, row.marginAnnoHeight]);

    // the ranges for the label scales are the same as for their corresponding cell scales, but
    // with the ends cut by half the width/height of one of the associated cells (this makes it
    // so that the labels/tickmarks are centered on the cells)
    row.scaleLabel.domain(sample(row.names, Math.floor(heightHeatmap() / fontSize)))
             			.range([heightCell() / 2, heightHeatmap() - heightCell() / 2]);
    col.scaleLabel.domain(sample(col.names,
    																						Math.floor(col.factor * widthHeatmap() / fontSize)))
             			.range([widthCell() / 2, widthHeatmap() - widthCell() / 2]);
    row.scaleSubLabel.domain(sample(row.names, Math.floor(heightHeatmap() / fontSize)))
             				 .range([heightCell() / 2, heightHeatmap() - heightCell() / 2]);
    col.scaleSubLabel.domain(sample(col.names,
    																						Math.floor(col.factor * widthHeatmap() / fontSize)))
             				 .range([widthCell() / 2, widthHeatmap() - widthCell() / 2]);
    if (col.annotated) {
      col.scaleAnnoLabel.domain(sample(col.annoTypesAndValues[col.annotypeAnno],
    																									Math.floor(col.marginAnnoHeight / fontSize)))
                        .range([col.heightAnnoColor() / 2,
                      													col.marginAnnoHeight - col.heightAnnoColor() / 2]);
    }
    if (row.annotated) {
      row.scaleAnnoLabel.domain(sample(row.annoTypesAndValues[row.annotypeAnno],
    																									Math.floor(row.marginAnnoHeight / fontSize)))
                        .range([row.heightAnnoColor() / 2,
                      													row.marginAnnoHeight - row.heightAnnoColor() / 2]);
    }

    // the domains of the inverters should be the same as the extents of their corresponding brushes
    row.scaleInverter.domain([row.anchorBrush[1], row.anchorBrush[1] + heightHeatmap()]);
    col.scaleInverter.domain([col.anchorBrush[0], col.anchorBrush[0] + widthHeatmap()]);
  }

  //------------------------------------------------------------------------------------------------
  //                                             	AXES
  //
  // The axes provide a visualization for the labels of rows, columns, and annotations. There are 3
  // parts that go into making a visible axis:
  //		* scale - a d3.scalePoint object whose domain is the labels and range is the pixel
  //							coordinate extent in which to display them
  //		* axis component - a d3.axis object determining the axis orientation (top/bottom/left/right)
  //		* SVG element - a g element which makes the axis visible
  // When an axis is to be visually updated, first update its scale, then call its axis component on
  // its SVG element.
  //
  //------------------------------------------------------------------------------------------------

  // axis components (note that these are not yet added to the svg, so they aren't visible)
  row.axisMain = d3.axisRight(row.scaleLabel);
  col.axisMain = d3.axisBottom(col.scaleLabel);
  row.axisSub  = d3.axisRight(row.scaleSubLabel);
  col.axisSub  = d3.axisBottom(col.scaleSubLabel);
  if (row.annotated) row.axisAnno = d3.axisRight(row.scaleAnnoLabel);
  if (col.annotated) col.axisAnno = d3.axisRight(col.scaleAnnoLabel);

  // SVG elements (these are visible)
  row.axisMainVis = svg.append("g").attr("class", "axis").call(row.axisMain);
  col.axisMainVis = svg.append("g").attr("class", "axis").call(col.axisMain);
  row.axisSubVis 	= svg.append("g").attr("class", "axis").call(row.axisSub);
  col.axisSubVis 	= svg.append("g").attr("class", "axis").call(col.axisSub);
  if (row.annotated) row.axisAnnoVis = svg.append("g").attr("class", "axis").call(row.axisAnno);
  if (col.annotated) col.axisAnnoVis = svg.append("g").attr("class", "axis").call(col.axisAnno);

  //------------------------------------------------------------------------------------------------
  //                                         	CELLS AND TITLES
  //
  // In combination with the axes, these make up all the SVG elements. With the exception of the
  // annotation titles and axes, every visual component can be decomposed into 2 parts:
  //		* group - a g element which gets positioned at an anchor point
  //		* cells - rect elements which live inside the group
  // When a group is tranlated to a new position, all the elements inside of it move as well, and
  // this makes it so that the coordinates (x and y) of cells are relative their group, not to the
  // SVG as a whole.
  //
  //------------------------------------------------------------------------------------------------

  if (col.annotated) {
    col.sideColorBar = svg.append("g"); // group
    col.sideColors = sideColorsSetup(col); // cells
  }

  if (row.annotated) {
    row.sideColorBar = svg.append("g"); // group
    row.sideColors = sideColorsSetup(row); // cells
  }

  // main heatmap
  var heatmap = svg.append("g");
  var cells = heatmap.selectAll("g")      	// first, we add the rows in (not visible)
                .data(dataset.matrix)     	// each "d" is an array of cells
                .enter()										// selects all the new data (i.e., all of it)
                .append("g")              	// the rows have now been added
                .selectAll("rect")        	// then, we add the cells in (visible)
                .data(function(d) { return d; }, key) // in the key function, "d" is now a cell
                .enter()										// from here on, "d" refers to an individual cell
                .append("rect")           	// the cells have now been added, but still not visible
                .attr("fill", fillCell)
                .on("mouseover", function(d) { displayCellTooltip(d, this); })
                .on("mouseout", function() { cellTooltip.classed("hidden", true); });

  // brushable heatmap at the right
  var heatmapRight = svg.append("g");
  row.cellsBrush = heatmapRight.selectAll("g")
  									.data(dataset.matrix)
                    .enter()
                    .append("g")
                    .selectAll("rect")
                    .data(function(d) { return d; }, key)
                    .enter()
                    .append("rect")
                    .attr("fill", fillCellRight);

  // brushable heatmap at the bottom
  var heatmapBottom = svg.append("g");
  col.cellsBrush = heatmapBottom.selectAll("g")
                    .data(dataset.matrix)
                    .enter()
                    .append("g")
                    .selectAll("rect")
                    .data(function(d) { return d; }, key)
                    .enter()
                    .append("rect")
                    .attr("fill", fillCellBottom);

  if (col.annotated) {
    col.annoTitle = annoTitleSetup(col);
    col.annoColorBar = svg.append("g");
    col.annoColors = annoColorsSetup(col, col.annoTypesAndValues[col.annotypeAnno]);
  }

  if (row.annotated) {
    row.annoTitle = annoTitleSetup(row);
    row.annoColorBar = svg.append("g");
    row.annoColors = annoColorsSetup(row, row.annoTypesAndValues[row.annotypeAnno]);
  }

  //------------------------------------------------------------------------------------------------
  //                                           BRUSHES
  //
  // The brushes provide a way to zoom and pan on the main heatmap by selecting regions on brushable
  // heatmaps, and they are made up of 2 parts:
  //		* brush component - a d3.brush object (brushX of col, brushY for row) which defines
  //												important properties of the brush, namely its extent (the maximum pixel
  //												area that the user can brush) and its interactive behavior (what to do
  //												when the user starts/stops brushing, or while they are brushing)
  //		* SVG element - a g element which makes the brush visible and usable. By default, it
  //										contains 4 rect elements; an overlay which lets you create a selection, a
  //										selection which is draggable, and 2 "handles" on either side of the
  //										selection which allow it to be resized. The attributes of these elements
  //										can be programmatically controlled with CSS and JS
  //
  //------------------------------------------------------------------------------------------------

  // brush components
  col.brush = d3.brushX()
                .extent([col.anchorBrush, [col.anchorBrush[0] + widthHeatmap(),
                				 									 col.anchorBrush[1] + col.marginBrush]])
                .on("brush", function() { brushed(col); })
                .on("end", function() { ended(col); });
  row.brush = d3.brushY()
                .extent([row.anchorBrush, [row.anchorBrush[0] + row.marginBrush,
                				 									 row.anchorBrush[1] + heightHeatmap()]])
                .on("brush", function() { brushed(row); })
                .on("end", function() { ended(row); });

  // SVG elements
  col.brushVis = svg.append("g").attr("class", "brush").call(col.brush);
  row.brushVis = svg.append("g").attr("class", "brush").call(row.brush);

  positionElements();

  // initialize the brushed area to be the current scope
  col.brushVis.call(col.brush.move,
  							[col.scaleInverter.invertExtent(col.names[col.currentScope[0]])[0],
  							 col.scaleInverter.invertExtent(col.names[col.currentScope[1] - 1])[1] - 1]);
  row.brushVis.call(row.brush.move,
  							[row.scaleInverter.invertExtent(row.names[row.currentScope[0]])[0],
  							 row.scaleInverter.invertExtent(row.names[row.currentScope[1] - 1])[1] - 1]);

  function resizeBrushExtents() {
    col.brush.extent([col.anchorBrush,
    								[col.anchorBrush[0] + widthHeatmap(), col.anchorBrush[1] + col.marginBrush]]);
    row.brush.extent([row.anchorBrush,
    								[row.anchorBrush[0] + row.marginBrush, row.anchorBrush[1] + heightHeatmap()]]);
  }

  function positionElements() {
  	updateRowAxisNT(row.axisMainVis, row.axisMain); // just calls axisMain
    updateColAxisNT(col.axisMainVis, col.axisMain); // calls axisMain + angles labels
    positionElement(row.axisMainVis, row.anchorLabel);
    positionElement(col.axisMainVis, col.anchorLabel);

    updateRowAxisNT(row.axisSubVis, row.axisSub); // just calls axisSub
    updateColAxisNT(col.axisSubVis, col.axisSub); // calls axisSub + angles labels
    positionElement(row.axisSubVis, row.anchorSubLabel);
    positionElement(col.axisSubVis, col.anchorSubLabel);

    if (col.annotated) {
      col.axisAnnoVis.call(col.axisAnno);
      positionElement(col.axisAnnoVis, col.anchorAnnoLabel);
    }
    if (row.annotated) {
      row.axisAnnoVis.call(row.axisAnno);
      positionElement(row.axisAnnoVis, row.anchorAnnoLabel);
    }

    // reposition/resize side colors
    if (col.annotated) {
      positionElement(col.sideColorBar, col.anchorSideColor);
      col.sideColors.attr("x", col.xSideColor)
                    .attr("y", col.ySideColor)
                    .attr("width", col.widthSideColor)
                    .attr("height", col.heightSideColor);
    }

    if (row.annotated) {
      positionElement(row.sideColorBar, row.anchorSideColor);
      row.sideColors.attr("x", row.xSideColor)
                    .attr("y", row.ySideColor)
                    .attr("width", row.widthSideColor)
                    .attr("height", row.heightSideColor);
    }

    // reposition/resize heatmaps
    positionElement(heatmap, anchorHeatmap);
    positionElement(heatmapRight, row.anchorBrush);
    positionElement(heatmapBottom, col.anchorBrush);
    cells.attr("x", xCell)
         .attr("y", yCell)
         .attr("width", widthCell)
         .attr("height", heightCell);
    row.cellsBrush.attr("x", xCellRight)
                  .attr("y", yCellRight)
                  .attr("width", widthCellRight)
                  .attr("height", heightCellRight);
    col.cellsBrush.attr("x", xCellBottom)
                  .attr("y", yCellBottom)
                  .attr("width", widthCellBottom)
                  .attr("height", heightCellBottom);

    // reposition/resize color key/anno colors
    if (col.annotated) {
      positionElement(col.annoTitle, col.anchorAnnoTitle);
      positionElement(col.annoColorBar, col.anchorAnnoColor);
      col.annoColors.attr("x", col.xAnnoColor)
                    .attr("y", col.yAnnoColor)
                    .attr("width", col.widthAnnoColor)
                    .attr("height", col.heightAnnoColor)
                    .attr("fill", col.fillAnnoColor);
    }

    if (row.annotated) {
      positionElement(row.annoTitle, row.anchorAnnoTitle);
      positionElement(row.annoColorBar, row.anchorAnnoColor);
      row.annoColors.attr("x", row.xAnnoColor)
                    .attr("y", row.yAnnoColor)
                    .attr("width", row.widthAnnoColor)
                    .attr("height", row.heightAnnoColor)
                    .attr("fill", row.fillAnnoColor);
    }

    col.brushVis.call(col.brush);
    row.brushVis.call(row.brush);

    button.attr("x", row.anchorBrush[0])
  				.attr("y", col.anchorBrush[1])
  }

  function svgSetup(w, h) {
  	SVG.attr("width", w + margin.left + margin.right)
  		.attr("height", h + margin.top + margin.bottom);
  }

  function resizeSVG() {
    holderSize = holder.getBoundingClientRect();
  	w = holderSize.width - margin.left - margin.right;
  	h = height - margin.top - margin.bottom;
    svgSetup(w, h);
    marginsSetup(w, h);
    anchorsSetup(w, h);
    scalesSetup(w, h);
    resizeBrushExtents();
    positionElements();
    if (col.currentScope[0] != 0 && col.currentScope[1] != col.names.length) {
    	col.brushVis.call(col.brush.move,
    						[col.scaleInverter.invertExtent(col.names[col.currentScope[0]])[0],
    						 col.scaleInverter.invertExtent(col.names[col.currentScope[1] - 1])[1] - 1]);
    }
    if (row.currentScope[0] != 0 && row.currentScope[1] != row.names.length) {
    	row.brushVis.call(row.brush.move,
    						[row.scaleInverter.invertExtent(row.names[row.currentScope[0]])[0],
    						 row.scaleInverter.invertExtent(row.names[row.currentScope[1] - 1])[1] - 1]);
    }
  }

  // places the given selection at its anchor point
  function positionElement(element, anchor) {
  	element.attr("transform", "translate(" + anchor[0] + "," + anchor[1] + ")");
  }

  //------------------------------------------------------------------------------------------------
  //                                   INTERACTIVITY FUNCTIONS
  //
  //
  //
  //------------------------------------------------------------------------------------------------

  // updates the current scope of the given dimension and, if renderOnBrushEnd is false, performs
  // visual updates on the main heatmap and side colors
  function brushed(dim) {
    if (!renderOnBrushEnd) {
    	var inverses = d3.event.selection.map(dim.scaleInverter); // bounds of brushed -> row/column
    	dim.currentScope = [dim.names.indexOf(inverses[0]), dim.names.indexOf(inverses[1]) + 1];
    	renderScope(dim, false);
    }
  }

  // Resets the scope of the given dim only if there is no current selection (i.e., the user clicks
  // off of the selected area, otherwise renders the dim's current scope if renderOnBrushEnd is true
  // @param 		dim - the dimension (either row or col) to be updated
  // @modifies 	dim.currentScope
  //						dim.scaleCell
  //						dim.scaleLabel
  // 						dim.axisMain
  //						dim.axisMainVis
  //						dim.sideColors
  //						cells
  function ended(dim) {
    if (d3.event.selection) {
      if (renderOnBrushEnd) {
      	var inverses = d3.event.selection.map(dim.scaleInverter); // bounds of brushed -> row/column
    		dim.currentScope = [dim.names.indexOf(inverses[0]), dim.names.indexOf(inverses[1]) + 1];
      	renderScope(dim, true);
      }
    } else {
    	dim.currentScope = [0, dim.names.length];

      // scale updates
      dim.scaleCell.domain(dim.names);
      updateDimScale(dim, sample(dim.names, Math.floor(dim.factor * dim.sizeHeatmap() / fontSize)));

      // visual updates
      dim.updateAxis(dim.axisMainVis, dim.axisMain);
      cells.attr(dim.pos,	 dim.posCell)
           .attr(dim.size, dim.sizeCell);
      if (dim.annotated) {
        dim.sideColors.attr(dim.pos, 	dim.posSideColor)
                      .attr(dim.size, dim.sizeSideColor);
      }
    }
  }

  function renderScope(dim, transition) {
    var scopeArray = dim.names.slice(dim.currentScope[0], dim.currentScope[1]);
	  var inScope = {};
	  for (var name of scopeArray) {
	    inScope[name] = true; // note that "undefined" is falsy
	  }

    // scale updates
    dim.scaleCell.domain(scopeArray);
    updateDimScale(dim, sample(scopeArray, Math.floor(dim.factor * dim.sizeHeatmap() / fontSize)));

    // visual updates
    transition ? dim.updateAxis(dim.axisMainVis, dim.axisMain)
    					 : dim.updateAxisNT(dim.axisMainVis, dim.axisMain);
    updateVisualScope(dim, inScope);
  }

  // repositions and resizes the cells of the main heatmap and the side colors of the given
  // dimension, showing only those that are in scope (for which inScope[d[dim.self]] is true)
  function updateVisualScope(dim, inScope) {
    // rescale cells in the current selection, "zero out" cells not in the current selection
    cells.attr(dim.pos,	 function(d) { return inScope[d[dim.self]] ? dim.posCell(d) : 0; })
         .attr(dim.size, function(d) { return inScope[d[dim.self]] ? dim.sizeCell() : 0; });
    // push to respective side???
    if (dim.annotated) {
      dim.sideColors.attr(dim.pos,	function(d) { return inScope[d.key] ? dim.posSideColor(d) : 0; })
                    .attr(dim.size, function(d) { return inScope[d.key] ? dim.sizeSideColor() : 0; });
    }
  }

  // annotates the rows/columns (depending on dim) and updates the respective annotation colors by
  // the currently selected annotation option for the given dimension
  function annoUpdate(dim, newAnnotype) {
    dim.annotypeAnno = newAnnotype;
    var values = dim.annoTypesAndValues[dim.annotypeAnno];

    // scale updates
    dim.annoToNum.domain(values);
    if (categorical) {
      dim.annoToNum.range(d3.range(values.length));
    }

    if (values.every(function(value) { return !isNaN(value); }) && values.length > 2) {
    	if (categorical) {
    		dim.numToColor = function(index) {
      		return colors.annoHeat(index / values.length);
    		};
    	} else {
    		dim.numToColor = colors.annoHeat;
    	}
    } else {
    	if (categorical) {
    		dim.numToColor = function(index) {
      		return colors.categorical[index % colors.categorical.length];
    		};
    	} else {
    		dim.numToColor = colors.continuous;
    	}
    }

    dim.scaleAnnoColor.domain(values);
    dim.scaleAnnoLabel.domain(sample(values, Math.floor(dim.marginAnnoHeight / fontSize)))
                      .range([dim.heightAnnoColor() / 2,
              																	dim.marginAnnoHeight - dim.heightAnnoColor() / 2]);

    // visual updates
    dim.annoTitle.text(undersToSpaces(dim.annotypeAnno));
    dim.annoColorBar.selectAll("rect").remove();		// clear out all previous colored rects
    dim.annoColors = annoColorsSetup(dim, values);	// add back in colored rects for new annotation
    dim.axisAnnoVis.call(dim.axisAnno);
    dim.sideColors.transition().duration(animDuration) // add a delay???
                  .attr("fill", dim.fillSideColor);
  }

  // sorts the rows/columns (depending on dim) of the 3 heatmaps according to the currently selected
  // sorting option for the given dimension
  function sortUpdate(dim, annotype) {
  	if (annotype != "Clustered Order") { // sort the rows/columns by the chosen annotype
      var values = dim.annoTypesAndValues[annotype],
          valueToIndex = {}; // hashmap to determine priority for sorting
      for (var j of d3.range(values.length)) {
        valueToIndex[values[j]] = j;
      }
      dim.labelsAnnotated.sort(function(a, b) {
        var val1 = valueToIndex[a.annos[annotype]],
            val2 = valueToIndex[b.annos[annotype]];
        return val1 === val2 ? a.key.localeCompare(b.key) : val1 - val2;
      });
    }

    dim.names = annotype === "Clustered Order" ? dim.clustOrder :
                                        dim.labelsAnnotated.map(function(obj) { return obj.key; });

    // update scales
    dim.scaleCell.domain(dim.names);
    dim.scaleCellBrush.domain(dim.names);
    dim.scaleInverter.range(dim.names);
    dim.scaleSubLabel.domain(sample(dim.names,
                      											Math.floor(dim.factor * dim.sizeHeatmap() / fontSize)));

    // visual updates for the brushable heatmaps
    dim.updateAxis(dim.axisSubVis, dim.axisSub);
    dim.cellsBrush.attr(dim.pos, dim.posCell)
    dim.other.cellsBrush.attr(dim.pos, dim.posCellBrush);

    renderScope(dim, true);
  }

  // re-scales the coloring of the cells of the heatmap based on the currently selected scaling
  // option
  function updateColorScaling(newScalingDim) {
    scalingDim = newScalingDim;
    if (scalingDim === "none") {
      mainColorScale.domain([dataset.stats.totalMin, dataset.stats.totalMax]);
    } else {
      mainColorScale.domain([-1 * dataset.stats.zMax[scalingDim], dataset.stats.zMax[scalingDim]]);
    }
    cells.attr("fill", fillCell);
    col.cellsBrush.attr("fill", fillCellBottom);
    row.cellsBrush.attr("fill", fillCellRight);
  }

  // visually updates the given column axis (labels will be angled) WITH A TRANSITION
  function updateColAxis(axisVis, axis) {
    axisVis.transition().duration(animDuration).call(axis)
           .selectAll("text")								 // to angle the other way:
           .style("text-anchor", "start")    // end
           .attr("dx", ".8em")               // -.8em
           .attr("dy", ".15em")              // .15em
           .attr("transform", "rotate(45)"); // rotate(45)
  }

  // visually updates the given column axis (labels will be angled) WITH NO TRANSITION
  function updateColAxisNT(axisVis, axis) {
    axisVis.call(axis)
           .selectAll("text")								 // to angle the other way:
           .style("text-anchor", "start")    // end
           .attr("dx", ".8em")               // -.8em
           .attr("dy", ".15em")              // .15em
           .attr("transform", "rotate(45)"); // rotate(-45)
  }

  // visually updates the given row axis (labels will not be angled) WITH A TRANSITION
  function updateRowAxis(axisVis, axis) {
    axisVis.transition().duration(animDuration).call(axis);
  }

  // visually updates the given row axis (labels will not be angled) WITH NO TRANSITION
  function updateRowAxisNT(axisVis, axis) {
    axisVis.call(axis);
  }

  // updates the main label scale of the given dimension with a domain of newDomain and
  // range realigned based on the sizeCell for that dimension
  function updateDimScale(dim, newDomain) {
    dim.scaleLabel.domain(newDomain)
            			.range([dim.sizeCell() / 2, dim.sizeHeatmap() - dim.sizeCell() / 2]);
  }

  //------------------------------------------------------------------------------------------------
  //                                     ATTRIBUTE FUNCTIONS
  //
  //
  //
  //------------------------------------------------------------------------------------------------

  // cell attributes
  function xCell(d) { return col.scaleCell(d.col); } // also cellsBottom, col.sideColors
  function yCell(d) { return row.scaleCell(d.row); } // also cellsRight, row.sideColors
  function widthCell() { return col.scaleCell.bandwidth(); } // also cellsBottom, col.sideColors
  function heightCell() { return row.scaleCell.bandwidth(); } // also cellsRight, row.sideColors
  function fillCell(d) {
    if (scalingDim === "none") {
      return mainColorScale(d.value);
    } else {
      var ref = dataset.stats[scalingDim][dotsToUnders(d[scalingDim])];
      return mainColorScale((d.value - ref.mean) / ref.stdev);
    }
  }

  // cellBottom attributes
  function xCellBottom(d) { return xCell(d); }
  function yCellBottom(d) { return row.scaleCellBrush(d.row); }
  function widthCellBottom() { return widthCell(); }
  function heightCellBottom() { return row.scaleCellBrush.bandwidth(); }
  function fillCellBottom(d) { return fillCell(d); }

  // cellRight attributes
  function xCellRight(d) { return col.scaleCellBrush(d.col); }
  function yCellRight(d) { return yCell(d); }
  function widthCellRight() { return col.scaleCellBrush.bandwidth(); }
  function heightCellRight() { return heightCell(); }
  function fillCellRight(d) { return fillCell(d); }

  // row side color attributes
  function xRowSideColor() { return 0; }
  function yRowSideColor(d) { return row.scaleCell(d.key); }
  function widthRowSideColor() { return row.marginSideColor - sideColorPadding; }
  function heightRowSideColor() { return heightCell(); }
  function fillRowSideColor(d) { return row.numToColor(row.annoToNum(d.annos[row.annotypeAnno])); }

  // col side color attributes
  function xColSideColor(d) { return col.scaleCell(d.key); }
  function yColSideColor() { return 0; }
  function widthColSideColor() { return widthCell(); }
  function heightColSideColor() { return col.marginSideColor - sideColorPadding; }
  function fillColSideColor(d) { return col.numToColor(col.annoToNum(d.annos[col.annotypeAnno])); }

  // row anno color attributes
  function xRowAnnoColor() { return 0; }
  function yRowAnnoColor(d) { return row.scaleAnnoColor(d); }
  function widthRowAnnoColor() { return row.marginAnnoColor; }
  function heightRowAnnoColor() { return row.scaleAnnoColor.bandwidth(); }
  function fillRowAnnoColor(d) { return row.numToColor(row.annoToNum(d)); }

  // col anno color attributes
  function xColAnnoColor() { return 0; }
  function yColAnnoColor(d) { return col.scaleAnnoColor(d); }
  function widthColAnnoColor() { return col.marginAnnoColor; }
  function heightColAnnoColor() { return col.scaleAnnoColor.bandwidth(); }
  function fillColAnnoColor(d) { return col.numToColor(col.annoToNum(d)); }

  //------------------------------------------------------------------------------------------------
  //                             ELEMENT GENERATING/DISPLAYING FUNCTIONS
  //
  //
  //
  //------------------------------------------------------------------------------------------------

  // appends the side colors for the given dimension to its side color bar and returns a reference
  // to the selection
  function sideColorsSetup(dim) {
    return dim.sideColorBar.selectAll("rect")
            .data(dim.labelsAnnotated, key)
            .enter()
            .append("rect")
            .attr("x", dim.xSideColor)
            .attr("y", dim.ySideColor)
            .attr("width", dim.widthSideColor)
            .attr("height", dim.heightSideColor)
            .attr("fill", dim.fillSideColor)
            /*.on("click", function(d1) {
            	cells.style("fill-opacity", function(d2) {
            		return d2[dim.self] === d1.key && ? 1 : 0.5;
            	});
            })*/
            .on("mouseover", function(d) { displaySideTooltip(d, this, dim); })
            .on("mouseout", function() { dim.tooltip.classed("hidden", true); });
  }

  // appends the annotation cells with the given data to the annoColorBar for the given dim
  // TODO: figure out how to properly position tooltip
  function annoColorsSetup(dim, data) {
    return dim.annoColorBar.selectAll("rect")
			      .data(data, function(d) { return d; })
			      .enter()
			      .append("rect")
			      .attr("x", dim.xAnnoColor)
			      .attr("y", dim.yAnnoColor)
			      .attr("width", dim.widthAnnoColor)
			      .attr("height", dim.heightAnnoColor)
			      .attr("fill", dim.fillAnnoColor)
			      .on("mouseover", function(d) { displayAnnoTooltip(d, this, dim); })
			      .on("mouseout", function() { annoTooltip.classed("hidden", true); });
  }

  function controlsSetup(selection, dim, id, update) {
  	return selection.append("td").append("select").attr("id", id)
  					.on("change", function() { update(dim, this.value); });
  }

  // appends the sorting options for the given dimension to the given selection
  function sortOptionsSetup(selection, dim) {
    selection.selectAll("option")
      .data(["Clustered Order"].concat(Object.keys(dim.annoTypesAndValues)))
      .enter()
      .append("option")
      .attr("value", function(d) { return d; })
      .text(function(d) { return undersToSpaces(d); });
  }

  // appends the annotation options for the given dimension to the given selection
  function annoOptionsSetup(selection, dim) {
    selection.selectAll("option")
      .data(Object.keys(dim.annoTypesAndValues))
      .enter()
      .append("option")
      .attr("value", function(d) { return d; })
      .text(function(d) { return undersToSpaces(d); });
  }

  // appends the title for the color key of the given dimension and returns a reference to the
  // selection
  function annoTitleSetup(dim) {
    return svg.append("text").attr("class", "annoTitle")
    				.text(undersToSpaces(dim.annotypeAnno));
  }

  // sets up the tooltip for hovering over the cells of the main heatmap
  function cellTooltipSetup() {
  	var tooltip = container.append("div").attr("class", "tooltip").classed("hidden", true);
	  tooltip.append("p").text("Cell Info");
	  var table = tooltip.append("table"),
	      row1 = table.append("tr"),
	      row2 = table.append("tr"),
	      row3 = table.append("tr");
	  row1.append("td").append("p").text("Value");
	  row1.append("td").append("p").attr("id", "value");
	  row2.append("td").append("p").text("Row");
	  row2.append("td").append("p").attr("id", "row");
	  row3.append("td").append("p").text("Column");
	  row3.append("td").append("p").attr("id", "col");
	  return tooltip;
  }

  // sets up the tooltip for hovering over row/column (determined by dim) side colors
  function sideTooltipSetup(dim) {
    var tooltip = container.append("div").attr("class", "tooltip").classed("hidden", true);
    tooltip.append("p").text(dim.title + " Info");
    var table = tooltip.append("table"),
        rows = table.selectAll("tr")
                .data(Object.keys(dim.labelsAnnotated[0].annos))
                .enter()
                .append("tr");
    rows.append("td").append("p").text(function(d) { return undersToSpaces(d); });
    rows.append("td").append("p").attr("id", function(d) { return d; });
    return tooltip;
  }

  // sets up the tooltip for hovering over the annotation colors
  function annoTooltipSetup() {
  	var tooltip = container.append("div").attr("class", "tooltip").classed("hidden", true);
	  tooltip.append("p").text("Annotation Info");
	  var row1 = tooltip.append("table").append("tr");
	  row1.append("td").append("p").attr("id", "annotype");
	  row1.append("td").append("p").attr("id", "value");
	  return tooltip;
  }

  function displayCellTooltip(d, mousedOverRect) {
  	var obj = mousedOverRect.getBoundingClientRect(),
        anchor = [obj.left + widthCell() + window.pageXOffset,
                  obj.top + heightCell() + window.pageYOffset];
    cellTooltip.style("left", anchor[0] + "px")
               .style("top", 	anchor[1] + "px")
               .classed("hidden", false);
    cellTooltip.select("#value").text(d.value);
    cellTooltip.select("#row").text(d.row);
    cellTooltip.select("#col").text(d.col);
  }

  // displays the tooltip for the side color cell (mousedOverRect) with the given data d and the
  // given dimension
  function displaySideTooltip(d, mousedOverRect, dim) {
  	var obj = mousedOverRect.getBoundingClientRect(),
        anchor = [obj.left + dim.widthSideColor() + window.pageXOffset,
                  obj.top + dim.heightSideColor() + window.pageYOffset];
    dim.tooltip.style("left", anchor[0] + "px")
               .style("top", 	anchor[1] + "px")
               .classed("hidden", false);
    for (var annotype of Object.keys(d.annos)) {
      // arbitrary clipping: parameterize and/or figure out some math for this soon
      var origLength = d.annos[annotype].length,
          clipLength = Math.min(origLength, 9 * 3 + 8);
      dim.tooltip.select("#" + annotype)
        .text(d.annos[annotype].substring(0, clipLength) + (clipLength < origLength ? "..." : ""));
    }
  }

  function displayAnnoTooltip(d, mousedOverRect, dim) {
  	var obj = mousedOverRect.getBoundingClientRect(),
			  anchor = [document.body.offsetHeight > window.innerHeight ?
			            window.outerWidth - obj.left - window.pageXOffset :
			            window.innerWidth - obj.left - window.pageXOffset,
			            obj.top + window.pageYOffset];
		annoTooltip.style("right", anchor[0] + "px")
			         .style("top", 	 anchor[1] + "px")
			         .classed("hidden", false);
		annoTooltip.select("#annotype").text(undersToSpaces(dim.annotypeAnno));
		annoTooltip.select("#value").text(d);
  }

  //------------------------------------------------------------------------------------------------
  //                                     OTHER HELPER FUNCTIONS
  //------------------------------------------------------------------------------------------------

  function getColors() {
  	var heatmapColors = interpolateColors(lowColor, midColor, highColor, numColors),
	  		categoricalSchemes = {
				  google: 	["#3366cc", "#dc3912", "#ff9900", "#109618", "#990099",
				    				 "#0099c6", "#dd4477", "#66aa00", "#b82e2e", "#316395",
				             "#994499", "#22aa99", "#aaaa11", "#6633cc", "#e67300",
				             "#8b0707", "#651067", "#329262", "#5574a6", "#3b3eac"],
			    rainbow: 	["#843c39", "#ad494a", "#d6616b", "#e7969c", "#e6550d",
			    					 "#fd8d3c", "#fdae6b", "#fdd0a2", "#8c6d31", "#bd9e39",
			    					 "#e7ba52", "#e7cb94", "#637939", "#8ca252", "#b5cf6b",
			    					 "#cedb9c", "#31a354", "#74c476", "#a1d99b", "#c7e9c0",
			    					 "#3182bd", "#6baed6", "#9ecae1", "#c6dbef", "#393b79",
			    					 "#5254a3", "#6b6ecf", "#9c9ede", "#756bb1", "#9e9ac8",
			    					 "#bcbddc", "#dadaeb"," #7b4173", "#a55194", "#ce6dbd",
			    					 "#de9ed6", "#636363", "#969696", "#bdbdbd"," #d9d9d9"]
	  		},
	  		continuousSchemes = {
			    cubehelix: 	d3.interpolateCubehelixDefault,
			    rainbow: 		d3.interpolateRainbow
	  		},
	  		annoHeatSchemes = {
			  	viridis: 	d3.interpolateViridis,
			  	inferno: 	d3.interpolateInferno,
			  	magma: 		d3.interpolateMagma,
			  	plasma: 	d3.interpolatePlasma,
			  	warm: 		d3.interpolateWarm,
			  	cool: 		d3.interpolateCool
			  };
  	if (categorical) {
  		return {
  			heatmap: heatmapColors,
  			categorical: categoricalSchemes[categoricalScheme],
  			annoHeat: annoHeatSchemes[annoHeatScheme]
  		};
  	} else {
  		return {
  			heatmap: heatmapColors,
  			continuous: continuousSchemes[continuousScheme],
  			annoHeat: annoHeatSchemes[annoHeatScheme]
  		};
  	}
  }

  // return the width/height of the main heatmap in pixels
  function widthHeatmap() { return sizeHeatmap(row) - marginAnnoColor - marginAnnoLabel; }
  function heightHeatmap() { return sizeHeatmap(col); }

  // returns the total length, in pixels, for the main heatmap with respect to the given dim (height
  // for col, width for row)
  function sizeHeatmap(dim) {
    return dim.marginTotal - dim.marginSideColor - dim.marginLabel- dim.marginBrush
    									 - dim.marginSubLabel;// - dim.other.marginAnnoColor - dim.other.marginAnnoLabel;
  }

  function key(d) {
  	return d.key;
  }

  //------------------------------------------------------------------------------------------------
  //                                         PARSING FUNCTIONS
  //
  //
  //
  //------------------------------------------------------------------------------------------------

  // parses the given file (a string) into the data structures used for creating the heatmap.
  // Statistics relevant to determing the colors of the cells are also computed here
  function parseDataMatrix(file) {

    // parse the file into an array of arrays
    var parsedRows = d3.csvParseRows(file);

    // the names of the columns should be stored in the header/first row of the file
    var colnames = parsedRows.shift(); // pops off the first element (ACTUALLY modifying parsedRows)
    colnames.shift(); // trims colnames down to just the column names for the numerical data,
    									// removing whatever name was given to the column containing the row names

    // the array of rownames will grow as we process each row
    var rownames = [];

    // stats will hold all the relevant statistics for the dataset
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

    // traverse the parsed rows to create the matrix (a doubly-nested array) for the heatmap, adding
    // to the rownames array and updating the stats object as we go
    var matrix =
      d3.range(parsedRows.length).map(function(j) { // j = index of parsedRows (row index)

        // grab the row name out of the parsed row. This makes parsedRows[j] the same length as
        // colnames, with parsedRows[j][k] being the value in the row labeled rowname and the column
        // labeled colnames[k]
        var rowname = parsedRows[j].shift(); //

        // add the new row name to the list of row names
        rownames.push(rowname);

        // traverse the current parsed row, reformatting each element (which are assumed to be
        // numbers) and updating the stats object
        return d3.range(colnames.length).map(function(k) { // k = index of colnames (column index)

          // the "+" converts parsedRows[j][k] to a number (since it was parsed as a string)
          var value = +parsedRows[j][k];

          // update the stats for the current column and the current row with this value
          updateStats(stats, "col", dotsToUnders(colnames[k]), value);
          updateStats(stats, "row", dotsToUnders(rowname), value);

          return {
            key: j + " " + k,       // useful for d3 data joins
            row: rowname,      // determines visual attributes of the cell (position, size)
            col: colnames[k],  // determines visual attributes of the cell (position, size)
            value: value            // determines visual attributes of the cell (color)
          };
        });
      });

    // perform final calculations of the stats for each column, and find the totalMin and totalMax
    // of the dataset (this could also be done in the final calculations for the row stats)
    for (var name of Object.keys(stats.col)) {
      finalCalculations(stats, "col", name, rownames.length);

      // reassign the min and max as necessary
      stats.totalMin = Math.min(stats.totalMin, stats.col[name].min);
      stats.totalMax = Math.max(stats.totalMax, stats.col[name].max);
    }

    // perform final calculations of the stats for each row
    for (var name of Object.keys(stats.row)) {
      finalCalculations(stats, "row", name, colnames.length);
    }

    // find the z-score in the dataset with the largest magnitude
    for (var j = 0; j < matrix.length; j++) {
      for (var k = 0; k < matrix[j].length; k++) {

        // grab the current value and compute its z-score relative to its row and to its column
        var value = matrix[j][k].value,
            colZ = (value - stats.col[dotsToUnders(colnames[k])].mean)
            																					/ stats.col[dotsToUnders(colnames[k])].stdev,
            rowZ = (value - stats.row[dotsToUnders(rownames[j])].mean)
            																					/ stats.row[dotsToUnders(rownames[j])].stdev;

        // reassign the maxes as necessary
        stats.zMax.col = Math.max(stats.zMax.col, Math.abs(colZ));
        stats.zMax.row = Math.max(stats.zMax.row, Math.abs(rowZ));
      }
    }

    return {
      matrix: matrix,     // array of arrays of objects (cells have value, row, col, key)
      rownames: rownames, // arrays of strings (list of all row names, assumed to be clustered)
      colnames: colnames, // arrays of strings (list of all column names, assumed to be clustered)
      stats: stats        // object with 5 fields: row and col are hashmaps from row/column name to
      										// object of statistics, zMax stores the largest z-score (by magnitude)
      										// for both row and col, and totalMin/totalMax store the min and max of
      										// the entire dataset
    };
  }

  // updates the stats object for the given dimension at the given name with the given value
  function updateStats(stats, dim, name, value) {

    // if we have not yet seen this dimension name for this dimension, create a new object to keep
    // track of its stats
    if (stats[dim][name] === undefined) {

      // an stdev field will be added to this object during final calculations
      stats[dim][name] = {
              min: value,       // helps to find most negative z-score
              max: value,       // helps to find most positive z-score
              mean: 0,          // used in calculating standard deviation/z-scores for cell fills
              meanOfSquares: 0  // used in calculating standard deviation
            };
    }

    // reassign min and max if necessary
    if (value < stats[dim][name].min) {
      stats[dim][name].min = value;
    }
    if (value > stats[dim][name].max) {
      stats[dim][name].max = value;
    }

    // add the value and squared value to the mean and meanOfSquares, respectively (these will be
    // averaged later)
    stats[dim][name].mean += value;
    stats[dim][name].meanOfSquares += value * value;
  }

  // performs final calculations on the stats object for the dimension at the given name. The mean
  // and meanOfSquares are divided by the given numVals and an stdev field is added to
  // stats[dim][name] based on their values
  function finalCalculations(stats, dim, name, numVals) {
    stats[dim][name].mean *= (1 / numVals);
    stats[dim][name].meanOfSquares *= (1 / numVals);
    stats[dim][name].stdev = Math.sqrt(stats[dim][name].meanOfSquares -
    																														Math.pow(stats[dim][name].mean, 2));
  }

  // parses the given file (a string) into the data structures used for annotating/sorting the
  // heatmap for one of the dimensions
  function parseAnnotations(file) {

    // parse the file into an array of arrays
    var parsedRows = d3.csvParseRows(file);

    // the names of the different kinds of annotations should be stored in the header/first row of
    // the file
    var annotypes = parsedRows.shift(); // pops off the first element (ACTUALLY modifies parsedRows)
    annotypes = annotypes.map(dotsToUnders); // periods in names of annotypes will mess up JS code

    var nameKey = annotypes.shift(); // trims annotypes down to JUST the actual annotation types

    // each type of annotation will be mapped to a sorted array of all its unique values
    var annotations = {};
    for (var annotype of annotypes) {
      annotations[annotype] = [];
    }

    // in these nested loops, examine all values for each annotation type and add them to the
    // hashmap of annotation types -> array of unique values
    for (var j = 0; j < parsedRows.length; j++) {

      // toss out the first element in the row (the name of the dimension for this value); what's
      // left is an array of the same length as the annotypes array, with values[k] being a value
      // for the annotation type annotypes[k]
      parsedRows[j].shift();
      var values = parsedRows[j];

      // associate new unique values with their corresponding annotation types as necessary
      for (var k = 0; k < annotypes.length; k++) {

        // give the value a readable name if blank
        var value = values[k] === "" ? "{ no data }" : values[k];

        // if this value is not already in the array of unique values for its corresponding
        // annotation type, then add it in
        if (annotations[annotypes[k]].indexOf(value) < 0) {
          annotations[annotypes[k]].push(value);
        }
      }
    }

    // sort the values for each annotation type. When comparing two values, if both can be parsed as
    // numbers, then they will be compared numerically, otherwise they will be compared
    // lexicographically
    for (var annotype of annotypes) {
      annotations[annotype].sort(function(a, b) {
        if (!isNaN(a) && !isNaN(b)) {
          return (+a) - (+b); // the "+" converts a and b to numbers
        }
        return a.localeCompare(b);
      });
    }

    // parse the file into an array of objects (each dimension (row or column) is grouped with all
    // its values for each annotation type, with the column names for the file being the keys)
    var parsedLabels = d3.csvParse(file);

    // restructure and reformat the elements of the parsed labels so that each object is now a
    // nested object, with a key field holding the original object's value for the nameKey and an
    // annos holding the entire original object (reformatted). This allows for easier lookup of the
    // annotations for a given row/column name, and makes d3 data joins easier
    var labels = parsedLabels.map(function(obj) {

      // reformat the original object so that it's keys contain no periods and it's values are
      // renamed if blank (same convention as when parsing the hashmap)
      var objReformatted = {};
      for (var key of Object.keys(obj)) {
        objReformatted[dotsToUnders(key)] = obj[key] === "" ? "{ no data }" : obj[key];
      }

      return {
        key: objReformatted[nameKey], // this corresponds to the name of the row/column
        annos: objReformatted
      };
    });

    return {
      annoTypesAndValues: annotations,  // hashmap string to string[] (annotation types -> values)
      labels: labels                    // array of objects (list of annotated dimension names)
    };
  }
}

//--------------------------------------------------------------------------------------------------
//                                        END HEATMAP FUNCTION
//--------------------------------------------------------------------------------------------------
