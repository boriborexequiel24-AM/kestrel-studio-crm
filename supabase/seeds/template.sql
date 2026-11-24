-- The Template: Kestrel Studio's sample data that every Sandbox starts as.
-- All names are fake. Company names were checked against real businesses on
-- 2026-11-24; emails use the reserved .example domain and phones the 555-01xx
-- range. Dates are written as days before the anchor (the Template row's
-- created_at); building a Sandbox shifts them so they read as current.
-- Safe to re-run: it replaces the whole Template.

-- Readable ids: Company 7 is ...00000000c007, its 2nd Contact ...0000000d0072,
-- Teammate 1 (Maya) ...0000000000a1, Deal 3 ...0000000e0003,
-- its 2nd Proposal ...0000000f0032, Deal 101's
-- Retainer ...0000000b0101, Activity 12 ...0000000a0012.
create function pg_temp.template() returns uuid language sql immutable
  as $$ select '00000000-0000-4000-8000-000000000000'::uuid $$;
create function pg_temp.teammate(n int) returns uuid language sql immutable
  as $$ select ('00000000-0000-4000-8000-0000000000a' || n)::uuid $$;
create function pg_temp.company(n int) returns uuid language sql immutable
  as $$ select ('00000000-0000-4000-8000-00000000c' || lpad(n::text, 3, '0'))::uuid $$;
create function pg_temp.contact(company int, n int) returns uuid language sql immutable
  as $$ select ('00000000-0000-4000-8000-0000000d' || lpad(company::text, 3, '0') || n)::uuid $$;
create function pg_temp.deal(n int) returns uuid language sql immutable
  as $$ select ('00000000-0000-4000-8000-0000000e' || lpad(n::text, 4, '0'))::uuid $$;
create function pg_temp.proposal(deal int, version int) returns uuid language sql immutable
  as $$ select ('00000000-0000-4000-8000-0000000f' || lpad(deal::text, 3, '0') || version)::uuid $$;
create function pg_temp.retainer(deal int) returns uuid language sql immutable
  as $$ select ('00000000-0000-4000-8000-0000000b' || lpad(deal::text, 4, '0'))::uuid $$;
create function pg_temp.activity(n bigint) returns uuid language sql immutable
  as $$ select ('00000000-0000-4000-8000-0000000a' || lpad(n::text, 4, '0'))::uuid $$;
-- A moment `days` before the anchor, at `hour` UTC (US business hours are about 13 to 23 UTC).
create function pg_temp.before_anchor(days int, hour int) returns timestamptz language sql stable
  as $$ select date_trunc('day', created_at) - days * interval '1 day' + hour * interval '1 hour'
          from crm.sandboxes where is_template $$;

delete from crm.sandboxes where is_template;

insert into crm.sandboxes (id, is_template, created_at)
values (pg_temp.template(), true, '2026-11-02 09:00:00+00');

-- The Persona and 4 Teammates.
insert into crm.teammates (sandbox_id, id, first_name, last_name, role, initials, is_persona) values
  (pg_temp.template(), pg_temp.teammate(1), 'Maya', 'Brandt', 'Account Director', 'MB', true),
  (pg_temp.template(), pg_temp.teammate(2), 'Theo', 'Lindqvist', 'Strategy Lead', 'TL', false),
  (pg_temp.template(), pg_temp.teammate(3), 'Wendell', 'Ames', 'New Business Manager', 'WA', false),
  (pg_temp.template(), pg_temp.teammate(4), 'Jonas', 'Webb', 'Performance Lead', 'JW', false),
  (pg_temp.template(), pg_temp.teammate(5), 'Ines', 'Calloway', 'Creative Director', 'IC', false);

-- 40 Companies. The first block are Clients
-- (ticket 07); the rest are Prospects, most with Deals from ticket 05.
insert into crm.companies (sandbox_id, id, name, industry, city, owner_id, added_at)
select pg_temp.template(), pg_temp.company(v.n), v.name, v.industry, v.city, pg_temp.teammate(v.owner), pg_temp.before_anchor(v.days_ago, 15)
  from (values
    -- Clients
    (1, 'Harbor & Pine Coffee', 'Coffee roaster, 14 cafes', 'Seattle, WA', 1, 610),
    (4, 'Brindlewood Hotels', 'Boutique hotels, 5 sites', 'Asheville, NC', 2, 430),
    (8, 'Ostrander Climbing', 'Climbing gyms, 6 sites', 'Salt Lake City, UT', 4, 290),
    (9, 'Wrenfield Tea Co.', 'Loose-leaf tea, DTC', 'San Diego, CA', 1, 520),
    (10, 'Larchmere Vineyards', 'Winery and tasting room', 'Sonoma, CA', 2, 380),
    (11, 'Marlowe Creek Dental Group', 'Dental clinics, 11 sites', 'Phoenix, AZ', 4, 340),
    (12, 'Tallow & Thread', 'Candles and home goods, DTC', 'Brooklyn, NY', 5, 260),
    (13, 'Bramblecote Credit Union', 'Credit union, 8 branches', 'Richmond, VA', 1, 470),
    (14, 'Fieldvane Outdoor', 'Outdoor gear, 9 stores', 'Boise, ID', 3, 300),
    (15, 'Halsey Street Bakery', 'Bakery chain, 7 shops', 'Philadelphia, PA', 5, 410),
    (16, 'Ashgrove Physical Therapy', 'Physical therapy, 8 clinics', 'Columbus, OH', 1, 230),
    (17, 'Lumen & Lark Eyewear', 'Eyewear, DTC', 'Nashville, TN', 4, 200),
    -- Prospects
    (2, 'Saltmarsh Skincare', 'DTC beauty', 'Portland, OR', 1, 3),
    (3, 'Hollis Cycle Works', 'E-bikes', 'Denver, CO', 3, 21),
    (5, 'Fernhill Pet Co.', 'Pet food', 'Austin, TX', 4, 9),
    (6, 'Quarry Lane Furniture', 'Furniture, 4 showrooms', 'Chicago, IL', 3, 48),
    (7, 'Juniper Row Clinics', 'Urgent care, 9 clinics', 'Minneapolis, MN', 5, 75),
    (18, 'Cobaltline Analytics', 'B2B SaaS, analytics', 'Boston, MA', 3, 34),
    (19, 'Granite Hollow Brewing', 'Craft brewery', 'Bend, OR', 2, 62),
    (20, 'Marrow & Vine Kitchen', 'Restaurant group, 4 sites', 'New Orleans, LA', 1, 15),
    (21, 'Tidebrook Insurance', 'Independent insurance agency', 'Charleston, SC', 3, 90),
    (22, 'Oakhurst Learning', 'Tutoring centers, 12 sites', 'Atlanta, GA', 5, 27),
    (23, 'Sparrowhill Toys', 'Wooden toys, DTC', 'Burlington, VT', 4, 12),
    (24, 'Hollowmere Snacks', 'Snack brand, grocery', 'Milwaukee, WI', 1, 40),
    (25, 'Corbel Lane Property Group', 'Property management', 'Dallas, TX', 3, 110),
    (26, 'Quillon Mobility', 'E-scooter rental', 'Miami, FL', 2, 18),
    (27, 'Silverpine Dermatology', 'Dermatology, 5 clinics', 'Scottsdale, AZ', 5, 55),
    (28, 'Ferrous Fitness', 'Strength gyms, 3 sites', 'Pittsburgh, PA', 4, 7),
    (29, 'Birch & Bellows Interiors', 'Interior design studio', 'Charlotte, NC', 1, 66),
    (30, 'Duskwing Software', 'B2B SaaS, HR tools', 'Raleigh, NC', 3, 24),
    (31, 'Wexcombe Pharmacy', 'Independent pharmacies, 6', 'Kansas City, MO', 2, 130),
    (32, 'Driftmoor Seafood', 'Seafood restaurants, 3', 'Portland, ME', 4, 44),
    (33, 'Sunwake Solar', 'Residential solar', 'Sacramento, CA', 3, 80),
    (34, 'Pawsley Grooming', 'Pet grooming, 5 salons', 'Tampa, FL', 5, 36),
    (35, 'Oriel Language School', 'Language school', 'San Francisco, CA', 1, 150),
    (36, 'Wickham Orchard Cider', 'Cidery', 'Hood River, OR', 2, 22),
    (37, 'Pellham & Rowe LLP', 'Law firm, 30 lawyers', 'Cleveland, OH', 3, 95),
    (38, 'Kelpwood Surf Co.', 'Surf shop and apparel', 'Santa Cruz, CA', 4, 58),
    (39, 'Mirabel Bridal', 'Bridal boutique, 2 stores', 'Savannah, GA', 5, 120),
    (40, 'Stackyard Pizza', 'Pizza chain, 10 sites', 'Detroit, MI', 1, 5)
  ) as v (n, name, industry, city, owner, days_ago);

