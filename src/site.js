// Site-wide settings. Change these for your school (or set the VITE_ values in .env).
const env = import.meta.env;
export const SITE = {
  name: env.VITE_SITE_NAME || 'தமிழ் எழுத்து',
  nameEn: env.VITE_SITE_NAME_EN || 'Tamil Eluthu',
  school: env.VITE_SCHOOL_NAME || 'Tamil School',
  tagline: 'Everything for our Tamil school in one place: daily homework, attendance, listening exams, marks, reports for parents, and the தமிழ் திருத்தி writing checker.',
  contactEmail: env.VITE_CONTACT_EMAIL || '',
  currency: 'aud',
};

export const ACTIVITY_KINDS = {
  homework: { label: 'Homework', ta: 'வீட்டுப்பாடம்' },
  classwork: { label: 'Classwork', ta: 'வகுப்புப்பணி' },
  announcement: { label: 'Notice', ta: 'அறிவிப்பு' },
  event: { label: 'Event', ta: 'நிகழ்வு' },
  reminder: { label: 'Reminder', ta: 'நினைவூட்டல்' },
};

export const ATTENDANCE = {
  present: { label: 'Present', short: 'P' },
  late: { label: 'Late', short: 'L' },
  absent: { label: 'Absent', short: 'A' },
  excused: { label: 'Excused', short: 'E' },
};

export const RESOURCE_KINDS = {
  listening: 'Listening exam',
  reading: 'Reading',
  speaking: 'Speaking',
  past_paper: 'Past paper',
  video: 'Video',
  other: 'Other',
};

export const ASSESSMENT_KINDS = {
  test: 'Test', exam: 'Exam', listening: 'Listening', reading: 'Reading',
  speaking: 'Speaking', writing: 'Writing', homework: 'Homework', other: 'Other',
};

export const PRODUCT_KINDS = { paper: 'Exam paper', listening: 'Listening pack', notes: 'Notes', bundle: 'Bundle', other: 'Other' };

export const SKILLS = [
  ['listening', 'Listening', 'கேட்டல்'],
  ['speaking', 'Speaking', 'பேசுதல்'],
  ['reading', 'Reading', 'வாசித்தல்'],
  ['writing', 'Writing', 'எழுதுதல்'],
  ['grammar', 'Grammar', 'இலக்கணம்'],
];
export const RATINGS = ['Excellent', 'Very good', 'Good', 'Developing', 'Needs support'];
