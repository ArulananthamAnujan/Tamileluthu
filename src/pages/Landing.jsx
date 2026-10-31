import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase.js';
import { SITE, PRODUCT_KINDS } from '../site.js';
import { money } from '../lib/util.js';
import Icon, { Kolam } from '../components/Icon.jsx';
import InstallButton from '../components/InstallButton.jsx';

export function Logo() {
  return (
    <a className="logo" href="#/" aria-label={`${SITE.nameEn} home`}>
      <span className="logo-mark" aria-hidden="true">அ</span>
      <span className="logo-text"><b>{SITE.name}</b><small>{SITE.nameEn}</small></span>
    </a>
  );
}

export function SiteHeader() {
  return (
    <header className="sitebar">
      <div className="container sitebar-in">
        <Logo />
        <nav className="sitelinks" aria-label="Site">
          <a href="#/" className="hide-sm">Features</a>
          <a href="#/shop">Papers</a>
          <InstallButton />
          <a className="btn small gold" href="#/signin">Sign in</a>
        </nav>
      </div>
    </header>
  );
}

const FEATURES = [
  ['diary', 'Daily diary', 'நாட்குறிப்பு', 'Homework, classwork, notices and events for every class. Students tick work off; parents see what is due.'],
  ['attendance', 'Attendance', 'வருகைப் பதிவு', 'A one-tap roll call. Parents see every class day and the attendance rate.'],
  ['listening', 'Listening exams', 'கேட்டல் தேர்வுகள்', 'Link exams and audio. Release the answers when you are ready.'],
  ['marks', 'Marks', 'மதிப்பெண்கள்', 'Mark once, publish to each student, and email every parent their own child’s result.'],
  ['reports', 'Term reports', 'தேர்ச்சி அறிக்கை', 'Skills, attendance, marks and comments on one page. Print it, save it as a PDF or share it.'],
];

const ROLES = [
  ['users', 'Parents', 'பெற்றோர்', ['Homework and notices every week', 'Attendance, marks and reports', 'Results and reports emailed to you', 'Writing feedback to practise at home']],
  ['school', 'Students', 'மாணவர்', ['Today’s homework at a glance', 'Listening exams in one tap', 'Photograph writing, get instant feedback', 'Follow your own progress']],
  ['writing', 'Teachers', 'ஆசிரியர்', ['Post the diary in seconds', 'Roll call from your phone', 'Markbook with CSV export', 'Reports sent to every parent']],
];