-- 80 Contacts, two per Company.
insert into crm.contacts (sandbox_id, id, company_id, name, job_title, email, phone)
select pg_temp.template(), pg_temp.contact(v.company, v.n), pg_temp.company(v.company), v.name, v.job_title, v.email, v.phone
  from (values
    (1, 1, 'Rosa Delgado', 'Marketing Director', 'rosa@harborpine.example', '(206) 555-0141'),
    (1, 2, 'Ben Okafor', 'Head of Retail', 'ben@harborpine.example', '(206) 555-0187'),
    (2, 1, 'Rhoda Whitlock', 'CMO', 'rhoda@saltmarsh.example', '(503) 555-0112'),
    (2, 2, 'Kai Nakamura', 'Ecommerce Manager', 'kai@saltmarsh.example', ''),
    (3, 1, 'Arjun Mehta', 'Founder', 'arjun@holliscycle.example', '(720) 555-0156'),
    (3, 2, 'Dana Kowalski', 'Operations Lead', 'dana@holliscycle.example', ''),
    (4, 1, 'Claire Benson', 'VP Brand', 'claire@brindlewood.example', '(828) 555-0133'),
    (4, 2, 'Marcus Hale', 'Revenue Manager', 'marcus@brindlewood.example', '(828) 555-0160'),
    (5, 1, 'Sam Oduya', 'Growth Lead', 'sam@fernhillpet.example', '(512) 555-0174'),
    (5, 2, 'Lucia Ferreira', 'Co-founder', 'lucia@fernhillpet.example', ''),
    (6, 1, 'Owen Fischer', 'CEO', 'owen@quarrylane.example', '(312) 555-0119'),
    (6, 2, 'Priya Raman', 'Marketing Manager', 'priya@quarrylane.example', '(312) 555-0145'),
    (7, 1, 'Leah Grant', 'Director of Patient Growth', 'leah@juniperrow.example', '(612) 555-0128'),
    (7, 2, 'Tom Brekke', 'COO', 'tom@juniperrow.example', ''),
    (8, 1, 'Nina Castillo', 'Marketing Manager', 'nina@ostrander.example', '(801) 555-0166'),
    (8, 2, 'Eli Vance', 'Owner', 'eli@ostrander.example', '(801) 555-0102'),
    (9, 1, 'Tess Morgan', 'Brand Manager', 'tess@wrenfieldtea.example', '(619) 555-0151'),
    (9, 2, 'Hiro Tanaka', 'Founder', 'hiro@wrenfieldtea.example', ''),
    (10, 1, 'Celeste Moreau', 'Hospitality Director', 'celeste@larchmere.example', '(707) 555-0137'),
    (10, 2, 'Graham Pyle', 'Winemaker and Owner', 'graham@larchmere.example', '(707) 555-0193'),
    (11, 1, 'Dr. Anita Shah', 'Managing Partner', 'anita@marlowecreek.example', '(602) 555-0124'),
    (11, 2, 'Jordan Ellis', 'Marketing Coordinator', 'jordan@marlowecreek.example', '(602) 555-0179'),
    (12, 1, 'Maren Holt', 'Founder', 'maren@tallowthread.example', '(718) 555-0115'),
    (12, 2, 'Felix Arroyo', 'Ecommerce Lead', 'felix@tallowthread.example', ''),
    (13, 1, 'Denise Carver', 'VP Marketing', 'denise@bramblecote.example', '(804) 555-0148'),
    (13, 2, 'Malik Johnson', 'Member Growth Manager', 'malik@bramblecote.example', '(804) 555-0171'),
    (14, 1, 'Hannah Lund', 'Marketing Director', 'hannah@fieldvane.example', '(208) 555-0139'),
    (14, 2, 'Reese Calder', 'Ecommerce Manager', 'reese@fieldvane.example', ''),
    (15, 1, 'Gina Russo', 'Owner', 'gina@halseystreet.example', '(215) 555-0127'),
    (15, 2, 'Andre Batiste', 'Operations Manager', 'andre@halseystreet.example', '(215) 555-0182'),
    (16, 1, 'Paula Brennan', 'Clinic Director', 'paula@ashgrovept.example', '(614) 555-0164'),
    (16, 2, 'Victor Nguyen', 'Marketing Lead', 'victor@ashgrovept.example', ''),
    (17, 1, 'Simone Achebe', 'Co-founder', 'simone@lumenlark.example', '(615) 555-0110'),
    (17, 2, 'Wes Harlan', 'Growth Marketing Manager', 'wes@lumenlark.example', '(615) 555-0158'),
    (18, 1, 'Ivy Chen', 'VP Marketing', 'ivy@cobaltline.example', '(617) 555-0131'),
    (18, 2, 'Rob Lindgren', 'CEO', 'rob@cobaltline.example', ''),
    (19, 1, 'Cal Rhodes', 'Co-founder', 'cal@granitehollow.example', '(541) 555-0146'),
    (19, 2, 'Joanna Pike', 'Taproom Manager', 'joanna@granitehollow.example', ''),
    (20, 1, 'Etienne Broussard', 'Owner', 'etienne@marrowvine.example', '(504) 555-0168'),
    (20, 2, 'Keisha Monroe', 'Events Manager', 'keisha@marrowvine.example', '(504) 555-0121'),
    (21, 1, 'Frank Delacroix', 'Principal', 'frank@tidebrook.example', '(843) 555-0153'),
    (21, 2, 'Amy Sutter', 'Office Manager', 'amy@tidebrook.example', ''),
    (22, 1, 'Renee Okonjo', 'Director of Enrollment', 'renee@oakhurst.example', '(404) 555-0134'),
    (22, 2, 'Darnell Price', 'CEO', 'darnell@oakhurst.example', ''),
    (23, 1, 'Willa Thorne', 'Founder', 'willa@sparrowhill.example', '(802) 555-0172'),
    (23, 2, 'Gus Andersen', 'Operations', 'gus@sparrowhill.example', ''),
    (24, 1, 'Megan Kowal', 'Brand Manager', 'megan@hollowmere.example', '(414) 555-0118'),
    (24, 2, 'Luis Ortega', 'VP Sales', 'luis@hollowmere.example', '(414) 555-0190'),
    (25, 1, 'Sharon Whitley', 'Director of Leasing', 'sharon@corbellane.example', '(214) 555-0142'),
    (25, 2, 'Tyler Brooks', 'Marketing Specialist', 'tyler@corbellane.example', ''),
    (26, 1, 'Mateo Rivas', 'Head of Growth', 'mateo@quillon.example', '(305) 555-0165'),
    (26, 2, 'Nadia Petrova', 'City Launch Manager', 'nadia@quillon.example', ''),
    (27, 1, 'Dr. Laura Kim', 'Medical Director', 'laura@silverpine.example', '(480) 555-0129'),
    (27, 2, 'Chase Holloway', 'Practice Administrator', 'chase@silverpine.example', '(480) 555-0185'),
    (28, 1, 'Bo Sterling', 'Owner', 'bo@ferrousfitness.example', '(412) 555-0150'),
    (28, 2, 'Kara Lewandowski', 'Head Coach', 'kara@ferrousfitness.example', ''),
    (29, 1, 'Vivian Ashby', 'Principal Designer', 'vivian@birchbellows.example', '(704) 555-0136'),
    (29, 2, 'Noah Fairchild', 'Studio Manager', 'noah@birchbellows.example', ''),
    (30, 1, 'Erin Gallagher', 'Head of Demand Gen', 'erin@duskwing.example', '(919) 555-0177'),
    (30, 2, 'Sanjay Kapoor', 'CMO', 'sanjay@duskwing.example', ''),
    (31, 1, 'Martha Quinlan', 'Owner and Pharmacist', 'martha@wexcombe.example', '(816) 555-0123'),
    (31, 2, 'Devon Ross', 'Operations Manager', 'devon@wexcombe.example', ''),
    (32, 1, 'Colin Murray', 'Owner', 'colin@driftmoor.example', '(207) 555-0161'),
    (32, 2, 'Abby Pelletier', 'General Manager', 'abby@driftmoor.example', ''),
    (33, 1, 'Raj Patel', 'VP Sales', 'raj@sunwake.example', '(916) 555-0144'),
    (33, 2, 'Kristen Dahl', 'Marketing Manager', 'kristen@sunwake.example', '(916) 555-0109'),
    (34, 1, 'Tanya Brooks', 'Founder', 'tanya@pawsley.example', '(813) 555-0170'),
    (34, 2, 'Omar Haddad', 'Salon Operations', 'omar@pawsley.example', ''),
    (35, 1, 'Isabel Fontaine', 'Director', 'isabel@oriel.example', '(415) 555-0126'),
    (35, 2, 'Kenji Mori', 'Admissions Manager', 'kenji@oriel.example', '(415) 555-0192'),
    (36, 1, 'Hazel Wickham', 'Co-owner', 'hazel@wickhamcider.example', '(541) 555-0138'),
    (36, 2, 'Pete Sorensen', 'Sales and Distribution', 'pete@wickhamcider.example', ''),
    (37, 1, 'Catherine Rowe', 'Managing Partner', 'catherine@pellhamrowe.example', '(216) 555-0157'),
    (37, 2, 'Daniel Ostrowski', 'Marketing Director', 'daniel@pellhamrowe.example', '(216) 555-0114'),
    (38, 1, 'Jesse Alvarado', 'Owner', 'jesse@kelpwood.example', '(831) 555-0163'),
    (38, 2, 'Sky Lambert', 'Brand and Social', 'sky@kelpwood.example', ''),
    (39, 1, 'Celine Dubois', 'Owner', 'celine@mirabelbridal.example', '(912) 555-0140'),
    (39, 2, 'Alana Reyes', 'Store Manager', 'alana@mirabelbridal.example', ''),
    (40, 1, 'Vince Kowalczyk', 'CEO', 'vince@stackyard.example', '(313) 555-0167'),
    (40, 2, 'Brianna Hayes', 'Marketing Manager', 'brianna@stackyard.example', '(313) 555-0103')
  ) as v (company, n, name, job_title, email, phone);

