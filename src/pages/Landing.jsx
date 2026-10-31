import React from 'react';
import { SITE } from '../site.js';

const FEATURES = [
  ['📒', 'Daily diary', 'நாட்குறிப்பு', 'Homework, classwork, notices and events for every class day. Students tick homework off; parents see what is due.'],
  ['✅', 'Attendance', 'வருகைப் பதிவு', 'One-tap roll call. Parents see every class day and the attendance rate.'],
  ['🎧', 'Listening exams', 'கேட்டல் தேர்வுகள்', 'Links to listening exams and audio, with answers released when the teacher is ready.'],
  ['📊', 'Marks', 'மதிப்பெண்கள்', 'Tests and exams marked once, published to each student and emailed to their parents.'],
  ['📄', 'Term reports', 'தேர்ச்சி அறிக்கை', 'Skills, attendance, marks and comments in one report, ready to print or save as PDF.'],
  ['✍️', 'தமிழ் திருத்தி', 'Writing checker', 'Photograph a page of Tamil writing and get each mistake underlined with the correct form and the rule.'],
  ['🛒', 'Paper shop', 'வினாத்தாள்கள்', 'Practice papers and listening packs from our teachers and other authors, free or paid.'],
];

export default function Landing() {
  return (
    <div className="stack landing">
      <section className="hero">
        <div>
          <p className="eyebrow">{SITE.school}</p>
          <h2 className="hero-title">{SITE.name}<span>{SITE.nameEn}</span></h2>
          <p className="hero-text">{SITE.tagline}</p>
          <div className="row wrap">
            <a className="btn primary big" href="#/signup">Create a free account</a>
            <a className="btn big" href="#/signin">Sign in</a>
            <a className="btn big ghost" href="#/shop">Browse papers →</a>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <span>அ</span><span>ஆ</span><span>இ</span><span>ஈ</span><span>உ</span><span>ஊ</span><span>எ</span><span>ஏ</span><span>ஐ</span>
        </div>
      </section>

      <section>
        <h2 className="title center">One place for the whole school</h2>
        <div className="features">
          {FEATURES.map(([icon, en, ta, text]) => (
            <article key={en} className="card feature">
              <span className="ficon" aria-hidden="true">{icon}</span>
              <h3>{en} <span className="ta">· {ta}</span></h3>
              <p className="small">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="roles3">
        <article className="card"><h3>Parents · பெற்றோர்</h3><p className="small">Link your child with their parent code. See homework, attendance, marks, reports and writing feedback. Get an email whenever a report or result is sent.</p></article>
        <article className="card"><h3>Students · மாணவர்</h3><p className="small">Join your class with the class code. See today's homework, do listening exams, check your writing and follow your marks.</p></article>
        <article className="card"><h3>Teachers · ஆசிரியர்</h3><p className="small">Post the diary, take attendance, enter marks, write reports and send them to parents in a few taps. Teacher accounts need a registered email.</p></article>
      </section>

      <section className="card notice">
        <h3>How to get started</h3>
        <ol className="small steps">
          <li>The teacher creates a class and shares the 6-letter <b>class code</b>.</li>
          <li>Each student creates a <b>Student</b> account and enters the class code.</li>
          <li>The student's home page shows a <b>parent code</b>. Parents create a <b>Parent</b> account and enter it.</li>
        </ol>
      </section>

      <footer className="foot-site small muted">
        <span>© {new Date().getFullYear()} {SITE.school}</span>
        {SITE.contactEmail && <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>}
        <span>Writing and photos checked by தமிழ் திருத்தி are sent to Anthropic's Claude for checking. Each family only ever sees its own child's records.</span>
      </footer>
    </div>
  );
}
