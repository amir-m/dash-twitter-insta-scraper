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
	models = require('./models').config(mongoose),
	instagram = require('./instagram'),
	twitter = require('./twitter'),
	fifa = require('./fifa'),
	fifaNews = require('./fifaNews'),
	agent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.114 Safari/537.36',
	workers= {}, left = [], start;
	
models.ready(function(){
	fifa.config(models);
	fifaNews.config(models);
	instagram.config(models);
	twitter.config(models);
});

app.set('views', __dirname + '/app');
app.use(require('body-parser')());
app.use(require('method-override')());
app.use(require('morgan')('dev'));
app.set('port', process.env.PORT || 8080);

var req_id = (function (){
	var index = 1;
	return function() {
		if (index > 1000000) index = 0;
		return index++;
	}
}());

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
	var path;
	if (req.query.f && req.query.f == 'img') {
		path = '/' + req.param('handler') +'/media';
	}
	else {
		path = '/' + req.param('handler');	
	}
	var options = {
		hostname: 'twitter.com',
		path: path, 
		headers: {
			accept:'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
			'cache-control': 'max-age=0',
			'user-agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.114 Safari/537.36'
		}	
	};
	twitter.fetch(options, function(error, data) {
		if (error) {
			res.send(500);
			throw error;
		}
		res.send(data);
	});
});

app.get('/instagram/:handler', function(req, res){
	var options = {
		hostname: 'instagram.com',
		path: '/' + req.param('handler'), 
		headers: {
			'cache-control': 'max-age=0',
			'user-agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.114 Safari/537.36'
		}	
	};
	instagram.fetch(options, function(error, data){
		if (error) {
			res.send(500);
			throw error;
		}
		console.log('respond received from instagram...')
		res.send(data);
	});
});

app.get('/fifa', function(req, res){
	var id = req_id();
	var options = {
		hostname: 'www.fifa.com', 
		path: '/worldcup/matches/index.html', 
		headers: {
			accept:'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
			'cache-control': 'max-age=0',
			'user-agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.114 Safari/537.36'
		}	
	};
	var res_object = {
		date: [],
		utc_date_time: [],
		status: [],
		home_team: [],
		away_team: [],
		score: [],
		home_team: [],
		away_team_flag: [],
		home_team_flag: [],
		stadium: [],
		city: [],
		resource_uri: []
	};
	fifa.fetch(options, id, res_object, function(error, data){
		if (error) return res.send(500);
		res.send(data);
		data = null;
	});
	// fifa.send({ id: id });
	// fifa.on('message', function(message){
	// 	if (message.error) {
	// 		sent = true;
	// 		return res.send(500);
	// 	}
	// 	console.log('respond received from fifa %s', message.id);
	// 	if (id == message.id) return res.send(message.data);
	// });
});

app.get('/fifa/news', function(req, res){
	var id = req_id();
	var options = {
		hostname: 'www.fifa.com', 
		path: '/worldcup/news/all-news.html', 
		headers: {
			accept:'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
			'cache-control': 'max-age=0',
			'user-agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.114 Safari/537.36'
		}	
	};
	var res_object = [];
	var start = new Date().getTime();
	fifaNews.fetch(options, id, res_object, function(error, data){
		if (error) return res.send(500);

		console.log('about to respond, took %s ms...', new Date().getTime() - start);
		res.send(data);
		data = null;
	});
	// fifa.send({ id: id });
	// fifa.on('message', function(message){
	// 	if (message.error) {
	// 		sent = true;
	// 		return res.send(500);
	// 	}
	// 	console.log('respond received from fifa %s', message.id);
	// 	if (id == message.id) return res.send(message.data);
	// });
});

app.get('/health', function(req, res){
	res.send(200);
});

// fifa.on('close', function(code){
// 	fifa = require('child_process').fork(__dirname + '/fifa.js');
// });