-- Activities. Clients show the ongoing work for them; Prospects show the sales
-- conversation so far. Contact 0 means the Activity names no Contact.
insert into crm.activities (sandbox_id, id, company_id, contact_id, author_id, kind, occurred_at, text)
select pg_temp.template(), pg_temp.activity(v.ord), pg_temp.company(v.company),
       case when v.contact = 0 then null else pg_temp.contact(v.company, v.contact) end,
       pg_temp.teammate(v.author), v.kind::crm.activity_kind, pg_temp.before_anchor(v.days_ago, v.hour), v.text
  -- Numbered in the order written, for stable ids.
  from (select row_number() over () as ord, w.* from (values
    -- Harbor & Pine Coffee (Client, Maya)
    (1, 1, 1, 'Email', 2, 17, 'Sent the monthly performance report. Foot traffic from the loyalty campaign is up 9% on the month before.'),
    (1, 1, 4, 'Call', 9, 19, 'Monthly check-in with Rosa. The new blend launch moves back two weeks; they want paid social live a week before.'),
    (1, 2, 5, 'Meeting', 16, 18, 'Shoot planning at the Ballard cafe with Ben. Shortlisted three baristas for the new blend spots.'),
    (1, 1, 1, 'Note', 23, 20, 'Rosa hinted the retail team may want in-store signage next year. Worth a separate conversation.'),
    (1, 1, 4, 'Email', 37, 16, 'Shared the quarterly paid social results: cost per loyalty signup down to $3.10.'),
    (1, 0, 1, 'Meeting', 64, 18, 'Quarterly review at their roastery. Agreed to shift 20% of search budget into local social.'),
    -- Brindlewood Hotels (Client, Theo)
    (4, 1, 2, 'Meeting', 4, 15, 'Strategy session with Claire on the rebrand of the Blue Ridge property.'),
    (4, 2, 4, 'Email', 11, 21, 'Sent Marcus the direct booking report. Direct share is 41%, up from 33% when we started.'),
    (4, 1, 2, 'Call', 19, 17, 'Claire wants to talk about a second Retainer for the two new properties.'),
    (4, 0, 5, 'Note', 29, 22, 'Photo library from the property shoots is delivered and tagged by property.'),
    (4, 2, 4, 'Meeting', 52, 16, 'Walked Marcus through the metasearch test. Keeping it on for the two mountain properties only.'),
    -- Ostrander Climbing (Client, Jonas)
    (8, 1, 4, 'Email', 3, 18, 'Sent the membership campaign recap: 212 new members across six gyms, cost per join $41.'),
    (8, 2, 4, 'Call', 13, 20, 'Eli asked about opening-week ads for the Ogden gym. Opening is set for about two months from now.'),
    (8, 1, 5, 'Meeting', 25, 17, 'Creative review with Nina. She loved the "first send" video series; wants two more episodes.'),
    (8, 1, 4, 'Note', 44, 21, 'Youth program ads underperform on Meta. Testing YouTube next month.'),
    (8, 0, 4, 'Email', 71, 15, 'Shared the monthly dashboard and a short note on rising CPMs.'),
    -- Wrenfield Tea Co. (Client, Maya)
    (9, 1, 1, 'Call', 6, 19, 'Tess flagged that the Retainer ends soon. She wants a Proposal that includes Amazon.'),
    (9, 2, 1, 'Meeting', 14, 21, 'Lunch with Hiro in San Diego. He is happy with DTC growth and nervous about wholesale.'),
    (9, 1, 4, 'Email', 21, 17, 'Subscription page test is live: new layout lifts trial-to-paid by 6% so far.'),
    (9, 0, 5, 'Note', 33, 22, 'Packaging refresh concepts are with the printer for samples.'),
    (9, 1, 1, 'Email', 58, 16, 'Sent the quarterly sales recap and an outline for the next gift set.'),
    -- Larchmere Vineyards (Client, Theo)
    (10, 1, 2, 'Email', 5, 20, 'Sent Celeste the club party results: 340 tickets, sold out two days early.'),
    (10, 2, 2, 'Call', 18, 18, 'Graham wants the wine club push to start sooner. Agreed on two weeks from now.'),
    (10, 1, 5, 'Meeting', 30, 17, 'Tasting room photo shoot. Light was perfect; picks coming Friday.'),
    (10, 0, 2, 'Note', 47, 21, 'The Retainer is up for renewal soon. Graham mentioned the budget is flat.'),
    -- Marlowe Creek Dental Group (Client, Jonas)
    (11, 2, 4, 'Email', 1, 16, 'New patient bookings report: 486 last month, the best since we started.'),
    (11, 1, 4, 'Meeting', 12, 19, 'Quarterly review with Dr. Shah. She wants to test Spanish-language search ads in two clinics.'),
    (11, 2, 5, 'Call', 20, 22, 'Jordan sent new team photos for the clinic pages; we owe updated location ads.'),
    (11, 0, 4, 'Note', 39, 18, 'Call tracking shows 30% of calls go unanswered at lunch. Flagged to Dr. Shah.'),
    (11, 1, 4, 'Email', 61, 15, 'Dr. Shah asked how we would add the two new Mesa clinics.'),
    -- Tallow & Thread (Client, Ines)
    (12, 1, 5, 'Meeting', 2, 20, 'Gift campaign shoot wrap with Maren. Gift set hero shots are approved.'),
    (12, 2, 4, 'Email', 10, 17, 'Felix: abandoned cart flow rebuild is live, early numbers look strong.'),
    (12, 1, 5, 'Call', 27, 21, 'Maren wants a candle-of-the-month subscription. Asked us to scope the launch.'),
    (12, 0, 5, 'Note', 49, 18, 'Maren asked whether creators could help launch the next scents. Worth scoping a seeding program.'),
    -- Bramblecote Credit Union (Client, Maya)
    (13, 1, 1, 'Meeting', 7, 16, 'Planning session with Denise for the first-time homebuyer campaign.'),
    (13, 2, 4, 'Email', 15, 19, 'Malik asked for a breakdown of new members by branch. Sent it with the monthly report.'),
    (13, 1, 1, 'Call', 24, 18, 'Denise says the board loved the "neighbors banking neighbors" spots.'),
    (13, 0, 2, 'Note', 42, 20, 'Compliance review of the auto loan ads took three weeks. Build that into future timelines.'),
    (13, 1, 1, 'Email', 77, 15, 'Sent the annual plan draft.'),
    -- Fieldvane Outdoor (Client, Wendell)
    (14, 1, 3, 'Call', 8, 21, 'Hannah wants more paid search for the online store. The Retainer runs out this coming month.'),
    (14, 2, 4, 'Email', 17, 17, 'Reese: Shopify feed fixes are done, product ads approved again.'),
    (14, 1, 5, 'Meeting', 32, 19, 'Catalog creative review in Boise. Two covers to choose from.'),
    (14, 0, 3, 'Note', 55, 16, 'They are opening a tenth store in Spokane within the year.'),
    -- Halsey Street Bakery (Client, Ines)
    (15, 1, 5, 'Email', 4, 15, 'Sent Gina the pre-order campaign plan and the window poster designs.'),
    (15, 2, 3, 'Call', 16, 20, 'Andre asked whether we can help with hiring ads for the new Fishtown shop.'),
    (15, 1, 5, 'Meeting', 35, 18, 'Tasting and shoot for the new pastry menu. Gina chose the warm palette.'),
    (15, 0, 4, 'Note', 66, 21, 'Google Business profiles for all 7 shops are cleaned up and verified.'),
    -- Ashgrove Physical Therapy (Client, Maya)
    (16, 1, 1, 'Call', 3, 19, 'Paula asked about expanding into sports injury marketing for high schools.'),
    (16, 2, 4, 'Email', 18, 16, 'Victor: appointment requests from search up 22% since the landing page refresh.'),
    (16, 1, 1, 'Meeting', 31, 17, 'Six-month review. Paula is happy; wants more reviews on Google.'),
    (16, 0, 5, 'Note', 53, 20, 'Patient story video #2 is in edit.'),
    -- Lumen & Lark Eyewear (Client, Jonas)
    (17, 2, 4, 'Email', 1, 21, 'Wes: home try-on campaign hit a 4.1x return on ad spend last week.'),
    (17, 1, 4, 'Meeting', 9, 18, 'Walked Simone through the TikTok Shop Proposal for the new acetate frames. She wants to start small.'),
    (17, 2, 5, 'Call', 22, 17, 'Creative refresh call: new lifestyle shots are due in a month.'),
    (17, 0, 4, 'Note', 46, 20, 'Margin on the sun line is thin; keep bids on it conservative.'),
    -- Saltmarsh Skincare (Prospect, Maya)
    (2, 1, 1, 'Call', 1, 18, 'Intro call with Rhoda. They are moving off their current agency and want a partner for their next launch.'),
    (2, 2, 1, 'Email', 2, 21, 'Sent Kai our case study on Tallow & Thread and asked for their Shopify numbers.'),
    -- Hollis Cycle Works (Prospect, Wendell)
    (3, 1, 3, 'Meeting', 5, 17, 'Discovery at their Denver shop. Arjun wants more test rides booked online.'),
    (3, 1, 3, 'Email', 12, 20, 'Followed up with Arjun on budget and timing. Waiting on numbers from Dana.'),
    (3, 2, 3, 'Call', 18, 16, 'First call with Dana about their booking system.'),
    -- Fernhill Pet Co. (Prospect, Jonas)
    (5, 1, 4, 'Call', 3, 19, 'Sam wants to grow subscriptions and is unhappy with their Amazon ads.'),
    (5, 2, 4, 'Email', 8, 15, 'Lucia sent their sales data. Strong repeat rate, weak new customer flow.'),
    -- Quarry Lane Furniture (Prospect, Wendell)
    (6, 1, 3, 'Meeting', 6, 18, 'Showroom visit with Owen. He wants one agency for brand and performance.'),
    (6, 2, 3, 'Email', 15, 21, 'Sent Priya our capabilities deck and two furniture case studies.'),
    (6, 1, 3, 'Call', 33, 17, 'Owen asked for ideas on getting more foot traffic to the new Evanston showroom.'),
    (6, 0, 2, 'Note', 44, 20, 'Their current agency contract ends in about three months.'),
    -- Juniper Row Clinics (Prospect, Ines)
    (7, 1, 5, 'Email', 10, 16, 'Leah asked for examples of healthcare campaigns that stayed compliant.'),
    (7, 2, 5, 'Call', 26, 19, 'Tom wants to understand pricing before involving the board.'),
    (7, 1, 5, 'Meeting', 50, 18, 'Met Leah at the Minnesota health marketing meetup.'),
    -- Cobaltline Analytics (Prospect, Wendell)
    (18, 1, 3, 'Call', 4, 20, 'Ivy needs pipeline from mid-market accounts. LinkedIn costs are hurting them.'),
    (18, 2, 3, 'Email', 20, 17, 'Rob replied to our outreach about the Boston SaaS dinner.'),
    -- Granite Hollow Brewing (Prospect, Theo)
    (19, 1, 2, 'Meeting', 9, 22, 'Tasting room visit with Cal. They want to get into grocery chains across Oregon.'),
    (19, 2, 2, 'Email', 30, 18, 'Joanna sent their event calendar for next year.'),
    -- Marrow & Vine Kitchen (Prospect, Maya)
    (20, 1, 1, 'Call', 2, 22, 'Etienne wants to fill weeknight tables at the two newer sites.'),
    (20, 2, 1, 'Email', 7, 19, 'Keisha sent their private events pricing. Events are their best margin.'),
    (20, 1, 1, 'Meeting', 13, 23, 'Dinner at the Magazine St. site with Etienne. Good chemistry.'),
    -- Tidebrook Insurance (Prospect, Wendell)
    (21, 1, 3, 'Email', 15, 16, 'Frank went quiet after the revised Proposal. Sent a short nudge.'),
    (21, 2, 3, 'Call', 40, 18, 'Amy explained how they get leads today: mostly referrals and a dated website.'),
    (21, 1, 3, 'Meeting', 70, 17, 'Coffee with Frank in Charleston. He is curious but cautious.'),
    -- Oakhurst Learning (Prospect, Ines)
    (22, 1, 5, 'Meeting', 5, 18, 'Workshop with Renee on enrollment. They have lost share to an online tutor.'),
    (22, 2, 5, 'Email', 19, 20, 'Darnell asked for a rough budget for an enrollment campaign.'),
    -- Sparrowhill Toys (Prospect, Jonas)
    (23, 1, 4, 'Call', 4, 17, 'Willa wants help with a new toy launch, but the timing is tight.'),
    (23, 2, 4, 'Email', 10, 15, 'Gus confirmed their stock levels for the launch.'),
    -- Hollowmere Snacks (Prospect, Maya)
    (24, 1, 1, 'Meeting', 8, 16, 'Megan presented their new flavor line. They need shopper marketing for two grocery chains.'),
    (24, 2, 1, 'Email', 22, 21, 'Luis shared the retailer calendar for the next shelf resets.'),
    (24, 1, 1, 'Call', 35, 18, 'First call with Megan, referred by Wrenfield Tea.'),
    -- Corbel Lane Property Group (Prospect, Wendell)
    (25, 1, 3, 'Email', 28, 15, 'Sharon asked us to hold off until their new fiscal year.'),
    (25, 2, 3, 'Call', 60, 19, 'Tyler walked us through their leasing funnel. Lots of leads, few tours.'),
    (25, 1, 3, 'Meeting', 95, 17, 'Met Sharon at the Dallas apartment association expo.'),
    -- Quillon Mobility (Prospect, Theo)
    (26, 1, 2, 'Call', 3, 21, 'Mateo wants a launch plan for Fort Lauderdale. Very data-driven buyer.'),
    (26, 2, 2, 'Email', 11, 18, 'Nadia sent ridership data from the Miami launch.'),
    -- Silverpine Dermatology (Prospect, Ines)
    (27, 2, 5, 'Email', 6, 17, 'Chase asked for a proposal covering cosmetic services only.'),
    (27, 1, 5, 'Meeting', 21, 20, 'Met Dr. Kim at the clinic. She wants a more premium look.'),
    (27, 1, 2, 'Call', 45, 18, 'Discovery call: they are opening a sixth clinic in Chandler.'),
    -- Ferrous Fitness (Prospect, Jonas)
    (28, 1, 4, 'Call', 1, 23, 'Bo called after seeing our Ostrander work. Wants ads for a membership drive.'),
    (28, 2, 4, 'Email', 5, 16, 'Kara sent class schedules and photos from the North Side gym.'),
    -- Birch & Bellows Interiors (Prospect, Maya)
    (29, 1, 1, 'Meeting', 12, 17, 'Portfolio review at their studio. Vivian wants fewer, bigger projects.'),
    (29, 2, 1, 'Email', 25, 20, 'Noah sent their project list and average fees.'),
    (29, 1, 1, 'Call', 50, 16, 'Intro call with Vivian, referred by Brindlewood Hotels.'),
    -- Duskwing Software (Prospect, Wendell)
    (30, 1, 3, 'Email', 2, 15, 'Erin confirmed they want help with a product launch in four months.'),
    (30, 2, 3, 'Meeting', 14, 19, 'Video call with Sanjay and Erin about positioning against bigger HR suites.'),
    -- Wexcombe Pharmacy (Prospect, Theo)
    (31, 1, 2, 'Note', 20, 18, 'Martha says a store remodel keeps them too busy to start for a couple of months.'),
    (31, 2, 2, 'Call', 75, 17, 'Devon wants more prescription transfers from chain pharmacies.'),
    (31, 1, 2, 'Meeting', 110, 19, 'Met Martha at their Westport store.'),
    -- Driftmoor Seafood (Prospect, Jonas)
    (32, 1, 4, 'Email', 16, 18, 'Colin asked about off-season marketing. Summer is packed; winter is empty.'),
    (32, 2, 4, 'Call', 30, 20, 'Abby shared their reservations data by month.'),
    -- Sunwake Solar (Prospect, Wendell)
    (33, 1, 3, 'Meeting', 7, 18, 'Raj needs cheaper leads. Their cost per install is up 40% in a year.'),
    (33, 2, 3, 'Email', 24, 16, 'Kristen sent their lead sources and close rates.'),
    (33, 1, 4, 'Call', 55, 21, 'Jonas reviewed their ad accounts. Lots of wasted spend on broad keywords.'),
    -- Pawsley Grooming (Prospect, Ines)
    (34, 1, 5, 'Call', 9, 15, 'Tanya wants to fill weekday slots. Weekends are booked for a month.'),
    (34, 2, 5, 'Email', 20, 19, 'Omar sent the booking system export.'),
    -- Oriel Language School (Prospect, Maya)
    (35, 1, 1, 'Email', 31, 18, 'Isabel paused talks until their new director starts. Check back in two months.'),
    (35, 2, 1, 'Meeting', 70, 20, 'Admissions walkthrough with Kenji. Most students find them through friends.'),
    (35, 1, 1, 'Call', 120, 17, 'First call with Isabel about corporate language programs.'),
    -- Wickham Orchard Cider (Prospect, Theo)
    (36, 1, 2, 'Meeting', 6, 22, 'Visit to the orchard with Hazel. Spring release is their big moment.'),
    (36, 2, 2, 'Email', 14, 17, 'Pete wants to know if we can help with distributor sell-in materials.'),
    -- Pellham & Rowe LLP (Prospect, Wendell)
    (37, 2, 3, 'Email', 19, 16, 'Daniel asked for references from professional services clients.'),
    (37, 1, 3, 'Meeting', 48, 18, 'Met Catherine and Daniel. They want to recruit associates, not just win clients.'),
    (37, 2, 3, 'Call', 80, 15, 'Intro call with Daniel.'),
    -- Kelpwood Surf Co. (Prospect, Jonas)
    (38, 1, 4, 'Call', 11, 21, 'Jesse wants to grow the apparel line beyond Santa Cruz.'),
    (38, 2, 5, 'Email', 27, 18, 'Sky shared their Instagram stats. Strong following, weak sales from it.'),
    -- Mirabel Bridal (Prospect, Ines)
    (39, 1, 5, 'Email', 22, 17, 'Celine said they chose to keep marketing in-house for now.'),
    (39, 2, 5, 'Meeting', 60, 19, 'Store visit with Alana. Appointments are their key metric.'),
    -- Stackyard Pizza (Prospect, Maya)
    (40, 1, 1, 'Call', 1, 20, 'Vince wants one agency for all 10 sites. Their current setup is a different freelancer per site.'),
    (40, 2, 1, 'Email', 3, 17, 'Brianna sent their sales by site and their loyalty app numbers.')
  ) as w (company, contact, author, kind, days_ago, hour, text)) as v;

