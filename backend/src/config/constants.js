// Categories shared by Tasks and Vendors so the risk engine can match a
// vendor to the checklist item it fulfils (e.g. a "transportation" vendor
// covers "transportation" tasks).
const CATEGORIES = [
  "venue", "catering", "decor", "photography", "entertainment",
  "accommodation", "transportation", "invitations", "branding",
  "team_building", "leadership_session", "other",
];

module.exports = { CATEGORIES };
