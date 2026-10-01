"""Limpa e normaliza characters.json do bot para uso no APK.
- Copia de ../mudae-bot/data/characters.json
- Normaliza raridade, remove duplicados, adiciona id/slug
- Marca origem da imagem (anilist estável vs fandom frágil)
- Gera www/characters.json + relatorio
Uso: py scripts/clean_images.py
"""
import json, os, re, unicodedata

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(os.path.dirname(BASE), "mudae-bot", "data", "characters.json")
# quando rodado da raiz Default Project, tenta caminho alternativo
ALT_SRC = r"C:\Users\mayar\OneDrive\Documentos\Default Project\mudae-bot\data\characters.json"
DST = os.path.join(BASE, "mudae-apk", "www", "characters.json")
# se BASE já é mudae-apk (quando script está dentro dele)
if os.path.basename(BASE) == "mudae-apk":
    SRC_CANDIDATES = [os.path.join(os.path.dirname(BASE), "mudae-bot", "data", "characters.json"), ALT_SRC]
    DST = os.path.join(BASE, "www", "characters.json")
else:
    SRC_CANDIDATES = [SRC, ALT_SRC]

VALID_RARITY = {"D", "C", "B", "A", "S", "SS", "SSS"}

def slug(name: str) -> str:
    n = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    n = re.sub(r"[^a-zA-Z0-9]+", "-", n).strip("-").lower()
    return n or "char"

def pick_src():
    for p in SRC_CANDIDATES:
        if os.path.exists(p):
            return p
    raise FileNotFoundError(f"Nenhum characters.json encontrado. Tentei: {SRC_CANDIDATES}")

def main():
    src = pick_src()
    data = json.load(open(src, encoding="utf-8"))
    seen = set()
    out = []
    stats = {"anilist": 0, "fandom": 0, "outra": 0, "raridade_corrigida": 0, "duplicados": 0}
    for c in data:
        name = (c.get("name") or "").strip()
        if not name or name.lower() in seen:
            if name:
                stats["duplicados"] += 1
            continue
        seen.add(name.lower())
        rarity = (c.get("rarity") or "B").strip().upper()
        if rarity not in VALID_RARITY:
            rarity = "B"
            stats["raridade_corrigida"] += 1
        img = (c.get("image") or "").strip()
        if "anilist" in img:
            stats["anilist"] += 1
            src_kind = "anilist"
        elif "wikia" in img or "nocookie" in img:
            stats["fandom"] += 1
            src_kind = "fandom"
        else:
            stats["outra"] += 1
            src_kind = "outra"
        out.append({
            "id": slug(name),
            "name": name,
            "series": (c.get("series") or "Desconhecida").strip(),
            "rarity": rarity,
            "emoji": c.get("emoji") or "✨",
            "image": img,
            "img_src": src_kind,
        })
    out.sort(key=lambda x: x["name"].lower())
    os.makedirs(os.path.dirname(DST), exist_ok=True)
    json.dump(out, open(DST, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"Origem: {src}")
    print(f"Destino: {DST}")
    print(f"Total: {len(out)} | anilist={stats['anilist']} fandom={stats['fandom']} outra={stats['outra']} "
          f"dup_removidos={stats['duplicados']} raridade_fix={stats['raridade_corrigida']}")
    print("AVISO: imagens 'fandom' funcionam mas podem quebrar no futuro. O app usa fallback automático "
          "com iniciais quando a URL falha (onerror -> placeholder). Para fix definitivo, rode a "
          "Etapa 2 do README (trocar fandom por AniList estável).")

if __name__ == "__main__":
    main()
