// Discord Bot Control Panel v2.0 - Enhanced with File Editor

class BotControlPanel {
  constructor() {
    this.pollInterval = null;
    this.isPolling = false;
    this.currentPage = 'console';
    this.uptimeInterval = null;
    this.currentFileMenu = null;
    this.activeToasts = []; // Track active toasts
    this.maxToasts = 3; // Maximum 3 toasts
    this.currentPath = ''; // Current folder path
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
    this.setupGlobalClickHandler();
  }

  setupGlobalClickHandler() {
    document.addEventListener('click', (e) => {
      if (this.currentFileMenu && !e.target.closest('.file-menu-btn') && !e.target.closest('.file-menu')) {
        this.closeAllFileMenus();
      }
    });
  }

  closeAllFileMenus() {
    document.querySelectorAll('.file-menu').forEach(menu => {
      menu.classList.remove('active');
    });
    this.currentFileMenu = null;
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
    const uploadBtn = document.getElementById('uploadBtn');
    
    // Upload button click
    uploadBtn?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => this.handleFileUpload(e));

    document.getElementById('startBtn')?.addEventListener('click', () => this.startBot());
    document.getElementById('stopBtn')?.addEventListener('click', () => this.stopBot());
    document.getElementById('restartBtn')?.addEventListener('click', () => this.restartBot());
    document.getElementById('killBtn')?.addEventListener('click', () => this.killBot());
    document.getElementById('clearLogsBtn')?.addEventListener('click', () => this.clearLogs());
    
