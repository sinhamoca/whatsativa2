// database-cleaner.js - Script para limpar dados de pagamentos e começar do zero
const DatabaseService = require('./database-service');
const fs = require('fs');
const readline = require('readline');

class DatabaseCleaner {
    constructor() {
        this.db = new DatabaseService('./database.sqlite');
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        this.backupFile = `backup_before_clean_${Date.now()}.db`;
    }

    async initialize() {
        await this.db.initialize();
    }

    async close() {
        this.rl.close();
        await this.db.close();
    }

    // Perguntar confirmação
    askConfirmation(question) {
        return new Promise((resolve) => {
            this.rl.question(question, (answer) => {
                resolve(answer.toLowerCase().trim() === 's' || answer.toLowerCase().trim() === 'sim');
            });
        });
    }

    // Criar backup antes da limpeza
    async createBackup() {
        try {
            console.log('💾 Criando backup do banco antes da limpeza...');
            
            // Fechar conexão temporariamente para backup
            await this.db.close();
            
            // Copiar arquivo do banco
            if (fs.existsSync('./database.sqlite')) {
                fs.copyFileSync('./database.sqlite', this.backupFile);
                console.log(`✅ Backup criado: ${this.backupFile}`);
            }
            
            // Reconectar
            await this.db.initialize();
            
            return true;
        } catch (error) {
            console.error('❌ Erro ao criar backup:', error.message);
            return false;
        }
    }

    // Mostrar estatísticas antes da limpeza
    async showCurrentStats() {
        try {
            console.log('\n📊 ESTATÍSTICAS ATUAIS DO BANCO:');
            console.log('═'.repeat(50));

            // Contar pedidos
            const ordersCount = await this.db.get('SELECT COUNT(*) as count FROM orders');
            console.log(`📋 Total de pedidos: ${ordersCount.count}`);

            // Pedidos por status
            const statusStats = await this.db.all(`
                SELECT status, COUNT(*) as count 
                FROM orders 
                GROUP BY status 
                ORDER BY count DESC
            `);

            console.log('\n📊 Pedidos por status:');
            statusStats.forEach(stat => {
                console.log(`   ${stat.status}: ${stat.count} pedidos`);
            });

            // Receita total (estimada)
            const revenue = await this.db.get(`
                SELECT SUM(CAST(JSON_EXTRACT(product_data, '$.price') AS REAL)) as total 
                FROM orders 
                WHERE status IN ('paid', 'completed')
            `);
            console.log(`\n💰 Receita total (pedidos pagos): R$ ${(revenue.total || 0).toFixed(2)}`);

            // Sessões de usuário
            const sessionsCount = await this.db.get('SELECT COUNT(*) as count FROM user_sessions');
            console.log(`👥 Sessões de usuários: ${sessionsCount.count}`);

            // Créditos ativos
            const activeCredits = await this.db.get(`
                SELECT COUNT(*) as count 
                FROM user_sessions 
                WHERE available_credit > 0
            `);
            console.log(`💳 Usuários com crédito ativo: ${activeCredits.count}`);

            // Produtos (serão preservados)
            const productsCount = await this.db.get('SELECT COUNT(*) as count FROM products');
            console.log(`📱 Produtos (serão PRESERVADOS): ${productsCount.count}`);

            console.log('═'.repeat(50));

        } catch (error) {
            console.error('❌ Erro ao obter estatísticas:', error.message);
        }
    }

    // Limpeza completa - Remove todos os dados de pagamentos
    async fullClean() {
        try {
            console.log('\n🧹 INICIANDO LIMPEZA COMPLETA...');
            console.log('═'.repeat(50));

            let deletedCount = 0;

            // 1. Limpar tabela de pedidos
            console.log('🗑️ Limpando pedidos...');
            const ordersResult = await this.db.run('DELETE FROM orders');
            console.log(`   ✅ ${ordersResult.changes} pedidos removidos`);
            deletedCount += ordersResult.changes;

            // 2. Limpar sessões de usuário
            console.log('🗑️ Limpando sessões de usuário...');
            const sessionsResult = await this.db.run('DELETE FROM user_sessions');
            console.log(`   ✅ ${sessionsResult.changes} sessões removidas`);
            deletedCount += sessionsResult.changes;

            // 3. Reset de auto-increment (se aplicável)
            console.log('🔄 Resetando contadores...');
            await this.db.run('DELETE FROM sqlite_sequence WHERE name IN ("orders", "user_sessions")');
            console.log('   ✅ Contadores resetados');

            // 4. Limpar logs de auditoria
            if (fs.existsSync('./security-audit.log')) {
                fs.writeFileSync('./security-audit.log', '');
                console.log('   ✅ Logs de auditoria limpos');
            }

            console.log('═'.repeat(50));
            console.log(`🎉 LIMPEZA CONCLUÍDA! ${deletedCount} registros removidos`);
            
            return true;

        } catch (error) {
            console.error('❌ Erro durante limpeza:', error.message);
            return false;
        }
    }

