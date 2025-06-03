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

// Middleware para JSON
app.use(express.json());

// 🚀 Upload de múltiplos arquivos
app.post('/upload', upload.array('files', 20), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).send('Nenhum arquivo enviado.');
    }
    const nomesArquivos = req.files.map(file => file.originalname);
    res.send(`Arquivos enviados com sucesso: ${nomesArquivos.join(', ')}`);
});

// 📄 Listar arquivos disponíveis
app.get('/files', (req, res) => {
    fs.readdir(uploadFolder, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao ler a pasta.' });
        }
        res.json(files);
    });
});

// 📥 Baixar arquivo específico
app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadFolder, filename);

    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).send('Arquivo não encontrado.');
    }
});

// 🗑️ Deletar arquivo específico
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

// 🔥 Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
