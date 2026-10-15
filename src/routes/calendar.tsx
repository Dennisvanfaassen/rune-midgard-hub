import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Cake, Swords, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/calendar")({
  head: () => ({ meta: [{ title: "Guild Calendar · Rune Midgard" }, { name: "description", content: "Guild parties, Endless Tower events and member birthdays." }] }),
  component: GuildCalendar,
});

type CalendarEvent = { id:string; day:number; sort:number; title:string; type:"party"|"et"|"birthday"; time?:string; href:"party"|"member"; target:string; extra?:string };
function GuildCalendar() {
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<number | null>(null);
  const year=month.getFullYear(), monthIndex=month.getMonth();
  const start=new Date(year,monthIndex,1), finish=new Date(year,monthIndex+1,1);
  const parties=useQuery({
    queryKey:["guild-calendar-parties",year,monthIndex],
    queryFn:async()=>{
      const {data,error}=await supabase.from("parties").select("id,title,place,starts_at,template").gte("starts_at",new Date(year,monthIndex-1,27).toISOString()).lt("starts_at",new Date(year,monthIndex+1,4).toISOString()).order("starts_at");
      if(error)throw error;return data??[];
    },
    refetchInterval:60000,
  });
  const people=useQuery({
    queryKey:["guild-calendar-birthdays"],
    queryFn:async()=>{
      const {data,error}=await supabase.from("profiles").select("id,display_name,char_name,birthday_month,birthday_day").not("birthday_month","is",null).not("birthday_day","is",null);
      if(error)throw error;return data??[];
    },
    refetchInterval:60000,
  });
  const events:CalendarEvent[]=[
    ...(parties.data??[]).flatMap(p=>{
      const d=new Date(p.starts_at);
      if(d.getFullYear()!==year||d.getMonth()!==monthIndex)return [];
      const et=/endless\s*tower|\bET\b/i.test(p.title)||/\bet\b|endless/i.test(p.template??"");
      return [{id:p.id,day:d.getDate(),sort:d.getHours()*60+d.getMinutes(),title:p.title,type:et?"et" as const:"party" as const,time:d.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"}),href:"party" as const,target:p.id,extra:p.place}];
    }),
    ...(people.data??[]).filter(p=>p.birthday_month===monthIndex+1&&p.birthday_day&&p.birthday_day<=new Date(year,monthIndex+1,0).getDate()).map(p=>({id:"birthday-"+p.id,day:p.birthday_day!,sort:-1,title:p.char_name||p.display_name,type:"birthday" as const,href:"member" as const,target:p.id})),
  ].sort((a,b)=>a.day-b.day||a.sort-b.sort);
  const daysInMonth=new Date(year,monthIndex+1,0).getDate();
  const blanks=(start.getDay()+6)%7;
  const current=selected && selected<=daysInMonth?selected:null;
  const displayed=events.filter(e=>current===null||e.day===current);
  const move=(step:number)=>{setMonth(new Date(year,monthIndex+step,1));setSelected(null);};
  const eventLink=(e:CalendarEvent)=><Link key={e.id} to={e.href==="party"?"/parties/$id":"/members/$id"} params={{id:e.target}} className="block rounded-md border border-border bg-background/70 px-2 py-1.5 text-xs hover:border-primary hover:text-primary">
    <span className={e.type==="birthday"?"text-pink-500":e.type==="et"?"text-amber-500":"text-primary"}>{e.type==="birthday"?"🎂":e.type==="et"?"⚔":"●"}</span> {e.time&&<span className="font-semibold">{e.time} </span>}{e.type==="birthday"?"Birthday: ":""}{e.title}
  </Link>;
  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:py-12">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-primary"><CalendarDays className="h-4 w-4"/> Guild headquarters</p><h1 className="mt-2 font-display text-3xl font-bold">Guild Calendar</h1><p className="mt-2 text-sm text-muted-foreground">All parties, Endless Tower runs and member birthdays in one place.</p></div><Link to="/parties/new" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Plan a party</Link></div>
    <div className="flex flex-wrap gap-4 text-xs"><span className="flex items-center gap-1"><Users className="h-4 w-4 text-primary"/> Parties</span><span className="flex items-center gap-1"><Swords className="h-4 w-4 text-amber-500"/> Endless Tower</span><span className="flex items-center gap-1"><Cake className="h-4 w-4 text-pink-500"/> Birthdays</span></div>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-4"><button aria-label="Previous month" onClick={()=>move(-1)} className="rounded-lg p-2 hover:bg-secondary"><ChevronLeft className="h-5 w-5"/></button><h2 className="font-display text-xl font-bold">{start.toLocaleDateString(undefined,{month:"long",year:"numeric"})}</h2><button aria-label="Next month" onClick={()=>move(1)} className="rounded-lg p-2 hover:bg-secondary"><ChevronRight className="h-5 w-5"/></button></div>
        <div className="grid grid-cols-7 border-b border-border bg-secondary/30 text-center text-xs font-semibold text-muted-foreground">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(x=><div className="py-3" key={x}>{x}</div>)}</div>
        <div className="grid grid-cols-7">{Array.from({length:Math.ceil((blanks+daysInMonth)/7)*7},(_,i)=>{
          const d=i-blanks+1, valid=d>=1&&d<=daysInMonth, dayEvents=events.filter(e=>e.day===d),isToday=valid&&d===today.getDate()&&year===today.getFullYear()&&monthIndex===today.getMonth();
          return <div key={i} className={`min-h-24 border-b border-r border-border/60 p-1.5 md:min-h-32 md:p-2 ${valid?"":"bg-secondary/20"} ${selected===d&&valid?"bg-primary/5":""}`}>
          {valid&&<><button onClick={()=>setSelected(selected===d?null:d)} aria-label={`Show events for ${d}`} className={`mb-2 flex h-7 w-7 items-center justify-center rounded-full text-sm ${isToday?"bg-primary font-bold text-primary-foreground":selected===d?"bg-secondary font-semibold":""}`}>{d}</button><div className="hidden space-y-1 sm:block">{dayEvents.slice(0,3).map(eventLink)}{dayEvents.length>3&&<button className="text-xs text-primary" onClick={()=>setSelected(d)}>+{dayEvents.length-3} more</button>}</div><div className="flex gap-1 sm:hidden">{dayEvents.slice(0,4).map(e=><span key={e.id} className={`h-1.5 w-1.5 rounded-full ${e.type==="birthday"?"bg-pink-500":e.type==="et"?"bg-amber-500":"bg-primary"}`}/>)}</div></>}</div>;
        })}</div>
      </section>
      <aside className="rounded-xl border border-border bg-card p-4"><div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">{current?`Events on ${current} ${start.toLocaleDateString(undefined,{month:"short"})}`:"This month's events"}</h3>{current&&<button onClick={()=>setSelected(null)} className="text-xs text-primary">Show all</button>}</div>{parties.isError||people.isError?<p className="text-xs text-destructive">Unable to load calendar data. Birthdays require SQL migration 0016.</p>:null}{parties.isLoading||people.isLoading?<p className="text-sm text-muted-foreground">Loading events…</p>:null}<div className="space-y-2">{displayed.map(e=><div key={e.id}><p className="mb-1 text-xs font-semibold text-muted-foreground">{new Date(year,monthIndex,e.day).toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"})}</p>{eventLink(e)}</div>)}{!displayed.length&&!parties.isLoading&&!people.isLoading&&<p className="text-sm text-muted-foreground">No events for this selection.</p>}</div><p className="mt-5 text-xs text-muted-foreground">Add your birthday in Edit profile. Only month and day are shown; no year or age.</p></aside>
    </div>
  </main>;
}
