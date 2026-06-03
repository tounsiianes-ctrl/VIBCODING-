// Génération de l'e-book Trading 2026 en PDF pur (sans dépendances npm)
// Utilise une implémentation PDF manuelle conforme à la spec PDF 1.4

const fs = require('fs');
const path = require('path');

const OUTPUT = path.join(__dirname, 'Trading_2026_Ebook.pdf');

// ─── PDF Builder ──────────────────────────────────────────────────────────────
class PDFBuilder {
  constructor() {
    this.buf = [];
    this.offsets = [];
    this.objCount = 0;
    this.pages = [];
    this.fonts = {};
    this.pageContents = [];
    this.currentPage = null;
    this.y = 0;
    this.pageHeight = 841.89; // A4
    this.pageWidth = 595.28;
    this.marginL = 70;
    this.marginR = 70;
    this.marginT = 70;
    this.marginB = 70;
    this.contentWidth = this.pageWidth - this.marginL - this.marginR;
  }

  write(s) { this.buf.push(s); }
  writeln(s) { this.buf.push(s + '\n'); }

  startObj(n) {
    this.offsets[n] = this.buf.join('').length;
    this.writeln(`${n} 0 obj`);
  }
  endObj() { this.writeln('endobj'); }

  allocObj() { return ++this.objCount; }

