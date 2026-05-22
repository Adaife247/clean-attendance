export const rpName = 'CampusCheck FUOYE';

// NEXT_PUBLIC_DOMAIN should be your Vercel URL when deployed (e.g., 'campuscheck.vercel.app')
export const rpID = process.env.NODE_ENV === 'production' ? process.env.NEXT_PUBLIC_DOMAIN! : 'localhost';

export const origin = process.env.NODE_ENV === 'production' ? `https://${process.env.NEXT_PUBLIC_DOMAIN}` : 'http://localhost:3000';