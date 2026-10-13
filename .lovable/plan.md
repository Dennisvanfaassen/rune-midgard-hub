# Fix Discord party announcements

## What I found
- Your two test parties ("Test" and "Test 2") were created fine.
- I can't find any sign that the site tried to send them to Discord. Right now the site hides every Discord problem, so a failure stays invisible to both of us. The exact cause isn't confirmed yet.
- Likely causes, to check in order:
  1. The webhook link may come from Discord PTB or Canary (`ptb.discord.com` / `canary.discord.com`). The site's safety check only accepts plain `discord.com` links, so it would skip the message silently.
  2. The preview may not have picked up the saved link yet.
  3. Discord may have rejected the message.

## Plan
1. **Diagnose:** check that the saved link is there and has the right shape, without showing its contents. Then trigger one announcement for "Test 2" and read the result.
2. **Accept every Discord link type:** allow `discord.com`, `discordapp.com`, `ptb.discord.com` and `canary.discord.com` webhook links.
3. **Show errors:** after creating a party, the organiser sees a short notice, either "Posted to Discord" or the reason it failed (link missing, link not recognised, Discord refused).
4. **"Post to Discord" button:** on a party's page the organiser gets a button to send, or resend, the summary. This also lets you re-post "Test" and "Test 2".
5. **Log failures** so I can read Discord's exact answer next time.
6. If the link itself turns out wrong, I'll open the form so you can paste it again.

## Technical details
- `src/lib/discord.functions.ts`: widen the host regex, return `{ sent, reason, status }`, and log non-OK responses with status and body.
- `src/routes/parties.new.tsx`: show a toast for every result instead of swallowing errors.
- `src/routes/parties.$id.tsx`: creator-only "Post to Discord" button calling `announceParty`.
- Verify by calling the function for an existing party and confirming that Discord answers with success.
