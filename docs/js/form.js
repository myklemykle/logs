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
        this.setDefaultDateTime();
    }

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