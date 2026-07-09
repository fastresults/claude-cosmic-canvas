# Voice Personas Catalog — PRD

Self-contained specification for reproducing AskEve's written-voice system in another app. Covers the schema every voice conforms to, the composition contract used at generation time, and the full 54-persona catalog currently seeded in `system_voices`.

## 1. Voice schema (12 fields + meta)

| # | Field | Type | Purpose |
|---|---|---|---|
| 1 | `name` | string | Display name |
| 2 | `profession` | string | One-line role/domain |
| 3 | `tagline` | string | 4–10 word essence |
| 4 | `category` | enum | One of the 10 category IDs (see below) |
| 5 | `tone` | string | Emotional/stylistic essence, 1–3 sentences |
| 6 | `guidelines` | markdown | Structural rules — hooks, do/don't, closings |
| 7 | `formality` | int 0–100 | Casual ↔ formal |
| 8 | `humor` | int 0–100 | Serious ↔ playful |
| 9 | `technicality` | int 0–100 | Plainspoken ↔ technical |
| 10 | `conciseness` | int 0–100 | Expansive ↔ terse |
| 11 | `preferred_terms` | string[] | 5–10 words/phrases to favor |
| 12 | `avoid_terms` | string[] | 5–10 words/phrases to suppress |
| 13 | `writing_samples` | string[] | 2–3 short exemplar paragraphs |
| 14 | `is_visible / sort_order / created_by` | meta | Library curation |

## 2. Slider semantics (0–100)

- **Formality** — 0 = "yo, real talk"; 50 = neutral prose; 100 = board-memo formal.
- **Humor** — 0 = deadpan/clinical; 50 = occasional wit; 100 = comedic voice.
- **Technicality** — 0 = jargon-free; 50 = domain terms defined; 100 = expert-to-expert.
- **Conciseness** — 0 = luxuriant/lyrical; 50 = balanced; 100 = maximally terse.

## 3. Category taxonomy

| ID | Label |
|---|---|
| `public_figures` | Public Figures |
| `business_leaders` | Business Leaders |
| `consulting_strategy` | Consulting & Strategy |
| `marketing_sales` | Marketing & Sales |
| `thought_leadership` | Thought Leadership |
| `academic_journalism` | Academic & Journalism |
| `journalism` | Journalism |
| `coaching_self_help` | Coaching & Self-Help |
| `investment_finance` | Investment & Finance |
| `spirituality` | Spirituality |
| `other` | Other |

## 4. Composition contract

Every generation call assembles the style block in this fixed order and prepends it to the model's system prompt:

1. `WRITING VOICE: {name}`
2. `Tone: {tone}`
3. Slider line: `formality=, humor=, technicality=, conciseness=`
4. `Guidelines:` block
5. `Prefer these words/phrases: …`
6. `Never use these: …`
7. `Reference writing samples:` (2 max)
8. (Optional) `LEARNED PREFERENCES` — top 50 active `voice_directives` by evidence count.

Reference pseudocode:

```ts
formatStyleContext(profile, { activeDirectives }) => string
```

See `src/lib/voice/format-style-context.server.ts` for the canonical implementation.

If no voice is active for the user, generation returns `{ needsVoice: true }` — never a silent fallback.

## 5. Full catalog (54 personas)

Sliders shown as **F / H / T / C** (0–100).

### Public Figures (4)

| Name | Profession | Tagline | F / H / T / C |
|---|---|---|---|
| Barack Obama Voice | Former U.S. President | Rhythmic eloquence — unity through measured calm | 75 / 30 / 40 / 55 |
| Jacinda Ardern Voice | Former Prime Minister of New Zealand | Inclusive leadership — empathy as strength | 55 / 35 / 30 / 60 |
| Michelle Obama Voice | Former First Lady, Author, and Advocate | Leading with dignity and grounded, soulful wisdom | 65 / 40 / 20 / 40 |
| Oprah Winfrey Voice | Media Mogul, Talk Show Host & Philanthropist | Empowering the spirit through the power of shared truth | 55 / 30 / 20 / 40 |

### Business Leaders (2)

| Name | Profession | Tagline | F / H / T / C |
|---|---|---|---|
| Tim Ferriss Voice | Author & Podcast Host | Deconstructing excellence — world-class performance unlocked | 50 / 40 / 60 / 65 |
| Elon Musk Voice | Entrepreneur & Engineer | First principles — cut through fluff with bold execution | 35 / 50 / 75 / 90 |

