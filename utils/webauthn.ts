// This is the name that shows up natively on FaceID / Fingerprint prompts
export const rpName = 'CampusCheck';

export const rpID = process.env.NODE_ENV === 'production' ? process.env.NEXT_PUBLIC_DOMAIN! : 'localhost';

export const origin = process.env.NODE_ENV === 'production' ? `https://${process.env.NEXT_PUBLIC_DOMAIN}` : 'http://localhost:3000';