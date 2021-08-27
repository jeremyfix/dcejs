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

module.exports = {
	check
}
