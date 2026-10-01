# Mudae APK — inspirado no bot Mudae do Discord

App mobile (gera APK) com os 603 personagens do seu `mudae-bot/`.
Funciona **offline solo** de cara; vira **multiplayer** ao configurar Firebase.

## O que tem (pedido: completo com economia)
- 🎲 **Roll** com pesos por raridade (igual `bot.py`: SSS 1, SS 2, S 5, A 10, B 18, C 30, D 45)
- 💍 **Casar** em 30s, 💔 divorciar, 💒 harém, ⭐ wishlist
- 🔎 Buscar + filtro série/raridade, 📜 séries, 📄 detalhe
- 💠 **Kakera**: ganha ao tirar repetida/expirada (D 3 … SSS 500)
- 🎁 **Daily** +500 (20h), 🛒 loja (+3 rolls por 150, limpar cooldown por 50)
- 🎲 Rolls: máx 10, recarrega 1 a cada 3 min
- 🏆 Ranking local + global (Firebase)
- 🔀 Troca offline por código + estrutura `trades` no Firestore para troca online

## Testar agora (sem instalar nada)
1. Abra `mudae-apk/www/index.html` no Chrome/Edge (duplo clique funciona).
2. Melhor: `py -m http.server` dentro de `mudae-apk/www/` e abra `http://localhost:8000`.

## Imagens — o que foi feito
`py mudae-apk/scripts/clean_images.py` gera `www/characters.json` a partir do bot:
- Total 603: **395 AniList (estáveis)** + **208 Fandom/Wikia (frágeis)** + 0 sem imagem.
- App tem **fallback automático**: se a URL falhar, mostra avatar com iniciais (sem quebrar).
- Fix definitivo (Etapa 2): trocar as 208 Fandom por AniList. Rode `py mudae-bot/fetch_images.py`
  após ajustar `MISSING`/`NON_ANIME`, depois `py mudae-apk/scripts/clean_images.py` de novo.
  Fandom bloqueia hotlink em alguns WebViews — o fallback cobre isso.

## Gerar o APK (sem Android Studio — via GitHub)
Você não tem Node/Java aqui, então o build roda na nuvem:
1. Crie repo no GitHub, suba a pasta `mudae-apk/` como raiz (com `.github/`).
2. Aba **Actions → Build APK → Run workflow** (ou dê push na main).
3. Baixe o artefato `mudae-apk-debug` → `app-debug.apk` → instale no Android.
4. Para Play Store: gere keystore e troque `assembleDebug` por `assembleRelease` no workflow.

Local (se instalar Node 20 + Java 17 + Android SDK):
```
cd mudae-apk
npm install
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug
```

## Ativar multiplayer (opcional)
1. console.firebase.google.com → novo projeto → Auth (anônimo) + Firestore.
2. Copie a config para `mudae-apk/www/firebase-config.js` (tem exemplo comentado).
3. Publique `firestore.rules` no Firestore.
4. Coleções usadas: `claims/{charId} {owner}`, `players/{nick} {harem,kakera}`, `trades/`.

## Estrutura
```
mudae-apk/
  www/ index.html, styles.css, app.js, characters.json, firebase-config.js, manifest.json
  scripts/clean_images.py
  capacitor.config.json, package.json
  firestore.rules
  .github/workflows/build-apk.yml
```
