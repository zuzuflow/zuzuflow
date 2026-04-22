// =============================================================================
// Shared email template shell
//
// Every transactional email the app sends (verification, invite, MFA OTP,
// admin test) goes through `renderEmail()` to produce consistent branding,
// preheader text, mobile-responsive layout, and a dark-mode-friendly color
// palette. Matches the website/app theme: indigo brand gradient, slate text,
// ample whitespace, single CTA button.
//
// Email-client constraints we respect:
//   • All styling is INLINE or scoped to `<style>` in <head> — email clients
//     strip <link> and many drop <style> entirely (hence also inline).
//   • No flexbox/grid in the layout scaffold — we fall back to tables for
//     Outlook, which still runs Word's HTML engine.
//   • Fonts are safe OS stacks; no @font-face (inconsistent support).
//   • The preheader (hidden preview text) uses the standard zero-height
//     trick so inbox list UIs pick it up without it rendering in the body.
// =============================================================================

const BRAND_NAME = "ZuzuFlow";
const BRAND_TAGLINE = "Visual workflow automation for teams that ship fast";
const PRIMARY = "#4f46e5";              // indigo-600
const PRIMARY_DARK = "#4338ca";         // indigo-700
const PRIMARY_LIGHT = "#eef2ff";        // indigo-50
const TEXT = "#0f172a";                 // slate-900
const TEXT_MUTED = "#64748b";           // slate-500
const BORDER = "#e2e8f0";               // slate-200
const BG_PAGE = "#f1f5f9";              // slate-100 (outer canvas)
const BG_CARD = "#ffffff";

export interface RenderEmailParams {
  /** Short preview text shown in inbox list UIs (max ~90 chars). */
  preheader: string;
  /** H1 shown above the body content. */
  title: string;
  /** HTML fragment for the main content area. */
  body: string;
  /** Optional CTA — renders as a centered primary button under the body. */
  cta?: { label: string; href: string };
  /** Optional secondary text below the CTA (e.g. expiry note, fallback URL). */
  footnote?: string;
}

/** Escape untrusted text for safe inclusion inside HTML templates. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderEmail(params: RenderEmailParams): { html: string; text: string } {
  const { preheader, title, body, cta, footnote } = params;
  const year = new Date().getFullYear();

  const ctaHtml = cta
    ? `
    <tr>
      <td align="center" style="padding: 8px 0 4px 0;">
        <a href="${cta.href}" target="_blank" rel="noopener"
           style="display: inline-block; background: ${PRIMARY}; color: #ffffff; text-decoration: none;
                  font-weight: 600; font-size: 15px; padding: 13px 28px; border-radius: 10px;
                  box-shadow: 0 4px 10px rgba(79, 70, 229, 0.25); letter-spacing: 0.01em;">
          ${escapeHtml(cta.label)}
        </a>
      </td>
    </tr>`
    : "";

  const footnoteHtml = footnote
    ? `<tr><td style="padding: 14px 0 0 0; color: ${TEXT_MUTED}; font-size: 12px; line-height: 1.6;">${footnote}</td></tr>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escapeHtml(title)}</title>
  <style>
    @media (max-width: 520px) {
      .card { padding: 28px 22px !important; }
      .header { padding: 24px 22px !important; }
      h1.title { font-size: 22px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background: ${BG_PAGE}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: ${TEXT};">
  <!-- Preheader (hidden preview text) -->
  <div style="display: none; font-size: 1px; color: ${BG_PAGE}; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden;">
    ${escapeHtml(preheader)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: ${BG_PAGE};">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"
               style="width: 100%; max-width: 560px; background: ${BG_CARD}; border: 1px solid ${BORDER}; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);">

          <!-- Brand header -->
          <tr>
            <td class="header" style="padding: 28px 32px; background: linear-gradient(135deg, ${PRIMARY_LIGHT} 0%, #ffffff 100%); border-bottom: 1px solid ${BORDER};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" width="44" style="padding-right: 12px;">
                    <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #6366f1 0%, ${PRIMARY_DARK} 100%); border-radius: 10px; text-align: center; line-height: 36px; color: #ffffff; font-weight: 700; font-size: 16px; letter-spacing: -0.02em;">
                      Z
                    </div>
                  </td>
                  <td valign="middle">
                    <div style="color: ${TEXT}; font-size: 16px; font-weight: 700; letter-spacing: -0.01em;">${BRAND_NAME}</div>
                    <div style="color: ${TEXT_MUTED}; font-size: 11px; margin-top: 2px;">${BRAND_TAGLINE}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body card -->
          <tr>
            <td class="card" style="padding: 36px 32px 32px 32px;">
              <h1 class="title" style="margin: 0 0 14px 0; color: ${TEXT}; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.25;">
                ${escapeHtml(title)}
              </h1>
              <div style="color: ${TEXT}; font-size: 15px; line-height: 1.65;">
                ${body}
              </div>

              ${cta ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 28px;">${ctaHtml}${footnoteHtml}</table>` : footnoteHtml ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${footnoteHtml}</table>` : ""}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background: #fafbfc; border-top: 1px solid ${BORDER}; color: ${TEXT_MUTED}; font-size: 12px; line-height: 1.6;">
              You're receiving this email because of activity on your ${BRAND_NAME} account.<br/>
              &copy; ${year} ${BRAND_NAME}. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Plain-text fallback — strip HTML from the body for a minimally readable
  // version. Caller can override by providing their own `text` in params.
  const textBody = body
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const text = [
    `${BRAND_NAME}`,
    "",
    title,
    "",
    textBody,
    cta ? `\n${cta.label}: ${cta.href}` : "",
    footnote ? `\n${footnote.replace(/<[^>]+>/g, "")}` : "",
    "",
    `— The ${BRAND_NAME} team`,
  ]
    .filter(Boolean)
    .join("\n");

  return { html, text };
}
