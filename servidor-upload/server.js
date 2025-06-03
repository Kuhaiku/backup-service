const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Pasta onde os arquivos serão armazenados
const uploadFolder = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadFolder)) {
    fs.mkdirSync(uploadFolder);
}

// Limite máximo de armazenamento em bytes (exemplo: 500 MB)
const MAX_STORAGE_BYTES = 500 * 1024 * 1024;

// Função para calcular tamanho total dos arquivos na pasta uploads
function getFolderSize(folderPath) {
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

// Configuração do multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadFolder);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage });

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Upload de múltiplos arquivos
app.post('/upload', upload.array('files', 20), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).send('Nenhum arquivo enviado.');
    }
    const nomesArquivos = req.files.map(file => file.originalname);
    res.send(`Arquivos enviados com sucesso: ${nomesArquivos.join(', ')}`);
});

// Listar arquivos disponíveis
app.get('/files', (req, res) => {
    fs.readdir(uploadFolder, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao ler a pasta.' });
        }
        res.json(files);
    });
});

// Baixar arquivo específico
app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadFolder, filename);

    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).send('Arquivo não encontrado.');
    }
});

// Deletar arquivo específico
app.delete('/delete/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadFolder, filename);

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.send(`Arquivo ${filename} deletado com sucesso.`);
    } else {
        res.status(404).send('Arquivo não encontrado.');
    }
});

// Rota para informar uso do armazenamento
app.get('/storage', (req, res) => {
    try {
        const usedBytes = getFolderSize(uploadFolder);
        res.json({
            used: usedBytes,
            max: MAX_STORAGE_BYTES
        });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao calcular uso de armazenamento.' });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
