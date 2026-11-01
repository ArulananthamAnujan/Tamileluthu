import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase.js';
import { SITE, PRODUCT_KINDS } from '../site.js';
import { money } from '../lib/util.js';
import Icon, { Kolam } from '../components/Icon.jsx';
import InstallButton from '../components/InstallButton.jsx';
import LangToggle from '../components/LangToggle.jsx';
import { t, tl, getLang } from '../i18n.js';

export function Logo() {
  return (
    <a className="logo" href="#/" aria-label={`${SITE.nameEn} home`}>
      <span className="logo-mark" aria-hidden="true">{SITE.logoUrl ? <img src={SITE.logoUrl} alt="" /> : 'அ'}</span>
      <span className="logo-text"><b>{SITE.schoolTa || SITE.name}</b><small>{SITE.school !== 'Tamil School' ? SITE.school : SITE.nameEn}</small></span>
    </a>
  );
}

export function SiteHeader() {
  return (
    <header className="sitebar">
      <div className="container sitebar-in">
        <Logo />
        <nav className="sitelinks" aria-label="Site">
          <a href="#/contact" className="hide-sm">{t('About')}</a>
          <a href="#/shop" className="hide-sm">{t('Papers')}</a>
          <LangToggle className="outline-light" />
          <InstallButton />
          <a className="btn small gold" href="#/signin">{t('Sign in')}</a>
        </nav>
      </div>
    </header>
  );
}

const FEATURES = [
  ['diary', 'Daily diary', 'நாட்குறிப்பு', 'Homework, classwork, notices and events for every class. Students tick work off; parents see what is due.'],
  ['attendance', 'Attendance', 'வருகைப் பதிவு', 'A one-tap roll call. Parents see every class day, and the teacher can WhatsApp a parent when a child is absent.'],
  ['listening', 'Listening exams', 'கேட்டல் தேர்வுகள்', 'Link exams and audio. Release the answers when you are ready.'],
  ['marks', 'Marks', 'மதிப்பெண்கள்', 'Mark once, publish to each student, and send every parent their own child’s result.'],
  ['reports', 'Term reports', 'தேர்ச்சி அறிக்கை', 'Skills, attendance, marks and comments on one page. Print it, save it as a PDF or share it.'],
];

const ROLES = [
  ['users', 'Parents', 'பெற்றோர்', ['Homework and notices every week', 'Attendance, marks and reports', 'Notifications, email and WhatsApp from the teacher', 'Writing feedback to practise at home']],
  ['school', 'Students', 'மாணவர்', ['Today’s homework at a glance', 'Listening exams in one tap', 'Photograph writing, get instant feedback', 'Follow your own progress']],
  ['writing', 'Teachers', 'ஆசிரியர்', ['Post the diary in seconds', 'Roll call from your phone', 'Markbook with CSV export', 'Reports sent to every parent']],
];
const two = (en, ta) => (getLang() === 'ta' ? [ta, t(en)] : [en, ta]);

function Preview() {
  return (
    <div className="preview" aria-hidden="true">
      <div className="pv pv-main">
        <div className="pv-head"><span className="pv-dot" /><span className="pv-dot" /><span className="pv-dot" /><span className="pv-title">இன்று · Today</span></div>
        <div className="pv-hw">
          <span className="tag k-homework">{tl({ en: 'Homework', ta: 'வீட்டுப்பாடம்' })}</span>
          <p>{t('Read பாடம் 4 and answer questions 1–5')}</p>
          <span className="pv-due">{t('Due Saturday')}</span>
          <span className="pv-check"><Icon name="check" size={14} stroke={2.6} /> {t('Done')}</span>
        </div>
        <div className="pv-hw note">
          <span className="tag k-announcement">{tl({ en: 'Notice', ta: 'அறிவிப்பு' })}</span>
          <p>பொங்கல் விழா — {t('wear traditional clothes')}</p>
        </div>
      </div>
      <div className="pv pv-mark">
        <div className="ring" style={{ '--p': 85 }}><span>17<small>/20</small></span></div>
        <div><b>{t('Listening test')}</b><small>{t('Sent to parents')}</small></div>
      </div>
      <div className="pv pv-att">
        <small>{t('Attendance')}</small><b>96%</b>
        <span className="pv-bars">{[1, 1, 1, 0.6, 1, 1, 1, 1].map((v, i) => <i key={i} style={{ height: `${v * 100}%` }} className={v < 1 ? 'late' : ''} />)}</span>
      </div>
      <div className="pv pv-fix">
        <small>தமிழ் திருத்தி</small>
        <p><s>தமில்</s> → <b>தமிழ்</b></p>
        <small className="muted">ல / ள / ழ</small>
      </div>
    </div>
  );
}

