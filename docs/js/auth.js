class GitHubAuth {
  constructor() {
      console.log('GitHubAuth initializing...');
      this.loadingContainer = document.getElementById('loading-container');
      this.authContainer = document.getElementById('auth-container');
      this.appContainer = document.getElementById('app-container');
      this.init();
  }

  showApp() {
      console.log('Showing app...');
      this.loadingContainer.style.display = 'none';
  //    this.authContainer.style.display = 'none';
      this.appContainer.style.display = 'block';
      
      // Initialize the form
      new OperatorLogForm();
  }

  async init() {
      // Skip token check, just show the app
      this.showApp();
  }
}

// Initialize auth when page loads
window.addEventListener('DOMContentLoaded', () => {
  const auth = new GitHubAuth();
});