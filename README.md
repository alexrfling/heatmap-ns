# heatmap-ns
An interactive heatmap widget made with d3.js.

## Overview
This widget takes the id of an HTML element up to three CSV-formatted strings and generates an
interactive heatmap of the data in the given strings inside the given HTML element.

## Boilerplate
In the head of your HTML document, include:
```html
<link rel="stylesheet" type="text/css" href="heatmap.css">
<script src="d3/d3.min.js"></script>
<script src="helpers.js"></script>
<script src="heatmap.js"></script>
```

## Usage
In the body of your HTML document, you may have an element that looks like
```html
<div id="dataOverview"></div>
```
and in your JS code, a variable that looks like
```js
var data = "Row,ColumnOne,ColumnTwo\nRowOne,12,34\nRowTwo,56,78";
var rowAnnos = "Row,Analyte.Type,Is.Control\nRowOne,mRNA,true\nRowTwo,protein,false";
var colAnnos = "Column,Binding.Density\nColumnTwo,0.61\nColumnOne,0.9";
```
To make an interactive heatmap of this data inside `#dataOverview`, call
```js
heatmap("dataOverview", data, colAnnos, rowAnnos)
```

## Parameters

### Required
<b>id</b> - the HTML/CSS "id" attribute of the HTML element to which the heatmap will be appended

<b>datasetFile</b> - CSV-formatted string representing a numerical matrix of data to be displayed in the heatmap

### Optional
<b>colAnnoFile</b> - CSV-formatted string representing annotations for the columns of the matrix in `datasetFile`

<b>rowAnnoFile</b> - CSV-formatted string representing annotations for the rows of the matrix in `datasetFile`

<b>colClustOrder</b> - array of unique strings containing all the column names in `datasetFile` representing the order in which the columns should be displayed in the heatmap (`colClustOrder[0]` will be the left-most column and `colClustOrder[colClustOrder.length - 1]` will be the right-most column)

<b>rowClustOrder</b> - array of unique strings containing all the row names in `datasetFile` representing the order in which the rows should be displayed in the heatmap (`rowClustOrder[0]` will be the top-most row and `rowClustOrder[rowClustOrder.length - 1]` will be the bottom-most row)

<b>height</b> - the height, in pixels, of the widget (default: `600`)

<b>renderOnBrushEnd</b> - boolean indicating when visual updates should be applied when zooming/panning, true for immediate rendering and false for delayed rendering (default: `false` - recommended for large datasets)

<b>categorical</b> - boolean indicating what type of color schemes should be used, `true` for categorical and `false` for continuous (default: `true`)

<b>colCatScheme</b> - string indicating which categorical color scheme to use for column annotations, choices are `"ns"`, `"google"`, and `"rainbow"` (default: `"google"`) - ignored if `categorical` is `false`

<b>colConScheme</b> - string indicating which continuous color scheme to use for column annotations, choices are `"cubehelix"` and `"rainbow"` (default: `"rainbow"`) - ignored if `categorical` is `true`

<b>colAnnoHeatScheme</b> - string indicating which color scheme to use for column annotations which are numerical, choices are `"viridis"`, `"inferno"`, `"magma"`, `"plasma"`, `"warm"`, and `"cool"` (default: `"plasma"`)

<b>rowCatScheme</b> - string indicating which categorical color scheme to use for row annotations, choices are `"ns"`, `"google"`, and `"rainbow"` (default: `"ns"`) - ignored if `categorical` is `false`

<b>rowConScheme</b> - string indicating which continuous color scheme to use for column annotations, choices are `"cubehelix"` and `"rainbow"` (default: `"cubehelix"`) - ignored if `categorical` is `true`

<b>rowAnnoHeatScheme</b> - string indicating which color scheme to use for column annotations which are numerical, choices are `"viridis"`, `"inferno"`, `"magma"`, `"plasma"`, `"warm"`, and `"cool"` (default: `"magma"`)

<b>bucketDividers</b> - array of numbers indicating cut-off values for the "Buckets" color scaling option (default: `[25, 50, 100, 500]`)

<b>bucketColors</b> - array of strings, of length 1 more than bucketDividers, indicating the colors to be associated with each bucket (default: `["red", "orange", "yellow", "gray", "cornflowerblue"]`)
