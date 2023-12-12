const screen = require('./screen.js');

// Starts VSCode on the remote
// if vscode server was running, this will not trigger a new session
// Returns a Promise
function start(jobid) {
	// Runs vs code:
	// - without authentication
	let cmd = "code-server --auth none \&"
	return screen.run_in_screen(cmd, jobid)
		.then(stds => {
			return new Promise((resolve, reject) => { resolve(); });
		});
}

module.exports = {
	start
}
