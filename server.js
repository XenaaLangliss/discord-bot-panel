require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-i',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'strict'
  },
  name: 'botPanel.sid'
}));

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session && req.session.authenticated) {
    return next();
  }
  
  if (req.path.startsWith('/login') || 
      req.path.startsWith('/css') || 
      req.path.startsWith('/js') ||
      req.path.startsWith('/api/auth') ||
      req.path === '/') {
    return next();
  }
  
  res.redirect('/login');
};

// Apply authentication middleware
app.use(requireAuth);

// Environment variables for authentication
const USERNAME = process.env.USERNAME || 'admin';
const PASSWORD = process.env.PASSWORD || 'admin123';

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - User: ${req.session.username || 'anonymous'} - IP: ${req.ip}`);
  next();
});

// Storage setup - REMOVED ALL FILE RESTRICTIONS
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './bot_files';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, sanitized);
  }
});

// File filter - ALLOW ALL FILES
const fileFilter = (req, file, cb) => {
  cb(null, true); // Accept all files
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 10
  }
});

// Global state
let botProcess = null;
let botStatus = 'stopped';
let logs = [];
let botToken = '';
let isInstalling = false;
let botStartTime = null;
let uptime = 0;
let uptimeInterval = null;
let selectedNodeVersion = process.env.DEFAULT_NODE_VERSION || '18';

// LOAD TOKEN FROM .env FILE IF EXISTS
const loadTokenFromEnv = () => {
  const envPath = path.join('./home', '.env');
  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const tokenMatch = envContent.match(/DISCORD_TOKEN=(.+)/);
      if (tokenMatch && tokenMatch[1]) {
        botToken = tokenMatch[1].trim();
        addLog('Bot token loaded from .env file', 'success', 'system');
      }
    } catch (error) {
      addLog(`Error loading token from .env: ${error.message}`, 'warning', 'system');
    }
  }
};

// Load token on startup
loadTokenFromEnv();

// Available Node.js versions - SIMPLIFIED
const AVAILABLE_NODE_VERSIONS = ['18', '19', '20', '21'];

// Helper functions
const addLog = (message, type = 'info', username = 'system') => {
  const now = new Date();
  const timestamp = now.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
  const logEntry = { 
    timestamp, 
    message: String(message).substring(0, 1000),
    type,
    username
  };
  logs.push(logEntry);
  
  if (logs.length > 500) {
    logs = logs.slice(-500);
  }
  
  const typeColors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m',
  };
  
  console.log(`${typeColors[type] || '\x1b[0m'}[${type.toUpperCase()}] [${username}]\x1b[0m ${message}`);
};

const stopBot = () => {
  if (botProcess) {
    try {
      botProcess.kill('SIGTERM');
      
      setTimeout(() => {
        if (botProcess && !botProcess.killed) {
          botProcess.kill('SIGKILL');
        }
      }, 5000);
      
      botProcess = null;
      botStatus = 'stopped';
      
      if (uptimeInterval) {
        clearInterval(uptimeInterval);
        uptimeInterval = null;
      }
      
      // RESET UPTIME TO 0 WHEN BOT STOPS
      uptime = 0;
      botStartTime = null;
      
      addLog('Bot process stopped', 'warning');
      return true;
    } catch (error) {
      addLog(`Error stopping bot: ${error.message}`, 'error');
      return false;
    }
  }
  return false;
};

const validateBotToken = (token) => {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  if (token.length < 50 || token.length > 100) {
    return false;
  }
  
  const discordTokenPattern = /^[A-Za-z0-9._-]{59,72}$/;
  if (!discordTokenPattern.test(token)) {
    return false;
  }
  
  return true;
};

// IMPROVED ZIP EXTRACTION - FULL SUPPORT FOR NESTED FOLDERS WITH DEBUG
const extractZipFile = async (zipPath, extractDir) => {
  return new Promise(async (resolve, reject) => {
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(zipPath);
      const zipEntries = zip.getEntries();
      
      let extractedCount = 0;
      const extractedFiles = [];
      
      if (!fs.existsSync(extractDir)) {
        fs.mkdirSync(extractDir, { recursive: true });
      }
      
      addLog(`Starting ZIP extraction: ${zipEntries.length} entries found`, 'info');
      
      // First pass: Create all directories
      for (const entry of zipEntries) {
        try {
          // Skip macOS metadata files
          if (entry.entryName.includes('__MACOSX') || entry.entryName.startsWith('.')) {
            addLog(`Skipping: ${entry.entryName}`, 'info');
            continue;
          }
          
          const entryPath = path.join(extractDir, entry.entryName);
          
          if (entry.isDirectory) {
            if (!fs.existsSync(entryPath)) {
              fs.mkdirSync(entryPath, { recursive: true });
              addLog(`Created directory: ${entry.entryName}`, 'success');
            }
          }
        } catch (err) {
          addLog(`Error creating directory ${entry.entryName}: ${err.message}`, 'error');
        }
      }
      
      // Second pass: Extract all files
      for (const entry of zipEntries) {
        try {
          // Skip macOS metadata files
          if (entry.entryName.includes('__MACOSX') || entry.entryName.startsWith('.')) {
            continue;
          }
          
          const entryPath = path.join(extractDir, entry.entryName);
          
          if (!entry.isDirectory) {
            const parentDir = path.dirname(entryPath);
            
            // Ensure parent directory exists
            if (!fs.existsSync(parentDir)) {
              fs.mkdirSync(parentDir, { recursive: true });
              addLog(`Created parent directory: ${parentDir}`, 'info');
            }
            
            // Extract file
            const content = entry.getData();
            fs.writeFileSync(entryPath, content);
            
            extractedCount++;
            extractedFiles.push(entry.entryName);
            addLog(`Extracted file: ${entry.entryName} (${content.length} bytes)`, 'success');
            
            // Verify file exists
            if (fs.existsSync(entryPath)) {
              const stats = fs.statSync(entryPath);
              addLog(`Verified: ${entry.entryName} - ${stats.size} bytes`, 'info');
            } else {
              addLog(`WARNING: File not found after extraction: ${entry.entryName}`, 'warning');
            }
          }
        } catch (err) {
          addLog(`Error extracting ${entry.entryName}: ${err.message}`, 'error');
        }
      }
      
      addLog(`Extraction complete: ${extractedCount} files extracted from ${zipEntries.length} total entries`, 'success');
      
      // List all files in extract directory to verify
      const allFiles = [];
      const walkDir = (dir) => {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          const filepath = path.join(dir, file);
          const stats = fs.statSync(filepath);
          if (stats.isDirectory()) {
            walkDir(filepath);
          } else {
            allFiles.push(filepath.replace(extractDir + '/', ''));
          }
        });
      };
      walkDir(extractDir);
      addLog(`Total files in directory after extraction: ${allFiles.length}`, 'info');
      
      resolve({ 
        extractedCount, 
        total: zipEntries.length,
        files: extractedFiles,
        verifiedFiles: allFiles
      });
    } catch (error) {
      addLog(`ZIP extraction failed: ${error.message}`, 'error');
      reject(new Error(`Failed to extract ZIP: ${error.message}`));
    }
  });
};

// ==================== AUTHENTICATION ROUTES ====================
app.get('/login', (req, res) => {
  if (req.session.authenticated) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  try {
    if (username === USERNAME && password === PASSWORD) {
      req.session.authenticated = true;
      req.session.username = username;
      req.session.loginTime = new Date();
      
      addLog(`User ${username} logged in`, 'success', username);
      return res.json({ success: true, username });
    }
    
    addLog(`Failed login attempt for username: ${username}`, 'warning', 'auth');
    res.status(401).json({ error: 'Invalid username or password' });
  } catch (error) {
    addLog(`Login error: ${error.message}`, 'error', 'auth');
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const username = req.session.username || 'unknown';
  
  req.session.destroy((err) => {
    if (err) {
      addLog(`Logout error: ${err.message}`, 'error', username);
      return res.status(500).json({ error: 'Failed to logout' });
    }
    
    addLog(`User ${username} logged out`, 'info', username);
    res.json({ success: true });
  });
});

app.get('/api/auth/status', (req, res) => {
  res.json({
    authenticated: !!req.session.authenticated,
    username: req.session.username,
    loginTime: req.session.loginTime
  });
});

// ==================== MAIN ROUTES ====================
app.get('/api/status', (req, res) => {
  if (botStatus === 'running' && botStartTime) {
    uptime = Date.now() - botStartTime;
  }
  
  const memoryUsage = process.memoryUsage();
  
  res.json({
    status: botStatus,
    logs: logs.slice(-100),
    filesCount: fs.existsSync('./home') ? fs.readdirSync('./home').length : 0,
    uptime: uptime,
    memoryUsage: memoryUsage.heapUsed,
    memoryTotal: memoryUsage.heapTotal,
    nodeVersion: selectedNodeVersion,
    availableNodeVersions: AVAILABLE_NODE_VERSIONS,
    currentUser: req.session.username,
    platform: process.platform
  });
});

app.get('/api/system/node-versions', (req, res) => {
  res.json({
    current: selectedNodeVersion,
    available: AVAILABLE_NODE_VERSIONS,
    default: process.env.DEFAULT_NODE_VERSION || '18'
  });
});

app.post('/api/system/switch-node', async (req, res) => {
  const { version } = req.body;
  const username = req.session.username;
  
  if (!version) {
    return res.status(400).json({ error: 'Node.js version is required' });
  }
  
  if (botStatus === 'running') {
    return res.status(400).json({ error: 'Cannot switch Node.js version while bot is running' });
  }
  
  if (!AVAILABLE_NODE_VERSIONS.includes(version)) {
    return res.status(400).json({ error: `Node.js version ${version} is not available` });
  }
  
  try {
    selectedNodeVersion = version;
    addLog(`Switched Node.js to version ${version}`, 'success', username);
    
    res.json({ 
      success: true, 
      message: `Node.js switched to version ${version}`,
      version: version
    });
  } catch (error) {
    addLog(`Failed to switch Node.js version: ${error.message}`, 'error', username);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/files', (req, res) => {
  const dir = './home';
  if (!fs.existsSync(dir)) {
    return res.json([]);
  }
  
  try {
    // READ ALL FILES INCLUDING HIDDEN FILES - RECURSIVE
    const getAllFiles = (dirPath, arrayOfFiles = []) => {
      const files = fs.readdirSync(dirPath, { withFileTypes: true });
      
      files.forEach(dirent => {
        const fullPath = path.join(dirPath, dirent.name);
        const relativePath = fullPath.replace(dir + '/', '').replace(dir, '');
        
        if (dirent.isDirectory()) {
          arrayOfFiles.push({
            name: relativePath || dirent.name,
            size: 0,
            type: 'folder',
            modified: fs.statSync(fullPath).mtime,
            isDirectory: true
          });
          // Recursively get files in subdirectories
          getAllFiles(fullPath, arrayOfFiles);
        } else {
          const stats = fs.statSync(fullPath);
          arrayOfFiles.push({
            name: relativePath || dirent.name,
            size: stats.size,
            type: path.extname(dirent.name),
            modified: stats.mtime,
            isDirectory: false
          });
        }
      });
      
      return arrayOfFiles;
    };
    
    const allFiles = getAllFiles(dir);
    res.json(allFiles);
  } catch (error) {
    addLog(`Error reading files: ${error.message}`, 'error', req.session.username);
    res.status(500).json({ error: 'Failed to read files' });
  }
});

// UPLOAD ROUTE - ACCEPT ALL FILES
app.post('/api/upload', async (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 100MB' });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    const username = req.session.username;
    
    try {
      const fileSizeKB = (req.file.size / 1024).toFixed(2);
      addLog(`File uploaded: ${req.file.originalname} (${fileSizeKB} KB)`, 'success', username);
      
      res.json({ 
        message: 'File uploaded successfully',
        filename: req.file.filename,
        size: req.file.size,
        type: fileExt === '.zip' ? 'zip' : 'file',
        isZip: fileExt === '.zip'
      });
    } catch (error) {
      addLog(`Error processing file: ${error.message}`, 'error', username);
      res.status(500).json({ error: `Failed to process file: ${error.message}` });
    }
  });
});

// MANUAL ZIP EXTRACTION
app.post('/api/extract-zip/:filename', async (req, res) => {
  const filename = req.params.filename;
  const username = req.session.username;
  
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  const zipPath = path.join('./home', filename);
  
  if (!fs.existsSync(zipPath)) {
    return res.status(404).json({ error: 'ZIP file not found' });
  }
  
  const ext = path.extname(filename).toLowerCase();
  if (ext !== '.zip') {
    return res.status(400).json({ error: 'File is not a ZIP archive' });
  }
  
  try {
    addLog(`Extracting ZIP: ${filename}`, 'info', username);
    
    const result = await extractZipFile(zipPath, './home');
    
    // Delete ZIP after extraction
    try {
      fs.unlinkSync(zipPath);
      addLog(`Deleted ZIP file: ${filename}`, 'info', username);
    } catch (err) {
      addLog(`Warning: Could not delete ZIP: ${err.message}`, 'warning', username);
    }
    
    addLog(`ZIP extracted successfully: ${result.extractedCount} files`, 'success', username);
    
    res.json({
      success: true,
      message: 'ZIP extracted successfully',
      extractedCount: result.extractedCount,
      files: result.files
    });
  } catch (error) {
    addLog(`Failed to extract ZIP: ${error.message}`, 'error', username);
    res.status(500).json({ error: `Failed to extract ZIP: ${error.message}` });
  }
});

// NEW: READ FILE CONTENT
app.get('/api/files/:filename/content', (req, res) => {
  const filename = req.params.filename;
  const username = req.session.username;
  
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  const filepath = path.join('./home', filename);
  
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  try {
    const stats = fs.statSync(filepath);
    
    if (stats.isDirectory()) {
      return res.status(400).json({ error: 'Cannot read directory content' });
    }
    
    const content = fs.readFileSync(filepath, 'utf8');
    addLog(`File read: ${filename}`, 'info', username);
    
    res.json({ 
      success: true,
      filename: filename,
      content: content,
      size: stats.size
    });
  } catch (error) {
    addLog(`Error reading file ${filename}: ${error.message}`, 'error', username);
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// NEW: UPDATE FILE CONTENT
app.put('/api/files/:filename/content', (req, res) => {
  const filename = req.params.filename;
  const { content } = req.body;
  const username = req.session.username;
  
  if (!content && content !== '') {
    return res.status(400).json({ error: 'Content is required' });
  }
  
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  const filepath = path.join('./home', filename);
  
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  try {
    fs.writeFileSync(filepath, content, 'utf8');
    addLog(`File updated: ${filename}`, 'success', username);
    
    res.json({ 
      success: true,
      message: 'File updated successfully',
      filename: filename
    });
  } catch (error) {
    addLog(`Error updating file ${filename}: ${error.message}`, 'error', username);
    res.status(500).json({ error: 'Failed to update file' });
  }
});

// NEW: CREATE FILE
app.post('/api/files/create', (req, res) => {
  const { filename, content, isFolder } = req.body;
  const username = req.session.username;
  
  if (!filename) {
    return res.status(400).json({ error: 'Filename is required' });
  }
  
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  const filepath = path.join('./home', filename);
  
  if (fs.existsSync(filepath)) {
    return res.status(400).json({ error: 'File or folder already exists' });
  }
  
  try {
    if (isFolder) {
      fs.mkdirSync(filepath, { recursive: true });
      addLog(`Folder created: ${filename}`, 'success', username);
      res.json({ 
        success: true,
        message: 'Folder created successfully',
        filename: filename,
        isFolder: true
      });
    } else {
      fs.writeFileSync(filepath, content || '', 'utf8');
      addLog(`File created: ${filename}`, 'success', username);
      res.json({ 
        success: true,
        message: 'File created successfully',
        filename: filename,
        isFolder: false
      });
    }
  } catch (error) {
    addLog(`Error creating ${isFolder ? 'folder' : 'file'} ${filename}: ${error.message}`, 'error', username);
    res.status(500).json({ error: `Failed to create ${isFolder ? 'folder' : 'file'}` });
  }
});

app.post('/api/token', (req, res) => {
  const { token } = req.body;
  const username = req.session.username;
  
  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }
  
  if (!validateBotToken(token)) {
    return res.status(400).json({ error: 'Invalid Discord bot token format' });
  }
  
  botToken = token;
  
  try {
    const dir = './home';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const envContent = `DISCORD_TOKEN=${token}\nNODE_ENV=production\nNODE_VERSION=${selectedNodeVersion}\n`;
    fs.writeFileSync(path.join(dir, '.env'), envContent, { mode: 0o600 });
    
    addLog('Discord bot token saved securely', 'success', username);
    res.json({ 
      message: 'Token saved successfully',
      tokenSet: true
    });
  } catch (error) {
    addLog(`Error saving token: ${error.message}`, 'error', username);
    res.status(500).json({ error: 'Failed to save token' });
  }
});

// NEW: Check token status
app.get('/api/token/status', (req, res) => {
  res.json({
    hasToken: !!botToken,
    tokenLength: botToken ? botToken.length : 0
  });
});

app.post('/api/start', async (req, res) => {
  const username = req.session.username;
  
  if (botStatus === 'running') {
    return res.status(400).json({ error: 'Bot is already running' });
  }
  
  if (isInstalling) {
    return res.status(400).json({ error: 'Dependencies are being installed. Please wait...' });
  }
  
  // TRY TO LOAD TOKEN FROM .env IF NOT SET
  if (!botToken) {
    loadTokenFromEnv();
  }
  
  if (!botToken) {
    return res.status(400).json({ error: 'Please set Discord bot token first' });
  }
  
  const dir = './home';
  if (!fs.existsSync(dir)) {
    return res.status(400).json({ error: 'No bot files found. Please upload your bot files first.' });
  }
  
  const mainFile = ['index.js', 'bot.js', 'main.js', 'app.js'].find(f => 
    fs.existsSync(path.join(dir, f))
  );
  
  if (!mainFile) {
    addLog('No main bot file found', 'error', username);
    return res.status(400).json({ 
      error: 'No main bot file found',
      expectedFiles: ['index.js', 'bot.js', 'main.js', 'app.js']
    });
  }
  
  const packagePath = path.join(dir, 'package.json');
  if (fs.existsSync(packagePath)) {
    addLog('Installing dependencies...', 'info', username);
    isInstalling = true;
    
    const npmInstall = spawn('npm', ['install', '--production', '--no-audit', '--no-fund'], { 
      cwd: dir,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let installOutput = '';
    
    npmInstall.stdout.on('data', (data) => {
      const output = data.toString().trim();
      installOutput += output + '\n';
      addLog(`NPM: ${output}`, 'info', username);
    });
    
    npmInstall.stderr.on('data', (data) => {
      const output = data.toString().trim();
      if (!output.includes('npm WARN')) {
        addLog(`NPM Warning: ${output}`, 'warning', username);
      }
    });
    
    npmInstall.on('close', (code) => {
      isInstalling = false;
      
      if (code !== 0) {
        addLog(`Failed to install dependencies (exit code: ${code})`, 'error', username);
        return res.status(500).json({ 
          error: 'Failed to install dependencies',
          exitCode: code
        });
      }
      
      addLog('Dependencies installed successfully', 'success', username);
      startBotProcess(dir, mainFile, res, username);
    });
    
    npmInstall.on('error', (error) => {
      isInstalling = false;
      addLog(`NPM install error: ${error.message}`, 'error', username);
      res.status(500).json({ 
        error: 'Failed to install dependencies',
        details: error.message 
      });
    });
  } else {
    addLog('No package.json found, skipping dependency installation', 'warning', username);
    startBotProcess(dir, mainFile, res, username);
  }
});

function startBotProcess(dir, mainFile, res, username) {
  addLog(`Starting bot from ${mainFile} with Node.js ${selectedNodeVersion}...`, 'info', username);
  
  try {
    const botEnv = {
      ...process.env,
      DISCORD_TOKEN: botToken,
      NODE_ENV: 'production',
      NODE_VERSION: selectedNodeVersion
    };
    
    botProcess = spawn('node', [mainFile], {
      cwd: dir,
      env: botEnv,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    botStatus = 'running';
    botStartTime = Date.now();
    
    if (uptimeInterval) {
      clearInterval(uptimeInterval);
    }
    uptimeInterval = setInterval(() => {
      if (botStatus === 'running' && botStartTime) {
        uptime = Date.now() - botStartTime;
      }
    }, 1000);
    
    botProcess.stdout.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        addLog(`Bot: ${message}`, 'info', 'bot');
      }
    });
    
    botProcess.stderr.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        addLog(`Bot Error: ${message}`, 'error', 'bot');
      }
    });
    
    botProcess.on('close', (code, signal) => {
      botStatus = 'stopped';
      
      if (uptimeInterval) {
        clearInterval(uptimeInterval);
        uptimeInterval = null;
      }
      
      if (signal) {
        addLog(`Bot process terminated with signal: ${signal}`, 'warning', username);
      } else if (code !== 0) {
        addLog(`Bot exited with code ${code}`, 'error', username);
      } else {
        addLog('Bot stopped normally', 'info', username);
      }
      
      botProcess = null;
    });
    
    botProcess.on('error', (error) => {
      botStatus = 'stopped';
      addLog(`Failed to start bot process: ${error.message}`, 'error', username);
      botProcess = null;
      
      if (uptimeInterval) {
        clearInterval(uptimeInterval);
        uptimeInterval = null;
      }
    });
    
    setTimeout(() => {
      if (botStatus === 'running' && botProcess) {
        addLog(`Bot ${mainFile} started successfully with Node.js ${selectedNodeVersion}!`, 'success', username);
      }
    }, 3000);
    
    res.json({ 
      message: 'Bot is starting...', 
      mainFile: mainFile,
      nodeVersion: selectedNodeVersion,
      status: 'starting'
    });
  } catch (error) {
    botStatus = 'stopped';
    addLog(`Error starting bot: ${error.message}`, 'error', username);
    res.status(500).json({ 
      error: `Failed to start bot: ${error.message}`
    });
  }
}

app.post('/api/stop', (req, res) => {
  const username = req.session.username;
  
  if (botStatus !== 'running') {
    return res.status(400).json({ error: 'Bot is not running' });
  }
  
  const stopped = stopBot();
  if (stopped) {
    res.json({ 
      message: 'Bot stopped successfully',
      uptime: uptime
    });
  } else {
    res.status(500).json({ error: 'Failed to stop bot' });
  }
});

app.delete('/api/files/:filename', (req, res) => {
  const filename = req.params.filename;
  const username = req.session.username;
  
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  const filepath = path.join('./home', filename);
  
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  // REMOVED: Bot running check - allow deleting files anytime
  
  try {
    const stats = fs.statSync(filepath);
    
    if (stats.isDirectory()) {
      fs.rmSync(filepath, { recursive: true, force: true });
      addLog(`Directory deleted: ${filename}`, 'warning', username);
    } else {
      fs.unlinkSync(filepath);
      addLog(`File deleted: ${filename}`, 'warning', username);
    }
    
    res.json({ 
      message: 'File deleted successfully',
      filename: filename
    });
  } catch (error) {
    addLog(`Error deleting file ${filename}: ${error.message}`, 'error', username);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

app.get('/api/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  res.json(logs.slice(-limit));
});

app.delete('/api/logs', (req, res) => {
  const username = req.session.username;
  
  logs = [];
  addLog('Logs cleared', 'warning', username);
  res.json({ 
    message: 'Logs cleared'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    botStatus: botStatus,
    botUptime: uptime,
    authenticated: !!req.session.authenticated
  });
});

app.get('/', (req, res) => {
  if (!req.session.authenticated) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.path
  });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  addLog(`Server error: ${err.message}`, 'error');
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, cleaning up...');
  stopBot();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, cleaning up...');
  stopBot();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  addLog(`Uncaught Exception: ${error.message}`, 'error');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  addLog(`Unhandled Rejection: ${reason}`, 'error');
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ============================================
  🤖 Discord Bot Control Panel v2.0
  ============================================
  ✅ Server running on port ${PORT}
  ✅ Authentication: Enabled
  ✅ Manual ZIP Extraction: Enabled
  ✅ File Editor: Enabled
  ✅ Create File/Folder: Enabled
  ✅ Multi-Node Version: Enabled
  
  🔐 Login required: Yes
  👤 Default username: ${USERNAME}
  🌐 Access panel: http://localhost:${PORT}
  
  Press Ctrl+C to stop the server
  ============================================
  `);
  
  addLog(`Server started on port ${PORT} with authentication`, 'success', 'system');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', error);
    process.exit(1);
  }
});