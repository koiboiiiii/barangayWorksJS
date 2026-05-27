const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Send a confirmation email via Gmail SMTP.
 */
async function sendConfirmationEmail(opts) {
  const { to, first_name, last_name, service, selected_date, serial_number } = opts;

  if (!to) {
    console.warn('[mailer] No email provided, skipping');
    return { ok: false, skipped: true };
  }

  // Read the barangay logo and prepare it as a CID attachment (more reliable in clients).
  const logoPath = path.resolve(__dirname, '..', 'assets', 'image1.png');
  let logoBuffer = null;
  try {
    logoBuffer = fs.readFileSync(logoPath);
    console.log('[mailer] Read logo image:', logoPath, '-', logoBuffer.length, 'bytes');
  } catch (err) {
    console.warn('[mailer] Could not read logo image:', err.message);
  }

  // Prepare attachments and CID reference
  const attachments = [];
  let logoDataUri = '';
  let logoCid = '';
  let logoBase64 = '';
  if (logoBuffer && logoBuffer.length) {
    // keep attachment with CID for clients that support it
    logoCid = 'barangay-logo@local';
    attachments.push({
      filename: 'image1.png',
      content: logoBuffer,
      cid: logoCid,
      contentType: 'image/png',
      contentDisposition: 'inline'
    });

    // also create a data URI fallback so clients that block CID can still show the image
    logoBase64 = logoBuffer.toString('base64');
    logoDataUri = 'data:image/png;base64,' + logoBase64;
    console.log('[mailer] Prepared attachment with cid=' + logoCid + ' and data-URI fallback');
  }

  // Prefer a hosted HTTPS logo when provided (more reliable in Gmail and many clients).
  // Fallback order: LOGO_URL (hosted) -> CID attachment -> data-URI
  const envLogoUrl = (process.env.LOGO_URL || '').trim();
  if (envLogoUrl) console.log('[mailer] Using hosted logo from LOGO_URL:', envLogoUrl);
  const finalLogoSrc = envLogoUrl || (logoCid ? 'cid:' + logoCid : (logoDataUri || ''));

  const htmlBody = buildEmailHtml({
    logoDataUri: finalLogoSrc,
    first_name: first_name,
    last_name: last_name,
    service: service,
    selected_date: selected_date,
    serial_number: serial_number
  });

  // SMTP config. If SMTP creds are not provided, create an Ethereal test account
  // so we can test sending locally and get a preview URL.
  let transporter;
  let usedTestAccount = false;
  let smtpUser = process.env.SMTP_USER;
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

  if (!smtpUser || !pass) {
    console.warn('[mailer] SMTP_USER or SMTP_PASS not set — creating Ethereal test account for local testing');
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        logger: !!process.env.SMTP_DEBUG,
        debug: !!process.env.SMTP_DEBUG,
        auth: { user: testAccount.user, pass: testAccount.pass }
      });
      usedTestAccount = true;
      smtpUser = testAccount.user;
      console.log('[mailer] Using Ethereal test account:', smtpUser);
    } catch (acctErr) {
      console.error('[mailer] Failed to create test account:', acctErr && acctErr.message ? acctErr.message : acctErr);
      return { ok: false, error: 'No SMTP and failed to create test account' };
    }
  } else {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      // enable debug logs when SMTP_DEBUG is set
      logger: !!process.env.SMTP_DEBUG,
      debug: !!process.env.SMTP_DEBUG,
      auth: { user: smtpUser, pass: pass }
    });
  }

  const mailOptions = {
    from: '"Barangay Appointment System" <' + (smtpUser || 'no-reply@example.com') + '>',
    to: to,
    subject: 'Barangay Appointment Confirmation \u2014 ' + (serial_number || ''),
    html: htmlBody
  };

  if (attachments.length) {
    mailOptions.attachments = attachments;
  }

  // Diagnostic logs before sending
  try {
    const canConnect = await transporter.verify();
    console.log('[mailer] transporter.verify() OK:', canConnect);
  } catch (vErr) {
    console.warn('[mailer] transporter.verify() failed:', vErr && vErr.message ? vErr.message : vErr);
  }

  if (mailOptions.attachments) {
    console.log('[mailer] mailOptions.attachments count:', mailOptions.attachments.length);
    mailOptions.attachments.forEach((a, i) => {
      console.log('[mailer] attachment', i, 'filename:', a.filename, 'size:', a.content ? (a.content.length || a.content.byteLength || 'unknown') : 'none', 'cid:', a.cid);
    });
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('[mailer] Confirmation sent to', to, '\u2014', serial_number, '(msgId:', info.messageId, ')');
    if (usedTestAccount) {
      const preview = nodemailer.getTestMessageUrl(info);
      console.log('[mailer] Ethereal preview URL:', preview);
      return { ok: true, messageId: info.messageId, previewUrl: preview };
    }
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error('[mailer] Send failed:', err.message);
    return { ok: false, error: err.message };
  }
}

