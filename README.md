## Indeed Scraper

Indeed Scraper is a powerful web scraping program designed to extract job details from Indeed.com. It utilizes Puppeteer for web scraping and Cheerio for HTML parsing.

## Prerequisites

Before using this program, you need to have the following:

- Node.js installed on your machine
- A Scraping Browser authentication from Bright Data

## Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>

2. Navigate to the project directory:

    cd IndeedScraper

3. Install the dependencies:

    npm install

## Usage

1. Obtain a Scraping Browser authentication string from Bright Data. This will be used to authenticate your requests to Indeed.com.

2. Create a .env file in the root directory of the project and add the following line, replacing your-authentication-string with your actual authentication string:

    AUTH=your-authentication-string

3. Run the program with the desired search term:
    
    node indeed.js `<search-term>`
        
    Replace `<search-term>` with the term you want to search for, such as "Computer Science" or "Data Analyst".

4. The program will scrape Indeed.com for job details based on your search term and save the results as `job_details.json` and `job_details.csv` in the project directory.

## Contributing

Contributions are welcome! If you find any issues or want to add new features, feel free to open a pull request.

## License

This project is licensed under the MIT License.

Please replace `<repository-url>` with the actual URL of your Git repository.