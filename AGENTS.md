<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Game engine (rAthena pre-renewal) lives in src/lib/ro/engine/*.txt and is evaluated in the browser via src/lib/ro/engine.ts loadEngine(); keep it lazy and client-only because it and the data JSON are large.
- Party size cap (12) is enforced both in src/lib/ro/jobs.ts and a DB trigger on party_slots; change both together.
