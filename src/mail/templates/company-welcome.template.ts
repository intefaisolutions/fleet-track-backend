import {
  emailPrimaryButton,
  escapeHtml,
  renderEmailLayout,
} from './layout.template';

export type CompanyWelcomeEmailParams = {
  appName: string;
  adminName: string;
  companyName: string;
  licenseKey: string;
  loginUrl: string;
  planType?: string;
  validUntil?: string;
};

/** Reusable company registration / license activation welcome email body + layout. */
export function renderCompanyWelcomeEmail(params: CompanyWelcomeEmailParams): {
  subject: string;
  text: string;
  html: string;
} {
  const {
    appName,
    adminName,
    companyName,
    licenseKey,
    loginUrl,
    planType,
    validUntil,
  } = params;

  const subject = `${appName} — Welcome! Your company is registered`;

  const text = [
    `Welcome to ${appName}, ${adminName}.`,
    ``,
    `Company: ${companyName}`,
    `License Key: ${licenseKey}`,
    `Login URL: ${loginUrl}`,
    ``,
    `Login instructions:`,
    `1. Open the Login URL above.`,
    `2. Sign in with the email and password you used during registration.`,
    `3. On the License Activation screen, enter your License Key.`,
    `4. After successful verification you can access the Company Dashboard.`,
    planType ? `Plan: ${planType}` : '',
    validUntil ? `Valid until: ${validUntil}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const metaRows: string[] = [];
  if (planType) {
    metaRows.push(
      `<tr><td style="padding:6px 0;color:#64748b;">Plan</td><td style="padding:6px 0;color:#0f172a;font-weight:600;">${escapeHtml(planType)}</td></tr>`,
    );
  }
  if (validUntil) {
    metaRows.push(
      `<tr><td style="padding:6px 0;color:#64748b;">Valid until</td><td style="padding:6px 0;color:#0f172a;font-weight:600;">${escapeHtml(validUntil)}</td></tr>`,
    );
  }

  const bodyHtml = `
    <p style="margin:0 0 12px;color:#475569;line-height:1.6;font-size:15px;">
      Hi ${escapeHtml(adminName)},
    </p>
    <p style="margin:0 0 16px;color:#475569;line-height:1.6;font-size:15px;">
      Your company <strong style="color:#0f172a;">${escapeHtml(companyName)}</strong> has been registered successfully on ${escapeHtml(appName)}.
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
      <tr>
        <td style="padding:16px 18px;">
          <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;font-weight:600;">Company Name</p>
          <p style="margin:0;font-size:16px;font-weight:700;color:#0f172a;">${escapeHtml(companyName)}</p>
        </td>
      </tr>
    </table>

    <div style="margin:0 0 20px;padding:20px;background:#f0f9ff;border-radius:12px;text-align:center;border:1px solid #bae6fd;">
      <p style="margin:0 0 8px;font-size:11px;color:#0369a1;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">License Key</p>
      <p style="margin:0;font-size:20px;font-weight:700;letter-spacing:2px;color:#0284c7;font-family:Consolas,Monaco,monospace;">${escapeHtml(licenseKey)}</p>
    </div>

    ${
      metaRows.length
        ? `<table role="presentation" width="100%" style="margin:0 0 20px;font-size:14px;">${metaRows.join('')}</table>`
        : ''
    }

    <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#0f172a;">Login URL</p>
    <p style="margin:0 0 16px;">
      <a href="${escapeHtml(loginUrl)}" style="color:#00AEEF;font-size:14px;word-break:break-all;">${escapeHtml(loginUrl)}</a>
    </p>

    <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#0f172a;">Login Instructions</p>
    <ol style="margin:0 0 8px;padding-left:20px;color:#475569;font-size:14px;line-height:1.7;">
      <li>Open the Login URL above (or tap the button below).</li>
      <li>Sign in with the <strong>email and password</strong> you created during registration.</li>
      <li>On the <strong>License Activation</strong> screen, enter the License Key from this email.</li>
      <li>After verification succeeds, you will reach the Company Dashboard.</li>
    </ol>

    ${emailPrimaryButton(loginUrl, 'Log in to FleetTrack')}

    <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;line-height:1.5;">
      If you do not see this email in your inbox, check Spam/Junk. Do not share your license key publicly.
    </p>
  `;

  const html = renderEmailLayout({
    appName,
    title: `Welcome to ${appName}`,
    bodyHtml,
    footerNote: `Keep this email for your license key. ${appName} support is available if activation fails.`,
  });

  return { subject, text, html };
}
