# Questionario: come funzionano le ceste da voi?

The requirements questionnaire the mill answered before the app was built, in three rounds. It lived at `/questionario` on the Convex deployment; this file is its export, taken on 2026-09-02 when that page was removed from the code. Questions and answers are Gabriele's own Italian.

Answered by **Gabriele**. Four submissions between 24 and 25 August 2026, each one adding a round; below is the last and fullest, saved on 25 agosto 2026. Every submission is kept verbatim in [`risposte.json`](risposte.json).

## Round 1 · Le basi

### 1. Le ceste sono tutte uguali?

_Pensate a tutto quello che i clienti usano per portare le olive._

- **No, ce ne sono di tipi o misure diverse** — Per esempio cassette piccole e ceste grandi

_Se sono diverse, quali tipi? E quante ne avete in totale, all'incirca?_

> Bins da 400kg e bins da 250kg, ma le 250kg sono una ventina circa. Inoltre li bins da 400kg sono di due forme differenti alcune quadrate altre rettangolari

### 2. Vi interessa sapere quale cesta ha un cliente, o solo quante?

- **Anche quali** — Le ceste sono numerate o marcate una per una

### 3. Quando un cliente riporta le ceste piene di olive, cosa succede?

- **Dipende dal periodo**

_Note (facoltative)_

> Un 50% si svuotano subito, un 50% restano piene circa 1/2 giorni

### 4. Capita che un cliente restituisca meno ceste di quante ne ha prese?

_Ceste rotte, perse, o tenute per l'anno dopo._

- **Sì, capita**

_Se capita: come lo gestite oggi? Chiedete una cauzione o fate pagare le ceste mancanti?_

> Siamo stati molto disorganizzati e non abbiamo mai fatto niente per combattere questi furti

### 5. Quando arriva un cliente nuovo, quali dati gli chiedete?

_Potete segnare più di una risposta._

- **Nome e cognome**

_Altri dati che segnate oggi (facoltativo)_

> Tutti i dati completi li chiediamo al momento della molitura per effettuare la fattura

### 6. Chi userebbe l'applicazione?

- **Solo noi del frantoio** — Chi sta al banco registra prese e riconsegne

_Quante persone del frantoio la userebbero?_

> 5

### 7. Com'è la connessione a internet al frantoio?

- **Buona e stabile**

_Che dispositivi usereste? (telefono, tablet, computer)_

> Telefono

### 8. In una giornata di punta della campagna, quanti clienti passano?

_Un numero all'incirca va benissimo_

> Circa 150

### 9. Vi interessa confrontare le stagioni tra loro?

- **Vogliamo anche i conti per campagna** — Per esempio: quante ceste sono girate nella campagna 2025 rispetto alla 2026

### 10. C'è qualcosa che non vi abbiamo chiesto?

_Casi particolari, problemi che avete oggi con le ceste, cose a cui tenete_

> Pensavo tipo se possibile aggiungere una firma finale di chi ritira le ceste, o sempre al momento della consegna uno slot dove si va a scattare una foto delle ceste caricate.

## Round 2 · I dettagli sulle ceste

### 11. Le ceste oggi sono già numerate o marcate una per una?

- **No, nessuno**

_Come le riconoscete oggi? L'idea è mettere su ogni cesta un'etichetta con numero grande e codice QR da inquadrare col telefono: chi potrebbe occuparsi di etichettarle tutte prima della campagna?_

> Io, ho già comprato i numeri dovremmo solo poi stampare i qr code

### 12. Distinguere le ceste da 400 kg quadrate da quelle rettangolari serve nel lavoro?

- **No, basta sapere se è da 400 o da 250**

### 13. Firma e foto al momento del ritiro: obbligatorie o facoltative?

_La vostra idea: chi porta via le ceste firma col dito sul telefono, e si scatta una foto del carico. Nei giorni da 150 clienti ogni passaggio in più allunga la coda._

- **Facoltative, decide chi sta al banco**

### 14. Vi va bene chiedere anche il telefono al cliente nuovo?

_Serve a una cosa sola: la lista di chi ha ceste fuori da troppi giorni, con il numero da chiamare._

- **Sì, quando possibile lo chiediamo**

### 15. Che parole usate al banco?

_Come lo chiamate quando un cliente porta via le ceste vuote? E quando le riporta piene? E una cesta piena che aspetta di essere lavorata? L'applicazione userà le vostre parole._