### Consulting & Strategy (4)

| Name | Profession | Tagline | F / H / T / C |
|---|---|---|---|
| McKinsey Partner Voice | Management Consulting | Executive-grade analysis — lead with the 'so what' | 95 / 5 / 70 / 85 |
| BCG Voice | Management Consulting | Hypothesis-driven strategy — test bold ideas with evidence | 90 / 5 / 75 / 80 |
| Bain Voice | Management Consulting | Results-oriented — from insight to action | 85 / 10 / 70 / 80 |
| Barbara Minto Voice | Business Communication Expert | Pyramid principle — answer first, support second | 90 / 5 / 60 / 90 |

### Marketing & Sales (7)

| Name | Profession | Tagline | F / H / T / C |
|---|---|---|---|
| David Ogilvy Voice | Advertising Legend | The Father of Modern Advertising — research-driven elegance | 80 / 35 / 55 / 70 |
| Seth Godin Voice | Author & Marketer | Pithy contrarian wisdom — make a ruckus | 45 / 45 / 30 / 95 |
| Gary Vaynerchuk Voice | Entrepreneur & Content Creator | Raw, direct hustle energy — no filter needed | 15 / 55 / 25 / 85 |
| Russell Brunson Voice | Author & Funnel Expert | The Attractive Character — part Coach, part Cheerleader | 25 / 65 / 30 / 45 |
| Marie Forleo Voice | Entrepreneur & Life Coach | Everything is figureoutable — make it work | 25 / 60 / 25 / 55 |
| Alex Hormozi Voice | Entrepreneur & Investor | Acquisition systems — revenue math, no BS | 20 / 45 / 55 / 85 |
| Neil Patel Voice | Digital Marketing Expert | SEO mastery — data-driven traffic growth | 45 / 30 / 60 / 70 |

### Thought Leadership (4)

| Name | Profession | Tagline | F / H / T / C |
|---|---|---|---|
| Simon Sinek Voice | Author & Speaker | Start with Why — purpose-driven inspiration | 55 / 30 / 35 / 60 |
| Simon Sinek Voice (v2) | Author and Inspirational Speaker | Inspiring people to do the things that inspire them | 50 / 30 / 35 / 40 |
| Brené Brown Voice (TL) | Researcher & Author | Vulnerability as strength — research meets humanity | 50 / 40 / 55 / 55 |
| James Clear Voice | Author & Habits Expert | Atomic habits — small changes, remarkable results | 55 / 25 / 50 / 75 |

### Academic & Journalism (8)

| Name | Profession | Tagline | F / H / T / C |
|---|---|---|---|
| Malcolm Gladwell Voice | Author & Journalist | Hidden patterns — reframing what you think you know | 65 / 30 / 55 / 50 |
| Steven Pinker Voice | Cognitive Scientist & Author | Clear writing — complexity made accessible | 70 / 35 / 65 / 60 |
| Adam Grant Voice | Organizational Psychologist | Think again — challenge your own assumptions | 60 / 40 / 55 / 65 |
| Esther Perel Voice | Psychotherapist & Author | Relational intelligence — erotic desire meets emotional wisdom | 70 / 25 / 50 / 55 |
| Charles Kuralt Voice | Journalist and Broadcaster | The gentle observer of America's back roads | 60 / 30 / 20 / 40 |
| David Sedaris Voice | Humorist and Essayist | The sublime art of finding humor in our shared humiliations | 40 / 90 / 20 / 40 |
| Rick Bragg Voice | Author and Journalist | The lyricism of the red dirt and the porch swing | 50 / 60 / 20 / 30 |
| Studs Terkel Voice | Author, Radio Host & Oral Historian | The voice of the uncelebrated American worker | 40 / 60 / 20 / 30 |

### Journalism (5)

| Name | Profession | Tagline | F / H / T / C |
|---|---|---|---|
| Anderson Cooper Voice | Journalist & News Anchor | Precision reporting with a human heart | 85 / 20 / 40 / 60 |
| Bob Woodward Voice | Investigative Journalist & Author | The gold standard of investigative reporting | 85 / 10 / 75 / 40 |
| Lester Holt Voice | News Anchor and Journalist | The steady, trusted voice of the evening news | 85 / 15 / 40 / 75 |
| Maggie Haberman Voice | Journalist & Political Analyst | The definitive reporter of the Trump era and beyond | 85 / 15 / 70 / 75 |
| Rachel Maddow Voice | Journalist and Political Commentator | The historical context behind the headlines | 75 / 40 / 70 / 30 |

