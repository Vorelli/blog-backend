const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const passportJWT = require('passport-jwt');
const JWTStrategy = passportJWT.Strategy;
const extractJWT = passportJWT.ExtractJwt;
const { Pool } = require('pg');
const pool = new Pool();

passport.use(
  'local',
  new LocalStrategy((username, password, done) => {
    const findUserQuery = `
    SELECT users.user_id, username, password_hash
    FROM users
    INNER JOIN user_passes ON users.user_id=user_passes.user_id
    WHERE username=($1)`;
    const findUserQueryValues = [username];

    pool
      .query(findUserQuery, findUserQueryValues)
      .then((value) => {
        const atLeastOneUser = value.rows.length > 0;
        console.log(value);
        const passwordMatchesHash = bcrypt.compareSync(
          password,
          value.rows[0].password_hash
        );
        value.rows[0].password_hash = undefined;

        done(
          atLeastOneUser && passwordMatchesHash
            ? null
            : new Error('Unknown email/password'),
          atLeastOneUser && passwordMatchesHash ? value.rows[0] : null
        );
      })
      .catch((err) => done(err));
  })
);

passport.use(
  'jwt',
  new JWTStrategy(
    {
      jwtFromRequest: extractJWT.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.SECRET
    },
    (jwtPayload, cb) => {
      const findUserQuery = `
      SELECT *
      FROM users
      WHERE user_id=($1)`;
      pool
        .query(findUserQuery, [jwtPayload.user_id])
        .then((result) => cb(null, result.rows[0]))
        .catch((err) => cb(err));
    }
  )
);

module.exports = passport;