-- 21 open Deals, New business, across the open Stages and every Owner. Ticket
-- 08 adds 5 Renewals, for about 25 in all. Numbers have gaps on purpose: ids
-- stay stable when a Deal is dropped.
-- `due` is the Next step's due day relative to the anchor's day: below zero is
-- overdue, 0 is due today. Each Deal starts when its Company was added.
insert into crm.deals (sandbox_id, id, company_id, owner_id, title, kind, stage, estimated_monthly_value,
                       next_step, next_step_due, created_at)
select pg_temp.template(), pg_temp.deal(v.n), c.id, pg_temp.teammate(v.owner), v.title, 'New business',
       v.stage::crm.deal_stage, v.value, v.next_step,
       (select (created_at at time zone 'utc')::date from crm.sandboxes where is_template) + v.due,
       c.added_at + interval '1 hour'
  from (values
    (1, 2, 1, 'Product launch campaign', 'New', 9500, 'Send the intro deck and pricing to Rhoda', 1),
    (2, 3, 3, 'Test ride bookings: search and social', 'Qualified', 6000, 'Get budget numbers from Dana', -2),
    (3, 5, 4, 'Subscription growth and Amazon ads', 'Discovery', 8500, 'Audit their Amazon ad account', 3),
    (4, 6, 3, 'Brand and performance retainer', 'Proposal sent', 14000, 'Follow up with Owen on the proposal', 0),
    (5, 7, 5, 'Patient growth campaign', 'Negotiation', 12000, 'Send Leah our compliance review process', -1),
    (7, 19, 2, 'Grocery launch across Oregon', 'Qualified', 7500, 'Map the retailer calendar with Cal', 6),
    (8, 20, 1, 'Weeknight covers and private events', 'Proposal sent', 5500, 'Call Etienne about the proposal', -4),
    (9, 21, 3, 'Lead generation website and search', 'Negotiation', 4800, 'Nudge Frank on the revised scope', -9),
    (10, 22, 5, 'Enrollment campaign', 'Discovery', 9000, 'Send Darnell a rough budget', 2),
    (11, 23, 4, 'Toy launch ads sprint', 'New', 3500, 'Confirm a start date with Willa', 1),
    (12, 24, 1, 'Shopper marketing for two grocery chains', 'Discovery', 10500, 'Draft the shelf reset plan with Megan', 4),
    (14, 26, 2, 'Fort Lauderdale launch', 'Qualified', 13000, 'Send Mateo the launch plan outline', -1),
    (15, 27, 5, 'Cosmetic services campaign', 'Proposal sent', 9500, 'Walk Chase through the proposal', 2),
    (16, 28, 4, 'Membership drive', 'New', 4000, 'Book a gym visit with Bo', 2),
    (17, 29, 1, 'Brand refresh for bigger projects', 'Negotiation', 6500, 'Agree a start date with Vivian', 3),
    (18, 30, 3, 'HR suite product launch', 'Qualified', 15000, 'Positioning workshop with Sanjay and Erin', 7),
    (20, 32, 4, 'Off-season dining campaign', 'Discovery', 4500, 'Send Colin the off-season promo ideas', -6),
    (21, 33, 3, 'Lower cost per install', 'Proposal sent', 16000, 'Present the proposal to Raj and Kristen', 1),
    (24, 37, 3, 'Associate recruiting and brand', 'Negotiation', 7000, 'Send Daniel our references', -3),
    (25, 38, 4, 'Apparel ecommerce growth', 'New', 5500, 'Intro call with Jesse and Sky', 2),
    (26, 40, 1, 'One agency for all 10 sites', 'Qualified', 18000, 'Collect site-level sales from Brianna', 1)
  ) as v (n, company, owner, title, stage, value, next_step, due)
  join crm.companies c on c.sandbox_id = pg_temp.template() and c.id = pg_temp.company(v.company);

