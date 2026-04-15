# 🚀 JobSprint AI - Complete Project Summary

## Executive Overview

**JobSprint AI** is a full-stack web application that automates job application tracking and optimization for job seekers. It combines AI-powered resume customization, automated job application tracking, browser extensions for job portals, and a subscription-based billing model.

**Tech Stack**: Next.js 16 (React 19) + TypeScript + PostgreSQL (AWS RDS) + AWS S3 + Razorpay + Google Gemini AI

---

## 📋 What We're Building

### Core Problem Solved
Job seekers spend hours:
- Finding relevant jobs across multiple portals
- Applying manually to each job
- Tracking application status
- Customizing cover letters and resumes for each position

### JobSprint AI Solution
- **AI Resume Customization**: Generate tailored resumes for each job using Google Gemini AI
- **Cover Letter Generation**: Create personalized cover letters matching job descriptions
- **Application Tracking**: Central dashboard to track all job applications and their status
- **Multi-Portal Integration**: Browser extension to capture jobs from LinkedIn, Naukri, Indeed, etc.
- **Automated Workflow**: (Future) Auto-apply feature with customized materials
- **Subscription Model**: Free tier, trial, and paid plans (Basic/Pro/Elite) via Razorpay

---

## 🏗️ Project Architecture

```
JobSprint AI/
├── jobsprint/              # Main Next.js web application
├── jobsprint-extension/    # Chrome extension for job portal scraping
├── package.json            # Root dependencies (manages mono-repo)
└── .env.local              # Environment configuration (secrets)
```

### Two Main Components

#### 1️⃣ **Web Application** (`jobsprint/`)
- User authentication & profiles
- Job application dashboard
- Resume/cover letter generation
- Settings & preferences management
- Billing & subscription management
- API routes for all backend logic

#### 2️⃣ **Browser Extension** (`jobsprint-extension/`)
- Detects job postings on 10+ job sites
- Extracts job details (title, company, URL, salary, etc.)
- Captures job info to send to web app
- Runs in background to monitor job portal sites
- Currently supports: LinkedIn, Naukri, Indeed, Freshersworld, Internshala, Hirist, Apna, Foundrit, Shine, TimesjJobs

---

## 🗂️ Detailed File Structure Breakdown

### WEB APPLICATION (`jobsprint/`)

#### **Root Configuration Files**
```
package.json           # Dependencies, scripts, version mgmt
tsconfig.json          # TypeScript configuration
tailwindcss config     # Tailwind CSS styling framework
eslint config          # Code quality rules
next.config.ts         # Next.js settings
.env.local             # Secrets & API keys (NOT in git)
```

#### **Source Code** (`src/`)

##### **Authentication Routes** (`src/app/(auth)/`)
```
login/          # Login page & logic
signup/         # Registration page & logic
```
- Users can create accounts with email/password
- JWT tokens for session management
- NextAuth integration for session management

##### **Dashboard Routes** (`src/app/(dashboard)/`)
```
dashboard/      # Main dashboard overview
├─ Stats cards showing application counts
├─ Recent activity feed
└─ Quick action buttons

billing/        # Subscription & payment management
├─ Current plan display
├─ Upgrade/downgrade options
└─ Payment history

profile/        # User profile & resume management
├─ Personal info (name, phone, location)
├─ LinkedIn/portfolio links
├─ Work experience (years, salary, skills)
├─ Education details
├─ Resume upload & storage
└─ Career goals

settings/       # User preferences
├─ Auto-apply settings
├─ Application limits
├─ Email notification preferences
└─ Salary filter settings

resume/         # Resume management & customization
├─ Resume upload
├─ Resume text extraction
└─ AI-powered resume tailoring per job

tracker/        # Job application tracking
├─ Application status pipeline
├─ Filter by status (applied, interview, rejected, etc.)
└─ Add notes to applications
```

##### **API Routes** (`src/app/api/`)
```
auth/                  # Authentication endpoints
├─ POST /auth → Login/Register

profile/               # Profile management
├─ GET /profile → Fetch user profile
├─ POST /profile → Update profile

answer-question/       # AI-powered job matching
├─ POST → Analyze job description against user profile

cover-letter/          # AI cover letter generation
├─ POST → Generate customized cover letter

extract-resume/        # Resume parsing
├─ POST → Extract text from uploaded PDF

tracker/               # Application tracking
├─ GET /tracker → List all applications
├─ POST /tracker → Add new application
├─ PUT /tracker/:id → Update application status

billing/               # Payment & subscription
├─ POST /billing → Initiate Razorpay payment
├─ webhook → Handle payment completion

trial/                 # Trial activation
├─ POST /trial → Activate free trial
```

