stackTraceLimit = Infinity;

console.log('Forking Fifa %s...', process.pid);

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
	hostname: 'www.fifa.com', 
	path: '/worldcup/matches/index.html', 
	headers: {
		accept:'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
		'cache-control': 'max-age=0',
		'user-agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.114 Safari/537.36'
	}	
};

var date = [], home_team = [], away_team = [], score = [], 
	home_team = [], away_team_flag = [], home_team_flag = [], stadium = [], city = [], resource_uri = [];

process.on('message', function(message){
	fetch(options);
});


function fetch(options) {
	console.log('about to fetch');
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

			jsonify(divs);

			divs = null;
			data = null;
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

function jsonify(div) {
	console.log('in jsonify');
	jsdom.env(
	  div,
	  ["http://code.jquery.com/jquery.js"],
	  function (error, window) {
	  	if (error) {
	  		process.send({
	  			error: true
	  		});
	  		// global.gc();
	  		throw error;
	  	}
	  	console.log('json generated..')
	  	// json.push({
	  	// 	index: index,
	  	// 	tweeted_by:  window.$('.ProfileTweet-fullname').text(),
	  	// 	tweet_body: window.$("p").text(),
	  	// 	tweet_image_url: window.$('.TwitterPhoto-mediaSource').attr('src'),
	  	// 	tweet_url: window.$('.twitter-timeline-link').attr('href'),
	  	// 	retweet_count: window.$('.ProfileTweet-action--retweet .ProfileTweet-actionCountForPresentation').text(),
	  	// 	favorited_count: window.$('.ProfileTweet-action--favorite .ProfileTweet-actionCountForPresentation').text(),
	  	// 	tweet_timestamp: window.$('.js-short-timestamp').text()
	  	// });

		// window.$('.h3-wrap').each(function(){
		// 	console.log(this.innerHTML);
		// });

		var $ = window.$;

		// $('.mu-m-link .mu-i-date, .mu-m-link .s-scoreText, .mu-m-link .home .t-nText, .mu-m-link .away .t-nText, .mu-m-link .home .flag, .mu-m-link .away .flag').each(function(){

		// 	if (this.className == 'mu-i-date') {
		// 		temp.push(this.innerHTML);
		// 	}
		// 	else {
		// 		this.className = this.className.replace(/ +(?= )/g,'');
		// 		this.className = this.className.replace(' ', '');
		// 	}
		// 	if (this.className == 't-nText' && this.parentNode.parentNode.className == 't home') {
		// 		// obj['home_team'] = this.innerHTML;
		// 		temp.push(this.innerHTML);
		// 	}
		// 	else if (this.className == 't-nText' && this.parentNode.parentNode.className == 't away') {
		// 		// obj['away_team'] = this.innerHTML;
		// 		// temp.push(this.innerHTML);
		// 	}
		// 	else if (this.className == 's-scoreText') {
		// 		// obj['score'] = this.innerHTML;
		// 		// temp.push(this.innerHTML);
		// 	}
		// 	else if (this.src && this.parentNode.parentNode.parentNode.className == 't home') {
		// 		// obj['home_team_flag'] = this.src;
		// 		// temp.push(this.src);
		// 	}
		// 	else if (this.src && this.parentNode.parentNode.parentNode.className == 't away') {
		// 		// obj['away_team_flag'] = this.src;
		// 		// temp.push(this.src);
		// 	}
		// 	// console.log(this.className)
		// 	// console.log('\t', this.innerHTML);
		// 	// console.log('}')
		// });

		$('.mu-m-link .mu-i-date').each(function(){
			date.push(this.innerHTML);
		});
		$('.mu-m-link .s-scoreText').each(function(){
			score.push(this.innerHTML);
		});
		$('.mu-m-link .home .t-nText').each(function(){
			home_team.push(this.innerHTML);
		});
		$('.mu-m-link .away .t-nText').each(function(){
			away_team.push(this.innerHTML);
		});
		$('.mu-m-link .home .flag').each(function(){
			home_team_flag.push(this.src);
		});
		$('.mu-m-link .away .flag').each(function(){
			away_team_flag.push(this.src);
		});
		$('.mu-m-link .mu-i-stadium').each(function(){
			stadium.push(this.innerHTML);
		});
		$('.mu-m-link .mu-i-venue').each(function(){
			city.push(this.innerHTML);
		});
		$('.mu-m-link').each(function(){
			resource_uri.push(this.href);
		});

	  	div = null;
	  	finalize();
	  }
	);
};

function finalize() {
	// console.log(temp);
	// json.push({
	// 	home_team: obj['home_team'],
	// 	away_team: obj['away_team'],
	// 	score: obj['score'],
	// 	home_team_flag: obj['home_team_flag'],
	// 	away_team_flag: obj['away_team_flag']
	// });
	// json.sort(function(a, b) {
	// 	return a.index - b.index;
	// });

	for (var i = 0; i < date.length; ++i) {
		json.push({
			date: date[i],
			score: score[i],
			home_team: home_team[i],
			home_team_flag: home_team_flag[i],
			away_team: away_team[i],
			away_team_flag: away_team_flag[i],
			stadium: stadium[i],
			city: city[i],
			resource_uri: resource_uri[i]
		});
	};
	console.log('ready to respond... ', json.length);
	process.send({
		data: { data: json }
	});
	// global.gc();
};