import { useEffect, useMemo, useState } from "react";
import { Check, Clock3, Search, Swords, Users, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CharacterPortrait } from "@/components/CharacterPortrait";

export type KillMember = { id: string; display_name: string; char_name: string | null; avatar_path: string | null };
type Props = {
  open: boolean; onOpenChange: (open: boolean) => void;
  bossName: string; when: Date | null; reporterId: string | null; members: KillMember[];
  busy: boolean;
  onSave: (members: string[]) => Promise<boolean>;
};
export function MvpKillDialog({open,onOpenChange,bossName,when,reporterId,members,busy,onSave}: Props) {
  const [chosen,setChosen]=useState<string[]>([]);
  const [search,setSearch]=useState("");
  const [previous,setPrevious]=useState<string[]>([]);
  const [showAll,setShowAll]=useState(false);
  const storageKey=`guild-last-mvp-team:${reporterId??"guest"}`;
  useEffect(()=>{
    if (!open) return;
    setSearch("");
    setChosen(reporterId?[reporterId]:[]);
    setShowAll(false);
    try { const parsed=JSON.parse(localStorage.getItem(storageKey)??"[]");setPrevious(Array.isArray(parsed)?parsed.filter((id):id is string=>typeof id==="string"):[]); }
    catch {setPrevious([]);}
  },[open,reporterId,storageKey]);
  const visibleIds=new Set(members.map(m=>m.id));
  const team=previous.filter(id=>visibleIds.has(id));
  const sorted=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return members.filter(m=>!q||`${m.char_name??""} ${m.display_name}`.toLowerCase().includes(q))
      .sort((a,b)=>Number(chosen.includes(b.id))-Number(chosen.includes(a.id))
        ||Number(team.includes(b.id))-Number(team.includes(a.id))
        ||(a.char_name||a.display_name).localeCompare(b.char_name||b.display_name));
  },[members,search,chosen,previous]);
  const shown=search||showAll?sorted:sorted.slice(0,12);
  const toggle=(id:string)=>setChosen(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
  async function save() {
    if (!when || busy) return;
    const success=await onSave(chosen);
    if (success) {
      try { localStorage.setItem(storageKey,JSON.stringify(chosen)); }catch{/* Private browsing may disable storage */}
      onOpenChange(false);
    }
  }
  return <Dialog open={open} onOpenChange={busy?undefined:onOpenChange}>
    <DialogContent className="flex max-h-[92dvh] flex-col gap-3 overflow-hidden p-4 sm:max-w-xl sm:p-5">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-xl"><Swords className="h-5 w-5 text-primary"/> {bossName} defeated!</DialogTitle>
        <DialogDescription>Pick the guildmates who joined the kill. Tap names to toggle credit.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary/10 px-3 py-2">
        <span className="flex items-center gap-2 text-sm font-semibold"><Clock3 className="h-4 w-4"/>{when?.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit",second:"2-digit"})??"—"} <span className="font-normal text-muted-foreground">kill time saved</span></span>
        <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold">{chosen.length} selected</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={!team.length||busy} onClick={()=>setChosen(team)}> <Users className="mr-1 h-4 w-4"/> Last team ({team.length})</Button>
        <Button type="button" variant="outline" size="sm" disabled={!reporterId||busy} onClick={()=>setChosen(reporterId?[reporterId]:[])}>Just me</Button>
        <Button type="button" variant="ghost" size="sm" disabled={!chosen.length||busy} onClick={()=>setChosen([])}>Timer only</Button>
      </div>
      <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input autoFocus className="pl-9" placeholder="Find a guildmate…" value={search} onChange={e=>setSearch(e.target.value)} /></div>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border p-1" style={{maxHeight:"38vh"}}>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {shown.map(m=><button type="button" key={m.id} onClick={()=>toggle(m.id)} disabled={busy} aria-pressed={chosen.includes(m.id)}
            className={`flex min-w-0 items-center gap-2 rounded-lg border px-2 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${chosen.includes(m.id)?"border-primary bg-primary/10":"border-transparent hover:bg-secondary"}`}>
            <CharacterPortrait path={m.avatar_path} name={m.char_name||m.display_name} className="h-10 w-8 shrink-0"/>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.char_name||m.display_name}{m.id===reporterId&&<span className="block text-[10px] text-muted-foreground">You</span>}</span>
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${chosen.includes(m.id)?"border-primary bg-primary text-primary-foreground":"border-border"}`}>{chosen.includes(m.id)&&<Check className="h-4 w-4"/>}</span>
          </button>)}
        </div>
        {!shown.length&&<p className="p-5 text-center text-sm text-muted-foreground">No members found.</p>}
        {!search&&!showAll&&sorted.length>12&&<Button type="button" variant="ghost" className="mt-2 w-full" size="sm" onClick={()=>setShowAll(true)}>Show all {sorted.length} members</Button>}
      </div>
      <div className="border-t border-border pt-3">
        <Button type="button" className="h-12 w-full text-base font-bold" disabled={busy||!when} onClick={()=>void save()}><Zap className="mr-2 h-5 w-5"/>{busy?"Saving kill…":`Save kill · ${chosen.length} participant${chosen.length===1?"":"s"}`}</Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">Saves the respawn timer immediately. Participant credits are self-reported.</p>
      </div>
    </DialogContent>
  </Dialog>;
}
