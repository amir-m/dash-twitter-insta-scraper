stackTraceLimit = Infinity;

var self = this, models,
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
	left = [], json = [], start, data;

var options = {
	hostname: 'www.fifa.com', 
	path: '/worldcup/matches/index.html', 
	headers: {
		accept:'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
		'cache-control': 'max-age=0',
		'user-agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.114 Safari/537.36'
	}	
};


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
	req.on('error', function(error) {
	  console.log('problem with request: ' + error.message);
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

		$('.mu-m-link .s-date-HHmm').each(function(){
			res_object.utc_date_time.push($(this).attr('data-timeutc'));
		});
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
			utc_date_time: res_object.utc_date_time[i] ? res_object.date[i] + ' ' + res_object.utc_date_time[i] + ' UTC' : null,
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

		// json[i]['utc_date_time'] = res_object.date[i] + ' ' + res_object.utc_date_time[i] + ' UTC';

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

exports.fetch = fetch;

exports.config = function(m){
	models = m;
	return self;
};

// process.on('message', function(message){
// 	var res_object = {
// 		date: [],
// 		status: [],
// 		home_team: [],
// 		away_team: [],
// 		score: [],
// 		home_team: [],
// 		away_team_flag: [],
// 		home_team_flag: [],
// 		stadium: [],
// 		city: [],
// 		resource_uri: []
// 	};
// 	fetch(options, message.id, res_object);
// });


// function fetch(options, id, res_object) {
// 	console.log('about to fetch: %s', id);
// 	start = new Date().getTime();
// 	var req = http.request(options, function(res){
// 		var data = '';

// 		res.on('data', function(chunk){
// 			data += chunk;
// 		});

// 		res.on('end', function(){
// 			data = data.toString('utf8');
// 			data = data.replace(/\n/g, '');
// 			data = data.replace(/\r/g, '');
// 			data = data.replace(/ +(?= )/g,'');
// 			data = data.replace(/>\s*</g,'><');


// 			var divs = data.split('<div class="matches">')[1];

// 			divs = divs.split('</div></div></div><div class="row row-last">')[0];

// 			divs += '</div></div></div>';

// 			// fs.writeFile('content.html', divs, function(error){
// 			// 	if (error) throw error;
// 			// 	console.log('wrote to file')
// 			// });

// 			jsonify(divs, id, res_object);

// 			divs = null;
// 			data = null;
// 		});
// 	});
// 	req.on('error', function(e) {
// 	  console.log('problem with request: ' + e.message);
// 	  process.send({
// 	  	error: true,
// 	  	id: id
// 	  });
// 	  // global.gc();
// 	});

// 	req.end();
// };

// function jsonify(div, id, res_object) {
// 	console.log('in jsonify');
// 	jsdom.env(
// 	  div,
// 	  ["http://code.jquery.com/jquery.js"],
// 	  function (error, window) {
// 	  	if (error) {
// 	  		res_object = null;
// 	  		process.send({
// 	  			error: true,
// 	  			id: id
// 	  		});
// 	  		// global.gc();
// 	  		throw error;
// 	  	}

// 		var $ = window.$;

// 		$('.mu-m-link .mu-i-date').each(function(){
// 			res_object.date.push(this.innerHTML);
// 		});
// 		$('.mu-m-link .s-status').each(function(){
// 			var t = this.innerHTML;
// 			t = t.replace(/\s*/g, '');
// 			res_object.status.push(this.innerHTML);
// 		});
// 		$('.mu-m-link .s-scoreText').each(function(){
// 			res_object.score.push(this.innerHTML);
// 		});
// 		$('.mu-m-link .home .t-nText').each(function(){
// 			res_object.home_team.push(this.innerHTML);
// 		});
// 		$('.mu-m-link .away .t-nText').each(function(){
// 			res_object.away_team.push(this.innerHTML);
// 		});
// 		$('.mu-m-link .home .flag').each(function(){
// 			res_object.home_team_flag.push(this.src);
// 		});
// 		$('.mu-m-link .away .flag').each(function(){
// 			res_object.away_team_flag.push(this.src);
// 		});
// 		$('.mu-m-link .mu-i-stadium').each(function(){
// 			res_object.stadium.push(this.innerHTML);
// 		});
// 		$('.mu-m-link .mu-i-venue').each(function(){
// 			res_object.city.push(this.innerHTML);
// 		});
// 		$('.mu-m-link').each(function(){
// 			res_object.resource_uri.push(this.href);
// 		});

// 	  	div = null;
// 	  	finalize(id, res_object);
// 	  }
// 	);
// };

// function finalize(id, res_object) {
	
// 	for (var i = 0; i < res_object.date.length; ++i) {
// 		json.push({
// 			// date: status[i].length > 0 ? status[i] : date[i],
// 			date: res_object.date[i],
// 			status: res_object.status[i],
// 			timestamp: new Date(res_object.date[i]).getTime() + i,
// 			score: res_object.score[i],
// 			home_team: res_object.home_team[i],
// 			home_team_flag: res_object.home_team_flag[i].replace('4', 5),
// 			away_team: res_object.away_team[i],
// 			away_team_flag: res_object.away_team_flag[i].replace('4', 5),
// 			stadium: res_object.stadium[i],
// 			city: res_object.city[i],
// 			resource_uri: 'http://www.fifa.com' + res_object.resource_uri[i].replace('file://', '')
// 		});

// 		if (json[i].score.indexOf('-') != -1 && (!json[i].status || json[i].status.length == 0)) json[i].status = 'LIVE';
// 	};
	
// 	json.sort(function(a, b){
// 		return a.timestamp - b.timestamp;
// 	});

// 	console.log('ready to respond... ', json.length);
// 	process.send({
// 		data: { data: json },
// 		id: id
// 	});
// 	res_object = null;
// };

// data = [
// 	{
// 		date: "4 Jun 2014",
// 		score: "17:00",
// 		home_team: "Brazil",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/bra.png",
// 		away_team: "Croatia",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/cro.png",
// 		stadium: "Arena Corinthians",
// 		city: "Sao Paulo ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186456/index.html#nosticky"
// 	},
// 	{
// 		date: "5 Jun 2014",
// 		score: "13:00",
// 		home_team: "Mexico",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/mex.png",
// 		away_team: "Cameroon",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/cmr.png",
// 		stadium: "Estadio das Dunas",
// 		city: "Natal ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186492/index.html#nosticky"
// 	},
// 	{
// 		date: "5 Jun 2014",
// 		score: "18:00",
// 		home_team: "Chile",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/chi.png",
// 		away_team: "Australia",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/aus.png",
// 		stadium: "Arena Pantanal",
// 		city: "Cuiaba ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186473/index.html#nosticky"
// 	},
// 	{
// 		date: "5 Jun 2014",
// 		score: "16:00",
// 		home_team: "Spain",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/esp.png",
// 		away_team: "Netherlands",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/ned.png",
// 		stadium: "Arena Fonte Nova",
// 		city: "Salvador",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186510/index.html#nosticky"
// 	},
// 	{
// 		date: "6 Jun 2014",
// 		score: "16:00",
// 		home_team: "Uruguay",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/uru.png",
// 		away_team: "Costa Rica",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/crc.png",
// 		stadium: "Estadio Castelao",
// 		city: "Fortaleza ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186489/index.html#nosticky"
// 	},
// 	{
// 		date: "6 Jun 2014",
// 		score: "22:00",
// 		home_team: "Côte d'Ivoire",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/civ.png",
// 		away_team: "Japan",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/jpn.png",
// 		stadium: "Arena Pernambuco",
// 		city: "Recife ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186507/index.html#nosticky"
// 	},
// 	{
// 		date: "6 Jun 2014",
// 		score: "13:00",
// 		home_team: "Colombia",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/col.png",
// 		away_team: "Greece",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/gre.png",
// 		stadium: "Estadio Mineirao",
// 		city: "Belo Horizonte ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186471/index.html#nosticky"
// 	},
// 	{
// 		date: "6 Jun 2014",
// 		score: "18:00",
// 		home_team: "England",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/eng.png",
// 		away_team: "Italy",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/ita.png",
// 		stadium: "Arena Amazonia",
// 		city: "Manaus ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186513/index.html#nosticky"
// 	},
// 	{
// 		date: "7 Jun 2014",
// 		score: "13:00",
// 		home_team: "Switzerland",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/sui.png",
// 		away_team: "Ecuador",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/ecu.png",
// 		stadium: "Estadio Nacional",
// 		city: "Brasilia ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186494/index.html#nosticky"
// 	},
// 	{
// 		date: "7 Jun 2014",
// 		score: "16:00",
// 		home_team: "France",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/fra.png",
// 		away_team: "Honduras",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/hon.png",
// 		stadium: "Estadio Beira-Rio",
// 		city: "Porto Alegre ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186496/index.html#nosticky"
// 	},
// 	{
// 		date: "7 Jun 2014",
// 		score: "19:00",
// 		home_team: "Argentina",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/arg.png",
// 		away_team: "Bosnia and Herzegovina",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/bih.png",
// 		stadium: "Maracanã - Estádio Jornalista Mário Filho",
// 		city: "Rio De Janeiro ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186477/index.html#nosticky"
// 	},
// 	{
// 		date: "8 Jun 2014",
// 		score: "16:00",
// 		home_team: "Iran",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/irn.png",
// 		away_team: "Nigeria",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/nga.png",
// 		stadium: "Arena da Baixada",
// 		city: "Curitiba ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186505/index.html#nosticky"
// 	},
// 	{
// 		date: "8 Jun 2014",
// 		score: "19:00",
// 		home_team: "Ghana",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/gha.png",
// 		away_team: "USA",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/usa.png",
// 		stadium: "Estadio das Dunas",
// 		city: "Natal ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186512/index.html#nosticky"
// 	},
// 	{
// 		date: "8 Jun 2014",
// 		score: "13:00",
// 		home_team: "Germany",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/ger.png",
// 		away_team: "Portugal",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/por.png",
// 		stadium: "Arena Fonte Nova",
// 		city: "Salvador",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186475/index.html#nosticky"
// 	},
// 	{
// 		date: "9 Jun 2014",
// 		score: "16:00",
// 		home_team: "Brazil",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/bra.png",
// 		away_team: "Mexico",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/mex.png",
// 		stadium: "Estadio Castelao",
// 		city: "Fortaleza ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186509/index.html#nosticky"
// 	},
// 	{
// 		date: "9 Jun 2014",
// 		score: "18:00",
// 		home_team: "Russia",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/rus.png",
// 		away_team: "Korea Republic",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/kor.png",
// 		stadium: "Arena Pantanal",
// 		city: "Cuiaba ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186499/index.html#nosticky"
// 	},
// 	{
// 		date: "9 Jun 2014",
// 		score: "13:00",
// 		home_team: "Belgium",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/bel.png",
// 		away_team: "Algeria",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/alg.png",
// 		stadium: "Estadio Mineirao",
// 		city: "Belo Horizonte ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186479/index.html#nosticky"
// 	},
// 	{
// 		date: "10 Jun 2014",
// 		score: "13:00",
// 		home_team: "Australia",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/aus.png",
// 		away_team: "Netherlands",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/ned.png",
// 		stadium: "Estadio Beira-Rio",
// 		city: "Porto Alegre ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186478/index.html#nosticky"
// 	},
// 	{
// 		date: "10 Jun 2014",
// 		score: "16:00",
// 		home_team: "Spain",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/esp.png",
// 		away_team: "Chile",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/chi.png",
// 		stadium: "Maracanã - Estádio Jornalista Mário Filho",
// 		city: "Rio De Janeiro ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186498/index.html#nosticky"
// 	},
// 	{
// 		date: "10 Jun 2014",
// 		score: "18:00",
// 		home_team: "Cameroon",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/cmr.png",
// 		away_team: "Croatia",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/cro.png",
// 		stadium: "Arena Amazonia",
// 		city: "Manaus ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186453/index.html#nosticky"
// 	},
// 	{
// 		date: "11 Jun 2014",
// 		score: "13:00",
// 		home_team: "Colombia",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/col.png",
// 		away_team: "Côte d'Ivoire",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/civ.png",
// 		stadium: "Estadio Nacional",
// 		city: "Brasilia ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186468/index.html#nosticky"
// 	},
// 	{
// 		date: "11 Jun 2014",
// 		score: "16:00",
// 		home_team: "Uruguay",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/uru.png",
// 		away_team: "England",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/eng.png",
// 		stadium: "Arena Corinthians",
// 		city: "Sao Paulo ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186486/index.html#nosticky"
// 	},
// 	{
// 		date: "11 Jun 2014",
// 		score: "19:00",
// 		home_team: "Japan",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/jpn.png",
// 		away_team: "Greece",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/gre.png",
// 		stadium: "Estadio das Dunas",
// 		city: "Natal ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186454/index.html#nosticky"
// 	},
// 	{
// 		date: "12 Jun 2014",
// 		score: "13:00",
// 		home_team: "Italy",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/ita.png",
// 		away_team: "Costa Rica",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/crc.png",
// 		stadium: "Arena Pernambuco",
// 		city: "Recife ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186500/index.html#nosticky"
// 	},
// 	{
// 		date: "12 Jun 2014",
// 		score: "16:00",
// 		home_team: "Switzerland",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/sui.png",
// 		away_team: "France",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/fra.png",
// 		stadium: "Arena Fonte Nova",
// 		city: "Salvador",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186514/index.html#nosticky"
// 	},
// 	{
// 		date: "12 Jun 2014",
// 		score: "19:00",
// 		home_team: "Honduras",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/hon.png",
// 		away_team: "Ecuador",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/ecu.png",
// 		stadium: "Arena da Baixada",
// 		city: "Curitiba ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186463/index.html#nosticky"
// 	},
// 	{
// 		date: "13 Jun 2014",
// 		score: "13:00",
// 		home_team: "Argentina",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/arg.png",
// 		away_team: "Iran",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/irn.png",
// 		stadium: "Estadio Mineirao",
// 		city: "Belo Horizonte ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186466/index.html#nosticky"
// 	},
// 	{
// 		date: "13 Jun 2014",
// 		score: "18:00",
// 		home_team: "Nigeria",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/nga.png",
// 		away_team: "Bosnia and Herzegovina",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/bih.png",
// 		stadium: "Arena Pantanal",
// 		city: "Cuiaba ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186511/index.html#nosticky"
// 	},
// 	{
// 		date: "13 Jun 2014",
// 		score: "16:00",
// 		home_team: "Germany",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/ger.png",
// 		away_team: "Ghana",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/gha.png",
// 		stadium: "Estadio Castelao",
// 		city: "Fortaleza ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186493/index.html#nosticky"
// 	},
// 	{
// 		date: "14 Jun 2014",
// 		score: "13:00",
// 		home_team: "Belgium",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/bel.png",
// 		away_team: "Russia",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/rus.png",
// 		stadium: "Maracanã - Estádio Jornalista Mário Filho",
// 		city: "Rio De Janeiro ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186481/index.html#nosticky"
// 	},
// 	{
// 		date: "14 Jun 2014",
// 		score: "16:00",
// 		home_team: "Korea Republic",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/kor.png",
// 		away_team: "Algeria",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/alg.png",
// 		stadium: "Estadio Beira-Rio",
// 		city: "Porto Alegre ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186495/index.html#nosticky"
// 	},
// 	{
// 		date: "14 Jun 2014",
// 		score: "18:00",
// 		home_team: "USA",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/usa.png",
// 		away_team: "Portugal",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/por.png",
// 		stadium: "Arena Amazonia",
// 		city: "Manaus ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186483/index.html#nosticky"
// 	},
// 	{
// 		date: "15 Jun 2014",
// 		score: "13:00",
// 		home_team: "Netherlands",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/ned.png",
// 		away_team: "Chile",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/chi.png",
// 		stadium: "Arena Corinthians",
// 		city: "Sao Paulo ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186470/index.html#nosticky"
// 	},
// 	{
// 		date: "15 Jun 2014",
// 		score: "13:00",
// 		home_team: "Australia",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/aus.png",
// 		away_team: "Spain",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/esp.png",
// 		stadium: "Arena da Baixada",
// 		city: "Curitiba ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186467/index.html#nosticky"
// 	},
// 	{
// 		date: "15 Jun 2014",
// 		score: "17:00",
// 		home_team: "Cameroon",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/cmr.png",
// 		away_team: "Brazil",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/bra.png",
// 		stadium: "Estadio Nacional",
// 		city: "Brasilia ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186472/index.html#nosticky"
// 	},
// 	{
// 		date: "15 Jun 2014",
// 		score: "17:00",
// 		home_team: "Croatia",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/cro.png",
// 		away_team: "Mexico",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/mex.png",
// 		stadium: "Arena Pernambuco",
// 		city: "Recife ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186452/index.html#nosticky"
// 	},
// 	{
// 		date: "16 Jun 2014",
// 		score: "13:00",
// 		home_team: "Italy",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/ita.png",
// 		away_team: "Uruguay",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/uru.png",
// 		stadium: "Estadio das Dunas",
// 		city: "Natal ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186465/index.html#nosticky"
// 	},
// 	{
// 		date: "16 Jun 2014",
// 		score: "13:00",
// 		home_team: "Costa Rica",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/crc.png",
// 		away_team: "England",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/eng.png",
// 		stadium: "Estadio Mineirao",
// 		city: "Belo Horizonte ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186484/index.html#nosticky"
// 	},
// 	{
// 		date: "16 Jun 2014",
// 		score: "16:00",
// 		home_team: "Japan",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/jpn.png",
// 		away_team: "Colombia",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/col.png",
// 		stadium: "Arena Pantanal",
// 		city: "Cuiaba ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186457/index.html#nosticky"
// 	},
// 	{
// 		date: "16 Jun 2014",
// 		score: "17:00",
// 		home_team: "Greece",
// 		home_team_flag: "http://img.fifa.com/images/flags/5/gre.png",
// 		away_team: "Côte d'Ivoire",
// 		away_team_flag: "http://img.fifa.com/images/flags/5/civ.png",
// 		stadium: "Estadio Castelao",
// 		city: "Fortaleza ",
// 		resource_uri: "http://www.fifa.com/worldcup/matches/round=255931/match=300186455/index.html#nosticky"
// 	}
// ]