##### **React Components** (`src/components/`)
```
layout/
├─ Navbar.tsx          # Top navigation bar
├─ Sidebar.tsx         # Left sidebar navigation
└─ DashboardLayout.tsx # Wrapper for dashboard pages

dashboard/
├─ StatsCard.tsx       # Display key metrics (applied, interviews, etc.)
├─ ApplicationTable.tsx # List of all job applications
├─ RecentActivity.tsx  # Recent actions/updates
└─ ResumeUpload.tsx    # Drag-drop resume uploader

profile/
├─ ProfileForm.tsx     # Edit personal info
├─ ResumeUpload.tsx    # Resume storage management
└─ SkillsInput.tsx     # Manage skills (add/remove)

billing/
├─ PricingCard.tsx     # Display pricing tiers
├─ PlanBadge.tsx       # Show current plan badge
└─ TrialBanner.tsx     # Trial activation banner

ui/ (Reusable Components)
├─ Button.tsx          # Standard button
├─ Input.tsx           # Text input field
├─ Card.tsx            # Card container
├─ Badge.tsx           # Status/tag badge
└─ Modal.tsx           # Popup dialog
```

##### **Custom Hooks** (`src/hooks/`)
```
useUser.ts             # Get current logged-in user
useProfile.ts          # Fetch & update user profile
useApplications.ts     # Manage job applications
usePlan.ts             # Get subscription plan info
```

##### **Utility Libraries** (`src/lib/`)
```
db.ts                  # PostgreSQL connection (pg client)
gemini.ts              # Google Gemini AI integration
pdf-parser.ts          # Extract text from resume PDFs
razorpay.ts            # Payment processing
client-auth.ts         # Client-side auth utilities
utils.ts               # Helper functions
```

##### **TypeScript Types** (`src/types/`)
```
index.ts               # All TypeScript interfaces
├─ User               # User account
├─ Profile            # User professional profile
├─ Application        # Job application record
├─ Plan               # Subscription plan info
├─ ApplicationStatus  # Enum: applied, interview, rejected, offered
├─ WorkMode           # Enum: remote, hybrid, onsite
├─ JobType            # Enum: fulltime, parttime, internship
└─ Plan               # Enum: free, trial, basic, pro, elite
```

---

### BROWSER EXTENSION (`jobsprint-extension/`)

```
manifest.json          # Extension configuration & permissions
popup.html             # UI when user clicks extension icon
popup.js               # Popup interaction logic

content.js             # Script injected into job portal pages
background.js          # Background worker for async tasks

sites/                 # Job portal detectors (one per site)
├─ linkedin.js         # LinkedIn job scraper
├─ naukri.js           # Naukri job scraper
├─ indeed.js           # Indeed job scraper
├─ freshersworld.js    # Freshersworld job scraper
├─ internshala.js      # Internshala job scraper
├─ hirist.js           # Hirist job scraper
├─ apna.js             # Apna job scraper
├─ foundit.js          # Foundit job scraper
├─ shine.js            # Shine job scraper
└─ timesjobs.js        # TimesjJobs job scraper

icons/                 # Extension icons (16x16, 48x48, 128x128)
```

**How It Works:**
1. User visits a job portal (LinkedIn, Naukri, etc.)
2. Content script runs and detects job listing page
3. Site-specific detector extracts job details (title, company, salary, URL)
4. User clicks extension icon → popup shows detected job
5. Click "Save Job" → data sent to backend
6. Backend creates new application entry in database

---

## 🗄️ Database Schema (AWS RDS PostgreSQL)

### Tables Explained

#### **users**
```sql
id (UUID)              # Auto-generated unique ID
email (VARCHAR)        # Unique email login
password (VARCHAR)     # Hashed password (bcryptjs)
full_name (VARCHAR)    # Display name
phone (VARCHAR)        # Contact number
created_at (TIMESTAMP) # Account creation date
```
**Purpose**: User authentication & account management

#### **profiles**
```sql
id (UUID)              # Unique profile ID
user_id (UUID)         # Link to users table
full_name, email, phone, location
linkedin_url, portfolio_url
current_job_title, current_company, total_experience_years
notice_period_days, current_salary
expected_salary_min/max
preferred_roles, preferred_cities, preferred_industries
work_mode (remote/hybrid/onsite/any)
job_type (fulltime/parttime/internship/contract)
skills (array of strings)
highest_qualification, college_name, graduation_year
about_me, career_goals (text fields)
resume_url (S3 link)
resume_text (extracted from PDF)
created_at, updated_at
```
**Purpose**: Professional resume data, job preferences, AI matching