    // Limpeza seletiva - Remove apenas pedidos específicos
    async selectiveClean() {
        try {
            console.log('\n🎯 LIMPEZA SELETIVA');
            console.log('═'.repeat(50));

            console.log('Opções disponíveis:');
            console.log('1. Remover apenas pedidos pendentes');
            console.log('2. Remover apenas pedidos pagos');
            console.log('3. Remover apenas pedidos completados');
            console.log('4. Remover apenas pedidos falhados');
            console.log('5. Remover pedidos mais antigos que X dias');
            console.log('0. Voltar ao menu principal');

            const choice = await this.askInput('\nEscolha uma opção: ');

            switch (choice) {
                case '1':
                    await this.cleanByStatus('pending_payment');
                    break;
                case '2':
                    await this.cleanByStatus('paid');
                    break;
                case '3':
                    await this.cleanByStatus('completed');
                    break;
                case '4':
                    await this.cleanByStatus(['failed', 'payment_rejected', 'cancelled']);
                    break;
                case '5':
                    await this.cleanByAge();
                    break;
                case '0':
                    return;
                default:
                    console.log('❌ Opção inválida');
            }

        } catch (error) {
            console.error('❌ Erro na limpeza seletiva:', error.message);
        }
    }

    async cleanByStatus(status) {
        try {
            const statusArray = Array.isArray(status) ? status : [status];
            const statusList = statusArray.map(s => `'${s}'`).join(', ');
            
            // Contar pedidos
            const count = await this.db.get(`
                SELECT COUNT(*) as count 
                FROM orders 
                WHERE status IN (${statusList})
            `);

            if (count.count === 0) {
                console.log(`📭 Nenhum pedido encontrado com status: ${statusArray.join(', ')}`);
                return;
            }

            console.log(`\n🔍 Encontrados ${count.count} pedidos com status: ${statusArray.join(', ')}`);
            
            const confirmed = await this.askConfirmation(`Remover estes ${count.count} pedidos? (s/N): `);
            
            if (confirmed) {
                const result = await this.db.run(`DELETE FROM orders WHERE status IN (${statusList})`);
                console.log(`✅ ${result.changes} pedidos removidos`);
                
                // Limpar sessões órfãs
                await this.cleanOrphanSessions();
            } else {
                console.log('❌ Operação cancelada');
            }

        } catch (error) {
            console.error('❌ Erro ao limpar por status:', error.message);
        }
    }

