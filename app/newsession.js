function isNumber(n) {
	  return !isNaN(parseFloat(n)) && isFinite(n);
}

function check_and_create(event, mode) {
	event.preventDefault();
	let options = get_options(mode);
	window.api.send("request-new-session", options);
}

window.api.receive("slurm-cmd", (event, arg) => {
	console.log("received a command");
	let slurm_cmd_field;
	if(arg.mode == 'noresa') 
		slurm_cmd_field = document.getElementById('noresa_slurm_cmd');
	else
		slurm_cmd_field = document.getElementById('resa_slurm_cmd');
	slurm_cmd_field.value = arg.cmd;
});

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
	validateBtn.addEventListener('click', event => {
		check_and_create(event, 'noresa');
	});

	let validateResaBtn = document.getElementById('validateResaBtn');
	validateResaBtn.addEventListener('click', event => {
		check_and_create(event, "resa");
	});

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
			let options = get_options(elem.id);
			toggle_validate_buttons(elem.id, options);
			if(options != null) 
				window.api.send("get-slurm-cmd", options);
		});
	}

	// Add change event detector to update the slurm command
	document.getElementById('noresa_cpuspertask').addEventListener('change', event => {
		if(document.getElementById('noresa_cpuspertask').value != "")
			document.getElementById('noresa_ntasks').value = "";
	});
	document.getElementById('noresa_ntasks').addEventListener('change', event => {
		if(document.getElementById('noresa_ntasks').value != "")
			document.getElementById('noresa_cpuspertask').value = "";
	});

	let elements_id = ['walltime', 'partitions', 'noresa_exclusive', 'noresa_gres', 'noresa_cpuspertask', 'noresa_minnodes', 'noresa_qos', 'noresa_ntasks', 'noresa_constraint'];
	elements_id.forEach(item => {
		document.getElementById(item).addEventListener('change', event => {
			let options = get_options("noresa");
			toggle_validate_buttons("noresa", options);
			if(options != null) 
				window.api.send("get-slurm-cmd", options);
		});
	});

	document.getElementById('resa_cpuspertask').addEventListener('change', event => {
		if(document.getElementById('resa_cpuspertask').value != "")
			document.getElementById('resa_ntasks').value = "";
	});
	document.getElementById('resa_ntasks').addEventListener('change', event => {
		if(document.getElementById('resa_ntasks').value != "")
			document.getElementById('resa_cpuspertask').value = "";
	});
	elements_id = ['reservation', 'resa_walltime', 'resa_exclusive', 'resa_gres', 'resa_cpuspertask', 'resa_minnodes', 'resa_qos', 'resa_ntasks', 'resa_constraint'];
	elements_id.forEach(item => {
		document.getElementById(item).addEventListener('change', event => {
			let options = get_options("resa");
			toggle_validate_buttons("resa", options);
			if(options != null)
				window.api.send("get-slurm-cmd", options);
		});
	});
});

function toggle_validate_buttons(mode, options) {
	if(mode == "resa") 
		document.getElementById('validateResaBtn').disabled = (options == null);
	else
		document.getElementById('validateBtn').disabled = (options == null);
}

