const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const csvWriter = createCsvWriter({
  path: 'result.csv',
  header: [
    {id: 'collection_url', title: 'Scrapped URL'},
    {id: 'collection_name', title: 'Collection Name'},
    {id: 'item_count', title: 'Item Count'},
    {id: 'owner_count', title: 'Owner Count'},
    {id: 'floor_price', title: 'Floor Price'},
    {id: 'volume_traded', title: 'Volume Traded'},
    {id: 'collection_description', title: 'Collection Description'},
    {id: 'website_url', title: 'Website URL'},
    {id: 'discord_url', title: 'Discord URL'},
    {id: 'twitter_url', title: 'Twitter URL'},
    {id: 'instagram_url', title: 'Instagram URL'},
  ]
});

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const scraperObject = {
	xml_url: 'https://openseauserdata.com/sitemap-collections-0.xml',
	fullItems: [],
	totalHeight: 0,
	distance: 100,
	height: 0,
	totalCount: 0,
	async scraper(browser){
		this.totalCount = 0;
		let page = await browser.newPage();
		console.log(`Navigating to ${this.xml_url}...`);
		await page.setDefaultNavigationTimeout(0);
		await page.goto(this.xml_url);
		// Wait for the required DOM to be rendered
		await page.waitForSelector('div[class="folder"]');
		
		let pagePromise = (link) => {
			return new Promise(async(resolve, reject) => {
				let dataObj = {};
				let newPage = await browser.newPage();
				await newPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.67 Safari/537.36');
				await newPage.goto(link, { waitUntil: 'networkidle2' });
				await newPage.waitForFunction('document.querySelector("body")');

				dataObj['collection_name'] = await newPage.$eval('h1', elem => elem.innerText);
				if (dataObj['collection_name'] == 'This page is lost.') {
					resolve({
						...dataObj,
						item_count: '',
						collection_url: link,
						owner_count: '',
						floor_price: '',
						volume_traded: '',
						collection_description: '',
						website_url: '',
						discord_url: '',
						twitter_url: '',
						instagram_url: '',
					});
					await newPage.close();
					return;
				}
				const collection_info = await newPage.$$eval('.CollectionStatsBar--info', elems => { return elems.map(elem => elem.querySelector('span').innerText) });
				dataObj['item_count'] = collection_info[0];
				dataObj['owner_count'] = collection_info[1];
				dataObj['floor_price'] = collection_info[2];
				dataObj['volume_traded'] = collection_info[3];
				dataObj['collection_description'] = await newPage.$eval('.CollectionHeader--description', elem => elem.querySelector('span') ? elem.querySelector('span').innerText : '');
				const social_links = await newPage.$eval('#main .fresnel-container', elem => {
					links = elem.querySelector('a');
					let information = {
						website_url: '',
						discord_url: '',
						twitter_url: '',
						instagram_url: '',
					};
					if (links && links.length > 0) {
						for (let i = 0; i < links.length; i++) {
							const el = links[i];
							if (el['aria-label'].indexOf('Website') > -1) {
								information['website_url'] = el.href;
							} else if (el['aria-label'].indexOf('Discord') > -1) {
								information['discord_url'] = el.href;
							} else if (el['aria-label'].indexOf('Twitter') > -1) {
								information['twitter_url'] = el.href;
							} else if (el['aria-label'].indexOf('Instagram') > -1) {
								information['instagram_url'] = el.href;
							}
						}
					}
					return information;
				});
				dataObj = {...dataObj, ...social_links};
				resolve(dataObj);
				await newPage.close();
			});
		};

		let getItems = async () => {
			let asserts = await page.$$eval('.folder', (items) => {
				items = items.map((el, ind) => {
					if (ind > 0) {
						if (el.querySelector('.opened .folder .opened .line:first-child span:nth-child(2)')) {
							let collection_url = el.querySelector('.opened .folder .opened .line:first-child span:nth-child(2)').innerText;
							return {
								collection_url,
							}
						} else {
							return null;
						}	
					} else {
						return null;
					}
				});
				return items.filter((el) => {
					return el !== null && typeof el !== 'undefined';
				});
			});
			console.log(asserts);
			let filtered = asserts;
			for (let i = 0; i < filtered.length; i++) {
				if (filtered[i] && filtered[i].collection_url) {
					const info = await pagePromise(filtered[i].collection_url);
					this.fullItems.push(info);
					if (i % 10 === 0) {
						await csvWriter
								.writeRecords(this.fullItems);
					}
					console.log('Scrapped ' + (this.fullItems.length + 1) + ' collections now');
				}
			}
		}

		let scrapeData = async () => {
			await getItems();
			await csvWriter
					.writeRecords(this.fullItems);
		};

		scrapeData();
	},
}

module.exports = scraperObject;