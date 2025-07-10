const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

// --- CONFIGURAÇÃO DE USUÁRIOS ---
const USERS_FILE_PATH = path.join(__dirname, 'users.json');
const MASTER_EMAIL = 'master@master.com';

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password, original) {
    if (!original || typeof original !== 'string' || !original.includes(':')) {
        return false;
    }
    const [salt, originalHash] = original.split(':');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === originalHash;
}

function readUsers() {
    if (!fs.existsSync(USERS_FILE_PATH)) {
        fs.writeFileSync(USERS_FILE_PATH, '[]', 'utf-8');
    }
    return JSON.parse(fs.readFileSync(USERS_FILE_PATH, 'utf-8'));
}

function writeUsers(users) {
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(users, null, 2), 'utf-8');
}

// --- CONFIGURAÇÃO DE ARQUIVOS ---
const baseUploadFolder = path.join(__dirname, 'uploads');
if (!fs.existsSync(baseUploadFolder)) {
    fs.mkdirSync(baseUploadFolder);
}

function getSafePath(userEmail, relativePath = '') {
    const userFolder = path.join(baseUploadFolder, userEmail);
    if (!fs.existsSync(userFolder)) {
        fs.mkdirSync(userFolder, { recursive: true });
    }
    const targetPath = path.join(userFolder, relativePath);
    const normalizedPath = path.normalize(targetPath);
    if (!normalizedPath.startsWith(userFolder)) {
        throw new Error('Acesso negado.');
    }
    return normalizedPath;
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        try {
            const userEmail = (req.query.user || 'default').toLowerCase();
            const currentPath = req.query.path || '';
            const safePath = getSafePath(userEmail, currentPath);
            cb(null, safePath);
        } catch (error) {
            cb(error);
        }
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
    if (!email || !password) return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
    const users = readUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        return res.status(409).json({ message: 'Este e-mail já está cadastrado.' });
    }
    const newUser = {
        email: email.toLowerCase(),
        password: hashPassword(password),
        role: email.toLowerCase() === MASTER_EMAIL ? 'master' : 'user'
    };
    users.push(newUser);
    writeUsers(users);
    res.status(201).json({ message: 'Usuário cadastrado com sucesso!' });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const users = readUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user || !verifyPassword(password, user.password)) {
        return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
    }
    res.json({ user: { email: user.email, role: user.role } });
});

// --- ROTAS DE ARQUIVOS E PASTAS ---
app.post('/files', (req, res) => {
    try {
        const { user, currentPath } = req.body;
        const safePath = getSafePath(user.email, currentPath);
        const items = fs.readdirSync(safePath, { withFileTypes: true });
        const files = items.map(item => ({
            name: item.name,
            isFolder: item.isDirectory(),
        }));
        res.json(files);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/upload', upload.array('files', 20), (req, res) => {
    res.json({ message: 'Arquivos enviados com sucesso!' });
});

app.post('/folders/create', (req, res) => {
    try {
        const { user, currentPath, folderName } = req.body;
        if (!folderName || /[\\/]/.test(folderName)) return res.status(400).json({ message: 'Nome de pasta inválido.' });
        const newFolderPath = getSafePath(user.email, path.join(currentPath, folderName));
        if (fs.existsSync(newFolderPath)) return res.status(409).json({ message: 'Uma pasta com este nome já existe.' });
        fs.mkdirSync(newFolderPath);
        res.json({ message: 'Pasta criada com sucesso!' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/items/rename', (req, res) => {
    try {
        const { user, currentPath, oldName, newName } = req.body;
        if (!newName || /[\\/]/.test(newName)) return res.status(400).json({ message: 'Novo nome inválido.' });
        const oldPath = getSafePath(user.email, path.join(currentPath, oldName));
        const newPath = getSafePath(user.email, path.join(currentPath, newName));
        if (!fs.existsSync(oldPath)) return res.status(404).json({ message: 'Item original não encontrado.' });
        if (fs.existsSync(newPath)) return res.status(409).json({ message: 'Já existe um item com o novo nome.' });
        fs.renameSync(oldPath, newPath);
        res.json({ message: 'Item renomeado com sucesso!' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/items/move', (req, res) => {
    try {
        const { user, currentPath, itemsToMove, destinationPath } = req.body;
        const destSafePath = getSafePath(user.email, destinationPath);
        if (!fs.existsSync(destSafePath) || !fs.statSync(destSafePath).isDirectory()) {
            return res.status(400).json({ message: 'Pasta de destino inválida ou não existe.' });
        }
        const errors = [];
        itemsToMove.forEach(itemName => {
            const sourcePath = getSafePath(user.email, path.join(currentPath, itemName));
            const finalDestPath = getSafePath(user.email, path.join(destinationPath, itemName));
            if (destSafePath.startsWith(sourcePath + path.sep)) {
                errors.push(`${itemName}: Não é possível mover uma pasta para dentro dela mesma.`);
                return;
            }
            if (fs.existsSync(finalDestPath)) {
                errors.push(`${itemName}: já existe no destino.`);
            } else {
                fs.renameSync(sourcePath, finalDestPath);
            }
        });
        if (errors.length > 0) return res.status(409).json({ message: `Operação concluída com erros: ${errors.join(' ')}` });
        res.json({ message: 'Itens movidos com sucesso!' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/items/delete', (req, res) => {
    try {
        const { user, currentPath, items } = req.body;
        items.forEach(item => {
            const itemPath = getSafePath(user.email, path.join(currentPath, item.name));
            if (fs.existsSync(itemPath)) {
                fs.rmSync(itemPath, { recursive: true, force: true });
            }
        });
        res.json({ message: `${items.length} item(ns) deletado(s) com sucesso.` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Rotas de preview e download
app.get('/preview/:userEmail/*', (req, res) => {
    try {
        const userEmail = req.params.userEmail;
        const relativePath = req.params[0];
        const safePath = getSafePath(userEmail, relativePath);
        if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
            res.sendFile(safePath);
        } else {
            res.status(404).send('Arquivo não encontrado.');
        }
    } catch (error) {
        res.status(400).send(error.message);
    }
});

app.get('/download/:userEmail/*', (req, res) => {
    try {
        const userEmail = req.params.userEmail;
        const relativePath = req.params[0];
        const safePath = getSafePath(userEmail, relativePath);
        if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
            res.download(safePath);
        } else {
            res.status(404).send('Arquivo não encontrado.');
        }
    } catch (error) {
        res.status(400).send(error.message);
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
