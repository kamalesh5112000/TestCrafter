const puppeteer = require("puppeteer");

const activeBrowsers = {}; // Store browser instances by userId

exports.launchBrowser = async (req, res) => {
    const { url } = req.body;
    const userId = Date.now().toString(); // Generate a unique user ID

    if (activeBrowsers[userId]) {
        return res.json({ message: "Browser already launched", userId });
    }

    try {
        const browser = await puppeteer.launch({ headless: false });
        const page = await browser.newPage();
        await page.goto(url);

        activeBrowsers[userId] = { browser, page };
        
        res.json({ message: "Browser launched successfully", userId });
    } catch (error) {
        res.status(500).json({ error: "Failed to launch browser" });
    }
};

exports.startRecording = async (req, res) => {
    const { userId, url } = req.body;

    if (!activeBrowsers[userId]) {
        return res.status(404).json({ error: "Browser not launched" });
    }

    try {
        const browser = activeBrowsers[userId].browser;
        const page = await browser.newPage();

        await page.setRequestInterception(true);

        page.on("request", (request) => {
            if (request.isNavigationRequest()) {
                console.log("User navigated to:", request.url());
                activeBrowsers[userId].currentURL = request.url(); // Store new URL
            }
            request.continue();
        });

        await page.goto(url);
        activeBrowsers[userId].page = page;
        activeBrowsers[userId].currentURL = url; // Store initial URL

        res.json({ message: "Recording started" });
    } catch (error) {
        res.status(500).json({ error: "Failed to start recording" });
    }
};


exports.stopRecording = async (req, res) => {
    const { userId } = req.body;

    if (!activeBrowsers[userId]) {
        return res.status(404).json({ error: "No active session" });
    }

    try {
        const page = activeBrowsers[userId].page;
        const recordedInteractions = await page.evaluate(() => window.recordedInteractions || []);
        console.log("Recorded Interactions:", recordedInteractions); // Log interactions
        activeBrowsers[userId].interactions = recordedInteractions;

        await activeBrowsers[userId].browser.close();
        delete activeBrowsers[userId];

        res.json({ message: "Recording stopped and browser closed", interactions: recordedInteractions });
    } catch (error) {
        res.status(500).json({ error: "Failed to stop recording" });
    }
};


exports.getProxyPage = async (req, res) => {
    const { userId } = req.params;

    if (!activeBrowsers[userId] || !activeBrowsers[userId].page) {
        return res.status(404).send("Session not found");
    }

    try {
        const page = activeBrowsers[userId].page;
        const content = await page.evaluate(() => document.documentElement.outerHTML);

        res.send(content); // Send full HTML to display in the iframe
    } catch (error) {
        res.status(500).send("Error loading page");
    }
};

exports.getCurrentURL = (req, res) => {
    const { userId } = req.params;

    if (!activeBrowsers[userId]) {
        return res.status(404).json({ error: "Session not found" });
    }

    res.json({ url: activeBrowsers[userId].currentURL || null });
};

exports.getRecordedInteractions = async (req, res) => {
    const { userId } = req.params;

    if (!activeBrowsers[userId] || !activeBrowsers[userId].page) {
        return res.status(404).json({ error: "Session not found" });
    }

    try {
        const page = activeBrowsers[userId].page;
        const interactions = await page.evaluate(() => window.recordedInteractions || []);
        res.json(interactions);
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve interactions" });
    }
};
