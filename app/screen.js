const sshhandler = require('./sshhandler.js');

const basic_screen_name = "defaultclustersession";
const default_screen_name = "clustersession"; 
const logdirectory="~/.cscluster/"

function get_screen_name(jobid=null) {
	if(jobid == null) {
		return basic_screen_name;
	}
	else
		return `${default_screen_name}-${jobid}`;
}

function get_stdfiles(jobid) {
	return {
		stdout: `${logdirectory}/stdout-${jobid}`,
		stderr: `${logdirectory}/stderr-${jobid}`,
	} 
}

async function run_in_screen(cmd, jobid) {
	// We run a command and redirect its stdout and stderr into logfiles
	// that are initially removed
	// Then we cat the content of these files
	// There should not be conflicting commands as this is called from the 
	// main process and not any renderers
	const patience_max = 20;
	const stdfiles = get_stdfiles(jobid);
	return new Promise((resolve, reject) =>  {
		const runcmd = `rm -f ${stdfiles.stdout} ${stdfiles.stderr}` + "&& sync && screen -S " + get_screen_name(jobid) +" -X stuff \""+ cmd +` 2> ${stdfiles.stderr} 1> ${stdfiles.stdout} && sync^M\"`;
		console.log(`Running ${runcmd}`);
		sshhandler.execute_on_frontal(runcmd)
			.then(async () => {
				// We wait for the two files to be created	
				const stdout = await sshhandler.read_file(stdfiles.stdout, patience_max);
				const stderr = await sshhandler.read_file(stdfiles.stderr, patience_max);
				// Cleanup the temp files
				const cleancmd = `rm -f ${stdfiles.stdout} ${stdfiles.stderr} && sync`;
				await sshhandler.execute_on_frontal(cleancmd);

				resolve({
					stdout: stdout,
					stderr: stderr
				});

			})
			.catch(error => {
				console.log(`Got an error while running command in screen : ${error}`);
				reject(error);
			})

	});
}


module.exports = {
	get_screen_name,
	run_in_screen
}