  escPDF(s) {
    // Replace special chars for PDF string
    return s
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/é/g,'\\351').replace(/è/g,'\\350').replace(/ê/g,'\\352').replace(/ë/g,'\\353')
      .replace(/à/g,'\\340').replace(/â/g,'\\342').replace(/ä/g,'\\344')
      .replace(/ù/g,'\\371').replace(/û/g,'\\373').replace(/ü/g,'\\374')
      .replace(/î/g,'\\356').replace(/ï/g,'\\357').replace(/ì/g,'\\354')
      .replace(/ô/g,'\\364').replace(/ö/g,'\\366').replace(/ò/g,'\\362')
      .replace(/ç/g,'\\347').replace(/ñ/g,'\\361')
      .replace(/É/g,'\\311').replace(/È/g,'\\310').replace(/Ê/g,'\\312')
      .replace(/À/g,'\\300').replace(/Â/g,'\\302')
      .replace(/Ù/g,'\\331').replace(/Î/g,'\\316')
      .replace(/Ô/g,'\\324').replace(/Ç/g,'\\307')
      .replace(/«/g,'\\253').replace(/»/g,'\\273')
      .replace(/'/g,"'").replace(/'/g,"'").replace(/"/g,'"').replace(/"/g,'"')
      .replace(/–/g,'-').replace(/—/g,'-').replace(/…/g,'...')
      .replace(/•/g,'*').replace(/▲/g,'^').replace(/⚠/g,'!')
      .replace(/[^\x00-\xff]/g, '?');
  }

  build() {
    // Header
    this.writeln('%PDF-1.4');
    this.writeln('%\xe2\xe3\xcf\xd3');

    // Reserve object slots: 1=catalog, 2=pages, 3=font-Helv, 4=font-HelvB, 5=font-HelvObl
    // Pages: 6..N, Content streams: N+1..M
    // We'll build content first then write objects

    const fontHelvId = this.allocObj(); // 1
    const fontHelvBId = this.allocObj(); // 2
    const fontHelvOblId = this.allocObj(); // 3
    const pagesId = this.allocObj(); // 4
    const catalogId = this.allocObj(); // 5

    // Build all page content
    const pageData = this._buildAllPages();

    // Write font objects
    this.startObj(fontHelvId);
    this.writeln('<<');
    this.writeln('/Type /Font');
    this.writeln('/Subtype /Type1');
    this.writeln('/BaseFont /Helvetica');
    this.writeln('/Encoding /WinAnsiEncoding');
    this.writeln('>>');
    this.endObj();

    this.startObj(fontHelvBId);
    this.writeln('<<');
    this.writeln('/Type /Font');
    this.writeln('/Subtype /Type1');
    this.writeln('/BaseFont /Helvetica-Bold');
    this.writeln('/Encoding /WinAnsiEncoding');
    this.writeln('>>');
    this.endObj();

    this.startObj(fontHelvOblId);
    this.writeln('<<');
    this.writeln('/Type /Font');
    this.writeln('/Subtype /Type1');
    this.writeln('/BaseFont /Helvetica-Oblique');
    this.writeln('/Encoding /WinAnsiEncoding');
    this.writeln('>>');
    this.endObj();

    // Write page content streams and page objects
    const pageObjIds = [];
    for (const pd of pageData) {
      const streamId = this.allocObj();
      const pageId = this.allocObj();

      // Write stream
      this.startObj(streamId);
      const streamBytes = pd.stream;
      this.writeln(`<< /Length ${streamBytes.length} >>`);
      this.writeln('stream');
      this.write(streamBytes);
      this.writeln('\nendstream');
      this.endObj();

      // Write page
      this.startObj(pageId);
      this.writeln('<<');
      this.writeln('/Type /Page');
      this.writeln(`/Parent ${pagesId} 0 R`);
      this.writeln(`/MediaBox [0 0 ${this.pageWidth} ${this.pageHeight}]`);
      this.writeln(`/Contents ${streamId} 0 R`);
      this.writeln(`/Resources << /Font << /F1 ${fontHelvId} 0 R /F2 ${fontHelvBId} 0 R /F3 ${fontHelvOblId} 0 R >> >>`);
      this.writeln('>>');
      this.endObj();

      pageObjIds.push(pageId);
    }

    // Pages object
    this.startObj(pagesId);
    this.writeln('<<');
    this.writeln('/Type /Pages');
    this.writeln(`/Kids [${pageObjIds.map(id => `${id} 0 R`).join(' ')}]`);
    this.writeln(`/Count ${pageObjIds.length}`);
    this.writeln('>>');
    this.endObj();

    // Catalog
    this.startObj(catalogId);
    this.writeln('<<');
    this.writeln('/Type /Catalog');
    this.writeln(`/Pages ${pagesId} 0 R`);
    this.writeln('>>');
    this.endObj();

    // XRef
    const xrefOffset = this.buf.join('').length;
    this.writeln('xref');
    this.writeln(`0 ${this.objCount + 1}`);
    this.writeln('0000000000 65535 f ');
    for (let i = 1; i <= this.objCount; i++) {
      this.writeln(String(this.offsets[i]).padStart(10, '0') + ' 00000 n ');
    }
    this.writeln('trailer');
    this.writeln('<<');
    this.writeln(`/Size ${this.objCount + 1}`);
    this.writeln(`/Root ${catalogId} 0 R`);
    this.writeln('>>');
    this.writeln('startxref');
    this.writeln(String(xrefOffset));
    this.write('%%EOF');

    return this.buf.join('');
  }

  // ── Page content builder ───────────────────────────────────────────────────
  _buildAllPages() {
    const pages = [];
    let stream = '';
    let y = this.pageHeight - this.marginT;
    let pageNum = 0;

    const newPage = () => {
      if (stream) pages.push({ stream });
      stream = '';
      y = this.pageHeight - this.marginT;
      pageNum++;
      // Footer (page number) — skip first 2 pages (cover + TOC)
      if (pageNum > 2) {
        stream += this._footer(pageNum - 2);
      }
    };

    const ensureSpace = (needed) => {
      if (y - needed < this.marginB) {
        newPage();
      }
    };

    const addText = (text, font, size, x, curY, maxWidth, color) => {
      const col = color || '0.1 0.1 0.1';
      let s = '';
      s += `BT\n`;
      s += `${col} rg\n`;
      s += `/${font} ${size} Tf\n`;
      s += `${x} ${curY} Td\n`;
      s += `(${this.escPDF(text)}) Tj\n`;
      s += `ET\n`;
      return s;
    };

    // Wrap text into lines
    const wrapText = (text, maxCharsPerLine) => {
      const words = text.split(' ');
      const lines = [];
      let current = '';
      for (const w of words) {
        if ((current + ' ' + w).trim().length <= maxCharsPerLine) {
          current = (current + ' ' + w).trim();
        } else {
          if (current) lines.push(current);
          current = w;
        }
      }
      if (current) lines.push(current);
      return lines;
    };

    // Approximate chars per line based on font size
    const charsPerLine = (size) => Math.floor(this.contentWidth / (size * 0.5));

    // ── Render functions ───────────────────────────────────────────────────
    const renderTitle = (text, size, bold, color) => {
      const font = bold ? 'F2' : 'F1';
      const col = color || '0.1 0.1 0.13';
      ensureSpace(size * 2 + 20);
      y -= 10;
      // Draw colored background bar
      stream += `${col} rg\n`;
      stream += `${this.marginL} ${y - size} ${this.contentWidth} ${size + 10} re f\n`;
      stream += `1 1 1 rg\n`;
      stream += `BT\n/${font} ${size} Tf\n${this.marginL + 5} ${y - size + 3} Td\n(${this.escPDF(text)}) Tj\nET\n`;
      stream += `0.1 0.1 0.13 rg\n`;
      y -= size + 20;
    };

    const renderH1 = (text) => {
      ensureSpace(55);
      y -= 15;
      // Blue background
      stream += `0.1 0.19 0.37 rg\n`;
      stream += `${this.marginL - 10} ${y - 28} ${this.contentWidth + 20} 40 re f\n`;
      stream += `1 1 1 rg\n`;
      const lines = wrapText(text, charsPerLine(18));
      for (const line of lines) {
        stream += `BT\n/F2 18 Tf\n${this.marginL} ${y - 22} Td\n(${this.escPDF(line)}) Tj\nET\n`;
        y -= 22;
      }
      stream += `0.1 0.1 0.13 rg\n`;
      y -= 15;
    };

    const renderH2 = (text) => {
      ensureSpace(40);
      y -= 12;
      stream += `0.06 0.13 0.25 rg\n`;
      const lines = wrapText(text, charsPerLine(14));
      for (const line of lines) {
        stream += `BT\n/F2 14 Tf\n${this.marginL} ${y} Td\n(${this.escPDF(line)}) Tj\nET\n`;
        y -= 18;
      }
      // Underline
      stream += `0.06 0.13 0.25 RG\n0.5 w\n${this.marginL} ${y} ${this.contentWidth} 0 re S\n`;
      stream += `0.1 0.1 0.13 rg\n`;
      y -= 8;
    };

    const renderH3 = (text) => {
      ensureSpace(25);
      y -= 8;
      stream += `BT\n/F2 12 Tf\n0.06 0.13 0.25 rg\n${this.marginL} ${y} Td\n(${this.escPDF(text)}) Tj\nET\n`;
      stream += `0.1 0.1 0.13 rg\n`;
      y -= 16;
    };

    const renderBody = (text) => {
      const cpp = charsPerLine(10.5);
      const lines = wrapText(text, cpp);
      for (const line of lines) {
        ensureSpace(14);
        stream += `BT\n/F1 10.5 Tf\n0.1 0.1 0.13 rg\n${this.marginL} ${y} Td\n(${this.escPDF(line)}) Tj\nET\n`;
        y -= 14;
      }
      y -= 4;
    };

    const renderBullet = (text) => {
      const cpp = charsPerLine(10.5) - 3;
      const lines = wrapText(text, cpp);
      let first = true;
      for (const line of lines) {
        ensureSpace(14);
        if (first) {
          stream += `BT\n/F2 10.5 Tf\n0.1 0.1 0.13 rg\n${this.marginL + 10} ${y} Td\n(*) Tj\nET\n`;
          stream += `BT\n/F1 10.5 Tf\n0.1 0.1 0.13 rg\n${this.marginL + 22} ${y} Td\n(${this.escPDF(line)}) Tj\nET\n`;
          first = false;
        } else {
          stream += `BT\n/F1 10.5 Tf\n0.1 0.1 0.13 rg\n${this.marginL + 22} ${y} Td\n(${this.escPDF(line)}) Tj\nET\n`;
        }
        y -= 14;
      }
      y -= 2;
    };

    const renderTip = (text) => {
      const cpp = charsPerLine(9.5) - 4;
      const lines = wrapText(text, cpp);
      const boxH = lines.length * 13 + 16;
      ensureSpace(boxH + 10);
      y -= 8;
      // Box background
      stream += `0.91 0.96 0.99 rg\n`;
      stream += `${this.marginL} ${y - boxH + 6} ${this.contentWidth} ${boxH} re f\n`;
      stream += `0.06 0.13 0.25 RG\n0.8 w\n${this.marginL} ${y - boxH + 6} ${this.contentWidth} ${boxH} re S\n`;
      // Left accent bar
      stream += `0.06 0.13 0.25 rg\n${this.marginL} ${y - boxH + 6} 4 ${boxH} re f\n`;
      stream += `0.1 0.1 0.13 rg\n`;
      let ty = y - 8;
      for (const line of lines) {
        stream += `BT\n/F3 9.5 Tf\n0.06 0.13 0.25 rg\n${this.marginL + 10} ${ty} Td\n(${this.escPDF(line)}) Tj\nET\n`;
        ty -= 13;
      }
      stream += `0.1 0.1 0.13 rg\n`;
      y -= boxH + 12;
    };

    const renderHR = () => {
      ensureSpace(10);
      stream += `0.06 0.13 0.25 RG\n0.5 w\n${this.marginL} ${y} ${this.contentWidth} 0 re S\n`;
      y -= 10;
    };

    const renderSpacer = (h) => { y -= h; };

    const pageBreak = () => { newPage(); };

    // ── TOC Entry ─────────────────────────────────────────────────────────
    const renderTOCEntry = (num, title, page) => {
      ensureSpace(20);
      stream += `BT\n/F2 11 Tf\n0.06 0.13 0.25 rg\n${this.marginL} ${y} Td\n(${this.escPDF(num)}) Tj\nET\n`;
      stream += `BT\n/F1 11 Tf\n0.1 0.1 0.13 rg\n${this.marginL + 80} ${y} Td\n(${this.escPDF(title)}) Tj\nET\n`;
      stream += `BT\n/F1 11 Tf\n0.06 0.13 0.25 rg\n${this.pageWidth - this.marginR - 30} ${y} Td\n(${page}) Tj\nET\n`;
      y -= 18;
    };

    // ══════════════════════════════════════════════════════════════════════
    // PAGE DE COUVERTURE
    // ══════════════════════════════════════════════════════════════════════
    newPage();
    // Full blue background
    stream += `0.1 0.13 0.19 rg\n0 0 ${this.pageWidth} ${this.pageHeight} re f\n`;
    // Accent stripe
    stream += `0.06 0.19 0.37 rg\n0 ${this.pageHeight * 0.35} ${this.pageWidth} 8 re f\n`;
    stream += `0 ${this.pageHeight * 0.65} ${this.pageWidth} 8 re f\n`;

    // Title
    stream += `1 1 1 rg\n`;
    stream += `BT\n/F2 38 Tf\n${this.pageWidth/2 - 200} ${this.pageHeight * 0.68} Td\n(LE TRADING EN 2026) Tj\nET\n`;
    stream += `BT\n/F1 18 Tf\n${this.pageWidth/2 - 190} ${this.pageHeight * 0.62} Td\n(Guide Complet du Trader Moderne) Tj\nET\n`;
    stream += `BT\n/F1 13 Tf\n${this.pageWidth/2 - 170} ${this.pageHeight * 0.55} Td\n(Strategies * Marches * Intelligence Artificielle * Gestion du Risque) Tj\nET\n`;
    stream += `0.4 0.7 1.0 rg\n`;
    stream += `BT\n/F2 15 Tf\n${this.pageWidth/2 - 100} ${this.pageHeight * 0.40} Td\n(Edition 2026 - Version Complète) Tj\nET\n`;
    stream += `BT\n/F1 12 Tf\n${this.pageWidth/2 - 115} ${this.pageHeight * 0.35} Td\n(100 Pages | 9 Chapitres | Guide Professionnel) Tj\nET\n`;
    stream += `0.7 0.7 0.7 rg\n`;
    stream += `BT\n/F3 10 Tf\n${this.pageWidth/2 - 175} ${this.marginB + 20} Td\n(Ce document est fourni a titre educatif uniquement. Le trading comporte des risques de perte en capital.) Tj\nET\n`;

    // ══════════════════════════════════════════════════════════════════════
    // TABLE DES MATIÈRES
    // ══════════════════════════════════════════════════════════════════════
    newPage();
    stream += `0.1 0.19 0.37 rg\n`;
    stream += `${this.marginL - 10} ${this.pageHeight - this.marginT - 40} ${this.contentWidth + 20} 45 re f\n`;
    stream += `1 1 1 rg\n`;
    stream += `BT\n/F2 22 Tf\n${this.marginL + 5} ${this.pageHeight - this.marginT - 30} Td\n(TABLE DES MATIERES) Tj\nET\n`;
    stream += `0.1 0.1 0.13 rg\n`;
    y = this.pageHeight - this.marginT - 60;
    renderHR();

    const toc = [
      ['Introduction', 'Le Monde du Trading en 2026', '4'],
      ['Chapitre 1', 'Les Fondamentaux du Trading', '8'],
      ['Chapitre 2', 'Les Marches Financiers en 2026', '18'],
      ['Chapitre 3', 'Analyse Technique Avancee', '29'],
      ['Chapitre 4', 'Analyse Fondamentale', '42'],
      ['Chapitre 5', 'Trading Algorithmique et Intelligence Artificielle', '52'],
      ['Chapitre 6', 'Gestion du Risque et du Capital', '64'],
      ['Chapitre 7', 'Psychologie du Trading', '74'],
      ['Chapitre 8', 'Strategies Avancees de Trading', '82'],
      ['Chapitre 9', 'Outils, Plateformes et Ressources', '93'],
      ['Conclusion', 'Devenir un Trader Rentable', '97'],
      ['Glossaire', 'Termes Essentiels du Trading', '99'],
    ];
    for (const [num, title, pg] of toc) {
      renderTOCEntry(num, title, pg);
      renderSpacer(4);
    }

    // ══════════════════════════════════════════════════════════════════════
    // CONTENT
    // ══════════════════════════════════════════════════════════════════════

    const content = getContent();
    for (const item of content) {
      switch(item.type) {
        case 'pb': pageBreak(); break;
        case 'h1': renderH1(item.text); break;
        case 'hr': renderHR(); break;
        case 'h2': renderH2(item.text); break;
        case 'h3': renderH3(item.text); break;
        case 'body': renderBody(item.text); break;
        case 'bullet': renderBullet(item.text); break;
        case 'tip': renderTip(item.text); break;
        case 'sp': renderSpacer(item.h || 10); break;
      }
    }

    // End last page
    if (stream) pages.push({ stream });

    return pages;
  }

  _footer(pageNum) {
    let s = '';
    s += `0.06 0.13 0.25 RG\n0.5 w\n${this.marginL} ${this.marginB - 10} ${this.contentWidth} 0 re S\n`;
    s += `BT\n/F1 8 Tf\n0.06 0.13 0.25 rg\n${this.pageWidth/2 - 30} ${this.marginB - 22} Td\n(Le Trading en 2026  |  Page ${pageNum}) Tj\nET\n`;
    return s;
  }
}

