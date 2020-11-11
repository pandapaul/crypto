const
	express = require('express'),
	bodyParser = require('body-parser'),
	favicon = require('express-favicon'),
	app = express(),
	mongo = require('mongodb'),
	message = require('./lib/message'),
	doc = require('./lib/doc'),
	MongoClient = mongo.MongoClient,
	ObjectID = mongo.ObjectID,
	dbHost = process.env.DB_HOST || 'mongodb://127.0.0.1:27017',
	dbName = process.env.DB_NAME || 'crypto';

const getMessagesCollection = callback => {
	MongoClient.connect(dbHost, function(err, client) {
		if(err) throw err
		const db = client.db(dbName)
		const collection = db.collection('messages')
		callback(collection)
	})
}

//Store a message in the mongo db
function store(message, callback) {
	getMessagesCollection(collection => {
		collection.insertOne(doc(message), function(err,result) {
			if(err) throw err
			else if(result) {
				message.id = result.ops[0]._id
			}
			callback()
		});
	})
}

//Retrieve a message from the mongo db
function retrieve(id, callback) {
	try {
		id = new ObjectID(id);
	} catch (e) {
		callback(null);
		return;
	}
	getMessagesCollection(collection => {
		collection.findOne({_id:id}, function(err, item) {
			callback(item);
		});
	});
}

//Update a message in the mongo db
function update(query, updateCommand, callback) {
	getMessagesCollection(collection => {
		collection.update(query,updateCommand,function(err,result) {
			if(err) throw err;
			callback();
		});
	});
}

//Update a message in the mongo db and retreive its contents
function findAndModify(query, sort, updateCommand, callback) {
	getMessagesCollection(collection => {
		collection.findAndModify(query,sort,updateCommand,function(err,object) {
			if(err) throw err;
			callback(object);
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
	getMessagesCollection(collection => {
		collection.remove({'_id':id}, function(err,result) {
			if(err) throw err;
		});
	});
}

//Handle GET root
function getMain(req,res) {
	res.sendfile('main.html');
}

//Handle POST /message
function postMessage(req,res) {
	console.log('req.body', req.body)
	const encryptedMessage = message({ 
		text: req.body.message,
		burnable: req.body.burnable,
		limited: req.body.limited
	});
	store(encryptedMessage, function() {
		res.json(encryptedMessage);
	});
}

//Handle GET /message
function getMessage(req,res) {
	if(req.query.id && req.query.user) {
		var timestamp = new Date().getTime();
		//Kick inactive users
		var updateQuery = {'_id':new ObjectID(req.query.id)};
		var sort = {};
		var updateCommand = {$pull:{'allUsers':{'timestamp':{$lt:timestamp - 5000}}}};
		findAndModify(updateQuery,sort,updateCommand,function(data){
			var doc = data && data.value;
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
app.use(bodyParser());
app.get('/', getMain);
app.get('/styles.css', getStyles);
app.post('/message', postMessage);
app.get('/message', getMessage);
app.get('/view', getView);
app.post('/guess', postGuess);
app.post('/check',postCheck);
app.get('/cookies.js', getCookiesJS);
app.get('/about', getAbout);
app.use(favicon('favicon.ico'));
app.use(pageNotFound);

//Listen
var listenPort = process.env.PORT || 5000;
app.listen(listenPort);
console.log('Listening on port ' + listenPort);
