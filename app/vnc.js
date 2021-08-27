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
	const cmd = "vncserver -SecurityTypes None -depth 32 -geometry 1680x1050 -cleanstale";
	return screen.run_in_screen(cmd, jobid);
}

module.exports = {
	check,
	get_ports,
	start
}
