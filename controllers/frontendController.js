const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const validator = require('express-validator');
const { v5 } = require('uuid');
const moment = require('moment');

module.exports.index = function (req, res, next) {
  res.json({ message: 'Unfinished frontend index' });
};

module.exports.viewPostsGET = function (req, res, next) {
  const getPostsQuery = `
  SELECT title,message_id,date,first_name,last_name FROM messages
  INNER JOIN users on messages.user_id=users.user_id
  WHERE public=true;`;
  const getPostsResponse = pool.query(getPostsQuery);
  getPostsResponse.then((response) => {
    res.status(200);
    res.json({
      message: 'Successfully retrieved!',
      messages: response.rows,
    });
  });
  getPostsResponse.catch((err) => {
    res.status(503);
    res.json({ message: err });
  });
};

module.exports.viewPostGET = function (req, res, next) {
  const getPostQuery = `
  SELECT messages.body,messages.title,messages.message_id,messages.date,first_name,last_name FROM messages
  INNER JOIN users on messages.user_id=users.user_id
  WHERE messages.message_id=($1) AND public=true;`;

  const getCommentsQuery = `
  SELECT * FROM comments
  WHERE message_id=($1)`;

  const getQueriesParams = [req.params.postId];

  pool.connect((err, client, done) => {
    if (err) next(err);
    else
      Promise.all([
        client.query(getPostQuery, getQueriesParams),
        client.query(getCommentsQuery, getQueriesParams),
      ])
        .then((values) => {
          const post = values[0].rows[0];
          const comments = values[1].rows;
          if (post) {
            res.status(200);
            res.json({ message: 'Successfully retrieved!', post, comments });
          } else {
            res.status(404);
            res.json({
              message: 'Unable to find post.',
              err: 'Post not found.',
            });
          }
        })
        .catch((err) => {
          res.status(503);
          console.log(err);
          res.json({ message: 'Server failure', err });
        })
        .finally(() => done());
  });
};

module.exports.createCommentPOST = [
  validator.body('*').escape(),

  async (req, res, next) => {
    console.log(req.body);
    res.locals.errors = [];

    try {
      req.body.date = moment(new Date()).toISOString();
      const comment_id = v5(
        req.params.postId + req.body.date + req.body.name + req.body.body,
        process.env.SECRETUUID
      );
      const tryToFindDuplicateCommentQuery = `
      SELECT * FROM comments
      WHERE comment_id=($1);`;
      const response = await pool.query(tryToFindDuplicateCommentQuery, [
        comment_id,
      ]);

      if (response.rowCount > 0) {
        res.locals.errors.push({
          msg: 'Duplicate post detected. You must change the name or comment body slightly.',
        });
      } else {
        req.body.comment_id = comment_id;
      }
    } catch (err) {
      next(err);
    }

    if (!req.body.name || req.body.name.length < 3) {
      res.locals.errors.push({
        msg: 'Your name needs to be at least 3 characters long.',
      });
    }

    if (!req.body.body || req.body.body.length < 3) {
      res.locals.errors.push({
        msg: 'The comment needs to be at least 3 characters long.',
      });
    }

    next();
  },

  (req, res, next) => {
    const comment = {
      comment_id: req.body.comment_id,
      message_id: req.params.postId,
      name: req.body.name,
      body: req.body.body,
      date: req.body.date,
    };

    if (res.locals.errors.length > 0) {
      res.json({
        errors: res.locals.errors,
        message: 'Unable to create comment.',
      });
    } else {
      const createCommentQuery = `
      INSERT INTO comments
      (comment_id, message_id, date, body, name)
      VALUES($1,$2,$3,$4,$5);`;
      const createCommentQueryValues = [
        comment.comment_id,
        comment.message_id,
        comment.date,
        comment.body,
        comment.name,
      ];

      pool
        .query(createCommentQuery, createCommentQueryValues)
        .then((value) => {
          console.log(value);
          res.json({
            message: 'Created comment successfully!',
            comment_id: comment.comment_id,
          });
        })
        .catch((err) => next(err));
    }
  },
];
