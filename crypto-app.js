var
	express = require('express'),
	app = express(),
	MongoClient = require('mongodb').MongoClient,
	ObjectID = require('mongodb').ObjectID,
	dbAddress = 'mongodb://127.0.0.1:27017/crypto';

//Message object constructor
function Message(text) {
	this.text = text;
	this.encryptedText = "";
	this.hint = "";
	this.encrypt = function() {
		var unique = [];
		var cryptoChars = [];
		var alphabet = ['a','b','c','d','e','f','g','h',
						'i','j','k','l','m','n','o','p',
						'q','r','s','t','u','v','w','x',
						'y','z'];
		var alphaRemaining = alphabet.slice(0);
		for (var i = 0; i < this.text.length; i++) {
			var c = this.text[i];
			if(alphabet.indexOf(c) !== -1) {
				if(unique.indexOf(c) === -1) {
					unique.push(c);
					var randomAlpha = alphaRemaining.splice(Math.floor(Math.random()*alphaRemaining.length),1);
					cryptoChars.push(randomAlpha);
				}
				this.encryptedText += cryptoChars[unique.indexOf(c)];
			} else {
				this.encryptedText += c;
			}
		}
		var randomHintIndex = Math.floor(Math.random()*cryptoChars.length);
		this.hint = "Change " + cryptoChars[randomHintIndex] + " to " + unique[randomHintIndex];
	};
	this.createDoc = function() {
		var doc = {};
		doc['text'] = this.text;
		doc['encryptedText'] = this.encryptedText;
		doc['hint'] = this.hint;
		return doc;
	};
	this.createFromDoc = function(doc) {
		this.text = doc.text;
		this.encryptedText = doc.encryptedText;
		this.hint = doc.hint;
		this.id = doc._id;
	};
}

//Store a message in the mongo db
function store(message, callback) {
	MongoClient.connect(dbAddress, function(err, db) {
		if(err) throw err;
		var collection = db.collection('messages');
		collection.insert(message.createDoc(), function(err,result) {
			if(err) throw err;
			else if(result) {
				message.id = result[0]._id;
			}
			callback();
			db.close();
		});
	});
}

//Retrieve a message from the mongo db
function retrieve(id, callback) {
	MongoClient.connect(dbAddress, function(err, db) {
		if(err) throw err;
		var collection = db.collection('messages');
		var doc = collection.findOne({_id:id}, function(err, item) {
			callback(item);
			db.close();
		});
	});
}


//Handle GET root
function getMain(req,res) {
	res.sendfile('main.html');
}

//Handle POST /message
function postMessage(req,res) {
	console.log("POST /message");
}

//Handle GET /message
function getMessage(req,res) {
	console.log("GET /message");
	
}

//Handle GET styles.css
function getStyles(req,res) {
	res.sendfile('styles.css');
}

//Handle 404s
function pageNotFound(req,res,next) {
	res.sendfile('404.html');
}

/*
* Routes
*/
app.get('/', getMain);
app.get('/styles.css', getStyles);
app.post('/message', postMessage);
app.get('/message', getMessage);

/*
* Bind middleware 
*/
app.use(express.favicon('favicon.ico'));
app.use(pageNotFound);

//Listen
var listenPort = 80;
app.listen(listenPort);
console.log('Listening on port ' + listenPort);