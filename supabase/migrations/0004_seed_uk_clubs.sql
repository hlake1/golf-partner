-- ========================================================================
-- Seed some UK golf clubs (Oxfordshire focus for Herbie's testing)
-- Coordinates are approximate; will get refined later.
-- Format: st_makepoint(LONGITUDE, LATITUDE)::geography
-- ========================================================================

insert into public.clubs (name, address, website, county, location) values
  ('Frilford Heath Golf Club', 'Frilford Heath, Abingdon OX13 5NW', 'https://www.frilfordheath.co.uk', 'Oxfordshire',
    st_makepoint(-1.3577, 51.6797)::geography),
  ('The Oxfordshire Golf Club', 'Rycote Ln, Milton Common OX9 2PU', 'https://www.theoxfordshiregolfclub.com', 'Oxfordshire',
    st_makepoint(-1.0619, 51.7297)::geography),
  ('Studley Wood Golf Club', 'The Straight Mile, Horton-cum-Studley OX33 1BF', 'https://www.studleywoodgolf.co.uk', 'Oxfordshire',
    st_makepoint(-1.1236, 51.8181)::geography),
  ('Hinksey Heights Golf Club', 'South Hinksey, Oxford OX1 5AB', 'https://www.oxford-golf.co.uk', 'Oxfordshire',
    st_makepoint(-1.2731, 51.7297)::geography),
  ('Tadmarton Heath Golf Club', 'Wigginton, Banbury OX15 5HL', 'https://www.tadmartongolf.com', 'Oxfordshire',
    st_makepoint(-1.4650, 51.9631)::geography),
  ('Burford Golf Club', 'Swindon Rd, Burford OX18 4JG', 'https://www.burfordgolfclub.co.uk', 'Oxfordshire',
    st_makepoint(-1.6408, 51.8058)::geography),
  ('Chipping Norton Golf Club', 'Southcombe, Chipping Norton OX7 5QH', 'https://www.chippingnortongolfclub.com', 'Oxfordshire',
    st_makepoint(-1.5292, 51.9339)::geography),
  ('Huntercombe Golf Club', 'Nuffield, Henley-on-Thames RG9 5SL', 'https://www.huntercombegolfclub.co.uk', 'Oxfordshire',
    st_makepoint(-1.0500, 51.5867)::geography),
  ('Waterstock Golf Club', 'Thame Rd, Waterstock OX33 1HT', 'https://www.waterstockgolf.co.uk', 'Oxfordshire',
    st_makepoint(-1.1069, 51.7519)::geography),
  ('Drayton Park Golf Club', 'Steventon Rd, Drayton OX14 4LA', 'https://www.draytonparkgolfclub.co.uk', 'Oxfordshire',
    st_makepoint(-1.3153, 51.6431)::geography),
  ('North Oxford Golf Club', 'Banbury Rd, Oxford OX2 8EZ', 'https://www.nogc.co.uk', 'Oxfordshire',
    st_makepoint(-1.2597, 51.7756)::geography),
  ('Southfield Golf Club', 'Hill Top Rd, Oxford OX4 1PF', 'https://www.southfieldgolf.com', 'Oxfordshire',
    st_makepoint(-1.2264, 51.7411)::geography),
  ('Witney Lakes Golf Club', 'Downs Rd, Witney OX29 0SY', 'https://www.witney-lakes.co.uk', 'Oxfordshire',
    st_makepoint(-1.5300, 51.7861)::geography),
  ('The Springs Golf Club', 'Wallingford Rd, North Stoke OX10 6BE', 'https://www.thespringshotel.co.uk/golf', 'Oxfordshire',
    st_makepoint(-1.1181, 51.5931)::geography),
  ('Badgemore Park Golf Club', 'Badgemore, Henley-on-Thames RG9 4NR', 'https://www.badgemorepark.com', 'Oxfordshire',
    st_makepoint(-0.9147, 51.5528)::geography)
on conflict do nothing;
