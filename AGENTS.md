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

- Adult and youth follow-up lists share pure missed-Sunday counting and a completed-contact query so registration and reset rules stay consistent across age groups.
- The Ask AI chat streams through the `/api/chat` server route (AI SDK v7 + Lovable AI Gateway on `/v1/responses`); the route verifies the bearer token itself because chat transports don't get the server-function middleware, and any `toUIMessageStreamResponse` persistence must set `generateMessageId` (without it the saved message has an empty id and later saves collide).
