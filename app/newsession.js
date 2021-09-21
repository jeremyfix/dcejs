function check_and_create_resa(event) {
	event.preventDefault();

	let label_error = document.getElementById("errorresa");
	let resacode = document.getElementById("reservation").value;
	
	if(resacode == '') {
		label_error.innerHTML = `The reservation code is required `;
		return;
	}

	window.api.send("request-new-session", {
		partition: null,
		reservation: resacode,
		walltime: null
	});
}

function isNumber(n) {
	  return !isNaN(parseFloat(n)) && isFinite(n);
}

function check_and_create(event) {
	event.preventDefault();
	let partition = document.getElementById("partitions");
	let walltime = document.getElementById("walltime").value;
	let label_error = document.getElementById("error");

	if (walltime == '') {
		label_error.innerHTML = `walltime is required `;
		return;
	}

	let partition_fields = partition.value.split(" ");
	let partition_name = partition_fields[0];
	let maxtime = partition_fields[1];
	let maxtime_fields = maxtime.split(":");
	let maxtime_ddhh = maxtime_fields[0].split('-');
	let maxtime_hh = 0;
	if (maxtime_ddhh.length == 1) {
		// We did have only hours
		maxtime_hh = parseFloat(maxtime_ddhh[0]);
	}
	if (maxtime_ddhh.length == 2) {
		// We add some days in front
		maxtime_hh = parseFloat(maxtime_ddhh[0])*24 + parseFloat(maxtime_ddhh[1]);
	}
	let maxtime_mm = parseFloat(maxtime_fields[1]);

	let regex_walltime = /^\d+:\d+$/;
	if (!(regex_walltime.test(walltime))) {
		label_error.innerHTML = `walltime ${walltime} matching failed, not hh:mm !`;
		return;
	}
	let walltime_fields = walltime.split(':');
	let walltime_hh = parseFloat(walltime_fields[0]);
	let walltime_mm = parseFloat(walltime_fields[1]);

	if ((walltime_hh > maxtime_hh) || ((walltime_hh == maxtime_hh) && walltime_mm > maxtime_mm)) {
		label_error.innerHTML = `walltime ${walltime} exceeds maxtime ${maxtime}`;
		return;
	}

	let advanced = document.getElementById("advanced_noresa").checked;
	let cpuspertask = document.getElementById("noresa_cpuspertask");
	let value_cpuspertask = null;
	let minnodes = document.getElementById("noresa_minnodes");
	let value_minnodes = null;
	if(advanced) {

		if(cpuspertask.value === "") {
			label_error.innerHTML = `With advanced settings, --cpus-per-task cannot be empty`;
			return;
		}
		if(!isNumber(cpuspertask.value)) {
			label_error.innerHTML = '--cpus-per-task must be an integer';
			return;
		}
		value_cpuspertask = parseInt(cpuspertask.value);

		if(minnodes.value === "") {
			label_error.innerHTML = `With advanced settings, --nodes cannot be empty`;
			return;
		}
		if(!isNumber(minnodes.value)) {
			label_error.innerHTML = '--nodes must be an integer';
			return;
		}
		value_minnodes = parseInt(minnodes.value);
	}
	
	let options = {
		partition: partition_name,
		reservation: null,
		walltime: walltime+':00',  // Append the seconds
		advanced: advanced,
		minnodes: value_minnodes,
		cpuspertask: value_cpuspertask
	};

	console.log(options);
	// window.api.send("request-new-session", options);
}

window.api.receive("partition-list", (event, arg) => {
	// Update the content of the select	
	let html = "";
	arg.forEach(partition => {
		html += `<option value="${partition.name} ${partition.maxtime}">Partition ${partition.name}, Maxtime ${partition.maxtime}, Nodes ${partition.nodes}</option>`;
	});
	const select = document.getElementById("partitions");
	select.innerHTML = html;
});

window.addEventListener('close', (event) => {
	console.log('Want to be closed');
	event.preventDefault();	
});

window.addEventListener('DOMContentLoaded', () => {
	let validateBtn = document.getElementById('validateBtn');
	validateBtn.addEventListener('click', check_and_create);

	let validateResaBtn = document.getElementById('validateResaBtn');
	validateResaBtn.addEventListener('click', check_and_create_resa);

	var tablinks = document.querySelectorAll("button.tablinks");
	tablinks.forEach(elem => elem.addEventListener('click', showTab, false));

	document.getElementById("defaultOpen").click();

	let collapsibles = document.getElementsByClassName("collapsible");
	for(let elem of collapsibles) {
		elem.addEventListener("click", function () {
			this.classList.toggle("active");
			let checkbox = this.nextElementSibling;
			let content = checkbox.nextElementSibling;
			if(content.style.maxHeight) {
				checkbox.checked = false;
				content.style.maxHeight = null;
			}
			else {
				checkbox.checked = true;
				content.style.maxHeight = content.scrollHeight + "px";
			}
		});
	}
});

function showTab(evt) {
	const condition = evt.currentTarget.innerHTML;
	var i, tabcontent, tablinks;
	tabcontent = document.getElementsByClassName("tabcontent");
	for (i = 0; i < tabcontent.length; i++) {
		tabcontent[i].style.display = "none";
	}
	tablinks = document.getElementsByClassName("tablinks");
	for (i = 0; i < tablinks.length; i++) {
		tablinks[i].className = tablinks[i].className.replace(" active", "");
	}
	document.getElementById(condition).style.display = "block";
	evt.currentTarget.className += " active";
}
