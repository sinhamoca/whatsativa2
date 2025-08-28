// debug-mp.js - Script para diagnosticar Mercado Pago
const DatabaseService = require('./database-service');
const MercadoPagoService = require('./mercadopago-service');

async function debugMercadoPago() {
    console.log('🔍 DIAGNÓSTICO MERCADO PAGO\n');
    
    const db = new DatabaseService('./database.sqlite');
    
    try {
        await db.initialize();
        
        // 1. Verificar configurações
        console.log('📋 CONFIGURAÇÕES:');
        const settings = await db.getSettings();
        
        const publicKey = settings.mercadoPagoPublicKey || '';
        const accessToken = settings.mercadoPagoAccessToken || '';
        const environment = settings.mercadoPagoEnvironment || 'sandbox';
        
        console.log(`Environment: ${environment}`);
        console.log(`Public Key: ${publicKey ? publicKey.substring(0, 20) + '...' : 'NÃO CONFIGURADA'}`);
        console.log(`Access Token: ${accessToken ? accessToken.substring(0, 20) + '...' : 'NÃO CONFIGURADO'}`);
        
        if (!publicKey || !accessToken) {
            console.log('\n❌ ERRO: Chaves não configuradas!');
            console.log('Configure no admin: http://localhost:3001/admin');
            return;
        }
        
        // 2. Verificar formato das chaves
        console.log('\n🔑 VALIDAÇÃO DAS CHAVES:');
        
        const publicKeyValid = publicKey.startsWith('TEST-') || publicKey.startsWith('APP_USR-');
        const accessTokenValid = accessToken.startsWith('TEST-') || accessToken.startsWith('APP_USR-');
        
        console.log(`Public Key formato: ${publicKeyValid ? '✅ Válido' : '❌ Inválido'}`);
        console.log(`Access Token formato: ${accessTokenValid ? '✅ Válido' : '❌ Inválido'}`);
        
        // 3. Verificar ambiente
        const isSandbox = publicKey.startsWith('TEST-') && accessToken.startsWith('TEST-');
        const isProduction = publicKey.startsWith('APP_USR-') && accessToken.startsWith('APP_USR-');
        
        console.log(`Ambiente detectado: ${isSandbox ? 'SANDBOX' : isProduction ? 'PRODUÇÃO' : 'MISTO (ERRO)'}`);
        
        if (!isSandbox && !isProduction) {
            console.log('❌ ERRO: Chaves de ambientes diferentes!');
            console.log('Use AMBAS de SANDBOX (TEST-) ou AMBAS de PRODUÇÃO (APP_USR-)');
            return;
        }
        
        // 4. Testar conexão
        console.log('\n🌐 TESTE DE CONEXÃO:');
        const mp = new MercadoPagoService({
            publicKey,
            accessToken,
            environment: environment,
            webhookUrl: 'http://localhost:3001'
        });
        
        const connectionTest = await mp.testConnection();
        
        if (connectionTest.success) {
            console.log('✅ Conexão OK');
            console.log(`Usuário: ${connectionTest.email}`);
            console.log(`User ID: ${connectionTest.userId}`);
        } else {
            console.log('❌ Falha na conexão');
            console.log(`Erro: ${connectionTest.error}`);
            return;
        }
        
        // 5. Testar geração de PIX
        console.log('\n💰 TESTE DE PIX:');
        
        const testOrder = {
            id: 'test-' + Date.now(),
            product: {
                id: 'test_product',
                name: 'Produto Teste',
                description: 'Teste de geração PIX',
                price: 1.00
            },
            chatId: 'test@test.com'
        };
        
        console.log('Gerando PIX de teste...');
        const pixResult = await mp.generatePixPayment(testOrder);
        
        if (pixResult.success) {
            console.log('✅ PIX gerado com sucesso');
            console.log(`PaymentID: ${pixResult.paymentId}`);
            console.log(`PIX Code: ${pixResult.pixCode ? 'Gerado' : 'Não gerado'}`);
            console.log(`Status: ${pixResult.status}`);
            
            // 6. Testar verificação do pagamento criado
            console.log('\n🔍 TESTE DE VERIFICAÇÃO:');
            
            if (pixResult.paymentId) {
                try {
                    const paymentStatus = await mp.getPaymentStatus(pixResult.paymentId);
                    console.log('✅ Verificação OK');
                    console.log(`Status: ${paymentStatus.status}`);
                    console.log(`ID: ${paymentStatus.id}`);
                } catch (verifyError) {
                    console.log('❌ Erro na verificação');
                    console.log(`Erro: ${verifyError.message}`);
                }
            }
            
        } else {
            console.log('❌ Erro ao gerar PIX');
            console.log(`Erro: ${pixResult.error}`);
        }
        
        // 7. Verificar últimos pedidos
        console.log('\n📋 ÚLTIMOS PEDIDOS:');
        const orders = await db.getOrders(3);
        
        orders.forEach(order => {
            console.log(`\nPedido: ${order.id.substring(0, 8)}`);
            console.log(`PaymentID: ${order.paymentId || 'Não gerado'}`);
            console.log(`Status: ${order.status}`);
            console.log(`Produto: ${order.product.name}`);
            console.log(`Valor: R$ ${order.product.price}`);
        });
        
    } catch (error) {
        console.error('\n❌ ERRO NO DIAGNÓSTICO:', error.message);
        console.error(error.stack);
    } finally {
        await db.close();
    }
}

// Executar diagnóstico
if (require.main === module) {
    debugMercadoPago().then(() => {
        console.log('\n🎯 PRÓXIMOS PASSOS:');
        console.log('1. Se chaves inválidas → Configure no admin');
        console.log('2. Se conexão falha → Verifique chaves no painel MP');
        console.log('3. Se PIX falha → Use ambiente SANDBOX primeiro');
        console.log('4. Se tudo OK → Teste pagamento real');
        
        process.exit(0);
    });
}