#### **applications**
```sql
id (UUID)              # Application ID
user_id (UUID)         # Which user applied
job_title, company_name
job_site (source portal: linkedin, naukri, etc.)
job_url (original job posting link)
location, salary_range
status (applied/assessment/interview/rejected/offered)
applied_at (TIMESTAMP)
notes (user notes)
cover_letter (generated cover letter)
```
**Purpose**: Track job applications & pipeline status

#### **blacklist**
```sql
id (UUID)
user_id (UUID)
company_name
created_at
```
**Purpose**: Companies user doesn't want to apply to

#### **plans**
```sql
id (UUID)
user_id (UUID)
plan (free/trial/basic/pro/elite)
trial_starts_at, trial_ends_at
subscription_starts_at, subscription_ends_at
razorpay_subscription_id (Razorpay ID for recurring billing)
is_active (boolean)
created_at
```
**Purpose**: Subscription management

#### **settings**
```sql
id (UUID)
user_id (UUID)
max_apps_per_day (limit: 50)
auto_apply (boolean)
skip_already_applied (boolean)
min_salary_lpa (minimum salary filter)
email_report (send daily email)
email_time (e.g., "20:00")
created_at
```
**Purpose**: User preferences & automation rules

---

## ⚙️ Technology Stack Detailed

### Frontend
- **Next.js 16** - React framework with SSR, API routes, file-based routing
- **React 19** - UI library with hooks
- **TypeScript** - Type safety for JavaScript
- **Tailwind CSS 4** - Utility-first CSS framework
- **Framer Motion** - Smooth animations
- **Lucide React** - Icon components
- **Recharts** - Chart/graph components
- **React Dropzone** - File upload components
- **Radix UI** - Accessible component primitives

### Backend
- **Next.js API Routes** - Serverless functions (runs on Vercel or Node.js)
- **Node.js** - JavaScript runtime
- **PostgreSQL** - SQL database (AWS RDS)
- **pg** - PostgreSQL client for Node.js

### Authentication & Security
- **NextAuth.js** - Session management & OAuth
- **JWT (jsonwebtoken)** - Token-based auth
- **bcryptjs** - Password hashing
- **NEXTAUTH_SECRET** - Session encryption key

### AI & Automation
- **Google Gemini API** - AI for resume customization & cover letters
- **PDF.js** - Extract text from PDF resumes
- **Mammoth** - Extract text from Word documents

### File Storage & Emails
- **AWS S3** - Resume & document storage
- **AWS SES** - Send transactional emails
- **AWS SDK** - Node.js integration

### Payments
- **Razorpay** - Payment gateway (credit card, UPI, wallets)
- **Razorpay SDK** - Subscriptions & recurring billing

---

## 🔑 Environment Configuration (`.env.local`)

```bash
# DATABASE - AWS RDS PostgreSQL Connection
DATABASE_URL=postgresql://jobsprint_admin:PASSWORD@jobsprint-db.cvye0ki64cgy.ap-south-1.rds.amazonaws.com:5432/jobsprint

# AWS CREDENTIALS (IAM User with S3 & SES permissions)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-south-1
AWS_S3_BUCKET=jobsprint-resumes  # Stores user resumes
AWS_SES_FROM_EMAIL=officialjobsprintai@gmail.com

# AUTHENTICATION
NEXTAUTH_SECRET=super_long_random_key_32plus_chars
NEXTAUTH_URL=http://localhost:3000  # Changes on production

# AI
NEXT_PRIVATE_GEMINI_API_KEY=AIzaSyB...  # Google AI API

# PAYMENTS
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_PLAN_BASIC=plan_xxxxx
RAZORPAY_PLAN_PRO=plan_xxxxx
RAZORPAY_PLAN_ELITE=plan_xxxxx
```

---

## ✨ Current Features Implemented

### ✅ Core Features (Done)
- [x] User registration & login with email
- [x] JWT-based authentication
- [x] User profile management (professional info, resume)
- [x] Resume upload & PDF text extraction
- [x] Job application tracking (CRUD operations)
- [x] Application status pipeline (applied → interview → offered)
- [x] Database schema with PostgreSQL
- [x] AWS S3 integration for resume storage
- [x] AWS SES for email notifications
- [x] Razorpay payment integration
- [x] Subscription plan management (Free/Trial/Basic/Pro/Elite)
- [x] Browser extension framework for job portal detection
- [x] Site-specific scrapers for 10+ job portals
- [x] UI components for dashboard, profile, billing

