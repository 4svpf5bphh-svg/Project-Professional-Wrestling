# Alpha access gate — deployment checklist

This is a temporary single-player perimeter guard, **not multiplayer authentication**.

- Set `PPW_ALPHA_ACCESS_PASSWORD` in the deployment environment to a unique random value of at least 16 characters. Never commit its value.
- The username is `ppw`. The browser prompts for the password when opening the app. Keep HTTPS enabled.
- If the variable is missing, player-facing requests fail closed with HTTP 503.
- The scheduled `/api/internal/*` endpoints are excluded from this gate and **must continue enforcing their existing `CRON_SECRET` authorization**.
- Do not merge or deploy until an independent check verifies login, rejected anonymous writes, iPhone Home Screen behaviour, scheduled World lock, and continuity of the live World.
- Basic authentication can be cached by the browser and is not suitable for multiple players, fine-grained sessions or account management. Replace it with per-user authentication before multiplayer.
- This gate does not fix any exposure from previously accessible Alpha endpoints; rotate affected secrets if necessary.
