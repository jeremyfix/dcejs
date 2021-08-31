let jsonpath;
let parser;

if(process.platform === 'darwin') {
	jsonpath = require('jsonpath');
	parser = require('xml2json');
}
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const sshhandler = require('./sshhandler.js');
const screen = require('./screen.js');

const logdirectory="~/.cscluster/"
const patience_max = 20;

// On our servers, NoMachine is automatically started 
// on specific partitions. Therefore, we do not need to start it
// but just check if the service is running

// Check if nxserver is running
//TODO and we are allowed to connect to it ?
function check(jobid) {
	const cmd = 'systemctl is-active nxserver';
	return screen.run_in_screen(cmd, jobid)
		.then((stds) => {
			return stds.stdout.trim() == 'active';
		});
}

function find_nomachine() {
	return new Promise((resolve, reject) => {
		const platform = process.platform;
		let pathtoprog = null;
		if(platform == 'linux') {
			resolve('/usr/NX/bin/nxplayer');
		}
		else if(platform == 'darwin') {
			const cmd = 'system_profiler';
			const options = [
				'-xml', 'SPApplicationsDataType'
			];
			let profile = '';
			const sp = spawn(cmd, options);
			sp.stdout.on('data', data => {
				profile += data;
			});
			sp.stderr.on('data', data => {
				reject(`Error when looking for nomachine : ${data}`);
			});

			sp.stdout.on('end', () => {
				profile = parser.toJson(profile, {object: true});	
				const entries = jsonpath
					.query(profile, '$..dict[?(@.string[0]=="NoMachine")]');
				if(entries.length == 0)
					reject('NoMachine not available');
				const entry = entries[0].string[4].replace(/\s/g, ' \\');
				resolve(path.join(entry, 'Contents', 'MacOS' ,'nxplayer'));
			});
		}
		else {
			reject('NoMachine not available');
		}
	});
}

module.exports = {
	check,
	find_nomachine
}
