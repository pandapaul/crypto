var
	express = require('express'),
	app = express(),
	mongo = require('mongodb'),
	MongoClient = mongo.MongoClient,
	ObjectID = mongo.ObjectID,
	dbAddress = process.env.MONGOLAB_URI;
	//dbAddress = 'mongodb://127.0.0.1:27017/crypto';

//Message object constructor
function Message(text) {
	this.text = text;
	this.encryptedText = "";
	this.hint = "";
	this.burnable = true;
	this.limited = true;
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
		if(cryptoChars.length>0) {
			this.hint = cryptoChars[randomHintIndex] + " = " + unique[randomHintIndex];
		} else {
			this.hint = "";
		}
	};
	this.createDoc = function() {
		var doc = {};
		doc.text = this.text;
		doc.encryptedText = this.encryptedText;
		doc.hint = this.hint;
		doc.date = new Date();
		doc.timestamp = doc.date.getTime();
		doc.checksLeft = 3;
		doc.allUsers = [];
		doc.burnable = this.burnable;
		doc.limited = this.limited;
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
	try {
		id = new ObjectID(id);
	} catch (e) {
		callback(null);
		return;
	}
	MongoClient.connect(dbAddress, function(err, db) {
		if(err) throw err;
		var collection = db.collection('messages');
		collection.findOne({_id:id}, function(err, item) {
			callback(item);
			db.close();
		});
	});
}

//Update a message in the mongo db
function update(query, updateCommand, callback) {
	MongoClient.connect(dbAddress, function(err, db) {
		if(err) throw err;
		var collection = db.collection('messages');
		collection.update(query,updateCommand,function(err,result) {
			if(err) throw err;
			callback();
			db.close();
		});
	});
}

//Update a message in the mongo db and retreive its contents
function findAndModify(query, sort, updateCommand, callback) {
	MongoClient.connect(dbAddress, function(err, db) {
		if(err) throw err;
		var collection = db.collection('messages');
		collection.findAndModify(query,sort,updateCommand,function(err,object) {
			if(err) throw err;
			callback(object);
			db.close();
		});
	});
}

//Remove a message from the mongo db
function remove(id) {
	try {
		id = new ObjectID(id);
	} catch (e) {
		return;
	}
	MongoClient.connect(dbAddress, function(err, db) {
		if(err) throw err;
		var collection = db.collection('messages');
		collection.remove({'_id':id}, function(err,result) {
			if(err) throw err;
		});
		db.close();
	});
}

//Handle GET root
function getMain(req,res) {
	res.sendfile('main.html');
}

//Handle POST /message
function postMessage(req,res) {
	var message = new Message(req.body.message);
	message.encrypt();
	message.burnable = req.body.burnable;
	message.limited = req.body.limited;
	store(message, function() {
		res.json(message);
	});
}

//Handle GET /message
function getMessage(req,res) {
	if(req.query.id && req.query.user) {
		var timestamp = new Date().getTime();
		//Kick inactive users
		var updateQuery = {'_id':new ObjectID(req.query.id)};
		var sort = {'sort':''};
		var updateCommand = {$pull:{'allUsers':{'timestamp':{$lt:timestamp - 5000}}}};
		findAndModify(updateQuery,sort,updateCommand,function(doc){
			if(doc) {
				if(req.query.user.name && req.query.user.color) {
					var index = indexOfUser(doc.allUsers,req.query.user);
					var updateQuery, updateCommand;
					if(index > -1) {
						//The db doc already knows of this user, so just update the user timestamp
						updateQuery = {'_id':new ObjectID(req.query.id), 'allUsers.name':req.query.user.name, 'allUsers.color':req.query.user.color};
						updateCommand = {$set:{'allUsers.$.timestamp':timestamp}};
						update(updateQuery, updateCommand, function(){});
					} else {
						//The db doc does not know of this user, add him/her
						updateQuery = {'_id':new ObjectID(req.query.id)};
						updateCommand = {$addToSet:{'allUsers':req.query.user}};
						update(updateQuery, updateCommand, function(){});
					}
				}
				delete doc.text;
				res.json(doc);
			} else {
				res.json({'expired':true});
			}
		});
	} else {
		res.sendfile('404.html');
	}
}

//Get the index of matching user in allUsers array
function indexOfUser(allUsers,user) {
	var index = -1;
	for(var i=0;i<allUsers.length;i++) {
		if(allUsers[i].name === user.name && allUsers[i].color === user.color) {
			index = i;
			break;
		}
	}
	return index;
}

//Handle GET /view
function getView(req,res) {
	res.sendfile('message.html');
}

//Handle POST /guess
function postGuess(req,res) {
	if(req.body.id && req.body.guess) {
		var updateQuery = {'_id':new ObjectID(req.body.id)};
		var timestamp = new Date().getTime();
		var updateCommand = {$set:{'timestamp':timestamp,'guess':req.body.guess,'user':req.body.user}};
		update(updateQuery, updateCommand, function() {
			res.json({'timestamp':timestamp});
		});
	} else {
		res.end();
	}
}

//Handle POST /check
function postCheck(req,res) {
	if(req.body.id && req.body.guess) {
		retrieve(req.body.id,function(doc) {
			if(doc) {
				if(doc.checksLeft > 0) {
					var matched = [];
					var checksLeft = doc.checksLeft;
					if(doc.limited === 'true') {
						checksLeft--;
					}
					for(var i=0;i<doc.text.length;i++) {
						matched.push((req.body.guess[i] === doc.text[i]) || /[^a-zA-Z]/.test(doc.text[i]));
					}
					if(matched.indexOf(false)===-1 && doc.burnable === 'true') {
						checksLeft = 0;
					}
					var updateQuery = {'_id':new ObjectID(req.body.id)};
					var timestamp = new Date().getTime();
					var updateData = {'timestamp':timestamp,'matched':matched,'checksLeft':checksLeft,'user':req.body.user};
					var updateCommand = {$set:updateData};
					update(updateQuery, updateCommand, function() {
						res.json(updateData);
					});
				} else if(doc.burnable === 'true') {
					remove(req.body.id);
					res.json({'expired':true});
				} else {
					res.end();
				}
			} else {
				res.json({'expired':true});
			}
		});
	} else {
		res.end();
	}
}

//Handle GET styles.css
function getStyles(req,res) {
	res.sendfile('styles.css');
}

//Handle GET cookies.js
function getCookiesJS(req,res) {
	res.sendfile('cookies.js');
}

//Handle GET about
function getAbout(req,res) {
	res.sendfile('about.html');
}

//Handle 404s
function pageNotFound(req,res,next) {
	res.sendfile('404.html');
}

/*
* Routes and middleware
*/
app.use(express.bodyParser());
app.get('/', getMain);
app.get('/styles.css', getStyles);
app.post('/message', postMessage);
app.get('/message', getMessage);
app.get('/view', getView);
app.post('/guess', postGuess);
app.post('/check',postCheck);
app.get('/cookies.js', getCookiesJS);
app.get('/about', getAbout);
app.use(express.favicon('favicon.ico'));
app.use(pageNotFound);

//Listen
var listenPort = process.env.PORT || 5000;
app.listen(listenPort);
console.log('Listening on port ' + listenPort);
