var express = require('express');
var path = require('path');
const bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var formidable = require('formidable');
var logger = require('morgan');
if (process.env.NODE_ENV !== 'production') require('dotenv').config();
const passport = require('./middleware/passport');

const frontendRouter = require('./routes/frontend');
const backendRouter = require('./routes/backend');

var app = express();

app.use(function (req, res, next) {
  if (
    req.url.split('/')[1] == 'backend' &&
    !JSON.parse(process.env.ALLOWEDHOSTS).allowedHosts.find(
      (val) => val == req.hostname
    )
  ) {
    return res.json({ message: 'Unauthorized access to backend.' });
  }
  res.header('Access-Control-Allow-Origin', '*');

  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, Access-Control-Allow-Origin, Content-Security-Policy'
  );
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, OPTIONS, PUT, DELETE'
  );
  next();
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use((req, res, next) => {
  res.locals.passport = passport;
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) next(err);
    else if (user) res.locals.currentUser = user;
    next();
  })(req, res);
});

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/frontend', frontendRouter);
app.use('/backend', backendRouter);

module.exports = app;
