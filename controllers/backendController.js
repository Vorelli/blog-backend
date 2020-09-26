/* eslint-disable camelcase */
const moment = require('moment');
const jwt = require('jsonwebtoken');
const passport = require('../middleware/passport');
const bcrypt = require('bcrypt');
const validator = require('express-validator');
const { Pool } = require('pg');
const pool = new Pool();
const { v5 } = require('uuid');
const formidable = require('formidable');

module.exports.index = function (req, res, next) {
  res.json({
    message: 'Login: /backend/login - View All Posts: /backend/posts'
  });
};

module.exports.checkGET = function (req, res, next) {
  if (res.locals.currentUser) {
    res.status(302).json({ message: 'You are logged in!' });
  } else res.status(401).json({ message: 'You are not authenticated.' });
};

module.exports.loginPOST = [
  (req, res, next) => {
    const form = formidable({ multiples: true });
    form.parse(req, (err, fields) => {
      if (err) next(err);
      else {
        Object.keys(fields).forEach((key) => {
          req.body[key] = fields[key];
        });
      }
      next();
    });
  },

  function (req, res, next) {
    res.locals.errors = [];

    if (req.body.username.length < 3) {
      res.locals.errors.push({ msg: 'You must supply an email.' })
    }

    if (req.body.password.length < 3) {
      res.locals.errors.push({ msg: 'You must supply a password.' })
    }

    passport.authenticate('local', { session: false }, (err, user, info) => {
      console.log(err);
      if (err || !user) {
        res.locals.errors.push({ msg: 'Incorrect email/password combination.' });
        return res
          .status(400)
          .json({ message: 'Something is not right', errors: res.locals.errors });
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
  }
];

module.exports.postViewAllGET = [
  (req, res, next) => {
    setTimeout(next, 0);
  },

  function (req, res, next) {
    if (res.locals.currentUser) {
      const getAllMessagesQuery = `
    SELECT users.user_id, message_id, title, body, first_name, last_name, date, public FROM messages
    INNER JOIN users ON messages.user_id=users.user_id
    WHERE users.user_id=($1)`;
      pool
        .query(getAllMessagesQuery, [res.locals.currentUser.user_id])
        .then((value) => res.json({ messages: value.rows }))
        .catch((err) => next(err));
    } else {
      res.json({
        message: 'You need to log in to view all posts. /backend/login'
      });
    }
  }
];

module.exports.postViewOneGET = function (req, res, next) {
  const postId = req.params.postId;

  const findPostQuery = `
  SELECT * FROM messages
  WHERE message_id=($1);`;
  const findCommentsQuery = `
  SELECT * FROM comments
  WHERE message_id=($1);`;

  pool.connect((err, client, done) => {
    if (err) next(err);
    else {
      Promise.all([
        client.query(findPostQuery, [postId]),
        client.query(findCommentsQuery, [postId])
      ])
        .then((postAndComments) => {
          const postResponse = postAndComments[0];
          const commentsResponse = postAndComments[1];
          res.json({
            post: postResponse.rows[0],
            comments: commentsResponse.rows
          });
        })
        .catch((err) => next(err))
        .finally(() => done());
    }
  });
};

module.exports.postUpdatePUT = [
  async (req, res, next) => {
    const postId = req.params.postId;
    console.log(req.body);

    const findPostQuery = `
    SELECT * FROM messages
    INNER JOIN users ON users.user_id=messages.user_id
    WHERE message_id=($1)`;
    await pool
      .query(findPostQuery, [postId])
      .then((value) => {
        if (value.rows.length < 1) {
          res.locals.errors = [{ msg: 'Post not found.' }];
        }
        res.locals.currentMessage = value.rows[0];
      })
      .catch((err) => next(err));

    next();
  },

  validator.body('*').escape(),

  (req, res, next) => {
    if (res.locals.errors === undefined) res.locals.errors = [];

    if (!res.locals.currentUser) {
      res.locals.errors.push({
        msg: 'You need to be logged in.'
      });
    }

    if (res.locals.currentUser.user_id !== res.locals.currentMessage.user_id) {
      res.locals.errors.push({
        msg: "You cannot edit somebody else's post."
      });
    }

    if (req.body.title) req.body.title = req.body.title.trim();
    if (req.body.body) req.body.body = req.body.body.trim();

    if (!req.body.title || req.body.title.length < 3) {
      res.locals.errors.push({
        msg: 'The title needs to be at least 3 characters long.'
      });
    }

    if (!req.body.body || req.body.body.length < 3) {
      res.locals.errors.push({
        msg: 'The body needs to be at least 3 characters long.'
      });
    }

    next();
  },

  (req, res, next) => {
    const message = {
      id: res.locals.currentMessage.message_id,
      user_id: res.locals.currentUser.user_id,
      public: req.body.public,
      title: req.body.title,
      body: req.body.body
    };

    if (res.locals.errors.length > 0) {
      res.json({
        errors: res.locals.errors,
        message: 'Unable to create post.'
      });
    } else {
      const createPostQuery = `
      UPDATE messages
      SET title=($1), body=($2), public=($3)
      WHERE message_id=($4) AND user_id=($5);`;

      const createPostQueryValues = [
        message.title,
        message.body,
        message.public,
        message.id,
        message.user_id
      ];

      pool
        .query(createPostQuery, createPostQueryValues)
        .then((value) => {
          if (value.rowCount > 0) {
            res.json({
              message: 'Updated post successfully!'
            });
          } else {
            throw new Error(
              'No post was found with the specified id with you as the author.'
            );
          }
        })
        .catch((err) => next(err));
    }
  }
];

module.exports.postCreatePOST = [
  validator.body('*').escape(),

  async (req, res, next) => {
    res.locals.errors = [];

    try {
      const tryToFindDuplicatePostQuery = `
      SELECT * FROM messages
      WHERE message_id=($1)`;
      const response = await pool.query(tryToFindDuplicatePostQuery, [
        v5(req.body.title + req.body.body, process.env.SECRETUUID)
      ]);

      if (response.rowCount > 0) {
        res.locals.errors.push({
          msg:
            'Duplicate post detected. You must change the title or the body slightly.'
        });
      }
    } catch (err) {
      next(err);
    }

    if (!res.locals.currentUser) {
      res.locals.errors.push({
        msg: 'You need to be logged in.'
      });
    }

    if (req.body.title) req.body.title = req.body.title.trim();
    if (req.body.body) req.body.body = req.body.body.trim();

    if (!req.body.title || req.body.title.length < 3) {
      res.locals.errors.push({
        msg: 'The title needs to be at least 3 characters long.'
      });
    }

    if (!req.body.body || req.body.body.length < 3) {
      res.locals.errors.push({
        msg: 'The body needs to be at least 3 characters long.'
      });
    }

    if (req.body.public === undefined || req.body.public === null) {
      res.locals.errors.push({ msg: 'You must set a viewable publicly option.' })
    }

    next();
  },

  (req, res, next) => {
    const message = {
      id: v5(req.body.title + req.body.body, process.env.SECRETUUID),
      user_id: res.locals.currentUser.user_id,
      title: req.body.title,
      body: req.body.body,
      public: req.body.public
    };

    if (res.locals.errors.length > 0) {
      res.json({
        errors: res.locals.errors,
        message: 'Unable to create post.'
      });
    } else {
      const createPostQuery = `
      INSERT INTO messages
      (message_id, user_id, title, body, public, date)
      VALUES ($1,$2,$3, $4, $5, $6);`;
      const createPostQueryValues = [
        message.id,
        message.user_id,
        message.title,
        message.body,
        message.public,
        moment(new Date()).toISOString()
      ];

      pool
        .query(createPostQuery, createPostQueryValues)
        .then((value) => {
          console.log(value);
          res.json({
            message: 'Created post successfully!',
            post_id: message.id
          })
        })

        .catch((err) => next(err));
    }
  }
];

module.exports.postDeleteDELETE = function (req, res, next) {
  const postId = req.params.postId;

  const findCommentsQuery = `
  SELECT * from comments
  WHERE message_id=($1)`;
  const findPostQuery = `
  SELECT * FROM messages
  WHERE message_id=($1)`;

  pool.connect(async (err, client, done) => {
    if (err) next(err);
    else {
      const responses = await Promise.all([
        client.query(findCommentsQuery, [postId]),
        client.query(findPostQuery, [postId])
      ]);

      const message = responses[1].rows[0];
      if (!res.locals.currentUser) {
        res.status(401);
        res.json({
          message: 'You need to be logged in to delete a post'
        });
      } else if (message.user_id !== res.locals.currentUser.user_id) {
        res.status(403);
        res.json({
          message:
            'You need to be the same user as the post creator to delete it.'
        });
      } else if (!message) {
        res.status(404);
        res.json({
          message: 'Post not found...'
        });
      } else {
        const deleteCommentsQuery = `
          DELETE FROM comments
          WHERE message_id=($1);`;
        const deletePostQuery = `DELETE FROM messages
        WHERE message_id=($1);`;
        try {
          const deleteCommentsResponse = await client.query(
            deleteCommentsQuery,
            [postId]
          );
          const deletePostResponse = await client.query(deletePostQuery, [
            postId
          ]);

          res.json({ message: 'Post deleted successfully.' });
        } catch (err) {
          next(err);
        }
      }
      done();
    }
  });
};

module.exports.signUpPOST = [
  validator.body('*').escape(),

  async (req, res, next) => {
    res.locals.errors = [];
    const hashedPass = bcrypt.hash(req.body.password, 10);

    const username = req.body.username.trim();
    const first_name = req.body.first_name.trim();
    const last_name = req.body.last_name.trim();
    const password = req.body.password;
    const passwordConfirmation = req.body.passwordConfirmation;

    res.locals.newUser = {
      username,
      first_name,
      last_name
    };

    const emailValidator = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if (!emailValidator.test(username)) {
      res.locals.errors.push({
        msg: 'You must enter a valid email address.'
      });
    }
    if (
      (await (
        await pool.query('SELECT * FROM users WHERE username = $1', [username])
      ).rowCount) > 0
    ) {
      res.locals.errors.push({
        msg: 'This email has been used before. Try to log in.'
      });
    }

    if (password.length < 8 || password.length > 72) {
      res.locals.errors.push({
        msg:
          'Your password needs to be 8 characters or longer as well as 72 characters or less.'
      });
    }
    if (password !== passwordConfirmation) {
      res.locals.errors.push({
        msg: 'Your password and password confirmation must match.'
      });
    }

    if (first_name.length < 1) {
      res.locals.errors.push({ msg: 'You must supply a first name.' });
    }

    if (last_name.length < 1) {
      res.locals.errors.push({ msg: 'You must supply a last name.' });
    }

    res.locals.newUser.hashedPass = await hashedPass;

    next();
  },

  function (req, res, next) {
    const errors = res.locals.errors;
    const userId = v5(req.body.username, process.env.SECRETUUID);
    const user = res.locals.newUser;

    const createUserQuery = `
    INSERT INTO users
    (user_id, username, first_name, last_name)
    VALUES($1, $2, $3, $4)`;
    const createUserQueryValues = [
      userId,
      user.username,
      user.first_name,
      user.last_name
    ];

    const createUserPassQuery = `
    INSERT INTO user_passes
    (user_id, password_hash)
    VALUES($1, $2)`;
    const createUserPassQueryValues = [userId, user.hashedPass];

    if (errors.length > 0) {
      res.json({ message: 'Unable to create user due to errors.', errors });
    } else {
      pool.connect((err, client, done) => {
        if (err) next(err);
        else {
          Promise.all([
            client.query(createUserQuery, createUserQueryValues),
            client.query(createUserPassQuery, createUserPassQueryValues)
          ])
            .then((values) =>
              res.json({ message: 'Successfully created user. Please log in.' })
            )
            .catch((err) => next(err))
            .finally(done);
        }
      });
    }
  }
];

module.exports.commentDeleteDELETE = function (req, res, next) {
  const comment_id = req.params.commentId;

  const findCommentQuery = `
  SELECT * FROM comments INNER JOIN messages ON comments.message_id=messages.message_id WHERE ($1) = comment_id`;
  pool.query(findCommentQuery, [comment_id]).then(async (value) => {
    const comment = value.rows[0];
    if (!res.locals.currentUser) {
      res.json({
        message: 'You need to be logged in to delete a post'
      });
    } else if (!comment) {
      res.json({ message: 'Comment not found...' });
    } else if (comment.user_id !== res.locals.currentUser.user_id) {
      res.json({
        message:
          'You need to be the same user as the post creator to delete this comment.'
      });
    } else {
      const deletePostQuery = `
      DELETE FROM comments
      WHERE comment_id=($1)`;
      try {
        const response = await pool.query(deletePostQuery, [comment_id]);
        res.json({ message: 'Comment deleted successfully.' });
      } catch (err) {
        next(err);
      }
    }
  });
};
