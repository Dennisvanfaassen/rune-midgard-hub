import { Flame, Shield, Swords, Sparkles, Heart, Music, Crosshair } from "lucide-react";
import basic from "@/assets/NV_BASIC.png.asset.json";
import sword from "@/assets/SM_SWORD.png.asset.json";
import recovery from "@/assets/SM_RECOVERY.png.asset.json";
import bash from "@/assets/SM_BASH.png.asset.json";
import provoke from "@/assets/SM_PROVOKE.png.asset.json";
import berserk from "@/assets/SM_AUTOBERSERK.png.asset.json";
import moving from "@/assets/SM_MOVINGRECOVERY.png.asset.json";
import twohand from "@/assets/SM_TWOHAND.png.asset.json";
import magnum from "@/assets/SM_MAGNUM.png.asset.json";
import endure from "@/assets/SM_ENDURE.png.asset.json";

const icons: Record<string, { url: string }> = { NV_BASIC: basic, SM_SWORD: sword, SM_RECOVERY: recovery, SM_BASH: bash, SM_PROVOKE: provoke, SM_AUTOBERSERK: berserk, SM_MOVINGRECOVERY: moving, SM_TWOHAND: twohand, SM_MAGNUM: magnum, SM_ENDURE: endure };
export function SkillIcon({ id, name }: { id: string; name: string }) {
  const asset = icons[id];
  if (asset) return <img src={asset.url} alt="" className="h-8 w-8 object-contain [image-rendering:pixelated]" />;
  const Icon = /fire|magnum|explosion/i.test(name) ? Flame : /heal|recovery/i.test(name) ? Heart : /guard|defen|shield|endure/i.test(name) ? Shield : /BA_|DC_|BD_/.test(id) ? Music : /HT_|AC_/.test(id) ? Crosshair : /MG_|WZ_|SA_|AL_|PR_/.test(id) ? Sparkles : Swords;
  return <Icon className="h-7 w-7 text-accent" />;
}