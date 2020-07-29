const jwt = require('jsonwebtoken');
const passport = require('../middleware/passport');
const bcrypt = require('bcrypt');

module.exports.index = function (req, res, next) {
  res.json({ message: 'Unfinished backend index' });
};

module.exports.loginPOST = function (req, res, next) {
  console.log(bcrypt.hashSync('Natale195!', 10));
  console.log('here');
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err || !user) {
      return res
        .status(400)
        .json({ message: 'Something is not right', user: user });
    } else {
      req.login(user, { session: false }, (err) => {
        if (err) res.send(err);
        else {
          const token = jwt.sign(user, process.env.SECRET);
          return res.json({ user, token });
        }
      });
    }
  })(req, res);
  console.log('here2');
};
