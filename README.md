# JobSprint AI Chrome Extension

A powerful Chrome extension that automatically tracks job applications across major job portals and integrates with the JobSprint AI platform.

## Supported Job Portals

- 🔗 Naukri
- 🔗 LinkedIn Jobs
- 🔗 Indeed
- 🔗 Shine
- 🔗 FountIt
- 🔗 FreshersWorld
- 🔗 Internshala
- 🔗 TimesJobs
- 🔗 HiRist
- 🔗 Apna

## Features

### 1. **Automatic Job Detection**
   - Automatically detects when you're viewing a job listing
   - Extracts job title, company name, and location
   - Stores job posting URL for reference

### 2. **One-Click Application Tracking**
   - Track applications with a single click
   - Maintains a synchronized list with your JobSprint AI dashboard
   - Timestamps each application

### 3. **AI-Generated Cover Letters**
   - Generate AI-powered cover letters specific to job postings
   - Customized based on your resume and job requirements
   - Save drafts or send directly

### 4. **Application Analytics**
   - View application statistics
   - Track application response rates
   - Identify trends across platforms

### 5. **Profile Integration**
   - One-click access to your JobSprint AI profile
   - View and manage resume and skills
   - Update job preferences directly from the extension

## Installation

### Prerequisites
- Google Chrome/Chromium (Version 93+)
- JobSprint AI account and API credentials

### Setup Steps

1. **Clone or download the extension files**
   ```bash
   cd jobsprint-extension
   ```

2. **Generate extension icons** (if not present)
   See `icons/README.md` for icon generation instructions

3. **Load the extension in Chrome**
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `jobsprint-extension` directory

4. **Configure API endpoint**
   - The extension uses `http://localhost:3000/api` by default
   - Update in `popup.js` and `background.js` if your API runs on a different URL

## File Structure

```
jobsprint-extension/
├── manifest.json           # Extension configuration
├── popup.html             # UI for extension popup
├── popup.js               # Popup interaction logic
├── background.js          # Background service worker
├── content.js             # Content script for web pages
├── icons/                 # Extension icons (3 sizes)
├── sites/                 # Platform-specific extraction scripts
│   ├── naukri.js
│   ├── linkedin.js
│   ├── indeed.js
│   ├── shine.js
│   ├── foundit.js
│   ├── freshersworld.js
│   ├── internshala.js
│   ├── timesjobs.js
│   ├── hirist.js
│   └── apna.js
└── README.md              # This file
```

## Usage

### Track a Job Application

1. **Navigate to any supported job portal**
2. **Open the job listing page**
3. **Click the JobSprint AI extension icon** in your toolbar
4. **Extension automatically detects:**
   - Job Title
   - Company Name
   - Job Platform
   - Current URL

5. **Click "📌 Track Application"** to save to your JobSprint AI account

### Generate a Cover Letter

1. **On a job listing page**, click the extension icon
2. **Click "✨ Generate Cover Letter"**
3. **Wait for AI to generate** (uses your profile & resume)
4. **Review and edit** as needed
5. **Save to your drafts or send**

### View Your Profile

1. **Click the extension icon**
2. **Click "👁️ View Profile"**
3. **Opens your JobSprint AI dashboard** in a new tab

## Configuration

### Update API Endpoint

Edit the `API_BASE_URL` in `popup.js` and `background.js`:

```javascript
const API_BASE_URL = 'http://localhost:3000/api'; // Change this
```

### Modify Supported Portals

To add a new job portal:

1. **Create a new file** in `sites/` (e.g., `sites/newportal.js`)
2. **Implement extraction logic** for that platform
3. **Update `manifest.json`** with the domain and host_permissions
4. **Update `content.js`** to call the new extractor

## API Integration

The extension communicates with the JobSprint AI backend using these endpoints:

### Track Application
```
POST /api/tracker
Body: {
  jobTitle: string,
  company: string,
  platform: string,
  appliedDate: ISO date string,
  url: string
}
```

### Generate Cover Letter
```
POST /api/cover-letter
Body: {
  jobTitle: string,
  company: string
}
Response: {
  coverLetter: string
}
```

## Security & Privacy

- ✅ No data is stored locally without your consent
- ✅ All communications are encrypted
- ✅ Your resume is never shared with job portals
- ✅ Extension only runs on whitelisted job portals
- ✅ Open-source code (view anytime)

## Troubleshooting

### Extension not detecting job info?
- Ensure you're on a supported job portal
- Check if the page has fully loaded
- Try refreshing the page

### API connection errors?
- Verify `API_BASE_URL` in popup.js
- Ensure JobSprint AI backend is running
- Check browser console (F12) for error messages

### Application not tracking?
- Check your JobSprint AI account is active
- Verify API credentials are correct
- Check browser permissions for the site

## Development

### Enable Debug Logging

In `background.js`, uncomment or add:
```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message received:', request); // Add this
    // ... rest of handler
});
```

### View Console Logs
- Background: Open `chrome://extensions` → Click "background page"
- Popup: Right-click popup → Inspect
- Content: Open DevTools (F12) on the job portal website

## Contributing

To improve the extension:

1. **Test on all supported portals**
2. **Report bugs** with platform and steps to reproduce
3. **Suggest new platforms** to support
4. **Improve extraction logic** for better accuracy

## License

This extension is part of the JobSprint AI project © 2024

## Support

- 📧 Email: support@jobsprint.com
- 💬 Chat: Available in JobSprint AI app
- 🐛 Report Issues: Through JobSprint dashboard

---

**Happy job hunting! 🚀**
