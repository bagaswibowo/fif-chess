# Referensi Repo Jev & Fly Brain

Provenance riset engine bio-AI di FIF Chess Arena (per 14 Okt 2026).

## Engine Jev (`jev`) — Jev AI Connectome
- **Spesifikasi dasar:** [`JLarky/jev-chess`](https://github.com/JLarky/jev-chess) — arsitektur TypeSafe System One RLCD (Reasoning-Latent Cognitive Dynamics).
- Implementasi lokal: `lib/jev.ts` (API client) + `lib/engines/jev.ts` (engine wrapper).
- Endpoint inferensi: TypeSafe Choice API (`TYPESAFE_ENDPOINT`), model `jev-latest`.

## Engine Fly Brain (`fly`) — Superfly Connectome
- **Spesifikasi dasar:** [`cesp99/fly-chess`](https://github.com/cesp99/fly-chess) — PUCT MCTS di atas connectome.
- **Sumber data connectome:** FlyWire / Nature 2024 — whole-brain *Drosophila melanogaster* 139.255 neuron (`fly.eyed.to` / FlyWire codex).
- Implementasi lokal: `lib/flybrain/` (service, consensus, connectome-network) + `lib/engines/flybrain.ts`.

## Engine Hybrid (`jev-fly`) — Jev + FlyBrain
- Novelty internal (bukan fork): prior probabilistik dari Jev RLCD → root priors PUCT MCTS Superfly (bobot fusi 0.6 Jev / 0.4 FlyBrain), + tactical gatekeeper.
- Implementasi lokal: `lib/engines/hybrid.ts`.

## Catatan
- Repo upstream `cesp99/fly-chess` read-only untuk akun ini (push 403) — modifikasi dikembangkan di [`bagaswibowo/fif-chess`](https://github.com/bagaswibowo/fif-chess).
- Benchmark historis: FlyBrain 0 menang vs Stockfish dalam 13.260+ match training (11.895 kalah, 1.365 remis). Detail di README bagian Benchmark.
