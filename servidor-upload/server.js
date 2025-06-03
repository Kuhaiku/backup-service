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
app.use(express.json());

// Upload de múltiplos arquivos
app.post('/upload', upload.array('files', 50), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).send('Nenhum arquivo enviado.');
    }

    const nomesArquivos = req.files.map(file => file.originalname);
    res.send(`Arquivos enviados com sucesso: ${nomesArquivos.join(', ')}`);
});

// Listar arquivos
app.get('/files', (req, res) => {
    fs.readdir(uploadFolder, (err, files) => {
        if (err) {
            return res.status(500).send('Erro ao listar arquivos.');
        }
        res.json(files);
    });
});

// Download de arquivo
app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadFolder, filename);

    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).send('Arquivo não encontrado.');
    }
});

// Deletar arquivo
app.delete('/delete/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadFolder, filename);

    if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
            if (err) {
                return res.status(500).send('Erro ao deletar arquivo.');
            }
            res.send(`Arquivo ${filename} deletado com sucesso.`);
        });
    } else {
        res.status(404).send('Arquivo não encontrado.');
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
