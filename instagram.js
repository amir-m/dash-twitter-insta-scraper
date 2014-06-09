stackTraceLimit = Infinity;

console.log('Forking Instagram %s...', process.pid);

var http = require('http'),
	https = require('https'),
	redis = require('redis'),
	phantom = require('phantom'),
	mongoose = require('mongoose'),
	cookie = require('cookie'),
	cluster = require('cluster'),
	jsdom = require('jsdom'),
	fs = require('fs'),
	cpuCount = require('os').cpus().length,
	agent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.114 Safari/537.36',
	left = [], json = [], start;

var options = {
	hostname: 'instagram.com',
	path: '/', 
	headers: {
		'cache-control': 'max-age=0',
		'user-agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.114 Safari/537.36'
	}	
};

process.on('message', function(message){
	console.log('got message')
	console.log(message);
	options.path = message;
	// options.path = 'http://' + options.hostname + options.path;
	fetch(options);
});


function fetch(options) {
	console.log('about to fetch')
	start = new Date().getTime();
	var req = http.request(options, function(res){
		var data = '';
		res.setEncoding('utf8');

		res.on('data', function(chunk){
			data += chunk;

		});

		res.on('end', function(){
			try {
				data = data.split('<script type="text\/javascript">window._sharedData =');
				data = data[1];
				data = data.split('</script>');
				data = data[0];
				data = data.replace('<script type="text/javascript">window._sharedData = ', '');
				data = 'var t = ' + data;
				eval(data);
				data = null;
				t = t.entry_data.UserProfile[0].userMedia;
				console.log(t[0].images.standard_resolution);
				var responses = [];
				for (var i = 0; i < t.length; ++i) {
					responses.push({
						source_uri: t[i].link,
						posted_by: t[i].user.username,
						image_url: t[i].images.standard_resolution.url,
						likes_count: t[i].likes.count,
						comments_count: t[i].comments.count,
						location: t[i].location,
						created_at: t[i].created_time
					});
				}
			}
			catch(error) {
				console.log(error);
				t = null;
				process.send({
					error: true
				});
				// global.gc();
			}
			finalize(responses);
		});
	});
	req.on('error', function(e) {
	  console.log('problem with request: ' + e.message);
	  process.send({
	  	error: true
	  });
	  // global.gc();
	});

	req.end();
};
function finalize(json) {
	console.log('ready to respond...')
	process.send({
		data: json
	});
	json = null;
	// global.gc();
};