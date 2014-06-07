stackTraceLimit = Infinity;

console.log('Forking Twitter %s...', process.pid);

var http = require('http'),
	https = require('https'),
	redis = require('redis'),
	mongoose = require('mongoose'),
	cookie = require('cookie'),
	cluster = require('cluster'),
	jsdom = require('jsdom'),
	fs = require('fs'),
	cpuCount = require('os').cpus().length,
	agent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.114 Safari/537.36',
	left = [], json = [], start;

var options = {
	hostname: 'twitter.com',
	path: '/', 
	headers: {
		accept:'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
		'cache-control': 'max-age=0',
		'user-agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.114 Safari/537.36'
	}	
};

process.on('message', function(message){
	console.log('got message')
	console.log(message);
	options.path = message;
	fetch(options);
});


function fetch(options) {
	console.log('about to fetch')
	start = new Date().getTime();
	var req = https.request(options, function(res){
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
			
			var divs = data.split('<div class="Grid" data-component-term="tweet" role="presentation">');
			divs.splice(divs.length - 1, 1);
			divs.splice(0, 1);

			for (var i = 0; i < divs.length; ++i) {
				divs[i] = '<div class="Grid" data-component-term="tweet" role="presentation">' + divs[i];
				left.push(i);
				jsonify(i, divs[i]);
			};

			console.log('jsonified')

			divs = null;
			data = null;
		});
	});
	req.on('error', function(e) {
	  console.log('problem with request: ' + e.message);
	  process.send({
	  	error: true
	  });
	  global.gc();
	});

	req.end();
};

function jsonify(index, div) {
	console.log('in jsonify')
	jsdom.env(
	  div,
	  ["http://code.jquery.com/jquery.js"],
	  function (error, window) {
	  	if (error) {
	  		process.send({
	  			error: true
	  		});
	  		global.gc();
	  		throw error;
	  	}
	  	console.log('json generated..')
	  	json.push({
	  		index: index,
	  		tweeted_by:  window.$('.ProfileTweet-fullname').text(),
	  		tweet_body: window.$("p").text(),
	  		tweet_image_url: window.$('.TwitterPhoto-mediaSource').attr('src'),
	  		tweet_url: window.$('.twitter-timeline-link').attr('href'),
	  		retweet_count: window.$('.ProfileTweet-action--retweet .ProfileTweet-actionCountForPresentation').text(),
	  		favorited_count: window.$('.ProfileTweet-action--favorite .ProfileTweet-actionCountForPresentation').text(),
	  		tweet_timestamp: window.$('.js-short-timestamp').text()
	  	});
	  	left.splice(left.indexOf(index), 1);
	  	if (left.length == 0) finalize();
	  	div = null;
	  }
	);
};

function finalize() {
	json.sort(function(a, b) {
		return a.index - b.index;
	});

	for (var i = 0; i < json.length; ++i) {
		delete json[i].index;
	};
	console.log('ready to respond...')
	process.send({
		data: json
	});
	global.gc();
};