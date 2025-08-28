// activation-blocker-service.js - Sistema de Bloqueio Temporário para Ativações Longas
const pino = require('pino');

class ActivationBlockerService {
    constructor(config = {}) {
        this.config = {
            // Módulos que precisam de bloqueio (ativações longas)
            blockedModules: ['duplexplay'], // Adicione outros módulos que usam navegador
            blockTimeout: 5 * 60 * 1000, // 5 minutos timeout máximo
            warningMessage: '⏳ Processando sua ativação, aguarde...',
            ...config
        };
        
        this.logger = pino({ level: 'info' });
        this.db = null;
        
        // Map para controlar usuários bloqueados
        // Estrutura: chatId -> { blocked: true, moduleId: 'duplexplay', startTime: timestamp, orderId: 'xxx' }
        this.blockedUsers = new Map();
        
        // Cleanup automático a cada 30 segundos
        this.startCleanupTimer();
        
        this.logger.info('🔒 Activation Blocker Service inicializado');
    }

    // Inicializar com dependências
    initialize(dependencies) {
        this.db = dependencies.db;
        this.logger.info('🔒 Activation Blocker Service configurado');
    }

    // === MÉTODOS PRINCIPAIS ===

    /**
     * Verifica se um usuário está bloqueado para ativação
     * @param {string} chatId - ID do chat do usuário
     * @returns {boolean|object} - false se não bloqueado, objeto com info se bloqueado
     */
    isUserBlocked(chatId) {
        const blockInfo = this.blockedUsers.get(chatId);
        
        if (!blockInfo) {
            return false;
        }
        
        // Verificar timeout
        const elapsed = Date.now() - blockInfo.startTime;
        if (elapsed > this.config.blockTimeout) {
            this.logger.warn(`⏰ Timeout do bloqueio para ${chatId} (${elapsed}ms) - Desbloqueando automaticamente`);
            this.unblockUser(chatId, 'timeout');
            return false;
        }
        
        this.logger.info(`🔒 Usuário ${chatId} bloqueado para ativação de ${blockInfo.moduleId} há ${Math.round(elapsed/1000)}s`);
        
        return {
            blocked: true,
            moduleId: blockInfo.moduleId,
            orderId: blockInfo.orderId,
            elapsedTime: elapsed,
            startTime: blockInfo.startTime
        };
    }

    /**
     * Bloqueia um usuário durante uma ativação longa
     * @param {string} chatId - ID do chat do usuário
     * @param {string} moduleId - ID do módulo de ativação
     * @param {string} orderId - ID do pedido sendo ativado
     */
    blockUser(chatId, moduleId, orderId) {
        // Verificar se o módulo precisa de bloqueio
        if (!this.config.blockedModules.includes(moduleId.toLowerCase())) {
            this.logger.info(`📋 Módulo ${moduleId} não precisa de bloqueio - ignorando`);
            return false;
        }
        
        const blockInfo = {
            blocked: true,
            moduleId: moduleId,
            orderId: orderId,
            startTime: Date.now()
        };
        
        this.blockedUsers.set(chatId, blockInfo);
        
        this.logger.info(`🔒 Usuário ${chatId} BLOQUEADO para ativação ${moduleId} (pedido: ${orderId})`);
        this.logger.info(`⏱️ Timeout configurado: ${this.config.blockTimeout / 1000}s`);
        
        return true;
    }

    /**
     * Desbloqueia um usuário após conclusão da ativação
     * @param {string} chatId - ID do chat do usuário
     * @param {string} reason - Motivo do desbloqueio (completed, failed, timeout, manual)
     */
    unblockUser(chatId, reason = 'completed') {
        const blockInfo = this.blockedUsers.get(chatId);
        
        if (blockInfo) {
            const duration = Date.now() - blockInfo.startTime;
            this.logger.info(`🔓 Usuário ${chatId} DESBLOQUEADO após ${Math.round(duration/1000)}s (motivo: ${reason})`);
            this.blockedUsers.delete(chatId);
            return true;
        }
        
        return false;
    }

