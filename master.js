stackTraceLimit = Infinity;

var http = require('http'),
	https = require('https'),
	express = require("express"),
	redis = require('redis'),
	mongoose = require('mongoose'),
	cookie = require('cookie'),
	cluster = require('cluster'),
	cpuCount = require('os').cpus().length;

app.set('views', __dirname + '/app');
app.use(require('body-parser')());
app.use(require('method-override')());
app.use(require('morgan')('dev'));
app.set('port', process.env.PORT || 8080);


app.listen(app.get('port'), function() {
	console.log("Listening on " + app.get('port'));
});

app.get('/', function(req, res){
	console.log(res.headers)
	res.send(200);
})