/**
 * Minimal SMTP client (implicit TLS, port 465) that works both in Node (dev)
 * and in the Cloudflare Worker runtime (production).
 *
 * There is no npm SMTP client that runs in both, so the protocol is spoken
 * directly: EHLO -> AUTH LOGIN -> MAIL FROM -> RCPT TO -> DATA -> QUIT.
 */

type Duplex = {
  write: (text: string) => Promise<void>;
  read: () => Promise<string>;
  close: () => Promise<void>;
};

async function openWorkerSocket(host: string, port: number): Promise<Duplex | null> {
  try {
    const mod = (await import(/* @vite-ignore */ "cloudflare:sockets" as string)) as {
      connect: (a: string, o?: unknown) => {
        readable: ReadableStream<Uint8Array>;
        writable: WritableStream<Uint8Array>;
        close: () => Promise<void>;
      };
    };
    const socket = mod.connect(`${host}:${port}`, { secureTransport: "on" });
    const writer = socket.writable.getWriter();
    const reader = socket.readable.getReader();
    const enc = new TextEncoder();
    const dec = new TextDecoder();
    return {
      write: async (text) => void (await writer.write(enc.encode(text))),
      read: async () => {
        const { value, done } = await reader.read();
        return done || !value ? "" : dec.decode(value);
      },
      close: async () => {
        try {
          await writer.close();
        } catch {
          /* ignore */
        }
        await socket.close();
      },
    };
  } catch {
    return null;
  }
}

async function openNodeSocket(host: string, port: number): Promise<Duplex> {
  const tls = await import("node:tls");
  const socket = tls.connect({ host, port, servername: host });
  socket.setEncoding("utf8");

  const queue: string[] = [];
  let waiting: ((chunk: string) => void) | null = null;
  socket.on("data", (chunk: string | Buffer) => {
    const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
    if (waiting) {
      const resolve = waiting;
      waiting = null;
      resolve(text);
    } else queue.push(text);
  });

  await new Promise<void>((resolve, reject) => {
    socket.once("secureConnect", () => resolve());
    socket.once("error", reject);
  });

  return {
    write: async (text) => void socket.write(text),
    read: () =>
      new Promise<string>((resolve) => {
        const next = queue.shift();
        if (next !== undefined) resolve(next);
        else waiting = resolve;
      }),
    close: async () => void socket.destroy(),
  };
}

/** Reads until a complete final SMTP reply line (`250 text`) is received. */
async function expect(socket: Duplex, codes: number[]): Promise<string> {
  let buffer = "";
  for (let i = 0; i < 40; i++) {
    buffer += await socket.read();
    const lines = buffer.trim().split(/\r?\n/);
    const last = lines[lines.length - 1] ?? "";
    if (/^\d{3} /.test(last)) {
      const code = Number(last.slice(0, 3));
      if (!codes.includes(code)) throw new Error(`smtp_unexpected_reply: ${last}`);
      return buffer;
    }
  }
  throw new Error("smtp_no_reply");
}

const b64 = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

/** RFC 2047 encoding so Cyrillic subjects and sender names survive. */
const mimeWord = (value: string) => `=?UTF-8?B?${b64(value)}?=`;

/** Unique RFC 5322 Message-ID — Gmail rejects mail without it (550-5.7.1). */
function messageId(domain: string): string {
  const rnd = new Uint8Array(12);
  crypto.getRandomValues(rnd);
  const rand = [...rnd].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `<${Date.now().toString(36)}.${rand}@${domain}>`;
}

function smtpConfig() {
  const host = process.env["SMTP_HOST"];
  const user = process.env["SMTP_USER"];
  const password = process.env["SMTP_PASSWORD"];
  if (!host || !user || !password) return null;
  return {
    host,
    port: Number(process.env["SMTP_PORT"] ?? 465),
    user,
    password,
    fromName: process.env["SMTP_FROM_NAME"] ?? "Техно Форма",
    fromEmail: process.env["SMTP_FROM_EMAIL"] ?? user,
  };
}

export function isMailConfigured(): boolean {
  return smtpConfig() !== null;
}

export async function sendMail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const cfg = smtpConfig();
  if (!cfg) throw new Error("smtp_not_configured");

  const socket = (await openWorkerSocket(cfg.host, cfg.port)) ?? (await openNodeSocket(cfg.host, cfg.port));
  const say = async (line: string, codes: number[]) => {
    await socket.write(`${line}\r\n`);
    return expect(socket, codes);
  };

  const senderDomain = cfg.fromEmail.split("@")[1] ?? cfg.host;

  try {
    await expect(socket, [220]);
    await say(`EHLO ${senderDomain}`, [250]);
    await say("AUTH LOGIN", [334]);
    await say(b64(cfg.user), [334]);
    await say(b64(cfg.password), [235]);
    await say(`MAIL FROM:<${cfg.fromEmail}>`, [250]);
    await say(`RCPT TO:<${params.to}>`, [250, 251]);
    await say("DATA", [354]);

    const boundary = `tf${Date.now().toString(36)}`;
    const body = [
      `From: ${mimeWord(cfg.fromName)} <${cfg.fromEmail}>`,
      `To: <${params.to}>`,
      `Subject: ${mimeWord(params.subject)}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: ${messageId(senderDomain)}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      b64(params.text).replace(/(.{76})/g, "$1\r\n"),
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      b64(params.html).replace(/(.{76})/g, "$1\r\n"),
      `--${boundary}--`,
      "",
      ".",
    ].join("\r\n");

    await socket.write(`${body}\r\n`);
    await expect(socket, [250]);
    await say("QUIT", [221]);
  } finally {
    await socket.close();
  }
}
