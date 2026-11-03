
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const FILE_DIR = path.join(DATA_DIR, "workbooks");
const META_FILE = path.join(DATA_DIR, "files.json");

fs.mkdirSync(FILE_DIR, { recursive: true });

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

function readMetadata() {
    try {
        return JSON.parse(fs.readFileSync(META_FILE, "utf8"));
    } catch {
        return {};
    }
}

function writeMetadata(data) {
    const temp = META_FILE + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(data, null, 2));
    fs.renameSync(temp, META_FILE);
}

function getFilePath(id) {
    if (!/^[a-f0-9-]{36}$/i.test(id)) return null;
    return path.join(FILE_DIR, id + ".xlsx");
}

const storage = multer.diskStorage({
    destination: FILE_DIR,
    filename: (req, file, cb) => {
        cb(null, randomUUID() + ".xlsx");
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, [".xlsx", ".xls", ".xlsm"].includes(ext));
    }
});

// Upload a new workbook
app.post("/api/files", upload.single("file"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Excel file required" });
    }

    const id = path.basename(req.file.filename, ".xlsx");
    const metadata = readMetadata();

    metadata[id] = {
        id,
        name: path.basename(req.file.originalname),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    writeMetadata(metadata);

    res.json({ success: true, file: metadata[id] });
});

// List saved workbooks
app.get("/api/files", (req, res) => {
    const metadata = readMetadata();
    res.json(Object.values(metadata));
});

// Download or open a saved workbook
app.get("/api/files/:id", (req, res) => {
    const file = getFilePath(req.params.id);
    const metadata = readMetadata();

    if (!file || !metadata[req.params.id] || !fs.existsSync(file)) {
        return res.status(404).json({ error: "File not found" });
    }

    res.download(file, metadata[req.params.id].name);
});

// Update an existing workbook
app.put("/api/files/:id", upload.single("file"), (req, res) => {
    const id = req.params.id;
    const file = getFilePath(id);
    const metadata = readMetadata();

    if (!file || !metadata[id] || !fs.existsSync(file)) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: "File not found" });
    }

    if (!req.file) {
        return res.status(400).json({ error: "Updated workbook required" });
    }

    fs.renameSync(req.file.path, file);

    metadata[id].updatedAt = new Date().toISOString();
    writeMetadata(metadata);

    res.json({ success: true, file: metadata[id] });
});

// Delete a workbook
app.delete("/api/files/:id", (req, res) => {
    const id = req.params.id;
    const file = getFilePath(id);
    const metadata = readMetadata();

    if (!file || !metadata[id]) {
        return res.status(404).json({ error: "File not found" });
    }

    if (fs.existsSync(file)) fs.unlinkSync(file);

    delete metadata[id];
    writeMetadata(metadata);

    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Excel Editor running at http://localhost:${PORT}`);
});
