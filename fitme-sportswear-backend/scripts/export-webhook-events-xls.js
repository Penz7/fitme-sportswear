const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const outputPath =
  process.argv[2] ?? path.join(rootDir, 'logs', 'pancake-webhook-events.xls');
const intervalMs = Number(process.env.WEBHOOK_XLS_INTERVAL_MS ?? 5000);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function payloadSummary(payload) {
  const text = JSON.stringify(payload ?? {});
  return text.length > 1200 ? `${text.slice(0, 1200)}...` : text;
}

function workbookHtml(events) {
  const generatedAt = new Date().toISOString();
  const rows = events
    .map(
      (event) => `
        <tr>
          <td>${escapeHtml(event.receivedAt?.toISOString?.() ?? event.receivedAt)}</td>
          <td>${escapeHtml(event.id)}</td>
          <td>${escapeHtml(event.sourcePlatform)}</td>
          <td>${escapeHtml(event.eventType)}</td>
          <td>${escapeHtml(event.externalEventId)}</td>
          <td>${escapeHtml(event.status)}</td>
          <td>${escapeHtml(event.processedAt?.toISOString?.() ?? event.processedAt ?? '')}</td>
          <td>${escapeHtml(payloadSummary(event.payload))}</td>
        </tr>`,
    )
    .join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #999; padding: 6px; vertical-align: top; }
    th { background: #e6eef8; font-weight: 700; }
    td { mso-number-format: "\\@"; }
  </style>
</head>
<body>
  <h1>Pancake Webhook Events</h1>
  <p>Generated at: ${escapeHtml(generatedAt)}</p>
  <p>Total events: ${events.length}</p>
  <table>
    <thead>
      <tr>
        <th>Received At</th>
        <th>Event ID</th>
        <th>Platform</th>
        <th>Event Type</th>
        <th>External Event ID</th>
        <th>Status</th>
        <th>Processed At</th>
        <th>Payload</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

async function exportOnce(prisma) {
  const events = await prisma.webhookEvent.findMany({
    where: { sourcePlatform: 'pancake' },
    orderBy: { receivedAt: 'desc' },
    take: 500,
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, workbookHtml(events), 'utf8');
  console.log(
    `[webhook-xls] wrote ${events.length} Pancake events to ${outputPath}`,
  );
}

async function main() {
  loadEnvFile(envPath);
  const prisma = new PrismaClient();

  await exportOnce(prisma);

  setInterval(() => {
    exportOnce(prisma).catch((error) => {
      console.error('[webhook-xls] export failed', error);
    });
  }, intervalMs);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
