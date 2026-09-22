"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconCommunity3D, IconTrophy3D } from "@/components/icons3d";

export function CommunityView({ lang = "id" }: { lang?: "id" | "en" }) {
  return (
    <div className="max-w-4xl mx-auto space-y-6 w-full">
      <Card className="bg-[#262421] border-[#3d3a37]">
        <CardHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <IconCommunity3D size={28} />
            <Badge className="bg-emerald-600 text-white">Komunitas Resmi</Badge>
            <Badge variant="outline" className="border-amber-500/40 text-amber-300">Telkom University</Badge>
          </div>
          <CardTitle className="text-2xl text-white mt-1">
            {lang === "id" ? "Komunitas Catur Fakultas Informatika (FIF)" : "Faculty of Informatics (FIF) Chess Community"}
          </CardTitle>
          <CardDescription className="text-neutral-400">
            {lang === "id"
              ? "Wadah latihan, sparring online vs engine Stockfish, dan analisis game turnamen civitas FIF Telkom University."
              : "Training hub, sparring ground vs Stockfish engine, and tournament review for FIF Telkom University."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Jadwal latihan nyata */}
          <div className="bg-[#1f1d1a] p-4 rounded-xl border border-[#36322d] space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              {lang === "id" ? "Jadwal Latihan Rutin" : "Regular Training Schedule"}
            </h3>
            <div className="space-y-2 text-sm">
              {[
                { day: lang === "id" ? "Jumat" : "Friday", time: "16:00–18:00 WIB", desc: lang === "id" ? "Latihan mingguan & blitz session" : "Weekly training & blitz session" },
                { day: lang === "id" ? "Sabtu (insidentil)" : "Saturday (occasional)", time: "09:00–12:00 WIB", desc: lang === "id" ? "Turnamen internal & analisis game" : "Internal tournament & game analysis" },
              ].map((s, i) => (
                <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-[#262421] border border-[#36322d]">
                  <div className="w-2 h-2 rounded-full bg-[#81b64c] mt-1.5 shrink-0" />
                  <div>
                    <div className="font-bold text-white">{s.day} — {s.time}</div>
                    <div className="text-neutral-400 text-xs">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pembina */}
          <div className="bg-[#1f1d1a] p-4 rounded-xl border border-[#36322d]">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
              {lang === "id" ? "Pembina & Koordinator" : "Advisor & Coordinator"}
            </h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#81b64c]/20 border-2 border-[#81b64c]/50 flex items-center justify-center font-black text-[#81b64c] text-sm">BW</div>
              <div>
                <div className="font-bold text-white text-sm">Bagas Wibowo, S.Kom., M.Kom.</div>
                <div className="text-neutral-400 text-xs">{lang === "id" ? "Dosen Teknik Informatika — KK SEAL, Telkom University" : "Lecturer, Informatics Engineering — KK SEAL, Telkom University"}</div>
              </div>
            </div>
          </div>

          {/* Leaderboard placeholder — jujur bahwa data belum real-time */}
          <div className="bg-[#1f1d1a] p-4 rounded-xl border border-[#36322d] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <IconTrophy3D size={18} />
                {lang === "id" ? "Peringkat (Sesi Ini)" : "Rankings (This Session)"}
              </h3>
              <Badge variant="outline" className="border-neutral-600 text-neutral-500 text-[10px]">
                {lang === "id" ? "Berdasarkan game lokal" : "Based on local games"}
              </Badge>
            </div>
            <div className="p-3 rounded-lg bg-[#262421] border border-[#36322d] text-xs text-neutral-400 text-center">
              {lang === "id"
                ? "Peringkat komunitas real-time akan tersedia setelah fitur akun multi-user diaktifkan. Saat ini skor hanya tersimpan di perangkat masing-masing pemain."
                : "Real-time community rankings will be available after multi-user accounts are enabled. Currently scores are stored locally per device."}
            </div>
          </div>

          {/* Kontak / Gabung */}
          <div className="bg-[#1f1d1a] p-4 rounded-xl border border-[#36322d] space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              {lang === "id" ? "Bergabung & Kontak" : "Join & Contact"}
            </h3>
            <div className="space-y-2 text-sm text-neutral-300">
              <div className="flex items-center gap-2">
                <span className="text-base">💬</span>
                <span>
                  {lang === "id"
                    ? "Hubungi Pak Bagas atau pengurus FIF Chess untuk bergabung ke grup WhatsApp/Discord resmi."
                    : "Contact Pak Bagas or FIF Chess board to join the official WhatsApp/Discord group."}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base">🏛</span>
                <span>
                  {lang === "id"
                    ? "Sekretariat FIF — Gedung Informatika, Telkom University, Bandung."
                    : "FIF Secretariat — Informatics Building, Telkom University, Bandung."}
                </span>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
