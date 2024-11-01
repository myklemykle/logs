class GitHubAuth {
  constructor() {
      this.init();
  }

  init() {
      // Check if we have a stored token
      const token = localStorage.getItem('github_token');
      if (token) {
          this.validateToken(token);
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
          localStorage.removeItem('github_token');
          this.showLogin();
          throw new Error('Invalid token');
      }
  }

  showApp() {
      document.getElementById('auth-container').style.display = 'none';
      document.getElementById('app-container').style.display = 'block';
  }

  showLogin() {
      document.getElementById('auth-container').style.display = 'block';
      document.getElementById('app-container').style.display = 'none';
  }
}

// Initialize auth when page loads
window.addEventListener('DOMContentLoaded', () => {
  const auth = new GitHubAuth();
});