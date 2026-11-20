-- Built-in Bible reading plan catalogue for members and ministry editors.
-- These are global public templates. Members may read them directly or clone
-- them into private personal plans before editing.

do $$
declare pid uuid;
begin
  insert into public.bible_reading_plans(organization_id,slug,title,description,duration_days,is_public)
  values(null,'seven-days-of-peace','7 Days of Peace','A one-week Scripture path for anxiety, rest, trust and the peace of Christ.',7,true)
  on conflict(organization_id,slug) do update set title=excluded.title,description=excluded.description,duration_days=excluded.duration_days,is_public=true
  returning id into pid;
  insert into public.bible_reading_plan_days(plan_id,day_number,title,scripture_references,reflection) values
    (pid,1,'God is our refuge',array['Psalm 46:1-3'],'Begin by naming what feels unstable and placing it before God.'),
    (pid,2,'Be still',array['Psalm 46:10'],'Make room for quiet before trying to solve everything.'),
    (pid,3,'Do not fear',array['Isaiah 41:10'],'Notice the promises of presence, strength and help.'),
    (pid,4,'Bring your anxiety',array['Philippians 4:6-7'],'Turn each worry into a specific prayer.'),
    (pid,5,'Cast your cares',array['1 Peter 5:7'],'Give God the concern you keep picking back up.'),
    (pid,6,'Peace from Jesus',array['John 14:27'],'Compare Christ''s peace with the kind of peace circumstances offer.'),
    (pid,7,'Rest in Christ',array['Matthew 11:28-30'],'End the week by receiving Jesus'' invitation to rest.')
  on conflict(plan_id,day_number) do update set title=excluded.title,scripture_references=excluded.scripture_references,reflection=excluded.reflection;

  insert into public.bible_reading_plans(organization_id,slug,title,description,duration_days,is_public)
  values(null,'seven-days-of-wisdom','7 Days of Wisdom','A practical week through Proverbs and New Testament wisdom for everyday decisions.',7,true)
  on conflict(organization_id,slug) do update set title=excluded.title,description=excluded.description,duration_days=excluded.duration_days,is_public=true
  returning id into pid;
  insert into public.bible_reading_plan_days(plan_id,day_number,title,scripture_references,reflection) values
    (pid,1,'Trust beyond yourself',array['Proverbs 3:5-6'],'Where are you leaning only on your own understanding?'),
    (pid,2,'Ask for wisdom',array['James 1:5'],'Ask God specifically for wisdom in one current decision.'),
    (pid,3,'Guard your heart',array['Proverbs 4:20-27'],'Notice what is shaping your attention, speech and direction.'),
    (pid,4,'Listen before speaking',array['James 1:19-20'],'Practice being quick to listen and slow to react today.'),
    (pid,5,'Choose wise company',array['Proverbs 13:20'],'Consider which relationships are shaping your habits.'),
    (pid,6,'Words that give life',array['Proverbs 18:21','Ephesians 4:29'],'Use your words deliberately to build someone up.'),
    (pid,7,'Wisdom in action',array['James 3:13-18'],'Look for the marks of wisdom that is pure, peaceable and sincere.')
  on conflict(plan_id,day_number) do update set title=excluded.title,scripture_references=excluded.scripture_references,reflection=excluded.reflection;

  insert into public.bible_reading_plans(organization_id,slug,title,description,duration_days,is_public)
  values(null,'seven-days-of-prayer','7 Days of Prayer','Build a simple daily rhythm of worship, asking, listening and intercession.',7,true)
  on conflict(organization_id,slug) do update set title=excluded.title,description=excluded.description,duration_days=excluded.duration_days,is_public=true
  returning id into pid;
  insert into public.bible_reading_plan_days(plan_id,day_number,title,scripture_references,reflection) values
    (pid,1,'Jesus teaches us to pray',array['Matthew 6:5-13'],'Pray slowly through the pattern Jesus gives.'),
    (pid,2,'Pray with confidence',array['Hebrews 4:14-16'],'Approach God honestly, trusting His mercy and grace.'),
    (pid,3,'Pray continually',array['1 Thessalonians 5:16-18'],'Turn ordinary moments today into short prayers.'),
    (pid,4,'Pray for others',array['1 Timothy 2:1-4'],'Choose specific people and leaders to intercede for.'),
    (pid,5,'Pray when anxious',array['Philippians 4:6-7'],'Bring anxiety to God with thanksgiving.'),
    (pid,6,'Listen and remain',array['John 15:4-7'],'Spend time abiding before asking for outcomes.'),
    (pid,7,'Pray in faith',array['Mark 11:22-25'],'Bring your requests with faith, forgiveness and surrender.')
  on conflict(plan_id,day_number) do update set title=excluded.title,scripture_references=excluded.scripture_references,reflection=excluded.reflection;

  insert into public.bible_reading_plans(organization_id,slug,title,description,duration_days,is_public)
  values(null,'fourteen-days-with-jesus','14 Days with Jesus','Two weeks following key moments in the life, teaching, death and resurrection of Jesus.',14,true)
  on conflict(organization_id,slug) do update set title=excluded.title,description=excluded.description,duration_days=excluded.duration_days,is_public=true
  returning id into pid;
  insert into public.bible_reading_plan_days(plan_id,day_number,title,scripture_references,reflection) values
    (pid,1,'The Word became flesh',array['John 1:1-18'],'Begin with who John says Jesus is.'),
    (pid,2,'The kingdom announced',array['Mark 1:14-20'],'What does following Jesus require you to leave or reorder?'),
    (pid,3,'Blessed are',array['Matthew 5:1-12'],'Which beatitude challenges your normal definition of a good life?'),
    (pid,4,'Love your enemies',array['Matthew 5:43-48'],'Pray for one person you find difficult to love.'),
    (pid,5,'The Lord of the storm',array['Mark 4:35-41'],'Bring one fear into the boat with Jesus.'),
    (pid,6,'Bread of life',array['John 6:25-40'],'What are you expecting something other than Christ to satisfy?'),
    (pid,7,'Who do you say I am?',array['Matthew 16:13-20'],'Answer Jesus'' question personally.'),
    (pid,8,'The good shepherd',array['John 10:1-18'],'Notice how Jesus describes His care and sacrifice.'),
    (pid,9,'The greatest commandment',array['Mark 12:28-34'],'Examine love for God and neighbour together.'),
    (pid,10,'Servant leadership',array['John 13:1-17'],'Choose one practical act of service today.'),
    (pid,11,'Abide in me',array['John 15:1-11'],'What helps you remain connected to Christ?'),
    (pid,12,'Gethsemane',array['Luke 22:39-46'],'Bring your own will honestly before God.'),
    (pid,13,'The cross',array['Luke 23:32-49'],'Sit with the meaning of Jesus'' death before rushing ahead.'),
    (pid,14,'He is risen',array['Luke 24:1-12','Matthew 28:16-20'],'End with resurrection hope and Jesus'' commission.')
  on conflict(plan_id,day_number) do update set title=excluded.title,scripture_references=excluded.scripture_references,reflection=excluded.reflection;
end $$;