function Preview() {
  return (
    <div className="preview" aria-hidden="true">
      <div className="pv pv-main">
        <div className="pv-head"><span className="pv-dot" /><span className="pv-dot" /><span className="pv-dot" /><span className="pv-title">இன்று · Today</span></div>
        <div className="pv-hw">
          <span className="tag k-homework">Homework · வீட்டுப்பாடம்</span>
          <p>Read பாடம் 4 and answer questions 1–5</p>
          <span className="pv-due">Due Saturday</span>
          <span className="pv-check"><Icon name="check" size={14} stroke={2.6} /> Done</span>
        </div>
        <div className="pv-hw note">
          <span className="tag k-announcement">Notice · அறிவிப்பு</span>
          <p>பொங்கல் விழா — wear traditional clothes</p>
        </div>
      </div>
      <div className="pv pv-mark">
        <div className="ring" style={{ '--p': 85 }}><span>17<small>/20</small></span></div>
        <div><b>Listening test</b><small>Sent to parents</small></div>
      </div>
      <div className="pv pv-att">
        <small>Attendance</small><b>96%</b>
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
            <span className="pill"><Icon name="star" size={14} /> {SITE.school} · Tamil school portal</span>
            <h1>Learn, track and celebrate <em>Tamil</em>, together.</h1>
            <p className="hero-ta">தமிழ் கற்போம் · ஒன்றாக வளர்வோம்</p>
            <p className="hero-lead">Homework, attendance, listening exams, marks and term reports for teachers, students and parents, plus the <b>தமிழ் திருத்தி</b> writing checker. Everything is in one beautiful app.</p>
            <div className="row wrap hero-cta">
              <a className="btn gold big" href="#/signup">Create a free account <Icon name="arrow" size={18} /></a>
              <a className="btn outline-light big" href="#/signin">Sign in</a>
            </div>
            <ul className="trust">
              <li><Icon name="check" size={16} stroke={2.4} /> Free for families</li>
              <li><Icon name="lock" size={16} /> Private by design</li>
              <li><Icon name="phone" size={16} /> Works on any phone</li>
            </ul>
          </div>
          <Preview />
        </div>
      </section>

      <section className="band">
        <div className="container band-in">
          <span>Weekend Tamil schools</span><i />
          <span>Primary to VCE</span><i />
          <span>Tamil &amp; English throughout</span><i />
          <span>Install as an app</span>
        </div>
      </section>

      <section className="sec container" id="features">
        <header className="sec-head">
          <span className="kicker">Everything in one place</span>
          <h2>One app for the whole school</h2>
          <p className="ta-sub">பள்ளிக்கு ஒரே இடம்</p>
        </header>
        <div className="bento">
          <article className="bcard feature-star">
            <Kolam className="kolam-c" />
            <span className="ficon gold"><Icon name="writing" size={24} /></span>
            <h3>தமிழ் திருத்தி <span>Writing checker</span></h3>
            <p>Students photograph a page from their book. Every mistake is underlined with the correct form and the rule in simple English, and teachers and parents see it too.</p>
            <div className="fix-demo">
              <span><s>நான் பள்ளிக்கு போனேன்</s></span>
              <span className="arrow"><Icon name="arrow" size={16} /></span>
              <span><b>நான் பள்ளிக்குப் போனேன்</b></span>
              <small>வல்லினம் மிகும் · a hard consonant doubles after -க்கு</small>
            </div>
          </article>
          {FEATURES.map(([icon, en, ta, text]) => (
            <article key={en} className="bcard">
              <span className="ficon"><Icon name={icon} size={22} /></span>
              <h3>{en} <span>{ta}</span></h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="sec tinted">
        <div className="container">
          <header className="sec-head">
            <span className="kicker">Made for everyone at school</span>
            <h2>For parents, students and teachers</h2>
          </header>
          <div className="roles-x">
            {ROLES.map(([icon, en, ta, items]) => (
              <article key={en} className="rcard">
                <span className="ficon"><Icon name={icon} size={22} /></span>
                <h3>{en} <span>{ta}</span></h3>
                <ul>{items.map((i) => <li key={i}><Icon name="check" size={16} stroke={2.4} />{i}</li>)}</ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="sec container">
        <header className="sec-head">
          <span className="kicker">Ready in minutes</span>
          <h2>How to join</h2>
        </header>
        <ol className="steps-x">
          <li><b>1</b><h3>Teacher creates a class</h3><p>…and shares the 6-letter class code with students.</p></li>
          <li><b>2</b><h3>Students join</h3><p>They create a Student account and enter the class code.</p></li>
          <li><b>3</b><h3>Parents link</h3><p>They enter the parent code shown on their child’s home page.</p></li>
        </ol>
      </section>

      {papers.length > 0 && (
        <section className="sec tinted">
          <div className="container">
            <header className="sec-head row between wrap">
              <div><span className="kicker">Paper shop · வினாத்தாள்கள்</span><h2>Practice papers &amp; listening packs</h2></div>
              <a className="btn outline" href="#/shop">See all papers <Icon name="arrow" size={16} /></a>
            </header>
            <div className="cards">
              {papers.map((p) => (
                <a key={p.id} className="card product link-card" href="#/shop">
                  <div className="row between"><span className="tag">{PRODUCT_KINDS[p.kind]}</span><span className="price">{money(p.price_cents, p.currency)}</span></div>
                  <h3>{p.title}</h3>
                  <p className="small muted">{[p.author && `By ${p.author}`, p.level].filter(Boolean).join(' · ')}</p>
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
            <h2>Ready for the new term?</h2>
            <p>Set up your class today. It is free for students and parents.</p>
          </div>
          <div className="row wrap">
            <a className="btn gold big" href="#/signup">Get started <Icon name="arrow" size={18} /></a>
            <a className="btn outline-light big" href="#/shop">Browse papers</a>
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
          <p className="small">{SITE.tagline}</p>
        </div>
        <div className="foot-links small">
          <a href="#/signin">Sign in</a>
          <a href="#/signup">Create account</a>
          <a href="#/shop">Paper shop</a>
          {SITE.contactEmail && <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>}
        </div>
      </div>
      <div className="container foot-note small">
        <span>© {new Date().getFullYear()} {SITE.school}</span>
        <span>Writing checked by தமிழ் திருத்தி is sent to Anthropic’s Claude for checking. Each family only sees its own child’s records.</span>
      </div>
    </footer>
  );
}
