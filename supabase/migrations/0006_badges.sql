-- Persistent badges (folded into the Haladás tab) + a cheap boss-win marker
-- on mastery so badge checks don't need a new event-log table.

create table badges (
  id             text primary key,
  category       text not null,
  metric         text not null,
  label_hu       text not null,
  description_hu text not null,
  threshold      numeric not null,
  earned_at      timestamptz,
  seen_at        timestamptz
);

alter table badges enable row level security;
create policy badges_select_authenticated on badges for select using (auth.uid() is not null);
create policy badges_update_authenticated on badges for update using (auth.uid() is not null) with check (auth.uid() is not null);
-- No client insert policy — rows are pre-seeded below; badges are a fixed catalog.

alter table mastery add column boss_beaten_at timestamptz;

insert into badges (id, category, metric, label_hu, description_hu, threshold) values
  ('streak_3',      'streak',  'streak',         '3 napos sorozat',    '3 egymást követő napon gyakoroltál.',                3),
  ('streak_7',      'streak',  'streak',         '7 napos sorozat',    '7 egymást követő napon gyakoroltál.',                7),
  ('streak_30',     'streak',  'streak',         '30 napos sorozat',   '30 egymást követő napon gyakoroltál.',               30),
  ('streak_100',    'streak',  'streak',         '100 napos sorozat',  '100 egymást követő napon gyakoroltál.',              100),
  ('boss_1',        'boss',    'boss_wins',      'Első győzelem',      'Megnyertél egy Boss Fight-ot 85% felett.',           1),
  ('boss_5',        'boss',    'boss_wins',      '5 győzelem',         '5 könyvben nyertél Boss Fight-ot.',                  5),
  ('boss_all',      'boss',    'boss_wins',      'Mind a 66',          'Minden könyvben megnyerted a Boss Fight-ot.',        66),
  ('mastery_1',     'mastery', 'books_mastered', 'Első könyv',         '1 könyvet 90% feletti tudásszintre vittél.',         1),
  ('mastery_10',    'mastery', 'books_mastered', '10 könyv',           '10 könyvet 90% feletti tudásszintre vittél.',        10),
  ('mastery_66',    'mastery', 'books_mastered', 'Mind a 66 könyv',    'Mind a 66 könyvet 90% feletti tudásszintre vitted.', 66),
  ('coverage_25',   'mastery', 'coverage',       '25% lefedettség',    'A teljes anyag 25%-át elsajátítottad.',              0.25),
  ('coverage_50',   'mastery', 'coverage',       '50% lefedettség',    'A teljes anyag felét elsajátítottad.',               0.5),
  ('coverage_90',   'mastery', 'coverage',       '90% lefedettség',    'A teljes anyag 90%-át elsajátítottad.',              0.9),
  ('volume_1000',   'volume',  'reviews',        '1000 ismétlés',      '1000 kártyát ismételtél át összesen.',               1000),
  ('volume_10000',  'volume',  'reviews',        '10000 ismétlés',     '10000 kártyát ismételtél át összesen.',              10000);
