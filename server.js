// ============================================================
// AI-Si Policy Suite – Backend Server
// ============================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');
const archiver = require('archiver');

const app = express();
const PORT = process.env.PORT || 3000;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const TEMPLATES_DIR = path.join(__dirname, 'server', 'templates');
const TEMP_DIR = path.join(__dirname, 'server', 'temp');
const SESSIONS_FILE = path.join(__dirname, 'server', 'sessions.json');

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting store
const rateLimits = {};
function rateLimit(ip) {
  const now = Date.now();
  if (!rateLimits[ip]) rateLimits[ip] = [];
  rateLimits[ip] = rateLimits[ip].filter(t => now - t < 3600000);
  const maxReq = parseInt(process.env.MAX_REQUESTS_PER_HOUR || '10');
  if (rateLimits[ip].length >= maxReq) return false;
  rateLimits[ip].push(now);
  return true;
}

// ============================================================
// IN-MEMORY STATE
// ============================================================
const sessions = {};      // { [session_id]: { section, answers, timestamp } }
const genStatus = {};     // { [session_id]: { completed, total, ready, docs } }
let templates = {};       // { [template_id]: content_string }

// ============================================================
// LOGGING
// ============================================================
function log(sessionId, action, status, extra) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${sessionId || 'SYSTEM'}] [${action}] [${status}]${extra ? ' ' + extra : ''}`);
}

// ============================================================
// STARTUP: LOAD TEMPLATES
// ============================================================
function loadTemplates() {
  if (!fs.existsSync(TEMPLATES_DIR)) {
    log('SYSTEM', 'LOAD_TEMPLATES', 'WARN', 'Templates directory not found: ' + TEMPLATES_DIR);
    return;
  }
  const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.txt'));
  files.forEach(file => {
    const id = file.replace('.txt', '');
    templates[id] = fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf-8');
  });
  log('SYSTEM', 'LOAD_TEMPLATES', 'OK', `Loaded ${Object.keys(templates).length} templates`);
}

// ============================================================
// ENSURE DIRECTORIES
// ============================================================
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ============================================================
// PLACEHOLDER REPLACEMENT
// ============================================================
function replacePlaceholders(content, answers) {
  let result = content;

  // Standard placeholder replacement: [PLACEHOLDER_ID]
  const allPlaceholders = content.match(/\[([A-Z0-9_]+)\]/g) || [];
  allPlaceholders.forEach(ph => {
    const key = ph.slice(1, -1);
    if (answers[key] !== undefined) {
      result = result.split(ph).join(answers[key] || '');
    }
  });

  // Conditional blocks: [IF field == "value" THEN] ... [END IF]
  result = processConditionals(result, answers);

  // Auto-fill current date
  result = result.split('[CURRENT_DATE]').join(new Date().toLocaleDateString('en-GB'));

  return result;
}

function processConditionals(content, answers) {
  // Match [IF FIELD == "VALUE" THEN] ... [END IF]
  const ifPattern = /\[IF\s+(\w+)\s*==\s*"([^"]+)"\s+THEN\]([\s\S]*?)\[END IF\]/g;
  return content.replace(ifPattern, (match, field, value, body) => {
    const fieldVal = (answers[field] || '').toLowerCase();
    const checkVal = value.toLowerCase();
    return fieldVal.includes(checkVal) ? body.trim() : '';
  });
}

// ============================================================
// CONDITIONAL: INCLUDE/EXCLUDE DOCUMENTS
// ============================================================
function shouldIncludeDocument(docId, answers) {
  const aiActive = ['Yes – Actively Using', 'Yes – Piloting / Testing'];
  // AI governance docs only for orgs using AI
  if (docId.startsWith('AISI-')) {
    return aiActive.includes(answers.AI_TOOLS_IN_USE || '');
  }
  return true;
}

// ============================================================
// PDF GENERATION
// ============================================================
async function generatePDF(content, docId, docName, answers) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  const pageWidth = 595;
  const pageHeight = 842;
  const contentWidth = pageWidth - margin * 2;
  const fontSize = 10;
  const lineHeight = 15;
  const titleFontSize = 14;
  const sectionFontSize = 12;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Header bar
  page.drawRectangle({ x: 0, y: pageHeight - 40, width: pageWidth, height: 40, color: rgb(0.1, 0.14, 0.49) });

  // Logo placeholder / org name in header
  const orgName = (answers.ORG_NAME || 'Organisation').substring(0, 30);
  page.drawText(orgName, { x: margin, y: pageHeight - 26, size: 11, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText('AI-Si Policy Suite', { x: pageWidth - margin - 90, y: pageHeight - 26, size: 9, font, color: rgb(0.8, 0.85, 1) });

  y = pageHeight - 70;

  // Embed logo if provided
  if (answers.ORG_LOGO && answers.ORG_LOGO.startsWith('data:image')) {
    try {
      const base64Data = answers.ORG_LOGO.split(',')[1];
      const imgBytes = Buffer.from(base64Data, 'base64');
      const isJpg = answers.ORG_LOGO.includes('jpeg') || answers.ORG_LOGO.includes('jpg');
      const img = isJpg ? await pdfDoc.embedJpg(imgBytes) : await pdfDoc.embedPng(imgBytes);
      const dims = img.scaleToFit(80, 40);
      page.drawImage(img, { x: pageWidth - margin - dims.width, y: pageHeight - 45 - dims.height, width: dims.width, height: dims.height });
    } catch (e) { /* logo embed failed, continue */ }
  }

  function addText(text, opts = {}) {
    const fnt = opts.bold ? boldFont : font;
    const sz = opts.size || fontSize;
    const clr = opts.color || rgb(0.1, 0.1, 0.1);
    const words = text.split(' ');
    let line = '';
    const lines = [];
    words.forEach(word => {
      const test = line ? line + ' ' + word : word;
      const w = fnt.widthOfTextAtSize(test, sz);
      if (w > contentWidth) { lines.push(line); line = word; }
      else line = test;
    });
    if (line) lines.push(line);
    lines.forEach(l => {
      if (y < margin + 40) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        // Repeat header
        page.drawRectangle({ x: 0, y: pageHeight - 40, width: pageWidth, height: 40, color: rgb(0.1, 0.14, 0.49) });
        page.drawText(orgName, { x: margin, y: pageHeight - 26, size: 11, font: boldFont, color: rgb(1,1,1) });
        page.drawText('AI-Si Policy Suite', { x: pageWidth - margin - 90, y: pageHeight - 26, size: 9, font, color: rgb(0.8,0.85,1) });
        y = pageHeight - 60;
      }
      page.drawText(l || '', { x: margin, y, size: sz, font: fnt, color: clr });
      y -= lineHeight * (sz / 10);
    });
  }

  // Footer
  function addFooter(p, pageNum) {
    p.drawLine({ start: { x: margin, y: 30 }, end: { x: pageWidth - margin, y: 30 }, thickness: 0.5, color: rgb(0.8,0.8,0.8) });
    p.drawText(`${docId} – ${docName}`, { x: margin, y: 18, size: 8, font, color: rgb(0.5,0.5,0.5) });
    p.drawText(`Page ${pageNum}`, { x: pageWidth - margin - 30, y: 18, size: 8, font, color: rgb(0.5,0.5,0.5) });
  }

  // Process content lines
  const lines = content.split('\n');
  lines.forEach(rawLine => {
    const line = rawLine.trimEnd();
    if (!line) { y -= lineHeight * 0.5; return; }
    if (line.startsWith('# ')) { addText(line.slice(2), { bold: true, size: titleFontSize, color: rgb(0.1,0.14,0.49) }); y -= 4; }
    else if (line.startsWith('## ')) { addText(line.slice(3), { bold: true, size: sectionFontSize, color: rgb(0.15,0.2,0.6) }); y -= 3; }
    else if (line.startsWith('### ')) { addText(line.slice(4), { bold: true, size: 11, color: rgb(0.2,0.2,0.2) }); }
    else if (line.startsWith('- ') || line.startsWith('* ')) { addText('  • ' + line.slice(2)); }
    else { addText(line); }
  });

  // Add footers
  const pages = pdfDoc.getPages();
  pages.forEach((p, i) => addFooter(p, i + 1));

  return await pdfDoc.save();
}

// ============================================================
// DOCX GENERATION
// ============================================================
async function generateDOCX(content, docId, docName, answers) {
  const children = [];
  const orgName = answers.ORG_NAME || 'Organisation';

  // Header paragraph
  children.push(new Paragraph({
    text: orgName + ' – ' + docName,
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.LEFT,
  }));
  children.push(new Paragraph({ text: docId, style: 'Normal' }));
  children.push(new Paragraph({ text: '' }));

  const lines = content.split('\n');
  lines.forEach(rawLine => {
    const line = rawLine.trimEnd();
    if (!line) { children.push(new Paragraph({ text: '' })); return; }
    if (line.startsWith('# ')) {
      children.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }));
    } else if (line.startsWith('## ')) {
      children.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
    } else if (line.startsWith('### ')) {
      children.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }));
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      children.push(new Paragraph({ text: line.slice(2), bullet: { level: 0 } }));
    } else {
      children.push(new Paragraph({ children: [new TextRun({ text: line })] }));
    }
  });

  const doc = new Document({
    creator: 'AI-Si Policy Suite',
    title: docName,
    description: docId,
    sections: [{ properties: {}, children }]
  });

  return await Packer.toBuffer(doc);
}

// ============================================================
// DOCUMENT CATALOGUE
// ============================================================
const DOCUMENTS = [
  { id:'CORP-GOV-001', name:'Corporate Governance & Organisational Structure', cat:'Corporate Governance' },
  { id:'CORP-GOV-002', name:'Delegation of Authority Policy', cat:'Corporate Governance' },
  { id:'CORP-GOV-003', name:'Conflicts of Interest Policy', cat:'Corporate Governance' },
  { id:'CORP-GOV-004', name:'Whistleblowing Policy', cat:'Corporate Governance' },
  { id:'CORP-GOV-005', name:'Code of Conduct & Business Ethics', cat:'Corporate Governance' },
  { id:'CORP-FIN-001', name:'Financial Management Policy', cat:'Finance' },
  { id:'CORP-FIN-002', name:'Expense Claims Policy', cat:'Finance' },
  { id:'CORP-FIN-003', name:'Procurement & Purchasing Policy', cat:'Finance' },
  { id:'CORP-FIN-004', name:'Fraud Prevention Policy', cat:'Finance' },
  { id:'CORP-FIN-005', name:'Budget Management Policy', cat:'Finance' },
  { id:'CORP-ISMS-001', name:'Information Security Management Policy', cat:'Information Security' },
  { id:'CORP-ISMS-002', name:'Access Control Policy', cat:'Information Security' },
  { id:'CORP-ISMS-003', name:'Data Classification Policy', cat:'Information Security' },
  { id:'CORP-ISMS-004', name:'Security Incident Response Policy', cat:'Information Security' },
  { id:'CORP-ISMS-005', name:'Business Continuity & Disaster Recovery', cat:'Information Security' },
  { id:'CORP-HR-001', name:'Recruitment & Selection Policy', cat:'Human Resources' },
  { id:'CORP-HR-002', name:'Equal Opportunities Policy', cat:'Human Resources' },
  { id:'CORP-HR-003', name:'Anti-Harassment & Bullying Policy', cat:'Human Resources' },
  { id:'CORP-HR-004', name:'Disciplinary Procedure', cat:'Human Resources' },
  { id:'CORP-HR-005', name:'Grievance Procedure', cat:'Human Resources' },
  { id:'CORP-HR-006', name:'Performance Management Policy', cat:'Human Resources' },
  { id:'CORP-HR-007', name:'Training & Development Policy', cat:'Human Resources' },
  { id:'CORP-HR-008', name:'Flexible & Remote Working Policy', cat:'Human Resources' },
  { id:'CORP-HR-009', name:'Leave Management Policy', cat:'Human Resources' },
  { id:'CORP-HR-010', name:'Redundancy & Restructuring Policy', cat:'Human Resources' },
  { id:'CORP-HS-001', name:'Health & Safety Policy', cat:'Health & Safety' },
  { id:'CORP-HS-002', name:'Risk Assessment Policy', cat:'Health & Safety' },
  { id:'CORP-HS-003', name:'Fire Safety Policy', cat:'Health & Safety' },
  { id:'CORP-HS-004', name:'First Aid Policy', cat:'Health & Safety' },
  { id:'CORP-HS-005', name:'Mental Health & Wellbeing Policy', cat:'Health & Safety' },
  { id:'CORP-DG-001', name:'Data Protection Policy', cat:'Data & GDPR' },
  { id:'CORP-DG-002', name:'Privacy Notice (Staff)', cat:'Data & GDPR' },
  { id:'CORP-DG-003', name:'Data Retention & Disposal Policy', cat:'Data & GDPR' },
  { id:'CORP-DG-004', name:'Subject Access Request Procedure', cat:'Data & GDPR' },
  { id:'CORP-DG-005', name:'Data Breach Response Policy', cat:'Data & GDPR' },
  { id:'CORP-IT-001', name:'IT Acceptable Use Policy', cat:'IT & Digital' },
  { id:'CORP-IT-002', name:'Password & Authentication Policy', cat:'IT & Digital' },
  { id:'CORP-IT-003', name:'Remote Working Security Policy', cat:'IT & Digital' },
  { id:'CORP-IT-004', name:'BYOD (Bring Your Own Device) Policy', cat:'IT & Digital' },
  { id:'CORP-IT-005', name:'Email & Communications Policy', cat:'IT & Digital' },
  { id:'CORP-COMP-001', name:'Regulatory Compliance Policy', cat:'Compliance' },
  { id:'CORP-COMP-002', name:'Anti-Bribery & Corruption Policy', cat:'Compliance' },
  { id:'CORP-COMP-003', name:'Modern Slavery Statement', cat:'Compliance' },
  { id:'CORP-COMP-004', name:'Environmental & Sustainability Policy', cat:'Compliance' },
  { id:'CORP-COMP-005', name:'Complaints Handling Policy', cat:'Compliance' },
  { id:'AISI-GOV-001', name:'AI Governance Framework', cat:'AI Governance' },
  { id:'AISI-GOV-002', name:'AI Ethics Policy', cat:'AI Governance' },
  { id:'AISI-GOV-003', name:'AI Risk Management Policy', cat:'AI Governance' },
  { id:'AISI-GOV-004', name:'AI Procurement & Approval Policy', cat:'AI Governance' },
  { id:'AISI-GOV-005', name:'AI Acceptable Use Policy', cat:'AI Governance' },
  { id:'AISI-DATA-001', name:'AI Data Management Policy', cat:'AI Governance' },
  { id:'AISI-DATA-002', name:'AI Training Data Policy', cat:'AI Governance' },
  { id:'AISI-BIAS-001', name:'AI Bias & Fairness Policy', cat:'AI Governance' },
  { id:'AISI-TRANS-001', name:'AI Transparency & Explainability Policy', cat:'AI Governance' },
  { id:'AISI-PRIV-001', name:'AI & Privacy Policy', cat:'AI Governance' },
  { id:'AISI-INC-001', name:'AI Incident Response Policy', cat:'AI Governance' },
  { id:'AISI-AUDIT-001', name:'AI Auditing & Monitoring Policy', cat:'AI Governance' },
  { id:'AISI-THIRD-001', name:'AI Third-Party Management Policy', cat:'AI Governance' },
  { id:'AISI-HUMAN-001', name:'Human Oversight of AI Policy', cat:'AI Governance' },
  { id:'AISI-COMPL-001', name:'AI Regulatory Compliance Policy', cat:'AI Governance' },
  { id:'AISI-CHANGE-001', name:'AI Change Management Policy', cat:'AI Governance' },
  { id:'AISI-TRAIN-001', name:'AI Staff Training & Awareness Policy', cat:'AI Governance' }
];

// ============================================================
// CONCURRENT GENERATION TRACKER
// ============================================================
let activeGenerations = 0;
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_GENERATIONS || '5');

// ============================================================
// ENDPOINT: POST /api/submit-questionnaire
// ============================================================
app.post('/api/submit-questionnaire', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (!rateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait before trying again.' });
  }
  if (activeGenerations >= MAX_CONCURRENT) {
    return res.status(503).json({ error: 'Server busy. Please try again in a moment.' });
  }

  const { encrypted_answers, iv, session_id, logo_base64 } = req.body;
  if (!session_id) return res.status(400).json({ error: 'session_id required' });

  log(session_id, 'SUBMIT', 'RECEIVED');

  // Decrypt answers
  let answers;
  try {
    answers = decryptAnswers(encrypted_answers, iv);
  } catch (e) {
    log(session_id, 'DECRYPT', 'WARN', 'Falling back to raw decode');
    try { answers = JSON.parse(Buffer.from(encrypted_answers, 'base64').toString('utf-8')); }
    catch { return res.status(400).json({ error: 'Invalid answers payload' }); }
  }

  if (logo_base64) answers.ORG_LOGO = logo_base64;

  log(session_id, 'ANSWERS_PROCESSED', 'OK', Object.keys(answers).length + ' fields');

  // Filter documents by conditional logic
  const docsToGenerate = DOCUMENTS.filter(d => shouldIncludeDocument(d.id, answers));
  const total = docsToGenerate.length;

  genStatus[session_id] = { completed: 0, total, ready: false, docs: {}, errors: [] };

  res.status(202).json({ session_id, status: 'generating', total, eta_seconds: Math.ceil(total * 0.4) });

  // Generate asynchronously
  activeGenerations++;
  generateAllDocuments(session_id, docsToGenerate, answers)
    .finally(() => { activeGenerations--; });
});

// ============================================================
// DOCUMENT GENERATION ORCHESTRATOR
// ============================================================
async function generateAllDocuments(sessionId, docs, answers) {
  const sessionDir = path.join(TEMP_DIR, sessionId);
  ensureDir(sessionDir);
  log(sessionId, 'GENERATION_START', 'OK', `${docs.length} documents`);

  // Process in batches of 5 for memory efficiency
  const batchSize = 5;
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    await Promise.all(batch.map(doc => generateOneDocument(sessionId, doc, answers, sessionDir)));
  }

  genStatus[sessionId].ready = true;
  genStatus[sessionId].completed = docs.length;
  log(sessionId, 'GENERATION_COMPLETE', 'OK', `${docs.length} documents`);
}

async function generateOneDocument(sessionId, doc, answers, sessionDir) {
  let attempts = 0;
  while (attempts < 3) {
    try {
      const templateContent = templates[doc.id] || generateFallbackTemplate(doc, answers);
      const processedContent = replacePlaceholders(templateContent, answers);

      // Generate both PDF and DOCX
      const pdfBytes = await generatePDF(processedContent, doc.id, doc.name, answers);
      const docxBuffer = await generateDOCX(processedContent, doc.id, doc.name, answers);

      fs.writeFileSync(path.join(sessionDir, `${doc.id}.pdf`), pdfBytes);
      fs.writeFileSync(path.join(sessionDir, `${doc.id}.docx`), docxBuffer);

      genStatus[sessionId].completed++;
      genStatus[sessionId].docs[doc.id] = 'ready';
      log(sessionId, 'DOC_GENERATED', 'OK', doc.id);
      return;
    } catch (err) {
      attempts++;
      log(sessionId, 'DOC_ERROR', 'RETRY', `${doc.id} attempt ${attempts}: ${err.message}`);
    }
  }
  genStatus[sessionId].docs[doc.id] = 'failed';
  genStatus[sessionId].errors.push(doc.id);
  log(sessionId, 'DOC_FAILED', 'ERROR', doc.id);
}

// Fallback template if file not found
function generateFallbackTemplate(doc, answers) {
  return `# ${doc.name}

