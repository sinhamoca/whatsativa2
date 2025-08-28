// modules/module_flixnet.js - Módulo FlixNet
const IboSolBaseActivator = require('./ibosol-base-activator');

class FLIXNETActivator extends IboSolBaseActivator {
    constructor(config = {}) {
        super({
            name: 'FlixNet',
            appModule: 'FLIXNET',
            appId: 18,
            email: config.email || 'conta85iptv@gmail.com',
            password: config.password || 'P@pangu1',
            ...config
        });
    }
}

function createActivator(config = {}) {
    return new FLIXNETActivator(config);
}

module.exports = {
    FLIXNETActivator,
    createActivator
};

if (require.main === module) {
    const activator = createActivator();
    activator.test().then(result => {
        console.log('=== TESTE FlixNet ===');
        console.log('Status:', result.success ? 'SUCESSO' : 'FALHA');
        console.log('App ID:', result.appId);
        console.log('App Module:', result.appModule);
        if (!result.success) {
            console.log('Erro:', result.error);
        }
    }).catch(console.error);
}