export default function Landing() {
  const [papers, setPapers] = useState([]);
  useEffect(() => {
    supabase.from('products').select('id, title, author, level, kind, price_cents, currency').eq('active', true)
      .order('created_at', { ascending: false }).limit(3).then(({ data }) => setPapers(data || []));
  }, []);

  return (
    <div className="site">
      <SiteHeader />

      <section className="hero-x">
        <Kolam className="kolam-a" /><Kolam className="kolam-b" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="pill"><Icon name="star" size={14} /> {SITE.school}{SITE.schoolTa ? ` · ${SITE.schoolTa}` : ''}</span>
            {getLang() === 'ta'
              ? <h1 className="h1-ta">தமிழ் கற்போம், <em>ஒன்றாக</em> வளர்வோம்.</h1>
              : <h1>Learn, track and celebrate <em>Tamil</em>, together.</h1>}
            <p className="hero-ta">{getLang() === 'ta' ? 'Learn, track and celebrate Tamil, together.' : 'தமிழ் கற்போம் · ஒன்றாக வளர்வோம்'}</p>
            <p className="hero-lead">{SITE.tagline || t('Homework, attendance, listening exams, marks and term reports for teachers, students and parents, plus the தமிழ் திருத்தி writing checker. Everything is in one beautiful app.')}</p>
            <div className="row wrap hero-cta">
              <a className="btn gold big" href="#/signup">{t('Create your account')} <Icon name="arrow" size={18} /></a>
              <a className="btn outline-light big" href="#/signin">{t('Sign in')}</a>
              <a className="btn ghost big install-link" href="#/install">📱 {t('Install the app')}</a>
            </div>
            <ul className="trust">
              <li><Icon name="lock" size={16} /> {t('Private by design')}</li>
              <li><Icon name="globe" size={16} /> {t('Tamil & English')}</li>
              <li><Icon name="phone" size={16} /> {t('Works on any phone')}</li>
            </ul>
          </div>
          <Preview />
        </div>
      </section>

      <section className="band">
        <div className="container band-in">
          <span>{t('For Tamil community schools')}</span><i />
          <span>{t('Every year level')}</span><i />
          <span>தமிழ் &amp; English</span><i />
          <span>{t('Install as an app')}</span>
        </div>
      </section>

      {(SITE.heroUrl || SITE.about) && (
        <section className="sec container about-sec">
          <div className={SITE.heroUrl ? 'about-grid' : ''}>
            {SITE.heroUrl && <img className="about-photo" src={SITE.heroUrl} alt={SITE.school} />}
            <div>
              <span className="kicker">{t('About our school')}</span>
              <h2>{SITE.school}</h2>
              {SITE.schoolTa && <p className="ta-sub">{SITE.schoolTa}</p>}
              {SITE.about && <p className="pre about-text">{SITE.about}</p>}
              <div className="row wrap">
                <a className="btn outline" href="#/contact">{t('Contact us')} <Icon name="arrow" size={16} /></a>
                {SITE.whatsappUrl && <a className="btn wa" href={SITE.whatsappUrl} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size={16} />{t('WhatsApp group')}</a>}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="sec container" id="features">
        <header className="sec-head">
          <span className="kicker">{t('Everything in one place')}</span>
          <h2>{getLang() === 'ta' ? 'பள்ளிக்கு ஒரே இடம்' : 'One app for the whole school'}</h2>
          <p className="ta-sub">{getLang() === 'ta' ? 'One app for the whole school' : 'பள்ளிக்கு ஒரே இடம்'}</p>
        </header>
        <div className="bento">
          <article className="bcard feature-star">
            <Kolam className="kolam-c" />
            <span className="ficon gold"><Icon name="writing" size={24} /></span>
            <h3>தமிழ் திருத்தி <span>{t('Writing checker')}</span></h3>
            <p>{t('Students photograph a page from their book. Every mistake is underlined with the correct form and the rule in simple English, and teachers and parents see it too.')}</p>
            <div className="fix-demo">
              <span><s>நான் பள்ளிக்கு போனேன்</s></span>
              <span className="arrow"><Icon name="arrow" size={16} /></span>
              <span><b>நான் பள்ளிக்குப் போனேன்</b></span>
              <small>வல்லினம் மிகும் · {t('a hard consonant doubles after -க்கு')}</small>
            </div>
          </article>
          {FEATURES.map(([icon, en, ta, text]) => {
            const [a, b] = two(en, ta);
            return (
              <article key={en} className="bcard">
                <span className="ficon"><Icon name={icon} size={22} /></span>
                <h3>{a} <span>{b}</span></h3>
                <p>{t(text)}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="sec tinted">
        <div className="container">
          <header className="sec-head">
            <span className="kicker">{t('Made for everyone at school')}</span>
            <h2>{t('For parents, students and teachers')}</h2>
          </header>
          <div className="roles-x">
            {ROLES.map(([icon, en, ta, items]) => {
              const [a, b] = two(en, ta);
              return (
                <article key={en} className="rcard">
                  <span className="ficon"><Icon name={icon} size={22} /></span>
                  <h3>{a} <span>{b}</span></h3>
                  <ul>{items.map((i) => <li key={i}><Icon name="check" size={16} stroke={2.4} />{t(i)}</li>)}</ul>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="sec container">
        <header className="sec-head">
          <span className="kicker">{t('Ready in minutes')}</span>
          <h2>{t('How to join')}</h2>
        </header>
        <ol className="steps-x">
          <li><b>1</b><h3>{t('Teacher creates a class')}</h3><p>{t('…and shares the 6-letter class code with students.')}</p></li>
          <li><b>2</b><h3>{t('Students join')}</h3><p>{t('They create a Student account and enter the class code.')}</p></li>
          <li><b>3</b><h3>{t('Parents link')}</h3><p>{t('They enter the parent code shown in their child’s account.')}</p></li>
        </ol>
      </section>

      {papers.length > 0 && (
        <section className="sec tinted">
          <div className="container">
            <header className="sec-head row between wrap">
              <div><span className="kicker">{t('Paper shop')} · வினாத்தாள்கள்</span><h2>{t('Practice papers & listening packs')}</h2></div>
              <a className="btn outline" href="#/shop">{t('See all papers')} <Icon name="arrow" size={16} /></a>
            </header>
            <div className="cards">
              {papers.map((p) => (
                <a key={p.id} className="card product link-card" href="#/shop">
                  <div className="row between"><span className="tag">{tl(PRODUCT_KINDS[p.kind])}</span><span className="price">{money(p.price_cents, p.currency)}</span></div>
                  <h3>{p.title}</h3>
                  <p className="small muted">{[p.author && `${t('By')} ${p.author}`, p.level].filter(Boolean).join(' · ')}</p>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="cta-band">
        <Kolam className="kolam-d" />
        <div className="container cta-in">
          <div>
            <h2>{t('Ready for the new term?')}</h2>
            <p>{t('Set up your class today. Students and parents join with a code.')}</p>
          </div>
          <div className="row wrap">
            <a className="btn gold big" href="#/signup">{t('Get started')} <Icon name="arrow" size={18} /></a>
            <a className="btn outline-light big" href="#/shop">{t('Browse papers')}</a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="sitefoot">
      <div className="container foot-grid">
        <div>
          <Logo />
          <p className="small">{SITE.tagline || t('Everything for our Tamil school in one place: homework, attendance, listening exams, marks, reports for parents, and the தமிழ் திருத்தி writing checker.')}</p>
          {SITE.address && <p className="small">{SITE.address}</p>}
        </div>
        <div className="foot-links small">
          <a href="#/signin">{t('Sign in')}</a>
          <a href="#/signup">{t('Create account')}</a>
          <a href="#/shop">{t('Paper shop')}</a>
          <a href="#/contact">{t('About & contact')}</a>
          <a href="#/privacy">{t('Privacy')}</a>
          <a href="#/terms">{t('Terms & refunds')}</a>
          {SITE.whatsappUrl && <a href={SITE.whatsappUrl} target="_blank" rel="noopener noreferrer">{t('WhatsApp group')}</a>}
        </div>
      </div>
      <div className="container foot-note small">
        <span>v{__BUILD__}</span>
        <span>© {new Date().getFullYear()} {SITE.school}{SITE.contactEmail ? ` · ${SITE.contactEmail}` : ''}{SITE.contactPhone ? ` · ${SITE.contactPhone}` : ''}</span>
        <span>{t('Writing checked by தமிழ் திருத்தி is sent to AI models for checking. Each family only sees its own child’s records.')}</span>
      </div>
    </footer>
  );
}
