// Deterministic guard layer for the research-peptide bots (1775valor.com, valorpeptides.net).
// Defense in depth: the shared system prompt (prompts/peptide-research-guardrails.md) is the
// primary control; this module refuses obvious violations before the model is called,
// scrubs any dosing-like output after, and appends the mandatory disclaimer.
// Only active when GUARD=peptide. Harmless for other sites.

export const DISCLAIMER =
  "Research use only. Not for human or veterinary use. Not evaluated or approved by the FDA to diagnose, treat, cure, or prevent any disease. Educational information, not medical advice. Adults 21+ only.";

const PHYSICIAN = "For any personal health question, please talk with a licensed physician.";

export const REFUSAL_TEXT = (category) => {
  const why = {
    dosing: "I can't provide doses, amounts, or schedules for any compound.",
    administration: "I can't explain how to prepare, reconstitute, inject, or otherwise administer any compound.",
    protocol: "I can't design or describe protocols, cycles, or stacks.",
    personal_health: "I can't give personal health, diagnostic, or treatment guidance.",
    animal_use: "I can't give advice about using any compound in animals or pets.",
    disease_claim: "I can't say that any compound treats, cures, or prevents a condition.",
    fda_claim: "None of these research materials are FDA-approved products, and I can't suggest otherwise.",
    sourcing_for_use: "I can't help with obtaining or using compounds for personal use.",
    minor: "This assistant is for adults 21 and over.",
    dosing_output: "I can't share that kind of detail.",
  }[category] || "I can't help with that request.";
  return `REFUSAL: ${why} I can discuss published laboratory research, regulatory status, and analytical testing in general terms. ${PHYSICIAN}`;
};

const R = (s) => new RegExp(s, "i");
// Order matters: first match wins.
const PRE_RULES = [
  ["minor", R(String.raw`\b(i\s*'?a?m|i am)\s*(1[0-9]|20)\s*(yo|years?\s*old)?\b|\bmy\s+(teen|teenage|son|daughter|kid)\b`)],
  ["animal_use", R(String.raw`\b(my|our|a|the)\s+(dog|cat|horse|pet|puppy|kitten|mare|stallion|gelding|cattle|livestock)\b.*\b(give|use|dose|inject|treat|help|heal)\b|\b(give|use|dose|inject|treat)\b.*\b(dog|cat|horse|pet|puppy|kitten|livestock)\b|\bveterinary\s+use\b`)],
  ["dosing", R(String.raw`\b(dose|doses|dosing|dosage|how\s+much\s+(should|do|would|to)|how\s+many\s+(mg|mcg|units|iu|clicks|ml)|mg\s*/\s*kg|mcg|micrograms?|milligrams?|\d+\s*(mg|mcg|µg|ug|iu|units?|ml|cc)\b|per\s+(day|week|kg)|titrat|microdos|loading\s+phase|maintenance\s+(dose|phase))`)],
  ["administration", R(String.raw`\b(inject|injection|injecting|subq|sub-?q|sub\s*cutaneous|subcutaneous|intramuscular|\bim\b\s+shot|intranasal|nasal\s+spray|sublingual|reconstitut|bac(teriostatic)?\s*water|insulin\s+syringe|pin(ning)?\b|syringe|administer|take\s+(it|this|bpc|tb|them)\b|orally|swallow|capsule\s+form\s+for\s+me)`)],
  ["protocol", R(String.raw`\b(protocol|cycle|cycling|stack|stacking|regimen|blast|cruise|pct|on\s*/\s*off|weeks?\s+on|weeks?\s+off|schedule\s+for\s+(taking|using))\b`)],
  ["personal_health", R(String.raw`\b(i\s+have|i\s*'?ve\s+got|i\s+was\s+diagnosed|my\s+(doctor|injury|tendon|knee|shoulder|back|gut|pain|condition|symptoms?|labs?|bloodwork|diabetes|arthritis|ibs|crohn)|should\s+i\s+(take|use|try)|will\s+it\s+(help|heal|fix|work\s+for)\s+(me|my)|for\s+my\s+(injury|recovery|pain|healing|weight)|is\s+it\s+safe\s+for\s+me|safe\s+to\s+(take|use|combine))`)],
  ["disease_claim", R(String.raw`\b(diseases?|conditions?|illness(es)?|disorders?|ailments?)\b.*\b(treat|cure|heal|prevent|reverse|fix|helps?\s+with)|\b(treat|cure|heal|prevent|reverse)\w*\b.*\b(diseases?|conditions?|illness(es)?|disorders?|ailments?)\b|`+String.raw`\b(cure|cures|treats?|heal|heals|reverse|reverses|prevent|prevents)\b.*\b(cancer|diabetes|arthritis|alzheimer|parkinson|covid|depression|anxiety|obesity|disease|ibs|crohn|tendonitis|injur(y|ies)|ulcer|autism)\b`)],
  ["fda_claim", R(String.raw`\b(is|are)\s+(it|this|they|bpc[- ]?157|tb[- ]?500|these)\s+(fda[- ]?approved|approved\s+by\s+the\s+fda)\b.*\b(say|tell|write|confirm|claim)\b|\b(say|tell\s+(me|people)|write|confirm|claim)\b.*\bfda[- ]?approved\b`)],
  ["sourcing_for_use", R(String.raw`\b(for\s+personal\s+use|for\s+(me|myself)\s+to\s+(use|take)|buy\s+.*\s+(to\s+take|to\s+inject|for\s+my\s+(body|health))|where\s+can\s+i\s+get\s+.*\s+(to\s+take|to\s+use\s+on\s+myself))\b`)],
];

export function preScreen(text) {
  const t = String(text || "");
  for (const [cat, re] of PRE_RULES) if (re.test(t)) return cat;
  return null;
}

// Output scrub: any concrete amount/unit or administration verb pattern -> replace whole answer.
const POST_RE = R(String.raw`\b\d+(\.\d+)?\s*(mg|mcg|µg|ug|iu|units?|ml|cc)\b(?!\s*/\s*mol)|\b(inject|subcutaneous|intramuscular|reconstitute)\s+(it|the|your|with|into|daily|twice)\b|\b(once|twice|three\s+times)\s+(a|per)\s+(day|week)\b|\bfor\s+\d+\s+(days|weeks)\s+(on|then)\b`);
export function postScreen(reply) {
  return POST_RE.test(String(reply || "")) ? "dosing_output" : null;
}

export function isModelRefusal(reply) { return /^\s*REFUSAL:/i.test(String(reply || "")); }

export function withDisclaimer(reply) {
  const r = String(reply || "").trim();
  return r.includes(DISCLAIMER) ? r : `${r}\n\n${DISCLAIMER}`;
}
