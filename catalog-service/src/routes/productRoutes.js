const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// API Layer - Routing
// Defines the API surface for the microservice

router.route('/')
    .get(productController.getProducts)
    .post(productController.createProduct);

router.route('/:id')
    .get(productController.getProduct)
    .put(productController.updateProduct)
    .delete(productController.deleteProduct);

router.post('/reduce-stock', productController.reduceStock);

module.exports = router;
