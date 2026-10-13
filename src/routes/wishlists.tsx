import { createFileRoute, Link } from "@tanstack/react-router";
import { WishlistBoard } from "@/components/WishlistBoard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/wishlists")({
  head: () => ({ meta: [
    { title: "Guild Wishlists · Rune Midgard" },
    { name: "description", content: "Find the gear Rune Midgard members want to farm and see what they already own." },
    { property: "og:title", content: "Guild Wishlists · Rune Midgard" },
    { property: "og:description", content: "Explore member gear wishlists and plan your next guild hunt." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Wishlists,
});
function Wishlists() {
  const { userId } = useAuth();
  return <main className="mx-auto max-w-6xl px-4 py-10">
    <div className="mb-8 flex flex-wrap items-center justify-between gap-3"><h1 className="text-4xl font-bold">Guild wishlists</h1>
      {userId ? <Button asChild><Link to="/members/$id" params={{ id: userId }}>My wishlist</Link></Button> : <Button asChild variant="outline"><Link to="/auth">Sign in to make a wishlist</Link></Button>}
    </div><WishlistBoard />
  </main>;
}