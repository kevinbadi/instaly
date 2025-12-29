#!/usr/bin/env node

const puppeteer = require('puppeteer-core');

async function navigateToInstagram(sessionId, apiKey) {
  try {
    const wsEndpoint = `wss://connect.steel.dev?sessionId=${sessionId}&apiKey=${apiKey}`;
    
    console.error('Connecting to Steel browser...');
    const browser = await puppeteer.connect({
      browserWSEndpoint: wsEndpoint,
    });

    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();

    console.error('Navigating to Instagram...');
    await page.goto('https://www.instagram.com/accounts/login/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    console.error('Instagram loaded!');
    browser.disconnect();
    
    console.log(JSON.stringify({ success: true }));
    process.exit(0);
  } catch (error) {
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

