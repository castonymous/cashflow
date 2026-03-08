const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
    
    await page.goto('http://localhost:8000/');
    console.log('Navigated to localhost:8000');
    
    // Check if app is defined
    const isAppDefined = await page.evaluate(() => typeof window.app !== 'undefined');
    console.log('Is window.app defined?', isAppDefined);
    
    await page.click('[data-target="assets"]');
    console.log('Clicked Assets');
    await page.waitForTimeout(500);
    
    await page.click('#btn-add-wallet');
    console.log('Clicked Add Wallet');
    await page.waitForTimeout(500);
    
    await page.fill('#wallet-name', 'Test');
    await page.fill('#wallet-balance', '100');
    console.log('Filled form');
    
    await page.click('#form-add-wallet button[type="submit"]');
    console.log('Clicked Submit');
    await page.waitForTimeout(1000);
    
    const walletsCount = await page.evaluate(() => document.querySelectorAll('#manage-wallets-list .list-item-card').length);
    console.log('Wallets visible count:', walletsCount);
    
    await browser.close();
})();
