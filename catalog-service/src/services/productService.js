const productRepository = require('../repositories/productRepository');

// Business Logic Layer
// Handles business rules, price calculations, formatting data before saving or sending.
class ProductService {

    // Helper to calculate pricing
    calculatePricing(product) {
        if (!product) return null;
        const basePrice = parseFloat(product.base_price);
        const gstPercentage = parseFloat(product.gst_percentage);

        const gstAmount = basePrice * (gstPercentage / 100);
        const totalPrice = basePrice + gstAmount;

        return {
            ...product,
            base_price: basePrice,
            gst_percentage: gstPercentage,
            gst_amount: Number(gstAmount.toFixed(2)),
            total_price: Number(totalPrice.toFixed(2))
        };
    }

    async getAllProducts() {
        const products = await productRepository.findAll();
        // Inject computed business logic fields
        return products.map(this.calculatePricing);
    }

    async getProductById(id) {
        if (!id || isNaN(id)) {
            throw new Error("Valid Product ID is required");
        }
        const product = await productRepository.findById(id);
        if (!product) return null;
        return this.calculatePricing(product);
    }

    async getProductsByCategory(category) {
        if (!category) throw new Error("Category is required");
        const products = await productRepository.findByCategory(category);
        return products.map(this.calculatePricing);
    }

    async createProduct(productData) {
        // Business Validation
        if (!productData.name || !productData.base_price) {
            throw new Error("Product name and base price are required");
        }

        const newProduct = await productRepository.create({
            name: productData.name,
            brand: productData.brand || 'Unknown',
            category: productData.category || 'Unisex',
            base_price: productData.base_price,
            gst_percentage: productData.gst_percentage || 18, // Default GST to 18% as per Indian norms for perfumes
            image_url: productData.image_url || '',
            description: productData.description || '',
            seller_id: productData.seller_id || null
        });

        return this.calculatePricing(newProduct);
    }

    async updateProduct(id, productData) {
        const existing = await productRepository.findById(id);
        if (!existing) throw new Error("Product not found");

        const updatedData = {
            name: productData.name || existing.name,
            brand: productData.brand || existing.brand,
            category: productData.category || existing.category,
            base_price: productData.base_price || existing.base_price,
            gst_percentage: productData.gst_percentage || existing.gst_percentage,
            image_url: productData.image_url || existing.image_url,
            description: productData.description || existing.description
        };

        const updated = await productRepository.update(id, updatedData);
        return this.calculatePricing(updated);
    }

    async deleteProduct(id) {
        return await productRepository.delete(id);
    }
}

module.exports = new ProductService();
