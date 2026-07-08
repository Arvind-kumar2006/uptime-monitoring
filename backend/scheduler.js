const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const cron = require('node-cron');
const db = require('./db');

const CHECK_TIMEOUT_MS = 10_000;
let browser;

async function initBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('Puppeteer stealth browser initialized.');
  }
}

const insertCheck = db.prepare(`
  INSERT INTO checks (url_id, status_code, response_time_ms, is_up)
  VALUES (@url_id, @status_code, @response_time_ms, @is_up)
`);

async function pingUrl(row, io) {
  const start = Date.now();
  let page;
  
  try {
    if (!browser) await initBrowser();
    page = await browser.newPage();
    const res = await page.goto(row.url, { timeout: CHECK_TIMEOUT_MS, waitUntil: 'domcontentloaded' });
    const responseTime = Date.now() - start;
    const status = res ? res.status() : 500;
    
    insertCheck.run({
      url_id: row.id,
      status_code: status,
      response_time_ms: responseTime,
      is_up: status >= 200 && status < 400 ? 1 : 0,
    });
    if (io) io.emit('status_update');
  } catch (err) {
    const responseTime = Date.now() - start;
    insertCheck.run({
      url_id: row.id,
      status_code: null,
      response_time_ms: responseTime,
      is_up: 0,
    });
    if (io) io.emit('status_update');
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

async function checkAllUrls(io) {
  const urls = db.prepare('SELECT id, url FROM urls').all();
  await Promise.all(urls.map(row => pingUrl(row, io)));
}

async function startScheduler(io) {
  await initBrowser();
  checkAllUrls(io).catch((e) => console.error('Initial check run failed:', e));

  cron.schedule('* * * * *', () => {
    checkAllUrls(io).catch((e) => console.error('Scheduled check run failed:', e));
  });

  console.log('Scheduler started: pinging all monitored URLs every 60s');
}

module.exports = { startScheduler, checkAllUrls, pingUrl };
