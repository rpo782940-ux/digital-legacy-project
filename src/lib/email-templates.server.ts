/** Branded HTML letters for Техно Форма (inline styles: email clients ignore CSS files). */

const BRAND = "#0f172a";
const ACCENT = "#c2410c";

function shell(title: string, inner: string): string {
  return `<!doctype html>
<html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:24px 12px;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Arial,Helvetica,sans-serif;color:${BRAND};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
    <tr><td style="background:${BRAND};padding:24px 28px;">
      <div style="font-size:20px;font-weight:bold;color:#ffffff;letter-spacing:1px;">ТЕХНО ФОРМА</div>
      <div style="font-size:12px;color:#cbd5e1;margin-top:4px;">Форми для бетонних виробів</div>
    </td></tr>
    <tr><td style="padding:28px;">${inner}</td></tr>
    <tr><td style="padding:18px 28px;background:#fafafa;border-top:1px solid #efefef;font-size:12px;color:#71717a;line-height:1.6;">
      Техно Форма · technoforma.com.ua · info@technoforma.com.ua<br>
      Якщо ви не робили цей запит — просто проігноруйте цей лист.
    </td></tr>
  </table>
</body></html>`;
}

function codeBlock(code: string): string {
  return `<div style="margin:24px 0;text-align:center;">
    <div style="display:inline-block;padding:14px 28px;border:2px dashed ${ACCENT};border-radius:12px;font-size:32px;letter-spacing:10px;font-weight:bold;color:${ACCENT};">${code}</div>
    <div style="margin-top:10px;font-size:12px;color:#71717a;">Код діє 10 хвилин</div>
  </div>`;
}

type Letter = { subject: string; text: string; html: string };

function letter(params: {
  subject: string;
  heading: string;
  lead: string;
  note: string;
  code: string;
  name: string;
}): Letter {
  const hello = params.name ? `Вітаємо, ${params.name}!` : "Вітаємо!";
  return {
    subject: params.subject,
    text: `${hello}\n\n${params.lead}\n\n${params.code}\n\nКод діє 10 хвилин.\n${params.note}\n\nТехно Форма`,
    html: shell(
      params.heading,
      `<h1 style="margin:0 0 6px;font-size:20px;">${params.heading}</h1>
       <p style="margin:0 0 4px;font-size:15px;color:${BRAND};">${hello}</p>
       <p style="margin:0;font-size:15px;line-height:1.6;color:#3f3f46;">${params.lead}</p>
       ${codeBlock(params.code)}
       <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">${params.note}</p>`,
    ),
  };
}

export function registrationEmail(code: string, name: string): Letter {
  return letter({
    subject: `Код підтвердження реєстрації: ${code} — Техно Форма`,
    heading: "Код підтвердження реєстрації",
    lead: "Щоб завершити реєстрацію на сайті Техно Форма, введіть цей код:",
    note: "Нікому не повідомляйте цей код. Якщо ви не реєструвалися на сайті — просто проігноруйте лист.",
    code,
    name,
  });
}

export function registrationResendEmail(code: string, name: string): Letter {
  return letter({
    subject: `Новий код підтвердження: ${code} — Техно Форма`,
    heading: "Новий код підтвердження",
    lead: "Ви запросили код повторно. Попередній код більше не діє. Введіть новий код:",
    note: "Нікому не повідомляйте цей код.",
    code,
    name,
  });
}

export function passwordResetEmail(code: string, name: string): Letter {
  return letter({
    subject: `Код відновлення пароля: ${code} — Техно Форма`,
    heading: "Код відновлення пароля",
    lead: "Ви запросили відновлення пароля. Введіть цей код на сайті, щоб задати новий пароль:",
    note: "Якщо це були не ви — просто проігноруйте лист, пароль залишиться незмінним.",
    code,
    name,
  });
}
