const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');
const Papa = require('papaparse');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const puppeteerExtra = require('puppeteer-extra');
const dotenv = require('dotenv');
dotenv.config();
puppeteerExtra.use(StealthPlugin());

const maxJobCards = 150;

const autoScroll = async (page) => {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
};

const scrapePage = async (browser, url, userAgent) => {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if(req.resourceType() === 'font' || req.resourceType() === 'image' || req.resourceType() === 'stylesheet'){
      req.abort();
    } else {
      req.continue();
    }
  });
  await page.setUserAgent(userAgent);
  await page.setCookie({ name: 'cookieName', value: 'cookieValue', url: 'https://www.indeed.com' });
  page.setDefaultNavigationTimeout(120000);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await autoScroll(page);
  const jobCardHTMLs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.job_seen_beacon')).map((el) => el.outerHTML)
  );

  const jobDetails = jobCardHTMLs.map((html) => {
    const $ = cheerio.load(html);
    return {
      title: $('h2.jobTitle span').attr('title'),
      company: $('.companyName').text(),
      location: $('.companyLocation').text(),
      estimatedSalary: $('.estimated-salary span').last().text(),
      jobType: $('.attribute_snippet').text(),
      description: $('.job-snippet ul li').map((i, el) => $(el).text()).get().join(' '),
      datePosted: $('.date').text(),
      link: 'https://www.indeed.com' + $('a.jcs-JobTitle').attr('href'),
    };
  });

  await page.close();

  return jobDetails;
};

const run = async (searchTerm) => {
  let browser;
  try {
    const auth = process.env.AUTH;
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Safari/605.1.15',
    ];

    browser = await puppeteer.launch({
      headless: true,
      browserWSEndpoint: `ws://${auth}@brd.superproxy.io:9222`,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

    let jobDetails = [];
    let start = 0;
    let totalJobCards = 0;
    let hasNextPage = true;

    console.log('Scraping started...');

    while (hasNextPage && totalJobCards < maxJobCards) {
      let tasks = [];
      for(let i = 0; i < 7; i++){
        let url = `https://www.indeed.com/jobs?q=${encodeURIComponent(searchTerm)}&start=${start + i*15}`;
        tasks.push(scrapePage(browser, url, randomUserAgent));
      }

      let results = await Promise.all(tasks);
      jobDetails.push(...results.flat());

      totalJobCards += results.reduce((sum, res) => sum + res.length, 0);
      start += 15 * tasks.length;

      console.log(`Scraped ${totalJobCards} job cards...`);

      hasNextPage = results.some(res => !!res.length); // if any page has results, there is a next page
    }

    await fs.promises.writeFile('job_details.json', JSON.stringify(jobDetails, null, 2));
    const csv = jobDetails.map((job) => ({
      Title: job.title,
      Company: job.company,
      Location: job.location,
      'Estimated Salary': job.estimatedSalary,
      'Job Type': job.jobType,
      Description: job.description,
      'Date Posted': job.datePosted,
      Link: job.link,
    }));
    const csvContent = Papa.unparse(csv);
    await fs.promises.writeFile('job_details.csv', csvContent);

    console.log('Scraping completed successfully.');
  } catch (e) {
    console.error('Scrape Failed', e);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

const searchTerm = process.argv[2] || 'Computer';
run(searchTerm);
