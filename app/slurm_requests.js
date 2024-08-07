const sshhandler = require('./sshhandler.js');

function check_nomachine(jobid) {
	// Check if there is a running nomachine
	
	// We also check if there is a port forward on the localhost
}

/*
 * Get the list of valid job ids
 */
async function list_allocation() {
	return sshhandler.execute_on_frontal(`squeue -u $LOGNAME | tail -n +2`)
		.then((data) => {
			// Split the allocations
			allocations_str = data.split('\n');
			// JOBID PARTITION     NAME     USER ST       TIME  NODES NODELIST(REASON)
			let allocations = [];
			allocations_str.forEach(allocstr => {
				if(allocstr != '') {
					allocstr = allocstr.trim();
					fields = allocstr.split(/\s+/);
					console.log(fields);
					jobprops = sshhandler.get_job_props(fields[0]);				
					let vncport = null;
					let nomachineport = null;
					let vscodeport = null;
					if(jobprops != null) {
						vncport = jobprops.vnc_port;
						nomachineport = jobprops.nomachine_port;
						vscodeport = jobprops.vscode_port;
						console.log(`Extracted the port : ${vscodeport}`);
					}
					allocations.push({
						jobid: fields[0],
						partition: fields[1],
						name: fields[2],
						user: fields[3], 
						status: fields[4],
						time: fields[5], 
						nodes: fields[6],
						nodelist: fields[7],
						vnc: vncport,
						nomachine: nomachineport,
						vscode: vscodeport
					});
				}
			});
			console.log(allocations);
			return new Promise((resolve, reject) => resolve(allocations));
		})
		.catch(error => {
			console.log(`Error while list_allocation : ${error}`);
		});
}

function get_slurm_cmd(options, epilogpath) {
	let slurm_cmd;
	slurm_cmd = 'srun ';

	console.log(`Slurm options : ${options} , path : ${epilogpath}`);

	if(options.minnodes != null)
		slurm_cmd += `-N ${options.minnodes} `;
	else
		slurm_cmd += `-N 1 `;
	if(options.gres != null)
		slurm_cmd += `--gres=${options.gres} `;
	if(options.qos != null)
		slurm_cmd += `--qos=${options.qos} `;
	if(options.constraint != null)
		slurm_cmd += `--constraint=${options.constraint} `;
	if(options.cpuspertask != null) 
		slurm_cmd += `--cpus-per-task=${options.cpuspertask} `;
	if(options.exclusive)
		slurm_cmd += '--exclusive ';
	if(options.ntasks != null) 
		slurm_cmd += `--ntasks=${options.ntasks} `;


	if(options.reservation != null) {
		slurm_cmd +=`--reservation ${options.reservation} `;
		if(options.walltime != '') {
			slurm_cmd += `-t ${options.walltime} `; 
		}
	}
	else {
		let partition = options.partition;
		// Remove a possibly trailing * used to indicate the default 
		// partition
		if(partition.endsWith("*"))
			partition = partition.replace(/\*+$/, "");
			
		slurm_cmd +=`-p ${partition} -t ${options.walltime} `;
	}

	if(epilogpath != null)
		slurm_cmd += `--epilog="${epilogpath}" `
	slurm_cmd += ` --pty bash^M`;
	return slurm_cmd;
}

module.exports = {list_allocation, get_slurm_cmd};
