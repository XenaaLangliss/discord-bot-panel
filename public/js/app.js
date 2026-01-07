// Discord Bot Control Panel v1.0 - Main Application

class BotControlPanel {
  constructor() {
    this.pollInterval = null;
    this.isPolling = false;
    this.currentPage = 'console';
    this.uptimeInterval = null;
    this.init();
  }

  init() {
    this.checkAuth();
    this.setupMobileMenu();
    this.setupNavigation();
    this.setupEventListeners();
    this.setupDragAndDrop();
    this.setupLogout();
    this.startPolling();
    this.updateMemoryUsage();
  }

  async checkAuth() {
    try {
      const response = await fetch('/api/auth/status');
      if (!response.ok) {
        window.location.href = '/login';
        return;
      }
      
      const data = await response.json();
      if (!data.authenticated) {
        window.location.href = '/login';
        return;
      }
      
      const userBadge = document.getElementById('userBadge');
      if (userBadge && data.username) {
        userBadge.textContent = data.username;
      }
    } catch (error) {
      console.error('Auth check error:', error);
      window.location.href = '/login';
    }
  }

  setupMobileMenu() {
    const menuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (!menuBtn || !sidebar || !overlay) return;
    
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = sidebar.classList.contains('open');
      
      if (isOpen) {
        this.closeMobileMenu();
      } else {
        this.openMobileMenu();
      }
    });
    
    overlay.addEventListener('click', () => {
      this.closeMobileMenu();
    });
    
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= 1024) {
          this.closeMobileMenu();
        }
      });
    });
  }
  
  openMobileMenu() {
    const menuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    sidebar.classList.add('open');
    overlay.classList.add('active');
    menuBtn.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  
  closeMobileMenu() {
    const menuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    menuBtn.classList.remove('active');
    document.body.style.overflow = '';
  }

  setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-page]');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        this.switchPage(page);
      });
    });
  }

  switchPage(pageName) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`.nav-item[data-page="${pageName}"]`)?.classList.add('active');

    document.querySelectorAll('.page-content').forEach(page => {
      page.classList.add('hidden');
    });
    document.getElementById(`page-${pageName}`)?.classList.remove('hidden');

    this.currentPage = pageName;

    if (pageName === 'files') {
      this.updateFilesList();
    } else if (pageName === 'node-settings') {
      this.loadNodeVersions();
    }
  }

  setupEventListeners() {
    document.getElementById('saveTokenBtn')?.addEventListener('click', () => this.saveToken());

    const fileInput = document.getElementById('fileInput');
    const uploadZone = document.getElementById('uploadZone');
    
    uploadZone?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => this.handleFileUpload(e));

    document.getElementById('startBtn')?.addEventListener('click', () => this.startBot());
    document.getElementById('stopBtn')?.addEventListener('click', () => this.stopBot());
    document.getElementById('restartBtn')?.addEventListener('click', () => this.restartBot());
    document.getElementById('killBtn')?.addEventListener('click', () => this.killBot());
    document.getElementById('clearLogsBtn')?.addEventListener('click', () => this.clearLogs());
  }

  setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.logout();
      });
    }
  }

  async logout() {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        window.location.href = '/login';
      } else {
        this.showToast('Logout failed', 'error');
      }
    } catch (error) {
      console.error('Logout error:', error);
      this.showToast('Network error during logout', 'error');
    }
  }

  setupDragAndDrop() {
    const uploadZone = document.getElementById('uploadZone');
    if (!uploadZone) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      uploadZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      uploadZone.addEventListener(eventName, () => {
        uploadZone.style.borderColor = '#5865f2';
        uploadZone.style.backgroundColor = 'rgba(88, 101, 242, 0.1)';
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      uploadZone.addEventListener(eventName, () => {
        uploadZone.style.borderColor = '';
        uploadZone.style.backgroundColor = '';
      });
    });

    uploadZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.uploadFile(files[0]);
      }
    });
  }

  async saveToken() {
    const tokenInput = document.getElementById('tokenInput');
    const token = tokenInput?.value.trim();

    if (!token) {
      this.showToast('Please enter a bot token', 'error');
      return;
    }

    const saveBtn = document.getElementById('saveTokenBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner"></span><span>Saving...</span>';

    try {
      const response = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const data = await response.json();

      if (response.ok) {
        this.showToast('✅ Token saved successfully!', 'success');
        tokenInput.value = '';
        await this.updateStatus();
      } else {
        this.showToast(`❌ ${data.error || 'Failed to save token'}`, 'error');
      }
    } catch (error) {
      console.error('Error saving token:', error);
      this.showToast('❌ Network error. Please try again.', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
    }
  }

  async handleFileUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    for (let i = 0; i < files.length; i++) {
      await this.uploadFile(files[i]);
    }
    event.target.value = '';
  }

  async uploadFile(file) {
    const allowedExtensions = ['.js', '.json', '.txt', '.env', '.md', '.zip'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      this.showToast('❌ Invalid file type. Allowed: .js, .json, .txt, .env, .md, .zip', 'error');
      return;
    }

    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      this.showToast('❌ File too large. Maximum size: 20MB', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const uploadZone = document.getElementById('uploadZone');
    const originalText = uploadZone.querySelector('.upload-text').textContent;
    uploadZone.querySelector('.upload-text').textContent = 'Uploading...';
    uploadZone.style.opacity = '0.7';

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        if (data.isZip) {
          this.showToast(`📦 ZIP uploaded: ${file.name}`, 'success');
        } else {
          this.showToast(`✅ Uploaded: ${file.name}`, 'success');
        }
        await this.updateFilesList();
        await this.updateStatus();
      } else {
        this.showToast(`❌ ${data.error || 'Upload failed'}`, 'error');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      this.showToast('❌ Upload failed. Please try again.', 'error');
    } finally {
      uploadZone.querySelector('.upload-text').textContent = originalText;
      uploadZone.style.opacity = '1';
    }
  }

  // MANUAL ZIP EXTRACTION
  async extractZip(filename) {
    try {
      this.showToast('📦 Extracting ZIP...', 'info');
      
      const response = await fetch(`/api/extract-zip/${encodeURIComponent(filename)}`, {
        method: 'POST'
      });

      const data = await response.json();

      if (response.ok) {
        this.showToast(`✅ Extracted ${data.extractedCount} files!`, 'success');
        await this.updateFilesList();
        await this.updateStatus();
      } else {
        this.showToast(`❌ ${data.error || 'Extraction failed'}`, 'error');
      }
    } catch (error) {
      console.error('Error extracting ZIP:', error);
      this.showToast('❌ Extraction failed. Please try again.', 'error');
    }
  }

  async deleteFile(filename) {
    // MODERN DELETE CONFIRMATION
    const confirmDelete = await this.showConfirmDialog(
      'Delete File',
      `Are you sure you want to delete "${filename}"?`,
      'Delete',
      'Cancel'
    );
    
    if (!confirmDelete) return;

    try {
      const response = await fetch(`/api/files/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        this.showToast(`🗑️ Deleted: ${filename}`, 'success');
        await this.updateFilesList();
        await this.updateStatus();
      } else {
        const data = await response.json();
        this.showToast(`❌ ${data.error || 'Delete failed'}`, 'error');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      this.showToast('❌ Delete failed. Please try again.', 'error');
    }
  }

  // MODERN CONFIRMATION DIALOG
  showConfirmDialog(title, message, confirmText, cancelText) {
    return new Promise((resolve) => {
      const dialog = document.createElement('div');
      dialog.className = 'confirm-dialog-overlay';
      dialog.innerHTML = `
        <div class="confirm-dialog">
          <div class="confirm-dialog-header">
            <h3>${this.escapeHtml(title)}</h3>
          </div>
          <div class="confirm-dialog-body">
            <p>${this.escapeHtml(message)}</p>
          </div>
          <div class="confirm-dialog-footer">
            <button class="btn btn-secondary" id="cancelBtn">${this.escapeHtml(cancelText)}</button>
            <button class="btn btn-danger" id="confirmBtn">${this.escapeHtml(confirmText)}</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(dialog);
      
      const confirmBtn = dialog.querySelector('#confirmBtn');
      const cancelBtn = dialog.querySelector('#cancelBtn');
      
      const cleanup = () => {
        dialog.remove();
      };
      
      confirmBtn.addEventListener('click', () => {
        cleanup();
        resolve(true);
      });
      
      cancelBtn.addEventListener('click', () => {
        cleanup();
        resolve(false);
      });
      
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
          cleanup();
          resolve(false);
        }
      });
    });
  }

  async updateFilesList() {
    try {
      const response = await fetch('/api/files');
      if (!response.ok) throw new Error('Failed to fetch files');

      const files = await response.json();
      const fileList = document.getElementById('fileList');
      const totalFiles = document.getElementById('totalFiles');

      if (totalFiles) totalFiles.textContent = files.length;

      if (!files || files.length === 0) {
        fileList.innerHTML = `
          <div style="text-align: center; color: var(--text-muted); padding: 40px;">
            <div style="font-size: 48px; margin-bottom: 16px;"><i class="fas fa-box-open"></i></div>
            <div>No files uploaded yet</div>
          </div>
        `;
        return;
      }

      fileList.innerHTML = files.map(file => {
        const icon = this.getFileIcon(file.name);
        const isZip = file.type === '.zip';
        
        return `
          <div class="file-item">
            <div class="file-icon">${icon}</div>
            <div class="file-info">
              <div class="file-name">${this.escapeHtml(file.name)}</div>
              <div class="file-meta">${this.formatFileSize(file.size)} • ${file.type || 'file'} • ${new Date(file.modified).toLocaleDateString()}</div>
            </div>
            <div class="file-actions">
              ${isZip ? `
                <button class="btn btn-primary btn-sm" onclick="botPanel.extractZip('${this.escapeHtml(file.name)}')" title="Extract ZIP">
                  <i class="fas fa-file-archive"></i> Extract
                </button>
              ` : ''}
              <button class="icon-btn" onclick="botPanel.deleteFile('${this.escapeHtml(file.name)}')" title="Delete">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        `;
      }).join('');
    } catch (error) {
      console.error('Error updating files list:', error);
    }
  }

  getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
      'js': '<i class="fab fa-js" style="color: #f7df1e;"></i>',
      'json': '<i class="fas fa-code" style="color: #00d8ff;"></i>',
      'txt': '<i class="fas fa-file-alt" style="color: #43b581;"></i>',
      'env': '<i class="fas fa-lock" style="color: #f04747;"></i>',
      'md': '<i class="fas fa-file" style="color: #7289da;"></i>',
      'zip': '<i class="fas fa-file-archive" style="color: #faa61a;"></i>'
    };
    return icons[ext] || '<i class="fas fa-file"></i>';
  }

  async startBot() {
    const startBtn = document.getElementById('startBtn');
    const originalText = startBtn.innerHTML;
    startBtn.disabled = true;
    startBtn.innerHTML = '<span class="spinner"></span><span>Starting...</span>';

    try {
      const response = await fetch('/api/start', { method: 'POST' });
      const data = await response.json();

      if (response.ok) {
        this.showToast('🚀 Bot is starting...', 'success');
        await this.updateStatus();
      } else {
        this.showToast(`❌ ${data.error || 'Failed to start'}`, 'error');
        startBtn.disabled = false;
        startBtn.innerHTML = originalText;
      }
    } catch (error) {
      console.error('Error starting bot:', error);
      this.showToast('❌ Failed to start bot', 'error');
      startBtn.disabled = false;
      startBtn.innerHTML = originalText;
    }
  }

  async stopBot() {
    const stopBtn = document.getElementById('stopBtn');
    const originalText = stopBtn.innerHTML;
    stopBtn.disabled = true;
    stopBtn.innerHTML = '<span class="spinner"></span><span>Stopping...</span>';

    try {
      const response = await fetch('/api/stop', { method: 'POST' });

      if (response.ok) {
        this.showToast('⏹️ Bot stopped', 'success');
        await this.updateStatus();
      } else {
        const data = await response.json();
        this.showToast(`❌ ${data.error || 'Failed to stop'}`, 'error');
      }
    } catch (error) {
      console.error('Error stopping bot:', error);
      this.showToast('❌ Failed to stop bot', 'error');
    } finally {
      stopBtn.disabled = false;
      stopBtn.innerHTML = originalText;
    }
  }

  async restartBot() {
    this.showToast('🔄 Restarting bot...', 'info');
    await this.stopBot();
    setTimeout(() => this.startBot(), 2000);
  }

  async killBot() {
    const confirmed = await this.showConfirmDialog(
      'Force Kill Bot',
      'Force kill the bot? This may cause data loss.',
      'Force Kill',
      'Cancel'
    );
    
    if (confirmed) {
      await this.stopBot();
    }
  }

  async clearLogs() {
    try {
      await fetch('/api/logs', { method: 'DELETE' });
      const console = document.getElementById('console');
      console.innerHTML = `
        <div class="console-line info">
          <span class="console-timestamp">[SYSTEM]</span>
          <span>Logs cleared</span>
        </div>
      `;
      this.showToast('🗑️ Logs cleared', 'success');
    } catch (error) {
      console.error('Error clearing logs:', error);
      this.showToast('❌ Failed to clear logs', 'error');
    }
  }

  updateConsole(logs) {
    const console = document.getElementById('console');
    
    if (!logs || logs.length === 0) {
      console.innerHTML = `
        <div class="console-line info">
          <span class="console-timestamp">[SYSTEM]</span>
          <span>Waiting for logs...</span>
        </div>
      `;
      return;
    }

    console.innerHTML = logs.map(log => {
      const typeClass = log.type || 'info';
      return `
        <div class="console-line ${typeClass}">
          <span class="console-timestamp">[${log.timestamp}]</span>
          <span>${this.escapeHtml(log.message)}</span>
        </div>
      `;
    }).join('');

    console.scrollTop = console.scrollHeight;
  }

  async updateStatus() {
    try {
      const response = await fetch('/api/status');
      if (!response.ok) return;

      const data = await response.json();

      const statusValue = document.getElementById('statusValue');
      const statusIcon = document.getElementById('statusIcon');
      const statusBadge = document.getElementById('statusBadge');
      const filesCount = document.getElementById('filesCount');

      const isRunning = data.status === 'running';

      if (statusValue) {
        statusValue.textContent = isRunning ? 'ONLINE' : 'OFFLINE';
      }

      if (statusIcon) {
        statusIcon.className = `stat-icon ${isRunning ? 'success' : 'danger'}`;
        statusIcon.innerHTML = isRunning ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-exclamation-triangle"></i>';
      }

      if (statusBadge) {
        statusBadge.className = `status-badge ${isRunning ? 'running' : 'stopped'}`;
        statusBadge.innerHTML = `
          <span class="status-dot ${isRunning ? 'pulse' : ''}"></span>
          <span>${isRunning ? 'RUNNING' : 'STOPPED'}</span>
        `;
      }

      if (filesCount) {
        filesCount.textContent = data.filesCount;
      }

      const startBtn = document.getElementById('startBtn');
      const stopBtn = document.getElementById('stopBtn');
      const restartBtn = document.getElementById('restartBtn');
      const killBtn = document.getElementById('killBtn');

      if (isRunning) {
        startBtn?.classList.add('hidden');
        stopBtn?.classList.remove('hidden');
        restartBtn?.classList.remove('hidden');
        killBtn?.classList.remove('hidden');
        stopBtn.disabled = false;
        restartBtn.disabled = false;
        killBtn.disabled = false;
      } else {
        startBtn?.classList.remove('hidden');
        stopBtn?.classList.add('hidden');
        restartBtn?.classList.add('hidden');
        killBtn?.classList.add('hidden');
        startBtn.disabled = false;
        startBtn.innerHTML = '<i class="fas fa-play"></i><span>Start Bot</span>';
      }

      this.updateConsole(data.logs);

      if (data.uptime) {
        const uptimeValue = document.getElementById('uptimeValue');
        if (uptimeValue) {
          uptimeValue.textContent = this.formatUptime(data.uptime);
        }
      }

      if (data.memoryUsage) {
        const memoryValue = document.getElementById('memoryValue');
        if (memoryValue) {
          const memoryMB = (data.memoryUsage / 1024 / 1024).toFixed(2);
          memoryValue.textContent = `${memoryMB} MB`;
        }
      }

      if (data.nodeVersion) {
        const currentNodeEl = document.getElementById('currentNodeVersion');
        if (currentNodeEl) {
          currentNodeEl.textContent = `Node.js ${data.nodeVersion}`;
        }
      }

    } catch (error) {
      console.error('Error updating status:', error);
    }
  }

  async loadNodeVersions() {
    try {
      const response = await fetch('/api/system/node-versions');
      if (!response.ok) return;

      const data = await response.json();
      this.renderNodeVersions(data);
    } catch (error) {
      console.error('Error loading Node versions:', error);
    }
  }

  renderNodeVersions(data) {
    const gridEl = document.getElementById('nodeVersionsGrid');
    if (!gridEl) return;

    gridEl.innerHTML = data.available.map(version => `
      <div class="node-version-card ${version === data.current ? 'active' : ''}" 
           data-version="${version}" 
           onclick="botPanel.switchNodeVersion('${version}')">
        <div class="node-version-name">Node.js ${version}</div>
        <div class="node-version-number">v${version}</div>
      </div>
    `).join('');
  }

  async switchNodeVersion(version) {
    if (this.botStatus === 'running') {
      this.showToast('Please stop the bot before switching Node.js version', 'warning');
      return;
    }

    try {
      const response = await fetch('/api/system/switch-node', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ version })
      });

      if (response.ok) {
        const data = await response.json();
        this.showToast(`Switched to Node.js ${version}`, 'success');
        this.loadNodeVersions();
        this.updateStatus();
      } else {
        const errorData = await response.json();
        this.showToast(errorData.error || 'Failed to switch version', 'error');
      }
    } catch (error) {
      console.error('Error switching Node version:', error);
      this.showToast('Network error', 'error');
    }
  }

  updateMemoryUsage() {
    setInterval(async () => {
      try {
        const response = await fetch('/api/status');
        if (!response.ok) return;
        
        const data = await response.json();
        const memoryValue = document.getElementById('memoryValue');
        
        if (memoryValue && data.memoryUsage) {
          const memoryMB = (data.memoryUsage / 1024 / 1024).toFixed(2);
          memoryValue.textContent = `${memoryMB} MB`;
        }
      } catch (error) {
        console.error('Error updating memory:', error);
      }
    }, 5000);
  }

  formatUptime(ms) {
    if (!ms || ms < 0) return '0m';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  startPolling() {
    if (this.isPolling) return;

    this.isPolling = true;
    this.updateStatus();
    
    if (this.currentPage === 'files') {
      this.updateFilesList();
    }

    this.pollInterval = setInterval(() => {
      this.updateStatus();
      
      if (this.currentPage === 'files') {
        this.updateFilesList();
      }
    }, 3000);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      this.isPolling = false;
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div class="toast-content">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
}

// Initialize panel
let botPanel;

document.addEventListener('DOMContentLoaded', () => {
  botPanel = new BotControlPanel();
  console.log('%c🤖 Bot Control Panel v1.0', 'color: #5865f2; font-size: 16px; font-weight: bold;');
  console.log('%cManual ZIP Extract + Better Delete', 'color: #43b581;');
});

window.addEventListener('beforeunload', () => {
  if (botPanel) {
    botPanel.stopPolling();
  }
});