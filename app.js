/**
 * Module dependencies.
 */

var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var fs = require('fs');
var path = require('path');
var proxy = require('express-http-proxy');
var url = require('url');
var twitter = require('ntwitter');
var cheerio = require('cheerio');
var request = require('request');

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
//app.set('view engine', 'jshtml');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser('your secret here'));
//app.use(express.session());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

//app.engine('jshtml', require('jshtml-express'));
app.set('view engine', 'ejs');

// development only
app.use(express.errorHandler());

app.get('/tv', function (req, res) {
	var url_parts = url.parse(req.url, true);
	var query = url_parts.query;
	if (query.url) {
		res.render('tv.ejs', {
			url: query.url
		});
	} else {
		res.render('tv.ejs', {
			url: '/nasa/multimedia/nasatv/NTV-Public-IPS.m3u8'
		});
	}
});

app.get('/', function (req, res) {
	fs.readFile(__dirname + '/public/index.html', 'utf8', function (err, text) {
		res.send(text);
	});
});

app.use('/nasa', proxy('www.nasa.gov', {
	forwardPath: function (req, res) {
		return require('url').parse(req.url).path;
	}
}));

app.use('/bbc', proxy('www.bbc.co.uk', {
	forwardPath: function (req, res) {
		return require('url').parse(req.url).path;
	}
}));


app.get('/guide/bbcone', function (req, res) {
	var url = 'http://www.bbc.co.uk/iplayer/live/bbcone';

	request(url, function (err, resp, body) {
		$ = cheerio.load(body);
		$('#now div .title.trunc').each(function () {
			res.jsonp({
				title: $(this).text().trim()
			})
		});
	})

});

app.get('/guide/bbctwo', function (req, res) {
	var url = 'http://www.bbc.co.uk/iplayer/live/bbctwo';

	request(url, function (err, resp, body) {
		$ = cheerio.load(body);
		$('#now div .title.trunc').each(function () {
			res.jsonp({
				title: $(this).text().trim()
			})
		});
	})

});

app.get('/guide/bbcthree', function (req, res) {
	var url = 'http://www.bbc.co.uk/iplayer/live/bbcthree';

	request(url, function (err, resp, body) {
		$ = cheerio.load(body);
		$('#now div .title.trunc').each(function () {
			return res.jsonp({
				title: $(this).text().trim()
			})
		});

		res.jsonp({
			title: "Off-air"
		})
	})

});

app.get('/guide/bbcthee', function (req, res) {
	var url = 'http://www.bbc.co.uk/iplayer/live/bbcthree';

	request(url, function (err, resp, body) {
		$ = cheerio.load(body);
		console.log($.html());
		$('#now div .title.trunc').each(function () {
			return res.jsonp({
				title: $(this).text().trim()
			})
		});

		res.jsonp({
			title: "Off-air"
		})
	})

});

server.listen(app.get('port'), function () {
	console.log('Express server listening on port ' + app.get('port'));
});

var tvs = [];

io.sockets.on('connection', function (socket) {
	console.log('connected');

	socket.on('tv', function () {
		tvs[socket.id] = socket;
		console.log("New TV! Really?");
	});

	socket.on('remote:reload', function () {
		for (var id in tvs) {
			tvs[id].emit('reload');
		}
	});
	socket.on('remote:play', function (data) {
		for (var id in tvs) {
			tvs[id].emit('play', data);
		}
	});
	socket.on('remote:notification', function (data) {
		for (var id in tvs) {
			tvs[id].emit('notification', data);
		}
	});

	socket.on('remote:message', function (data) {
		for (var id in tvs) {
			tvs[id].emit('message', data);
		}
	});

	socket.on('remote:timer', function (data) {
		console.log("Starting timer for " + data.delay + " minutes");
		setTimeout(function () {
			console.log("Timer done")
			for (var id in tvs) {
				tvs[id].emit('notification', data);
			}
		}, data.delay * 60000);
	});

	socket.on('remote:alarm', function (data) {
		console.log("Setting alarm for " + data.time);
		setTimeout(function () {
			for (var id in tvs) {
				tvs[id].emit('alarm', data);
			}
		}, new Date(data.time) - new Date());
	});

	socket.on('disconnect', function () {
		delete tvs[socket.id];
		console.log(tvs);
	});
});


var t = new twitter({
	consumer_key: process.env.TCK, // <--- FILL ME IN
	consumer_secret: process.env.TCS, // <--- FILL ME IN
	access_token_key: process.env.TAT, // <--- FILL ME IN
	access_token_secret: process.env.TAS // <--- FILL ME IN
});

//Tell the twitter API to filter on the watchSymbols
t.stream('statuses/filter', {
	track: ['@maxjmay']
}, function (stream) {
	stream.on('data', function (tweet) {

		if (tweet.text !== undefined) {
			if (tweet.text.toLowerCase().indexOf('@maxjmay') != -1) {
				console.log(tweet);
				for (var id in tvs) {
					tvs[id].emit('notification', {
						message: "New twitter metion: " + tweet.text
					});
				}
			}
		}
	});
});
//Redirect to index.html if no middleware has picked up the request
//app.all("/*", function (req, res, next) {
//	res.sendfile("index.html", {
//		root: __dirname + "/public"
//	});
//});
