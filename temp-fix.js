const fs = require('fs');
let content = fs.readFileSync('core-system.js', 'utf8');

// Substituir configuração do logger
content = content.replace(
    /this\.logger = pino\({[\s\S]*?\}\);/,
    `this.logger = {
        info: (msg, ...args) => console.log('[INFO]', msg, ...args),
        warn: (msg, ...args) => console.warn('[WARN]', msg, ...args),
        error: (msg, ...args) => console.error('[ERROR]', msg, ...args)
    };`
);

fs.writeFileSync('core-system.js', content);
console.log('✅ Logger corrigido!');
