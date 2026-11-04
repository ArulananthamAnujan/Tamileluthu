import React, { useRef, useState } from 'react';
import { SITE } from '../site.js';
import { t, useLang, setLang } from '../i18n.js';
import { buzz } from './isApp.js';
import Auth from '../pages/Auth.jsx';
import Icon, { Kolam } from '../components/Icon.jsx';

const SLIDES = [
  { big: 'அ', title: 'வணக்கம்!', en: 'Your Tamil school, in your pocket.', body: 'Homework, attendance, marks and reports for students, parents and teachers.' },
  { icon: 'writing', title: 'தமிழ் திருத்தி', en: 'Snap your writing, learn from every mistake.', body: 'Take a photo of your book and see each correction with the rule.' },
  { icon: 'bell', title: 'Never miss a thing', en: 'Homework, results and reports, the moment they are ready.', body: 'Plus a new Tamil word every day. Keep your streak going! 🔥' },
];

// First screen of the app for people who are not signed in yet.
export default function Welcome({ joining = false }) {
  const lang = useLang();
  const [i, setI] = useState(0);
  const [auth, setAuth] = useState(joining ? 'signup' : null);
  const track = useRef(null);
  const goTo = (n) => { buzz(); setI(n); track.current?.children[n]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' }); };
  const onScroll = (e) => { const n = Math.round(e.target.scrollLeft / e.target.clientWidth); if (n !== i) setI(n); };

  if (auth) {
    return (
      <div className="ax-welcome auth-mode">
        <div className="ax-bar light">
          <button className="ax-back" onClick={() => setAuth(null)} aria-label={t('Back')}><Icon name="arrow" size={20} /></button>
          <span className="spacer" />
          <button className="btn small" onClick={() => setLang(lang === 'ta' ? 'en' : 'ta')}><Icon name="globe" size={15} />{lang === 'ta' ? 'English' : 'தமிழ்'}</button>
        </div>
        <Auth initial={auth} joining={joining} key={auth} />
      </div>
    );
  }

  return (
    <div className="ax-welcome">
      <Kolam className="ax-kolam w1" /><Kolam className="ax-kolam w2" />
      <div className="ax-bar">
        <span className="ax-brand">{SITE.logoUrl ? <img src={SITE.logoUrl} alt="" /> : <span className="logo-mark">அ</span>}<b>{SITE.schoolTa || SITE.name}</b></span>
        <span className="spacer" />
        <button className="btn small outline-light" onClick={() => setLang(lang === 'ta' ? 'en' : 'ta')}>{lang === 'ta' ? 'English' : 'தமிழ்'}</button>
      </div>
      <div className="slides" ref={track} onScroll={onScroll}>
        {SLIDES.map((s) => (
          <section key={s.title} className="slide">
            <div className="slide-art">{s.big ? <span className="slide-letter">{s.big}</span> : <Icon name={s.icon} size={64} stroke={1.4} />}</div>
            <h1>{s.title}</h1>
            <p className="slide-en">{t(s.en)}</p>
            <p className="slide-body">{t(s.body)}</p>
          </section>
        ))}
      </div>
      <div className="dots">{SLIDES.map((_, n) => <button key={n} className={n === i ? 'on' : ''} onClick={() => goTo(n)} aria-label={`${n + 1}`} />)}</div>
      <div className="welcome-cta">
        {i < SLIDES.length - 1
          ? <button className="btn gold big" onClick={() => goTo(i + 1)}>{t('Next')} <Icon name="arrow" size={18} /></button>
          : <button className="btn gold big" onClick={() => { buzz(); setAuth('signup'); }}>{t('Create your account')} <Icon name="arrow" size={18} /></button>}
        <button className="btn outline-light big" onClick={() => { buzz(); setAuth('signin'); }}>{t('I already have an account')}</button>
        {SITE.school && <p className="small">{SITE.school}</p>}
      </div>
    </div>
  );
}
