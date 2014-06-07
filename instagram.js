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
	// phantom.create(function (ph) {
	// 	ph.createPage(function (page) {
	// 		// page.settings.userAgent = options.headers['user-agent'];
	// 		page.open(options.path, function (status) {
	// 			console.log("opened instagram? ", status);
	// 			page.evaluate(function(){ return document.documentElement.outerHTML }, function (result) {
	// 				// setTimeout(function(){
	// 					// fs.writeFile("./htmlFile.html", result, function(err) {
	// 					// 	if(err) {
	// 					// 		console.log(err);
	// 					// 	} else {
	// 					// 		console.log("The file was saved!");
	// 					// 		ph.exit();
	// 					// 	}
	// 					// });
						
	// 					// fs.writeFile("./htmlFile.html", data, function(err) {
	// 					// 	if(err) {
	// 					// 		console.log(err);
	// 					// 	} else {
	// 					// 		console.log("The file was saved!");
	// 					// 		ph.exit();
	// 					// 	}
	// 					// });
	// 				// }, 4000)
	// 				ph.exit();
	// 			});
	// 		});
	// 	});
	// });

	// console.log(options)
	var req = http.request(options, function(res){
		var data = '';
		res.setEncoding('utf8');

		res.on('data', function(chunk){
			data += chunk;

		});

		res.on('end', function(){
			// data = data.replace(/\\/g, '');
			try {
				data = data.split('<script type="text\/javascript">window._sharedData =');
				data = data[1];
				data = data.split('</script>');
				data = data[0];
				// data = data.replace(/\\/g, '');
				// console.log(data)
				data = data.replace('<script type="text/javascript">window._sharedData = ', '');
				// data = '{' + data;
				// data = JSON.parse(data);
				// console.log(data);
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

// function jsonify(index, div) {
// 	console.log('in jsonify')
// 	jsdom.env(
// 	  div,
// 	  ["http://code.jquery.com/jquery.js"],
// 	  function (error, window) {
// 	  	if (error) {
// 	  		process.send({
// 	  			error: true
// 	  		});
	  		// global.gc();
// 	  		throw error;
// 	  	}
// 	  	console.log('json generated..')
// 	  	json.push({
// 	  		index: index,
// 	  		tweeted_by:  window.$('.ProfileTweet-fullname').text(),
// 	  		tweet_body: window.$("p").text(),
// 	  		tweet_image_url: window.$('.TwitterPhoto-mediaSource').attr('src'),
// 	  		tweet_url: window.$('.twitter-timeline-link').attr('href'),
// 	  		retweet_count: window.$('.ProfileTweet-action--retweet .ProfileTweet-actionCountForPresentation').text(),
// 	  		favorited_count: window.$('.ProfileTweet-action--favorite .ProfileTweet-actionCountForPresentation').text(),
// 	  		tweet_timestamp: window.$('.js-short-timestamp').text()
// 	  	});
// 	  	left.splice(left.indexOf(index), 1);
// 	  	if (left.length == 0) finalize();
// 	  	div = null;
// 	  }
// 	);
// };

function finalize(json) {
	console.log('ready to respond...')
	process.send({
		data: json
	});
	json = null;
	// global.gc();
};


// <a aria-haspopup="true" target="_blank" href="http://instagram.com/p/o6KUbkRmwd/" data-reactid=".r[0].[0].[1].[3].{userphotos1364506}[0].[0].[0].[0].[0].[3]"><div class="Image iLoaded iWithTransition tThumbImage" src="http://scontent-a.cdninstagram.com/hphotos-xpa1/t51.2885-15/925871_583036855145172_2087146616_a.jpg" data-reactid=".r[0].[0].[1].[3].{userphotos1364506}[0].[0].[0].[0].[0].[3].[0]" style="background-image: url(http://scontent-a.cdninstagram.com/hphotos-xpa1/t51.2885-15/925871_583036855145172_2087146616_a.jpg);"></div><div class="photoShadow" data-reactid=".r[0].[0].[1].[3].{userphotos1364506}[0].[0].[0].[0].[0].[3].[1]"></div></a>