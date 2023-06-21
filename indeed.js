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

const run = async (searchTerm) => {
  let browser;
  try {
    const auth = process.env.AUTH;
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.1.2 Safari/605.1.15',
    ];

    browser = await puppeteerExtra.launch({
      headless: true,
      browserWSEndpoint: `ws://${auth}@brd.superproxy.io:9222`,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    await page.setUserAgent(randomUserAgent);

    await page.setCookie({
      name: 'cookieName',
      value: 'cookieValue',
      url: 'https://www.indeed.com',
    });

    page.setDefaultNavigationTimeout(120000);

    let jobDetails = [];
    let start = 0;
    let totalJobCards = 0;
    let hasNextPage = true;

    console.log('Scraping started...');

    while (hasNextPage && totalJobCards < maxJobCards) {
      let url = `https://www.indeed.com/jobs?q=${encodeURIComponent(searchTerm)}&start=${start}`;

      console.log('Page URL:', url);

      await page.goto(url, { waitUntil: 'domcontentloaded' });
      console.log('Page loaded');

      await page.waitForTimeout(1000);

      await autoScroll(page);
      console.log('Page scrolled');

      await page.waitForTimeout(1000);

      const jobCardHTMLs = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.job_seen_beacon')).map((el) => el.outerHTML)
      );

      console.log('Job card HTMLs:', jobCardHTMLs.length);

      if (totalJobCards + jobCardHTMLs.length > maxJobCards) {
        jobCardHTMLs.splice(maxJobCards - totalJobCards);
      }

      jobDetails.push(
        ...jobCardHTMLs.map((html) => {
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
        })
      );

      totalJobCards += jobCardHTMLs.length;
      console.log('Total job cards:', totalJobCards);

      hasNextPage = await page.evaluate(() => !!document.querySelector('[aria-label="Next Page"]'));
      start += 10;

      console.log(`Scraped ${totalJobCards} job cards...`);
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

run('Computer');
