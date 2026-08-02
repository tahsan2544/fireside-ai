// Shared, dependency-free safety helpers. Safe to import on client or server.

const CRISIS_PATTERNS: RegExp[] = [
  /\bkill (?:myself|me)\b/i,
  /\bkilling myself\b/i,
  /\bend (?:my life|it all|things)\b/i,
  /\b(?:commit )?suicide\b/i,
  /\bsuicidal\b/i,
  /\btake my own life\b/i,
  /\bdon'?t want to (?:live|be here|wake up)\b/i,
  /\bwant to die\b/i,
  /\bbetter off (?:dead|without me)\b/i,
  /\b(?:cut|cutting|hurt|harm)(?:ting)? myself\b/i,
  /\bself[- ]harm\b/i,
  /\boverdose\b/i,
];

const HARD_BLOCK_PATTERNS: RegExp[] = [
  // sexual content involving minors
  /\b(?:child|minor|underage|teen|preteen|kid)\b[^.?!]{0,40}\b(?:sex|sexual|nude|naked|porn|erotic)\b/i,
  /\b(?:sex|sexual|nude|naked|porn|erotic)\b[^.?!]{0,40}\b(?:child|minor|underage|preteen|kid)\b/i,
  /\bcp\b\s*(?:porn|images)/i,
  // self-harm instructions
  /\bhow (?:to|do i) (?:kill myself|end my life|hang myself|overdose)\b/i,
  /\b(?:best|painless|quickest) way to (?:die|kill myself|end it)\b/i,
  // hate speech / harassment solicitation
  /\bhow (?:to|do i) (?:make|build) a (?:bomb|gun|explosive)\b/i,
];

const HARASSMENT_PATTERNS: RegExp[] = [
  /\b(?:kill|hurt|beat) (?:you|him|her|them)\b/i,
  /\byou should (?:die|kill yourself)\b/i,
  /\bkys\b/i,
  /\b(?:f|ph)a?gg?ot\b/i,
  /\bn[i1]gg[e3]r\b/i,
  /\bretard(?:ed)?\b/i,
  /\bwhore\b/i,
  /\bcunt\b/i,
];

export interface SafetyVerdict {
  crisis: boolean;
  blocked: boolean;
  harassment: boolean;
  reason?: string;
}

export function checkSafety(text: string): SafetyVerdict {
  const t = text ?? "";
  const blocked = HARD_BLOCK_PATTERNS.some((r) => r.test(t));
  const crisis = CRISIS_PATTERNS.some((r) => r.test(t));
  const harassment = HARASSMENT_PATTERNS.some((r) => r.test(t));
  return {
    crisis,
    blocked,
    harassment,
    reason: blocked
      ? "This isn't something I can help with. If you're in danger, please reach out to someone who can be with you."
      : harassment
        ? "Let's keep this room kind. That one can't be sent."
        : undefined,
  };
}

export const CRISIS_RESOURCES = [
  { region: "United States", name: "988 Suicide & Crisis Lifeline", contact: "Call or text 988", url: "https://988lifeline.org" },
  { region: "United Kingdom & Ireland", name: "Samaritans", contact: "Call 116 123", url: "https://www.samaritans.org" },
  { region: "Canada", name: "9-8-8 Suicide Crisis Helpline", contact: "Call or text 988", url: "https://988.ca" },
  { region: "Australia", name: "Lifeline", contact: "Call 13 11 14", url: "https://www.lifeline.org.au" },
  { region: "Everywhere else", name: "Find a Helpline", contact: "Search by country", url: "https://findahelpline.com" },
];

export const DISCLAIMER = "Fireside is a supportive companion, not a therapist or medical provider.";
