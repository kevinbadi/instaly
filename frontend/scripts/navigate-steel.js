#!/usr/bin/env node

const puppeteer = require('puppeteer-core');

async function navigateToInstagram(sessionId, apiKey) {
  let browser;
  try {
    const wsEndpoint = `wss://connect.steel.dev?sessionId=${sessionId}&apiKey=${apiKey}`;
    
    console.error('Connecting to Steel browser...');
    browser = await puppeteer.connect({
      browserWSEndpoint: wsEndpoint,
    });

    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();

    // Set viewport to use more of the browser window (fixes the 25% issue)
    await page.setViewport({
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
    });

    // Set a realistic user agent to avoid 429
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.error('Navigating to Instagram...');
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait a bit for the page to fully render
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.error('Instagram loaded!');
    browser.disconnect();
    
    console.log(JSON.stringify({ success: true }));
    process.exit(0);
  } catch (error) {
    if (browser) {
      try { browser.disconnect(); } catch (e) {}
    }
    console.log(JSON.stringify({ success: false, error: error.message }));
    process.exit(1);
  }
}

const [sessionId, apiKey] = process.argv.slice(2);

if (!sessionId || !apiKey) {
  console.log(JSON.stringify({ success: false, error: 'Missing sessionId or apiKey' }));
  process.exit(1);
}

navigateToInstagram(sessionId, apiKey);
