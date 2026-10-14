import { useEffect, useId, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import { Placeholder } from "@tiptap/extensions";
import DOMPurify from "dompurify";
import { toast } from "sonner";
import {
  Bold, Italic, Underline, Strikethrough, Heading1, Heading2, Heading3, List, ListOrdered, Quote, Code2, Minus,
  AlignLeft, AlignCenter, AlignRight, Link2, ImagePlus, ImageUp, Undo2, Redo2, Highlighter, Palette, Pilcrow,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const BUCKET = "forum-images";

/** Image that remembers its private Storage path so fresh signed links can be made when shown. */
const StoredImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      path: { default: null, parseHTML: (el) => el.getAttribute("data-path"), renderHTML: (a) => (a["path"] ? { "data-path": a["path"] } : {}) },
    };
  },
});

const isHtml = (s: string) => /^\s*</.test(s);
const escapeText = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");

export function sanitize(html: string) {
  return DOMPurify.sanitize(isHtml(html) ? html : escapeText(html), {
    ALLOWED_TAGS: ["p", "br", "h1", "h2", "h3", "strong", "em", "u", "s", "a", "ul", "ol", "li", "blockquote", "pre", "code", "hr", "img", "span", "mark"],
    ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "title", "style", "data-path", "data-color", "class"],
    ALLOWED_URI_REGEXP: /^(https?:|mailto:)/i,
  });
}

/** Replace stored image links with fresh signed links (private bucket). */
export async function resolveImages(html: string) {
  const doc = new DOMParser().parseFromString(sanitize(html), "text/html");
  const imgs = [...doc.querySelectorAll<HTMLImageElement>("img[data-path]")];
  const paths = [...new Set(imgs.map((i) => i.dataset["path"]!).filter(Boolean))];
  if (paths.length) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60 * 6);
    const map = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
    imgs.forEach((i) => { const u = map.get(i.dataset["path"]!); if (u) i.src = u; });
  }
  doc.querySelectorAll("a").forEach((a) => { a.target = "_blank"; a.rel = "noopener noreferrer nofollow"; });
  return doc.body.innerHTML;
}

type ArticleHeading = { id: string; text: string; level: number };

/** Build navigation from sanitized headings, never from untrusted pasted HTML links. */
function addHeadingNavigation(html: string, prefix: string): { html: string; headings: ArticleHeading[] } {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const headings: ArticleHeading[] = [];
  const used = new Map<string, number>();
  doc.body.querySelectorAll("h1, h2, h3").forEach((heading) => {
    const text = (heading.textContent ?? "").trim().replace(/\\s+/g, " ");
    if (!text) return;
    const slug = text.toLowerCase().normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 65) || "section";
    const repeat = used.get(slug) ?? 0;
    used.set(slug, repeat + 1);
    const id = prefix + "-" + slug + (repeat ? "-" + (repeat + 1) : "");
    heading.id = id;
    headings.push({ id, text, level: Number(heading.tagName.slice(1)) });
  });
  return { html: doc.body.innerHTML, headings };
}

export function RichContent({ html }: { html: string }) {
  const prefix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [article, setArticle] = useState<{ html: string; headings: ArticleHeading[] } | null>(null);
  useEffect(() => {
    let live = true;
    setArticle(null);
    resolveImages(html).then((resolved) => {
      if (live) setArticle(addHeadingNavigation(resolved, prefix));
    }).catch(() => {
      if (live) setArticle(addHeadingNavigation(sanitize(html), prefix));
    });
    return () => { live = false; };
  }, [html, prefix]);
  if (article === null) return <div className="h-6 animate-pulse rounded bg-secondary" />;
  return <div>
    {article.headings.length >= 2 && <nav id={`${prefix}-toc`} aria-label="Article table of contents" className="forum-toc mb-6 rounded-lg border border-border bg-secondary/40 p-4">
      <div className="mb-3 text-sm font-bold uppercase tracking-wide text-primary">Jump to section</div>
      <ul className="grid gap-1 sm:grid-cols-2">
        {article.headings.map((heading) => <li key={heading.id} className={heading.level === 3 ? "pl-4" : ""}>
          <a className="forum-toc-link block rounded px-2 py-1.5 text-sm text-foreground hover:bg-secondary hover:text-primary"
            href={`#${heading.id}`}>{heading.text}</a>
        </li>)}
      </ul>
    </nav>}
    <div className="rich-content" dangerouslySetInnerHTML={{ __html: article.html }} />
    {article.headings.length >= 2 && <a className="mt-5 inline-block text-xs text-primary hover:underline"
      href={`#${prefix}-toc`}>↑ Back to section navigation</a>}
  </div>;
}