### 🔄 In Progress / Planned
- [ ] AI resume customization per job
- [ ] AI cover letter generation
- [ ] Automated job matching (question answering)
- [ ] Auto-apply feature with customized materials
- [ ] Email reports & notifications
- [ ] Advanced filters & search
- [ ] User analytics dashboard
- [ ] Production deployment

---

## 📦 Dependencies Summary

### Main Dependencies
```json
{
  "next": "16.2.2",              // React framework
  "react": "19.2.4",             // UI library
  "typescript": "^5",            // Type checking
  "@supabase/supabase-js": "^2", // (Migrating away)
  
  // Database & Auth
  "pg": "^8.20.0",               // PostgreSQL client
  "bcryptjs": "^3.0.3",          // Password hashing
  "jsonwebtoken": "^9.0.3",      // JWT tokens
  
  // AWS
  "@aws-sdk/client-s3": "^3",    // S3 file storage
  "@aws-sdk/client-ses": "^3",   // Email sending
  
  // AI & File Parsing
  "pdfjs-dist": "^5.6.205",      // Extract PDF text
  "mammoth": "^1.12.0",          // Extract Word text
  
  // Payments
  "razorpay": "^2.9.6",          // Payment gateway
  
  // UI & Styling
  "tailwindcss": "^4",           // CSS framework
  "framer-motion": "^12.38.0",   // Animations
  "lucide-react": "^1.7.0",      // Icons
  "@radix-ui/react-dialog": "^1" // Accessible modals
}
```

---

## 🚀 How to Run Locally

```bash
# 1. Navigate to project
cd d:\Job\ Sprint\ AI\jobsprint

# 2. Install dependencies
npm install

# 3. Setup environment
# Create .env.local with AWS credentials (see AWS_MIGRATION_GUIDE.md)

# 4. Setup database
# Follow AWS_MIGRATION_GUIDE.md to create RDS & run schema

# 5. Run development server
npm run dev

# 6. Open browser
# http://localhost:3000
```

**Build for production:**
```bash
npm run build
npm start
```

---

## 📝 Key Workflows

### User Journey
1. User visits website
2. Clicks "Sign Up"
3. Creates account (email + password)
4. Fills profile (resume, experience, skills)
5. Uploads resume PDF
6. Installs browser extension
7. Visits job portal (LinkedIn, Naukri)
8. Clicks extension → detects available jobs
9. Saves job → creates application entry
10. AI customizes resume for job
11. Generates cover letter
12. User applies with customized materials

### Extension Flow
1. Extension detects page is a job portal
2. Extracts job data using site-specific scrapers
3. Shows popup with job details
4. User clicks "Save Job"
5. Post request sent to backend API
6. Backend stores in applications table
7. Data now visible in dashboard

### AI Integration
1. User triggers resume customization for a job
2. Backend calls Gemini API with:
   - Original resume text
   - Job description
   - User preferences
3. Gemini returns customized resume
4. Backend stores & displays in UI
5. User can download or auto-apply

---

## 🔒 Security Considerations

- Passwords hashed with bcryptjs (never stored plain)
- JWT tokens expire after set time
- AWS credentials never exposed in frontend (only in .env)
- Database credentials in environment variables
- CORS policies & API validation
- Resume files stored privately in S3 (user-specific access)
- Environment variables don't get committed to git

---

## 📊 Scalability Notes

- Next.js deployed on Vercel = auto-scaling serverless
- PostgreSQL (RDS) handles concurrent connections
- S3 for unlimited file storage
- SES for high-volume email at scale
- Razorpay handles payment webhooks asynchronously

---

## 🎯 Next Steps to Complete Project

1. **Implement AI Features**
   - Integrate Gemini for resume tailoring
   - Implement cover letter generation
   - Add job-candidate matching (question answering)

2. **Auto-Apply Workflow**
   - Auto-fill application forms
   - Submit with customized materials

3. **Email Notifications**
   - Daily application reports
   - Interview reminders
   - New job recommendations

4. **Deployment**
   - Deploy to Vercel (frontend)
   - Setup GitHub Actions CI/CD
   - Configure RDS backups
   - Setup monitoring & logging

5. **Polish & Testing**
   - E2E testing with Cypress
   - Unit tests for components
   - Security audit
   - Performance optimization

---

## 📚 Documentation Files
- `AWS_MIGRATION_GUIDE.md` - Setup AWS infrastructure
- `AWS_RDS_SCHEMA.sql` - Database schema
- `README.md` - Next.js basic setup
- `.env.local` - Environment secrets (keep confidential)
