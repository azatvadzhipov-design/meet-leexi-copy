# Meet + Leexi (1-click)

A Chrome toolbar button that creates a new Google Meet, copies the invite link to your clipboard, and instantly invites the [Leexi](https://leexi.ai) note-taker bot into the call.

## Features
- **Context-aware button:**
  - On an open Meet call (`meet.google.com/xxx-xxxx-xxx`) → invites Leexi **into that call**.
  - Anywhere else → creates a **new** Meet + invites Leexi.
- The invite link is copied to your clipboard — paste it anywhere.
- `user_uuid` is resolved automatically from your organizer email (and cached).
- Secrets stay in a local, git-ignored `config.js`.

## How it works
- **Invite into the current meeting** — while on `meet.google.com/xxx-xxxx-xxx`, click the icon:
  the extension copies the link and calls `POST /v1/meeting_events` (`to_record: true`) so the bot joins this call.
- **Start a new meeting** — anywhere else (any site, or a Meet page that isn't a call), click the icon:
  a new `meet.google.com/new` tab opens, the extension captures the meeting URL and invites Leexi the same way.
- Feedback: a toast appears on the Meet page and the icon shows a ✓ badge.

## Install
1. Create your local config and fill in your Leexi credentials:
   ```bash
   cp config.example.js config.js
   ```
   You only need `key_id`, `key_secret` and `organizer` (your Leexi email).
   `user_uuid` is resolved automatically. `config.js` is git-ignored — secrets never reach git.
2. Open Chrome in the profile / Google account you use to create meetings.
   Tip for launching a specific profile on macOS:
   ```bash
   open -na "Google Chrome" --args --profile-directory="Profile 1"
   ```
   (find your profile directory at `chrome://version` → "Profile Path").
3. Go to `chrome://extensions` and enable **Developer mode**.
4. **Load unpacked** → select this folder.
5. (Optional) Pin the icon from the puzzle-piece menu in the toolbar.

> The extension only runs in the profile you load it into.

## Configuration (`config.js`)
| Field | Description |
|-------|-------------|
| `key_id` / `key_secret` | Leexi API credentials. |
| `organizer` | Your Leexi email; `user_uuid` is looked up by it and cached. |
| `user_uuid` | Optional; if set, the `/users` lookup is skipped. |
| `internal` | `true` for internal meetings, `false` for external / client calls. |
| `meeting_minutes` | Length of the created meeting window. |
| `title` | Meeting title in Leexi. |

Reload the extension (⟳ on `chrome://extensions`) after editing `config.js`.

## Security
- `config.js` holds your Leexi secrets — it is git-ignored, never commit it.
- If a key leaks, rotate the Key Secret in Leexi and update `config.js`.

## Troubleshooting
- Badge `!` — couldn't get the Meet link (not signed in / 60 s timeout).
- Badge `ERR` — hover the icon: the tooltip shows the Leexi error.
- Logs: `chrome://extensions` → the card → "service worker" → Console.

## License
[MIT](LICENSE)
