
function sendpass() {
	let password = document.getElementById('password');
	console.log("Send pass");
	window.api.send('password', password.value);
}

function togglepass() {
	let password = document.getElementById('password');
	let showpassword = document.getElementById('showPass');
	if(password.type == "password") 
		password.type = "text";
	else
		password.type = "password";
}

window.addEventListener('DOMContentLoaded', () => {
	let validateBtn = document.getElementById('validateBtn');
	validateBtn.addEventListener('click', sendpass);

	let showpassBox = document.getElementById('showPass');
	showpassBox.addEventListener('click', togglepass);

});

window.addEventListener('close', (event) => {
	console.log('Want to be closed');
	event.preventDefault();	
});

window.api.receive('set-question', (event, arg) => {
	document.getElementById('text').innerHTML = arg.text;
	document.getElementById('question').innerHTML = arg.question;
});
