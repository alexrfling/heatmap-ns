# heatmap-ns
An interactive heatmap widget made with d3.js.

## Overview
The `heatmap` function takes the id of an HTML element, and up to three CSV-formatted strings (along
with a number of other optional parameters), and generates an interactive heatmap of the data stored
in the strings, appended to the HTML element.

## Boilerplate
In the head of your HTML document, include:
```html
<script src='d3-helpers/d3/d3.min.js'></script>
<script src='d3-helpers/d3-tip/index.js'></script>
<script src='d3-helpers/bucketizer.js'></script>
<script src='d3-helpers/graphicalElement.js'></script>
<script src='d3-helpers/cells.js'></script>
<script src='d3-helpers/labels.js'></script>
<script src='d3-helpers/svgContainer.js'></script>
<script src='d3-helpers/title.js'></script>
<script src='d3-helpers/widget.js'></script>
<script src='heatmap.js'></script>
<link rel='stylesheet' type='text/css' href='d3-helpers/d3-tip/examples/example-styles.css'>
<link rel='stylesheet' type='text/css' href='d3-helpers/widget.css'>
```

## Usage

### Call
```js
var heatmap = new Heatmap('heatmap');
heatmap.initialize(data, options);
```

### Example
Element in the HTML document:
```html
<div id='heatmap'></div>
```
Data in JavaScript:
```js
var data = 'Row,ColumnOne,ColumnTwo\nRowOne,12,34\nRowTwo,56,78';
var rowAnnoFile = 'Row,Analyte.Type,Is.Control\nRowOne,mRNA,true\nRowTwo,protein,false';
var colAnnoFile = 'Column,Binding.Density\nColumnTwo,0.61\nColumnOne,0.9';
```
Create an interactive heatmap of `data` annotated with `rowAnnos` and `colAnnos`:
```js
var heatmap = new Heatmap('heatmap');
var options = {
    rowAnnoFile: rowAnnoFile,
    colAnnoFile: colAnnoFile
};
heatmap.initialize(data, options);
```
See example.html for more example usage.

## Parameters

### Required
<b>id</b> - the 'id' attribute of the HTML element to which the heatmap will be appended

<b>data</b> - CSV-formatted string representing a numerical matrix of data

### Optional
<b>colAnnoFile</b> - CSV-formatted string representing annotations for the columns of the data
matrix in `datasetFile`

<b>rowAnnoFile</b> - CSV-formatted string representing annotations for the rows of the data matrix
in `datasetFile`

<b>colClustOrder</b> - array of strings (all of the column names in `datasetFile`) indicating the
order in which the columns should be displayed in the heatmap (`colClustOrder[0]` will be the
left-most column and `colClustOrder[colClustOrder.length - 1]` will be the right-most column). By
default, the columns will be displayed in the order that they appear in `datasetFile`

<b>rowClustOrder</b> - array of strings (all of the row names in `datasetFile`) indicating the order
in which the rows should be displayed in the heatmap (`rowClustOrder[0]` will be the top-most row
and `rowClustOrder[rowClustOrder.length - 1]` will be the bottom-most row). By default, the rows
will be displayed in the order that they appear in `datasetFile`

<b>height</b> - the height, in pixels, of the widget (default: `600`). The width of the widget will
be the same as the width of the HTML element with id `id`

<b>renderOnBrushEnd</b> - true for immediate rendering of visual updates, false for delayed
rendering of visual updates when zooming/panning (default: `false` - recommended for large datasets)

<b>categorical</b> - `true` for categorical, `false` for continuous color schemes (default: `true`)

<b>colCatScheme</b> - one of `'ns'`, `'google'`, or `'rainbow'` indicating categorical color scheme
to use for non-numerical column annotations (default: `'google'`). Ignored if `categorical` is
`false`

<b>colConScheme</b> - one of `'cubehelix'` or `'rainbow'` indicating continuous color scheme to use
for non-numerical column annotations (default: `'rainbow'`). Ignored if `categorical` is `true`

<b>colAnnoHeatScheme</b> - one of `'viridis'`, `'inferno'`, `'magma'`, `'plasma'`, `'warm'`, or
`'cool'` indicating color scheme to use for numerical column annotations (default: `'plasma'`)

<b>rowCatScheme</b> - one of `'ns'`, `'google'`, or `'rainbow'` indicating categorical color scheme
to use for non-numerical row annotations (default: `'ns'`). Ignored if `categorical` is `false`

<b>rowConScheme</b> - one of `'cubehelix'` or `'rainbow'` indicating continuous color scheme to use
for non-numerical row annotations (default: `'cubehelix'`). Ignored if `categorical` is `true`

<b>rowAnnoHeatScheme</b> - one of `'viridis'`, `'inferno'`, `'magma'`, `'plasma'`, `'warm'`, or
`'cool'` indicating color scheme to use for numerical row annotations (default: `'magma'`)

<b>bucketDividers</b> - array of numbers, of length 1 less than `bucketColors`, indicating the caps
for 'bucket' color scaling (default: `[25, 50, 100, 500]`). Data less than `bucketDividers[0]` will
be given the color `bucketColors[0]`, data between `bucketDividers[0]` (inclusive) and
`bucketDividers[1]` (exclusive) will be given the color `bucketColors[1]`, and so on. Data greater
than or equal to `bucketDividers[bucketDividers.length - 1]` will be given the color
`bucketColors[bucketColors.length - 1]`

<b>bucketColors</b> - array of strings, of length 1 more than `bucketDividers`, indicating the
colors for 'bucket' color scaling (default: `['red', 'orange', 'yellow', 'gray', 'cornflowerblue']`)

<b>animDuration</b> - number of milliseconds animations should last (default: `1200`)

<b>sideColorPad</b> - space, in pixels, between the heatmap and the row/column side colors
(default: `3`)

<b>annoTitlePad</b> - space, in pixels, between a color key title and its colorful cells
(default: `7`)

<b>axisPad</b> - space, in pixels, between the tickmarks of labels and their colorful cells
(default: `5`)

<b>fontSize</b> - font size, in pixels, of labels (default: `9`)

<b>fontSizeCK</b> - font size, in pixels, of color key titles (default: `11`)

<b>lowColor</b> - string representing the color for data with negative z-scores
(default: `'cornflowerblue'`)

<b>midColor</b> - string representing the color for data with a z-score of 0 (default: `'black'`)

<b>highColor</b> - string representing the color for data with positive z-scores
(default: `'orange'`)

<b>numColors</b> - number of colors to include in the interpolation of `lowColor`, `midColor`, and
`highColor` (default: `256`)
