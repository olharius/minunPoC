# Merten Keisari

Selaimessa pelattava laivanvarustamopeli. Aloitat yhdellä pienellä rahtilaivalla ja kasvatat siitä maailmanlaajuisen varustamon: valitset rahdit ja reitit, ostat laivoja, hoidat lainat ja pidät laivaston kunnossa. Pelin innoittajana ovat klassiset 80- ja 90-luvun varustamopelit, mutta nimi, grafiikka ja sisältö ovat omia.

**Pelaa:** https://olharius.github.io/minunPoC/

Peli tallentuu automaattisesti selaimeen. Valikon kohdalla *Vie tallennus tiedostoon* saat tallennuksen tiedostona, jonka voit ladata toisella laitteella.

## Tiekartta

1. **Perusta** (valmis): maailmankartta, satamat, uusi peli, tallennus ja julkaisu.
2. **Pelin ydin** (valmis): rahtimarkkina, merireitit kanavineen, matkat, polttoaine, satamamaksut, kuluva aika ja tapahtumaloki.
3. **Varustamon kasvu** (valmis): kahdeksan laivatyyppiä, uudet ja käytetyt laivat, myynti, kuluminen ja korjaukset, pankkilaina, konkurssi sekä laivasto- ja talousnäkymä.
4. **Pelimekaniikka** (valmis): tapahtumat merellä valintoineen, maailmanuutiset (suhdanteet ja lakot) sekä satamaan ohjaaminen minipelinä.
5. **Mielenkiintoisuus** (työn alla): virstanpylväät palkintoineen, vuosikatsaus, matkan nopeuden valinta, isommat polttoaineen hintaerot sekä uudet tapahtumat (hätämerkki, kiirebonus).
6. **Myöhemmin:** pikseligrafiikka ja viimeistely.

## Kehittäjälle

```bash
npm install
npm run dev     # kehityspalvelin
npm test        # testit
npm run build   # tuotantoversio kansioon dist/
npm run routes  # laske merireitit uudelleen (satamien lisäämisen jälkeen)
```

Pelin sisältö on datatiedostoissa, joten sitä voi laajentaa koskematta pelilogiikkaan:

- `src/data/ports.ts`: satamat
- `src/data/shipTypes.ts`: laivatyypit
- `src/data/cargoTypes.ts`: lastityypit
- `src/data/canals.ts`: kanavat ja niiden maksut
- `src/data/routes.json`: satamien väliset merireitit, jotka `npm run routes` laskee Natural Earth -rantaviivoista (`scripts/buildRoutes.ts`)

Pelisäännöt ovat kansiossa `src/game/`: `economy.ts` (hinnat ja kulut), `market.ts` (rahtitarjoukset), `fleet.ts` (laivakauppa ja korjaukset), `bank.ts` (lainat ja konkurssi) ja `sim.ts` (päivän kulku, lähdöt ja saapumiset).

Pelitila (`src/game/types.ts`) on pelkkää JSONia. Kun sen rakenne muuttuu, nosta `SAVE_VERSION`-arvoa ja lisää muunnos `src/game/save.ts`-tiedoston `migrate`-funktioon, jotta vanhat tallennukset toimivat edelleen.

Jokainen muutos `main`-haaraan julkaistaan automaattisesti GitHub Pagesiin.

Karttadata: [Natural Earth](https://www.naturalearthdata.com/) (public domain) [world-atlas](https://github.com/topojson/world-atlas)-paketin kautta.
