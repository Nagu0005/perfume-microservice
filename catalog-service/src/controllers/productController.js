const productService = require('../services/productService');

// API Layer - Controller
// Handles HTTP Requests, Responses and catches Errors
class ProductController {

    async getProducts(req, res) {
        try {
            const { category } = req.query;
            let products;

            if (category) {
                products = await productService.getProductsByCategory(category);
            } else {
                products = await productService.getAllProducts();
            }

            res.status(200).json({ success: true, count: products.length, data: products });
        } catch (error) {
            console.error('Error in getProducts:', error.message);
            res.status(500).json({ success: false, error: 'Server Error', details: error.message });
        }
    }

    async getProduct(req, res) {
        try {
            const product = await productService.getProductById(req.params.id);
            if (!product) {
                return res.status(404).json({ success: false, error: 'Product not found' });
            }
            res.status(200).json({ success: true, data: product });
        } catch (error) {
            console.error('Error in getProduct:', error.message);
            res.status(400).json({ success: false, error: error.message });
        }
    }

    async createProduct(req, res) {
        try {
            const seller_id = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id']) : null;
            const newProduct = await productService.createProduct({ ...req.body, seller_id });
            res.status(201).json({ success: true, data: newProduct });
        } catch (error) {
            console.error('Error in createProduct:', error.message);
            res.status(400).json({ success: false, error: error.message });
        }
    }

    async updateProduct(req, res) {
        try {
            const product = await productService.updateProduct(req.params.id, req.body);
            res.status(200).json({ success: true, data: product });
        } catch (error) {
            console.error('Error in updateProduct:', error.message);
            res.status(400).json({ success: false, error: error.message });
        }
    }

    async deleteProduct(req, res) {
        try {
            const deleted = await productService.deleteProduct(req.params.id);
            if (!deleted) {
                return res.status(404).json({ success: false, error: 'Product not found' });
            }
            res.status(200).json({ success: true, data: {} });
        } catch (error) {
            console.error('Error in deleteProduct:', error.message);
            res.status(500).json({ success: false, error: 'Server Error' });
        }
    }
}

module.exports = new ProductController();
