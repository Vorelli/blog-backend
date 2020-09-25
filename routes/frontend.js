const express = require('express');
const router = express.Router();
const frontendController = require('../controllers/frontendController');

router.get('/', frontendController.index);

router.get('/posts', frontendController.viewPostsGET);

router.get('/posts/:postId', frontendController.viewPostGET);

router.post('/posts/:postId', frontendController.createCommentPOST);

module.exports = router;
