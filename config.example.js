// Config template. Copy to config.js and fill in your own values:
//   cp config.example.js config.js
// config.js is git-ignored — secrets live locally only.
self.LEEXI_CONFIG = {
  // --- Leexi auth (Basic auth: base64(key_id:key_secret)) ---
  key_id: "YOUR_LEEXI_KEY_ID",
  key_secret: "YOUR_LEEXI_KEY_SECRET",

  // --- Organizer: your Leexi email ---
  // user_uuid is resolved automatically from this email (GET /v1/users) and cached.
  organizer: "you@example.com",

  // user_uuid: "",  // optional: set manually to skip the /users lookup

  // --- Meeting options ---
  title: "Instant Meet (Leexi)",
  internal: false,       // true = internal meeting; false = external / client call
  meeting_minutes: 120,  // length of the created meeting_event window
};
