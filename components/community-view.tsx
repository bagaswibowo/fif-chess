"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconCommunity3D, IconTrophy3D } from "@/components/icons3d";

export function CommunityView({ lang = "id" }: { lang?: "id" | "en" }) {
  const members = [
    { rank: 1, name: "Bagas Wibowo", role: "Dosen / Pembina", rating: 1850, badge: "Master FIF" },
    { rank: 2, name: "Farhan Maulana", role: "Mahasiswa IF", rating: 1720, badge: "Juara Tel-U 2025" },
    { rank: 3, name: "Alif Pratama", role: "Mahasiswa SE", rating: 1640, badge: "Captain Blitz" },
    { rank: 4, name: "Naufal Hadi", role: "Mahasiswa DS", rating: 1580, badge: "Taktikus" },
    { rank: 5, name: "Rizky Ramadhan", role: "Mahasiswa IF", rating: 1510, badge: "Pion Tangguh" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 w-full">
      <Card className="bg-[#262421] border-[#3d3a37]">
        <CardHeader>
          <div className="flex items-center gap-2">
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#1f1d1a] p-4 rounded-xl border border-[#36322d] text-center">
              <div className="text-neutral-400 text-xs uppercase font-semibold">{lang === "id" ? "Anggota Aktif" : "Active Members"}</div>
              <div className="text-3xl font-bold font-mono text-emerald-400 mt-1">48</div>
            </div>
            <div className="bg-[#1f1d1a] p-4 rounded-xl border border-[#36322d] text-center">
              <div className="text-neutral-400 text-xs uppercase font-semibold">{lang === "id" ? "Game Dimainkan" : "Games Played"}</div>
              <div className="text-3xl font-bold font-mono text-amber-400 mt-1">1,240</div>
            </div>
            <div className="bg-[#1f1d1a] p-4 rounded-xl border border-[#36322d] text-center">
              <div className="text-neutral-400 text-xs uppercase font-semibold">{lang === "id" ? "Latihan Minggu Ini" : "Weekly Training"}</div>
              <div className="text-3xl font-bold font-mono text-blue-400 mt-1">Jumat 16:00</div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <IconTrophy3D size={20} />
              <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
                {lang === "id" ? "Peringkat Anggota Komunitas" : "Community Leaderboard"}
              </h3>
            </div>
            <div className="space-y-2">
              {members.map((m) => (
                <div
                  key={m.rank}
                  className="flex items-center justify-between p-3 rounded-lg bg-[#1f1d1a] border border-[#36322d] hover:border-[#4a4744] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-neutral-400 text-sm w-5">{m.rank}.</span>
                    <div>
                      <div className="font-semibold text-white text-sm flex items-center gap-2">
                        {m.name}
                        <span className="text-[10px] text-emerald-400 font-normal">({m.badge})</span>
                      </div>
                      <div className="text-xs text-neutral-400">{m.role}</div>
                    </div>
                  </div>
                  <div className="font-mono font-bold text-amber-400 text-sm">
                    {m.rating} <span className="text-[10px] text-neutral-500 font-normal">ELO</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
