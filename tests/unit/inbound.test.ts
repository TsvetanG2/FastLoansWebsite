import { describe, expect, it } from 'vitest';
import { bareAddress, buildForward, forwardDecision, parseAddressList } from '../../src/lib/inbound';

const INBOX = ['finance@royalfinance.bg'];
const OWN = 'Royal Finance <noreply@royalfinance.bg>';

describe('addresses', () => {
  it('reads "Name <a@b>" and plain addresses, lower case', () => {
    expect(bareAddress('Иван <Ivan@Example.com>')).toBe('ivan@example.com');
    expect(bareAddress(' a@b.bg ')).toBe('a@b.bg');
  });
  it('parses a comma-separated env value and drops junk', () => {
    expect(parseAddressList('finance@royalfinance.bg, Info <INFO@royalfinance.bg>,, nonsense')).toEqual([
      'finance@royalfinance.bg',
      'info@royalfinance.bg',
    ]);
    expect(parseAddressList(undefined)).toEqual([]);
  });
});

describe('which mail is forwarded', () => {
  const mail = { from: 'ivan@example.com', to: ['finance@royalfinance.bg'] };
  it('forwards mail to our address (to, cc or received_for)', () => {
    expect(forwardDecision(mail, INBOX, OWN)).toBe('forward');
    expect(forwardDecision({ from: 'x@y.bg', to: ['other@x.bg'], cc: ['Finance@RoyalFinance.bg'] }, INBOX, OWN)).toBe('forward');
    expect(forwardDecision({ from: 'x@y.bg', to: ['list@x.bg'], received_for: ['finance@royalfinance.bg'] }, INBOX, OWN)).toBe('forward');
  });
  it('skips other addresses on the domain', () => {
    expect(forwardDecision({ from: 'x@y.bg', to: ['random@royalfinance.bg'] }, INBOX, OWN)).toBe('not_our_address');
  });
  it('never forwards our own sender (no loops on auto-replies/bounces)', () => {
    expect(forwardDecision({ from: 'noreply@royalfinance.bg', to: INBOX }, INBOX, OWN)).toBe('own_sender');
  });
});

describe('forwarded copy', () => {
  const email = {
    from: 'Иван <ivan@example.com>',
    to: INBOX,
    subject: 'Въпрос\r\nBcc: evil@example.com',
    reply_to: null,
    html: '<p>Здравейте</p>',
    text: 'Здравейте',
    created_at: '2026-10-24T09:30:00Z',
  };
  const files = [
    { filename: 'a.pdf', content_type: 'application/pdf', content_disposition: 'attachment' as const, download_url: 'https://x/a' },
    { filename: 'logo.png', content_type: 'image/png', content_disposition: 'inline' as const, content_id: 'l', download_url: 'https://x/l' },
  ];
  const copy = buildForward(email, files, 'finance@royalfinance.bg');
  it('replies go to the sender', () => {
    expect(copy.replyTo).toEqual(['Иван <ivan@example.com>']);
    expect(buildForward({ ...email, reply_to: ['help@example.com'] }, [], 'x').replyTo).toEqual(['help@example.com']);
  });
  it('names the sender and our address on top, escaped', () => {
    expect(copy.html.startsWith('<div')).toBe(true);
    expect(copy.html).toContain('Иван &lt;ivan@example.com&gt;');
    expect(copy.html).toContain('finance@royalfinance.bg');
    expect(copy.text).toContain('Иван <ivan@example.com>');
  });
  it('keeps the subject on one line (no header injection)', () => {
    expect(copy.subject).not.toMatch(/[\r\n]/);
  });
  it('keeps real attachments; inline images are already in the HTML', () => {
    expect(copy.attachments).toEqual([{ path: 'https://x/a', filename: 'a.pdf', content_type: 'application/pdf' }]);
  });
  it('plain-text-only mail is shown escaped', () => {
    expect(buildForward({ ...email, html: null, text: '<script>' }, [], 'x').html).toContain('&lt;script&gt;');
  });
});
