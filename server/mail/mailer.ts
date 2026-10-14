import "server-only"

import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import nodemailer from "nodemailer"

export type MailAttachment = {
  filename: string
  content: Buffer
  contentType: string
}

export type MailMessage = {
  to: string[]
  subject: string
  text: string
  attachments: MailAttachment[]
}

export type MailResult = { delivery: "smtp" | "outbox"; location: string }

export function outboxDir() {
  return path.resolve(
    /* turbopackIgnore: true */ process.env.SQLBOARD_OUTBOX_DIR ??
      ".data/outbox"
  )
}

/** Domains allowed as recipients (SQLBOARD_MAIL_ALLOWED_DOMAINS); empty: any. */
export function allowedDomains(): string[] {
  return (process.env.SQLBOARD_MAIL_ALLOWED_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean)
}

export function recipientAllowed(email: string, domains = allowedDomains()) {
  if (!domains.length) return true
  const domain = email.split("@").pop()?.toLowerCase() ?? ""
  return domains.includes(domain)
}

/**
 * Sends through SMTP_URL when configured. Without it, the message is written
 * as an .eml file to the outbox directory (development and tests), so nothing
 * leaves the machine by accident.
 */
export async function sendMail(message: MailMessage): Promise<MailResult> {
  const from = process.env.SMTP_FROM ?? "sqlboard <sqlboard@localhost>"
  const mail = {
    from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    attachments: message.attachments,
  }
  if (process.env.SMTP_URL) {
    const transport = nodemailer.createTransport(process.env.SMTP_URL)
    const info = await transport.sendMail(mail)
    return { delivery: "smtp", location: String(info.messageId ?? "") }
  }
  const transport = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: "unix",
  })
  const info = await transport.sendMail(mail)
  const dir = outboxDir()
  await mkdir(dir, { recursive: true })
  const file = path.join(
    dir,
    `${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 8)}.eml`
  )
  await writeFile(file, info.message as Buffer)
  return { delivery: "outbox", location: file }
}
