// modules/module_king4kplayer.js - Módulo King 4K Player
const IboSolBaseActivator = require('./ibosol-base-activator');

class KING4KPLAYERActivator extends IboSolBaseActivator {
    constructor(config = {}) {
        super({
            name: 'King 4K Player',
            appModule: 'KING4KPLAYER',
            appId: 11,
            email: config.email || 'conta85iptv@gmail.com',
            password: config.password || 'P@pangu1',
            ...config
        });
    }
}

function createActivator(config = {}) {
    return new KING4KPLAYERActivator(config);
}

module.exports = {
    KING4KPLAYERActivator,
    createActivator
};

if (require.main === module) {
    const activator = createActivator();
    activator.test().then(result => {
        console.log('=== TESTE King 4K Player ===');
        console.log('Status:', result.success ? 'SUCESSO' : 'FALHA');
        console.log('App ID:', result.appId);
        console.log('App Module:', result.appModule);
        if (!result.success) {
            console.log('Erro:', result.error);
        }
    }).catch(console.error);
}
