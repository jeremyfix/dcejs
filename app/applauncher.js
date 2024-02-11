function launchx() {
	const jobid = parseInt(document.getElementById("jobid").innerHTML);
	window.api.send("startx", {
		jobid: jobid,
		// app: "VGL_DISPLAY=:10 vglrun glxgears"
		app: 'xterm'
	});
}

function startvnc() {
	const jobid = parseInt(document.getElementById("jobid").innerHTML);
	window.api.send("startvnc", {
		jobid: jobid
	});
}

// function startnomachine() {
// 	const jobid = parseInt(document.getElementById("jobid").innerHTML);
// 	window.api.send("startnomachine", {
// 		jobid: jobid
// 	});
// }
function startvscode() {
	const jobid = parseInt(document.getElementById("jobid").innerHTML);
	window.api.send("startvscode", {
		jobid: jobid
	});
}

function forwardport() {
	const jobid = parseInt(document.getElementById("jobid").innerHTML);
	window.api.send("get_forwardport", {
		jobid: jobid
	});
}

window.addEventListener('DOMContentLoaded', () => {
	let launchXBtn = document.getElementById('launchXBtn');
	launchXBtn.addEventListener('click', launchx);

	let startVNCBtn = document.getElementById('startVNCBtn');
	startVNCBtn.addEventListener('click', startvnc);

	// let startVSCodeBtn = document.getElementById('startNoMachineBtn');
	// startNoMachineBtn.addEventListener('click', startnomachine);

	let startVSCodeBtn = document.getElementById('startVSCodeBtn');
	startVSCodeBtn.addEventListener('click', startvscode);

	let portForwardBtn = document.getElementById('portForwardBtn');
	portForwardBtn.addEventListener('click', forwardport);
});

window.api.receive('jobinfo' , (event ,arg) => {
	document.getElementById("jobid").innerHTML = arg.jobid;
	document.getElementById("firstnode").innerHTML = arg.firstnode;
})
