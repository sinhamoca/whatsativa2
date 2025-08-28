// modules/module_iboxxplayer.js - Módulo IboXX Player
const IboSolBaseActivator = require('./ibosol-base-activator');

class IBOXXPLAYERActivator extends IboSolBaseActivator {
    constructor(config = {}) {
        super({
            name: 'IboXX Player',
            appModule: 'IBOXXPLAYER',
            appId: 13,
            email: config.email || 'conta85iptv@gmail.com',
            password: config.password || 'P@pangu1',
            ...config
        });
    }
}

function createActivator(config = {}) {
    return new IBOXXPLAYERActivator(config);
}

module.exports = {
    IBOXXPLAYERActivator,
    createActivator
};

if (require.main === module) {
    const activator = createActivator();
    activator.test().then(result => {
        console.log('=== TESTE IboXX Player ===');
        console.log('Status:', result.success ? 'SUCESSO' : 'FALHA');
        console.log('App ID:', result.appId);
        console.log('App Module:', result.appModule);
        if (!result.success) {
            console.log('Erro:', result.error);
        }
    }).catch(console.error);
}
