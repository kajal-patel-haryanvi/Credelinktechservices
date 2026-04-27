"use strict";

// Native Node modules keep the backend easy to run without third-party packages.
const nativeFs = require("node:fs");
const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const crypto = require("node:crypto");
const tls = require("node:tls");
const net = require("node:net");

// Load variables from a local .env file before reading process.env.
loadDotEnv();

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const HOST = "0.0.0.0";
const DATA_DIRECTORY = path.join(__dirname, "data");
const SUBMISSIONS_FILE = path.join(DATA_DIRECTORY, "submissions.json");
const PUBLIC_DIRECTORY = __dirname;

const EMAIL_CONFIG = {
  adminEmail: process.env.ADMIN_EMAIL || "",
  host: process.env.SMTP_HOST || "",
  port: Number.parseInt(process.env.SMTP_PORT || "465", 10),
  secure: `${process.env.SMTP_SECURE || "true"}`.toLowerCase() !== "false",
  user: process.env.SMTP_USER || "",
  pass: process.env.SMTP_PASS || "",
  from: process.env.SMTP_FROM || process.env.SMTP_USER || "",
};

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function loadDotEnv() {
  const envPath = path.join(__dirname, ".env");

  try {
    const fileContents = nativeFs.readFileSync(envPath, "utf8");
    const lines = fileContents.split(/\r?\n/);

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith("#")) {
        continue;
      }

      const equalsIndex = trimmedLine.indexOf("=");

      if (equalsIndex === -1) {
        continue;
      }

      const key = trimmedLine.slice(0, equalsIndex).trim();
      const rawValue = trimmedLine.slice(equalsIndex + 1).trim();
      const value = rawValue.replace(/^['"]|['"]$/g, "");

      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    // A missing .env file is fine during first setup.
  }
}

// Send consistent JSON responses from every API branch.
function json(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

// Normalize whitespace so records stay tidy in storage and email output.
function sanitizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

// Escape HTML before inserting user input into an email template.
function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Validate and normalize the incoming contact form payload.
function validateSubmission(input) {
  const normalized = {
    companyName: sanitizeText(String(input.companyName || "")),
    email: sanitizeText(String(input.email || "")).toLowerCase(),
    brief: String(input.brief || "").trim(),
  };

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const errors = [];

  if (normalized.companyName.length < 2 || normalized.companyName.length > 120) {
    errors.push("Company name must be between 2 and 120 characters.");
  }

  if (!emailPattern.test(normalized.email) || normalized.email.length > 254) {
    errors.push("Email must be a valid email address.");
  }

  if (normalized.brief.length < 20 || normalized.brief.length > 2000) {
    errors.push("Campaign details must be between 20 and 2000 characters.");
  }

  return {
    isValid: errors.length === 0,
    errors,
    value: normalized,
  };
}

// Make sure the JSON data store exists before reading or writing it.
async function ensureDataFile() {
  await fs.mkdir(DATA_DIRECTORY, { recursive: true });

  try {
    await fs.access(SUBMISSIONS_FILE);
  } catch (error) {
    await fs.writeFile(SUBMISSIONS_FILE, "[]\n", "utf8");
  }
}

// Read all saved submissions from disk.
async function readSubmissions() {
  await ensureDataFile();
  const fileContents = await fs.readFile(SUBMISSIONS_FILE, "utf8");
  const parsed = JSON.parse(fileContents);

  if (!Array.isArray(parsed)) {
    throw new Error("Submissions data file is corrupted.");
  }

  return parsed;
}

// Persist the full submissions array in a readable format.
async function writeSubmissions(submissions) {
  await fs.writeFile(SUBMISSIONS_FILE, `${JSON.stringify(submissions, null, 2)}\n`, "utf8");
}

// Save a new record with a UUID and createdAt timestamp.
async function saveSubmission(payload) {
  const submissions = await readSubmissions();
  const submission = {
    id: crypto.randomUUID(),
    companyName: payload.companyName,
    email: payload.email,
    brief: payload.brief,
    createdAt: new Date().toISOString(),
    notification: {
      status: "pending",
      lastAttemptAt: null,
      errorMessage: null,
    },
  };

  submissions.push(submission);
  await writeSubmissions(submissions);
  return submission;
}

// Track whether the admin notification email was sent successfully.
async function updateNotificationStatus(submissionId, status, errorMessage) {
  const submissions = await readSubmissions();
  const index = submissions.findIndex((submission) => submission.id === submissionId);

  if (index === -1) {
    return;
  }

  submissions[index].notification = {
    status,
    lastAttemptAt: new Date().toISOString(),
    errorMessage: errorMessage || null,
  };

  await writeSubmissions(submissions);
}

// Build both plain-text and HTML versions of the admin email.
function createEmailContent(submission) {
  const subject = `New partnership inquiry from ${submission.companyName}`;
  const text = [
    "A new form submission was received.",
    "",
    `Submission ID: ${submission.id}`,
    `Created At: ${submission.createdAt}`,
    `Company Name: ${submission.companyName}`,
    `Email: ${submission.email}`,
    "Campaign Details:",
    submission.brief,
  ].join("\r\n");

  const html = `
    <h2>New form submission received</h2>
    <p><strong>Submission ID:</strong> ${escapeHtml(submission.id)}</p>
    <p><strong>Created At:</strong> ${escapeHtml(submission.createdAt)}</p>
    <p><strong>Company Name:</strong> ${escapeHtml(submission.companyName)}</p>
    <p><strong>Email:</strong> ${escapeHtml(submission.email)}</p>
    <p><strong>Campaign Details:</strong></p>
    <p>${escapeHtml(submission.brief).replace(/\n/g, "<br />")}</p>
  `.trim();

  return { subject, text, html };
}

// Fail fast when required SMTP settings are missing.
function assertEmailConfig() {
  const requiredValues = ["adminEmail", "host", "port", "user", "pass", "from"];
  const missing = requiredValues.filter((key) => !EMAIL_CONFIG[key]);

  if (missing.length > 0) {
    throw new Error(
      `Email configuration is incomplete. Missing: ${missing.join(", ")}.`
    );
  }
}

// Read one SMTP response, including multiline responses such as 250- blocks.
function readSmtpResponse(socket) {
  return new Promise((resolve, reject) => {
    let buffer = "";

    function cleanup() {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("end", onEnd);
    }

    function onError(error) {
      cleanup();
      reject(error);
    }

    function onEnd() {
      cleanup();
      reject(new Error("SMTP connection ended unexpectedly."));
    }

    function onData(chunk) {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\r\n").filter(Boolean);
      const lastLine = lines[lines.length - 1];

      if (/^\d{3} /.test(lastLine)) {
        cleanup();
        resolve({
          code: Number.parseInt(lastLine.slice(0, 3), 10),
          message: buffer.trim(),
        });
      }
    }

    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("end", onEnd);
  });
}

// Send an SMTP command and ensure the response code matches what we expect.
async function sendSmtpCommand(socket, command, expectedCode) {
  socket.write(`${command}\r\n`);
  const response = await readSmtpResponse(socket);

  if (response.code !== expectedCode) {
    throw new Error(`SMTP command failed for "${command}": ${response.message}`);
  }

  return response;
}

// Open either a secure SMTPS connection or a plain connection upgraded with STARTTLS.
async function openSmtpConnection() {
  if (EMAIL_CONFIG.secure) {
    const secureSocket = tls.connect({
      host: EMAIL_CONFIG.host,
      port: EMAIL_CONFIG.port,
      servername: EMAIL_CONFIG.host,
      rejectUnauthorized: true,
    });

    await new Promise((resolve, reject) => {
      secureSocket.once("secureConnect", resolve);
      secureSocket.once("error", reject);
    });

    const greeting = await readSmtpResponse(secureSocket);

    if (greeting.code !== 220) {
      throw new Error(`SMTP greeting failed: ${greeting.message}`);
    }

    return secureSocket;
  }

  const plainSocket = net.createConnection({
    host: EMAIL_CONFIG.host,
    port: EMAIL_CONFIG.port,
  });

  await new Promise((resolve, reject) => {
    plainSocket.once("connect", resolve);
    plainSocket.once("error", reject);
  });

  const greeting = await readSmtpResponse(plainSocket);

  if (greeting.code !== 220) {
    throw new Error(`SMTP greeting failed: ${greeting.message}`);
  }

  await sendSmtpCommand(plainSocket, "EHLO localhost", 250);
  await sendSmtpCommand(plainSocket, "STARTTLS", 220);

  const upgradedSocket = tls.connect({
    socket: plainSocket,
    servername: EMAIL_CONFIG.host,
    rejectUnauthorized: true,
  });

  await new Promise((resolve, reject) => {
    upgradedSocket.once("secureConnect", resolve);
    upgradedSocket.once("error", reject);
  });

  return upgradedSocket;
}

// Send the admin email after a successful save.
async function sendAdminEmail(submission) {
  assertEmailConfig();

  const { subject, text, html } = createEmailContent(submission);
  const socket = await openSmtpConnection();

  try {
    await sendSmtpCommand(socket, "EHLO localhost", 250);
    await sendSmtpCommand(socket, "AUTH LOGIN", 334);
    await sendSmtpCommand(socket, Buffer.from(EMAIL_CONFIG.user, "utf8").toString("base64"), 334);
    await sendSmtpCommand(socket, Buffer.from(EMAIL_CONFIG.pass, "utf8").toString("base64"), 235);
    await sendSmtpCommand(socket, `MAIL FROM:<${EMAIL_CONFIG.from}>`, 250);
    await sendSmtpCommand(socket, `RCPT TO:<${EMAIL_CONFIG.adminEmail}>`, 250);
    await sendSmtpCommand(socket, "DATA", 354);

    const mimeMessage = [
      `From: ${EMAIL_CONFIG.from}`,
      `To: ${EMAIL_CONFIG.adminEmail}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      'Content-Type: multipart/alternative; boundary="boundary42"',
      "",
      "--boundary42",
      'Content-Type: text/plain; charset="utf-8"',
      "",
      text,
      "",
      "--boundary42",
      'Content-Type: text/html; charset="utf-8"',
      "",
      html,
      "",
      "--boundary42--",
      ".",
    ].join("\r\n");

    socket.write(`${mimeMessage}\r\n`);
    const dataResponse = await readSmtpResponse(socket);

    if (dataResponse.code !== 250) {
      throw new Error(`SMTP message send failed: ${dataResponse.message}`);
    }

    await sendSmtpCommand(socket, "QUIT", 221);
  } finally {
    socket.end();
  }
}

// Parse the request body as JSON and reject overly large payloads.
async function parseJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk.toString("utf8");

      if (body.length > 32 * 1024) {
        reject(new Error("Request body too large."));
        request.destroy();
      }
    });

    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Request body must be valid JSON."));
      }
    });

    request.on("error", reject);
  });
}

// Convert a URL path to a safe local file path and block directory traversal.
function getSafeFilePath(urlPath) {
  const normalizedPath = urlPath === "/" ? "/index.html" : urlPath;
  const decodedPath = decodeURIComponent(normalizedPath);
  const resolvedPath = path.resolve(PUBLIC_DIRECTORY, `.${decodedPath}`);

  if (!resolvedPath.startsWith(PUBLIC_DIRECTORY)) {
    return null;
  }

  return resolvedPath;
}

// Serve the static HTML, CSS, and JS files used by the site.
async function serveStaticFile(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const filePath = getSafeFilePath(url.pathname);

  if (!filePath) {
    json(response, 403, { error: "Access denied." });
    return;
  }

  try {
    const stat = await fs.stat(filePath);

    if (stat.isDirectory()) {
      json(response, 404, { error: "Not found." });
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[extension] || "application/octet-stream";
    const fileContents = await fs.readFile(filePath);

    response.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": fileContents.length,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(fileContents);
  } catch (error) {
    json(response, 404, { error: "Not found." });
  }
}

// Main REST handler for contact form submissions.
async function handleSubmission(request, response) {
  const body = await parseJsonBody(request);
  const validation = validateSubmission(body);

  if (!validation.isValid) {
    json(response, 400, {
      error: "Validation failed.",
      details: validation.errors,
    });
    return;
  }

  const submission = await saveSubmission(validation.value);

  try {
    await sendAdminEmail(submission);
    await updateNotificationStatus(submission.id, "sent");
  } catch (error) {
    await updateNotificationStatus(submission.id, "failed", error.message);
    json(response, 502, {
      error:
        "Your inquiry was saved, but the admin email could not be sent. Check SMTP settings.",
      submissionId: submission.id,
    });
    return;
  }

  json(response, 201, {
    message: "Submission saved and admin notified successfully.",
    submission: {
      id: submission.id,
      companyName: submission.companyName,
      email: submission.email,
      brief: submission.brief,
      createdAt: submission.createdAt,
    },
  });
}

// Route API requests and fall back to static file serving for the website pages.
const server = http.createServer(async (request, response) => {
  try {
    if (!request.url || !request.method) {
      json(response, 400, { error: "Invalid request." });
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

    if (request.method === "GET" && url.pathname === "/api/health") {
      json(response, 200, { status: "ok" });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/submissions") {
      await handleSubmission(request, response);
      return;
    }

    if (request.method === "GET") {
      await serveStaticFile(request, response);
      return;
    }

    json(response, 405, { error: "Method not allowed." });
  } catch (error) {
    json(response, 500, {
      error: error instanceof Error ? error.message : "Internal server error.",
    });
  }
});

server.listen(PORT, HOST, async () => {
  await ensureDataFile();
  console.log(`Server running at http://localhost:${PORT}`);
});
