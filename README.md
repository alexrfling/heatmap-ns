# heatmap-ns
An interactive heatmap widget made with d3.js.

# Overview
This widget takes the id of an HTML element up to three CSV-formatted strings and generates an
interactive heatmap of the data in the given strings inside the given HTML element.

# Boilerplate
In the head of your HTML document, include:
```html
<link rel="stylesheet" type="text/css" href="heatmap.css">
<script src="d3/d3.min.js"></script>
<script src="helpers.js"></script>
<script src="heatmap.js"></script>
```

# Usage
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
To make an interactive heatmap of this data inside #dataOverview, call
```js
heatmap("dataOverview", data, colAnnos, rowAnnos)
```
