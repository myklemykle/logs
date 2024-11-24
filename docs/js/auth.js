class GitHubAuth {
  constructor() {
      console.log('GitHubAuth initializing...');
      this.loadingContainer = document.getElementById('loading-container');
      this.authContainer = document.getElementById('auth-container');
      this.appContainer = document.getElementById('app-container');
      this.init();
  }

  async validateToken(token) {
      // Test the token by attempting to trigger the workflow
      const testUrl = 'https://api.github.com/repos/myklemykle/logs/actions/workflows';
      const response = await fetch(testUrl, {
          headers: {
              'Authorization': `token ${token}`,
              'Accept': 'application/vnd.github.v3+json'
          }
      });
      
      if (!response.ok) {
          throw new Error('Invalid token');
      }
  }

  showLogin() {
      console.log('Showing login form...');
      this.loadingContainer.style.display = 'none';
      this.authContainer.style.display = 'block';
      this.appContainer.style.display = 'none';
  }

  showApp() {
      console.log('Showing app...');
      this.loadingContainer.style.display = 'none';
      this.authContainer.style.display = 'none';
      this.appContainer.style.display = 'block';
      new OperatorLogForm();
  }

  async init() {
      const token = localStorage.getItem('github_token');
      console.log('Stored token exists:', !!token);
      
      try {
          if (token) {
              console.log('Attempting to validate stored token...');
              await this.validateToken(token);
              this.showApp();
          } else {
              this.showLogin();
          }
      } catch (error) {
          console.error('Token validation failed:', error);
          this.showLogin();
      }

      document.getElementById('login-button').addEventListener('click', () => {
          const token = document.getElementById('token-input').value.trim();
          if (token) {
              this.handleToken(token);
          } else {
              alert('Please enter a token');
          }
      });
  }

  async handleToken(token) {
      try {
          await this.validateToken(token);
          localStorage.setItem('github_token', token);
          this.showApp();
      } catch (error) {
          console.error('Token validation failed:', error);
          alert('Invalid token. Please check your token and try again.');
      }
  }
}

// Initialize auth when page loads
window.addEventListener('DOMContentLoaded', () => {
  const auth = new GitHubAuth();
});