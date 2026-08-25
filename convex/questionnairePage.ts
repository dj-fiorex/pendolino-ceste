// HTML page for the requirements questionnaire, served by the GET /questionario HTTP action.
// The __STATE__ placeholder is replaced with the JSON of the latest submission.
// Copy is Italian on purpose: the readers are the mill staff.
export const questionnairePage = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Questionario Pendolino</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&display=swap">
<style>
  :root {
    --paper: #FAF8F3;
    --card: #FFFFFF;
    --ink: #2A2E24;
    --ink-soft: #5C6152;
    --olive: #4A6741;
    --olive-deep: #35502F;
    --olive-tint: #EEF2EA;
    --gold: #B98E2F;
    --line: #DDD8CA;
    --focus: #4A6741;
    --ok-bg: #EEF2EA;
    --ok-ink: #35502F;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --paper: #1C1F18;
      --card: #262A21;
      --ink: #E9E6DC;
      --ink-soft: #A8AC9C;
      --olive: #8FAE7E;
      --olive-deep: #A9C79A;
      --olive-tint: #2E362A;
      --gold: #D4AF4F;
      --line: #3A3F33;
      --focus: #8FAE7E;
      --ok-bg: #2E362A;
      --ok-ink: #C9DDBC;
    }
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font-family: "Source Sans 3", "Segoe UI", system-ui, sans-serif;
    font-size: 18px;
    line-height: 1.55;
    -webkit-text-size-adjust: 100%;
  }
  .wrap { max-width: 680px; margin: 0 auto; padding: 28px 20px 96px; }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: var(--ink);
    font-weight: 700;
    font-size: 17px;
    letter-spacing: 0.01em;
    margin-bottom: 36px;
  }
  .brand svg { width: 28px; height: 28px; flex: none; }
  .brand:hover span { text-decoration: underline; }

  header { margin-bottom: 36px; }
  .eyebrow {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--gold);
    margin: 0 0 10px;
  }
  h1 {
    font-family: "Bricolage Grotesque", Georgia, serif;
    font-weight: 700;
    font-size: clamp(30px, 6vw, 42px);
    line-height: 1.1;
    margin: 0 0 16px;
    text-wrap: balance;
    color: var(--ink);
  }
  .intro { color: var(--ink-soft); margin: 0; max-width: 58ch; }

  .banner {
    display: none;
    background: var(--ok-bg);
    color: var(--ok-ink);
    border: 1px solid var(--olive);
    border-radius: 10px;
    padding: 14px 18px;
    margin: 0 0 28px;
    font-weight: 600;
  }
  .banner.show { display: block; }

  details.round {
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--card);
    margin-bottom: 28px;
    overflow: hidden;
  }
  details.round > summary {
    cursor: pointer;
    padding: 18px 22px;
    font-family: "Bricolage Grotesque", Georgia, serif;
    font-weight: 700;
    font-size: 19px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  details.round > summary::after {
    content: "\\25BE";
    margin-left: auto;
    color: var(--ink-soft);
    transition: transform 0.15s;
  }
  details.round[open] > summary::after { transform: rotate(180deg); }
  @media (prefers-reduced-motion: reduce) { details.round > summary::after { transition: none; } }
  .done-tag {
    font-family: "Source Sans 3", system-ui, sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ok-ink);
    background: var(--ok-bg);
    border-radius: 999px;
    padding: 3px 12px;
  }
  details.round .q { border: none; border-top: 1px solid var(--line); border-radius: 0; margin: 0; }

  .round-title {
    font-family: "Bricolage Grotesque", Georgia, serif;
    font-weight: 700;
    font-size: 24px;
    margin: 0 0 6px;
  }
  .round-sub { color: var(--ink-soft); margin: 0 0 20px; }

  .q {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 24px 22px;
    margin-bottom: 22px;
  }
  .q-head { display: flex; gap: 14px; align-items: baseline; margin-bottom: 6px; }
  .q-num {
    flex: none;
    font-family: "Bricolage Grotesque", Georgia, serif;
    font-weight: 700;
    font-size: 15px;
    color: var(--paper);
    background: var(--olive);
    border-radius: 999px;
    min-width: 30px;
    height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transform: translateY(4px);
  }
  .q h2 {
    font-family: "Bricolage Grotesque", Georgia, serif;
    font-weight: 700;
    font-size: 22px;
    line-height: 1.25;
    margin: 0;
    text-wrap: balance;
  }
  .q-help { color: var(--ink-soft); margin: 6px 0 18px 44px; font-size: 16.5px; }

  .opts { display: flex; flex-direction: column; gap: 10px; margin: 0 0 4px 44px; }
  @media (max-width: 560px) { .opts, .q-help, .extra { margin-left: 0 !important; } }

  .opt {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    border: 1.5px solid var(--line);
    border-radius: 10px;
    padding: 13px 16px;
    cursor: pointer;
    background: var(--card);
  }
  .opt:hover { border-color: var(--olive); }
  .opt input { margin-top: 5px; accent-color: var(--olive); width: 18px; height: 18px; flex: none; }
  .opt span b { font-weight: 700; }
  .opt span small { display: block; color: var(--ink-soft); font-size: 15px; }
  .opt:has(input:checked) { border-color: var(--olive); background: var(--olive-tint); }

  .extra { margin: 14px 0 0 44px; }
  .extra label {
    display: block;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-soft);
    margin-bottom: 6px;
  }
  input[type="text"], textarea {
    width: 100%;
    font: inherit;
    color: var(--ink);
    background: var(--paper);
    border: 1.5px solid var(--line);
    border-radius: 8px;
    padding: 10px 12px;
  }
  textarea { min-height: 70px; resize: vertical; }
  input:focus-visible, textarea:focus-visible, .opt:has(input:focus-visible), button:focus-visible, details.round > summary:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  .actions {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 24px 22px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .actions .who label { display: block; font-weight: 700; margin-bottom: 6px; }
  .btn-row { display: flex; flex-wrap: wrap; gap: 12px; }
  button {
    font: inherit;
    font-weight: 700;
    border-radius: 10px;
    padding: 13px 24px;
    cursor: pointer;
    border: 1.5px solid var(--olive-deep);
    min-height: 48px;
  }
  #save { background: var(--olive); color: #FFFFFF; border-color: var(--olive); }
  @media (prefers-color-scheme: dark) { #save { color: #1C1F18; } }
  #save:hover { background: var(--olive-deep); border-color: var(--olive-deep); }
  #copy { background: transparent; color: var(--olive-deep); }
  #copy:hover { background: var(--olive-tint); }
  .status { font-weight: 600; color: var(--ok-ink); margin: 0; display: none; }
  .status.show { display: block; }
  .fallback-hint { color: var(--ink-soft); font-size: 16px; margin: 0; }

  footer { margin-top: 40px; color: var(--ink-soft); font-size: 15px; text-align: center; }
</style>
</head>
<body>
<script type="application/json" id="state">__STATE__</script>

<div class="wrap">
  <a class="brand" href="https://www.digitalborders.ai/" target="_blank" rel="noopener">
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="DigitalBorders">
      <rect width="32" height="32" rx="7" fill="#0A0A0A"></rect>
      <rect x="8.5" y="8.5" width="15" height="15" rx="2.5" stroke="#D4271C" stroke-width="3"></rect>
    </svg>
    <span>DigitalBorders</span>
  </a>

  <header>
    <p class="eyebrow">Oleificio · Gestione ceste</p>
    <h1>Come funzionano le ceste da voi?</h1>
    <p class="intro">Stiamo costruendo un'applicazione per tenere il conto delle ceste che escono ed entrano dal frantoio. Le domande arrivano a round: quando le vostre risposte ne fanno nascere di nuove, le aggiungiamo qui sotto. Non ci sono risposte giuste o sbagliate.</p>
  </header>

  <div class="banner" id="savedBanner"></div>

  <form id="quiz">

    <details class="round" id="round1">
      <summary>Round 1 · Le basi <span class="done-tag" id="r1tag" hidden>Inviato</span></summary>

      <section class="q">
        <div class="q-head"><span class="q-num">1</span><h2>Le ceste sono tutte uguali?</h2></div>
        <p class="q-help">Pensate a tutto quello che i clienti usano per portare le olive.</p>
        <div class="opts">
          <label class="opt"><input type="radio" name="tipi" value="uguali"><span><b>Sì, sono tutte dello stesso tipo</b></span></label>
          <label class="opt"><input type="radio" name="tipi" value="diverse"><span><b>No, ce ne sono di tipi o misure diverse</b><small>Per esempio cassette piccole e ceste grandi</small></span></label>
        </div>
        <div class="extra">
          <label for="tipi_note">Se sono diverse, quali tipi? E quante ne avete in totale, all'incirca?</label>
          <textarea id="tipi_note" name="tipi_note" placeholder="Es. 300 cassette da 25 kg e 20 ceste grandi"></textarea>
        </div>
      </section>

      <section class="q">
        <div class="q-head"><span class="q-num">2</span><h2>Vi interessa sapere <em>quale</em> cesta ha un cliente, o solo <em>quante</em>?</h2></div>
        <div class="opts">
          <label class="opt"><input type="radio" name="identita" value="quante"><span><b>Solo quante</b><small>Le ceste sono tutte uguali tra loro, contiamo i pezzi</small></span></label>
          <label class="opt"><input type="radio" name="identita" value="quali"><span><b>Anche quali</b><small>Le ceste sono numerate o marcate una per una</small></span></label>
          <label class="opt"><input type="radio" name="identita" value="vorremmo"><span><b>Oggi solo quante, ma vorremmo numerarle</b></span></label>
        </div>
      </section>

      <section class="q">
        <div class="q-head"><span class="q-num">3</span><h2>Quando un cliente riporta le ceste piene di olive, cosa succede?</h2></div>
        <div class="opts">
          <label class="opt"><input type="radio" name="rientro" value="subito"><span><b>Si svuotano quasi subito</b><small>Le olive vanno in lavorazione e le ceste tornano disponibili in giornata</small></span></label>
          <label class="opt"><input type="radio" name="rientro" value="attesa"><span><b>Restano piene in attesa</b><small>Nei giorni di punta le ceste piene aspettano anche giorni prima della molitura</small></span></label>
          <label class="opt"><input type="radio" name="rientro" value="dipende"><span><b>Dipende dal periodo</b></span></label>
        </div>
        <div class="extra">
          <label for="rientro_note">Note (facoltative)</label>
          <textarea id="rientro_note" name="rientro_note"></textarea>
        </div>
      </section>

      <section class="q">
        <div class="q-head"><span class="q-num">4</span><h2>Capita che un cliente restituisca meno ceste di quante ne ha prese?</h2></div>
        <p class="q-help">Ceste rotte, perse, o tenute per l'anno dopo.</p>
        <div class="opts">
          <label class="opt"><input type="radio" name="perdite" value="mai"><span><b>Praticamente mai</b></span></label>
          <label class="opt"><input type="radio" name="perdite" value="capita"><span><b>Sì, capita</b></span></label>
        </div>
        <div class="extra">
          <label for="perdite_note">Se capita: come lo gestite oggi? Chiedete una cauzione o fate pagare le ceste mancanti?</label>
          <textarea id="perdite_note" name="perdite_note"></textarea>
        </div>
      </section>

      <section class="q">
        <div class="q-head"><span class="q-num">5</span><h2>Quando arriva un cliente nuovo, quali dati gli chiedete?</h2></div>
        <p class="q-help">Potete segnare più di una risposta.</p>
        <div class="opts">
          <label class="opt"><input type="checkbox" name="dati" value="nome"><span><b>Nome e cognome</b></span></label>
          <label class="opt"><input type="checkbox" name="dati" value="telefono"><span><b>Numero di telefono</b></span></label>
          <label class="opt"><input type="checkbox" name="dati" value="paese"><span><b>Paese o contrada</b></span></label>
          <label class="opt"><input type="checkbox" name="dati" value="fiscale"><span><b>Codice fiscale o partita IVA</b><small>Per esempio se serve per fattura o documenti</small></span></label>
        </div>
        <div class="extra">
          <label for="dati_note">Altri dati che segnate oggi (facoltativo)</label>
          <textarea id="dati_note" name="dati_note"></textarea>
        </div>
      </section>

      <section class="q">
        <div class="q-head"><span class="q-num">6</span><h2>Chi userebbe l'applicazione?</h2></div>
        <div class="opts">
          <label class="opt"><input type="radio" name="utenti" value="banco"><span><b>Solo noi del frantoio</b><small>Chi sta al banco registra prese e riconsegne</small></span></label>
          <label class="opt"><input type="radio" name="utenti" value="clienti"><span><b>Anche i clienti</b><small>Ogni cliente vorrebbe vedere da casa quante ceste ha</small></span></label>
        </div>
        <div class="extra">
          <label for="utenti_note">Quante persone del frantoio la userebbero?</label>
          <input type="text" id="utenti_note" name="utenti_note" placeholder="Es. 2 persone">
        </div>
      </section>

      <section class="q">
        <div class="q-head"><span class="q-num">7</span><h2>Com'è la connessione a internet al frantoio?</h2></div>
        <div class="opts">
          <label class="opt"><input type="radio" name="rete" value="buona"><span><b>Buona e stabile</b></span></label>
          <label class="opt"><input type="radio" name="rete" value="ballerina"><span><b>Va e viene</b></span></label>
          <label class="opt"><input type="radio" name="rete" value="assente"><span><b>Praticamente assente</b></span></label>
        </div>
        <div class="extra">
          <label for="rete_note">Che dispositivi usereste? (telefono, tablet, computer)</label>
          <input type="text" id="rete_note" name="rete_note" placeholder="Es. il telefono e un tablet al banco">
        </div>
      </section>

      <section class="q">
        <div class="q-head"><span class="q-num">8</span><h2>In una giornata di punta della campagna, quanti clienti passano?</h2></div>
        <div class="extra" style="margin-top:0">
          <label for="volume">Un numero all'incirca va benissimo</label>
          <input type="text" id="volume" name="volume" placeholder="Es. una cinquantina">
        </div>
      </section>

      <section class="q">
        <div class="q-head"><span class="q-num">9</span><h2>Vi interessa confrontare le stagioni tra loro?</h2></div>
        <div class="opts">
          <label class="opt"><input type="radio" name="stagioni" value="storico"><span><b>Basta sapere come stanno le cose oggi</b><small>E poter rivedere i movimenti passati</small></span></label>
          <label class="opt"><input type="radio" name="stagioni" value="campagne"><span><b>Vogliamo anche i conti per campagna</b><small>Per esempio: quante ceste sono girate nella campagna 2025 rispetto alla 2026</small></span></label>
        </div>
      </section>

      <section class="q">
        <div class="q-head"><span class="q-num">10</span><h2>C'è qualcosa che non vi abbiamo chiesto?</h2></div>
        <div class="extra" style="margin-top:0">
          <label for="libero">Casi particolari, problemi che avete oggi con le ceste, cose a cui tenete</label>
          <textarea id="libero" name="libero" style="min-height:100px"></textarea>
        </div>
      </section>
    </details>

    <details class="round" id="round2">
      <summary>Round 2 · I dettagli sulle ceste <span class="done-tag" id="r2tag" hidden>Inviato</span></summary>

      <section class="q">
        <div class="q-head"><span class="q-num">11</span><h2>Le ceste oggi sono già numerate o marcate una per una?</h2></div>
        <div class="opts">
          <label class="opt"><input type="radio" name="r2_numerazione" value="tutti"><span><b>Sì, tutti</b></span></label>
          <label class="opt"><input type="radio" name="r2_numerazione" value="alcuni"><span><b>Solo alcuni</b></span></label>
          <label class="opt"><input type="radio" name="r2_numerazione" value="nessuno"><span><b>No, nessuno</b></span></label>
        </div>
        <div class="extra">
          <label for="r2_numerazione_note">Come le riconoscete oggi? L'idea è mettere su ogni cesta un'etichetta con numero grande e codice QR da inquadrare col telefono: chi potrebbe occuparsi di etichettarle tutte prima della campagna?</label>
          <textarea id="r2_numerazione_note" name="r2_numerazione_note"></textarea>
        </div>
      </section>

      <section class="q">
        <div class="q-head"><span class="q-num">12</span><h2>Distinguere le ceste da 400 kg quadrate da quelle rettangolari serve nel lavoro?</h2></div>
        <div class="opts">
          <label class="opt"><input type="radio" name="r2_forma" value="serve"><span><b>Sì, serve distinguerli</b><small>Per esempio per l'impilaggio o per il carico sui furgoni</small></span></label>
          <label class="opt"><input type="radio" name="r2_forma" value="nonserve"><span><b>No, basta sapere se è da 400 o da 250</b></span></label>
        </div>
        <div class="extra">
          <label for="r2_forma_note">Se serve, spiegateci perché (facoltativo)</label>
          <textarea id="r2_forma_note" name="r2_forma_note"></textarea>
        </div>
      </section>

      <section class="q">
        <div class="q-head"><span class="q-num">13</span><h2>Firma e foto al momento del ritiro: obbligatorie o facoltative?</h2></div>
        <p class="q-help">La vostra idea: chi porta via le ceste firma col dito sul telefono, e si scatta una foto del carico. Nei giorni da 150 clienti ogni passaggio in più allunga la coda.</p>
        <div class="opts">
          <label class="opt"><input type="radio" name="r2_firma" value="obbligatorie"><span><b>Sempre obbligatorie tutte e due</b></span></label>
          <label class="opt"><input type="radio" name="r2_firma" value="firma"><span><b>Firma obbligatoria, foto facoltativa</b></span></label>
          <label class="opt"><input type="radio" name="r2_firma" value="facoltative"><span><b>Facoltative, decide chi sta al banco</b></span></label>
        </div>
      </section>

      <section class="q">
        <div class="q-head"><span class="q-num">14</span><h2>Vi va bene chiedere anche il telefono al cliente nuovo?</h2></div>
        <p class="q-help">Serve a una cosa sola: la lista di chi ha ceste fuori da troppi giorni, con il numero da chiamare.</p>
        <div class="opts">
          <label class="opt"><input type="radio" name="r2_telefono" value="si"><span><b>Sì, quando possibile lo chiediamo</b></span></label>
          <label class="opt"><input type="radio" name="r2_telefono" value="no"><span><b>No, solo il nome</b></span></label>
        </div>
      </section>

      <section class="q">
        <div class="q-head"><span class="q-num">15</span><h2>Che parole usate al banco?</h2></div>
        <div class="extra" style="margin-top:0">
          <label for="r2_parole">Come lo chiamate quando un cliente porta via le ceste vuote? E quando le riporta piene? E una cesta piena che aspetta di essere lavorata? L'applicazione userà le vostre parole.</label>
          <textarea id="r2_parole" name="r2_parole" style="min-height:90px" placeholder="Es. «si ritirano le ceste», «arriva il carico», «ceste in attesa di molitura»"></textarea>
        </div>
      </section>
    </details>

    <section id="round3">
      <h2 class="round-title">Round 3 · I numeri e i casi storti</h2>
      <p class="round-sub">Il secondo round ha chiuso parecchie cose: niente distinzione tra quadrate e rettangolari, firma e foto facoltative, telefono sì, e le parole sono <em>ritiro</em>, <em>rientro</em>, <em>attesa molitura</em>. Restano i numeri e i casi che rompono il giro normale.</p>

      <section class="q">
        <div class="q-head"><span class="q-num">16</span><h2>Quante ceste avete in tutto?</h2></div>
        <p class="q-help">Ci avete detto che le etichettate voi e che i numeri li avete già comprati. Sapere quante sono ci dice quanti codici QR stampare e quanto lavoro è prima della campagna.</p>
        <div class="extra" style="margin-top:0">
          <label for="r3_quante_400">Ceste da 400 kg (quadrate e rettangolari insieme)</label>
          <input type="text" id="r3_quante_400" name="r3_quante_400" placeholder="Es. 120">
        </div>
        <div class="extra">
          <label for="r3_quante_250">Ceste da 250 kg</label>
          <input type="text" id="r3_quante_250" name="r3_quante_250" placeholder="Ci avevate detto una ventina">
        </div>
      </section>

      <section class="q">
        <div class="q-head"><span class="q-num">17</span><h2>Quando un cliente viene a ritirare, quante ceste porta via in una volta?</h2></div>
        <p class="q-help">È la domanda più importante di questo round. Se ne porta via una, inquadrare il QR è istantaneo. Se ne porta via dieci, sono dieci inquadrature al banco — e in una giornata da 150 clienti la coda si allunga. Sapendolo adesso progettiamo il ritiro nel modo giusto.</p>
        <div class="opts">
          <label class="opt"><input type="radio" name="r3_per_ritiro" value="una"><span><b>Quasi sempre una sola</b></span></label>
          <label class="opt"><input type="radio" name="r3_per_ritiro" value="poche"><span><b>Di solito due o tre</b></span></label>
          <label class="opt"><input type="radio" name="r3_per_ritiro" value="parecchie"><span><b>Spesso quattro o più</b></span></label>
          <label class="opt"><input type="radio" name="r3_per_ritiro" value="varia"><span><b>Cambia tantissimo da cliente a cliente</b><small>Il piccolo ne prende una, il grande dieci</small></span></label>
        </div>
        <div class="extra">
          <label for="r3_per_ritiro_note">Qual è il massimo che avete visto portare via a un cliente solo?</label>
          <input type="text" id="r3_per_ritiro_note" name="r3_per_ritiro_note" placeholder="Es. una quindicina">
        </div>
      </section>

      <section class="q">
        <div class="q-head"><span class="q-num">18</span><h2>Chi segna che una cesta è stata svuotata?</h2></div>
        <p class="q-help">Avete usato la parola <em>attesa molitura</em>: la cesta è rientrata piena e aspetta. Quando viene svuotata torna buona per il cliente dopo, ma qualcuno deve segnarlo, altrimenti l'app continua a dirvi che è occupata.</p>
        <div class="opts">
          <label class="opt"><input type="radio" name="r3_svuotamento" value="banco"><span><b>Chi sta al banco, quando se ne accorge</b></span></label>
          <label class="opt"><input type="radio" name="r3_svuotamento" value="molino"><span><b>Chi lavora al molino, appena la svuota</b></span></label>
          <label class="opt"><input type="radio" name="r3_svuotamento" value="blocco"><span><b>A fine giornata, tutte insieme in blocco</b><small>Una schermata dove se ne spuntano tante in una volta</small></span></label>
        </div>
        <div class="extra">
          <label for="r3_svuotamento_parola">Come lo chiamate voi quando una cesta viene svuotata e torna disponibile? Useremo la vostra parola nell'app.</label>
          <input type="text" id="r3_svuotamento_parola" name="r3_svuotamento_parola" placeholder="Es. «si scarica», «si libera»">
        </div>
      </section>

      <section class="q">
        <div class="q-head"><span class="q-num">19</span><h2>Il cliente vi lascia qualcosa a garanzia quando porta via le ceste?</h2></div>
        <p class="q-help">Le ceste che non tornano sono il problema numero uno che ci avete raccontato. Vogliamo capire se oggi c'è già qualcosa che trattiene il cliente, o se l'applicazione deve reggere tutto da sola con la lista di chi è in ritardo.</p>
        <div class="opts">
          <label class="opt"><input type="radio" name="r3_garanzia" value="cauzione"><span><b>Sì, una cauzione in denaro</b><small>Che restituiamo quando riportano le ceste</small></span></label>
          <label class="opt"><input type="radio" name="r3_garanzia" value="documento"><span><b>Sì, un documento o qualcosa in pegno</b></span></label>
          <label class="opt"><input type="radio" name="r3_garanzia" value="niente"><span><b>Niente, si va sulla fiducia</b></span></label>
          <label class="opt"><input type="radio" name="r3_garanzia" value="vorremmo"><span><b>Oggi niente, ma vorremmo introdurre qualcosa</b></span></label>
        </div>
        <div class="extra">
          <label for="r3_garanzia_note">Se avete in mente qualcosa, raccontatecelo: cambia parecchio come costruiamo l'app.</label>
          <textarea id="r3_garanzia_note" name="r3_garanzia_note"></textarea>
        </div>
      </section>

      <section class="q">
        <div class="q-head"><span class="q-num">20</span><h2>Chi si presenta al banco a ritirare è sempre il cliente in persona?</h2></div>
        <p class="q-help">Capita spesso che venga il figlio, un operaio o un vicino. Se succede, l'app deve sapere a chi intestare le ceste — che è una cosa diversa da chi le ha fisicamente caricate e firmate.</p>
        <div class="opts">
          <label class="opt"><input type="radio" name="r3_delega" value="sempre"><span><b>Sì, quasi sempre viene il cliente stesso</b></span></label>
          <label class="opt"><input type="radio" name="r3_delega" value="spesso"><span><b>Spesso manda qualcun altro al posto suo</b></span></label>
          <label class="opt"><input type="radio" name="r3_delega" value="altri"><span><b>Capita anche che uno ritiri le ceste per più clienti diversi</b><small>Per esempio chi raccoglie per due o tre famiglie</small></span></label>
        </div>
      </section>

      <section class="q">
        <div class="q-head"><span class="q-num">21</span><h2>Come ritrovate un cliente che è già venuto altre volte?</h2></div>
        <p class="q-help">Con 150 passaggi al giorno e solo il nome, due «Mario Rossi» rischiano di diventare la stessa scheda — e le ceste finiscono addosso al cliente sbagliato proprio quando servirebbe sapere chi ce le ha.</p>
        <div class="opts">
          <label class="opt"><input type="radio" name="r3_ricerca" value="nome"><span><b>Basta il nome, ce li ricordiamo</b></span></label>
          <label class="opt"><input type="radio" name="r3_ricerca" value="telefono"><span><b>Il telefono è il modo più sicuro</b></span></label>
          <label class="opt"><input type="radio" name="r3_ricerca" value="paese"><span><b>Serve anche il paese o la contrada per distinguerli</b></span></label>
        </div>
        <div class="extra">
          <label for="r3_ricerca_note">Ci sono davvero omonimi tra i vostri clienti?</label>
          <input type="text" id="r3_ricerca_note" name="r3_ricerca_note">
        </div>
      </section>

      <section class="q">
        <div class="q-head"><span class="q-num">22</span><h2>A campagna finita, se un cliente ha ancora ceste fuori, che succede?</h2></div>
        <p class="q-help">Volete confrontare le campagne tra loro, quindi dobbiamo decidere cosa fa l'app il giorno che chiudete la campagna con delle ceste ancora in giro.</p>
        <div class="opts">
          <label class="opt"><input type="radio" name="r3_finecampagna" value="trascina"><span><b>Restano sue</b><small>La campagna nuova parte con quelle ceste già fuori</small></span></label>
          <label class="opt"><input type="radio" name="r3_finecampagna" value="chiude"><span><b>Si chiude il conto e si riparte da zero</b><small>La mancanza resta scritta nella campagna vecchia</small></span></label>
          <label class="opt"><input type="radio" name="r3_finecampagna" value="maisuccede"><span><b>Non succede: prima di chiudere le recuperiamo tutte</b></span></label>
        </div>
      </section>

      <section class="q">
        <div class="q-head"><span class="q-num">23</span><h2>Quando una cesta si rompe o è persa per sempre, chi la toglie dal giro?</h2></div>
        <div class="opts">
          <label class="opt"><input type="radio" name="r3_dismissione" value="titolare"><span><b>Solo io o chi comanda</b><small>Al banco non possono cancellare una cesta</small></span></label>
          <label class="opt"><input type="radio" name="r3_dismissione" value="chiunque"><span><b>Chiunque al banco può segnarlo</b></span></label>
        </div>
        <div class="extra">
          <label for="r3_dismissione_note">Una cesta persa da un cliente e una cesta rotta al molino sono due cose diverse per voi, o basta segnare che non c'è più?</label>
          <textarea id="r3_dismissione_note" name="r3_dismissione_note"></textarea>
        </div>
      </section>

      <section class="q">
        <div class="q-head"><span class="q-num">24</span><h2>C'è altro che vi è venuto in mente?</h2></div>
        <div class="extra" style="margin-top:0">
          <label for="r3_libero">Anche ripensamenti sulle risposte di prima: siamo ancora in tempo per cambiare tutto.</label>
          <textarea id="r3_libero" name="r3_libero" style="min-height:100px"></textarea>
        </div>
      </section>
    </section>

    <section class="actions">
      <div class="who">
        <label for="nome">Il vostro nome</label>
        <input type="text" id="nome" name="nome" placeholder="Chi sta rispondendo">
      </div>
      <div class="btn-row">
        <button type="submit" id="save">Invia le risposte</button>
        <button type="button" id="copy">Copia il riepilogo</button>
      </div>
      <p class="status" id="status"></p>
      <p class="fallback-hint" id="hint" hidden>Non è stato possibile salvare le risposte. Controllate la connessione e riprovate, oppure premete «Copia il riepilogo» e incollatelo in un messaggio WhatsApp o email.</p>
    </section>

  </form>

  <footer>Grazie! Le risposte servono solo a progettare l'applicazione per il vostro frantoio.</footer>
</div>

<script>
(function () {
  var form = document.getElementById('quiz');
  var statusEl = document.getElementById('status');
  var hintEl = document.getElementById('hint');
  var bannerEl = document.getElementById('savedBanner');

  var LABELS = {
    tipi: 'Le ceste sono tutte uguali?',
    tipi_note: 'Tipi e quantità',
    identita: 'Interessa quale cesta o solo quante?',
    rientro: 'Cosa succede quando tornano piene',
    rientro_note: 'Note sul rientro',
    perdite: 'Restituzioni mancanti',
    perdite_note: 'Come gestite le mancanze',
    dati: 'Dati chiesti al cliente nuovo',
    dati_note: 'Altri dati',
    utenti: 'Chi usa l\\u2019app',
    utenti_note: 'Quante persone al frantoio',
    rete: 'Connessione al frantoio',
    rete_note: 'Dispositivi',
    volume: 'Clienti in giornata di punta',
    stagioni: 'Confronto tra stagioni',
    libero: 'Note libere',
    r2_numerazione: 'Ceste già numerate?',
    r2_numerazione_note: 'Come le riconoscete / chi etichetta',
    r2_forma: 'Distinguere 400 quadrati da rettangolari?',
    r2_forma_note: 'Perché',
    r2_firma: 'Firma e foto al ritiro',
    r2_telefono: 'Telefono del cliente nuovo',
    r2_parole: 'Parole del banco',
    r3_quante_400: 'Quante ceste da 400 kg',
    r3_quante_250: 'Quante ceste da 250 kg',
    r3_per_ritiro: 'Ceste per singolo ritiro',
    r3_per_ritiro_note: 'Massimo visto in un ritiro',
    r3_svuotamento: 'Chi segna lo svuotamento',
    r3_svuotamento_parola: 'Parola per lo svuotamento',
    r3_garanzia: 'Garanzia lasciata al ritiro',
    r3_garanzia_note: 'Note sulla garanzia',
    r3_delega: 'Chi si presenta a ritirare',
    r3_ricerca: 'Come si ritrova un cliente',
    r3_ricerca_note: 'Omonimi',
    r3_finecampagna: 'Ceste fuori a fine campagna',
    r3_dismissione: 'Chi toglie una cesta dal giro',
    r3_dismissione_note: 'Persa dal cliente vs rotta al molino',
    r3_libero: 'Note libere round 3',
    nome: 'Risposto da'
  };

  function collect() {
    var data = {};
    var fd = new FormData(form);
    fd.forEach(function (value, key) {
      if (value === '') return;
      if (data[key] !== undefined) {
        if (!Array.isArray(data[key])) data[key] = [data[key]];
        data[key].push(value);
      } else {
        data[key] = value;
      }
    });
    return data;
  }

  function hasRound(answers, prefix) {
    return Object.keys(answers).some(function (key) { return key.indexOf(prefix) === 0; });
  }

  function prefill(state) {
    if (!state || !state.answers) {
      document.getElementById('round1').open = true;
      return;
    }
    var answers = state.answers;
    Object.keys(answers).forEach(function (key) {
      var values = Array.isArray(answers[key]) ? answers[key] : [answers[key]];
      var fields = form.querySelectorAll('[name="' + key + '"]');
      fields.forEach(function (field) {
        if (field.type === 'radio' || field.type === 'checkbox') {
          if (values.indexOf(field.value) !== -1) field.checked = true;
        } else {
          field.value = values[0];
        }
      });
    });
    if (answers.tipi) document.getElementById('r1tag').hidden = false;
    else document.getElementById('round1').open = true;
    if (hasRound(answers, 'r2_')) document.getElementById('r2tag').hidden = false;
    else document.getElementById('round2').open = true;
    if (state.savedAt) {
      var done = ['1'];
      if (hasRound(answers, 'r2_')) done.push('2');
      if (hasRound(answers, 'r3_')) done.push('3');
      var rounds = done.length === 1
        ? 'Round 1 inviato'
        : 'Round ' + done.slice(0, -1).join(', ') + ' e ' + done[done.length - 1] + ' inviati';
      bannerEl.textContent = rounds + (answers.nome ? ' da ' + answers.nome : '') + ' il ' + state.savedAt + '. Potete correggere le risposte e inviarle di nuovo.';
      bannerEl.classList.add('show');
    }
  }

  function summary(data) {
    var lines = ['QUESTIONARIO CESTE \\u2014 RISPOSTE', ''];
    Object.keys(LABELS).forEach(function (key) {
      if (data[key] === undefined) return;
      var value = Array.isArray(data[key]) ? data[key].join(', ') : data[key];
      lines.push(LABELS[key] + ': ' + value);
    });
    return lines.join('\\n');
  }

  function showStatus(message) {
    statusEl.textContent = message;
    statusEl.classList.add('show');
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var data = collect();
    var stamp = new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
    showStatus('Invio in corso\\u2026');
    hintEl.hidden = true;
    fetch('/questionario/invia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ savedAt: stamp, answers: data })
    }).then(function (response) {
      if (!response.ok) throw new Error('http ' + response.status);
      showStatus('Risposte inviate. Grazie!');
    }).catch(function () {
      statusEl.classList.remove('show');
      hintEl.hidden = false;
    });
  });

  document.getElementById('copy').addEventListener('click', function () {
    var text = summary(collect());
    function done() { showStatus('Riepilogo copiato. Incollatelo in un messaggio.'); }
    function manual() {
      window.prompt('Selezionate tutto e copiate:', text);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, manual);
    } else {
      manual();
    }
  });

  try {
    var stored = JSON.parse(document.getElementById('state').textContent || '{}');
    prefill(stored);
  } catch (err) { /* no stored state, or corrupt: render the page empty */ }
})();
</script>
</body>
</html>`;
