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
- Shared party templates live in owner-managed public.party_templates; functional role eligibility and expiry derive from jobs.ts so all planner views share one rule.
- Character portraits use owner-scoped Storage uploads and signed read URLs; keep only the Storage path on profiles so private buckets work without public access.
- Reuse the uploaded calculation engines for additional build controls; never replace pre-renewal formulas with approximations.
- WishlistBoard is shared by the community page and homepage; mutations invalidate wishlist and profile gear caches together.
