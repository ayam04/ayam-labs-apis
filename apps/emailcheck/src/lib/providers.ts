/** Static classification tables. */

const FREE_PROVIDER_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "outlook.de", "hotmail.com", "hotmail.co.uk", "hotmail.de",
  "hotmail.fr", "hotmail.it", "hotmail.es", "live.com", "live.co.uk", "live.ca", "live.de", "live.fr",
  "msn.com", "yahoo.com", "yahoo.co.uk", "yahoo.co.in", "yahoo.fr", "yahoo.de", "yahoo.es", "yahoo.it",
  "yahoo.com.br", "yahoo.com.au", "yahoo.ca", "ymail.com", "rocketmail.com", "aol.com",
  "icloud.com", "me.com", "mac.com", "proton.me", "protonmail.com", "pm.me", "tutanota.com", "tuta.io",
  "zoho.com", "zohomail.com", "gmx.com", "gmx.de", "gmx.net", "gmx.at", "gmx.ch", "web.de",
  "mail.com", "mail.ru", "bk.ru", "inbox.ru", "list.ru", "rambler.ru", "yandex.com", "yandex.ru",
  "yandex.by", "yandex.kz", "qq.com", "foxmail.com", "163.com", "126.com", "yeah.net", "sina.com",
  "naver.com", "daum.net", "hanmail.net", "nate.com", "seznam.cz", "wp.pl", "o2.pl", "interia.pl",
  "libero.it", "virgilio.it", "tiscali.it", "orange.fr", "laposte.net", "free.fr", "sfr.fr",
  "wanadoo.fr", "bluewin.ch", "uol.com.br", "bol.com.br", "terra.com.br", "ig.com.br",
  "rediffmail.com", "indiatimes.com", "fastmail.com", "hushmail.com", "mailfence.com",
]);

const ROLE_ACCOUNTS = new Set([
  "abuse", "admin", "administrator", "accounts", "accounting", "all", "alerts", "api", "billing",
  "careers", "compliance", "contact", "contracts", "customerservice", "customersupport", "dev",
  "devnull", "devops", "director", "dns", "donotreply", "downloads", "enquiries", "enquiry",
  "everyone", "feedback", "finance", "fraud", "ftp", "hello", "help", "helpdesk", "hostmaster",
  "hr", "info", "inquiries", "insurance", "invoices", "it", "jobs", "legal", "mail", "mailer-daemon",
  "marketing", "media", "newsletter", "no-reply", "nobody", "noreply", "notifications", "office",
  "operations", "orders", "owner", "partners", "payments", "payroll", "postmaster", "press",
  "privacy", "procurement", "products", "receipts", "recruiting", "recruitment", "returns",
  "root", "sales", "security", "service", "services", "shipping", "shop", "social", "spam",
  "staff", "store", "subscribe", "support", "sysadmin", "team", "tech", "test", "treasury",
  "unsubscribe", "usenet", "webmaster", "welcome", "wholesale",
]);

const PROVIDER_PATTERNS: Array<[RegExp, string]> = [
  [/google\.com$|googlemail\.com$|gsuite\.com$/, "Google Workspace / Gmail"],
  [/outlook\.com$|protection\.outlook\.com$|hotmail\.com$|microsoft\.com$/, "Microsoft 365 / Outlook"],
  [/pphosted\.com$|proofpoint\.com$/, "Proofpoint"],
  [/mimecast\.com$/, "Mimecast"],
  [/barracudanetworks\.com$|barracuda\.com$/, "Barracuda"],
  [/amazonses\.com$/, "Amazon SES"],
  [/sendgrid\.net$|sendgrid\.com$/, "SendGrid"],
  [/mailgun\.org$|mailgun\.net$/, "Mailgun"],
  [/zoho\.com$|zohomail\.com$/, "Zoho Mail"],
  [/yandex\.net$|yandex\.ru$/, "Yandex Mail"],
  [/qq\.com$/, "Tencent QQ Mail"],
  [/mail\.icloud\.com$|icloud\.com$/, "iCloud Mail"],
  [/protonmail\.ch$|proton\.me$/, "Proton Mail"],
  [/fastmail\.com$|messagingengine\.com$/, "Fastmail"],
  [/rackspace\.com$|emailsrvr\.com$/, "Rackspace Email"],
  [/messagelabs\.com$|symanteccloud\.com$/, "Symantec Email Security"],
  [/hornetsecurity\.com$|hornetsecurity\.de$/, "Hornetsecurity"],
  [/spamexperts\.com$|com\.ar\.spamexperts/, "SpamExperts"],
  [/improvmx\.com$/, "ImprovMX"],
  [/forwardemail\.net$/, "ForwardEmail"],
  [/cloudflare\.net$|improvmx\.com$/, "Cloudflare Email Routing"],
  [/secureserver\.net$/, "GoDaddy Email"],
  [/registrar-servers\.com$/, "Namecheap Private Email"],
  [/titan\.email$/, "Titan Email"],
  [/gandi\.net$/, "Gandi Mail"],
  [/hostinger\.(?:com|io)$/, "Hostinger Email"],
];

export function isFreeProvider(domain: string): boolean {
  return FREE_PROVIDER_DOMAINS.has(domain.toLowerCase());
}

export function isRoleAccount(localPart: string): boolean {
  const base = (localPart.split("+")[0] ?? localPart).toLowerCase().replace(/[._-]/g, "");
  return ROLE_ACCOUNTS.has(base);
}

export function detectProvider(mxRecords: Array<{ exchange: string }>): string | null {
  for (const record of mxRecords) {
    const exchange = record.exchange.toLowerCase();
    for (const [pattern, name] of PROVIDER_PATTERNS) {
      if (pattern.test(exchange)) return name;
    }
  }
  return null;
}

export const FREE_PROVIDER_COUNT = FREE_PROVIDER_DOMAINS.size;
export const ROLE_ACCOUNT_COUNT = ROLE_ACCOUNTS.size;
