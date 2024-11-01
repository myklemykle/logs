class OperatorLogForm {
    constructor() {
        this.form = document.getElementById('operator-log-form');
        this.extensionSelect = document.getElementById('extension');
        this.otherPhoneContainer = document.getElementById('other-phone-container');
        this.otherPhoneInput = document.getElementById('other-phone');
        this.init();
    }

    async init() {
        await this.loadExtensions();
        this.setupEventListeners();
        this.setDefaultTimestamp();
    }

    async loadExtensions() {
        try {
            const response = await fetch('https://raw.githubusercontent.com/futel/dialplan-functions/main/app-dialplan/chalicelib/assets/extensions.json');
            const extensions = await response.json();
            
            // Sort extensions by name
            const sortedExtensions = Object.entries(extensions).sort((a, b) => 
                a[1].name.localeCompare(b[1].name)
            );

            // Add options to select
            sortedExtensions.forEach(([ext, details]) => {
                const option = document.createElement('option');
                option.value = ext;
                option.textContent = `${details.name} (${ext})`;
                this.extensionSelect.insertBefore(option, this.extensionSelect.lastChild);
            });
        } catch (error) {
            console.error('Failed to load extensions:', error);
            alert('Failed to load extension list. Please refresh the page.');
        }
    }

    setupEventListeners() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        this.extensionSelect.addEventListener('change', () => {
            this.otherPhoneContainer.style.display = 
                this.extensionSelect.value === 'other' ? 'block' : 'none';
            this.otherPhoneInput.required = this.extensionSelect.value === 'other';
        });
    }

    setDefaultTimestamp() {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('timestamp').value = now.toISOString().slice(0, 16);
    }

    validateTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(now.getFullYear() - 1);

        if (date > now) {
            throw new Error('Timestamp cannot be in the future');
        }
        if (date < oneYearAgo) {
            throw new Error('Timestamp cannot be more than one year old');
        }
        return true;
    }

    async handleSubmit(e) {
        e.preventDefault();
        const formData = new FormData(this.form);
        
        try {
            // Validate timestamp
            this.validateTimestamp(formData.get('timestamp'));

            // Format the log entry
            const timestamp = new Date(formData.get('timestamp')).toISOString();
            const location = formData.get('extension') === 'other' 
                ? formData.get('other-phone')
                : formData.get('extension');
            const notes = formData.get('notes');

            const logEntry = `${timestamp} ${location}\n${notes}\n`;

            // Submit to GitHub
            await this.submitToGitHub(logEntry);

            // Clear form
            this.form.reset();
            this.setDefaultTimestamp();
            alert('Log entry submitted successfully!');

        } catch (error) {
            console.error('Submission error:', error);
            alert(`Error: ${error.message}`);
        }
    }

    async submitToGitHub(logEntry) {
        const token = localStorage.getItem('github_token');
        if (!token) {
            throw new Error('Not authenticated. Please log in again.');
        }

        // First get the current file
        const response = await fetch('https://api.github.com/repos/myklemykle/logs/contents/operator', {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch current log file');
        }

        const data = await response.json();
        const currentContent = atob(data.sha);
        const newContent = currentContent + '\n' + logEntry;

        // Update the file
        const updateResponse = await fetch('https://api.github.com/repos/myklemykle/logs/contents/operator', {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                message: 'Operator log update',
                content: btoa(newContent),
                sha: data.sha
            })
        });

        if (!updateResponse.ok) {
            throw new Error('Failed to update log file');
        }
    }
}

// Initialize form when page loads
window.addEventListener('DOMContentLoaded', () => {
    const form = new OperatorLogForm();
});