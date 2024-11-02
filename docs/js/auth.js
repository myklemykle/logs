class GitHubAuth {
  constructor() {
      console.log('GitHubAuth initializing...');
      this.loadingContainer = document.getElementById('loading-container');
      this.authContainer = document.getElementById('auth-container');
      this.appContainer = document.getElementById('app-container');
      this.init();
  }

  async init() {
      // Check if we have a stored token
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

      // Set up login button
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
          console.error('Token validation error:', error);
          alert('Invalid token. Please check and try again.');
      }
  }

  async validateToken(token) {
      const response = await fetch('https://api.github.com/repos/myklemykle/logs/contents/operator', {
          headers: {
              'Authorization': `token ${token}`,
              'Accept': 'application/vnd.github.v3+json'
          }
      });
      
      if (!response.ok) {
          console.error('Token validation failed:', response.status, response.statusText);
          localStorage.removeItem('github_token');
          throw new Error('Invalid token');
      }
      
      console.log('Token validation successful');
      return true;
  }

  showApp() {
      console.log('Showing app...');
      this.loadingContainer.style.display = 'none';
      this.authContainer.style.display = 'none';
      this.appContainer.style.display = 'block';
      
      // Initialize the form after showing the app container
      new OperatorLogForm();
  }

  showLogin() {
      console.log('Showing login form...');
      this.loadingContainer.style.display = 'none';
      this.authContainer.style.display = 'block';
      this.appContainer.style.display = 'none';
  }
}

// Initialize auth when page loads
window.addEventListener('DOMContentLoaded', () => {
  const auth = new GitHubAuth();
});