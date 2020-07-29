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
    SELECT username, password_hash
    FROM users
    INNER JOIN user_passes ON users.id=user_passes.user_id
    WHERE username=($1)`;
    const findUserQueryValues = [username];

    pool
      .query(findUserQuery, findUserQueryValues)
      .then((value) => {
        const atLeastOneUser = value.rows.length > 0;
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
      secretOrKey: 'secret'
    },
    (jwtPayload, cb) => {
      const findUserQuery = `
      SELECT *
      FROM users
      WHERE id=($1)`;
      pool
        .query(findUserQuery, [jwtPayload.id])
        .then((result) => cb(null, result.rows[0]))
        .catch((err) => cb(err));
    }
  )
);

function getSecret() {
  console.log(process.env.SECRET);
  return process.env.SECRET;
}

module.exports = passport;
