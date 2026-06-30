// Шаблон конфига. Скопируй в config.js и заполни своими значениями:
//   cp config.example.js config.js
// config.js игнорируется git'ом — секреты лежат только локально.
self.LEEXI_CONFIG = {
  // --- Авторизация Leexi (Basic auth: base64(key_id:key_secret)) ---
  key_id: "YOUR_LEEXI_KEY_ID",
  key_secret: "YOUR_LEEXI_KEY_SECRET",

  // --- Организатор: твой email в Leexi ---
  // user_uuid подтянется автоматически по этому email (GET /v1/users) и закешируется.
  organizer: "you@example.com",

  // user_uuid: "",  // опционально: задать вручную, тогда запрос к /users не делается

  // --- Параметры встречи ---
  title: "Instant Meet (Leexi)",
  internal: false,       // true = внутренняя встреча; false = внешняя/с клиентом
  meeting_minutes: 120,  // окно, на которое создаётся meeting_event
};
