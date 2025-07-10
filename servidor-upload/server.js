const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

// --- CONFIGURAÇÃO DE USUÁRIOS ---
const USERS_FILE_PATH = path.join(__dirname, 'users.json');
const MASTER_EMAIL = 'master@master.com'; // E-mail do usuário mestre

// Função para gerar hash da senha (mais seguro que texto plano)
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}

// Função para verificar a senha
function verifyPassword(password, original) {
    const [salt, originalHash] = original.split(':');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === originalHash;
}

// Funções para ler e escrever no arquivo de usuários
function readUsers() {
    if (!fs.existsSync(USERS_FILE_PATH)) {
        fs.writeFileSync(USERS_FILE_PATH, '[]');
    }
    const data = fs.readFileSync(USERS_FILE_PATH);
    return JSON.parse(data);
}

function writeUsers(users) {
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(users, null, 2));
}

// --- CONFIGURAÇÃO DE ARQUIVOS ---
const baseUploadFolder = path.join(__dirname, 'uploads');
if (!fs.existsSync(baseUploadFolder)) {
    fs.mkdirSync(baseUploadFolder);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Usa o email (em minúsculas) para nomear a pasta
        const userEmail = (req.query.user || 'default').toLowerCase();
        const userFolder = path.join(baseUploadFolder, userEmail);
        if (!fs.existsSync(userFolder)) {
            fs.mkdirSync(userFolder, { recursive: true });
        }
        cb(null, userFolder);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- ROTAS DE AUTENTICAÇÃO ---

app.post('/register', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
    }

    const users = readUsers();
    // Verifica se o email já existe (case-insensitive)
    const userExists = users.some(u => u.email.toLowerCase() === email.toLowerCase());
    if (userExists) {
        return res.status(409).json({ message: 'Este e-mail já está cadastrado.' });
    }

    const newUser = {
        email: email.toLowerCase(),
        password: hashPassword(password),
        role: email.toLowerCase() === MASTER_EMAIL ? 'master' : 'user' // Define a role
    };

    users.push(newUser);
    writeUsers(users);

    res.status(201).json({ message: 'Usuário cadastrado com sucesso!' });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const users = readUsers();

    // Procura o usuário pelo e-mail (case-insensitive)
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user || !verifyPassword(password, user.password)) {
        return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
    }

    res.json({
        message: 'Login bem-sucedido!',
        user: { email: user.email, role: user.role }
    });
});


// --- ROTAS DE ARQUIVOS (Adaptadas para usar o e-mail como identificador) ---

// As rotas de arquivos (/files, /download, /delete, etc.) permanecem quase iguais,
// mas agora a identificação do usuário (e sua pasta) é o e-mail.

app.get('/files', (req, res) => {
    const userEmail = (req.query.user || '').toLowerCase();
    if (!userEmail) {
        return res.status(400).json({ error: 'Usuário não especificado.' });
    }

    const users = readUsers();
    const currentUser = users.find(u => u.email === userEmail);

    if (!currentUser) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    // Se for o usuário mestre, lista todos os arquivos
    if (currentUser.role === 'master') {
        const allFiles = [];
        const userFolders = fs.readdirSync(baseUploadFolder);
        userFolders.forEach(folder => {
            const userFolderFiles = fs.readdirSync(path.join(baseUploadFolder, folder));
            userFolderFiles.forEach(file => {
                allFiles.push({ user: folder, name: file });
            });
        });
        return res.json(allFiles);
    }

    // Para usuários normais, lista apenas os da sua pasta
    const userFolder = path.join(baseUploadFolder, userEmail);
    if (!fs.existsSync(userFolder)) return res.json([]);

    const files = fs.readdirSync(userFolder);
    res.json(files.map(file => ({ user: userEmail, name: file })));
});

// Download, Delete e Upload usam o e-mail na URL
app.get('/download/:user/:filename', (req, res) => {
    const { user, filename } = req.params;
    const filePath = path.join(baseUploadFolder, user.toLowerCase(), filename);
    if (fs.existsSync(filePath)) res.download(filePath);
    else res.status(404).send('Arquivo não encontrado.');
});

app.delete('/delete/:user/:filename', (req, res) => {
    const { user, filename } = req.params;
    const filePath = path.join(baseUploadFolder, user.toLowerCase(), filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.send(`Arquivo ${filename} deletado com sucesso.`);
    } else {
        res.status(404).send('Arquivo não encontrado.');
    }
});

app.post('/upload', upload.array('files', 20), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).send('Nenhum arquivo enviado.');
    }
    res.send(`Arquivos enviados com sucesso.`);
});


app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Usuário Mestre: Cadastre-se ou faça login com o e-mail '${MASTER_EMAIL}'`);
});
