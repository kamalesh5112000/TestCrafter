const puppeteer = require('puppeteer');

puppeteer.launch()
    .then(browser => {
        console.log("Puppeteer works!");
        return browser.close();
    })
    .catch(err => console.error("Puppeteer Error:", err));
