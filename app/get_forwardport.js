function port_forward() {
	const jobid = parseInt(document.getElementById("jobid").innerHTML);
	const port = parseInt(document.getElementById('port').value);

	window.api.send("forwardport", {
		jobid: jobid,
		port: port
	});
}

window.addEventListener('DOMContentLoaded', () => {
	let okBtn = document.getElementById('portForwardBtn');
	okBtn.addEventListener('click', port_forward);
})

window.api.receive('jobinfo' , (event ,arg) => {
	document.getElementById("jobid").innerHTML = arg.jobid;
	document.getElementById("firstnode").innerHTML = arg.firstnode;
})
