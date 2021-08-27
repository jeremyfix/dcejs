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
					if(jobprops != null) {
						vncport = jobprops.vnc_port;
						// nomachineport = jobprops.nomachine_port;
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
						nomachine: null
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

module.exports = {list_allocation};
