# CredeLink Coupon Website Backend

This project now includes a Node.js backend for the contact form on the website.

## What it does

- Serves the static website files
- Exposes `POST /api/submissions` for form submissions
- Validates all inputs on both client and server
- Saves submissions to `data/submissions.json`
- Adds a `createdAt` timestamp to every saved submission
- Sends an email to the admin when a new form is submitted
- Includes a health check at `GET /api/health`

## Files

- `server.js`: main HTTP server, API, validation, storage, and SMTP email logic
- `index.html`: homepage with the wired contact form
- `script.js`: frontend form validation and API submission
- `.env.example`: environment variables required for email delivery
- `data/submissions.json`: created automatically on first run

## Requirements

- Node.js 18 or newer
- SMTP credentials for sending admin emails

## Environment setup

Create a `.env` file in the project root and copy these values. The server reads this file automatically on startup:

```env
PORT=3000
ADMIN_EMAIL=admin@example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SMTP_FROM=no-reply@example.com
```

## Run locally

1. Install Node.js 18 or newer if it is not already installed.
2. Create a `.env` file using `.env.example`.
3. Start the server:

```bash
node server.js
```

4. Open `http://localhost:3000`
5. Submit the form on the home page.

## API

### `POST /api/submissions`

Request body:

```json
{
  "companyName": "Example Company",
  "email": "marketing@example.com",
  "brief": "We want to promote seasonal offers for new users."
}
```

Success response:

```json
{
  "message": "Submission saved and admin notified successfully.",
  "submission": {
    "id": "uuid",
    "companyName": "Example Company",
    "email": "marketing@example.com",
    "brief": "We want to promote seasonal offers for new users.",
    "createdAt": "2026-04-27T12:00:00.000Z"
  }
}
```

Validation error response:

```json
{
  "error": "Validation failed.",
  "details": [
    "Company name must be between 2 and 120 characters."
  ]
}
```

## Notes

- The backend saves the submission before attempting email delivery.
- If email sending fails, the submission still remains stored and the API returns an error so you can fix SMTP settings.
- `SMTP_SECURE=true` is for direct TLS SMTP, usually port `465`. Set `SMTP_SECURE=false` for providers that use `STARTTLS`, often on port `587`.
- The privacy policy page should still be reviewed by a legal professional before publishing.