> Ritiro ceste Vuote, rientro ceste piene, Attesa molitura

## Round 3 · I numeri e i casi storti

### 16. Quante ceste avete in tutto?

_Ci avete detto che le etichettate voi e che i numeri li avete già comprati. Sapere quante sono ci dice quanti codici QR stampare e quanto lavoro è prima della campagna._

_Ceste da 400 kg (quadrate e rettangolari insieme)_

> 170

_Ceste da 250 kg_

> 20/30

### 17. Quando un cliente viene a ritirare, quante ceste porta via in una volta?

_È la domanda più importante di questo round. Se ne porta via una, inquadrare il QR è istantaneo. Se ne porta via dieci, sono dieci inquadrature al banco — e in una giornata da 150 clienti la coda si allunga. Sapendolo adesso progettiamo il ritiro nel modo giusto._

- **Cambia tantissimo da cliente a cliente** — Il piccolo ne prende una, il grande dieci

_Qual è il massimo che avete visto portare via a un cliente solo?_

> Una media di 6 ceste

### 18. Chi segna che una cesta è stata svuotata?

_Avete usato la parola attesa molitura: la cesta è rientrata piena e aspetta. Quando viene svuotata torna buona per il cliente dopo, ma qualcuno deve segnarlo, altrimenti l'app continua a dirvi che è occupata._

- **Chi lavora al molino, appena la svuota**

_Come lo chiamate voi quando una cesta viene svuotata e torna disponibile? Useremo la vostra parola nell'app._

> Cesta vuota. Considera che non quando la cesta viene riempita attacchiamo un nastro di carta com scritto il nome, e la cesta appena viene svuotata togliamo il nastro

### 19. Il cliente vi lascia qualcosa a garanzia quando porta via le ceste?

_Le ceste che non tornano sono il problema numero uno che ci avete raccontato. Vogliamo capire se oggi c'è già qualcosa che trattiene il cliente, o se l'applicazione deve reggere tutto da sola con la lista di chi è in ritardo._

- **Oggi niente, ma vorremmo introdurre qualcosa**

_Se avete in mente qualcosa, raccontatecelo: cambia parecchio come costruiamo l'app._

> Potremmo anche mettere una cauzione in denaro, ma com le mentalità che ci sono è una cosa un pó difficile

### 20. Chi si presenta al banco a ritirare è sempre il cliente in persona?

_Capita spesso che venga il figlio, un operaio o un vicino. Se succede, l'app deve sapere a chi intestare le ceste — che è una cosa diversa da chi le ha fisicamente caricate e firmate._

- **Sì, quasi sempre viene il cliente stesso**

### 21. Come ritrovate un cliente che è già venuto altre volte?

_Con 150 passaggi al giorno e solo il nome, due «Mario Rossi» rischiano di diventare la stessa scheda — e le ceste finiscono addosso al cliente sbagliato proprio quando servirebbe sapere chi ce le ha._

- **Basta il nome, ce li ricordiamo**

_Ci sono davvero omonimi tra i vostri clienti?_

> Qualche omonimo c’è al massimo potremmo aggiungere un nickname

### 22. A campagna finita, se un cliente ha ancora ceste fuori, che succede?

_Volete confrontare le campagne tra loro, quindi dobbiamo decidere cosa fa l'app il giorno che chiudete la campagna con delle ceste ancora in giro._

- **Non succede: prima di chiudere le recuperiamo tutte**

### 23. Quando una cesta si rompe o è persa per sempre, chi la toglie dal giro?

- **Solo io o chi comanda** — Al banco non possono cancellare una cesta

_Una cesta persa da un cliente e una cesta rotta al molino sono due cose diverse per voi, o basta segnare che non c'è più?_

> Sarebbe opportuno sapere che fine ha fatto la cesta

### 24. C'è altro che vi è venuto in mente?

_Anche ripensamenti sulle risposte di prima: siamo ancora in tempo per cambiare tutto._

> Per quanto riguarda l’anagrafica se viene collegata al nostro gestionale occorrerebbe mettere pure la parte di nuovo censimento cliente se il cliente è nuovo. Ovviamente non mi interessa che venga censito pure nel nostro gestionale in quanto quello resta a parte e servono altri dati per censirlo perfettamente