    /**
     * Gera mensagem de bloqueio personalizada para o usuário
     * @param {string} chatId - ID do chat do usuário
     * @returns {string} - Mensagem explicativa
     */
    getBlockMessage(chatId) {
        const blockInfo = this.blockedUsers.get(chatId);
        
        if (!blockInfo) {
            return this.config.warningMessage;
        }
        
        const elapsed = Math.round((Date.now() - blockInfo.startTime) / 1000);
        const moduleName = this.getModuleFriendlyName(blockInfo.moduleId);
        
        return `⏳ *ATIVAÇÃO EM ANDAMENTO*

🔄 Processando ativação do **${moduleName}**
⏱️ Tempo decorrido: ${elapsed} segundos
🆔 Pedido: ${blockInfo.orderId.substring(0, 8)}...

━━━━━━━━━━━━━━━━━━━
⚠️ *Por favor, aguarde!*

• A ativação está sendo processada
• Não envie outras mensagens agora
• Você receberá o resultado em breve

💡 Este processo pode levar até 3 minutos devido ao uso de navegador automatizado.

🚫 Comandos temporariamente bloqueados até a conclusão.`;
    }

    /**
     * Obtém nome amigável do módulo
     * @param {string} moduleId - ID do módulo
     * @returns {string} - Nome amigável
     */
    getModuleFriendlyName(moduleId) {
        const moduleNames = {
            'duplexplay': 'DuplexPlay',
            // Adicione outros módulos conforme necessário
        };
        
        return moduleNames[moduleId.toLowerCase()] || moduleId.toUpperCase();
    }

    /**
     * Força o desbloqueio de um usuário (para admin/debug)
     * @param {string} chatId - ID do chat do usuário
     */
    forceUnblock(chatId) {
        const success = this.unblockUser(chatId, 'manual');
        this.logger.warn(`🛠️ Desbloqueio FORÇADO para ${chatId}: ${success ? 'sucesso' : 'usuário não estava bloqueado'}`);
        return success;
    }

    /**
     * Lista todos os usuários atualmente bloqueados
     * @returns {Array} - Lista de usuários bloqueados
     */
    getBlockedUsers() {
        const blockedList = [];
        
        for (const [chatId, blockInfo] of this.blockedUsers.entries()) {
            const elapsed = Date.now() - blockInfo.startTime;
            blockedList.push({
                chatId: chatId.substring(0, 15) + '...',
                moduleId: blockInfo.moduleId,
                orderId: blockInfo.orderId.substring(0, 8) + '...',
                elapsedSeconds: Math.round(elapsed / 1000),
                startTime: new Date(blockInfo.startTime).toISOString()
            });
        }
        
        return blockedList;
    }

    /**
     * Obtém estatísticas do serviço
     * @returns {object} - Estatísticas
     */
    getStats() {
        const now = Date.now();
        let totalDuration = 0;
        
        for (const blockInfo of this.blockedUsers.values()) {
            totalDuration += now - blockInfo.startTime;
        }
        
        return {
            currentlyBlocked: this.blockedUsers.size,
            blockedModules: this.config.blockedModules,
            averageDuration: this.blockedUsers.size > 0 ? Math.round(totalDuration / this.blockedUsers.size / 1000) : 0,
            blockTimeout: this.config.blockTimeout / 1000,
            uptime: process.uptime()
        };
    }

    // === MÉTODOS AUXILIARES ===

    /**
     * Timer de limpeza automática
     */
    startCleanupTimer() {
        setInterval(() => {
            this.cleanupExpiredBlocks();
        }, 30000); // A cada 30 segundos
    }

    /**
     * Remove bloqueios expirados automaticamente
     */
    cleanupExpiredBlocks() {
        const now = Date.now();
        const expiredUsers = [];
        
        for (const [chatId, blockInfo] of this.blockedUsers.entries()) {
            const elapsed = now - blockInfo.startTime;
            if (elapsed > this.config.blockTimeout) {
                expiredUsers.push(chatId);
            }
        }
        
        if (expiredUsers.length > 0) {
            this.logger.info(`🧹 Limpando ${expiredUsers.length} bloqueios expirados`);
            expiredUsers.forEach(chatId => {
                this.unblockUser(chatId, 'cleanup');
            });
        }
    }

    /**
     * Desabilita o serviço
     */
    shutdown() {
        this.logger.info('🔒 Desabilitando Activation Blocker Service...');
        
        // Desbloquear todos os usuários
        const blockedCount = this.blockedUsers.size;
        for (const chatId of this.blockedUsers.keys()) {
            this.unblockUser(chatId, 'shutdown');
        }
        
        this.logger.info(`🔓 ${blockedCount} usuários desbloqueados durante shutdown`);
    }
}

module.exports = ActivationBlockerService;
