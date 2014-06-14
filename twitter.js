stackTraceLimit = Infinity;

var self = this,
	http = require('http'),
	https = require('https'),
	redis = require('redis'),
	mongoose = require('mongoose'),
	cookie = require('cookie'),
	cluster = require('cluster'),
	jsdom = require('jsdom'),
	fs = require('fs'),
	cpuCount = require('os').cpus().length,
	agent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.114 Safari/537.36',
	models;


function fetch(options, cb) {
	console.log('about to fetch')
	var start = new Date().getTime();
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
			var left = [];
			for (var i = 0; i < divs.length; ++i) {
				divs[i] = '<div class="Grid" data-component-term="tweet" role="presentation">' + divs[i];
				// left.push(i);
			};

			// fs.writeFile('content.html', divs[0], function(error){
			// 	if (error) throw error;
			// 	console.log('wrote to file')
			// });
			// return;

			jsonify(i, divs.join('\n'), left, cb);

			divs = null;
			data = null;
		});
	});
	req.on('error', function(e) {
	  return cb(error);
	  // global.gc();
	});

	req.end();
};

function jsonify(index, divs, left, cb) {
	console.log('in jsonify');
	var json = [];
	// for (var i = 0; i < divs.length; ++i) {
		jsdom.env(
		  divs,
		  ["http://code.jquery.com/jquery.js"],
		  function (error, window) {
		  	if (error) {
		  		return cb(error);
		  	}
		  	var $ = window.$;
		  	$('.Grid').each(function(){
			  	json.push({
			  		index: index,
			  		tweeted_by:  $(this).find('.ProfileTweet-fullname').text(),
			  		tweet_body: $(this).find("p").text(),
			  		tweet_image_url: $(this).find('.TwitterPhoto-mediaSource').attr('src'),
			  		tweet_url: $(this).find('.twitter-timeline-link').attr('href'),
			  		retweet_count: $(this).find('.ProfileTweet-action--retweet .ProfileTweet-actionCountForPresentation').text(),
			  		favorited_count: $(this).find('.ProfileTweet-action--favorite .ProfileTweet-actionCountForPresentation').text(),
			  		tweet_timestamp: $(this).find('.js-short-timestamp').text()
			  	});
		  	});
		  	// left.splice(left.indexOf(index), 1);
		  	// if (left.length == 0) 
		  	finalize(json, cb);
		  	// div = null;
		  }
		);
	// }
};

function finalize(json, cb) {
	json.sort(function(a, b) {
		return a.index - b.index;
	});

	for (var i = 0; i < json.length; ++i) {
		delete json[i].index;
	};

	cb(null, { data: json });
	// global.gc();
};

exports.fetch = fetch;

exports.config = function(m){
	models = m;
	return self;
};