// add-all-ibosol-products.js - Adiciona todos os produtos IboSol
const DatabaseService = require('./database-service');

const products = [
  {
    "id": "iboplayer",
    "name": "IBO Player",
    "description": "Ativação do IBO Player - Aplicativo de streaming premium",
    "price": 10,
    "currency": "BRL",
    "activationModule": "iboplayer",
    "paymentConfirmedMessage": "🎉 *IBO PLAYER - PAGAMENTO CONFIRMADO!*\n\n🎯 *Produto:* {product_name}\n💰 *Valor pago:* R$ {price}\n\n━━━━━━━━━━━━━━━━━━━\n📝 *AGORA PRECISO DAS INFORMAÇÕES:*\n\nPara ativar seu IBO Player, envie o **MAC Address** do seu dispositivo.\n\n📍 *Como encontrar o MAC:*\n• Android TV: Configurações > Sobre > Status\n• Fire TV: Configurações > Minha Fire TV > Sobre  \n• Smart TV: Configurações > Rede > Status da Rede\n\n📤 *Exemplo:* AA:BB:CC:DD:EE:FF\n\n⚡ Envie apenas o MAC que ativo imediatamente!",
    "active": true
  },
  {
    "id": "abeplayertv",
    "name": "ABE Player TV",
    "description": "Ativação do ABE Player TV - Aplicativo de streaming premium",
    "price": 10,
    "currency": "BRL",
    "activationModule": "abeplayertv",
    "paymentConfirmedMessage": "🎉 *ABE PLAYER TV - PAGAMENTO CONFIRMADO!*\n\n🎯 *Produto:* {product_name}\n💰 *Valor pago:* R$ {price}\n\n━━━━━━━━━━━━━━━━━━━\n📝 *AGORA PRECISO DAS INFORMAÇÕES:*\n\nPara ativar seu ABE Player TV, envie o **MAC Address** do seu dispositivo.\n\n📍 *Como encontrar o MAC:*\n• Android TV: Configurações > Sobre > Status\n• Fire TV: Configurações > Minha Fire TV > Sobre  \n• Smart TV: Configurações > Rede > Status da Rede\n\n📤 *Exemplo:* AA:BB:CC:DD:EE:FF\n\n⚡ Envie apenas o MAC que ativo imediatamente!",
    "active": true
  },
  {
    "id": "bobplayer",
    "name": "BOB Player",
    "description": "Ativação do BOB Player - Aplicativo de streaming premium",
    "price": 10,
    "currency": "BRL",
    "activationModule": "bobplayer",
    "paymentConfirmedMessage": "🎉 *BOB PLAYER - PAGAMENTO CONFIRMADO!*\n\n🎯 *Produto:* {product_name}\n💰 *Valor pago:* R$ {price}\n\n━━━━━━━━━━━━━━━━━━━\n📝 *AGORA PRECISO DAS INFORMAÇÕES:*\n\nPara ativar seu BOB Player, envie o **MAC Address** do seu dispositivo.\n\n📍 *Como encontrar o MAC:*\n• Android TV: Configurações > Sobre > Status\n• Fire TV: Configurações > Minha Fire TV > Sobre  \n• Smart TV: Configurações > Rede > Status da Rede\n\n📤 *Exemplo:* AA:BB:CC:DD:EE:FF\n\n⚡ Envie apenas o MAC que ativo imediatamente!",
    "active": true
  },
  {
    "id": "macplayer",
    "name": "MAC Player",
    "description": "Ativação do MAC Player - Aplicativo de streaming premium",
    "price": 10,
    "currency": "BRL",
    "activationModule": "macplayer",
    "paymentConfirmedMessage": "🎉 *MAC PLAYER - PAGAMENTO CONFIRMADO!*\n\n🎯 *Produto:* {product_name}\n💰 *Valor pago:* R$ {price}\n\n━━━━━━━━━━━━━━━━━━━\n📝 *AGORA PRECISO DAS INFORMAÇÕES:*\n\nPara ativar seu MAC Player, envie o **MAC Address** do seu dispositivo.\n\n📍 *Como encontrar o MAC:*\n• Android TV: Configurações > Sobre > Status\n• Fire TV: Configurações > Minha Fire TV > Sobre  \n• Smart TV: Configurações > Rede > Status da Rede\n\n📤 *Exemplo:* AA:BB:CC:DD:EE:FF\n\n⚡ Envie apenas o MAC que ativo imediatamente!",
    "active": true
  },
  {
    "id": "virginia",
    "name": "Virginia Player",
    "description": "Ativação do Virginia Player - Aplicativo de streaming premium",
    "price": 10,
    "currency": "BRL",
    "activationModule": "virginia",
    "paymentConfirmedMessage": "🎉 *VIRGINIA PLAYER - PAGAMENTO CONFIRMADO!*\n\n🎯 *Produto:* {product_name}\n💰 *Valor pago:* R$ {price}\n\n━━━━━━━━━━━━━━━━━━━\n📝 *AGORA PRECISO DAS INFORMAÇÕES:*\n\nPara ativar seu Virginia Player, envie o **MAC Address** do seu dispositivo.\n\n📍 *Como encontrar o MAC:*\n• Android TV: Configurações > Sobre > Status\n• Fire TV: Configurações > Minha Fire TV > Sobre  \n• Smart TV: Configurações > Rede > Status da Rede\n\n📤 *Exemplo:* AA:BB:CC:DD:EE:FF\n\n⚡ Envie apenas o MAC que ativo imediatamente!",
    "active": true
  },
  {
    "id": "allplayer",
    "name": "All Player",
    "description": "Ativação do All Player - Aplicativo de streaming premium",
    "price": 10,
    "currency": "BRL",
    "activationModule": "allplayer",
    "paymentConfirmedMessage": "🎉 *ALL PLAYER - PAGAMENTO CONFIRMADO!*\n\n🎯 *Produto:* {product_name}\n💰 *Valor pago:* R$ {price}\n\n━━━━━━━━━━━━━━━━━━━\n📝 *AGORA PRECISO DAS INFORMAÇÕES:*\n\nPara ativar seu All Player, envie o **MAC Address** do seu dispositivo.\n\n📍 *Como encontrar o MAC:*\n• Android TV: Configurações > Sobre > Status\n• Fire TV: Configurações > Minha Fire TV > Sobre  \n• Smart TV: Configurações > Rede > Status da Rede\n\n📤 *Exemplo:* AA:BB:CC:DD:EE:FF\n\n⚡ Envie apenas o MAC que ativo imediatamente!",
    "active": true
  },
  {
    "id": "hushplay",
    "name": "Hush Play",
    "description": "Ativação do Hush Play - Aplicativo de streaming premium",
    "price": 10,
    "currency": "BRL",
    "activationModule": "hushplay",
    "paymentConfirmedMessage": "🎉 *HUSH PLAY - PAGAMENTO CONFIRMADO!*\n\n🎯 *Produto:* {product_name}\n💰 *Valor pago:* R$ {price}\n\n━━━━━━━━━━━━━━━━━━━\n📝 *AGORA PRECISO DAS INFORMAÇÕES:*\n\nPara ativar seu Hush Play, envie o **MAC Address** do seu dispositivo.\n\n📍 *Como encontrar o MAC:*\n• Android TV: Configurações > Sobre > Status\n• Fire TV: Configurações > Minha Fire TV > Sobre  \n• Smart TV: Configurações > Rede > Status da Rede\n\n📤 *Exemplo:* AA:BB:CC:DD:EE:FF\n\n⚡ Envie apenas o MAC que ativo imediatamente!",
    "active": true
  },
  {
    "id": "ktnplayer",
    "name": "KTN Player",
    "description": "Ativação do KTN Player - Aplicativo de streaming premium",
    "price": 10,
    "currency": "BRL",
    "activationModule": "ktnplayer",
    "paymentConfirmedMessage": "🎉 *KTN PLAYER - PAGAMENTO CONFIRMADO!*\n\n🎯 *Produto:* {product_name}\n💰 *Valor pago:* R$ {price}\n\n━━━━━━━━━━━━━━━━━━━\n📝 *AGORA PRECISO DAS INFORMAÇÕES:*\n\nPara ativar seu KTN Player, envie o **MAC Address** do seu dispositivo.\n\n📍 *Como encontrar o MAC:*\n• Android TV: Configurações > Sobre > Status\n• Fire TV: Configurações > Minha Fire TV > Sobre  \n• Smart TV: Configurações > Rede > Status da Rede\n\n📤 *Exemplo:* AA:BB:CC:DD:EE:FF\n\n⚡ Envie apenas o MAC que ativo imediatamente!",
    "active": true
  },
  {
    "id": "familyplayer",
    "name": "Family Player",
    "description": "Ativação do Family Player - Aplicativo de streaming premium",
    "price": 10,
    "currency": "BRL",
    "activationModule": "familyplayer",
    "paymentConfirmedMessage": "🎉 *FAMILY PLAYER - PAGAMENTO CONFIRMADO!*\n\n🎯 *Produto:* {product_name}\n💰 *Valor pago:* R$ {price}\n\n━━━━━━━━━━━━━━━━━━━\n📝 *AGORA PRECISO DAS INFORMAÇÕES:*\n\nPara ativar seu Family Player, envie o **MAC Address** do seu dispositivo.\n\n📍 *Como encontrar o MAC:*\n• Android TV: Configurações > Sobre > Status\n• Fire TV: Configurações > Minha Fire TV > Sobre  \n• Smart TV: Configurações > Rede > Status da Rede\n\n📤 *Exemplo:* AA:BB:CC:DD:EE:FF\n\n⚡ Envie apenas o MAC que ativo imediatamente!",
    "active": true
  },
  {
    "id": "ibossplayer",
    "name": "IBoss Player",
    "description": "Ativação do IBoss Player - Aplicativo de streaming premium",
    "price": 10,
    "currency": "BRL",
    "activationModule": "ibossplayer",
    "paymentConfirmedMessage": "🎉 *IBOSS PLAYER - PAGAMENTO CONFIRMADO!*\n\n🎯 *Produto:* {product_name}\n💰 *Valor pago:* R$ {price}\n\n━━━━━━━━━━━━━━━━━━━\n📝 *AGORA PRECISO DAS INFORMAÇÕES:*\n\nPara ativar seu IBoss Player, envie o **MAC Address** do seu dispositivo.\n\n📍 *Como encontrar o MAC:*\n• Android TV: Configurações > Sobre > Status\n• Fire TV: Configurações > Minha Fire TV > Sobre  \n• Smart TV: Configurações > Rede > Status da Rede\n\n📤 *Exemplo:* AA:BB:CC:DD:EE:FF\n\n⚡ Envie apenas o MAC que ativo imediatamente!",
    "active": true
  },
  {
    "id": "king4kplayer",
    "name": "King 4K Player",
    "description": "Ativação do King 4K Player - Aplicativo de streaming premium",
    "price": 10,
    "currency": "BRL",
    "activationModule": "king4kplayer",
    "paymentConfirmedMessage": "🎉 *KING 4K PLAYER - PAGAMENTO CONFIRMADO!*\n\n🎯 *Produto:* {product_name}\n💰 *Valor pago:* R$ {price}\n\n━━━━━━━━━━━━━━━━━━━\n📝 *AGORA PRECISO DAS INFORMAÇÕES:*\n\nPara ativar seu King 4K Player, envie o **MAC Address** do seu dispositivo.\n\n📍 *Como encontrar o MAC:*\n• Android TV: Configurações > Sobre > Status\n• Fire TV: Configurações > Minha Fire TV > Sobre  \n• Smart TV: Configurações > Rede > Status da Rede\n\n📤 *Exemplo:* AA:BB:CC:DD:EE:FF\n\n⚡ Envie apenas o MAC que ativo imediatamente!",
    "active": true
  },
  {
    "id": "ibostb",
    "name": "IBO STB",
    "description": "Ativação do IBO STB - Aplicativo de streaming premium",
    "price": 10,
    "currency": "BRL",
    "activationModule": "ibostb",
    "paymentConfirmedMessage": "🎉 *IBO STB - PAGAMENTO CONFIRMADO!*\n\n🎯 *Produto:* {product_name}\n💰 *Valor pago:* R$ {price}\n\n━━━━━━━━━━━━━━━━━━━\n📝 *AGORA PRECISO DAS INFORMAÇÕES:*\n\nPara ativar seu IBO STB, envie o **MAC Address** do seu dispositivo.\n\n📍 *Como encontrar o MAC:*\n• Android TV: Configurações > Sobre > Status\n• Fire TV: Configurações > Minha Fire TV > Sobre  \n• Smart TV: Configurações > Rede > Status da Rede\n\n📤 *Exemplo:* AA:BB:CC:DD:EE:FF\n\n⚡ Envie apenas o MAC que ativo imediatamente!",
    "active": true
  },
  {
    "id": "iboxxplayer",
    "name": "IboXX Player",
    "description": "Ativação do IboXX Player - Aplicativo de streaming premium",
    "price": 10,
    "currency": "BRL",
    "activationModule": "iboxxplayer",
    "paymentConfirmedMessage": "🎉 *IBOXX PLAYER - PAGAMENTO CONFIRMADO!*\n\n🎯 *Produto:* {product_name}\n💰 *Valor pago:* R$ {price}\n\n━━━━━━━━━━━━━━━━━━━\n📝 *AGORA PRECISO DAS INFORMAÇÕES:*\n\nPara ativar seu IboXX Player, envie o **MAC Address** do seu dispositivo.\n\n📍 *Como encontrar o MAC:*\n• Android TV: Configurações > Sobre > Status\n• Fire TV: Configurações > Minha Fire TV > Sobre  \n• Smart TV: Configurações > Rede > Status da Rede\n\n📤 *Exemplo:* AA:BB:CC:DD:EE:FF\n\n⚡ Envie apenas o MAC que ativo imediatamente!",
    "active": true
  },
  {
    "id": "duplex24",
    "name": "Duplex 24",
    "description": "Ativação do Duplex 24 - Aplicativo de streaming premium",
    "price": 10,
    "currency": "BRL",
    "activationModule": "duplex24",
    "paymentConfirmedMessage": "🎉 *DUPLEX 24 - PAGAMENTO CONFIRMADO!*\n\n🎯 *Produto:* {product_name}\n💰 *Valor pago:* R$ {price}\n\n━━━━━━━━━━━━━━━━━━━\n📝 *AGORA PRECISO DAS INFORMAÇÕES:*\n\nPara ativar seu Duplex 24, envie o **MAC Address** do seu dispositivo.\n\n📍 *Como encontrar o MAC:*\n• Android TV: Configurações > Sobre > Status\n• Fire TV: Configurações > Minha Fire TV > Sobre  \n• Smart TV: Configurações > Rede > Status da Rede\n\n📤 *Exemplo:* AA:BB:CC:DD:EE:FF\n\n⚡ Envie apenas o MAC que ativo imediatamente!",
    "active": true
  },
  {
    "id": "bobpro",
    "name": "BOB Pro",
    "description": "Ativação do BOB Pro - Aplicativo de streaming premium",
    "price": 10,
    "currency": "BRL",
    "activationModule": "bobpro",
    "paymentConfirmedMessage": "🎉 *BOB PRO - PAGAMENTO CONFIRMADO!*\n\n🎯 *Produto:* {product_name}\n💰 *Valor pago:* R$ {price}\n\n━━━━━━━━━━━━━━━━━━━\n📝 *AGORA PRECISO DAS INFORMAÇÕES:*\n\nPara ativar seu BOB Pro, envie o **MAC Address** do seu dispositivo.\n\n📍 *Como encontrar o MAC:*\n• Android TV: Configurações > Sobre > Status\n• Fire TV: Configurações > Minha Fire TV > Sobre  \n• Smart TV: Configurações > Rede > Status da Rede\n\n📤 *Exemplo:* AA:BB:CC:DD:EE:FF\n\n⚡ Envie apenas o MAC que ativo imediatamente!",
    "active": true
  },
  {
    "id": "bobpremium",
    "name": "BOB Premium",
    "description": "Ativação do BOB Premium - Aplicativo de streaming premium",
    "price": 10,
    "currency": "BRL",
    "activationModule": "bobpremium",
    "paymentConfirmedMessage": "🎉 *BOB PREMIUM - PAGAMENTO CONFIRMADO!*\n\n🎯 *Produto:* {product_name}\n💰 *Valor pago:* R$ {price}\n\n━━━━━━━━━━━━━━━━━━━\n📝 *AGORA PRECISO DAS INFORMAÇÕES:*\n\nPara ativar seu BOB Premium, envie o **MAC Address** do seu dispositivo.\n\n📍 *Como encontrar o MAC:*\n• Android TV: Configurações > Sobre > Status\n• Fire TV: Configurações > Minha Fire TV > Sobre  \n• Smart TV: Configurações > Rede > Status da Rede\n\n📤 *Exemplo:* AA:BB:CC:DD:EE:FF\n\n⚡ Envie apenas o MAC que ativo imediatamente!",
    "active": true
  },
  {
    "id": "ibosolplayer",
    "name": "IBOSol Player",
    "description": "Ativação do IBOSol Player - Aplicativo de streaming premium",
    "price": 10,
    "currency": "BRL",
    "activationModule": "ibosolplayer",
    "paymentConfirmedMessage": "🎉 *IBOSOL PLAYER - PAGAMENTO CONFIRMADO!*\n\n🎯 *Produto:* {product_name}\n💰 *Valor pago:* R$ {price}\n\n━━━━━━━━━━━━━━━━━━━\n📝 *AGORA PRECISO DAS INFORMAÇÕES:*\n\nPara ativar seu IBOSol Player, envie o **MAC Address** do seu dispositivo.\n\n📍 *Como encontrar o MAC:*\n• Android TV: Configurações > Sobre > Status\n• Fire TV: Configurações > Minha Fire TV > Sobre  \n• Smart TV: Configurações > Rede > Status da Rede\n\n📤 *Exemplo:* AA:BB:CC:DD:EE:FF\n\n⚡ Envie apenas o MAC que ativo imediatamente!",
    "active": true
  },
  {
    "id": "flixnet",
    "name": "FlixNet",
    "description": "Ativação do FlixNet - Aplicativo de streaming premium",
    "price": 10,
    "currency": "BRL",
    "activationModule": "flixnet",
    "paymentConfirmedMessage": "🎉 *FLIXNET - PAGAMENTO CONFIRMADO!*\n\n🎯 *Produto:* {product_name}\n💰 *Valor pago:* R$ {price}\n\n━━━━━━━━━━━━━━━━━━━\n📝 *AGORA PRECISO DAS INFORMAÇÕES:*\n\nPara ativar seu FlixNet, envie o **MAC Address** do seu dispositivo.\n\n📍 *Como encontrar o MAC:*\n• Android TV: Configurações > Sobre > Status\n• Fire TV: Configurações > Minha Fire TV > Sobre  \n• Smart TV: Configurações > Rede > Status da Rede\n\n📤 *Exemplo:* AA:BB:CC:DD:EE:FF\n\n⚡ Envie apenas o MAC que ativo imediatamente!",
    "active": true
  },
  {
    "id": "smartonepro",
    "name": "Smart One Pro",
    "description": "Ativação do Smart One Pro - Aplicativo de streaming premium",
    "price": 10,
    "currency": "BRL",
    "activationModule": "smartonepro",
    "paymentConfirmedMessage": "🎉 *SMART ONE PRO - PAGAMENTO CONFIRMADO!*\n\n🎯 *Produto:* {product_name}\n💰 *Valor pago:* R$ {price}\n\n━━━━━━━━━━━━━━━━━━━\n📝 *AGORA PRECISO DAS INFORMAÇÕES:*\n\nPara ativar seu Smart One Pro, envie o **MAC Address** do seu dispositivo.\n\n📍 *Como encontrar o MAC:*\n• Android TV: Configurações > Sobre > Status\n• Fire TV: Configurações > Minha Fire TV > Sobre  \n• Smart TV: Configurações > Rede > Status da Rede\n\n📤 *Exemplo:* AA:BB:CC:DD:EE:FF\n\n⚡ Envie apenas o MAC que ativo imediatamente!",
    "active": true
  }
];

async function addAllProducts() {
    const db = new DatabaseService('./database.sqlite');
    
    try {
        console.log('Conectando ao banco...');
        await db.initialize();
        
        console.log('Adicionando ' + products.length + ' produtos IboSol...');
        
        for (const product of products) {
            try {
                await db.saveProduct(product);
                console.log('✅ ' + product.name + ' - R$ ' + product.price);
            } catch (error) {
                console.error('❌ Erro ao adicionar ' + product.name + ':', error.message);
            }
        }
        
        console.log('Todos os produtos adicionados!');
        await db.close();
        
    } catch (error) {
        console.error('Erro:', error);
        await db.close();
        process.exit(1);
    }
}

if (require.main === module) {
    addAllProducts().catch(console.error);
}

module.exports = { addAllProducts, products };