-- A Sent Proposal for every Deal in Proposal sent or Negotiation. Deal 9's
-- first one was declined and revised.
insert into crm.proposals (sandbox_id, id, deal_id, version, status, scope_summary, term_months, created_at, sent_at)
select pg_temp.template(), pg_temp.proposal(v.deal, v.version), pg_temp.deal(v.deal), v.version,
       v.status::crm.proposal_status, v.scope, v.term,
       pg_temp.before_anchor(v.sent_days_ago + 1, 16), pg_temp.before_anchor(v.sent_days_ago, 18)
  from (values
    (4, 1, 'Sent', 4, 12, 'One team for the brand refresh and paid media, with the Evanston showroom opening first.'),
    (5, 1, 'Sent', 14, 12, 'Patient growth for all 9 clinics, with a compliance check on everything we publish.'),
    (8, 1, 'Sent', 5, 6, 'Fill weeknight tables at the two newer sites and grow private events.'),
    (9, 1, 'Declined', 30, 12, 'A new website and always-on search for personal and business lines.'),
    (9, 2, 'Sent', 20, 6, 'Search only to start, with a small landing page set instead of a new website.'),
    (15, 1, 'Sent', 3, 12, 'A premium look for cosmetic services, from first click to booked consultation.'),
    (17, 1, 'Sent', 9, 9, 'A brand and portfolio that attract fewer, bigger projects.'),
    (21, 1, 'Sent', 2, 12, 'Rebuild search and the quote journey to bring cost per install down.'),
    (24, 1, 'Sent', 12, 12, 'An associate recruiting campaign, with a firm brand to back it up.')
  ) as v (deal, version, status, sent_days_ago, term, scope);

