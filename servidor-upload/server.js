const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Usuário mestre que pode ver todos os arquivos.
const MASTER_USER = 'master';

// Pasta base para uploads.
const baseUploadFolder = path.join(__dirname, 'uploads');
if (!fs.existsSync(baseUploadFolder)) {
    fs.mkdirSync(baseUploadFolder);
}

// Limite máximo de armazenamento em bytes (500 MB).
const MAX_STORAGE_BYTES = 500 * 1024 * 1024;

// Função para calcular o tamanho da pasta de um usuário.
function getFolderSize(folderPath) {
    if (!fs.existsSync(folderPath)) return 0;
    const files = fs.readdirSync(folderPath);
    let totalSize = 0;
    files.forEach(file => {
        const stats = fs.statSync(path.join(folderPath, file));
        if (stats.isFile()) {
            totalSize += stats.size;
        }
    });
    return totalSize;
}

// Configuração do multer para salvar arquivos na pasta do usuário.
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const user = req.query.user || 'default';
        const userFolder = path.join(baseUploadFolder, user);
        // Cria a pasta do usuário se não existir.
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

// Servir arquivos estáticos da pasta 'public'.
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Rota de Upload - agora salva na pasta do usuário.
app.post('/upload', upload.array('files', 20), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).send('Nenhum arquivo enviado.');
    }
    const nomesArquivos = req.files.map(file => file.originalname);
    res.send(`Arquivos enviados com sucesso: ${nomesArquivos.join(', ')}`);
});

// Rota para Listar Arquivos - com lógica para o usuário mestre.
app.get('/files', (req, res) => {
    const user = req.query.user;
    if (!user) {
        return res.status(400).json({ error: 'Usuário não especificado.' });
    }

    // Se for o usuário mestre, lista todos os arquivos de todos os usuários.
    if (user === MASTER_USER) {
        const allFiles = [];
        const users = fs.readdirSync(baseUploadFolder);
        users.forEach(u => {
            const userFolder = path.join(baseUploadFolder, u);
            if (fs.statSync(userFolder).isDirectory()) {
                const userFiles = fs.readdirSync(userFolder).map(file => ({ user: u, name: file }));
                allFiles.push(...userFiles);
            }
        });
        return res.json(allFiles);
    }

    // Para usuários normais, lista apenas os arquivos da sua pasta.
    const userFolder = path.join(baseUploadFolder, user);
    if (!fs.existsSync(userFolder)) {
        return res.json([]); // Retorna lista vazia se a pasta não existe.
    }
    fs.readdir(userFolder, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao ler a pasta de arquivos.' });
        }
        res.json(files.map(file => ({ user, name: file })));
    });
});

// Rota para Baixar Arquivo.
app.get('/download/:user/:filename', (req, res) => {
    const { user, filename } = req.params;
    const filePath = path.join(baseUploadFolder, user, filename);

    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).send('Arquivo não encontrado.');
    }
});

// Rota para Deletar Arquivo.
app.delete('/delete/:user/:filename', (req, res) => {
    const { user, filename } = req.params;
    const filePath = path.join(baseUploadFolder, user, filename);

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.send(`Arquivo ${filename} deletado com sucesso.`);
    } else {
        res.status(404).send('Arquivo não encontrado.');
    }
});

// Rota para verificar o uso de armazenamento.
app.get('/storage', (req, res) => {
    try {
        const usedBytes = getFolderSize(baseUploadFolder); // Calcula o total usado.
        res.json({
            used: usedBytes,
            max: MAX_STORAGE_BYTES
        });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao calcular uso de armazenamento.' });
    }
});

// Iniciar o servidor.
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Login mestre: use o nome de usuário '${MASTER_USER}'`);
});
