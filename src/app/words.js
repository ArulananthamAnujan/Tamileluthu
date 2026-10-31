// Everyday Tamil words for the daily word quiz: [Tamil, how it sounds, meaning].
// Teachers can add more; one word is picked per day, the same for everyone.
export const WORDS = [
  ['வணக்கம்', 'vaṇakkam', 'hello, greetings'], ['நன்றி', 'naṉṟi', 'thank you'], ['அம்மா', 'ammā', 'mother'],
  ['அப்பா', 'appā', 'father'], ['பள்ளி', 'paḷḷi', 'school'], ['புத்தகம்', 'puttakam', 'book'],
  ['நண்பன்', 'naṇpaṉ', 'friend (boy)'], ['தண்ணீர்', 'taṇṇīr', 'water'], ['வீடு', 'vīṭu', 'house, home'],
  ['மரம்', 'maram', 'tree'], ['பூ', 'pū', 'flower'], ['கடல்', 'kaṭal', 'sea'],
  ['மழை', 'maḻai', 'rain'], ['வானம்', 'vāṉam', 'sky'], ['நிலா', 'nilā', 'moon'],
  ['சூரியன்', 'sūriyaṉ', 'sun'], ['பறவை', 'paṟavai', 'bird'], ['யானை', 'yāṉai', 'elephant'],
  ['பூனை', 'pūṉai', 'cat'], ['நாய்', 'nāy', 'dog'], ['மீன்', 'mīṉ', 'fish'],
  ['பழம்', 'paḻam', 'fruit'], ['காய்கறி', 'kāykaṟi', 'vegetable'], ['பால்', 'pāl', 'milk'],
  ['கண்', 'kaṇ', 'eye'], ['கை', 'kai', 'hand'], ['கால்', 'kāl', 'leg, foot'],
  ['தலை', 'talai', 'head'], ['மகிழ்ச்சி', 'makiḻcci', 'happiness'], ['அன்பு', 'aṉpu', 'love, kindness'],
  ['காலை', 'kālai', 'morning'], ['மாலை', 'mālai', 'evening'], ['இரவு', 'iravu', 'night'],
  ['நேற்று', 'nēṟṟu', 'yesterday'], ['நாளை', 'nāḷai', 'tomorrow'], ['இன்று', 'iṉṟu', 'today'],
  ['ஆசிரியர்', 'āciriyar', 'teacher'], ['மாணவர்', 'māṇavar', 'student'], ['கதை', 'katai', 'story'],
  ['பாட்டு', 'pāṭṭu', 'song'], ['விளையாட்டு', 'viḷaiyāṭṭu', 'game, sport'], ['கடிதம்', 'kaṭitam', 'letter (mail)'],
  ['ஊர்', 'ūr', 'home town, village'], ['நாடு', 'nāṭu', 'country'], ['மொழி', 'moḻi', 'language'],
  ['அறிவு', 'aṟivu', 'knowledge'], ['பொறுமை', 'poṟumai', 'patience'], ['உண்மை', 'uṇmai', 'truth'],
  ['உதவி', 'utavi', 'help'], ['நேரம்', 'nēram', 'time'], ['வேலை', 'vēlai', 'work, job'],
  ['குடும்பம்', 'kuṭumpam', 'family'], ['விழா', 'viḻā', 'festival, celebration'], ['அழகு', 'aḻaku', 'beauty'],
  ['சிரிப்பு', 'cirippu', 'laughter, smile'], ['கனவு', 'kaṉavu', 'dream'], ['பயணம்', 'payaṇam', 'journey, trip'],
  ['உணவு', 'uṇavu', 'food'], ['மருத்துவர்', 'maruttuvar', 'doctor'], ['வெற்றி', 'veṟṟi', 'victory, success'],
];

// Famous couplets about learning and kindness: [line 1, line 2, number, meaning].
export const KURALS = [
  ['அகர முதல எழுத்தெல்லாம் ஆதி', 'பகவன் முதற்றே உலகு', 1, 'As the letter அ is the first of all letters, God is the first of the world.'],
  ['கற்க கசடறக் கற்பவை கற்றபின்', 'நிற்க அதற்குத் தக', 391, 'Learn thoroughly what is worth learning, and then live by what you have learnt.'],
  ['தொட்டனைத் தூறும் மணற்கேணி மாந்தர்க்குக்', 'கற்றனைத் தூறும் அறிவு', 396, 'The deeper you dig a well in sand, the more water flows; the more you learn, the more knowledge grows.'],
  ['கேடில் விழுச்செல்வம் கல்வி ஒருவற்கு', 'மாடல்ல மற்றை யவை', 400, 'Learning is the one wealth that never perishes; other riches are not true wealth.'],
  ['இனிய உளவாக இன்னாத கூறல்', 'கனியிருப்பக் காய்கவர்ந் தற்று', 100, 'Speaking harsh words when kind ones are at hand is like picking unripe fruit when ripe fruit is there.'],
];

const dayNumber = (d = new Date()) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
export const wordOfDay = (d) => WORDS[dayNumber(d) % WORDS.length];
export const kuralOfWeek = (d) => KURALS[Math.floor(dayNumber(d) / 7) % KURALS.length];
export { dayNumber };