insert into crm.proposal_line_items (sandbox_id, proposal_id, position, service, monthly_fee)
select pg_temp.template(), pg_temp.proposal(v.deal, v.version), v.position, v.service, v.fee
  from (values
    (4, 1, 1, 'Paid search and social', 6500),
    (4, 1, 2, 'Brand refresh', 4500),
    (4, 1, 3, 'Strategy and reporting', 3500),
    (5, 1, 1, 'Local search for 9 clinics', 5800),
    (5, 1, 2, 'Patient content', 4200),
    (5, 1, 3, 'Compliance review', 1800),
    (8, 1, 1, 'Local paid social', 2800),
    (8, 1, 2, 'Private events pages', 1500),
    (8, 1, 3, 'Photography', 1400),
    (9, 1, 1, 'Website', 3900),
    (9, 1, 2, 'Search ads', 2400),
    (9, 2, 1, 'Search ads', 2900),
    (9, 2, 2, 'Landing pages', 1700),
    (15, 1, 1, 'Search for cosmetic services', 4200),
    (15, 1, 2, 'Photo and video', 3600),
    (15, 1, 3, 'Landing pages', 1900),
    (17, 1, 1, 'Brand refresh', 3800),
    (17, 1, 2, 'Portfolio website', 2600),
    (21, 1, 1, 'Paid search rebuild', 8200),
    (21, 1, 2, 'Landing page testing', 5200),
    (21, 1, 3, 'Lead quality reporting', 3000),
    (24, 1, 1, 'Recruiting campaign', 4200),
    (24, 1, 2, 'Firm brand content', 3100)
  ) as v (deal, version, position, service, fee);