    // Create file/folder button
    document.getElementById('createFileBtn')?.addEventListener('click', () => this.showCreateModal());
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
    // DRAG & DROP REMOVED - ONLY UPLOAD BUTTON NOW
    return;
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
        this.showToast('Token saved successfully!', 'success');
        tokenInput.value = '';
        await this.updateStatus();
      } else {
        this.showToast(data.error || 'Failed to save token', 'error');
      }
    } catch (error) {
      console.error('Error saving token:', error);
      this.showToast('Network error. Please try again.', 'error');
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
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      this.showToast('File too large. Maximum size: 100MB', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const uploadBtn = document.getElementById('uploadBtn');
    const originalText = uploadBtn.innerHTML;
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span class="spinner"></span> Uploading...';

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
          this.showToast(`Uploaded: ${file.name}`, 'success');
        }
        await this.updateFilesList();
        await this.updateStatus();
      } else {
        this.showToast(data.error || 'Upload failed', 'error');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      this.showToast('Upload failed. Please try again.', 'error');
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = originalText;
    }
  }

  // FILE MENU SYSTEM
  toggleFileMenu(filename, event) {
    event.stopPropagation();
    
    const menu = event.target.closest('.file-item').querySelector('.file-menu');
    const allMenus = document.querySelectorAll('.file-menu');
    
    allMenus.forEach(m => {
      if (m !== menu) {
        m.classList.remove('active');
      }
    });
    
    menu.classList.toggle('active');
    this.currentFileMenu = menu.classList.contains('active') ? menu : null;
  }

  // EDIT FILE
  async editFile(filename) {
    this.closeAllFileMenus();
    
    try {
      const response = await fetch(`/api/files/${encodeURIComponent(filename)}/content`);
      
      if (!response.ok) {
        const data = await response.json();
        this.showToast(data.error || 'Failed to load file', 'error');
        return;
      }
      
      const data = await response.json();
      this.showEditorModal(filename, data.content);
    } catch (error) {
      console.error('Error loading file:', error);
      this.showToast('Failed to load file', 'error');
    }
  }

  showEditorModal(filename, content) {
    const modal = document.createElement('div');
    modal.className = 'editor-modal-overlay';
    modal.innerHTML = `
      <div class="editor-modal">
        <div class="editor-modal-header">
          <h3><i class="fas fa-edit"></i> Edit File: ${this.escapeHtml(filename)}</h3>
          <button class="icon-btn" onclick="this.closest('.editor-modal-overlay').remove()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="editor-modal-body">
          <textarea class="form-textarea" id="fileContentEditor">${this.escapeHtml(content)}</textarea>
        </div>
        <div class="editor-modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.editor-modal-overlay').remove()">Cancel</button>
          <button class="btn btn-success" id="saveFileBtn">
            <i class="fas fa-save"></i> Save
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const saveBtn = modal.querySelector('#saveFileBtn');
    saveBtn.addEventListener('click', () => this.saveFileContent(filename, modal));
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  async saveFileContent(filename, modal) {
    const editor = modal.querySelector('#fileContentEditor');
    const content = editor.value;
    const saveBtn = modal.querySelector('#saveFileBtn');
    
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Saving...';
    
    try {
      const response = await fetch(`/api/files/${encodeURIComponent(filename)}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      
      if (response.ok) {
        this.showToast('File saved successfully!', 'success');
        modal.remove();
        await this.updateFilesList();
      } else {
        const data = await response.json();
        this.showToast(data.error || 'Failed to save file', 'error');
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
      }
    } catch (error) {
      console.error('Error saving file:', error);
      this.showToast('Failed to save file', 'error');
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
    }
  }

  // COPY FILE PATH
  copyFilePath(filename) {
    this.closeAllFileMenus();
    
    const path = `./home/${filename}`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(path).then(() => {
        this.showToast('Path copied to clipboard!', 'success');
      }).catch(() => {
        this.fallbackCopyTextToClipboard(path);
      });
    } else {
      this.fallbackCopyTextToClipboard(path);
    }
  }

  fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      this.showToast('Path copied to clipboard!', 'success');
    } catch (err) {
      this.showToast('Failed to copy path', 'error');
    }
    
    document.body.removeChild(textArea);
  }

  // EXTRACT ZIP
  async extractZip(filename) {
    this.closeAllFileMenus();
    
    try {
      this.showToast('📦 Extracting ZIP...', 'info');
      
      const response = await fetch(`/api/extract-zip/${encodeURIComponent(filename)}`, {
        method: 'POST'
      });

      const data = await response.json();

      if (response.ok) {
        this.showToast(`Extracted ${data.extractedCount} files!`, 'success');
        await this.updateFilesList();
        await this.updateStatus();
      } else {
        this.showToast(data.error || 'Extraction failed', 'error');
      }
    } catch (error) {
      console.error('Error extracting ZIP:', error);
      this.showToast('Extraction failed. Please try again.', 'error');
    }
  }

  // DELETE FILE OR FOLDER
  async deleteFile(filename, isFolder = false) {
    this.closeAllFileMenus();
    
    const type = isFolder ? 'folder' : 'file';
    const confirmDelete = await this.showConfirmDialog(
      `Delete ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      `Are you sure you want to delete this ${type}: "${filename}"?${isFolder ? ' All contents will be deleted.' : ''}`,
      'Delete',
      'Cancel'
    );
    
    if (!confirmDelete) return;

    try {
      const response = await fetch(`/api/files/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        this.showToast(`Deleted: ${filename}`, 'success');
        await this.updateFilesList();
        await this.updateStatus();
      } else {
        const data = await response.json();
        this.showToast(data.error || 'Delete failed', 'error');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      this.showToast('Delete failed. Please try again.', 'error');
    }
  }

  // CREATE FILE/FOLDER MODAL
  showCreateModal() {
    const modal = document.createElement('div');
    modal.className = 'create-modal-overlay';
    modal.innerHTML = `
      <div class="create-modal">
        <div class="create-modal-header">
          <h3><i class="fas fa-plus"></i> Create New</h3>
        </div>
        <div class="create-modal-body">
          <div class="create-type-selector">
            <div class="create-type-option active" data-type="file">
              <i class="fas fa-file"></i>
              <span>File</span>
            </div>
            <div class="create-type-option" data-type="folder">
              <i class="fas fa-folder"></i>
              <span>Folder</span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Name</label>
            <input type="text" class="form-input" id="createNameInput" placeholder="Enter name..." />
          </div>
        </div>
        <div class="create-modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.create-modal-overlay').remove()">Cancel</button>
          <button class="btn btn-success" id="createConfirmBtn">
            <i class="fas fa-check"></i> Create
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    let selectedType = 'file';
    
    const typeOptions = modal.querySelectorAll('.create-type-option');
    typeOptions.forEach(option => {
      option.addEventListener('click', () => {
        typeOptions.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        selectedType = option.dataset.type;
      });
    });
    
    const confirmBtn = modal.querySelector('#createConfirmBtn');
    const nameInput = modal.querySelector('#createNameInput');
    
    confirmBtn.addEventListener('click', () => {
      const name = nameInput.value.trim();
      if (!name) {
        this.showToast('Please enter a name', 'error');
        return;
      }
      this.createFileOrFolder(name, selectedType === 'folder', modal);
    });
    
    nameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        confirmBtn.click();
      }
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
    
    setTimeout(() => nameInput.focus(), 100);
  }

  async createFileOrFolder(filename, isFolder, modal) {
    const confirmBtn = modal.querySelector('#createConfirmBtn');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="spinner"></span> Creating...';
    
    try {
      const response = await fetch('/api/files/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          filename, 
          content: '', 
          isFolder 
        })
      });
      
      if (response.ok) {
        this.showToast(`${isFolder ? 'Folder' : 'File'} created successfully!`, 'success');
        modal.remove();
        await this.updateFilesList();
        await this.updateStatus();
      } else {
        const data = await response.json();
        this.showToast(data.error || 'Failed to create', 'error');
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fas fa-check"></i> Create';
      }
    } catch (error) {
      console.error('Error creating:', error);
      this.showToast('Failed to create', 'error');
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<i class="fas fa-check"></i> Create';
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
            <h3><i class="fas fa-exclamation-triangle"></i> ${this.escapeHtml(title)}</h3>
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

      // SORT: Folders first, then files
      const sortedFiles = files.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return b.modified - a.modified;
      });

      // Filter files based on current path
      const displayFiles = sortedFiles.filter(file => {
        if (this.currentPath === '') {
          // Root: show only files without / in name
          return !file.name.includes('/');
        } else {
          // Inside folder: show files that start with currentPath
          return file.name.startsWith(this.currentPath + '/') && 
                 file.name.split('/').length === this.currentPath.split('/').length + 1;
        }
      });

      // Breadcrumb
      let breadcrumbHTML = `
        <div class="file-breadcrumb">
          <i class="fas fa-folder"></i>
          <span>Path:</span>
          <span style="color: var(--accent-primary); cursor: pointer;" onclick="botPanel.navigateToFolder('')">
            /home
          </span>
      `;
      
      if (this.currentPath) {
        const pathParts = this.currentPath.split('/');
        let buildPath = '';
        pathParts.forEach((part, index) => {
          buildPath += (index > 0 ? '/' : '') + part;
          const finalPath = buildPath;
          breadcrumbHTML += `
            <span>/</span>
            <span style="color: var(--accent-primary); cursor: pointer;" onclick="botPanel.navigateToFolder('${finalPath}')">
              ${part}
            </span>
          `;
        });
      }
      
      breadcrumbHTML += '</div>';

      fileList.innerHTML = breadcrumbHTML + (displayFiles.length === 0 ? `
        <div style="text-align: center; color: var(--text-muted); padding: 40px;">
          <div style="font-size: 48px; margin-bottom: 16px;"><i class="fas fa-folder-open"></i></div>
          <div>Empty folder</div>
        </div>
      ` : displayFiles.map(file => {
        const icon = this.getFileIcon(file.name, file.isDirectory);
        const isZip = file.type === '.zip';
        const isFolder = file.isDirectory;
        const isEditable = !isFolder && this.isEditableFile(file.name);
        const displayName = this.currentPath ? file.name.replace(this.currentPath + '/', '') : file.name;
        
        return `
          <div class="file-item" ${isFolder ? `style="cursor: pointer;" onclick="botPanel.navigateToFolder('${this.escapeHtml(file.name)}')"` : ''}>
            <div class="file-icon">${icon}</div>
            <div class="file-info">
              <div class="file-name">
                ${isFolder ? '📁 ' : ''}${this.escapeHtml(displayName)}
                ${isFolder ? ' <span style="color: var(--text-muted); font-size: 12px;">(Folder)</span>' : ''}
              </div>
              <div class="file-meta">
                ${isFolder ? 'Folder' : this.formatFileSize(file.size)} • ${file.type || 'file'} • ${new Date(file.modified).toLocaleDateString()}
              </div>
            </div>
            <div class="file-actions" onclick="event.stopPropagation()">
              <button class="file-menu-btn" onclick="botPanel.toggleFileMenu('${this.escapeHtml(file.name)}', event)">
                <i class="fas fa-ellipsis-v"></i>
              </button>
              <div class="file-menu">
                ${isEditable ? `
                  <div class="file-menu-item" onclick="botPanel.editFile('${this.escapeHtml(file.name)}')">
                    <i class="fas fa-edit"></i>
                    <span>Edit</span>
                  </div>
                ` : ''}
                ${isZip ? `
                  <div class="file-menu-item" onclick="botPanel.extractZip('${this.escapeHtml(file.name)}')">
                    <i class="fas fa-file-archive"></i>
                    <span>Extract</span>
                  </div>
                ` : ''}
                ${!isFolder ? `
                  <div class="file-menu-item" onclick="botPanel.copyFilePath('${this.escapeHtml(file.name)}')">
                    <i class="fas fa-copy"></i>
                    <span>Copy Path</span>
                  </div>
                ` : ''}
                <div class="file-menu-item danger" onclick="botPanel.deleteFile('${this.escapeHtml(file.name)}', ${isFolder})">
                  <i class="fas fa-trash"></i>
                  <span>Delete</span>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join(''));
    } catch (error) {
      console.error('Error updating files list:', error);
    }
  }

  navigateToFolder(folderPath) {
    this.currentPath = folderPath;
    this.updateFilesList();
  }

  isEditableFile(filename) {
    const editableExtensions = ['.js', '.json', '.txt', '.env', '.md', '.html', '.css', '.xml', '.yml', '.yaml', '.gitignore'];
    const ext = '.' + filename.split('.').pop().toLowerCase();
    
    // Check if file starts with . (like .env, .gitignore)
    if (filename.startsWith('.')) {
      return true; // Allow editing hidden files
    }
    
    return editableExtensions.includes(ext);
  }

  getFileIcon(filename, isDirectory) {
    if (isDirectory) {
      return '<i class="fas fa-folder" style="color: #faa61a;"></i>';
    }
    
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
      'js': '<i class="fab fa-js" style="color: #f7df1e;"></i>',
      'json': '<i class="fas fa-code" style="color: #00d8ff;"></i>',
      'txt': '<i class="fas fa-file-alt" style="color: #43b581;"></i>',
      'env': '<i class="fas fa-lock" style="color: #f04747;"></i>',
      'md': '<i class="fas fa-file" style="color: #7289da;"></i>',
      'zip': '<i class="fas fa-file-archive" style="color: #faa61a;"></i>',
      'html': '<i class="fab fa-html5" style="color: #e34c26;"></i>',
      'css': '<i class="fab fa-css3" style="color: #264de4;"></i>',
      'gitignore': '<i class="fab fa-git-alt" style="color: #f34f29;"></i>'
    };
    
    // Check if filename starts with . (hidden files)
    if (filename.startsWith('.')) {
      return '<i class="fas fa-lock" style="color: #f04747;"></i>';
    }
    
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
        this.showToast(data.error || 'Failed to start', 'error');
        startBtn.disabled = false;
        startBtn.innerHTML = originalText;
      }
    } catch (error) {
      console.error('Error starting bot:', error);
      this.showToast('Failed to start bot', 'error');
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
        this.showToast('Bot stopped', 'success');
        await this.updateStatus();
      } else {
        const data = await response.json();
        this.showToast(data.error || 'Failed to stop', 'error');
      }
    } catch (error) {
      console.error('Error stopping bot:', error);
      this.showToast('Failed to stop bot', 'error');
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
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
      console.innerHTML = `
        <div class="console-line info">
          <span class="console-timestamp">[${timeStr}]</span>
          <span>Logs cleared</span>
        </div>
      `;
      this.showToast('Logs cleared', 'success');
    } catch (error) {
      console.error('Error clearing logs:', error);
      this.showToast('Failed to clear logs', 'error');
    }
  }

  updateConsole(logs) {
    const consoleEl = document.getElementById('console');
    
    if (!logs || logs.length === 0) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
      consoleEl.innerHTML = `
        <div class="console-line info">
          <span class="console-timestamp">[${timeStr}]</span>
          <span>Waiting for logs...</span>
        </div>
      `;
      return;
    }

    // Check if user is scrolled up
    const isScrolledToBottom = consoleEl.scrollHeight - consoleEl.clientHeight <= consoleEl.scrollTop + 50;

    consoleEl.innerHTML = logs.map(log => {
      const typeClass = log.type || 'info';
      return `
        <div class="console-line ${typeClass}">
          <span class="console-timestamp">[${log.timestamp}]</span>
          <span>${this.escapeHtml(log.message)}</span>
        </div>
      `;
    }).join('');

    // Only auto-scroll if user was at bottom
    if (isScrolledToBottom) {
      consoleEl.scrollTop = consoleEl.scrollHeight;
    }
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
        <div class="node-version-badge">${version === data.current ? 'Active' : 'Available'}</div>
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

    // Remove oldest toast if we have 3 already
    if (this.activeToasts.length >= this.maxToasts) {
      const oldestToast = this.activeToasts.shift();
      if (oldestToast && oldestToast.parentElement) {
        oldestToast.remove();
      }
    }

    const icons = {
      success: '<i class="fas fa-check-circle"></i>',
      error: '<i class="fas fa-times-circle"></i>',
      warning: '<i class="fas fa-exclamation-triangle"></i>',
      info: '<i class="fas fa-info-circle"></i>'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div class="toast-content">${message}</div>
      <button class="toast-close"><i class="fas fa-times"></i></button>
    `;

    container.appendChild(toast);
    this.activeToasts.push(toast);

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      toast.remove();
      this.activeToasts = this.activeToasts.filter(t => t !== toast);
    });

    setTimeout(() => {
      toast.remove();
      this.activeToasts = this.activeToasts.filter(t => t !== toast);
    }, 4000);
  }
}

// Initialize panel
let botPanel;

document.addEventListener('DOMContentLoaded', () => {
  botPanel = new BotControlPanel();
  console.log('%c🤖 Bot Control Panel v2.0', 'color: #5865f2; font-size: 16px; font-weight: bold;');
  console.log('%c✨ Enhanced with File Editor & Create File/Folder', 'color: #43b581;');
});

window.addEventListener('beforeunload', () => {
  if (botPanel) {
    botPanel.stopPolling();
  }
});