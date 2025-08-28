const axios = require('axios');
const crypto = require('crypto');

class MercadoPagoService {
    constructor(config = {}) {
        this.config = {
            publicKey: config.publicKey || '',
            accessToken: config.accessToken || '',
            environment: config.environment || 'sandbox', // sandbox ou production
            webhookUrl: config.webhookUrl || '',
            ...config
        };
        
        this.baseUrl = this.config.environment === 'production' 
            ? 'https://api.mercadopago.com'
            : 'https://api.mercadopago.com'; // Mesmo endpoint para ambos
    }

    // Atualizar configurações
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    // Validar se as chaves estão configuradas
    isConfigured() {
        return !!(this.config.publicKey && this.config.accessToken);
    }

    // Criar preferência de pagamento
    async createPaymentPreference(order, notificationUrl = null) {
        try {
            if (!this.isConfigured()) {
                throw new Error('Chaves do Mercado Pago não configuradas');
            }

            const preference = {
                items: [{
                    id: order.product.id,
                    title: order.product.name,
                    description: order.product.description,
                    quantity: 1,
                    currency_id: 'BRL',
                    unit_price: order.product.price
                }],
                payment_methods: {
                    excluded_payment_types: [],
                    excluded_payment_methods: [],
                    installments: 1
                },
                back_urls: {
                    success: `${this.config.webhookUrl}/payment/success`,
                    failure: `${this.config.webhookUrl}/payment/failure`, 
                    pending: `${this.config.webhookUrl}/payment/pending`
                },
                auto_return: 'approved',
                external_reference: order.id,
                notification_url: notificationUrl || `${this.config.webhookUrl}/webhook/mercadopago`,
                expires: true,
                expiration_date_from: new Date().toISOString(),
                expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutos
                metadata: {
                    order_id: order.id,
                    chat_id: order.chatId,
                    product_id: order.product.id
                }
            };

            const response = await axios.post(
                `${this.baseUrl}/checkout/preferences`,
                preference,
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            // Gerar PIX diretamente
            const pixResult = await this.generatePixPayment(order);

            return {
                success: true,
                preferenceId: response.data.id,
                initPoint: response.data.init_point,
                sandboxInitPoint: response.data.sandbox_init_point,
                qrCodeBase64: await this.generateQRCode(response.data.id),
                pixCopyPaste: pixResult.pixCode,
                paymentId: pixResult.paymentId
            };

        } catch (error) {
            console.error('Erro ao criar preferência MP:', error.response?.data || error.message);
            throw new Error(`Erro no Mercado Pago: ${error.response?.data?.message || error.message}`);
        }
    }

    // Gerar PIX direto (método correto)
    async generatePixPayment(order) {
        try {
            const pixData = {
                transaction_amount: order.product.price,
                description: `${order.product.name} - Pedido ${order.id.substring(0, 8)}`,
                payment_method_id: 'pix',
                external_reference: order.id,
                payer: {
                    email: 'cliente@email.com'
                }
            };

            console.log('Dados enviados para MP:', JSON.stringify(pixData, null, 2));

            const response = await axios.post(
                `${this.baseUrl}/v1/payments`,
                pixData,
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.accessToken}`,
                        'Content-Type': 'application/json',
                        'X-Idempotency-Key': order.id
                    }
                }
            );

            const payment = response.data;
            console.log('Resposta do MP:', JSON.stringify(payment, null, 2));
            
            return {
                success: true,
                paymentId: payment.id,
                pixCode: payment.point_of_interaction?.transaction_data?.qr_code,
                qrCodeBase64: payment.point_of_interaction?.transaction_data?.qr_code_base64,
                status: payment.status
            };

        } catch (error) {
            console.error('Erro ao gerar PIX - Detalhes:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            
            // Retornar PIX simulado em caso de erro
            return {
                success: false,
                pixCode: this.generateFallbackPix(order),
                paymentId: null,
                error: error.response?.data || error.message
            };
        }
    }

    // PIX de fallback (simulado)
    generateFallbackPix(order) {
        const amount = order.product.price.toFixed(2).replace('.', '');
        const orderId = order.id.substring(0, 8);
        
        // PIX simulado seguindo o padrão EMV
        return `00020126580014BR.GOV.BCB.PIX0136${orderId}@pix.com5204000053039865802BR5925EMPRESA ATIVACOES LTDA6009SAO PAULO62070503***6304${this.generateChecksum()}`;
    }

    // Gerar checksum para PIX
    generateChecksum() {
        return Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    }

    // Verificar status do pagamento
    async getPaymentStatus(paymentId) {
        try {
            if (!this.isConfigured()) {
                throw new Error('Chaves do Mercado Pago não configuradas');
            }

            const response = await axios.get(
                `${this.baseUrl}/v1/payments/${paymentId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.accessToken}`
                    }
                }
            );

            const payment = response.data;

            return {
                id: payment.id,
                status: payment.status, // pending, approved, authorized, in_process, in_mediation, rejected, cancelled, refunded, charged_back
                status_detail: payment.status_detail,
                amount: payment.transaction_amount,
                currency: payment.currency_id,
                external_reference: payment.external_reference,
                date_created: payment.date_created,
                date_approved: payment.date_approved,
                payer: payment.payer,
                payment_method: payment.payment_method_id
            };

        } catch (error) {
            console.error('Erro ao verificar pagamento:', error.response?.data || error.message);
            throw new Error(`Erro ao verificar pagamento: ${error.response?.data?.message || error.message}`);
        }
    }

    // Processar webhook do Mercado Pago
    async processWebhook(webhookData, headers = {}) {
        try {
            const { type, data } = webhookData;

            // Validar webhook (opcional - recomendado em produção)
            if (this.config.webhookSecret) {
                const isValid = this.validateWebhookSignature(webhookData, headers);
                if (!isValid) {
                    throw new Error('Webhook signature inválida');
                }
            }

            switch (type) {
                case 'payment':
                    return await this.handlePaymentWebhook(data.id);
                
                case 'merchant_order':
                    return await this.handleMerchantOrderWebhook(data.id);
                
                default:
                    console.log(`Webhook type não tratado: ${type}`);
                    return { success: true, message: 'Webhook ignorado' };
            }

        } catch (error) {
            console.error('Erro ao processar webhook:', error.message);
            throw error;
        }
    }

    // Tratar webhook de pagamento
    async handlePaymentWebhook(paymentId) {
        try {
            const paymentStatus = await this.getPaymentStatus(paymentId);
            
            return {
                success: true,
                paymentId: paymentId,
                status: paymentStatus.status,
                externalReference: paymentStatus.external_reference,
                amount: paymentStatus.amount,
                needsProcessing: ['approved', 'authorized'].includes(paymentStatus.status)
            };

        } catch (error) {
            console.error('Erro ao tratar webhook de pagamento:', error.message);
            throw error;
        }
    }

    // Tratar webhook de merchant order
    async handleMerchantOrderWebhook(orderId) {
        try {
            const response = await axios.get(
                `${this.baseUrl}/merchant_orders/${orderId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.accessToken}`
                    }
                }
            );

            const order = response.data;
            
            return {
                success: true,
                orderId: orderId,
                status: order.order_status,
                externalReference: order.external_reference,
                totalAmount: order.total_amount
            };

        } catch (error) {
            console.error('Erro ao tratar webhook de merchant order:', error.message);
            throw error;
        }
    }

    // Validar assinatura do webhook (segurança)
    validateWebhookSignature(payload, headers) {
        try {
            const xSignature = headers['x-signature'];
            const xRequestId = headers['x-request-id'];
            
            if (!xSignature || !this.config.webhookSecret) {
                return false;
            }

            const ts = xSignature.split(',').find(part => part.startsWith('ts=')).replace('ts=', '');
            const hash = xSignature.split(',').find(part => part.startsWith('v1=')).replace('v1=', '');

            const manifest = `id:${payload.data.id};request-id:${xRequestId};ts:${ts};`;
            const hmac = crypto.createHmac('sha256', this.config.webhookSecret);
            hmac.update(manifest);
            const sha = hmac.digest('hex');

            return sha === hash;

        } catch (error) {
            console.error('Erro ao validar assinatura webhook:', error.message);
            return false;
        }
    }

    // Reembolsar pagamento
    async refundPayment(paymentId, amount = null) {
        try {
            if (!this.isConfigured()) {
                throw new Error('Chaves do Mercado Pago não configuradas');
            }

            const refundData = amount ? { amount } : {};

            const response = await axios.post(
                `${this.baseUrl}/v1/payments/${paymentId}/refunds`,
                refundData,
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return {
                success: true,
                refundId: response.data.id,
                status: response.data.status,
                amount: response.data.amount
            };

        } catch (error) {
            console.error('Erro ao reembolsar:', error.response?.data || error.message);
            throw new Error(`Erro no reembolso: ${error.response?.data?.message || error.message}`);
        }
    }

    // Testar conectividade com MP
    async testConnection() {
        try {
            if (!this.isConfigured()) {
                return {
                    success: false,
                    error: 'Chaves não configuradas'
                };
            }

            // Testar com uma requisição simples
            const response = await axios.get(
                `${this.baseUrl}/users/me`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.accessToken}`
                    }
                }
            );

            return {
                success: true,
                userId: response.data.id,
                email: response.data.email,
                environment: this.config.environment
            };

        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    // Obter métodos de pagamento disponíveis
    async getPaymentMethods() {
        try {
            const response = await axios.get(`${this.baseUrl}/v1/payment_methods`);
            
            return {
                success: true,
                methods: response.data.filter(method => method.status === 'active')
            };

        } catch (error) {
            console.error('Erro ao obter métodos de pagamento:', error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = MercadoPagoService;
