const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  const htmlPath = path.resolve(__dirname, 'digital-marketing-2026.html');

  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0', timeout: 60000 });

  // Wait for animations to settle
  await new Promise(r => setTimeout(r, 2000));

  await page.pdf({
    path: 'digital-marketing-2026.pdf',
    format: 'A4',
    printBackground: true,
    margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    preferCSSPageSize: false
  });

  console.log('PDF generated: digital-marketing-2026.pdf');
  await browser.close();
})();
