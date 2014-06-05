stackTraceLimit = Infinity;

var http = require('http'),
	https = require('https'),
	express = require("express"),
	redis = require('redis'),
	mongoose = require('mongoose'),
	cookie = require('cookie'),
	cluster = require('cluster'),
	cpuCount = require('os').cpus().length,
	app = express(),
	agent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.114 Safari/537.36';

app.set('views', __dirname + '/app');
app.use(require('body-parser')());
app.use(require('method-override')());
app.use(require('morgan')('dev'));
app.set('port', process.env.PORT || 8080);


options = {
	hostname: 'twitter.com',
	path: '/m_mozafarian', // TODO: get this from user...
	headers: {
		method: 'GET',
		host: 'twitter.com', 
		path: '/m_mozafarian',
		scheme: 'https',
		version: 'HTTP/1.1',
		accept:'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
		'cache-control': 'max-age=0',
		'user-agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.114 Safari/537.36'
	}	
}



var req = https.request(options, function(res){
	var data = '';

	res.on('data', function(chunk){
		data += chunk;
	});

	res.on('end', function(){
		console.log(res.headers);
	});
});

req.on('error', function(e) {
  console.log('problem with request: ' + e.message);
});

req.end();