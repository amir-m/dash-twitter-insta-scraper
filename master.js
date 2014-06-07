stackTraceLimit = Infinity;

var http = require('http'),
	https = require('https'),
	express = require('express'),
	redis = require('redis'),
	mongoose = require('mongoose'),
	cookie = require('cookie'),
	cluster = require('cluster'),
	jsdom = require('jsdom'),
	fs = require('fs'),
	cpuCount = require('os').cpus().length,
	app = express(),
	agent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.114 Safari/537.36',
	workers= {}, left = [], json = [], start;
	

app.set('views', __dirname + '/app');
app.use(require('body-parser')());
app.use(require('method-override')());
app.use(require('morgan')('dev'));
app.set('port', process.env.PORT || 8080);

var twitter = require('child_process').fork(__dirname + '/twitter.js');
var instagram = require('child_process').fork(__dirname + '/instagram.js');

if (cluster.isMaster) {
	for (var i = 0; i < cpuCount; i++) {
		spawn();
	}
	cluster.on('exit', function(worker) {
		console.log('worker ' + worker.id + ' died. spawning a new process...');
		delete workers[worker.pid];
		worker.kill();
		spawn();
	});
} else {
	app.listen(app.get('port'), function() {
		console.log("Listening on " + app.get('port'));
	});
}

function spawn(){
	var worker = cluster.fork();
	workers[worker.id] = worker;
	console.log('worker ' + worker.id + ' was spawned as a new process...');
	return worker;
};

app.get('/twitter/:handler', function(req, res){
	var sent = false;
	var path;
	if (req.query.f && req.query.f == 'img') {
		path = '/' + req.param('handler') +'/media';
	}
	else {
		path = '/' + req.param('handler');	
	}
	twitter.send(path);
	twitter.on('message', function(message){
		if (message.error) {
			return res.send(500);
		}
		console.log('respond received from twitter...')
		res.send(message.data);
		sent = true;
	});
	twitter.on('close', function(code){
		if (!sent) res.send(500);
	});
});

app.get('/instagram/:handler', function(req, res){
	var sent = false;
	instagram.send('/' + req.param('handler'));
	instagram.on('message', function(message){
		if (message.error) {
			return res.send(500);
		}
		console.log('respond received from instagram...')
		res.send(message.data);
		sent = true;
	});
	instagram.on('close', function(code){
		if (!sent) res.send(500);
	});
});

app.get('/health', function(req, res){
	res.send(200);
});

