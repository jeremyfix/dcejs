let jsonpath;
let parser;

if(process.platform === 'darwin') {
	jsonpath = require('jsonpath');
	parser = require('xml2json');
}
const path = require('path');
const { spawn } = require('child_process');

const sshhandler = require('./sshhandler.js');
const screen = require('./screen.js');

const logdirectory="~/.cscluster/"
const patience_max = 20;

// Check if VNC is running on the compute node
// Returns true/false
function check(jobid) {

	return new Promise((resolve, reject) => {
		get_ports(jobid)
			.then(vncports => {
				console.log(`Available ports : ${vncports}`);
				resolve(vncports.length > 0);
			})
			.catch(error => {
				reject(error);
			})
	});
}

// Returns the port of the vnc running server
// Returns a Promise
function get_ports(jobid, attempts=2) {
	const cmd = 'vncserver -list -cleanstale 2>/dev/null | tail -n +5 | awk \'{print \\\\\\$1,\\\\\\$2}\'';

	return screen.run_in_screen(cmd, jobid)
		.then((stds) => {
			let vnc_sessions = stds.stdout.trim().split('\n');
			let vnc_ports = [];
			console.log(`VNC sessions output : '${vnc_sessions}'`);
			vnc_sessions.forEach(elem => {
				if(elem == '')
					return;
				const elems = elem.split(" ");
				const portstr = elems[0].substring(1);
				console.log(`VNC elems : '${elems}', portstr ${portstr}`);

				const port = parseInt(portstr);
				// For some reasons my command above may
				// redirect TigerVNC server, ,X DISPLAY   into portstr
				// which should not happen because of the tail -n + 5!!
				if(isNaN(port)) {
					console.log('Not a valid port ' + portstr);
					throw "Invalid port!";
				}

				vnc_ports.push(5900 + port);
			});
			return vnc_ports;
		})
		.catch(error => {
			// This is a weird hack ..
			// because of the comment above of getting some stdout
			// while it should be filtered by tail
			if(attempts == 0)
				throw error;
			console.log('One more attempt');
			return get_ports(jobid, attempts-1);
		});
}

// Starts VNC on the remote
// Returns a Promise
function start(jobid) {
	// Check if the file Xstartup exists on the remote, otherwise create one
	let cmd = "if [ ! -f ~/.vnc/xstartup ]; then if [ -f /etc/vnc/xstartup ]; then mkdir -p ~/.vnc; ln -s /etc/vnc/xstartup ~/.vnc/xstartup; echo 0; else echo 1; fi; else echo 0; fi";
	return screen.run_in_screen(cmd, jobid)
		.then(stds => {
			if(stds.stdout == "0") {
				return new Promise((resolve, reject) => { resolve(); });
			}
			throw "The xstartup file does not exist";
		})
		.then(() => {
			const cmd = "vncserver -SecurityTypes None -depth 32 -geometry 1680x1050 -cleanstale";
			//TODO: check if return stderr is not empty ?
			return screen.run_in_screen(cmd, jobid);
		});
}

function find_vncviewer() {
	return new Promise((resolve, reject) => {
		const platform = process.platform;
		let pathtoprog = null;
		if(platform == 'linux') {
			resolve('/usr/bin/vncviewer');
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
				reject(`Error when looking for vnc : ${data}`);
			});

			sp.stdout.on('end', () => {
				profile = parser.toJson(profile, {object: true});	
				const entries = jsonpath
					.query(profile, 'plist.array.dict.array[1].dict[*]');
				entries.forEach(elem => {
					if(elem.string[0].match(/^TigerVNC/g)) 
						pathtoprog = elem.string[4];
				});
				if(pathtoprog == null) {
					reject('VNCViewer not available');
					return;
				}

				pathtoprog = pathtoprog.replace(/\s/g, ' \\');
				pathtoprog = path.join(pathtoprog, 'Contents', 'MacOS', 'TigerVNC\\ Viewer');
				resolve(pathtoprog);
			});
		}
		else if(platform == 'win32') {
			const cmd = 'where';
			const options = ['vncviewer.exe'];
			const sp = spawn(cmd, options);

			let pathtovnc = '';
			sp.stdout.on('data', data => {
				pathtovnc += data;
			});
			sp.stderr.on('data', data => {
				reject('vncviewer.exe not found on windows');
			});

			sp.stdout.on('end', () => {
				console.log(`Found vncviewer at ${pathtovnc}`);
				resolve(pathtovnc);
			});
		}
		else {
			reject('VNCViewer not available');
		}
	});
}


module.exports = {
	check,
	get_ports,
	start,
	find_vncviewer
}
