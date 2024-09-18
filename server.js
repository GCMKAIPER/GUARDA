const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const app = express();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const port = 3000;


// Configura o body-parser para processar os dados enviados pelo formulário
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Configura a pasta pública para servir arquivos estáticos
app.use(express.static('public'));

// Configura a conexão com o banco de dados MySQL
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '222185', // Substitua pela senha do seu banco de dados MySQL
    database: 'boletins' // Nome do banco de dados
});

// Verifica se a conexão ao banco de dados foi bem-sucedida
connection.connect((err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados: ' + err.stack);
        return;
    }
    console.log('Conectado ao banco de dados MySQL');
});

// Rota para lidar com o envio do formulário de consulta
app.post('/consulta', (req, res) => {
    const numeroBoletim = req.body.numeroBoletim;
    const cpf = req.body.cpf;

    // Query no banco de dados para buscar o boletim com o número e CPF fornecidos
    const query = 'SELECT caminho_pdf FROM boletim_ocorrencia WHERE numero_bo = ? AND cpf = ?';
    connection.query(query, [numeroBoletim, cpf], (err, results) => {
        if (err) {
            console.error('Erro na consulta:', err);
            return res.status(500).send('Erro na consulta');
        }

        // Se um boletim for encontrado, redirecionar para o PDF
        if (results.length > 0) {
            const caminhoPdf = results[0].caminho_pdf;
            res.redirect(caminhoPdf);
        } else {
            res.send('Boletim não encontrado ou CPF incorreto.');
        }
    });
});


// Middleware para sessões
app.use(session({
    secret: 'secreto_para_sessao',  // Alterar para algo seguro
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }  // Mudar para true se estiver em HTTPS
}));

// Middleware para receber dados do formulário
app.use(express.urlencoded({ extended: true }));


// Exibir a página de login
app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/login.html');
});

// Processar o login
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Supondo que você tenha um banco de dados de administradores
    const adminUser = "admin";  // Usuário de exemplo
    const adminPass = "1234";    // Senha de exemplo

    // Verificando se o usuário e a senha estão corretos
    if (username === adminUser && password === adminPass) {
        // Login bem-sucedido - redireciona para a página de administrador
        res.redirect('/admin-dashboard');
    } else {
        // Se o login falhar, redireciona de volta para a página de login com uma mensagem de erro
        res.redirect('/login?error=1');
    }
});


// Rota para a área de administradores
// Rota que exibe a página do Painel de Administração após o login bem-sucedido

app.get('/admin-dashboard', (req, res) => {
    res.sendFile(__dirname + '/admin-dashboard.html'); // Certifique-se de que o caminho para o arquivo está correto
});



// Logout
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) throw err;
        res.redirect('/login');
    });
});

// Exibir o formulário de inserção de boletim
app.get('/inserir-boletim', (req, res) => {
    res.sendFile(__dirname + '/inserir-boletim.html');
});

// Rota para exibir o formulário de inserção de boletim
app.get('/inserir-boletim', (req, res) => {
    res.sendFile(__dirname + '/inserir-boletim.html'); // Caminho correto do HTML
});

// Rota para processar o formulário e inserir boletim no banco de dados
app.post('/inserir-boletim', (req, res) => {
    const { numero_boletim, cpf, pdf_link } = req.body;
    
    // Verifica se os campos estão preenchidos
    if (!numero_boletim || !cpf || !pdf_link) {
        return res.status(400).send('Erro: Todos os campos são obrigatórios.');
    }

    const query = `INSERT INTO boletins (numero_boletim, cpf, pdf_link) VALUES (?, ?, ?)`;

    connection.query(query, [numero_boletim, cpf, pdf_link], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).send('Erro: Número de Boletim ou Link do PDF já existe.');
            }
            return res.status(500).send('Erro ao inserir boletim.');
        }
        res.status(200).send('Boletim inserido com sucesso!');
    });
});



// Rota para exibir o formulário de busca
app.get('/buscar-boletim', (req, res) => {
    res.sendFile(__dirname + '/buscar-boletim.html'); // Caminho correto do HTML
});

// Rota para processar a busca de boletim
app.post('/buscar-boletim', (req, res) => {
    const { numeroBoletim, cpf } = req.body;

    if (!numeroBoletim || !cpf) {
        res.send('Por favor, forneça o número do boletim e o CPF.');
        return;
    }

    const query = 'SELECT * FROM boletins WHERE numero_boletim = ? AND cpf = ?';
    connection.query(query, [numeroBoletim, cpf], (err, results) => {
        if (err) {
            console.error('Erro ao buscar boletim:', err);
            res.send('Erro ao buscar boletim.');
        } else if (results.length === 0) {
            // Retorna mensagem de erro ao cliente
            res.send('<script>alert("Nenhum boletim encontrado para os dados fornecidos."); window.location.href="/";</script>');
        } else {
            // Se o boletim foi encontrado, exibe o link para download
            const boletim = results[0];
            res.send(`<script>alert("Boletim encontrado! Clique no link para baixar o PDF."); window.location.href="${boletim.pdf_link}";</script>`);
        }
    });
});

// Rota para obter todos os boletins
app.get('/admin/lista-boletins', async (req, res) => {
    const filtro = req.query.filtro || 'todos'; // Pega o filtro da URL
    let query = "SELECT * FROM boletins"; // Query padrão para pegar todos os boletins

    // Filtros de data
    const now = new Date();
    let startDate, endDate;

    switch (filtro) {
        case 'hoje':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 1); // Fim do dia
            query += ` WHERE created_at >= '${startDate.toISOString()}' AND created_at < '${endDate.toISOString()}'`;
            break;
        case 'semana':
            startDate = new Date(now.setDate(now.getDate() - now.getDay()));
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 7); // Próximo domingo
            query += ` WHERE created_at >= '${startDate.toISOString()}' AND created_at < '${endDate.toISOString()}'`;
            break;
        case 'mes':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            query += ` WHERE created_at >= '${startDate.toISOString()}' AND created_at < '${endDate.toISOString()}'`;
            break;
        case 'ano':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear() + 1, 0, 1);
            query += ` WHERE created_at >= '${startDate.toISOString()}' AND created_at < '${endDate.toISOString()}'`;
            break;
        case 'periodo':
            startDate = req.query.startDate;
            endDate = req.query.endDate;
            query += ` WHERE created_at >= '${startDate}' AND created_at < '${endDate}'`;
            break;
    }

    try {
        const [rows] = await connection.promise().query(query);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar boletins:', error);
        res.status(500).send('Erro ao buscar boletins');
    }
});


// Inicializando o servidor na porta 3000
app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000.');
});

