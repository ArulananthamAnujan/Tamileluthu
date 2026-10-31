import React from 'react';
import { SITE } from '../site.js';
import { t, getLang } from '../i18n.js';
import Icon from '../components/Icon.jsx';

// Contact, privacy and terms pages. Review the wording with your school committee before launch.
export default function Info({ page }) {
  if (page === 'privacy') return <Privacy />;
  if (page === 'terms') return <Terms />;
  return <Contact />;
}

function Wrap({ title, ta, children }) {
  return (
    <article className="card info">
      <h2 className="title">{title} {ta && <span className="ta">· {ta}</span>}</h2>
      {children}
    </article>
  );
}

function Contact() {
  return (
    <Wrap title={t('About & contact')} ta="தொடர்புக்கு">
      <h3>{SITE.school}{SITE.schoolTa ? ` · ${SITE.schoolTa}` : ''}</h3>
      {SITE.about ? <p className="pre">{SITE.about}</p> : <p>{t('A community school teaching Tamil language and culture.')}</p>}
      <ul className="contact">
        {SITE.address && <li><Icon name="school" size={18} /><span>{SITE.address}</span></li>}
        {SITE.contactEmail && <li><Icon name="mail" size={18} /><a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a></li>}
        {SITE.contactPhone && <li><Icon name="phone" size={18} /><a href={`tel:${SITE.contactPhone.replace(/\s/g, '')}`}>{SITE.contactPhone}</a></li>}
        {SITE.whatsappUrl && <li><Icon name="whatsapp" size={18} /><a href={SITE.whatsappUrl} target="_blank" rel="noopener noreferrer">{t('School WhatsApp group')}</a></li>}
      </ul>
      {!SITE.contactEmail && !SITE.contactPhone && <p className="muted small">{t('The school admin can add contact details under Admin → School details.')}</p>}
    </Wrap>
  );
}

function Privacy() {
  const ta = getLang() === 'ta';
  return (
    <Wrap title={t('Privacy')} ta="தனியுரிமை">
      {ta && <p className="card notice small">இந்தப் பக்கத்தின் சுருக்கம்: உங்கள் பிள்ளையின் தகவல்களை அவரின் ஆசிரியர்கள், நீங்கள், பள்ளி நிர்வாகி மட்டுமே பார்க்க முடியும். நாங்கள் தகவல்களை விற்பதில்லை. எழுத்துத் திருத்தத்திற்காக மட்டும் எழுத்தும் புகைப்படங்களும் Anthropic நிறுவனத்தின் Claude-க்கு அனுப்பப்படும்.</p>}
      <h3>What we collect</h3>
      <ul>
        <li>Account details: name, email, role, and (optionally) a parent’s mobile number.</li>
        <li>School records added by teachers: class membership, diary posts, attendance, marks, comments and term reports.</li>
        <li>Writing and photos of writing that students upload to தமிழ் திருத்தி, and the feedback on them.</li>
        <li>Purchases from the paper shop. Card payments are processed by Stripe; we never see or store card numbers.</li>
      </ul>
      <h3>Who can see it</h3>
      <ul>
        <li>A student sees only their own records. A parent sees only the children they linked with the child’s parent code.</li>
        <li>A teacher sees students in the classes they teach, and those students’ parents’ names and phone numbers.</li>
        <li>The school admin (principal) can see records across all classes.</li>
        <li>These rules are enforced by the database itself, not just by the website.</li>
      </ul>
      <h3>Other services we use</h3>
      <ul>
        <li>Supabase (Sydney region) stores the data and logins.</li>
        <li>Anthropic’s Claude checks writing and reads handwriting for தமிழ் திருத்தி.</li>
        <li>An email service sends reports, results and notices to parents, if the school has switched it on.</li>
        <li>Stripe processes payments in the paper shop.</li>
      </ul>
      <h3>Your choices</h3>
      <ul>
        <li>Students can change their parent code and remove a linked parent at any time; parents can unlink a child.</li>
        <li>Students can delete their own writing.</li>
        <li>To correct or delete an account and its records, contact the school{SITE.contactEmail ? ` at ${SITE.contactEmail}` : ''}.</li>
      </ul>
      <p className="muted small">The school obtains parent consent before students use this site. Last updated {new Date().getFullYear()}.</p>
    </Wrap>
  );
}

function Terms() {
  const ta = getLang() === 'ta';
  return (
    <Wrap title={t('Terms & refunds')} ta="விதிமுறைகள்">
      {ta && <p className="card notice small">சுருக்கம்: வாங்கிய வினாத்தாள்களை உங்கள் குடும்பத்தின் படிப்புக்காக மட்டும் பயன்படுத்தவும். கோப்பு திறக்கவில்லை அல்லது தவறான கோப்பு என்றால் 14 நாட்களுக்குள் பள்ளியைத் தொடர்பு கொள்ளுங்கள்; பணம் திருப்பித் தரப்படும்.</p>}
      <h3>Using the site</h3>
      <ul>
        <li>Accounts are for students, parents and teachers of {SITE.school}. Keep your password private.</li>
        <li>தமிழ் திருத்தி gives AI-assisted practice feedback. It can make mistakes and is not an official exam mark.</li>
        <li>Be respectful in anything you write; teachers may remove inappropriate content.</li>
      </ul>
      <h3>Paper shop</h3>
      <ul>
        <li>Papers are licensed for personal study by the buyer’s family. Please do not share or resell them.</li>
        <li>Papers are written by our teachers or listed with their authors’ permission. Official exam papers (for example from VCAA) are not sold here.</li>
        <li>Prices are in Australian dollars and include GST where it applies.</li>
        <li>Your purchase stays in “My papers”, so you can download it again at any time.</li>
      </ul>
      <h3>Refunds</h3>
      <ul>
        <li>If a file will not open, is incomplete or is not what was described, contact the school within 14 days and we will fix it or refund you.</li>
        <li>Your rights under Australian Consumer Law are not affected.</li>
      </ul>
      <p className="muted small">Questions: {SITE.contactEmail || t('contact the school office')}.</p>
    </Wrap>
  );
}
