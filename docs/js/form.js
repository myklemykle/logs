class OperatorLogForm {
    constructor() {
        this.form = document.getElementById('operator-log-form');
        this.extensionSelect = document.getElementById('extension');
        this.otherPhoneContainer = document.getElementById('other-phone-container');
        this.otherPhoneInput = document.getElementById('other-phone');
        this.logoutButton = document.getElementById('logout-button');
        this.init();
    }

    async init() {
        await this.loadExtensions();
        this.setupEventListeners();
        this.setDefaultDateTime();
    }

    /**
     * Loads and formats extension data from Futel's extensions.json
     * Data format example:
     * {
     *   "alleytwentyseventh": {
     *         "outgoing": "outgoing_portland", // this probably has some use within the Asterisk server? we don't use it here.
     *         "caller_id": "+15039288465",       // Full phone number with +1 prefix
     *         "enable_emergency": true          // we don't use this either. Maybe related to 911?
     *   },
     *   "bottles-and-cans-one": {
     *         "outgoing": "outgoing_portland", 
     *         "caller_id": "+15034681337",
     *         "enable_emergency": false
     *   },
     * }
     * Source: https://github.com/futel/dialplan-functions/blob/main/app-dialplan/chalicelib/assets/extensions.json
     */
    async loadExtensions() {
        try {
            const response = await fetch('https://raw.githubusercontent.com/futel/dialplan-functions/main/app-dialplan/chalicelib/assets/extensions.json');
            const extensions = await response.json();
            
            // Clear existing options
            this.extensionSelect.innerHTML = '';
            
            // Add default options
            this.extensionSelect.add(new Option('Select location...', ''));
            
            // Sort and add extensions
            const sortedExtensions = Object.entries(extensions).sort((a, b) => 
                a[0].localeCompare(b[0])
            );

            sortedExtensions.forEach(([name, details]) => {
                // Format the phone number
                let phoneNum = details.caller_id;
                if (phoneNum.startsWith('+1')) {
                    phoneNum = phoneNum.substring(2);  // strip +1
                }
                if (phoneNum.length === 10) {
                    phoneNum = `(${phoneNum.substring(0,3)}) ${phoneNum.substring(3,6)}-${phoneNum.substring(6)}`;
                }
                
                this.extensionSelect.add(new Option(`${name} — ${phoneNum}`, details.caller_id));
            });
            
            // Add "Other" option at the end
            this.extensionSelect.add(new Option('Other (enter phone number)', 'other'));
            
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
        
        this.logoutButton.addEventListener('click', () => this.handleLogout());
    }

    setDefaultDateTime() {
        const now = new Date();
        
        // Format date as YYYY-MM-DD (this format works in all browsers)
        const dateStr = now.toLocaleDateString('en-CA'); // Uses YYYY-MM-DD format
        document.getElementById('call-date').value = dateStr;
        
        // Format time as HH:mm (24-hour format)
        const timeStr = now.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        document.getElementById('call-time').value = timeStr;
        
        console.log('Set default date:', dateStr); // Debug log
        console.log('Set default time:', timeStr); // Debug log
    }

    validateDateTime(date, time) {
        const [year, month, day] = date.split('-').map(Number);
        const [hours, minutes] = time.split(':').map(Number);
        
        const callDateTime = new Date(year, month - 1, day, hours, minutes);
        const now = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(now.getFullYear() - 1);

        if (callDateTime > now) {
            throw new Error('Call time cannot be in the future');
        }
        if (callDateTime < oneYearAgo) {
            throw new Error('Call time cannot be more than one year old');
        }
        return callDateTime;
    }

    async handleSubmit(e) {
        e.preventDefault();
        const formData = new FormData(this.form);
        
        try {
            // Validate and combine date/time
            const callDateTime = this.validateDateTime(
                formData.get('call-date'),
                formData.get('call-time')
            );

            const location = formData.get('extension') === 'other' 
                ? formData.get('other-phone')
                : formData.get('extension');
            const notes = formData.get('notes');

            const logEntry = `${callDateTime.toISOString()} ${location}\n${notes}\n`;

            // Submit to GitHub
            await this.submitToGitHub(logEntry);

            // Clear form and reset defaults
            this.form.reset();
            this.setDefaultDateTime();
            alert('Log entry submitted successfully!');

        } catch (error) {
            console.error('Submission error:', error);
            alert(`Error: ${error.message}`);
        }
    }

    /**
     * Submits a log entry to GitHub using their REST API
     * GitHub API response format for getting file contents:
     * {
     *   "type": "file",
     *   "encoding": "base64",
     *   "size": 5362,
     *   "name": "operator",
     *   "path": "operator",
     *   "content": "base64-encoded-string-of-file-contents...",
     *   "sha": "3d21ec53a331a6f037a91c368710b99387d012c1",
     *   "url": "https://api.github.com/repos/myklemykle/logs/contents/operator",
     *   "git_url": "https://api.github.com/repos/myklemykle/logs/git/blobs/...",
     *   "html_url": "https://github.com/myklemykle/logs/blob/main/operator",
     *   "_links": { ... }
     * }
     * 
     * PUT request format to update file:
     * {
     *   "message": "commit message",
     *   "content": "base64-encoded-string-of-new-contents",
     *   "sha": "current-file-sha-from-get-request"
     * }
     * 
     * References:
     * - Get contents: https://docs.github.com/en/rest/repos/contents#get-repository-content
     * - Update file: https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents
     * 
     * @param {string} logEntry - The new log entry to append to the file
     * @throws {Error} If not authenticated or if GitHub operations fail
     */
    async submitToGitHub(logEntry) {
        const token = localStorage.getItem('github_token');
        const branch = 'logform';  // Specify target branch
        
        if (!token) {
            throw new Error('Not authenticated. Please log in again.');
        }

        // First get the current file, specifying branch
        const response = await fetch(
            `https://api.github.com/repos/myklemykle/logs/contents/operator?ref=${branch}`, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch current log file');
        }

        const data = await response.json();
        const currentContent = atob(data.content);
        const newContent = currentContent + '\n' + logEntry;

        // Update the file, specifying branch
        const updateResponse = await fetch('https://api.github.com/repos/myklemykle/logs/contents/operator', {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                message: 'Operator log update',
                content: btoa(newContent),
                sha: data.sha,
                branch: branch    // Specify branch in the PUT request
            })
        });

        if (!updateResponse.ok) {
            const errorData = await updateResponse.json();
            throw new Error(`Failed to update log file: ${errorData.message}`);
        }
    }

    handleLogout() {
        localStorage.removeItem('github_token');
        // Hide app container and show auth container
        document.getElementById('app-container').style.display = 'none';
        document.getElementById('auth-container').style.display = 'block';
        // Clear form data
        this.form.reset();
    }
}

// Initialize form when page loads
window.addEventListener('DOMContentLoaded', () => {
    const form = new OperatorLogForm();
});