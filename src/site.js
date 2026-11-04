// Site-wide settings. Defaults come from .env (VITE_…); the school admin can
// change the name, logo, photo and contacts from the website (Admin → School).
const env = import.meta.env;
export const SITE = {
  name: env.VITE_SITE_NAME || 'தமிழ் எழுத்து',
  nameEn: env.VITE_SITE_NAME_EN || 'Tamil Eluthu',
  school: env.VITE_SCHOOL_NAME || '', // empty until the admin adds the school's details
  schoolTa: '',
  tagline: '',
  about: '',
  contactEmail: env.VITE_CONTACT_EMAIL || '',
  contactPhone: '',
  address: '',
  whatsappUrl: '',
  logoUrl: '',
  heroUrl: '',
  currency: 'aud',
  phoneCountry: env.VITE_PHONE_COUNTRY || '61',
};

// The school's name for sentences and titles; the app's name until the admin adds one.
export const schoolName = () => SITE.school || SITE.nameEn;
// School name with its Tamil name, or empty when the admin has not added it.
export const schoolLine = () => [SITE.school, SITE.schoolTa].filter(Boolean).join(' · ');

export const ACTIVITY_KINDS = {
  homework: { en: 'Homework', ta: 'வீட்டுப்பாடம்' },
  classwork: { en: 'Classwork', ta: 'வகுப்புப்பணி' },
  announcement: { en: 'Notice', ta: 'அறிவிப்பு' },
  event: { en: 'Event', ta: 'நிகழ்வு' },
  reminder: { en: 'Reminder', ta: 'நினைவூட்டல்' },
};

export const ATTENDANCE = {
  present: { en: 'Present', ta: 'வருகை', short: 'P', tashort: 'வ' },
  late: { en: 'Late', ta: 'தாமதம்', short: 'L', tashort: 'தா' },
  absent: { en: 'Absent', ta: 'வரவில்லை', short: 'A', tashort: 'இ' },
  excused: { en: 'Excused', ta: 'விடுப்பு', short: 'E', tashort: 'வி' },
};

export const RESOURCE_KINDS = {
  listening: { en: 'Listening exam', ta: 'கேட்டல் தேர்வு' },
  reading: { en: 'Reading', ta: 'வாசிப்பு' },
  speaking: { en: 'Speaking', ta: 'பேச்சு' },
  past_paper: { en: 'Past paper', ta: 'பழைய வினாத்தாள்' },
  video: { en: 'Video', ta: 'காணொளி' },
  other: { en: 'Other', ta: 'பிற' },
};

export const ASSESSMENT_KINDS = {
  test: { en: 'Test', ta: 'தேர்வு' },
  exam: { en: 'Exam', ta: 'பரீட்சை' },
  listening: { en: 'Listening', ta: 'கேட்டல்' },
  reading: { en: 'Reading', ta: 'வாசிப்பு' },
  speaking: { en: 'Speaking', ta: 'பேச்சு' },
  writing: { en: 'Writing', ta: 'எழுத்து' },
  homework: { en: 'Homework', ta: 'வீட்டுப்பாடம்' },
  other: { en: 'Other', ta: 'பிற' },
};

export const PRODUCT_KINDS = {
  paper: { en: 'Exam paper', ta: 'வினாத்தாள்' },
  listening: { en: 'Listening pack', ta: 'கேட்டல் தொகுப்பு' },
  notes: { en: 'Notes', ta: 'குறிப்புகள்' },
  bundle: { en: 'Bundle', ta: 'தொகுப்பு' },
  other: { en: 'Other', ta: 'பிற' },
};

export const SKILLS = [
  ['listening', 'Listening', 'கேட்டல்'],
  ['speaking', 'Speaking', 'பேசுதல்'],
  ['reading', 'Reading', 'வாசித்தல்'],
  ['writing', 'Writing', 'எழுதுதல்'],
  ['grammar', 'Grammar', 'இலக்கணம்'],
];
// Stored in English; shown in the reader's language.
export const RATINGS = ['Excellent', 'Very good', 'Good', 'Developing', 'Needs support'];
export const RATING_TA = { Excellent: 'மிகச் சிறப்பு', 'Very good': 'மிக நன்று', Good: 'நன்று', Developing: 'வளர்ந்து வருகிறது', 'Needs support': 'உதவி தேவை' };