const COLORS = ["#e5e7eb", "#60a5fa", "#34d399", "#fbbf24", "#f87171", "#c084fc", "#f472b6"];

function Tool({ on, active, label, children, disabled }: { on: () => void; active?: boolean; label: string; children: React.ReactNode; disabled?: boolean }) {
  return <button type="button" title={label} aria-label={label} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={on}
    className={"inline-flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors disabled:opacity-40 " + (active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>{children}</button>;
}

function Toolbar({ editor, onUpload, uploading }: { editor: Editor; onUpload: () => void; uploading: boolean }) {
  const c = () => editor.chain().focus();
  const [palette, setPalette] = useState<"text" | "mark" | null>(null);
  const sep = <span className="mx-1 h-6 w-px bg-border" />;
  return <div className="sticky top-14 z-10 flex flex-wrap items-center gap-0.5 rounded-t-md border-b border-border bg-card p-1">
    <Tool label="Paragraph" active={editor.isActive("paragraph")} on={() => c().setParagraph().run()}><Pilcrow className="h-4 w-4" /></Tool>
    <Tool label="Heading 1" active={editor.isActive("heading", { level: 1 })} on={() => c().toggleHeading({ level: 1 }).run()}><Heading1 className="h-4 w-4" /></Tool>
    <Tool label="Heading 2" active={editor.isActive("heading", { level: 2 })} on={() => c().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></Tool>
    <Tool label="Heading 3" active={editor.isActive("heading", { level: 3 })} on={() => c().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></Tool>
    {sep}
    <Tool label="Bold" active={editor.isActive("bold")} on={() => c().toggleBold().run()}><Bold className="h-4 w-4" /></Tool>
    <Tool label="Italic" active={editor.isActive("italic")} on={() => c().toggleItalic().run()}><Italic className="h-4 w-4" /></Tool>
    <Tool label="Underline" active={editor.isActive("underline")} on={() => c().toggleUnderline().run()}><Underline className="h-4 w-4" /></Tool>
    <Tool label="Strikethrough" active={editor.isActive("strike")} on={() => c().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></Tool>
    <div className="relative">
      <Tool label="Text colour" on={() => setPalette(palette === "text" ? null : "text")}><Palette className="h-4 w-4" /></Tool>
      <Tool label="Highlight" active={editor.isActive("highlight")} on={() => setPalette(palette === "mark" ? null : "mark")}><Highlighter className="h-4 w-4" /></Tool>
      {palette && <div className="absolute left-0 top-9 z-20 flex gap-1 rounded-md border border-border bg-popover p-2 shadow-lg">
        {COLORS.map((col) => <button type="button" key={col} aria-label={`Colour ${col}`} className="h-6 w-6 rounded-full border border-border" style={{ background: col }}
          onClick={() => { if (palette === "text") c().setColor(col).run(); else c().toggleHighlight({ color: col }).run(); setPalette(null); }} />)}
        <button type="button" className="px-1 text-xs text-muted-foreground" onClick={() => { if (palette === "text") c().unsetColor().run(); else c().unsetHighlight().run(); setPalette(null); }}>Clear</button>
      </div>}
    </div>
    {sep}
    <Tool label="Align left" active={editor.isActive({ textAlign: "left" })} on={() => c().setTextAlign("left").run()}><AlignLeft className="h-4 w-4" /></Tool>
    <Tool label="Align centre" active={editor.isActive({ textAlign: "center" })} on={() => c().setTextAlign("center").run()}><AlignCenter className="h-4 w-4" /></Tool>
    <Tool label="Align right" active={editor.isActive({ textAlign: "right" })} on={() => c().setTextAlign("right").run()}><AlignRight className="h-4 w-4" /></Tool>
    {sep}
    <Tool label="Bullet list" active={editor.isActive("bulletList")} on={() => c().toggleBulletList().run()}><List className="h-4 w-4" /></Tool>
    <Tool label="Numbered list" active={editor.isActive("orderedList")} on={() => c().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Tool>
    <Tool label="Quote" active={editor.isActive("blockquote")} on={() => c().toggleBlockquote().run()}><Quote className="h-4 w-4" /></Tool>
    <Tool label="Code block" active={editor.isActive("codeBlock")} on={() => c().toggleCodeBlock().run()}><Code2 className="h-4 w-4" /></Tool>
    <Tool label="Divider" on={() => c().setHorizontalRule().run()}><Minus className="h-4 w-4" /></Tool>
    {sep}
    <Tool label="Link" active={editor.isActive("link")} on={() => {
      const prev = editor.getAttributes("link")["href"] as string | undefined;
      const url = window.prompt("Link address (https://…)", prev ?? "https://");
      if (url === null) return;
      if (!url.trim() || url === "https://") { c().unsetLink().run(); return; }
      if (!/^https?:\/\//i.test(url)) { toast.error("Links must start with https://"); return; }
      c().extendMarkRange("link").setLink({ href: url.trim() }).run();
    }}><Link2 className="h-4 w-4" /></Tool>
    <Tool label="Upload image" disabled={uploading} on={onUpload}><ImageUp className="h-4 w-4" /></Tool>
    <Tool label="Image from link" on={() => {
      const url = window.prompt("Image address (https://…)");
      if (!url) return;
      if (!/^https:\/\//i.test(url)) { toast.error("Image links must start with https://"); return; }
      c().setImage({ src: url.trim() }).run();
    }}><ImagePlus className="h-4 w-4" /></Tool>
    {sep}
    <Tool label="Undo" disabled={!editor.can().undo()} on={() => c().undo().run()}><Undo2 className="h-4 w-4" /></Tool>
    <Tool label="Redo" disabled={!editor.can().redo()} on={() => c().redo().run()}><Redo2 className="h-4 w-4" /></Tool>
    {uploading && <span className="ml-2 text-xs text-muted-foreground">Uploading image…</span>}
  </div>;
}

/** Full content editor for forum posts. `initial` may be HTML or old plain text. */
export function RichEditor({ initial = "", onChange, placeholder = "Write something…", minHeight = 240 }: { initial?: string; onChange: (html: string) => void; placeholder?: string; minHeight?: number }) {
  const { userId } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true, protocols: ["https", "http", "mailto"] } }),
      StoredImage.configure({ inline: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyleKit, Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: "",
    editorProps: { attributes: { class: "rich-content focus:outline-none px-4 py-3", style: `min-height:${minHeight}px` } },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
  });
  useEffect(() => {
    if (!editor || !initial) return;
    resolveImages(initial).then((h) => { editor.commands.setContent(h); onChange(editor.getHTML()); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  async function upload(file?: File) {
    if (!file || !editor || !userId) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type) || file.size > 5 * 1024 * 1024) { toast.error("Choose a PNG, JPEG, WebP or GIF under 5 MB"); return; }
    setUploading(true);
    const path = `${userId}/${crypto.randomUUID()}.${file.name.split(".").pop()?.toLowerCase() ?? "png"}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
    if (error) { setUploading(false); toast.error(error.message); return; }
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 6);
    setUploading(false);
    if (data?.signedUrl) editor.chain().focus().insertContent({ type: "image", attrs: { src: data.signedUrl, alt: file.name, path } }).run();
  }

  return <div className="rounded-md border border-input bg-background" onPaste={(e) => { const f = [...e.clipboardData.files].find((x) => x.type.startsWith("image/")); if (f) { e.preventDefault(); upload(f); } }}
    onDrop={(e) => { const f = [...e.dataTransfer.files].find((x) => x.type.startsWith("image/")); if (f) { e.preventDefault(); upload(f); } }}>
    {editor && <Toolbar editor={editor} uploading={uploading} onUpload={() => fileRef.current?.click()} />}
    <EditorContent editor={editor} />
    <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
  </div>;
}
