var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var session = require('express-session');
var utility = require('./lib/utility');



var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(session({
  secret: 'haha',
  resave: false,
  saveUninitialized: true,
}));

function restrict(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied';

    // http://localhost:4568/login
    res.redirect('/login');
  }
}

app.get('/signup', function(req, res) {
  res.render('signup');
});

app.get('/login', function(req, res) {
  res.render('login');
});

app.get('/logout', function(req, res) {
  req.session.destroy(function(err) {
    // console.log("err",err);
    res.redirect('/login');
  });
});

// http://localhost:4568/
app.get('/', restrict,
function(req, res) {
  res.render('index');
});


app.get('/create', restrict,
function(req, res) {
  res.render('index');
});



app.get('/links', restrict,
function(req, res) {
  Links.reset().fetch().then(function(links) {
    var newarr = [];
    links.models.forEach(function(model) {
      if (model.attributes.username === req.session.user) {
        newarr.push(model);      
      }
    });
    res.status(200).send(newarr);
  });
});

app.post('/links', 
function(req, res) {
  var uri = req.body.url;
  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }

  new Link({ url: uri, username: req.session.user}).fetch().then(function(found) {
    if (found) {
      res.status(200).send(found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.sendStatus(404);
        }


        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin,
          username: req.session.user
        })
        .then(function(newLink) {
          res.status(200).send(newLink);
        });
      });
    }
  });
});

app.post('/signup', function(req, res) {
  new User({ username: req.body.username })
    .fetch()
    .then(function(found) {
      if (found) {
        // user already exists
        console.log('Signup username already exists.');
        res.redirect('/signup');
      } else {
        Users.create({
          username: req.body.username,
          password: req.body.password,
          salt: utility.salting()
        })
        .then(function(found) {
          req.session.user = req.body.username;
          res.redirect('/');
        });
      }
    });
});

app.post('/login', function(req, res) {
  new User({ username: req.body.username })
    .fetch()
    .then(function(found) {
      if (found) {
        if (found.attributes.password === utility.hashing(req.body.password + found.attributes.salt)) {
          req.session.user = req.body.username;
          res.redirect('/');
        } else {
          console.log('Username does not exist or password does not match.');
          res.redirect('/login');
        }
      }
    });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