## Document Reference: ${doc.id}

Organisation: [ORG_NAME]
Effective Date: [POLICY_EFFECTIVE_DATE]
Approved By: [POLICY_APPROVAL_AUTHORITY]
Review Date: [ANNUAL_REVIEW_DATE]

---

## 1. Introduction

[ORG_NAME] is committed to maintaining the highest standards in relation to ${doc.name.toLowerCase()}.
This policy applies to all employees, contractors, and stakeholders of [ORG_NAME].

## 2. Scope

This policy applies to all staff employed by [ORG_NAME] across all departments including [DEPARTMENTS_LIST].

## 3. Policy Statement

[ORG_NAME] recognises its obligations under applicable legislation and regulation including [APPLICABLE_REGULATIONS].
This policy is owned by [POLICY_APPROVAL_AUTHORITY] and is reviewed annually.

## 4. Responsibilities

The Chief Executive [CEO_NAME] holds ultimate accountability for this policy.
Day-to-day management is delegated to the appropriate lead within [DEPARTMENTS_LIST].

## 5. Review

This policy will be reviewed annually in [ANNUAL_REVIEW_DATE] or following any significant change.
For queries, contact: [COMPLIANCE_EMAIL]

---
Data Controller: [DATA_CONTROLLER_NAME]
Last Updated: [CURRENT_DATE]
`;
}

// ============================================================
// ENDPOINT: GET /api/status/:session_id
// ============================================================
app.get('/api/status/:session_id', (req, res) => {
  const { session_id } = req.params;
  const status = genStatus[session_id];
  if (!status) return res.status(404).json({ error: 'Session not found' });
  const pct = Math.round((status.completed / status.total) * 100);
  res.json({
    session_id, completed: status.completed, total: status.total,
    percent: pct, ready: status.ready, errors: status.errors || []
  });
});

// ============================================================
// ENDPOINT: GET /api/download/:session_id/:format (ZIP all)
// ============================================================
app.get('/api/download/:session_id/:format', async (req, res) => {
  const { session_id, format } = req.params;
  if (!['pdf', 'docx'].includes(format)) return res.status(400).json({ error: 'Invalid format' });

  const status = genStatus[session_id];
  if (!status || !status.ready) return res.status(409).json({ error: 'Documents not ready yet' });

  const sessionDir = path.join(TEMP_DIR, session_id);
  const zipPath = path.join(sessionDir, `policies_${format}.zip`);

  try {
    await createZip(sessionDir, zipPath, format);
    res.setHeader('Content-Disposition', `attachment; filename="ai-si-policies-${format}.zip"`);
    res.setHeader('Content-Type', 'application/zip');
    const stream = fs.createReadStream(zipPath);
    stream.pipe(res);
    log(session_id, 'DOWNLOAD_ZIP', 'OK', format);
  } catch (err) {
    log(session_id, 'DOWNLOAD_ZIP', 'ERROR', err.message);
    res.status(500).json({ error: 'Failed to create ZIP' });
  }
});

function createZip(dir, zipPath, format) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 6 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.' + format));
    files.forEach(f => archive.file(path.join(dir, f), { name: f }));
    archive.finalize();
  });
}

// ============================================================
// ENDPOINT: GET /api/download/:session_id/:doc_id/:format (single)
// ============================================================
app.get('/api/download/:session_id/:doc_id/:format', (req, res) => {
  const { session_id, doc_id, format } = req.params;
  if (!['pdf', 'docx'].includes(format)) return res.status(400).json({ error: 'Invalid format' });

  const filePath = path.join(TEMP_DIR, session_id, `${doc_id}.${format}`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Document not found' });

  const mimeType = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  res.setHeader('Content-Disposition', `attachment; filename="${doc_id}.${format}"`);
  res.setHeader('Content-Type', mimeType);
  fs.createReadStream(filePath).pipe(res);
  log(session_id, 'DOWNLOAD_SINGLE', 'OK', `${doc_id}.${format}`);
});

// ============================================================
// ENDPOINT: POST /api/save-session
// ============================================================
app.post('/api/save-session', (req, res) => {
  const { session_id, current_section, answers_so_far } = req.body;
  if (!session_id) return res.status(400).json({ error: 'session_id required' });
  sessions[session_id] = { section: current_section || 0, answers: answers_so_far || {}, timestamp: Date.now() };
  persistSessions();
  log(session_id, 'SAVE_SESSION', 'OK', `section ${current_section}`);
  res.json({ session_id, saved: true });
});

// ============================================================
// ENDPOINT: GET /api/resume-session/:session_id
// ============================================================
app.get('/api/resume-session/:session_id', (req, res) => {
  const { session_id } = req.params;
  const session = sessions[session_id];
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const progress = Math.round((session.section / 11) * 100);
  log(session_id, 'RESUME_SESSION', 'OK', `section ${session.section}`);
  res.json({ section: session.section, answers: session.answers, progress });
});

// ============================================================
// ENCRYPTION / DECRYPTION
// ============================================================
function decryptAnswers(encryptedData, iv) {
  if (!iv) throw new Error('IV required');
  const keyBuffer = Buffer.from(ENCRYPTION_KEY.substring(0, 64), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, Buffer.from(iv, 'hex'));
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

// ============================================================
// SESSION PERSISTENCE
// ============================================================
function persistSessions() {
  try {
    ensureDir(path.dirname(SESSIONS_FILE));
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
  } catch (e) { log('SYSTEM', 'PERSIST_SESSIONS', 'ERROR', e.message); }
}

function loadSessions() {
  if (fs.existsSync(SESSIONS_FILE)) {
    try { Object.assign(sessions, JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'))); }
    catch (e) { log('SYSTEM', 'LOAD_SESSIONS', 'WARN', e.message); }
  }
}

// ============================================================
// FILE CLEANUP BACKGROUND JOB
// ============================================================
const FILE_EXPIRY_MS = parseInt(process.env.FILE_EXPIRY || '86400') * 1000;
const CLEANUP_INTERVAL_MS = parseInt(process.env.FILE_CLEANUP_INTERVAL || '3600') * 1000;

function cleanupOldFiles() {
  if (!fs.existsSync(TEMP_DIR)) return;
  const now = Date.now();
  fs.readdirSync(TEMP_DIR).forEach(sessionDir => {
    const dirPath = path.join(TEMP_DIR, sessionDir);
    try {
      const stat = fs.statSync(dirPath);
      if (now - stat.mtimeMs > FILE_EXPIRY_MS) {
        fs.rmSync(dirPath, { recursive: true, force: true });
        log('SYSTEM', 'CLEANUP', 'OK', sessionDir);
      }
    } catch (e) { log('SYSTEM', 'CLEANUP', 'ERROR', e.message); }
  });
  // Clean up old rate limit entries
  const cutoff = now - 3600000;
  Object.keys(rateLimits).forEach(ip => {
    rateLimits[ip] = (rateLimits[ip] || []).filter(t => t > cutoff);
    if (rateLimits[ip].length === 0) delete rateLimits[ip];
  });
}

setInterval(cleanupOldFiles, CLEANUP_INTERVAL_MS);

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', templates: Object.keys(templates).length, uptime: process.uptime() });
});

// ============================================================
// START
// ============================================================
ensureDir(TEMP_DIR);
ensureDir(path.join(__dirname, 'server'));
loadTemplates();
loadSessions();

app.listen(PORT, () => {
  log('SYSTEM', 'SERVER_START', 'OK', `Port ${PORT}`);
  console.log(`AI-Si Policy Suite backend running on http://localhost:${PORT}`);
  console.log(`Templates loaded: ${Object.keys(templates).length}`);
  console.log(`Frontend: http://localhost:${PORT}`);
});
