# Conectar ao banco
sqlite3 database.sqlite

# Ver sua sessão atual
SELECT * FROM user_sessions WHERE chat_id LIKE '%558594021963%';

# Limpar apenas sua sessão (preserva outros dados)
DELETE FROM user_sessions WHERE chat_id LIKE '%558594021963%';

# Sair
.quit
