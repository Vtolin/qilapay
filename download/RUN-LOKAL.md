# Cara Running QilaPay di Komputer Kamu

## Prasyarat

Pilih salah satu runtime (dua-duanya oke):

| Opsi | Versi | Download |
|---|---|---|
| **Bun** (disarankan, paling cepat) | 1.2+ | https://bun.sh |
| **Node.js** | 20.9+ | https://nodejs.org |

Butuh koneksi internet (untuk Tempo RPC `rpc.moderato.tempo.xyz`, faucet Tempo,
dan kurs Frankfurter/ECB).

## Langkah menjalankan

```bash
# 1. Extract zip, lalu masuk folder
cd qilapay

# 2. Install dependencies
bun install          # atau: npm install

# 3. (Opsional) Push schema database — skip jika pakai db/custom.db bawaan
bun run db:push      # atau: npm run db:push

# 4. Jalankan dev server
bun run dev          # atau: npm run dev

# 5. Buka browser
# http://localhost:3000
```

> Database SQLite bawaan (`db/custom.db`) **sudah ter-seed** — 4 persona, tier KYC,
> kurs, daftar screening, dan saldo awal. Kalau kamu mau mulai dari nol, hapus
> `db/custom.db`, jalankan `bun run db:push`, lalu klik tombol **Reset** di halaman
> Demo (atau: `curl -X POST localhost:3000/api/demo -H "Content-Type: application/json" -d '{"action":"seed"}'`).

## Login cepat (halaman Demo → satu klik)

| Persona | Tier | Dipakai untuk |
|---|---|---|
| `sari@qilapay.demo` | 0 | kirim $20 langsung lolos (tanpa layar KYC) / kirim $200 → step-up |
| `budi@qilapay.demo` | 2 | transfer lintas mata uang tanpa hambatan |
| `dewi@qilapay.demo` | 0 | velocity trigger (≥3 transfer / 10 menit) |
| `admin@qilapay.demo` | admin | konsol compliance: antrean review, risk decisions, editor limit |

Password persona bebas (login persona tidak mengecek password). Registrasi akun baru
butuh password min. 8 karakter dan otomatis dapat wallet kustodial didanai faucet.

## File `.env` (sudah terisi, siap pakai)

```
DATABASE_URL=file:../db/custom.db
TEMPO_RPC_URL=https://rpc.moderato.tempo.xyz
TEMPO_CHAIN_ID=42431
TEMPO_EXPLORER_URL=https://explore.testnet.tempo.xyz
TEMPO_FAUCET_URL=https://tempo.xyz/developers/api/faucet
TREASURY_PRIVATE_KEY=0x…      # burner key testnet — JANGAN dipakai di mainnet
WALLET_ENCRYPTION_KEY=…       # kunci AES-256-GCM untuk enkripsi private key wallet user
SESSION_SECRET=…              # signing cookie httpOnly
DEMO_MODE=true                # menampilkan tombol Simulate (Approve/Reject/More info)
```

Semua nilai sudah dikonfigurasi dan terverifikasi jalan. Kalau mau pakai treasury
sendiri: buat wallet baru (mis. di Remix/RPC `tempo_fundAddress`), lalu ganti
`TREASURY_PRIVATE_KEY`. Ganti `WALLET_ENCRYPTION_KEY` hanya kalau juga meng-reset
database (kunci lama tidak bisa membuka wallet terenkripsi kunci baru).

⚠️ Kunci di `.env` ini adalah **burner key khusus testnet** dengan dana faucet —
tidak ada nilai nyata. Tetap jangan commit `.env` ke repo publik.

## Port beda?

Dev server hard-coded ke port 3000 (`next dev -p 3000`). Ubah angka port di
`package.json` → script `dev` kalau 3000 terpakai.

## Build produksi (opsional)

```bash
bun run build && bun run start
```

## Troubleshooting

| Gejala | Solusi |
|---|---|
| `TREASURY_PRIVATE_KEY is not set` | File `.env` tidak ikut ter-extract — buat manual dari contoh di atas |
| Saldo/wallet error setelah ganti `WALLET_ENCRYPTION_KEY` | Reset database: hapus `db/custom.db` → `bun run db:push` → Reset di halaman Demo |
| Faucet rate-limit saat seed | Tunggu 1–2 menit, klik Reset lagi di halaman Demo |
| Kurs IDR→EUR gagal fetch | Cek internet; kurs di-cache 5 menit di tabel `fx_rates` |
| Port 3000 dipakai app lain | Ubah port di script `dev` pada `package.json` |
