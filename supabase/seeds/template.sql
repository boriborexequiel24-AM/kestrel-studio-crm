-- The Template: Kestrel Studio's sample data that every Sandbox starts as.
-- All names are fake. Dates are written relative to the anchor (the Template
-- row's created_at); building a Sandbox shifts them so they read as current.
-- Safe to re-run: it replaces the whole Template.

delete from crm.sandboxes where is_template;

insert into crm.sandboxes (id, is_template, created_at)
values ('00000000-0000-4000-8000-000000000000', true, '2026-11-02 09:00:00+00');

-- The Persona and 4 Teammates.
insert into crm.teammates (sandbox_id, id, first_name, last_name, role, initials, is_persona) values
  ('00000000-0000-4000-8000-000000000000', '00000000-0000-4000-8000-0000000000a1', 'Maya', 'Brandt', 'Account Director', 'MB', true),
  ('00000000-0000-4000-8000-000000000000', '00000000-0000-4000-8000-0000000000a2', 'Theo', 'Lindqvist', 'Strategy Lead', 'TL', false),
  ('00000000-0000-4000-8000-000000000000', '00000000-0000-4000-8000-0000000000a3', 'Wendell', 'Ames', 'New Business Manager', 'WA', false),
  ('00000000-0000-4000-8000-000000000000', '00000000-0000-4000-8000-0000000000a4', 'Jonas', 'Webb', 'Performance Lead', 'JW', false),
  ('00000000-0000-4000-8000-000000000000', '00000000-0000-4000-8000-0000000000a5', 'Ines', 'Calloway', 'Creative Director', 'IC', false);

-- A first set of Companies. Ticket 03 grows this to about 40 and checks every
-- name for clashes with real businesses.
insert into crm.companies (sandbox_id, id, name, industry, city, owner_id, added_at)
select t.id, v.id::uuid, v.name, v.industry, v.city, v.owner_id::uuid, t.created_at - v.days_ago * interval '1 day'
  from crm.sandboxes t,
  (values
    ('00000000-0000-4000-8000-00000000c001', 'Harbor & Pine Coffee', 'Coffee roaster, 14 cafes', 'Seattle, WA', '00000000-0000-4000-8000-0000000000a1', 610),
    ('00000000-0000-4000-8000-00000000c002', 'Saltmarsh Skincare', 'DTC beauty', 'Portland, OR', '00000000-0000-4000-8000-0000000000a1', 3),
    ('00000000-0000-4000-8000-00000000c003', 'Hollis Cycle Works', 'E-bikes', 'Denver, CO', '00000000-0000-4000-8000-0000000000a3', 21),
    ('00000000-0000-4000-8000-00000000c004', 'Brindlewood Hotels', 'Boutique hotels, 5 sites', 'Asheville, NC', '00000000-0000-4000-8000-0000000000a2', 430),
    ('00000000-0000-4000-8000-00000000c005', 'Fernhill Pet Co.', 'Pet food', 'Austin, TX', '00000000-0000-4000-8000-0000000000a4', 9),
    ('00000000-0000-4000-8000-00000000c006', 'Quarry Lane Furniture', 'Furniture retail', 'Chicago, IL', '00000000-0000-4000-8000-0000000000a3', 48),
    ('00000000-0000-4000-8000-00000000c007', 'Juniper Row Clinics', 'Healthcare, 9 clinics', 'Minneapolis, MN', '00000000-0000-4000-8000-0000000000a5', 75),
    ('00000000-0000-4000-8000-00000000c008', 'Ostrander Climbing', 'Climbing gyms, 6 sites', 'Salt Lake City, UT', '00000000-0000-4000-8000-0000000000a4', 290)
  ) as v (id, name, industry, city, owner_id, days_ago)
 where t.is_template;
