import { expect, type APIRequestContext } from '@playwright/test';

/**
 * Read the emails the app sends, from a Mailpit test inbox (https://mailpit.axllent.org): run Mailpit locally
 * or as a CI service and point the app's SMTP at it. MAILPIT_URL is its web address (default
 * http://127.0.0.1:8025). Staging with a hosted test inbox (Mailosaur or similar): keep this interface and
 * swap the two API calls below.
 *
 *   const mail = mailbox(request);
 *   const since = new Date();
 *   // ... the action that sends the email
 *   const email = await mail.latest('ali+refund@example.test', { subject: /Refund/, since });
 *   expect(email.text).toContain('5,000');
 *   await page.goto(email.links[0]);
 *
 * Give each test its own address (a +tag, e.g. from data.name) so parallel tests never read each other's mail.
 */
export type Email = { subject: string; text: string; html: string; links: string[] };

type Summary = { ID: string; Subject: string; Created: string };

export function mailbox(request: APIRequestContext, base = process.env.MAILPIT_URL || 'http://127.0.0.1:8025') {
  const api = (path: string) => `${base.replace(/\/+$/, '')}/api/v1${path}`;
  return {
    /** The newest email to `to` (and matching `subject`, sent after `since`), waiting up to `timeout` ms for it. */
    async latest(to: string, options: { subject?: string | RegExp; since?: Date; timeout?: number } = {}): Promise<Email> {
      let found: Summary | undefined;
      await expect
        .poll(
          async () => {
            const res = await request.get(api(`/search?query=${encodeURIComponent(`to:"${to}"`)}`));
            const { messages = [] } = (await res.json()) as { messages?: Summary[] };
            found = messages.find(
              (m) =>
                (!options.since || new Date(m.Created) >= options.since) &&
                (!options.subject || (typeof options.subject === 'string' ? m.Subject.includes(options.subject) : options.subject.test(m.Subject)))
            );
            return Boolean(found);
          },
          { message: `an email to ${to}${options.subject ? ` about ${options.subject}` : ''}`, timeout: options.timeout ?? 15_000 }
        )
        .toBe(true);
      const message = (await (await request.get(api(`/message/${found!.ID}`))).json()) as { Subject: string; Text: string; HTML: string };
      const links = [...new Set(`${message.Text}\n${message.HTML}`.match(/https?:\/\/[^\s"'<>)]+/g) ?? [])];
      return { subject: message.Subject, text: message.Text, html: message.HTML, links };
    },
    /** Delete every email in the inbox (only on a test inbox nobody else uses). */
    async clear(): Promise<void> {
      await request.delete(api('/messages'));
    },
  };
}
