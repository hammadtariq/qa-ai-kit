### Emails (Mailpit test inbox)

- Emails the app sends go to a Mailpit test inbox (`MAILPIT_URL`, default `http://127.0.0.1:8025`), never a real
  mailbox. Read them with `mailbox(request).latest(to, { subject, since })` from `e2e/support/mailbox.ts`, then
  assert the business values in the text and follow `links` instead of copying tokens by hand.
- Each test sends to its own address (`ali+<tag>@example.test`), so parallel workers don't read each other's mail.
