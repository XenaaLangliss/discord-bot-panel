// Login Manager
class LoginManager {
  constructor() {
    this.init();
  }

  init() {
    this.checkAuthStatus();
    this.setupEventListeners();
    this.loadSystemInfo();
  }

  async checkAuthStatus() {
    try {
      const response = await fetch('/api/auth/status');
      if (response.ok) {
        const data = await response.json();
        if (data.authenticated) {
          window.location.href = '/';
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    }
  }

  setupEventListeners() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && document.activeElement.type !== 'textarea') {
        const loginBtn = document.querySelector('.btn-login');
        if (loginBtn && !loginBtn.disabled) {
          loginForm.dispatchEvent(new Event('submit'));
        }
      }
    });
  }

  async loadSystemInfo() {
    try {
      const response = await fetch('/api/health');
      if (response.ok) {
        const data = await response.json();
        
        const nodeVersion = document.getElementById('nodeVersion');
        const platform = document.getElementById('platform');
        
        if (nodeVersion) {
          nodeVersion.textContent = data.platform || 'Unknown';
        }
        if (platform) {
          platform.textContent = navigator.platform || 'Unknown';
        }
      }
    } catch (error) {
      console.error('Error loading system info:', error);
    }
  }

  async handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    
    if (!username || !password) {
      this.showMessage('Please fill in all fields', 'error');
      return;
    }
    
    const loginBtn = document.querySelector('.btn-login');
    const originalText = loginBtn.innerHTML;
    
    loginBtn.disabled = true;
    loginBtn.innerHTML = `
      <span class="spinner"></span>
      <span>Authenticating...</span>
    `;
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password, rememberMe })
      });
      
      if (response.ok) {
        const data = await response.json();
        this.showMessage('Login successful! Redirecting...', 'success');
        
        if (data.username) {
          localStorage.setItem('lastUsername', data.username);
        }
        
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
      } else {
        const errorData = await response.json();
        this.showMessage(errorData.error || 'Login failed', 'error');
        loginBtn.disabled = false;
        loginBtn.innerHTML = originalText;
      }
    } catch (error) {
      console.error('Login error:', error);
      this.showMessage('Network error. Please try again.', 'error');
      loginBtn.disabled = false;
      loginBtn.innerHTML = originalText;
    }
  }

  showMessage(message, type = 'info') {
    const messageEl = document.getElementById('loginMessage');
    if (!messageEl) return;
    
    messageEl.textContent = message;
    messageEl.className = `message ${type}`;
    messageEl.classList.remove('hidden');
    
    if (type === 'success') {
      setTimeout(() => {
        messageEl.classList.add('hidden');
      }, 3000);
    }
    
    if (type === 'error') {
      setTimeout(() => {
        messageEl.classList.add('hidden');
      }, 5000);
    }
  }
}

// Initialize login manager
document.addEventListener('DOMContentLoaded', () => {
  new LoginManager();
  
  const lastUsername = localStorage.getItem('lastUsername');
  if (lastUsername) {
    const usernameInput = document.getElementById('username');
    if (usernameInput) {
      usernameInput.value = lastUsername;
      document.getElementById('rememberMe').checked = true;
    }
  }
  
  const usernameInput = document.getElementById('username');
  if (usernameInput) {
    setTimeout(() => {
      usernameInput.focus();
    }, 100);
  }
});