function get_options(mode) {
	if(mode == 'noresa') {
		let partition = document.getElementById("partitions");
		let walltime = document.getElementById("walltime").value;
		let label_error = document.getElementById("error");

		if (walltime == '')
			return;

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
			label_error.innerText = `walltime ${walltime} matching failed, not hh:mm !`;
			return;
		}
		else { 
			// Remove any previous displayed error
			label_error.innerText = '';
		}

		let walltime_fields = walltime.split(':');
		let walltime_hh = parseFloat(walltime_fields[0]);
		let walltime_mm = parseFloat(walltime_fields[1]);

		if ((walltime_hh > maxtime_hh) || ((walltime_hh == maxtime_hh) && walltime_mm > maxtime_mm)) {
			label_error.innerText = `walltime ${walltime} exceeds maxtime ${maxtime}`;
			return;
		}

		let advanced = document.getElementById("advanced_noresa").checked;
		let exclusive = document.getElementById("noresa_exclusive");
		let value_exclusive = true;
		let gres = document.getElementById("noresa_gres");
		let value_gres = null;
		let cpuspertask = document.getElementById("noresa_cpuspertask");
		let value_cpuspertask = null;
		let minnodes = document.getElementById("noresa_minnodes");
		let value_minnodes = null;
		let qos = document.getElementById("noresa_qos");
		let value_qos = null;
		let ntasks = document.getElementById("noresa_ntasks");
		let value_ntasks = null;
		let constraint = document.getElementById("noresa_constraint");
		let value_constraint = null;

		if(exclusive.checked) { 
			cpuspertask.value = "";
			cpuspertask.readOnly = true;
			console.log("Checked");
		}
		else{
			cpuspertask.readOnly = false;
			console.log("not Checked");
		}

		if(advanced) {
			if(gres.value != "") {
				value_gres = gres.value;
			}

			if(cpuspertask.value != "") {
				if(!isNumber(cpuspertask.value)) {
					label_error.innerHTML = '-c must be an integer or empty';
					return;
				}
				value_cpuspertask = parseInt(cpuspertask.value);
			}

			if(ntasks.value != "") {
				if(!isNumber(ntasks.value)) {
					label_error.innerHTML = '-n must be an integer or empty';
					return;
				}
				value_ntasks = parseInt(ntasks.value);
			}

			if(minnodes.value != "") {
				if(!isNumber(minnodes.value)) {
					label_error.innerHTML = '-N must be an integer';
					return;
				}
			}
			else {
				label_error.innerHTML = '-N cannot be empty';
				return;
			}
			value_exclusive = exclusive.checked;
			value_minnodes = parseInt(minnodes.value);
			if(qos.value != "")
				value_qos = qos.value;
			if(constraint.value != "")
				value_constraint = constraint.value;
		}
		
		label_error.innerHTML = '';
		let options = {
			mode: "noresa",
			partition: partition_name,
			reservation: null,
			walltime: walltime+':00',  // Append the seconds
			advanced: advanced,
			exclusive: value_exclusive,
			minnodes: value_minnodes,
			gres: value_gres,
			cpuspertask: value_cpuspertask,
			qos: value_qos,
			ntasks: value_ntasks,
			constraint: value_constraint
		};
		return options;
	}
	else {
		let label_error = document.getElementById("errorresa");
		// Let us clean up previous error message
		label_error.innerText = '';
		let resacode = document.getElementById("reservation").value;
		
		if(resacode == '') {
			label_error.innerHTML = `The reservation code is required `;
			return;
		}
		let walltime = document.getElementById("resa_walltime").value;
		// Walltime can be empty, it is an optional field
		let regex_walltime = /^\d+:\d+$/;
		if(walltime != '') {
			if (!(regex_walltime.test(walltime))) {
				label_error.innerText = `walltime ${walltime} matching failed, not hh:mm !`;
				return;
			}
			// Append the seconds to the walltime
			walltime = walltime + ':00';
		}
		
		let advanced = document.getElementById("advanced_resa").checked;
		let exclusive = document.getElementById("resa_exclusive");
		let value_exclusive = true;
		let gres = document.getElementById("resa_gres");
		let value_gres = null;
		let cpuspertask = document.getElementById("resa_cpuspertask");
		let value_cpuspertask = null;
		let minnodes = document.getElementById("resa_minnodes");
		let value_minnodes = null;
		let qos = document.getElementById("resa_qos");
		let value_qos = null;
		let ntasks = document.getElementById("resa_ntasks");
		let value_ntasks = null;

		if(exclusive.checked) { 
			cpuspertask.value = "";
			cpuspertask.readOnly = true;
		}
		else 
			cpuspertask.readOnly = false;

		if(advanced) {

			if(gres.value != "") {
				value_gres = gres.value;
			}

			if(cpuspertask.value != "") {
				if(!isNumber(cpuspertask.value)) {
					label_error.innerHTML = '-c must be an integer or empty';
					return;
				}
				value_cpuspertask = parseInt(cpuspertask.value);
			}

			if(ntasks.value != "") {
				if(!isNumber(ntasks.value)) {
					label_error.innerHTML = '-n must be an integer or empty';
					return;
				}
				value_ntasks = parseInt(ntasks.value);
			}

			if(minnodes.value != "") {
				if(!isNumber(minnodes.value)) {
					label_error.innerHTML = '--nodes must be an integer';
					return;
				}
			}
			else {
				label_error.innerHTML = '-N cannot be empty';
				return;
			}
			value_exclusive = exclusive.checked;
			value_minnodes = parseInt(minnodes.value);
			if(qos.value != "")
				value_qos = qos.value;
		}

		label_error.innerHTML = '';
		let options = {
			mode: "resa",
			partition: null,
			reservation: resacode,
			walltime: walltime,
			advanced: advanced,
			exclusive: value_exclusive,
			minnodes: value_minnodes,
			gres: value_gres,
			cpuspertask: value_cpuspertask,
			qos: value_qos,
			ntasks: value_ntasks
		};
		return options;
	}
}

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