function esc(str) {
  if (!str) return '';
  var a = String.fromCharCode(38);
  var l = String.fromCharCode(60);
  var g = String.fromCharCode(62);
  var q = String.fromCharCode(34);
  var ap = String.fromCharCode(39);
  return String(str)
    .replace(new RegExp(a, 'g'), a + 'amp;')
    .replace(new RegExp(l, 'g'), a + 'lt;')
    .replace(new RegExp(g, 'g'), a + 'gt;')
    .replace(new RegExp(q, 'g'), a + 'quot;')
    .replace(new RegExp(ap, 'g'), a + '#039;');
}

function buildEmailHtml(opts) {
  var logoHtml = '';
  if (opts.logoDataUri) {
    logoHtml = '<tr><td align="center" style="padding-bottom:24px;"><img src="' + opts.logoDataUri + '" alt="Barangay Logo" style="width:120px;height:auto;display:block;margin:0 auto;" /></td></tr>';
  }

  var sn = esc(opts.serial_number || 'N/A');
  var svc = esc(opts.service || 'N/A');
  var dt = esc(opts.selected_date || 'N/A');
  var fn = esc(opts.first_name || '');
  var ln = esc(opts.last_name || '');

  return '<!DOCTYPE html>' +
'<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
'<style>' +
'body{margin:0;padding:0;background:#f4f7f9;font-family:Arial,Helvetica,sans-serif;}' +
'.wrapper{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);}' +
'.bar{background:#00579a;height:6px;}' +
'.body{padding:32px 36px 24px;}' +
'.greeting{font-size:22px;font-weight:bold;color:#1d1b20;margin:0 0 6px;text-align:center;}' +
'.sub{font-size:14px;color:#555;text-align:center;margin:0 0 28px;}' +
'.refbox{background:#eef4fd;border:1px solid #c7dfff;border-radius:10px;padding:16px 20px;text-align:center;margin-bottom:24px;}' +
'.reflabel{font-size:12px;color:#777;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;}' +
'.refnum{font-size:28px;font-weight:bold;color:#00579a;letter-spacing:1px;margin:0;word-break:break-all;}' +
'.dtbl{width:100%;border-collapse:collapse;margin-bottom:24px;}' +
'.dtbl td{padding:8px 0;border-bottom:1px solid #e8ecf0;font-size:14px;}' +
'.dtbl td:first-child{color:#888;width:40%;}' +
'.dtbl td:last-child{color:#1d1b20;font-weight:500;}' +
'.ftr{font-size:12px;color:#aaa;text-align:center;margin:0;padding-top:16px;border-top:1px solid #e8ecf0;}' +
'</style></head><body>' +
'<div class="wrapper"><div class="bar"></div><div class="body">' +
'<table width="100%" cellpadding="0" cellspacing="0" border="0">' +
logoHtml +
'<tr><td align="center"><p class="greeting">Dear ' + fn + ' ' + ln + ',</p>' +
'<p class="sub">Your appointment has been confirmed!<br>Please find your reference details below.</p></td></tr>' +
'<tr><td><div class="refbox"><p class="reflabel">Reference Number</p>' +
'<p class="refnum">' + sn + '</p></div></td></tr>' +
'<tr><td><table class="dtbl" cellpadding="0" cellspacing="0" border="0">' +
'<tr><td>Service Requested</td><td>' + svc + '</td></tr>' +
'<tr><td>Appointment Date</td><td>' + dt + '</td></tr>' +
'<tr><td>Full Name</td><td>' + fn + ' ' + ln + '</td></tr>' +
'</table></td></tr>' +
'<tr><td><p class="ftr">This is an automated message from BarangayWorks. Please do not reply directly.</p></td></tr>' +
'</table></div></div></body></html>';
}

module.exports = { sendConfirmationEmail: sendConfirmationEmail };