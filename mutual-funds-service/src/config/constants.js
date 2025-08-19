export const AMFI_URL = "https://www.amfiindia.com/spages/NAVAll.txt";

export const AMC_WHITELIST = new Set([    // these are the AMCs we are interested in
  'ICICI PRUDENTIAL MUTUAL FUND',
  'HDFC MUTUAL FUND',
  'AXIS MUTUAL FUND',
  'ADITYA BIRLA SUN LIFE MUTUAL FUND',
  'PPFAS MUTUAL FUND',
  'QUANT MUTUAL FUND',
  'MOTILAL OSWAL MUTUAL FUND',
  'SBI MUTUAL FUND',
  'KOTAK MAHINDRA MUTUAL FUND',
  'TATA MUTUAL FUND',
  'NIPPON INDIA MUTUAL FUND',
  'MIRAE ASSET MUTUAL FUND',
]);

export const CATEGORY_REGEX = {         // these regex patterns help identify the category of the mutual fund Scheme
  LARGE_CAP: /\bLARGE\s*-?\s*CAP\b/i,
  MID_CAP:   /\bMID\s*-?\s*CAP\b/i,
  SMALL_CAP: /\bSMALL\s*-?\s*CAP\b/i,
  FLEXI_CAP: /\bFLEXI\s*-?\s*CAP\b/i,
  MULTI_CAP: /\bMULTI\s*-?\s*CAP\b/i,
};

export function normalizeAMC(name = '') {
  return name.trim().toUpperCase();
}

export function detectCategory(schemeName = '') {
  if (CATEGORY_REGEX.LARGE_CAP.test(schemeName)) return 'LARGE_CAP';
  if (CATEGORY_REGEX.MID_CAP.test(schemeName))   return 'MID_CAP';
  if (CATEGORY_REGEX.SMALL_CAP.test(schemeName)) return 'SMALL_CAP';
  if (CATEGORY_REGEX.FLEXI_CAP.test(schemeName)) return 'FLEXI_CAP';
  if (CATEGORY_REGEX.MULTI_CAP.test(schemeName)) return 'MULTI_CAP';
  return null;
}