// ─── Content ──────────────────────────────────────────────────────────────────
function b(t) { return { type: 'body', text: t }; }
function h1(t) { return { type: 'h1', text: t }; }
function h2(t) { return { type: 'h2', text: t }; }
function h3(t) { return { type: 'h3', text: t }; }
function bu(t) { return { type: 'bullet', text: t }; }
function tip(t) { return { type: 'tip', text: t }; }
function hr() { return { type: 'hr' }; }
function pb() { return { type: 'pb' }; }
function sp(h) { return { type: 'sp', h: h || 10 }; }

function getContent() {
  return [
    // ── INTRODUCTION ──────────────────────────────────────────────────────
    pb(),
    h1('Introduction : Le Monde du Trading en 2026'),
    hr(),
    b("Bienvenue dans l'univers fascinant et complexe du trading financier en 2026. Le paysage des marches financiers a radicalement evolue ces dernieres annees, transforme par l'intelligence artificielle, la finance decentralisee, et une connectivite mondiale sans precedent. Ce guide complet a ete concu pour vous accompagner, que vous soyez debutant souhaitant comprendre les bases ou trader experimente cherchant a affiner vos strategies."),
    b("En 2026, le trading n'est plus l'apanage exclusif des grandes banques d'investissement et des hedge funds. Les plateformes democratisees, les APIs ouvertes, et les outils d'analyse propulses par l'IA ont nivele le terrain de jeu, permettant aux traders individuels d'acceder a des technologies autrefois reservees aux institutionnels."),
    h2('Pourquoi ce guide ?'),
    b("Le marche de l'information sur le trading est sature de contenus obsoletes, de promesses irrealistes, et de strategies qui ne tiennent pas compte des realites actuelles. Ce guide a ete redige avec une approche pragmatique et actualisee, integrant les dernieres evolutions technologiques et reglementaires de 2026."),
    b("Nous aborderons tous les aspects essentiels : des fondamentaux theoriques aux strategies avancees, en passant par la gestion du risque, la psychologie du trader, et l'utilisation des outils modernes. Chaque chapitre est structure de maniere progressive, avec des exemples concrets et des conseils pratiques applicables immediatement."),
    h2('Ce que vous apprendrez'),
    bu("Comprendre le fonctionnement des marches financiers modernes"),
    bu("Maitriser l'analyse technique et fondamentale"),
    bu("Utiliser l'intelligence artificielle comme outil de trading"),
    bu("Gerer efficacement votre capital et vos risques"),
    bu("Developper une psychologie gagnante de trader"),
    bu("Construire et tester vos propres strategies de trading"),
    bu("Naviguer dans l'ecosysteme des cryptomonnaies et DeFi"),
    bu("Optimiser votre fiscalite de trader"),
    sp(8),
    tip("AVERTISSEMENT IMPORTANT : Le trading comporte des risques significatifs de perte en capital. Les performances passees ne garantissent pas les resultats futurs. Ce guide est fourni a des fins educatives uniquement et ne constitue pas un conseil financier. Consultez toujours un conseiller financier agree avant de prendre des decisions d'investissement."),
    h2("L'Evolution du Trading : 2020-2026"),
    b("La periode 2020-2026 a ete marquee par des bouleversements sans precedent dans le monde financier. La pandemie de COVID-19 a d'abord provoque des crashes historiques, suivis de rebonds spectaculaires alimentes par des politiques monetaires ultra-accommodantes. Puis la normalisation progressive, la montee de l'inflation, et les ajustements des banques centrales ont redessinee les regles du jeu."),
    b("L'essor fulgurant des cryptomonnaies, leur institutionnalisation progressive, l'emergence de la DeFi (Finance Decentralisee), et l'adoption massive des ETFs crypto ont cree de nouvelles opportunites et de nouveaux risques. Parallelement, l'intelligence artificielle generative a revolutionne l'analyse de marche, la generation de signaux, et meme la gestion de portefeuille."),
    b("En 2026, le trader moderne doit donc etre a la fois analyste financier, technologue, psychologue, et gestionnaire des risques. Ce guide vous donnera les outils pour exceller dans chacune de ces dimensions."),

    // ── CHAPITRE 1 ────────────────────────────────────────────────────────
    pb(),
    h1('Chapitre 1 : Les Fondamentaux du Trading'),
    hr(),
    h2("1.1 Qu'est-ce que le Trading ?"),
    b("Le trading designe l'achat et la vente d'instruments financiers dans le but de realiser un profit sur la difference de prix. Contrairement a l'investissement traditionnel, qui implique une detention a long terme, le trading se concentre sur des horizons temporels plus courts, allant de la milliseconde (trading haute frequence) a plusieurs semaines (swing trading)."),
    b("Le principe fondamental reste le meme : acheter bas et vendre haut, ou vendre haut et racheter bas (dans le cas de la vente a decouvert). Cependant, la mise en pratique de ce principe simple requiert une expertise profonde des marches, une discipline de fer, et une gestion rigoureuse des risques."),
    h3("Les differents types de marches"),
    bu("Marches Actions (Equity Markets) : Actions d'entreprises cotees en bourse (NYSE, NASDAQ, Euronext, etc.)"),
    bu("Marches Forex (Foreign Exchange) : Echange de devises, le marche le plus liquide au monde avec 7 500 milliards de dollars echanges quotidiennement en 2026"),
    bu("Marches des Matieres Premieres (Commodities) : Or, petrole, ble, cafe, etc."),
    bu("Marches des Indices : CAC 40, S&P 500, DAX, Nikkei, etc."),
    bu("Marches Obligataires : Obligations d'Etat et d'entreprise"),
    bu("Marches des Cryptomonnaies : Bitcoin, Ethereum, et milliers d'altcoins"),
    bu("Marches des Derives : Options, futures, CFDs, warrants"),
    h2("1.2 Les Styles de Trading"),
    b("Chaque trader developpe un style qui correspond a sa personnalite, sa disponibilite, et ses objectifs. En 2026, les principaux styles de trading sont :"),
    h3("Le Scalping"),
    b("Le scalping consiste a realiser de nombreuses petites transactions au cours d'une journee, en profitant de micro-mouvements de prix. Les scalpers detiennent leurs positions pendant quelques secondes a quelques minutes. Cette approche requiert une concentration intense, des reflexes rapides, et des couts de transaction tres bas. En 2026, beaucoup de scalpers utilisent des algorithmes pour automatiser leurs strategies."),
    bu("Duree des positions : Secondes a quelques minutes"),
    bu("Nombre de trades par jour : 20 a 200+"),
    bu("Profit cible par trade : 0,1% a 0,5%"),
    bu("Outils essentiels : DOM (Depth of Market), Level 2, flux d'ordres"),
    h3("Le Day Trading"),
    b("Le day trader ouvre et ferme toutes ses positions dans la meme journee, sans jamais conserver de positions overnight. Cette discipline evite le risque de gaps overnight et les frais de financement (swap). Les day traders analysent principalement les graphiques en 5 minutes, 15 minutes, et 1 heure."),
    bu("Duree des positions : Minutes a quelques heures"),
    bu("Nombre de trades par jour : 3 a 20"),
    bu("Profit cible par trade : 0,5% a 2%"),
    bu("Outils essentiels : Graphiques intraday, indicateurs techniques, actualites en temps reel"),
    h3("Le Swing Trading"),
    b("Le swing trader profite des 'swings' (oscillations) des marches sur plusieurs jours a plusieurs semaines. Cette approche est plus compatible avec une activite professionnelle principale et requiert moins de surveillance constante des marches. L'analyse technique est primordiale, souvent completee par une analyse fondamentale."),
    bu("Duree des positions : 2 jours a 6 semaines"),
    bu("Nombre de trades par mois : 4 a 20"),
    bu("Profit cible par trade : 3% a 15%"),
    bu("Outils essentiels : Graphiques journaliers et hebdomadaires, support/resistance"),
    h3("Le Position Trading"),
    b("Le position trader adopte une vision a long terme, conservant ses positions pendant plusieurs semaines a plusieurs mois. Cette approche se rapproche de l'investissement mais reste active avec des entrees et sorties definies par l'analyse technique et fondamentale."),
    h2("1.3 Les Instruments Financiers Essentiels"),
    h3("Les Actions"),
    b("Une action represente une part de propriete dans une entreprise. En achetant des actions, vous devenez actionnaire et avez droit a une quote-part des benefices (dividendes) et des actifs de l'entreprise. En 2026, les marches actions mondiaux sont plus interconnectes que jamais, avec des algorithmes capables de reagir en microsecondes aux nouvelles economiques."),
    h3("Les CFDs (Contracts for Difference)"),
    b("Les CFDs permettent de speculer sur la hausse ou la baisse d'un actif sans en etre proprietaire. Ils offrent un effet de levier important mais presentent des risques amplifies. En 2026, la reglementation ESMA en Europe plafonne l'effet de levier pour les particuliers : 1:30 pour le Forex majeur, 1:20 pour les indices et l'or, 1:10 pour les matieres premieres, et 1:2 pour les cryptomonnaies."),
    tip("CONSEIL : Selon les statistiques de l'AMF publiees en 2025, environ 73% des traders de CFDs perdent de l'argent sur le long terme. Commencez toujours par un compte demo, et ne tradez qu'avec de l'argent que vous pouvez vous permettre de perdre."),
    h3("Les Options"),
    b("Les options donnent le droit, mais non l'obligation, d'acheter (call) ou de vendre (put) un actif a un prix determine (strike price) avant une date d'expiration. Elles sont utilisees aussi bien pour la speculation que pour la couverture (hedging) de positions existantes."),
    h3("Les Futures"),
    b("Les contrats futures sont des engagements d'acheter ou de vendre un actif a une date future et a un prix determine. Ils sont largement utilises pour speculer sur les matieres premieres, les indices, les devises, et meme les cryptomonnaies."),
    h2("1.4 La Structure d'une Transaction"),
    h3("Bid et Ask"),
    b("Le Bid (offre d'achat) est le prix auquel le marche est pret a acheter l'actif (vous pouvez vendre a ce prix). L'Ask (offre de vente) est le prix auquel le marche est pret a vendre l'actif (vous pouvez acheter a ce prix). La difference entre les deux s'appelle le Spread, qui represente le cout de base de toute transaction."),
    h3("Les Types d'Ordres"),
    bu("Ordre au marche : Execution immediate au meilleur prix disponible"),
    bu("Ordre limite : Execution uniquement si le prix atteint un niveau defini"),
    bu("Ordre stop : Declenche automatiquement quand le prix atteint un niveau defini (stop-loss)"),
    bu("Ordre OCO (One Cancels the Other) : Deux ordres lies, l'un annulant l'autre si execute"),
    bu("Ordre trailing stop : Stop-loss dynamique qui suit le prix favorable"),

    // ── CHAPITRE 2 ────────────────────────────────────────────────────────
    pb(),
    h1("Chapitre 2 : Les Marches Financiers en 2026"),
    hr(),
    h2("2.1 L'Etat des Marches Mondiaux en 2026"),
    b("Le paysage financier mondial en 2026 est le resultat d'une decennie de transformations profondes. Apres les turbulences de la periode 2020-2023, les marches ont trouve un nouvel equilibre, facon par des forces contradictoires : digitalisation acceleree, tensions geopolitiques persistantes, transition energetique en cours, et revolution de l'intelligence artificielle."),
    b("Les banques centrales ont finalement reussi leur atterrissage en douceur : l'inflation est revenue vers les cibles des 2%, permettant des cycles d'assouplissement monetaire qui ont soutenu les marches. Les Etats-Unis ont maintenu leur leadership technologique, l'Europe a renforce son autonomie strategique, et les marches emergents, notamment en Asie du Sud-Est, ont connu une croissance remarquable."),
    h2("2.2 Les Marches Actions en 2026"),
    h3("Wall Street et les Marches Americains"),
    b("Les marches americains continuent de dominer la scene financiere mondiale, representant environ 42% de la capitalisation boursiere mondiale. En 2026, le S&P 500 a connu une transformation sectorielle majeure : les entreprises d'IA, de robotique avancee, et de biotechnologie representent desormais plus de 35% de l'indice."),
    h3("Les Marches Europeens"),
    b("Euronext Paris (CAC 40), Frankfurt (DAX), et les autres places europeennes ont beneficie de la politique industrielle de l'Union Europeenne et du Green Deal. Les secteurs automobile (transition electrique), aeronautique, et luxe restent des piliers de la cote europeenne."),
    h3("Les Marches Asiatiques"),
    b("Le Tokyo Stock Exchange reste la troisieme place mondiale. Les marches d'Inde, d'Indonesie, et du Vietnam ont connu une croissance spectaculaire, attirant des flux d'investissement massifs. Les traders avises en 2026 integrent une allocation sur ces marches emergents a forte croissance."),
    h2("2.3 Le Marche des Changes (Forex) en 2026"),
    b("Avec un volume quotidien depassant les 7 500 milliards de dollars, le Forex reste le plus grand marche financier du monde. En 2026, plusieurs evolutions majeures ont reconfigure ce marche."),
    h3("L'Emergence des Monnaies Numeriques de Banque Centrale (CBDC)"),
    b("La plupart des grandes economies ont lance ou pilotent leurs monnaies numeriques de banque centrale (CBDC). L'e-euro, le digital dollar, et le yuan numerique ont commence a influencer les dynamiques Forex. Ces CBDC offrent une tracabilite totale et un reglement quasi-instantane, transformant progressivement la structure du marche des changes."),
    tip("CONSEIL FOREX 2026 : Les sessions de trading les plus actives restent celles de Londres (08h00-17h00 GMT) et New York (13h00-22h00 GMT), avec un chevauchement particulierement volatile de 13h00 a 17h00 GMT. Les annonces de la Fed, de la BCE, et de la BoJ continuent de creer les plus grandes opportunites et les plus grands risques."),
    h2("2.4 Les Cryptomonnaies : Un Marche Mature en 2026"),
    b("En 2026, le marche des cryptomonnaies a atteint une maturite relative apres les cycles de boom-bust des annees precedentes. L'approbation et le succes des ETFs Bitcoin et Ethereum spot aux Etats-Unis, en Europe, et dans plusieurs autres juridictions ont facilite l'entree des investisseurs institutionnels."),
    h3("Bitcoin (BTC) : La Reserve de Valeur Numerique"),
    b("Bitcoin s'est definitivement etabli comme 'or numerique' et reserve de valeur. Apres son 4eme halving en avril 2024, le cycle haussier qui a suivi a confirme ce statut. En 2026, de nombreux Etats et entreprises detiennent du Bitcoin dans leurs reserves."),
    h3("Ethereum (ETH) : La Plateforme de Finance Decentralisee"),
    b("Ethereum reste la plateforme dominante pour les contrats intelligents, la DeFi, et les NFTs. En 2026, l'Ethereum staking offre des rendements annuels de 3-5%, attirant des investisseurs a long terme."),
    h3("La DeFi (Finance Decentralisee)"),
    b("La DeFi a considerablement muri depuis ses debuts. Les protocoles de pret, d'echange decentralise (DEX), et de yield farming sont desormais audites regulierement et mieux regules. En 2026, la DeFi gere plusieurs milliers de milliards de dollars en valeur totale verrouilee (TVL)."),
    h2("2.5 Les Matieres Premieres en 2026"),
    b("La transition energetique a profondement reconfigure le marche des matieres premieres. Les metaux critiques pour les technologies vertes (lithium, cobalt, cuivre, terres rares) ont gagne une importance strategique majeure."),
    bu("Energie : Le petrole maintient sa relevance malgre la transition, le gaz naturel reste strategique, l'hydrogene emerge comme nouvelle matiere premiere energetique"),
    bu("Metaux Precieux : L'or reste valeur refuge, l'argent profite de la demande industrielle solaire"),
    bu("Metaux de Transition Energetique : Lithium, cobalt, nickel, cuivre - les 'petroles du 21eme siecle'"),
    bu("Matieres Premieres Agricoles : Volatilite accrue due aux changements climatiques"),

    // ── CHAPITRE 3 ────────────────────────────────────────────────────────
    pb(),
    h1("Chapitre 3 : Analyse Technique Avancee"),
    hr(),
    h2("3.1 Les Fondements de l'Analyse Technique"),
    b("L'analyse technique repose sur trois postulats fondamentaux : (1) Le marche actualise tout - le prix reflete toutes les informations disponibles ; (2) Les prix evoluent en tendances ; (3) L'histoire se repete - les comportements humains creent des patterns recurrents."),
    b("En 2026, l'analyse technique s'est enrichie de l'apport de l'intelligence artificielle et du machine learning, qui permettent d'identifier des patterns complexes invisibles a l'oeil nu et de tester des milliers de configurations en quelques secondes."),
    h2("3.2 La Theorie de Dow et les Tendances"),
    bu("Tendance primaire : Duree de 1 a plusieurs annees (trend de fond)"),
    bu("Tendance secondaire : Corrections ou rallyes au sein de la tendance primaire, durant de 3 semaines a 3 mois"),
    bu("Tendance tertiaire : Fluctuations de court terme, moins de 3 semaines"),
    h3("Identifier une Tendance Haussiere (Uptrend)"),
    b("Une tendance haussiere se caracterise par une succession de plus-hauts (higher highs) et de plus-bas (higher lows). Les acheteurs sont dominants, repoussant progressivement les vendeurs. On cherche a entrer en position longue lors des corrections au sein de cette tendance."),
    h3("Le Marche en Range (Consolidation)"),
    b("Quand un marche ne presente pas de tendance claire, il evolue en 'range', oscillant entre un support (plancher) et une resistance (plafond). Les strategies de range trading visent a acheter au support et vendre a la resistance."),
    h2("3.3 Les Supports et Resistances"),
    b("Les supports et resistances sont les concepts les plus fondamentaux de l'analyse technique. Un support est un niveau de prix ou la demande est suffisamment forte pour arreter et potentiellement inverser une baisse. Une resistance est un niveau de prix ou l'offre est suffisamment forte pour arreter une hausse."),
    bu("Horizontaux : Niveaux de prix statiques ou le marche a reagi par le passe"),
    bu("Dynamiques : Moyennes mobiles, canaux de tendance"),
    bu("Psychologiques : Chiffres ronds (100, 1000, 50 000 pour le Bitcoin)"),
    bu("Pivots : Niveaux calcules a partir des donnees de la seance precedente"),
    bu("Retracements de Fibonacci : Niveaux bases sur la suite de Fibonacci"),
    tip("REGLE D'OR : Un support casse devient une resistance, et une resistance cassee devient un support. Cette 'polarite' des niveaux est l'une des observations les plus fiables en analyse technique."),
    h2("3.4 Les Moyennes Mobiles"),
    b("Les moyennes mobiles (Moving Averages) lissent les donnees de prix sur une periode definie, permettant d'identifier la tendance et les zones de support/resistance dynamiques."),
    h3("Moyenne Mobile Simple (SMA)"),
    b("La SMA calcule la moyenne arithmetique des prix de cloture sur une periode N. Les SMA populaires : 20, 50, 100, 200 periodes. La SMA 200 est la reference des institutionnels pour identifier le trend long terme."),
    h3("Moyenne Mobile Exponentielle (EMA)"),
    b("L'EMA accorde plus de poids aux donnees recentes, la rendant plus reactive aux mouvements de prix recents que la SMA. Elle est preferee par de nombreux traders pour ses signaux plus rapides. Les EMA populaires : 8, 13, 21, 55 periodes."),
    h3("Strategies avec les Moyennes Mobiles"),
    bu("Golden Cross / Death Cross : Croisement de la MA 50 et de la MA 200 (signal de tendance long terme)"),
    bu("Enveloppes de Bollinger : Bandes de 2 ecarts-types autour d'une MA 20"),
    bu("Support/Resistance Dynamique : Prix rebondissant sur une MA importante"),
    h2("3.5 Les Oscillateurs et Indicateurs de Momentum"),
    h3("Le RSI (Relative Strength Index)"),
    b("Developpe par J. Welles Wilder en 1978, le RSI mesure la vitesse et l'amplitude des mouvements de prix sur une echelle de 0 a 100. Les niveaux de surachat (70+) et survente (30-) fournissent des signaux d'alerte. La divergence RSI/prix genere les signaux les plus puissants."),
    h3("Le MACD"),
    b("Le MACD est calcule a partir de la difference entre deux EMAs (generalement 12 et 26 periodes). La ligne de signal (EMA 9 du MACD) et l'histogramme permettent d'identifier les croisements et divergences. En 2026, le MACD reste un indicateur de reference pour confirmer les signaux d'entree."),
    h3("Le Stochastique"),
    b("L'oscillateur stochastique compare le prix de cloture a sa fourchette de prix sur une periode donnee. Oscillant entre 0 et 100, il identifie les zones de surachat (80+) et survente (20-). Particulierement efficace en marche de range."),
    h2("3.6 Les Patterns de Chandeliers Japonais"),
    b("L'analyse des chandeliers japonais (candlesticks) est devenue incontournable. Chaque chandelier represente l'evolution du prix sur une periode : ouverture, plus-haut, plus-bas, et cloture."),
    h3("Patterns de Retournement Haussiers"),
    bu("Marteau (Hammer) : Long wick inferieur, petit corps en haut - signal haussier apres une baisse"),
    bu("Englobante Haussiere (Bullish Engulfing) : Grand chandelier vert englobant un chandelier rouge"),
    bu("Etoile du Matin (Morning Star) : Pattern en 3 chandeliers signalant un retournement haussier"),
    bu("Doji : Chandelier avec ouverture et cloture quasi-identiques - indecision du marche"),
    h3("Patterns de Retournement Baissiers"),
    bu("Etoile Filante (Shooting Star) : Long wick superieur, signal baissier apres une hausse"),
    bu("Englobante Baissiere (Bearish Engulfing) : Grand chandelier rouge englobant un chandelier vert"),
    bu("Etoile du Soir (Evening Star) : Pattern en 3 chandeliers signalant un retournement baissier"),
    h2("3.7 Les Patterns Chartistes"),
    h3("Patterns de Continuation"),
    bu("Triangle ascendant / descendant / symetrique"),
    bu("Flag et Pennant (drapeau et fanion) : Consolidation apres une forte impulsion"),
    bu("Canal haussier ou baissier"),
    h3("Patterns de Retournement"),
    bu("Tete et Epaules (Head & Shoulders) et sa version inversee"),
    bu("Double Top / Double Bottom"),
    bu("Triple Top / Triple Bottom"),
    tip("ASTUCE 2026 : Les plateformes modernes integrent des IA capables de scanner des milliers de marches simultanement et d'alerter le trader quand un pattern chartiste se forme."),

    // ── CHAPITRE 4 ────────────────────────────────────────────────────────
    pb(),
    h1("Chapitre 4 : Analyse Fondamentale"),
    hr(),
    h2("4.1 L'Analyse Fondamentale : Comprendre la Valeur Reelle"),
    b("Tandis que l'analyse technique etudie les mouvements de prix historiques, l'analyse fondamentale cherche a determiner la valeur intrinseque d'un actif en etudiant les facteurs economiques, financiers, et qualitatifs. En 2026, les deux approches sont complementaires."),
    h2("4.2 L'Analyse Macroeconomique"),
    h3("Les Indicateurs Economiques Cles"),
    bu("PIB (Produit Interieur Brut) : Mesure de la croissance economique, publication trimestrielle"),
    bu("Inflation (CPI, PCE) : Niveau des prix a la consommation, influence directe sur les banques centrales"),
    bu("Emploi (NFP, taux de chomage) : Sante du marche du travail"),
    bu("Indices PMI : Indicateur avance de l'activite manufacturiere et des services"),
    bu("Confiance des consommateurs : Anticipations et sentiment des menages"),
    bu("Ventes au detail : Mesure de la consommation des menages"),
    bu("Balance commerciale : Difference entre exportations et importations"),
    h3("Les Banques Centrales : Acteurs Dominants en 2026"),
    b("En 2026, les decisions des grandes banques centrales continuent d'etre les evenements les plus impactants pour les marches. La Fed, la BCE, la BoE, et la BoJ orientent les flux de capitaux mondiaux par leurs decisions de taux et leurs communications."),
    tip("CALENDRIER ECONOMIQUE : Consultez quotidiennement le calendrier economique. Identifiez les evenements a fort impact et ajustez votre exposition. Evitez de prendre de nouvelles positions 30 minutes avant et apres les publications majeures."),
    h2("4.3 L'Analyse des Actions : Valeur Fondamentale"),
    h3("Les Ratios Financiers Essentiels"),
    bu("PER (Price-Earnings Ratio) : Prix de l'action / Benefice par action"),
    bu("PEG (Price/Earnings to Growth) : PER / Taux de croissance des benefices"),
    bu("P/B (Price-to-Book) : Prix de l'action / Valeur comptable par action"),
    bu("EV/EBITDA : Valeur d'entreprise / EBITDA"),
    bu("ROE (Return on Equity) : Benefice net / Capitaux propres"),
    bu("FCF Yield : Flux de tresorerie libre / Capitalisation boursiere"),
    h3("Analyse des Etats Financiers"),
    bu("Compte de Resultat : Revenus, couts, benefices - tendance de la rentabilite"),
    bu("Bilan : Actifs, dettes, capitaux propres - sante financiere"),
    bu("Tableau des Flux de Tresorerie : Cash genere par l'activite operationnelle"),
    h2("4.4 Analyse Fondamentale des Cryptomonnaies"),
    h3("Metriques On-Chain"),
    bu("NVT Ratio (Network Value to Transactions) : Valorisation du reseau / transactions"),
    bu("MVRV (Market Value to Realized Value) : Identifie les zones de surachat et survente"),
    bu("Active Addresses : Nombre d'adresses actives - indicateur d'adoption"),
    bu("Hash Rate Bitcoin : Puissance de calcul du reseau - securite et confiance"),
    bu("TVL (Total Value Locked) : Mesure l'utilisation des protocoles DeFi"),
    h2("4.5 L'Analyse du Sentiment de Marche"),
    bu("Fear & Greed Index : Mesure composite du sentiment crypto ou actions"),
    bu("Analyse NLP des reseaux sociaux : IA analysant des millions de posts"),
    bu("Positionnement des institutionnels (COT Report) : Positions des grands acteurs sur les futures"),
    bu("Put/Call Ratio : Ratio options de vente/achat - indicateur de sentiment contrarian"),
    bu("Short Interest : Volume de positions vendeuses - zones de potentiels short squeezes"),

    // ── CHAPITRE 5 ────────────────────────────────────────────────────────
    pb(),
    h1("Chapitre 5 : Trading Algorithmique et Intelligence Artificielle"),
    hr(),
    h2("5.1 La Revolution de l'IA dans le Trading"),
    b("En 2026, l'intelligence artificielle a profondement transforme le trading a tous les niveaux. Des hedge funds qui gerent des centaines de milliards avec des algorithmes sophistiques aux traders individuels qui utilisent des outils IA pour generer des signaux, la frontiere entre trading humain et trading algorithmique s'est estompee."),
    h2("5.2 Types d'Algorithmes de Trading"),
    h3("Execution Algorithmique"),
    bu("TWAP (Time Weighted Average Price) : Decoupe un grand ordre en petits morceaux executes sur une periode definie"),
    bu("VWAP (Volume Weighted Average Price) : Execute des ordres proportionnellement au volume de marche"),
    bu("Implementation Shortfall : Minimise l'ecart entre le prix decisionnel et le prix d'execution"),
    bu("Iceberg Orders : Cache la taille reelle de l'ordre pour eviter de deplacer le marche"),
    h3("Algorithmes de Generation de Signaux"),
    bu("Algorithmes bases sur des regles : Implementation automatique de strategies techniques classiques"),
    bu("Machine Learning supervise : Modeles entraines sur des donnees historiques"),
    bu("Reinforcement Learning : Algorithmes qui s'ameliorent par essais-erreurs"),
    bu("NLP et analyse de sentiment : Traitement du langage naturel pour analyser news et reseaux sociaux"),
    bu("Computer Vision : Reconnaissance automatique de patterns chartistes"),
    h2("5.3 Construction d'un Algorithme de Trading"),
    h3("Le Processus de Developpement"),
    bu("1. Ideation : Definir l'hypothese de trading - quel edge (avantage) exploitez-vous ?"),
    bu("2. Collecte de donnees : Donnees historiques de qualite, nettoyees et verifiees"),
    bu("3. Backtesting : Test de la strategie sur donnees historiques"),
    bu("4. Optimisation : Ajustement des parametres pour ameliorer les performances"),
    bu("5. Walk-Forward Testing : Test sur donnees out-of-sample pour eviter l'overfit"),
    bu("6. Paper Trading : Test en temps reel sans capital reel"),
    bu("7. Live Trading : Deploiement progressif avec capital reel limite"),
    bu("8. Monitoring : Surveillance continue et ajustements si necessaire"),
    tip("REGLE ANTI-OVERFITTING : Si votre strategie a plus de 3-4 parametres, soyez tres prudent. Chaque parametre supplementaire augmente le risque d'overfitting. La strategie la plus simple avec le moins de parametres est generalement la plus robuste."),
    h2("5.4 Les Outils IA pour Traders Individuels en 2026"),
    bu("Assistants IA de Trading : Outils generatifs pour l'analyse de marche et la generation de code"),
    bu("Screeners IA : Scan de marches entiers pour identifier des setups repondant a des criteres multiples"),
    bu("Alertes Intelligentes : IA qui detecte automatiquement les patterns importants"),
    bu("Backtesting Automatise : Plateformes comme QuantConnect, Backtrader, ou TradingView Pine Script v6"),
    bu("Analyse de Sentiment en Temps Reel : Outils agregant et analysant news et reseaux sociaux"),
    h3("Python pour le Trading : Les Bibliotheques Essentielles"),
    bu("pandas / numpy : Manipulation et calcul sur donnees financieres"),
    bu("yfinance / ccxt / alpaca-py : Acces aux donnees de marche et APIs de brokers"),
    bu("TA-Lib / pandas-ta : Calcul d'indicateurs techniques"),
    bu("scikit-learn / tensorflow / pytorch : Machine learning et deep learning"),
    bu("backtrader / zipline / vectorbt : Frameworks de backtesting"),
    h2("5.5 L'Ethique et la Reglementation du Trading Algorithmique"),
    b("En 2026, le trading algorithmique est soumis a des reglementations de plus en plus strictes. La reglementation MiFID II en Europe impose des obligations de surveillance, de test, et de documentation des algorithmes. Les pratiques manipulatoires comme le spoofing sont lourdement sanctionnees."),
    bu("Obligation de tests pre-deploiement pour les algorithmes significatifs"),
    bu("Kill switches obligatoires pour arreter immediatement les algorithmes defaillants"),
    bu("Reporting des algorithmes aux autorites regulatrices"),
    bu("Limites de position et de vitesse d'ordres"),

    // ── CHAPITRE 6 ────────────────────────────────────────────────────────
    pb(),
    h1("Chapitre 6 : Gestion du Risque et du Capital"),
    hr(),
    h2("6.1 Pourquoi la Gestion du Risque est Primordiale"),
    b("La gestion du risque est ce qui separe les traders professionnels durables des speculateurs qui brulent rapidement leur capital. Des traders avec des strategies mediocres mais une gestion du risque excellente survivent et progressent. Des traders avec des analyses brillantes mais sans gestion du risque finissent invariablement par tout perdre."),
    h2("6.2 Les Regles Fondamentales de Gestion du Risque"),
    h3("La Regle des 1% a 2%"),
    b("Ne jamais risquer plus de 1% a 2% de votre capital total sur une seule transaction. Avec un risque de 1% par trade, il faudrait 100 trades perdants consecutifs pour perdre tout son capital - statistiquement quasi-impossible avec une strategie meme mediocre."),
    h3("Calcul de la Taille de Position"),
    b("Formule : Taille de Position = (Capital x Risque%) / Distance Stop-Loss en %"),
    b("Exemple : Capital de 10 000 EUR, risque 1%, stop-loss a 2% du prix d'entree. Taille de position = (10 000 x 0,01) / 0,02 = 5 000 EUR. Risque maximum : 100 EUR (1% du capital)."),
    h3("Le Ratio Risque/Recompense (Risk/Reward Ratio)"),
    b("Un ratio minimum de 1:2 (risquer 1 pour gagner 2) est recommande. Avec ce ratio et un taux de succes de seulement 40%, votre trading sera rentable a long terme."),
    tip("CONCEPT CLE : L'esperance mathematique (Edge) = (Taux de reussite x Gain moyen) - (Taux d'echec x Perte moyenne). Un trading rentable necessite une esperance positive, pas un taux de reussite de 100%."),
    h2("6.3 Le Stop-Loss : Votre Meilleur Ami"),
    h3("Types de Stop-Loss"),
    bu("Stop-Loss Technique : Place sous un support ou derriere une resistance cassee"),
    bu("Stop-Loss en % : Placement a un % fixe du prix d'entree"),
    bu("Stop-Loss ATR : Base sur l'Average True Range (volatilite)"),
    bu("Trailing Stop : Se deplace dans le sens favorable pour proteger les gains"),
    bu("Stop en Temps : Fermeture si la position n'evolue pas favorablement apres un delai"),
    h3("Ou Placer son Stop-Loss ?"),
    bu("Au-dela d'un niveau technique significatif (support/resistance)"),
    bu("Suffisamment eloigne pour ne pas etre touche par le bruit de marche normal"),
    bu("Pas trop eloigne pour maintenir un ratio risque/recompense acceptable"),
    h2("6.4 La Diversification et la Correlation"),
    b("La diversification est le seul 'repas gratuit' en finance. En repartissant le capital sur des actifs peu correles, on reduit le risque global du portefeuille sans necessairement reduire le rendement espere."),
    bu("Ne pas avoir plus de 3-4 positions hautement correlees simultanement"),
    bu("Eviter d'etre long sur EUR/USD et USD/CHF simultanement (correlation inverse forte)"),
    bu("En crypto, le Bitcoin influence majoritairement les altcoins"),
    bu("Utiliser des actifs refuges (or, CHF, obligations) pour equilibrer un portefeuille risque"),
    h2("6.5 Gestion du Capital et Psychologie du Drawdown"),
    h3("Comprendre le Drawdown"),
    b("Le drawdown est la baisse de la valeur de votre compte depuis un pic jusqu'a un creux. C'est une realite inevitable en trading. Meme les meilleurs traders professionnels connaissent des drawdowns de 20-30%."),
    bu("Drawdown de 10% -> recuperation necessaire : 11%"),
    bu("Drawdown de 25% -> recuperation necessaire : 33%"),
    bu("Drawdown de 50% -> recuperation necessaire : 100%"),
    bu("Drawdown de 75% -> recuperation necessaire : 300%"),
    h3("Regles pour Gerer un Drawdown"),
    bu("Reduire la taille des positions de 50% quand le drawdown depasse 10%"),
    bu("Arreter completement de trader si le drawdown depasse 20-25%"),
    bu("Ne jamais 'revenge trade' (trader agressivement pour recuperer les pertes)"),
    bu("Tenir un journal de trading pour analyser les causes des pertes"),

    // ── CHAPITRE 7 ────────────────────────────────────────────────────────
    pb(),
    h1("Chapitre 7 : Psychologie du Trading"),
    hr(),
    h2("7.1 L'Importance de la Psychologie en Trading"),
    b("La psychologie est, selon de nombreux traders professionnels, le facteur le plus important du succes en trading. On peut avoir la meilleure strategie du monde, si on ne peut pas l'executer avec discipline et serenite, elle sera inefficace. Les etudes montrent que 80% des traders perdants n'ont pas de probleme de strategie mais de psychologie."),
    h2("7.2 Les Biais Cognitifs du Trader"),
    h3("La Peur et l'Avidite : Les Deux Ennemis"),
    b("La peur conduit a couper les gains trop tot, laisser les pertes s'aggraver, rater des opportunites evidentes. L'avidite conduit a prendre des positions trop grandes, deplacer les stop-loss, et overtrader."),
    h3("Les Autres Biais Cognitifs Courants"),
    bu("Biais de confirmation : Ne chercher que les informations qui confirment son analyse"),
    bu("Biais de recence : Surponderer les evenements recents dans ses decisions"),
    bu("Effet de dotation : Valoriser excessivement ce qu'on possede (ne pas vouloir vendre en perte)"),
    bu("Biais de l'ancrage : Se fixer sur un prix de reference (prix d'achat) plutot que la valeur actuelle"),
    bu("Exces de confiance : Apres une serie de gains, augmenter excessivement les risques"),
    bu("Gambler's Fallacy : Croire qu'apres une serie de pertes, un gain est 'du'"),
    h2("7.3 Developper la Discipline du Trader"),
    h3("Le Plan de Trading"),
    b("Un plan de trading definit en amont, sans l'influence des emotions du marche, les regles que vous suivrez systematiquement."),
    bu("Univers d'investissement : Quels marches et instruments vous tradez"),
    bu("Criteres d'entree : Conditions precises pour entrer une position"),
    bu("Gestion des positions : Taille, stop-loss, take-profit, trailing stop"),
    bu("Criteres de sortie : Conditions de sortie en profit et en perte"),
    bu("Regles de money management : % de risque par trade, drawdown maximum"),
    bu("Regles comportementales : Nombre maximum de trades par jour"),
    h3("Le Journal de Trading"),
    b("Le journal de trading est l'outil de progression le plus puissant. Il permet d'identifier ses forces et faiblesses, de reperer les patterns de comportement contre-productifs, et de documenter l'evolution de ses performances."),
    h2("7.4 La Routine du Trader Professionnel"),
    h3("Avant la Session"),
    bu("Revue du calendrier economique du jour"),
    bu("Analyse des marches cles et identification des niveaux importants"),
    bu("Definition du bias directionnel du jour"),
    bu("Definition du risque maximum acceptable pour la session"),
    h3("Pendant la Session"),
    bu("Trader uniquement les setups qui correspondent au plan"),
    bu("Respecter scrupuleusement les regles de gestion du risque"),
    bu("Prendre des pauses regulieres (toutes les 1-2 heures)"),
    bu("Eviter de trader apres 2-3 pertes consecutives"),
    h3("Apres la Session"),
    bu("Revue des trades de la journee dans le journal"),
    bu("Calcul des performances (P&L, ratio W/L, RR moyen)"),
    bu("Analyse des erreurs d'execution vs plan"),
    h2("7.5 Gerer le Stress et Eviter le Burnout"),
    bu("Meditation de pleine conscience (mindfulness) : 10-20 minutes quotidiennes"),
    bu("Exercice physique regulier : Ameliore la concentration, reduit le cortisol"),
    bu("Sommeil suffisant et regulier : Essentiel pour la prise de decision rationnelle"),
    bu("Limitation du temps d'ecran : Ne pas checker les marches en dehors des heures de trading"),
    bu("Detachement du resultat : Se concentrer sur l'execution du plan, pas sur le P&L"),
    tip("SAGESSE DU TRADER : 'Le trading est le seul metier ou vous pouvez faire exactement ce qu'il faut et perdre de l'argent, et faire exactement ce qu'il ne faut pas et en gagner.' Mark Douglas. L'objectif est de prendre les bonnes decisions repetitivement."),

    // ── CHAPITRE 8 ────────────────────────────────────────────────────────
    pb(),
    h1("Chapitre 8 : Strategies Avancees de Trading"),
    hr(),
    h2("8.1 La Strategie de Suivi de Tendance (Trend Following)"),
    b("Le trend following est l'une des strategies les plus eprouvees en trading. L'idee : identifier les marches en tendance forte et se positionner dans le sens de cette tendance jusqu'a ce qu'elle s'epuise."),
    bu("Identifier la tendance : MA 200 jours comme filtre"),
    bu("Attendre un pullback : Le prix recule vers la MA 20 ou 50"),
    bu("Entree sur confirmation : Chandelier de retournement au niveau du pullback"),
    bu("Stop-loss : Sous le plus-bas du pullback"),
    bu("Objectif : Prochain niveau de resistance majeur ou trailing stop"),
    h2("8.2 La Strategie de Retournement (Mean Reversion)"),
    b("La mean reversion exploite le fait que les prix tendent a revenir vers leur moyenne historique apres des mouvements extremes. Performe particulierement bien dans des marches en range."),
    bu("Identifier les extremes : RSI < 30 (oversold) ou > 70 (overbought)"),
    bu("Confirmation par les bandes de Bollinger : Prix touchant les bandes exterieures"),
    bu("Signal d'entree : Chandelier de retournement + divergence RSI"),
    bu("Stop-loss : Juste au-dela de l'extreme recent"),
    bu("Objectif : Retour vers la MA 20 ou la bande centrale de Bollinger"),
    h2("8.3 Trading des Cassures (Breakout Trading)"),
    b("Le breakout trading vise a capturer les mouvements puissants qui se produisent quand le prix sort d'une zone de consolidation. Ces cassures sont souvent accompagnees d'une augmentation du volume."),
    h3("Types de Cassures"),
    bu("Cassure de range horizontal : Le prix sort d'un canal lateral bien defini"),
    bu("Cassure de triangle : Resolution d'une compression des prix"),
    bu("Cassure de niveau cle : Le prix depasse un niveau historique important (ATH)"),
    h3("Gestion des Faux Cassures (Fakeouts)"),
    bu("Attendre une cloture confirmee au-dela du niveau"),
    bu("Verifier l'augmentation du volume lors de la cassure"),
    bu("Utiliser un filtre de temps (la cassure doit tenir X heures)"),
    h2("8.4 Le Trading de Momentum"),
    b("Le trading de momentum exploite la tendance des actifs qui ont recemment bien performe a continuer dans la meme direction. Cette anomalie de marche est bien documentee academiquement."),
    bu("Identifier les actifs avec le plus fort momentum recent (1 mois, 3 mois, 6 mois)"),
    bu("Verifier que le momentum est soutenu par des fondamentaux positifs"),
    bu("Acheter au pullback vers un niveau de support cle"),
    h2("8.5 L'Arbitrage et le Trading de Paires"),
    h3("Le Trading de Paires"),
    b("Le trading de paires consiste a prendre simultanement une position longue sur un actif et une position courte sur un autre actif lie. L'objectif est de profiter de la convergence ou divergence de la relation entre les deux actifs."),
    bu("Exemple classique : Long Coca-Cola, Short PepsiCo"),
    bu("En crypto : Long BTC, Short ETH quand le ratio BTC/ETH est anormalement bas"),
    h3("L'Arbitrage Crypto"),
    b("L'arbitrage crypto exploite les differences de prix d'une meme cryptomonnaie sur differentes plateformes. En 2026, ces ecarts sont tres reduits. L'arbitrage de financement (funding rate arbitrage) reste une source de profits pour les traders sophistiques."),
    h2("8.6 Les Strategies d'Options"),
    h3("Strategies de Base"),
    bu("Long Call : Droit d'acheter - profite d'une hausse au-dela du strike"),
    bu("Long Put : Droit de vendre - profite d'une baisse sous le strike"),
    bu("Covered Call : Vente d'une option d'achat sur un actif deja possede - genere des revenus"),
    bu("Cash-Secured Put : Vente d'une option de vente - genere des revenus"),
    h3("Strategies Avancees"),
    bu("Bull Call Spread : Achat d'un call, vente d'un call a strike superieur"),
    bu("Iron Condor : Strategie en 4 options pour profiter d'un marche en range"),
    bu("Straddle : Achat simultane d'un call et put - parie sur une forte volatilite"),
    bu("LEAP Options : Options a long terme (1-2 ans) pour simuler la possession d'actions"),
    h2("8.7 Le Trading Saisonnier"),
    bu("Effet janvier (January Effect) : Tendance haussiere des actions en debut d'annee"),
    bu("'Sell in May and go away' : Sous-performance historique des actions de mai a octobre"),
    bu("Saisonnalite du petrole : Hausse estivale liee a la demande de climatisation"),
    bu("Saisonnalite agricole : Prix du ble, mais, soja lies aux cycles de plantation"),
    bu("Saisonnalite Bitcoin : Cycles lies aux halvings et a la saison fiscale americaine"),

    // ── CHAPITRE 9 ────────────────────────────────────────────────────────
    pb(),
    h1("Chapitre 9 : Outils, Plateformes et Ressources"),
    hr(),
    h2("9.1 Les Plateformes de Trading"),
    h3("Pour les Actions et CFDs"),
    bu("Interactive Brokers : Reference pour les traders actifs - faibles couts, acces mondial"),
    bu("MetaTrader 5 (MT5) : Standard pour le Forex et CFDs, ecosysteme riche"),
    bu("cTrader : Alternative a MT5, tres appreciee pour le Forex avec acces aux ECN"),
    bu("Saxo Bank : Plateformes premium pour traders actifs et investisseurs"),
    bu("eToro : Adapte aux debutants, avec copytrade social"),
    h3("Pour les Cryptomonnaies"),
    bu("Binance : Le plus grand exchange mondial par volume"),
    bu("Coinbase / Coinbase Advanced : Reference pour la conformite reglementaire"),
    bu("Kraken : Securite et reputation excellentes"),
    bu("Bybit / OKX : Pour le trading de derives crypto avec effet de levier"),
    bu("dYdX / GMX : Exchanges decentralises (DEX) pour le trading on-chain"),
    h2("9.2 Les Outils d'Analyse"),
    h3("Analyse Graphique"),
    bu("TradingView : La reference absolue pour l'analyse graphique, avec Pine Script"),
    bu("MetaTrader 5 : Integre aux plateformes MT5, avec des milliers d'indicateurs"),
    h3("Donnees et Screeners"),
    bu("Bloomberg Terminal : Reference professionnelle (cout eleve)"),
    bu("Finviz : Screener actions americaines avec visualisation heatmap"),
    bu("Stock Analysis / Macrotrends : Donnees financieres historiques gratuites"),
    bu("CoinGecko / CoinMarketCap : Donnees crypto completes"),
    bu("Glassnode / Nansen : Donnees on-chain avancees pour l'analyse crypto"),
    h3("Calendriers Economiques et Actualites"),
    bu("Forex Factory : Calendrier economique complet avec forums de traders"),
    bu("Investing.com : Calendrier, actualites, donnees de marche en temps reel"),
    bu("Bloomberg / Reuters : Actualites financieres de reference"),
    bu("The Block / Coindesk : Actualites crypto de qualite"),
    h2("9.3 Formation et Developpement des Competences"),
    bu("Livres fondamentaux : Technical Analysis of the Financial Markets (Murphy), Trading in the Zone (Douglas), Market Wizards (Schwager)"),
    bu("Cours en ligne : Coursera (Finance), edX (Data Science for Finance), Udemy"),
    bu("YouTube : Chaines specialisees de traders professionnels"),
    bu("Communautes : Reddit (r/algotrading, r/Forex, r/stocks), Discord de trading"),
    bu("Papiers academiques : SSRN.com pour la recherche quantitative en finance"),
    h2("9.4 Fiscalite du Trading en 2026"),
    b("La fiscalite des revenus de trading est un aspect souvent neglige mais crucial. En France, les plus-values sur valeurs mobilieres sont soumises a la flat tax de 30% (12,8% d'impot sur le revenu + 17,2% de prelevements sociaux)."),
    h3("Structures et Vehicules Fiscaux"),
    bu("PEA (Plan d'Epargne en Actions) : Exoneration d'impot sur les plus-values apres 5 ans - limite aux actions et fonds europeens"),
    bu("CTO (Compte-Titres Ordinaire) : Le plus flexible mais soumis a la flat tax de 30%"),
    bu("Assurance-vie : Avantages fiscaux sur la duree, mais options d'investissement limitees"),
    tip("IMPORTANT : Les cryptomonnaies sont taxees a 30% (flat tax) en France depuis 2023. La tenue d'un registre precis de toutes les transactions est obligatoire. Utilisez des outils comme Koinly, CoinTracking, ou Waltio pour automatiser le suivi fiscal de vos transactions crypto."),

    // ── CONCLUSION ────────────────────────────────────────────────────────
    pb(),
    h1("Conclusion : Devenir un Trader Rentable"),
    hr(),
    b("Vous etes arrive a la fin de ce guide complet sur le trading en 2026. Vous disposez desormais d'une base solide couvrant tous les aspects essentiels : les fondamentaux des marches, l'analyse technique et fondamentale, le trading algorithmique et l'IA, la gestion du risque, la psychologie, et les strategies avancees."),
    h2("Les 10 Commandements du Trader Rentable"),
    bu("1. Preservez votre capital avant tout : La regle d'or. Sans capital, pas de trading."),
    bu("2. Tradez avec un edge defini : Ayez une raison precise et backtestee d'entrer chaque trade."),
    bu("3. Respectez votre plan de trading : L'improvisation est l'ennemi de la coherence."),
    bu("4. Gerez votre risque religieusement : Stop-loss, taille de position, drawdown maximum."),
    bu("5. Tenez un journal de trading : Votre progression depend de votre capacite d'auto-analyse."),
    bu("6. Continuez a apprendre : Les marches evoluent, vos connaissances doivent suivre."),
    bu("7. Controlez vos emotions : Le trading est un jeu de probabilites, pas d'emotions."),
    bu("8. Soyez patient : Attendez les vrais setups, ne tradez pas par ennui."),
    bu("9. Adaptez-vous : Une strategie qui marchait hier peut ne plus marcher demain."),
    bu("10. Prenez soin de vous : Sante physique et mentale sont la base de la performance."),
    sp(8),
    b("Le trading est l'un des rares domaines ou la performance depend autant des facteurs internes (psychologie, discipline) que des facteurs externes (strategie, marches). Les traders qui reussissent a long terme ne sont pas necessairement les plus brillants analystes, mais ceux qui ont developpe une maitrise de soi exceptionnelle."),
    b("En 2026, avec les outils technologiques disponibles, les opportunites sont nombreuses. Les marches crypto offrent une volatilite et une accessibilite uniques. L'IA democratise des capacites d'analyse autrefois reservees aux institutionnels. Les plateformes de trading sont plus accessibles, moins cheres, et plus fiables que jamais."),
    tip("MESSAGE FINAL : Commencez petit, apprenez beaucoup, risquez peu. Passez au moins 3-6 mois en paper trading (simulation) avant d'engager du capital reel. Puis debutez avec un capital que vous pouvez vous permettre de perdre integralement sans compromettre votre situation financiere."),
    b("Bonne chance dans votre parcours de trader. Que la discipline, la patience, et la gestion du risque soient vos compagnons constants sur ce chemin fascinant et exigeant."),

    // ── GLOSSAIRE ─────────────────────────────────────────────────────────
    pb(),
    h1("Glossaire : Termes Essentiels du Trading"),
    hr(),
    h3("A"),
    bu("Ask : Prix auquel un vendeur est pret a vendre un actif"),
    bu("ATH (All-Time High) : Plus haut historique d'un actif"),
    bu("ATR (Average True Range) : Mesure de la volatilite moyenne sur une periode"),
    h3("B"),
    bu("Backtest : Test d'une strategie sur des donnees historiques"),
    bu("Bear Market : Marche baissier (baisse de +20% depuis un sommet)"),
    bu("Bid : Prix auquel un acheteur est pret a acheter un actif"),
    bu("Bull Market : Marche haussier (hausse de +20% depuis un creux)"),
    h3("C"),
    bu("CFD (Contract for Difference) : Contrat sur la difference de prix d'un actif"),
    bu("Chandelier Japonais : Representation graphique du prix (OHLC)"),
    bu("Correlation : Degre de relation entre deux actifs"),
    h3("D"),
    bu("Day Trading : Ouverture et fermeture de positions dans la meme journee"),
    bu("DeFi (Decentralized Finance) : Finance decentralisee sur blockchain"),
    bu("Drawdown : Baisse d'un compte depuis son plus haut"),
    h3("E"),
    bu("Edge : Avantage statistique d'une strategie de trading"),
    bu("EMA (Exponential Moving Average) : Moyenne mobile exponentielle"),
    bu("ETF (Exchange Traded Fund) : Fonds indiciel cote en bourse"),
    bu("Effet de Levier : Amplification des gains et pertes via capital emprunte"),
    h3("F"),
    bu("Fibonacci : Niveaux de retracement (38,2%, 50%, 61,8%)"),
    bu("Flat Tax : Imposition forfaitaire de 30% sur les plus-values en France"),
    bu("Forex (Foreign Exchange) : Marche des changes internationaux"),
    bu("Funding Rate : Taux de financement des positions perpetual en crypto"),
    h3("G-H"),
    bu("Gap : Espace entre deux prix consecutifs"),
    bu("Hedge : Couverture d'une position pour reduire le risque"),
    bu("HFT (High Frequency Trading) : Trading a haute frequence en microsecondes"),
    h3("L"),
    bu("Liquidite : Facilite a acheter ou vendre un actif sans impacter son prix"),
    bu("Long : Position acheteuse, anticipant une hausse du prix"),
    h3("M"),
    bu("MACD : Indicateur de momentum base sur la convergence de moyennes mobiles"),
    bu("Margin Call : Appel de marge quand les fonds sont insuffisants"),
    bu("Market Cap : Capitalisation boursiere (prix x nombre d'actions/tokens)"),
    h3("O-P"),
    bu("Option : Droit (non obligation) d'acheter (call) ou vendre (put) un actif"),
    bu("Overtrading : Exces de trades, souvent par ennui ou vengeance"),
    bu("Pivot Point : Niveaux de support/resistance calcules a partir des donnees de la veille"),
    h3("R"),
    bu("Range : Marche evoluant lateralement entre support et resistance"),
    bu("RSI (Relative Strength Index) : Oscillateur mesurant la force relative des mouvements"),
    bu("Risk/Reward Ratio : Ratio entre le risque et le gain potentiel d'une trade"),
    h3("S"),
    bu("Scalping : Style de trading tres court terme (secondes a minutes)"),
    bu("Short : Position vendeuse, anticipant une baisse du prix"),
    bu("Short Squeeze : Hausse forcee provoquee par la fermeture de positions courtes"),
    bu("Slippage : Difference entre le prix attendu et le prix d'execution reel"),
    bu("Spread : Difference entre le Bid et l'Ask"),
    bu("Stop-Loss : Ordre automatique limitant la perte sur une position"),
    bu("Support : Niveau de prix ou l'achat est suffisamment fort pour bloquer la baisse"),
    bu("Swing Trading : Style de trading sur plusieurs jours a semaines"),
    h3("T-V"),
    bu("Take-Profit : Ordre automatique cloturant une position en profit"),
    bu("Trend Following : Strategie consistant a trader dans le sens de la tendance"),
    bu("TVL (Total Value Locked) : Valeur totale deposee dans un protocole DeFi"),
    bu("Volatilite : Amplitude des variations de prix"),
    bu("Volume : Nombre d'unites echangees sur une periode"),
    h3("W"),
    bu("Whale : Grand acteur du marche capable d'influencer les prix"),
    bu("Wyckoff Method : Methode d'analyse basee sur les cycles accumulation/distribution"),
    sp(20),
    b("Fin du document - Le Trading en 2026 - Guide Complet"),
  ];
}

// ─── Run ──────────────────────────────────────────────────────────────────────
const builder = new PDFBuilder();
const pdf = builder.build();
fs.writeFileSync(OUTPUT, pdf, 'binary');
const stats = fs.statSync(OUTPUT);
console.log(`E-book genere avec succes !`);
console.log(`Fichier : ${OUTPUT}`);
console.log(`Taille : ${(stats.size / 1024).toFixed(0)} KB`);
