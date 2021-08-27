
function kill() {
	const jobid = parseInt(document.getElementById("jobid").innerHTML);
	window.api.send("kill", {
		jobid: jobid
	});
}

function launchx() {
	const jobid = parseInt(document.getElementById("jobid").innerHTML);
	window.api.send("startx", {
		jobid: jobid,
		// app: "VGL_DISPLAY=:10 vglrun glxgears"
		app: 'xeyes'
	});
}

function startvnc() {
	const jobid = parseInt(document.getElementById("jobid").innerHTML);
	window.api.send("startvnc", {
		jobid: jobid
	});
}

function startnomachine() {
	const jobid = parseInt(document.getElementById("jobid").innerHTML);
	window.api.send("startnomachine", {
		jobid: jobid
	});
}

window.addEventListener('DOMContentLoaded', () => {
	let killBtn = document.getElementById('killBtn');
	killBtn.addEventListener('click', kill);

	let launchXBtn = document.getElementById('launchXBtn');
	launchXBtn.addEventListener('click', launchx);

	let startVNCBtn = document.getElementById('startVNCBtn');
	startVNCBtn.addEventListener('click', startvnc);

	let startNoMachineBtn = document.getElementById('startNoMachineBtn');
	startNoMachineBtn.addEventListener('click', startnomachine);
});

window.api.receive('jobinfo' , (event ,arg) => {
	document.getElementById("jobid").innerHTML = arg.jobid;
	document.getElementById("firstnode").innerHTML = arg.firstnode;
})