    async cleanByAge() {
        try {
            const days = await this.askInput('Remover pedidos mais antigos que quantos dias? ');
            const daysNum = parseInt(days);
            
            if (isNaN(daysNum) || daysNum <= 0) {
                console.log('❌ Número de dias inválido');
                return;
            }

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysNum);
            const cutoffISO = cutoffDate.toISOString();

            // Contar pedidos
            const count = await this.db.get(`
                SELECT COUNT(*) as count 
                FROM orders 
                WHERE created_at < ?
            `, [cutoffISO]);

            if (count.count === 0) {
                console.log(`📭 Nenhum pedido encontrado mais antigo que ${daysNum} dias`);
                return;
            }

            console.log(`\n🔍 Encontrados ${count.count} pedidos mais antigos que ${daysNum} dias`);
            
            const confirmed = await this.askConfirmation(`Remover estes ${count.count} pedidos? (s/N): `);
            
            if (confirmed) {
                const result = await this.db.run('DELETE FROM orders WHERE created_at < ?', [cutoffISO]);
                console.log(`✅ ${result.changes} pedidos removidos`);
                
                await this.cleanOrphanSessions();
            } else {
                console.log('❌ Operação cancelada');
            }

        } catch (error) {
            console.error('❌ Erro ao limpar por idade:', error.message);
        }
    }

    // Limpar sessões órfãs (sem pedidos correspondentes)
    async cleanOrphanSessions() {
        try {
            const result = await this.db.run(`
                DELETE FROM user_sessions 
                WHERE current_order_id IS NOT NULL 
                AND current_order_id NOT IN (SELECT id FROM orders)
            `);
            
            if (result.changes > 0) {
                console.log(`🧹 ${result.changes} sessões órfãs removidas`);
            }
        } catch (error) {
            console.error('⚠️ Erro ao limpar sessões órfãs:', error.message);
        }
    }

    // Verificar integridade após limpeza
    async verifyIntegrity() {
        try {
            console.log('\n🔍 VERIFICANDO INTEGRIDADE PÓS-LIMPEZA...');
            console.log('═'.repeat(50));

            // Verificar se produtos foram preservados
            const productsCount = await this.db.get('SELECT COUNT(*) as count FROM products');
            console.log(`📱 Produtos preservados: ${productsCount.count}`);

            // Verificar se não há sessões órfãs
            const orphanSessions = await this.db.get(`
                SELECT COUNT(*) as count 
                FROM user_sessions 
                WHERE current_order_id IS NOT NULL 
                AND current_order_id NOT IN (SELECT id FROM orders)
            `);
            
            if (orphanSessions.count === 0) {
                console.log('✅ Sem sessões órfãs');
            } else {
                console.log(`⚠️ ${orphanSessions.count} sessões órfãs encontradas`);
            }

            // Estatísticas finais
            const finalOrders = await this.db.get('SELECT COUNT(*) as count FROM orders');
            const finalSessions = await this.db.get('SELECT COUNT(*) as count FROM user_sessions');
            
            console.log('\n📊 ESTATÍSTICAS FINAIS:');
            console.log(`📋 Pedidos restantes: ${finalOrders.count}`);
            console.log(`👥 Sessões restantes: ${finalSessions.count}`);
            
            console.log('✅ Verificação de integridade concluída');

        } catch (error) {
            console.error('❌ Erro na verificação:', error.message);
        }
    }

    // Perguntar input
    askInput(question) {
        return new Promise((resolve) => {
            this.rl.question(question, (answer) => {
                resolve(answer.trim());
            });
        });
    }

    // Menu principal
    async showMenu() {
        console.log('\n🧹 LIMPADOR DE BANCO DE DADOS');
        console.log('═'.repeat(50));
        console.log('1. 📊 Ver estatísticas atuais');
        console.log('2. 🧹 Limpeza COMPLETA (remove TUDO)');
        console.log('3. 🎯 Limpeza seletiva');
        console.log('4. 🔍 Verificar integridade');
        console.log('5. 💾 Criar backup manual');
        console.log('0. ❌ Sair');
        console.log('═'.repeat(50));

        const choice = await this.askInput('Escolha uma opção: ');
        return choice;
    }

    // Loop principal
    async run() {
        try {
            await this.initialize();
            
            console.log('🧹 LIMPADOR DE BANCO DE DADOS INICIADO');
            console.log('⚠️ ATENÇÃO: Esta ferramenta pode remover dados permanentemente!');
            
            await this.showCurrentStats();

            while (true) {
                const choice = await this.showMenu();

                switch (choice) {
                    case '1':
                        await this.showCurrentStats();
                        break;

                    case '2':
                        console.log('\n⚠️ ATENÇÃO: LIMPEZA COMPLETA!');
                        console.log('Isso irá remover:');
                        console.log('• TODOS os pedidos (orders)');
                        console.log('• TODAS as sessões de usuário');
                        console.log('• TODOS os logs de auditoria');
                        console.log('• Os produtos serão PRESERVADOS');
                        
                        const confirmed = await this.askConfirmation('\nTem CERTEZA? Esta ação é IRREVERSÍVEL! (s/N): ');
                        
                        if (confirmed) {
                            const backupOk = await this.createBackup();
                            if (backupOk) {
                                const cleanOk = await this.fullClean();
                                if (cleanOk) {
                                    await this.verifyIntegrity();
                                }
                            }
                        } else {
                            console.log('❌ Limpeza cancelada');
                        }
                        break;

                    case '3':
                        await this.selectiveClean();
                        break;

                    case '4':
                        await this.verifyIntegrity();
                        break;

                    case '5':
                        await this.createBackup();
                        break;

                    case '0':
                        console.log('👋 Encerrando limpador...');
                        await this.close();
                        return;

                    default:
                        console.log('❌ Opção inválida!');
                }

                await this.askInput('\nPressione Enter para continuar...');
            }

        } catch (error) {
            console.error('❌ Erro fatal:', error.message);
            await this.close();
        }
    }
}

// Funções de conveniência para uso direto
async function quickFullClean() {
    console.log('🧹 LIMPEZA RÁPIDA COMPLETA');
    console.log('═'.repeat(40));
    
    const cleaner = new DatabaseCleaner();
    await cleaner.initialize();
    
    try {
        await cleaner.showCurrentStats();
        
        console.log('\n⚠️ Esta operação removerá TODOS os dados de pagamentos!');
        const confirmed = await cleaner.askConfirmation('Continuar? (s/N): ');
        
        if (confirmed) {
            await cleaner.createBackup();
            await cleaner.fullClean();
            await cleaner.verifyIntegrity();
            console.log('\n🎉 Sistema limpo! Pronto para começar do zero.');
        } else {
            console.log('❌ Operação cancelada');
        }
        
    } finally {
        await cleaner.close();
    }
}

async function showStats() {
    const cleaner = new DatabaseCleaner();
    await cleaner.initialize();
    await cleaner.showCurrentStats();
    await cleaner.close();
}

// Executar
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];

    if (command === 'quick') {
        quickFullClean().catch(console.error);
    } else if (command === 'stats') {
        showStats().catch(console.error);
    } else {
        const cleaner = new DatabaseCleaner();
        cleaner.run().catch(console.error);
    }
}

module.exports = {
    DatabaseCleaner,
    quickFullClean,
    showStats
};
