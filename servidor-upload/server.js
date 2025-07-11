const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const archiver = require('archiver');

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
    if (!original || typeof original !== 'string' || !original.includes(':')) return false;
    const [salt, originalHash] = original.split(':');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === originalHash;
}

function readUsers() {
    if (!fs.existsSync(USERS_FILE_PATH)) fs.writeFileSync(USERS_FILE_PATH, '[]', 'utf-8');
    return JSON.parse(fs.readFileSync(USERS_FILE_PATH, 'utf-8'));
}

function writeUsers(users) {
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(users, null, 2), 'utf-8');
}

// --- CONFIGURAÇÃO DE ARQUIVOS ---
const baseUploadFolder = path.join(__dirname, 'uploads');
if (!fs.existsSync(baseUploadFolder)) fs.mkdirSync(baseUploadFolder);

function getSafePath(userEmail, relativePath = '') {
    const userFolder = path.join(baseUploadFolder, userEmail);
    if (!fs.existsSync(userFolder)) fs.mkdirSync(userFolder, { recursive: true });
    const targetPath = path.join(userFolder, relativePath);
    const normalizedPath = path.normalize(targetPath);
    if (!normalizedPath.startsWith(userFolder)) throw new Error('Acesso negado.');
    return normalizedPath;
}

function parseMasterPath(fullPath) {
    const parts = fullPath.split(/\\|\//);
    const targetUser = parts[0];
    const relativePath = parts.slice(1).join(path.sep);
    const users = readUsers().map(u => u.email);
    if (users.includes(targetUser)) return { targetUser, relativePath };
    return { targetUser: MASTER_EMAIL, relativePath: fullPath };
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        try {
            const userEmail = (req.query.user || '').toLowerCase();
            let currentPath = req.query.path || '';
            let finalUserEmail = userEmail;
            if (userEmail === MASTER_EMAIL) {
                const { targetUser, relativePath } = parseMasterPath(currentPath);
                finalUserEmail = targetUser;
                currentPath = relativePath;
            }
            const safePath = getSafePath(finalUserEmail, currentPath);
            cb(null, safePath);
        } catch (error) { cb(error); }
    },
    filename: (req, file, cb) => { cb(null, file.originalname); }
});

const upload = multer({ storage });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- ROTAS DE AUTENTICAÇÃO ---
app.post('/register', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
    const users = readUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) return res.status(409).json({ message: 'Este e-mail já está cadastrado.' });
    const newUser = { email: email.toLowerCase(), password: hashPassword(password), role: email.toLowerCase() === MASTER_EMAIL ? 'master' : 'user' };
    users.push(newUser);
    writeUsers(users);
    res.status(201).json({ message: 'Usuário cadastrado com sucesso
