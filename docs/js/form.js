class OperatorLogForm {
    constructor() {
        console.log('Initializing OperatorLogForm');
        this.form = document.getElementById('operator-log-form');
        this.extensionSelect = document.getElementById('extension');
        this.otherPhoneContainer = document.getElementById('other-phone-container');
        this.otherPhoneInput = document.getElementById('other-phone');
        this.logoutButton = document.getElementById('logout-button');
        this.operatorNameInput = document.getElementById('operator-name');
        this.submitButton = document.getElementById('submit-button');
        this.formTitle = document.getElementById('form-title');
        this.adminSettings = document.getElementById('admin-settings');
        this.init();
    }

    async init() {
        await this.loadExtensions();
        this.setupEventListeners();
        this.setDefaultDateTime();
        this.loadSavedOperatorName();
        this.setupAdminInterface();
        this.loadAdminSettings();
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
                // Format the phone number for display
                let phoneNum = details.caller_id;
                if (phoneNum.startsWith('+1')) {
                    phoneNum = phoneNum.substring(2);  // strip +1
                }
                if (phoneNum.length === 10) {
                    phoneNum = `(${phoneNum.substring(0,3)}) ${phoneNum.substring(3,6)}-${phoneNum.substring(6)}`;
                }
                
                // Store both name and number in the value, separated by a delimiter
                this.extensionSelect.add(new Option(`${name} — ${phoneNum}`, `${name}|${details.caller_id}`));
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

        this.operatorNameInput.addEventListener('change', () => {
            const name = this.operatorNameInput.value.trim();
            if (name) {
                localStorage.setItem('operator_name', name);
            }
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

    setSubmitButtonState(isSubmitting) {
        this.submitButton.disabled = isSubmitting;
        this.submitButton.textContent = isSubmitting ? 'Logging...' : 'Submit Log Entry';
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        try {
            this.setSubmitButtonState(true);  // Disable button and show "Logging..."
            
            const formData = new FormData(this.form);
            
            const callDateTime = this.validateDateTime(
                formData.get('call-date'),
                formData.get('call-time')
            );

            // Format the date and time in local timezone
            const dateStr = callDateTime.getFullYear() + '-' +
                String(callDateTime.getMonth() + 1).padStart(2, '0') + '-' +
                String(callDateTime.getDate()).padStart(2, '0');
            const timeStr = String(callDateTime.getHours()).padStart(2, '0') + ':' +
                String(callDateTime.getMinutes()).padStart(2, '0');
            const localDateTime = `${dateStr} ${timeStr}`;

            // Handle location based on whether it's "other" or a known extension
            let location;
            if (formData.get('extension') === 'other') {
                let phoneNum = formData.get('other-phone');
                if (phoneNum.startsWith('+1')) {
                    phoneNum = phoneNum.substring(2);
                }
                location = phoneNum;
            } else {
                const [name] = formData.get('extension').split('|');
                location = name;
            }

            const notes = formData.get('notes');
            const operatorName = formData.get('operator-name');

            const logEntry = `${localDateTime} ${location} ${operatorName}\n${notes}\n`;

            await this.submitToGitHub(logEntry);

            alert('Log entry submitted successfully!');
            // Reload the page after user acknowledges success
            window.location.reload();

        } catch (error) {
            console.error('Submission error:', error);
            alert(`Error: ${error.message}`);
            this.setSubmitButtonState(false);  // Only restore button on error
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
        const repo = localStorage.getItem('target_repo') || 'futel';
        const branch = localStorage.getItem('target_branch') || 'main';
        
        // GitHub API endpoint for triggering workflow_dispatch events
        const webhookUrl = `https://api.github.com/repos/${repo}/logs/actions/workflows/operator-log.yml/dispatches`;

        const formData = new FormData(this.form);
        const callDateTime = this.validateDateTime(
            formData.get('call-date'),
            formData.get('call-time')
        );

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ref: branch,
                inputs: {
                    'operator-name': formData.get('operator-name'),
                    'date': callDateTime.toISOString().split('T')[0],
                    'time': formData.get('call-time'),
                    'location': formData.get('extension') === 'other' 
                        ? formData.get('other-phone')
                        : formData.get('extension').split('|')[0],
                    'notes': formData.get('notes')
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed to submit log entry: ${errorData.message}`);
        }
    }

    handleLogout() {
        localStorage.removeItem('github_token');
        // Don't remove operator_name on logout
        document.getElementById('app-container').style.display = 'none';
        document.getElementById('auth-container').style.display = 'block';
        this.form.reset();
        this.loadSavedOperatorName();  // Restore the name after form reset
    }

    loadSavedOperatorName() {
        const savedName = localStorage.getItem('operator_name');
        if (savedName) {
            this.operatorNameInput.value = savedName;
        }
    }

    setupAdminInterface() {
        let pressTimer;
        
        this.formTitle.addEventListener('touchstart', (e) => {
            pressTimer = setTimeout(() => this.toggleAdminSettings(), 1000);
        });
        
        this.formTitle.addEventListener('mousedown', (e) => {
            pressTimer = setTimeout(() => this.toggleAdminSettings(), 1000);
        });
        
        ['touchend', 'mouseup', 'mouseleave'].forEach(evt => {
            this.formTitle.addEventListener(evt, () => {
                clearTimeout(pressTimer);
            });
        });

        // Save settings when changed
        document.querySelectorAll('[name="target-repo"], [name="target-branch"]')
            .forEach(radio => {
                radio.addEventListener('change', () => this.saveAdminSettings());
            });
    }

    toggleAdminSettings() {
        this.adminSettings.style.display = 
            this.adminSettings.style.display === 'none' ? 'block' : 'none';
    }

    loadAdminSettings() {
        const repo = localStorage.getItem('target_repo') || 'futel';
        const branch = localStorage.getItem('target_branch') || 'main';
        
        document.querySelector(`[name="target-repo"][value="${repo}"]`).checked = true;
        document.querySelector(`[name="target-branch"][value="${branch}"]`).checked = true;
    }

    saveAdminSettings() {
        const repo = document.querySelector('[name="target-repo"]:checked').value;
        const branch = document.querySelector('[name="target-branch"]:checked').value;
        
        localStorage.setItem('target_repo', repo);
        localStorage.setItem('target_branch', branch);
    }
}
