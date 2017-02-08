const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const fs = require('fs');
const request = require('request');
const cheerio = require('cheerio');
const del = require('del');
let cancel = false;
let base = '';
let titleSel = '';
let textSel = '';
let proxy = '';

function scrape(idx, ext, io) {
	const url = base + idx + ext;
	const reqUrl = (proxy && proxy != '') ? { 'url': url, 'proxy': proxy } : url;
	request(reqUrl, (error, response, html) => {
		if (!error) {
			let $ = cheerio.load(html);
			let title, text;
			let json = {
				title: '',
				text: ''
			};

			$(titleSel).filter((index, node) => {
				let data = $(node);
				title = data.html();
				json.title = title;
			})

			$(textSel).filter((index, node) => {
				let data = $(node);
				text = data.html();
				json.text = text;
			})

			fs.writeFile('tmp/' + idx, '<h2>' + json.title + '</h2><br><br>' + json.text + '<br><br>', (err) => {
				if (err) {
					io.emit('status', { message: 'ERROR ' + url + '\r\n' + err.stack + '\n' });
				} else{
					io.emit('status', { message: '[' + url + '] finished.\n' });
				}
			})
		} else {
			io.emit('status', { message: 'ERROR ' + url + '\r\n' + error.stack + '\n' });
			console.error('ERROR:' + url + '\r\n' + error.stack);
		}
	});
}

function concat() {
	const output = __dirname + '/tmp';
	del(['output.html']).then(paths => {
		fs.readdir(output, (err, files) => {
			if (err) throw err;
			files.forEach(file => {
				fs.appendFileSync('output.html', fs.readFileSync(output + '/' + file, 'utf8'), 'utf8');
			});
		});
	});
}

io.on('connection', (socket) => {
	io.emit('status', { message: 'Ready... \n' });

	socket.on('cancel', () => {
		io.emit('status', { message: 'Scraper STOPPED by request!\n' });
		cancel = true;
	});

	socket.on('scrape', (data) => {
		// do your thing
		cancel = false;
		io.emit('status', { message: 'Scrapping...\n' });
		if (data && data.base && data.title && data.text && data.start && data.end) {
			let idx = data.start;
			base = data.base;
			proxy = data.proxy;
			titleSel = data.title;
			textSel = data.text;
			let i = setInterval(() => {
				try {
					scrape(idx, data.ext, io);
				} catch (err) {
					console.error(err);
					io.emit('status', { message: err.stack + '\n' });
				}
				if (idx == data.end || cancel) {
					clearInterval(i);
					setTimeout(() => {
						concat();
						io.emit('alert', { message: 'Finished total ' + (idx - data.start) + ' chapters \n' });
					}, 5000);
				}
				idx++;
			}, 3000);
		} else {
			io.emit('status', { message: 'Missing some parameters :(\n' });
		}
	});
});

app.get('/', (req, res) => {
	res.sendFile(__dirname + '/index.html');
});

app.get('/download', (req, res) => {
	res.sendFile(__dirname + '/output.html');
});

app.use('/lib', express.static('node_modules'));

server.listen('8080');

exports = module.exports = app;
