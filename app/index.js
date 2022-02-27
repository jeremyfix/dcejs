function connect() {
	let login = document.getElementById('cluster-login').value;
	if(login == "") // Skip if the field is not given
		return;
	let gateway = document.getElementById('cluster-gateway').value;

	window.api.send("connect", {
		"login": login,
		"gateway": gateway
	});
}

function disconnect() {
	// Request the main process to disconnect
	window.api.send("disconnect", {});
}

window.api.receive('app-version', (event, arg) => {
	document.getElementById("app-version").innerHTML = "v" + arg;
});

window.api.receive('logger', (event, arg) => {
	document.getElementById("logger").innerHTML = arg;
})

window.api.receive('progress', (event, arg) => {
	const progress = arg.progress;
	const type = arg.type;
	if((arg < 0) || (arg > 100))
		return;
	document.getElementById("progressBar").style.width = `${progress}%`;

	if(type == "success") {
		document.getElementById("progressBar").style.backgroundColor = "rgb(44,160,44)";
		
	}
	else if(type == "failure") {
		document.getElementById("progressBar").style.backgroundColor = "rgb(214,39,40)";
	}
})

function start_app(application, params) {
	window.api.send('start_app', {
		application: application,
		params: params
	});
} 

function show_app(jobid, firstnode) {
	window.api.send('show_app', {
		jobid: jobid,
		firstnode: firstnode
	});
}

window.api.receive("refresh-sessions", (event, arg) => {
	let newbody = '';
	const platform = arg.platform;
	const startappcls_vnc = ((platform == 'linux') || (platform == 'darwin')) ? 'startapp' : '';
	const startappcls_nomachine = ((platform == 'linux') || (platform == 'darwin')) ? 'startapp' : '';
	arg.sessions.forEach(elem => {
		let firstnode = elem.nodelist;
		if(/^\w*\[\d*-\d*\]$/.test(firstnode)) {
			// We have a group of node, we extract the first node
			const elems = firstnode.split(/(\w+)\[(\d+)-(\d+)\]/);
			// For some reasons, this outputs :
			// [ '', 'kyle', '01', '04', ''  ]
			// for "kyle[01-04]".split(/(\w+)\[(\d+)-(\d+)\]/)
			firstnode = elems[1] + elems[2];
		}
		newbody += `<tr class="trjobids" id="${elem.jobid},${firstnode}">`;
		newbody += `<td>${elem.jobid}</td>`;
		newbody += `<td>${elem.partition}</td>`;
		newbody += `<td>${elem.time}</td>`;
		newbody += `<td>${elem.nodelist}</td>`;
		if(elem.vnc != null)
			newbody += `<td class="${startappcls_vnc}" id="vnc">localhost:${elem.vnc}</td>`;
		else
			newbody += `<td>--</td>`;
		if(elem.nomachine != null) 
			newbody += `<td class="${startappcls_nomachine}" id="nomachine">localhost:${elem.nomachine}</td>`;
		else
			newbody += `<td>--</td>`;
		let enabled_button = '';
		if(elem.time == 'INVALID')
			enabled_button = ' disabled '
		newbody += `<td><button class="appstart" id="${elem.jobid},${firstnode}" ${enabled_button}><span class="apps">&#9881;</span>Actions</button></td>`;
		newbody += "</tr>";
	});
	let table = document.getElementById("table-sessions");
	table.innerHTML = newbody;

	document.querySelectorAll("button.appstart").forEach(elem => {
		elem.addEventListener('click', () => { 
			const elems = elem.id.split(',');
			show_app(elems[0], elems[1]); 
		});
	});

	document.querySelectorAll("td.startapp").forEach(elem => {
		elem.addEventListener('click', () => { 
			start_app(elem.id,  {
				user: document.getElementById('cluster-login').value,
				hostport: elem.innerHTML
			}); 
		});
		
	});
	
});

window.addEventListener('DOMContentLoaded', () => {
	let connectBtn = document.getElementById('connectBtn');
	connectBtn.addEventListener('click', function(event) {
		event.preventDefault(); // To avoid "submitting" i.e. reseting the form
		connect();
	});

	let disconnectBtn = document.getElementById('disconnectBtn');
	disconnectBtn.addEventListener('click', function(event) {
		event.preventDefault();
		disconnect();
	});

	let refreshBtn = document.getElementById('refreshBtn');
	refreshBtn.addEventListener('click', () => {
		window.api.send("refresh-sessions", {});
	});

	let newsessionBtn = document.getElementById('newsessionBtn');
	newsessionBtn.addEventListener('click', () => {
		window.api.send("show-new-session", {});
	});

	window.api.send("req-app-version", {});	
});

function set_connectionForm(enabled) {
	let form = document.getElementById('connectionForm');
	let elements = form.elements;
	for (let i = 0, len = elements.length; i < len; ++i) {
		    elements[i].disabled = !enabled;
	}
}

function toggle_session_list(enabled) {
	let sessions = document.getElementById('sessions');
	if(enabled)
		sessions.removeAttribute("disabled");
	else
		sessions.setAttribute("disabled", "");
	// Emtpy the session list
}

window.api.receive("connection-status", (event, arg) => {
	//console.log("Got status " + arg);
	if(arg == "connecting") {
		set_connectionForm(false);
		toggle_session_list(false);
		document.getElementById('disconnectBtn').disabled = true;
	}
	else if(arg == "connected") {
		set_connectionForm(false);
		toggle_session_list(true);
		document.getElementById('disconnectBtn').disabled = false;
	}
	else if(arg == "failed") {
		set_connectionForm(true);
		toggle_session_list(false);
		document.getElementById('disconnectBtn').disabled = true;
	}
	else if(arg == "disconnected") {
		set_connectionForm(true);
		toggle_session_list(false);
		// Clean the list of sessions
		document.getElementById("table-sessions").innerHTML='';
		document.getElementById('disconnectBtn').disabled = true;
	}
	document.getElementById("connection-status", arg).innerHTML = "<span class=\"dot " + arg + "\"></span>" + arg;
});