### Coaching & Self-Help (9)

| Name | Profession | Tagline | F / H / T / C |
|---|---|---|---|
| Oprah Winfrey Voice (CSH) | Media Mogul & Philanthropist | Heart-led authenticity — your story matters | 40 / 35 / 20 / 50 |
| Tony Robbins Voice | Peak Performance Coach | Unleash the giant within — massive action, massive results | 30 / 35 / 30 / 55 |
| Mel Robbins Voice | Motivational Speaker & Author | The 5 Second Rule — just start counting | 20 / 55 / 35 / 70 |
| Mel Robbins Voice (v2) | Podcast Host, Author, & Speaker | Simple, science-backed tools for immediate action | 30 / 40 / 40 / 80 |
| Brené Brown Voice (CSH) | Research Professor & Author | Daring greatly through vulnerability and grounded theory | 30 / 65 / 45 / 40 |
| Carolyn Hax Voice | Advice Columnist & Relationship Expert | Radical accountability with a side of dry wit | 30 / 60 / 40 / 80 |
| Cheryl Strayed Voice | Author and Advice Columnist | Radical empathy meets the hard, beautiful truth | 40 / 30 / 20 / 30 |
| Eckhart Tolle Voice | Spiritual Teacher and Author | Finding stillness and presence in the depth of the Now | 60 / 30 / 20 / 40 |
| Thich Nhat Hanh Voice | Zen Master, Poet, and Peace Activist | The miracle is not to walk on water, but to walk on Earth | 40 / 20 / 30 / 70 |

### Investment & Finance (1)

| Name | Profession | Tagline | F / H / T / C |
|---|---|---|---|
| Naval Ravikant Voice | Investor & Philosopher | First-principles wisdom — wealth and happiness decoded | 55 / 25 / 65 / 90 |

### Spirituality (10)

| Name | Profession | Tagline | F / H / T / C |
|---|---|---|---|
| Billy Graham Voice | Evangelist & Spiritual Adviser | Simple truth delivered with moral urgency and global reach | 85 / 20 / 30 / 40 |
| Billy Graham Voice (v2) | Evangelist & Pastor | The voice of modern evangelism — urgent sincerity that moves millions | 65 / 10 / 25 / 70 |
| Timothy Keller Voice | Pastor, Theologian, and Author | Reasoned faith for a skeptical age | 75 / 30 / 65 / 40 |
| Timothy Keller Voice (v2) | Pastor & Theologian | Intellectual faith — making Christianity credible to the skeptic | 75 / 25 / 75 / 65 |
| Charles Spurgeon Voice | Preacher & Theologian | Victorian eloquence — the gold standard of expository preaching | 85 / 20 / 70 / 35 |
| Charles Spurgeon Voice (v2) | The Prince of Preachers | Victorian eloquence — the gold standard of expository preaching | 85 / 20 / 70 / 35 |
| Priscilla Shirer Voice | Bible Teacher & Author | Fierce clarity — Scripture made personal and actionable | 50 / 30 / 55 / 65 |
| Priscilla Shirer Voice (v2) | Bible Teacher & Author | Fierce clarity — making Scripture personal and actionable | 50 / 30 / 55 / 65 |
| N.T. Wright Voice | New Testament Scholar & Bishop | Kingdom theology — rigorous scholarship told as a grand story | 80 / 20 / 85 / 50 |
| N.T. Wright Voice (v2) | New Testament Scholar & Bishop | Kingdom theology — rigorous scholarship told as a grand story | 80 / 20 / 85 / 50 |

**Total: 54 personas across 10 categories.**

## 6. Deduplication note

Several personas appear twice from separate seed passes. Recommended keepers (drop the other):

- Simon Sinek Voice · Brené Brown Voice (TL) · Mel Robbins Voice · Oprah Winfrey Voice
- Billy Graham Voice · Timothy Keller Voice · Charles Spurgeon Voice · Priscilla Shirer Voice · N.T. Wright Voice

Cleanup is called out for a follow-up and is not executed here.

## 7. Full-fidelity export note

`tone`, `guidelines`, `preferred_terms`, `avoid_terms`, and `writing_samples` are large text fields. To reproduce them faithfully in another database, export directly from `system_voices` — the payload exceeds 200 KB and should not be inlined here. The companion `voice-personas-catalog.json` in this folder contains a machine-readable snapshot suitable for seeding.
