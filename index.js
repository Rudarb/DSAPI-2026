const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

function autenticacao(req, res, next) {
    const perm = req.headers['permissao']; //'cliente' ou 'admin'
    const usuarioId = req.headers['usuario-id']; // 3 (admin nao precisa)

    if (req.path === '/clientes' && req.method === 'POST') {
        return next();
    }

    if (!perm) {
        return res.status(401).json({ erro: 'Não autenticado.(cliente ou admin).' });
    }

    if (perm.toLowerCase() === 'cliente' && !usuarioId) {
        return res.status(401).json({ erro: 'Clientes precisam enviar o header "usuario-id" com o seu ID.' });
    }

    req.usuario = {
        id: usuarioId ? parseInt(usuarioId) : null,
        perm: perm.toLowerCase()
    };

    next();
}

function permitir(...perfispermitidos) {
    return (req, res, next) => {
        if (!req.usuario || !perfispermitidos.includes(req.usuario.perm)) {
            return res.status(403).json({ erro: 'Acesso negado. Você não tem permissão para esta operação.' });
        }
        next();
    };
}

app.use(autenticacao);

// GET: receber dados
// POST: enviar dados
// PUT: atualizar dados
// DELETE: excluir dados

app.post('/clientes', async (req, res) => {
    try {
        const { nome, altura, nascimento, cidade_id } = req.body;

        if (!nome || !cidade_id) {
            return res.status(400).json({ erro: 'Nome e cidade_id são obrigatórios.' });
        }

        const [result] = await db.query(
            'INSERT INTO clientes (nome, altura, nascimento, cidade_id) VALUES (?, ?, ?, ?)',
            [nome, altura, nascimento, cidade_id]
        );

        res.status(201).json({ mensagem: 'Cliente registado', id: result.insertId });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao registar cliente. Verifique se a cidade_id existe.' });
    }
});

app.get('/produtos',permitir('cliente', 'admin'), async (req, res) => {
    try {
        const [produtos] = await db.query('SELECT * FROM produtos WHERE quantidade > 0');
        res.status(200).json(produtos);
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao procurar produtos.' });
    }
});

app.post('/produtos', permitir('admin'), async (req, res) => {
    try {
        const { nome, preco, quantidade, categoria_id } = req.body;
        
        const [result] = await db.query(
            'INSERT INTO produtos (nome, preco, quantidade, categoria_id) VALUES (?, ?, ?, ?)',
            [nome, preco, quantidade, categoria_id]
        );
        res.status(201).json({ mensagem: 'Produto criado', id: result.insertId });
    } catch (error) {
        res.status(400).json({ erro: 'Erro ao criar produto. Verifique os dados e a categoria_id.' });
    }
});

app.put('/produtos/:id', permitir('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, preco, quantidade, categoria_id } = req.body;

        const [result] = await db.query(
            'UPDATE produtos SET nome = ?, preco = ?, quantidade = ?, categoria_id = ? WHERE id = ?',
            [nome, preco, quantidade, categoria_id, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ erro: 'Produto não encontrado.' });
        }
        res.status(200).json({ mensagem: 'Produto atualizado' });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao atualizar produto.' });
    }
});

app.delete('/produtos/:id', permitir('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM produtos WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ erro: 'Produto não encontrado.' });
        }
        res.status(200).json({ mensagem: 'Produto excluído' });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao excluir produto. Pode estar associado a um pedido.' });
    }
});

app.post('/pedidos', permitir('cliente', 'admin'), async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { endereco, itens } = req.body;
        const cliente_id = req.usuario.id;

        if (!cliente_id || !endereco || !itens || itens.length === 0) {
            return res.status(400).json({ erro: 'Dados do pedido incompletos.' });
        }

        await connection.beginTransaction();

        const [pedidoResult] = await connection.query(
            'INSERT INTO pedidos (horario, endereco, cliente_id) VALUES (NOW(), ?, ?)',
            [endereco, cliente_id]
        );
        const pedidoId = pedidoResult.insertId;

       for (const item of itens) {
           const [prodResult] = await connection.query('SELECT quantidade FROM produtos WHERE id = ?', [item.produto_id]);
            if (prodResult.length === 0) {
                throw new Error(`Produto com ID ${item.produto_id} não existe.`);
            }
            
            const stockAtual = prodResult[0].quantidade;
            if (stockAtual < item.quantidade) {
                throw new Error(`Stock insuficiente para o produto ID ${item.produto_id}. Disponível: ${stockAtual}`);
            }

             await connection.query(
                'INSERT INTO pedidos_produtos (pedido_id, produto_id, preco, quantidade) VALUES (?, ?, ?, ?)',
                [pedidoId, item.produto_id, item.preco, item.quantidade]
            );

            await connection.query(
                'UPDATE produtos SET quantidade = quantidade - ? WHERE id = ?',
                [item.quantidade, item.produto_id]
            );
        }

        await connection.commit();
        res.status(201).json({ mensagem: 'Pedido realizado', pedido_id: pedidoId });

    } catch (error) {
        await connection.rollback();
        res.status(400).json({ erro: error.message || 'Erro ao processar o pedido.' });
    } finally {
        connection.release();
    }
});


app.get('/pedidos', permitir('cliente', 'admin'), async (req, res) => {
    try {
        const { cliente_id } = req.query;
        let query = `
            SELECT p.id as pedido_id, p.horario, p.endereco, p.cliente_id,
                   pp.produto_id, pr.nome as produto_nome, pp.quantidade, pp.preco
            FROM pedidos p
            JOIN pedidos_produtos pp ON p.id = pp.pedido_id
            JOIN produtos pr ON pp.produto_id = pr.id
        `;
        let params = [];

      if (req.usuario.role === 'cliente') {
            query += ' WHERE p.cliente_id = ?';
            params.push(req.usuario.id);
        }

        else if (req.usuario.role === 'admin' && req.query.cliente_id) {
            query += ' WHERE p.cliente_id = ?';
            params.push(req.query.cliente_id);
        }

        const [resultados] = await db.query(query, params);
        res.status(200).json(resultados);
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao procurar pedidos.' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`API Loja Online`);
});