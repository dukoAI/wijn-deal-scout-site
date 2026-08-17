/* Zoeken, filteren en sorteren op de kennisbank-overzichtspagina.
 *
 * Alle wijnen staan al als <a class="kb-rij"> in de HTML (gegenereerd door
 * genereer_kennisbank.py), met hun eigenschappen in data-attributen. Dit script verbergt en
 * herschikt die rijen; het bouwt niets bij. Daardoor blijft de pagina zonder JavaScript een
 * volledige, leesbare lijst — de filterbalk staat dan op `hidden` en verschijnt pas hieronder.
 *
 * Filters stapelen: de aantallen tussen haakjes in een keuzelijst tellen alleen wat er met de
 * ANDERE actieve filters nog mogelijk is, zodat je nooit een combinatie kunt kiezen die niets
 * oplevert.
 *
 * Lange lijsten worden in stappen getoond met een "toon meer"-knop. Bewust géén paginering: het
 * filteren werkt over ALLE rijen, en zodra je de lijst over meerdere pagina's verdeelt zou een
 * zoekopdracht alleen nog binnen de huidige pagina kijken. De rijen staan dus allemaal in de HTML;
 * dit script laat er alleen een deel van zien. Zonder JavaScript blijft de knop op `hidden` staan
 * en is de lijst gewoon compleet. */

