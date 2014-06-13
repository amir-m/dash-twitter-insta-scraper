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
	agent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.114 Safari/537.36',
	workers= {}, left = [], start;
	
models.ready();

app.set('views', __dirname + '/app');
app.use(require('body-parser')());
app.use(require('method-override')());
app.use(require('morgan')('dev'));
app.set('port', process.env.PORT || 8080);

var twitter = require('child_process').fork(__dirname + '/twitter.js');
var instagram = require('child_process').fork(__dirname + '/instagram.js');
// var fifa = require('child_process').fork(__dirname + '/fifa.js');

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
	fetch(options, id, res_object, function(error, data){
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

app.get('/health', function(req, res){
	res.send(200);
});

// fifa.on('close', function(code){
// 	fifa = require('child_process').fork(__dirname + '/fifa.js');
// });

function fetch(options, id, res_object, cb) {
	console.log('about to fetch: %s', id);
	start = new Date().getTime();
	var req = http.request(options, function(res){
		var data = '';

		res.on('data', function(chunk){
			data += chunk;
		});

		res.on('end', function(){
			data = data.toString('utf8');
			data = data.replace(/\n/g, '');
			data = data.replace(/\r/g, '');
			data = data.replace(/ +(?= )/g,'');
			data = data.replace(/>\s*</g,'><');


			var divs = data.split('<div class="matches">')[1];

			divs = divs.split('</div></div></div><div class="row row-last">')[0];

			divs += '</div></div></div>';

			// fs.writeFile('content.html', divs, function(error){
			// 	if (error) throw error;
			// 	console.log('wrote to file')
			// });

			jsonify(divs, id, res_object, cb);

			divs = null;
			data = null;
		});
	});
	req.on('error', function(e) {
	  console.log('problem with request: ' + e.message);
	  cb(error);
	  // global.gc();
	});

	req.end();
};

function jsonify(div, id, res_object, cb) {
	console.log('in jsonify');
	jsdom.env(
	  div,
	  ["http://code.jquery.com/jquery.js"],
	  function (error, window) {
	  	if (error) {
	  		res_object = null;
	  		cb(error);
	  	}

		var $ = window.$;

		$('.mu-m-link .mu-i-date').each(function(){
			res_object.date.push(this.innerHTML);
		});
		$('.mu-m-link .s-status').each(function(){
			var t = this.innerHTML;
			t = t.replace(/\s*/g, '');
			res_object.status.push(this.innerHTML);
		});
		$('.mu-m-link .s-scoreText').each(function(){
			res_object.score.push(this.innerHTML);
		});
		$('.mu-m-link .home .t-nText').each(function(){
			res_object.home_team.push(this.innerHTML);
		});
		$('.mu-m-link .away .t-nText').each(function(){
			res_object.away_team.push(this.innerHTML);
		});
		$('.mu-m-link .home .flag').each(function(){
			res_object.home_team_flag.push(this.src);
		});
		$('.mu-m-link .away .flag').each(function(){
			res_object.away_team_flag.push(this.src);
		});
		$('.mu-m-link .mu-i-stadium').each(function(){
			res_object.stadium.push(this.innerHTML);
		});
		$('.mu-m-link .mu-i-venue').each(function(){
			res_object.city.push(this.innerHTML);
		});
		$('.mu-m-link').each(function(){
			res_object.resource_uri.push(this.href);
		});

	  	div = null;
	  	finalize(id, res_object, cb);
	  }
	);
};

function finalize(id, res_object, cb) {
	var json = [];
	for (var i = 0; i < res_object.date.length; ++i) {
		json.push({
			// date: status[i].length > 0 ? status[i] : date[i],
			id: models.id(),
			date: res_object.date[i],
			status: res_object.status[i],
			timestamp: new Date(res_object.date[i]).getTime() + i,
			score: res_object.score[i],
			home_team: res_object.home_team[i],
			home_team_flag: res_object.home_team_flag[i].replace('4', 5),
			away_team: res_object.away_team[i],
			away_team_flag: res_object.away_team_flag[i].replace('4', 5),
			stadium: res_object.stadium[i],
			city: res_object.city[i],
			resource_uri: 'http://www.fifa.com' + res_object.resource_uri[i].replace('file://', '')
		});

		if (json[i].score.indexOf('-') != -1 && (!json[i].status || json[i].status.length == 0)) json[i].status = 'LIVE';
	};
	
	json.sort(function(a, b){
		return a.timestamp - b.timestamp;
	});

	console.log('ready to respond... ', json.length);

	cb(null, { data: json } );
	res_object = null;
	json = null;
};