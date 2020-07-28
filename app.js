var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

const frontendRouter = require('./routes/frontEnd');
const backendRouter = require('./routes/backEnd');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/frontend', frontendRouter);
app.use('/backend', backendRouter);

module.exports = app;
