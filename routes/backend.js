const express = require('express');
const router = express.Router();
const backendController = require('../controllers/backendController');

router.get('/', backendController.index);
