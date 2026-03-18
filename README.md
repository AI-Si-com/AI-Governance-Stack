# AI-Si Policy Suite

**62 Policies. One App. 12 Weeks to Governance.**

A complete web application that takes organisations from questionnaire to 62 fully customised policy documents (PDF & DOCX) in under 30 seconds.

---

## What It Builds

| Category | Count | Documents |
|---|---|---|
| Corporate Governance | 5 | GOV-001 to GOV-005 |
| Finance | 5 | FIN-001 to FIN-005 |
| Information Security | 5 | ISMS-001 to ISMS-005 |
| Human Resources | 10 | HR-001 to HR-010 |
| Health & Safety | 5 | HS-001 to HS-005 |
| Data & GDPR | 5 | DG-001 to DG-005 |
| IT & Digital | 5 | IT-001 to IT-005 |
| Compliance | 5 | COMP-001 to COMP-005 |
| AI Governance | 17 | AISI-* (conditional on AI tool use) |
| **Total** | **62** | |

---

## Project Structure

```
ai-si-policy-suite/
├── public/
│   └── index.html          ← Frontend (single file, embed in WordPress)
├── server/
│   ├── templates/          ← 62 policy template .txt files
│   ├── temp/               ← Generated documents (auto-cleaned every 24h)
│   └── sessions.json       ← Saved sessions (auto-generated)
├── server.js               ← Backend (Node.js/Express)
├── package.json
├── .env                    ← Your config (never commit this)
├── .env.example            ← Template for .env
└── README.md
```

---

## Quick Start (Local)

### Prerequisites
- Node.js 18+ ([nodejs.org](https://nodejs.org))
- npm 9+

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
# Generate a secure encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Edit .env with your values
# Set ENCRYPTION_KEY to the output above
```

### 3. Start the Server

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

### 4. Open the App

Visit: `http://localhost:3000`

The frontend (`public/index.html`) is served automatically.

---

## Deployment

### Option A: Replit (Recommended – Free)

1. Create a Replit account at [replit.com](https://replit.com)
2. Click **Create Repl** → **Import from GitHub** (or upload files)
3. Set environment variables in Replit's **Secrets** panel:
   - `PORT` = `3000`
   - `ENCRYPTION_KEY` = your 64-char hex key
   - `FRONTEND_URL` = your Replit URL
4. Click **Run** – your backend is live at `https://[username].replit.dev`
5. Update `BACKEND_URL` in `public/index.html`:
   ```html
   <script>window.BACKEND_URL = 'https://[username].replit.dev';</script>
   ```
   Or add before the closing `</body>` tag.

### Option B: Railway

1. Push code to GitHub
2. Connect GitHub repo to [railway.app](https://railway.app)
3. Add environment variables in Railway dashboard
4. Deploy – Railway auto-detects Node.js

### Option C: Vercel (Serverless)

Requires restructuring as serverless functions. Not recommended for this app due to document generation requirements.

---

## WordPress Integration

### Method 1: iFrame Embed

Add a custom HTML block to any WordPress page:

```html
<iframe
  src="https://your-frontend-url.com"
  width="100%"
  height="1200"
  frameborder="0"
  style="border:none;min-height:1200px"
></iframe>
```

### Method 2: Direct HTML Embed

1. Copy the contents of `public/index.html`
2. In WordPress, add a **Custom HTML** block
3. Paste the HTML directly
4. Update `BACKEND_URL` to point to your deployed backend

### Method 3: Same-Server Hosting

If your WordPress server runs Node.js:
1. Deploy backend on port 3001
2. Configure Nginx to proxy `/api/` to port 3001
3. Serve `index.html` via WordPress on the main domain

---

## Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `production` | Environment mode |
| `PORT` | `3000` | Server port |
| `FRONTEND_URL` | `http://localhost:3000` | Allowed CORS origin |
| `ENCRYPTION_KEY` | auto-generated | 64-char hex key for AES-256 |
| `SESSION_EXPIRY` | `604800` | Session TTL in seconds (7 days) |
| `FILE_CLEANUP_INTERVAL` | `3600` | Cleanup job interval (seconds) |
| `FILE_EXPIRY` | `86400` | Generated file TTL (seconds, 24h) |
| `MAX_REQUESTS_PER_HOUR` | `10` | Rate limit per IP |
| `MAX_CONCURRENT_GENERATIONS` | `5` | Max simultaneous document jobs |

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/submit-questionnaire` | Submit answers, trigger generation |
| `GET` | `/api/status/:session_id` | Poll generation progress |
| `GET` | `/api/download/:session_id/:format` | Download all as ZIP |
| `GET` | `/api/download/:session_id/:doc_id/:format` | Download single document |
| `POST` | `/api/save-session` | Save in-progress session |
| `GET` | `/api/resume-session/:session_id` | Retrieve saved session |
| `GET` | `/api/health` | Server health check |

---

## Customising Templates

Templates live in `server/templates/` as `.txt` files.

**Placeholder format:** `[PLACEHOLDER_ID]`

**Conditional blocks:**
```
[IF ORG_TYPE == "Public Sector" THEN]
This section applies to public sector organisations...
[END IF]
```

**Available placeholders:** See the full list in `server.js` → `DOCUMENTS` array and template files.

To add your own template:
1. Create `server/templates/MY-DOC-001.txt`
2. Add entry to `DOCUMENTS` array in `server.js`
3. Add matching entry to `DOCUMENTS` array in `public/index.html`
4. Restart the server

---

## Testing Checklist

### Functional
- [ ] All 61 questions display correctly
- [ ] Auto-save works (close browser, reopen, resume prompt appears)
- [ ] Validation catches missing required fields
- [ ] Logo upload shows thumbnail preview
- [ ] AI Governance section conditionally shows/hides based on AI tool answer
- [ ] Form submits and reaches backend
- [ ] All applicable documents generate
- [ ] PDF downloads open correctly
- [ ] DOCX downloads open in Word
- [ ] ZIP download contains all documents
- [ ] Individual document download works
- [ ] Placeholders replaced in generated documents (spot check 5 docs)
- [ ] Conditional sections apply (Public Sector addendum)

### Performance
- [ ] Frontend loads in < 3 seconds
- [ ] All documents generate in < 30 seconds
- [ ] ZIP creation < 5 seconds

### Security
- [ ] Template files not accessible via frontend URL
- [ ] `/server/templates/` returns 404 from browser
- [ ] Temp files deleted after 24 hours
- [ ] ENCRYPTION_KEY not in frontend code

---

## Troubleshooting

**"Templates loaded: 0"** – Check `server/templates/` folder exists and contains `.txt` files.

**PDF generation fails** – Ensure `pdf-lib` is installed: `npm install pdf-lib`

**DOCX generation fails** – Ensure `docx` is installed: `npm install docx`

**ZIP download fails** – Ensure `archiver` is installed: `npm install archiver`

**CORS errors in browser** – Set `FRONTEND_URL` in `.env` to your exact frontend origin.

**"Session not found"** – Sessions persist in memory only. After server restart, use localStorage resume instead.

---

## Support

Built by [AI-Si.com](https://ai-si.com) – Fractional AI Director services for growing businesses.

For enterprise licensing, white-labelling, or custom policy additions, contact: hello@ai-si.com
