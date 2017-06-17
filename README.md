# heatmap-ns
An interactive heatmap widget made with d3.js.

![alt text](https://raw.githubusercontent.com/alexrfling/heatmap-ns/master/img/example.png)

## Overview
`Heatmap` takes the id of an HTML element, a matrix of data, and optional parameters, and generates an interactive heatmap of the data appended to the HTML element.

## Boilerplate
In the head of your HTML document, include:
```html
<script src='d3-helpers/d3/d3.min.js'></script>
<script src='d3-helpers/d3-tip/index.js'></script>
<script src='d3-helpers/bucketizer.js'></script>
<script src='d3-helpers/graphicalElement.js'></script>
<script src='d3-helpers/elementCollection.js'></script>
<script src='d3-helpers/labels.js'></script>
<script src='d3-helpers/svgContainer.js'></script>
<script src='d3-helpers/title.js'></script>
<script src='d3-helpers/widget.js'></script>
<script src='heatmap.js'></script>
<link rel='stylesheet' type='text/css' href='d3-helpers/d3-tip/examples/example-styles.css'>
<link rel='stylesheet' type='text/css' href='d3-helpers/widget.css'>
```

## Usage

### Constructor
<a name='constructorHeatmap' href='#constructorHeatmap'>#</a> new __Heatmap__(_id_)

Constructs a new Heatmap widget with parent element set to the HTML element in the DOM with id _id_. Note that this does not modify the DOM.

### Methods
<a name='initialize' href='#initialize'>#</a> _chart_.__initialize__(_data_[, _options_])

Binds _data_ to _chart_ and renders a heatmap inside the widget's parent element.
* _data_ - an object containing the fields `matrix`, `rownames`, and `colnames`. `matrix` should be a 2D array of objects, each containing the fields `key` (a string), `row` (a string), `col` (a string), and `value` (a number). `rownames` should be an array of all the values of `row` found in `matrix`, and `colnames` should be an array of all the values of `col` found in `matrix`.
* _options_ - an object specifying various attributes of the rendering and widget
  * __width__ - the width, in pixels, of the widget. If falsy, the width of the widget will be the same as the width of the widget's parent element (default: `undefined`)
  * __height__ - the height, in pixels, of the widget (default: `400`)
  * __loColor__ - the color for data with negative z-scores (default: `'cornflowerblue'`)
  * __mdColor__ - the color for data with a z-score of 0 (default: `'black'`)
  * __hiColor__ - the color for data with positive z-scores (default: `'orange'`)
  * __numColors__ - the number of colors in the interpolation of __loColor__, __mdColor__, and __hiColor__ (default: `256`)
  * __colorsHeatmap__ - an array of colors (default: an interpolation from __loColor__ to __mdColor__ to __hiColor__ consisting of __numColors__ strings)
  * __colorsBucket__ - an array of strings, of length 1 more than __dividersBucket__, indicating the colors for 'bucket' color scaling (default: `['red', 'orange', 'yellow', 'gray', 'cornflowerblue']`)
  * __dividersBucket__ - an array of numbers, of length 1 less than `bucketColors`, indicating the thresholds for 'bucket' color scaling (default: `[25, 50, 100, 500]`). Data less than `bucketDividers[0]` will be given the color `bucketColors[0]`, data between `bucketDividers[0]` (inclusive) and `bucketDividers[1]` (exclusive) will be given the color `bucketColors[1]`, and so on. Data greater than or equal to `bucketDividers[bucketDividers.length - 1]` will be given the color `bucketColors[bucketColors.length - 1]`
  * __colAnnotations__ - a CSV-formatted string representing annotations for the columns of the `data` matrix
  * __rowAnnotations__ - a CSV-formatted string representing annotations for the rows of the `data` matrix
  * __colClustOrder__ - an array of strings (all of the column names in `data`) indicating the order in which the columns should be displayed in the heatmap (the first element will be the left-most column and the last element will be the right-most column). By default, the columns will be displayed in the order that they appear in `data`
  * __rowClustOrder__ - an array of strings (all of the row names in `data`) indicating the order in which the rows should be displayed in the heatmap (the first element will be the top-most row and the last element will be the bottom-most row). By default, the rows will be displayed in the order that they appear in `data`
  * __renderOnBrushEnd__ - if truthy, zoom/pan actions trigger immediate visual updates; otherwise, visual updates are delayed until the end a zoom/pan action (default: `false`)
  * __categorical__ - if truthy, categorical color schemes are used; otherwise, continuous color schemes are used (default: `true`)
  * __colCatScheme__ - one of `'ns'`, `'google'`, or `'rainbow'` indicating the categorical color scheme to use for non-numerical column annotations (default: `'google'`). Ignored if __categorical__ is falsy
  * __colConScheme__ - one of `'cubehelix'` or `'rainbow'` indicating the continuous color scheme to use for non-numerical column annotations (default: `'rainbow'`). Ignored if __categorical__ is truthy
  * __colAnnoHeatScheme__ - one of `'viridis'`, `'inferno'`, `'magma'`, `'plasma'`, `'warm'`, or `'cool'` indicating the color scheme to use for numerical column annotations (default: `'plasma'`)
  * __rowCatScheme__ - one of `'ns'`, `'google'`, or `'rainbow'` indicating the categorical color scheme to use for non-numerical row annotations (default: `'ns'`). Ignored if __categorical__ is falsy
  * __rowConScheme__ - one of `'cubehelix'` or `'rainbow'` indicating the continuous color scheme to use for non-numerical row annotations (default: `'cubehelix'`). Ignored if __categorical__ is truthy
  * __rowAnnoHeatScheme__ - one of `'viridis'`, `'inferno'`, `'magma'`, `'plasma'`, `'warm'`, or `'cool'` indicating the color scheme to use for numerical row annotations (default: `'magma'`)

<a name='resize' href='#resize'>#</a> _chart_.__resize__([_width_[, _height_]])

If _width_ is truthy, sets the width (in pixels) of the widget to be _width_. Otherwise, the width of the widget doesn't change.  
If _height_ is truthy, sets the height (in pixels) of the widget to be _height_. Otherwise, the height of the widget doesn't change.

### Example
HTML element in the DOM:
```html
<div id='parent'></div>
```
Data in JavaScript:
```js
var data = {
    matrix: [
        [
            {
                key: 'Row 1 Col 1',
                row: 'Row 1',
                col: 'Col 1',
                value: 348
            },
            ...,
            {
                key: 'Row 1 Col m',
                row: 'Row 1',
                col: 'Col m',
                value: 729
            }
        ],
        ...,
        [
            {
                key: 'Row n Col 1',
                row: 'Row n',
                col: 'Col 1',
                value: 651
            },
            ...,
            {
                key: 'Row n Col m',
                row: 'Row n',
                col: 'Col m',
                value: 100
            }
        ]
    ],
    rownames: ['Row 1', ..., 'Row n'],
    colnames: ['Col 1', ..., 'Col m']
};
```
Create an interactive heatmap of `data`:
```js
var chart = new Heatmap('parent');
chart.initialize(data);
```
See <a href='https://github.com/alexrfling/heatmap-ns/blob/master/example.html'>example.html</a> for more example usage.
