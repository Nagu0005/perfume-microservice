const checkoutRepository = require('../repositories/checkoutRepository');

class CheckoutService {
    async getAllCheckouts() {
        return await checkoutRepository.findAll();
    }

    async getCheckoutById(id) {
        if (!id) throw new Error("Checkout ID required");
        return await checkoutRepository.findById(id);
    }

    async processCheckout(checkoutData) {
        // Business Validation
        if (!checkoutData.user_id || !checkoutData.items || !checkoutData.shipping_address || !checkoutData.user_email) {
            throw new Error("Missing required checkout information (including user_email)");
        }

        // Calculate total amount based on items (business logic mock)
        let calculatedTotal = checkoutData.items.reduce((acc, item) => {
            return acc + (item.price * item.quantity);
        }, 0);

        // Add dummy shipping cost logically
        const shippingCost = calculatedTotal > 5000 ? 0 : 500;
        calculatedTotal += shippingCost;

        const newCheckout = {
            user_id: checkoutData.user_id,
            items: checkoutData.items,
            total_amount: calculatedTotal,
            shipping_address: checkoutData.shipping_address,
            payment_method: checkoutData.payment_method || 'Online Payment'
        };

        const result = await checkoutRepository.create(newCheckout);

        // Async Email Trigger
        this.triggerOrderEmail(checkoutData.user_email, checkoutData.user_name || 'Customer', result.id, calculatedTotal);

        return result;
    }

    async completeCheckout(id) {
        return await checkoutRepository.updateStatus(id, 'COMPLETED');
    }

    // Trigger HTTP Request to Email Service directly
    async triggerOrderEmail(email, name, orderId, total) {
        try {
            const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || 'http://email-service:7005/api/v1/emails';

            const payload = {
                recipient: email,
                subject: `Order Confirmation #${orderId}`,
                body: `Hello ${name},\n\nThank you for your purchase from Aurora Perfumes!\n\nYour order #${orderId} for a total of ₹${parseFloat(total).toLocaleString()} has been successfully processed and is being prepared for shipment.\n\nBest Regards,\nThe Aurora Team`,
                type: 'ORDER_CONFIRMATION'
            };

            fetch(EMAIL_SERVICE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(err => console.error('Failed to notify EmailService asynchronously:', err.message));

        } catch (error) {
            console.error('Failed to setup Order Confirm email trigger:', error.message);
        }
    }
}

module.exports = new CheckoutService();