-- 15 active Retainers for 12 Clients, each from a Won Deal with an Accepted
-- Proposal. Five end within 60 days (ticket 08's Renewals), and three were won
-- in the last two weeks. `last_day` counts from the anchor's day.
create temporary table sample_retainers as
select v.*, (v.anchor_day + v.last_day + 1 - make_interval(months => v.term))::date as start_date
  from (
    select w.*, (select (created_at at time zone 'utc')::date from crm.sandboxes where is_template) as anchor_day
      from (values
        (101, 1, 1, 'Loyalty and paid social', 12, 190, 'Loyalty sign-ups and paid social for 14 cafes.', 'Paid social', 5200, 'Loyalty campaign', 3000),
        (102, 1, 1, 'New cafe openings', 6, 180, 'Local launches for each new cafe.', 'Launch campaigns', 2200, 'Local search', 1200),
        (103, 4, 2, 'Direct booking growth', 12, 140, 'More direct bookings across the five hotels.', 'Metasearch and search ads', 5800, 'Photography and content', 3800),
        (104, 8, 4, 'Membership growth', 9, 12, 'New members for six gyms.', 'Paid social', 4200, 'Video series', 2200),
        (105, 9, 1, 'DTC growth and subscriptions', 12, 41, 'Grow subscriptions and repeat orders.', 'Paid social', 4600, 'Subscription tests', 2800),
        (106, 10, 2, 'Wine club and events', 12, 55, 'Fill the wine club and the event calendar.', 'Wine club campaigns', 3200, 'Event promotion', 2000),
        (107, 11, 4, 'New patient search', 12, 120, 'New patient bookings for 11 clinics.', 'Local search ads', 8300, 'Clinic pages', 3500),
        (108, 12, 5, 'Store and email', 12, 210, 'Email flows and seasonal creative.', 'Email and flows', 2600, 'Campaign creative', 2200),
        (109, 12, 5, 'Influencer seeding', 6, 170, 'Seed each scent launch with 40 creators.', 'Creator seeding', 1900, 'Reporting', 700),
        (110, 13, 1, 'Member growth', 12, 33, 'New members for eight branches.', 'Brand campaign', 5400, 'Branch marketing', 3500),
        (111, 14, 3, 'Online store ads', 9, 24, 'Paid search and product ads for the online store.', 'Product ads', 4400, 'Catalog creative', 2500),
        (112, 15, 5, 'Brand and local marketing', 12, 95, 'One warm brand across seven shops.', 'Brand and print', 2500, 'Local social', 1800),
        (113, 16, 1, 'Local search and reviews', 12, 165, 'More appointments from search, and more reviews.', 'Local search', 3600, 'Reviews and video', 2000),
        (114, 17, 4, 'Try-on campaign and paid social', 12, 230, 'Home try-on, from ad to purchase.', 'Paid social', 6100, 'Creative refresh', 3200),
        (115, 17, 4, 'TikTok Shop test', 3, 89, 'A three-month test for the new acetate frames.', 'TikTok Shop', 2100, 'Creator content', 1000)
      ) as w (n, company, owner, title, term, last_day, scope, service_1, fee_1, service_2, fee_2)
  ) as v;

insert into crm.deals (sandbox_id, id, company_id, owner_id, title, kind, stage, estimated_monthly_value, created_at, closed_on)
select pg_temp.template(), pg_temp.deal(n), pg_temp.company(company), pg_temp.teammate(owner), title, 'New business', 'Won',
       fee_1 + fee_2, start_date - interval '20 days', start_date
  from sample_retainers;

insert into crm.proposals (sandbox_id, id, deal_id, version, status, scope_summary, term_months, created_at, sent_at)
select pg_temp.template(), pg_temp.proposal(n, 1), pg_temp.deal(n), 1, 'Accepted', scope, term,
       start_date - interval '10 days', start_date - interval '9 days'
  from sample_retainers;

insert into crm.proposal_line_items (sandbox_id, proposal_id, position, service, monthly_fee)
select pg_temp.template(), pg_temp.proposal(n, 1), item.position, item.service, item.fee
  from sample_retainers r
  cross join lateral (values (1, r.service_1, r.fee_1), (2, r.service_2, r.fee_2)) as item (position, service, fee);

insert into crm.retainers (sandbox_id, id, company_id, deal_id, owner_id, monthly_fee, start_date, end_date)
select pg_temp.template(), pg_temp.retainer(n), pg_temp.company(company), pg_temp.deal(n), pg_temp.teammate(owner),
       fee_1 + fee_2, start_date, crm.last_day(start_date, term)
  from sample_retainers;

-- A Prospect's Activities are all about its one Deal. A Client's, so far, are
-- ongoing work and not about a Deal.
update crm.activities a
   set deal_id = d.id
  from crm.deals d
 where a.sandbox_id = pg_temp.template() and d.sandbox_id = a.sandbox_id and d.company_id = a.company_id
   and d.company_id not in (select pg_temp.company(n) from unnest(array[1, 4, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]) as n);

-- How each Client's Deals were won, so every Retainer has a history.
insert into crm.activities (sandbox_id, id, company_id, contact_id, deal_id, author_id, kind, occurred_at, text)
select pg_temp.template(), pg_temp.activity(500 + v.ord), pg_temp.company(r.company), pg_temp.contact(r.company, v.contact),
       pg_temp.deal(r.n), pg_temp.teammate(r.owner), v.kind::crm.activity_kind,
       pg_temp.before_anchor(r.anchor_day - r.start_date + v.days_before_win, v.hour), v.text
  from (select row_number() over () as ord, w.* from (values
    (101, 1, 'Meeting', 5, 18, 'Went through the Proposal with Rosa line by line. Loyalty first, paid social beside it.'),
    (102, 1, 'Call', 6, 17, 'Rosa wants every new cafe to open with its own launch plan. The Proposal covers it.'),
    (102, 1, 'Email', 1, 20, 'Rosa has sign-off on the new cafe openings. She will confirm the Proposal tomorrow.'),
    (103, 1, 'Meeting', 6, 16, 'Presented the direct booking plan to Claire. She likes that search and photography work together.'),
    (103, 2, 'Email', 1, 19, 'Marcus has the budget approved for direct booking growth.'),
    (104, 1, 'Call', 4, 18, 'Nina accepted the fee for membership growth and asked for a video series in the plan.'),
    (105, 1, 'Meeting', 5, 17, 'Tess compared us with two other agencies. Our subscription tests made the difference.'),
    (106, 2, 'Email', 3, 20, 'Graham asked for one change: event promotion all year round, not only at harvest.'),
    (107, 1, 'Meeting', 6, 19, 'Dr. Shah brought all the clinic managers to the Proposal review. They agreed on local search first.'),
    (108, 1, 'Call', 4, 17, 'Maren wants email and campaign creative under one roof. She is ready to start.'),
    (109, 1, 'Meeting', 7, 18, 'Scoped the creator list for the scent launches with Maren: 40 creators.'),
    (109, 2, 'Email', 1, 16, 'Felix confirmed the budget for influencer seeding.'),
    (110, 1, 'Call', 5, 19, 'Denise asked for references. Sent two, and she called both.'),
    (111, 1, 'Email', 3, 21, 'Hannah is happy with the scope: product ads now, catalog creative by season.'),
    (112, 1, 'Meeting', 6, 18, 'Gina and Andre reviewed the Proposal at the Passyunk shop. One brand across all seven.'),
    (113, 1, 'Call', 4, 17, 'Paula agreed to start with local search and add reviews in the same fee.'),
    (114, 1, 'Meeting', 5, 20, 'Pitched home try-on to Simone and Wes, from the first ad to the purchase.'),
    (115, 1, 'Email', 1, 18, 'Simone is in for a three-month TikTok Shop test.')
  ) as w (n, contact, kind, days_before_win, hour, text)) as v
  join sample_retainers r on r.n = v.n;

-- Every sample date must be before the anchor, or a fresh Sandbox would show
-- Activities in the future. Refuse to load a Template that breaks this.
do $$
begin
  if exists (
    select 1 from crm.activities a join crm.sandboxes t on t.id = a.sandbox_id
     where t.is_template and a.occurred_at > t.created_at
  ) or exists (
    select 1 from crm.companies c join crm.sandboxes t on t.id = c.sandbox_id
     where t.is_template and c.added_at > t.created_at
  ) or exists (
    select 1 from crm.deals d join crm.sandboxes t on t.id = d.sandbox_id
     where t.is_template and d.created_at > t.created_at
  ) or exists (
    select 1 from crm.proposals p join crm.sandboxes t on t.id = p.sandbox_id
     where t.is_template and p.sent_at > t.created_at
  ) or exists (
    -- Nor may an offer be older than its Deal.
    select 1 from crm.proposals p join crm.sandboxes t on t.id = p.sandbox_id
      join crm.deals d on d.sandbox_id = p.sandbox_id and d.id = p.deal_id
     where t.is_template and p.created_at < d.created_at
  ) or exists (
    select 1 from crm.retainers r join crm.sandboxes t on t.id = r.sandbox_id
     where t.is_template
       and (t.created_at at time zone 'utc')::date not between r.start_date and r.end_date
  ) or exists (
    -- Nor may a Deal be older than its Company.
    select 1 from crm.deals d join crm.sandboxes t on t.id = d.sandbox_id
      join crm.companies c on c.sandbox_id = d.sandbox_id and c.id = d.company_id
     where t.is_template and d.created_at < c.added_at
  ) then
    raise exception 'A Template date is after the anchor, a Retainer isn''t active, or a record is older than the one it belongs to.';
  end if;
end;
$$;
