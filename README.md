# Satamasta satamaan

*(työnimi)*

Selaimessa pelattava laivanvarustamopeli. Aloitat yhdellä pienellä rahtilaivalla ja kasvatat siitä maailmanlaajuisen varustamon: valitset rahdit ja reitit, ostat laivoja, hoidat lainat ja pidät laivaston kunnossa. Pelin innoittajana ovat klassiset 80- ja 90-luvun varustamopelit, mutta nimi, grafiikka ja sisältö ovat omia.

**Pelaa:** https://olharius.github.io/minunPoC/

Peli tallentuu automaattisesti selaimeen. Valikon kohdalla *Vie tallennus tiedostoon* saat tallennuksen tiedostona, jonka voit ladata toisella laitteella.

## Tiekartta

1. **Perusta** (valmis): maailmankartta, satamat, uusi peli, tallennus ja julkaisu.
2. **Pelin ydin:** rahtimarkkina, matkat satamien välillä, polttoaine, satamamaksut ja aika.
3. **Varustamon kasvu:** laivojen osto ja myynti, laivatyypit, lainat, huolto ja laivastonäkymä.
4. **Myöhemmin:** tapahtumat merellä, satamaan ohjaaminen minipelinä, grafiikan viimeistely.

## Kehittäjälle

```bash
npm install
npm run dev     # kehityspalvelin
npm test        # testit
npm run build   # tuotantoversio kansioon dist/
```

Pelin sisältö on datatiedostoissa, joten sitä voi laajentaa koskematta pelilogiikkaan:

- `src/data/ports.ts`: satamat
- `src/data/shipTypes.ts`: laivatyypit
- `src/data/cargoTypes.ts`: lastityypit

Pelitila (`src/game/types.ts`) on pelkkää JSONia. Kun sen rakenne muuttuu, nosta `SAVE_VERSION`-arvoa ja lisää muunnos `src/game/save.ts`-tiedoston `migrate`-funktioon, jotta vanhat tallennukset toimivat edelleen.

Jokainen muutos `main`-haaraan julkaistaan automaattisesti GitHub Pagesiin.

Karttadata: [Natural Earth](https://www.naturalearthdata.com/) (public domain) [world-atlas](https://github.com/topojson/world-atlas)-paketin kautta.