(function () {
  var BATCH = 25;

  var zoekbalk = document.querySelector('[data-kb-zoekbalk]');
  var lijst = document.querySelector('.kb-lijst');
  if (!zoekbalk || !lijst) return;

  var rijen = Array.prototype.slice.call(lijst.querySelectorAll('.kb-rij'));
  var selects = Array.prototype.slice.call(zoekbalk.querySelectorAll('select[data-filter]'));
  var zoekveld = zoekbalk.querySelector('input[data-filter="zoek"]');
  var sorteerveld = zoekbalk.querySelector('select[data-sortering]');
  var samenvatting = zoekbalk.querySelector('.kb-filter-samenvatting');
  var tellingVak = document.querySelector('.kb-telling');
  var chipVak = document.querySelector('.kb-actieve-filters');
  var leegVak = document.querySelector('.kb-leeg');
  var meerKnop = document.querySelector('[data-toon-meer]');
  var totaal = rijen.length;
  var getoond = BATCH;

  /* "Druiven" is het enige meerwaardige veld: data-druiven bevat ze pipe-gescheiden. */
  function waardenVan(rij, sleutel) {
    var ruw = rij.dataset[sleutel] || '';
    if (!ruw) return [];
    return sleutel === 'druiven' ? ruw.split('|') : [ruw];
  }

  function huidigeFilters() {
    var actief = {};
    selects.forEach(function (select) {
      if (select.value) actief[select.dataset.filter] = select.value;
    });
    return actief;
  }

  function past(rij, filters, negeer) {
    var sleutel;
    for (sleutel in filters) {
      if (sleutel === negeer) continue;
      if (waardenVan(rij, sleutel).indexOf(filters[sleutel]) === -1) return false;
    }
    if (negeer !== 'zoek') {
      var term = (zoekveld.value || '').trim().toLowerCase();
      if (term && (rij.dataset.zoek || '').indexOf(term) === -1) return false;
    }
    return true;
  }

  /* Herberekent de aantallen per keuzelijst. De gekozen waarde blijft altijd staan, ook als hij
     door de andere filters op 0 uitkomt — anders zou je je eigen keuze niet meer kunnen wissen. */
  function werkOptiesBij(filters) {
    selects.forEach(function (select) {
      var sleutel = select.dataset.filter;
      var mogelijk = rijen.filter(function (rij) { return past(rij, filters, sleutel); });
      var tellingen = {};
      mogelijk.forEach(function (rij) {
        waardenVan(rij, sleutel).forEach(function (waarde) {
          tellingen[waarde] = (tellingen[waarde] || 0) + 1;
        });
      });
      Array.prototype.slice.call(select.options).forEach(function (optie) {
        if (!optie.value) return;
        var aantal = tellingen[optie.value] || 0;
        optie.textContent = optie.value + ' (' + aantal + ')';
        optie.hidden = aantal === 0 && optie.value !== select.value;
      });
    });
  }

  function maakChip(label, wisFunctie) {
    var knop = document.createElement('button');
    knop.type = 'button';
    knop.className = 'kb-chip';
    knop.appendChild(document.createTextNode(label));
    var kruis = document.createElement('span');
    kruis.className = 'kb-chip-kruis';
    kruis.textContent = '×';
    knop.appendChild(kruis);
    knop.addEventListener('click', function () { wisFunctie(); ververs(); });
    return knop;
  }

  function werkChipsBij(filters) {
    chipVak.textContent = '';
    var chips = [];
    var term = (zoekveld.value || '').trim();
    if (term) {
      chips.push(maakChip('“' + term + '”', function () { zoekveld.value = ''; }));
    }
    selects.forEach(function (select) {
      if (!select.value) return;
      var gekozen = select.value;
      chips.push(maakChip(gekozen, function () { select.value = ''; }));
    });
    chips.forEach(function (chip) { chipVak.appendChild(chip); });

    /* "Wis alles" pas vanaf twee filters: bij één filter is de chip zelf al de wisknop. */
    if (chips.length > 1) {
      var wis = document.createElement('button');
      wis.type = 'button';
      wis.className = 'kb-chip-wis';
      wis.textContent = 'Wis alles';
      wis.addEventListener('click', wisAlles);
      chipVak.appendChild(wis);
    }

    var aantalFilters = chips.length;
    samenvatting.textContent = aantalFilters ? aantalFilters + ' actief' : 'geen actief';
    return aantalFilters;
  }

  function sorteer(zichtbaar) {
    var modus = sorteerveld.value;
    zichtbaar.sort(function (a, b) {
      if (modus === 'abc') {
        return a.dataset.naam.localeCompare(b.dataset.naam, 'nl');
      }
      if (modus === 'recent') {
        var datumA = a.dataset.datum || '';
        var datumB = b.dataset.datum || '';
        if (datumA !== datumB) return datumA < datumB ? 1 : -1;
        return a.dataset.naam.localeCompare(b.dataset.naam, 'nl');
      }
      /* Kwaliteitsscore aflopend; wijnen zonder score horen achteraan, niet vooraan. */
      var heeftA = a.dataset.score !== '';
      var heeftB = b.dataset.score !== '';
      if (heeftA !== heeftB) return heeftA ? -1 : 1;
      var scoreA = parseFloat(a.dataset.score);
      var scoreB = parseFloat(b.dataset.score);
      if (heeftA && scoreA !== scoreB) return scoreB - scoreA;
      return a.dataset.naam.localeCompare(b.dataset.naam, 'nl');
    });
    zichtbaar.forEach(function (rij) { lijst.appendChild(rij); });
  }

  function wisAlles() {
    zoekveld.value = '';
    selects.forEach(function (select) { select.value = ''; });
    ververs();
  }

  /* Elke filter-, zoek- of sorteerwijziging begint weer bij de eerste BATCH. Alleen de
     "toon meer"-knop verhoogt `getoond`, en die roept daarom teken() aan en niet ververs(). */
  function ververs() {
    getoond = BATCH;
    teken();
  }

  function teken() {
    var filters = huidigeFilters();
    var zichtbaar = [];
    rijen.forEach(function (rij) {
      var pastNu = past(rij, filters, null);
      rij.hidden = !pastNu;
      if (pastNu) zichtbaar.push(rij);
    });

    werkOptiesBij(filters);
    var aantalFilters = werkChipsBij(filters);
    sorteer(zichtbaar);

    /* Afkappen pas ná het sorteren, anders toon je de eerste 25 van de vórige volgorde. Staat de
       knop niet in de HTML (een pagina van vóór deze wijziging), dan niet afkappen — anders werd
       de rest van de lijst onbereikbaar. */
    if (meerKnop) {
      zichtbaar.forEach(function (rij, i) { rij.hidden = i >= getoond; });
      var rest = Math.max(zichtbaar.length - getoond, 0);
      meerKnop.hidden = rest === 0;
      meerKnop.textContent = 'Toon meer (nog ' + rest + ')';
    }

    var woord = totaal === 1 ? 'wijn' : 'wijnen';
    tellingVak.textContent = aantalFilters === 0
      ? totaal + ' ' + woord + ' beoordeeld'
      : zichtbaar.length + ' van ' + totaal + ' ' + woord;
    leegVak.hidden = zichtbaar.length !== 0;
    lijst.hidden = zichtbaar.length === 0;
  }

  /* De kennisbank heeft geen losse landpagina's; het kruimelpad op een detailpagina linkt
     daarom terug naar dit overzicht met #land=Portugal erachter. */
  function pasHashToe() {
    var match = /^#land=(.+)$/.exec(decodeURIComponent(window.location.hash || ''));
    if (!match) return;
    var landSelect = selects.filter(function (s) { return s.dataset.filter === 'land'; })[0];
    if (!landSelect) return;
    var waarden = Array.prototype.slice.call(landSelect.options).map(function (o) { return o.value; });
    if (waarden.indexOf(match[1]) !== -1) landSelect.value = match[1];
  }

  zoekbalk.hidden = false;
  zoekveld.addEventListener('input', ververs);
  selects.forEach(function (select) { select.addEventListener('change', ververs); });
  sorteerveld.addEventListener('change', ververs);
  document.querySelectorAll('[data-wis-alles]').forEach(function (knop) {
    knop.addEventListener('click', wisAlles);
  });
  if (meerKnop) {
    meerKnop.addEventListener('click', function () {
      getoond += BATCH;
      teken();
    });
  }

  pasHashToe();
  ververs();
})();
