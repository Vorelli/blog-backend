const express = require('express');
const router = express.Router();
const backendController = require('../controllers/backendController');

router.get('/', backendController.index);

router.post('/login', backendController.loginPOST);

router.get('/check', backendController.checkGET);

router.post('/sign-up', backendController.signUpPOST);

router.get('/posts', backendController.postViewAllGET);

router.post('/posts', backendController.postCreatePOST);

router.get('/posts/:postId', backendController.postViewOneGET);

router.put('/posts/:postId', backendController.postUpdatePUT);

router.delete('/posts/:postId', backendController.postDeleteDELETE);

router.delete('/comments/:commentId', backendController.commentDeleteDELETE);

module.exports = router;
