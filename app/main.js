const {app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const { spawn } = require('child_process');
const path = require("path");
const url = require("url");
const sshhandler = require('./sshhandler.js');
const slurm_requests = require('./slurm_requests.js');
const screen = require("./screen.js");
const vnc = require("./vnc.js");
const nomachine = require("./nomachine.js");
const fs = require('fs');
const { readFile } = require('fs/promises');

let mainWindow;
let passwindow = null;
let newsessionwindow = null;
let appwindow = null;
let connection_status="disconnected";

const logdirectory="~/.cscluster/"

if(require('electron-squirrel-startup')) return;

autoUpdater.on('error', () => {
	console.log('Error in auto update check');
})

autoUpdater.on('update-available', (ev, info) => {
	const options = {
		type: 'info',
		title: 'Newer version',
		message: 'A newer version is available only. Please check and download the releases from https://github.com/jeremyfix/dcejs/releases'
	};
	dialog.showMessageBox(null, options);
	console.log('Update available.');
})

function createMainMenu() {
	const isMac = process.platform === 'darwin';
	const template = [
		{
			label: "Edit",
			submenu: [
				{ role: 'undo' },
				{ role: 'redo' },
				{ type: "separator" },
				{ role: 'cut' },
				{ role: 'copy' },
				{ role: 'paste' },
				{ role: 'pasteandmatchstyle' },
				{ role: 'delete' },
				{ role: 'selectall' }
			]
		},
		{
			label: "SSH Keys",
			submenu: [
				{
					label: "Delete the keys",
					click: async () => {
						const win = BrowserWindow.getFocusedWindow();
						const options = {
							type: 'question',
							buttons: ['Yes', 'No'],
							title: 'Delete the keys ?',
							message: 'Do you really want to delete your local ssh keys ?'
						};
						dialog.showMessageBox(win, options)
							.then(result => {
								if(result.response == 0) {
									console.log("Suppressing the keys");
									sshhandler.delete_keys();
								}
						});
					}
				}
			]
		}
	];

	if (process.platform === 'darwin') {
		template.unshift({
			label: app.getName(),
			submenu: [
				{role: 'about'},
				{type: 'separator'},
				{role: 'services', submenu: []},
				{type: 'separator'},
				{role: 'hide'},
				{role: 'hideothers'},
				{role: 'unhide'},
				{type: 'separator'},
				{role: 'close'}
			]
		});
	}
	else {
		template.unshift({
			label: "File",
			submenu: [ {
				role: 'quit'
			}]
		});
	}

	return Menu.buildFromTemplate(template);
}

// This method will be called when Electron has done everything
// initialization and ready for creating browser windows.
app.on('ready', function() {
	// Create the browser window.
	mainWindow = new BrowserWindow({
		width: 650, height: 750,
		resizable: true,
		icon: path.join(app.getAppPath(), 'dce-coul.png'),
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			enableRemoteModule: false,
			preload: path.join(__dirname, "preload.js")
		}
	});
	Menu.setApplicationMenu(createMainMenu());
	// mainWindow.webContents.openDevTools();

	// and load the index.html of the app.
	mainWindow.loadURL(
		url.format({
			pathname: path.join(app.getAppPath(), 'index.html'),
			protocol: 'file',
			slashed: true
		}));

	// Emitted when the window is closed.
	mainWindow.on('closed', function() {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		mainWindow = null;
		passwindow = null;
	});

	// Disable auto download/install of a new version
	// this is not working on all OS because the app is not signed
	// at least we will indicate a new version is available
	autoUpdater.autoDownload = false;
	autoUpdater.checkForUpdates();

});

// Quit when all windows are closed.
app.on('window-all-closed', function() {
	app.quit();
});

ipcMain.on("connect", (event, args) => {
	connection_status = "connecting";
	mainWindow.webContents.send("connection-status", connection_status);

	sshhandler.sshconnect_simple(args.login, args.gateway, logprogress)
		.then(() => {
			connection_status = "connected";
			mainWindow.webContents.send("connection-status", connection_status);
		})
		.then(refresh_sessions)
		.catch(error => {
			// console.log(`Error : '${error}'`);
			if(error == "TypeError: Cannot read property 'getPrivatePEM' of undefined") {
				logfailure("Cannot open your private key. Did you type in the correct password ?", error);
			}
			else 
				logfailure(error);
			connection_status = "failed";
			mainWindow.webContents.send("connection-status", connection_status);
		});
});

function refresh_sessions() {
	return slurm_requests.list_allocation()
		.then((data) => {
			console.log("Refresh : ");
			console.log(data);
			mainWindow.webContents.send("refresh-sessions", {
				platform: process.platform,
				sessions: data
			});
		})
		.catch(error => {
			console.log(`Got an error ${error}`);
		});
}

ipcMain.on("refresh-sessions", (event, args) => {
	refresh_sessions();
});

function createAppWindow() {
	appwindow = new BrowserWindow({
		width: 450,
		height: 300,
		parent: mainWindow,
		resizable: false,
		alwaysOnTop: true,
		closable: true,
		modal: true,
		show: false,
		webPreferences: {
			preload: path.join(__dirname, "preload.js")
		}
	});
	// appwindow.webContents.openDevTools();
	appwindow.setMenu(null);
	appwindow.loadURL(
		url.format({
			pathname: path.join(__dirname, 'applauncher.html'),
			protocol: 'file',
			slashed: true
		})
	);
	appwindow.on('close', () => {
		appwindow = null;
		console.log('closed...');
	});


}

function createNewSessionWindow() {
	newsessionwindow = new BrowserWindow({
		width: 500,
		height: 500,
		parent: mainWindow,
		resizable: true,
		alwaysOnTop: true,
		closable: true,
		modal: true,
		show: false,
		webPreferences: {
			preload: path.join(__dirname, "preload.js")
		}
	});
	// newsessionwindow.webContents.openDevTools();
	newsessionwindow.setMenu(null);
	newsessionwindow.loadURL(
		url.format({
			pathname: path.join(__dirname, 'newsession.html'),
			protocol: 'file',
			slashed: true
		})
	);
	newsessionwindow.on('close', () => {
		newsessionwindow = null;
		console.log('closed...');
	});

}


ipcMain.on("show-new-session", async (event, args) => {
	// Get the list of partitions with their maxtime
	let cmd = 'sinfo | tail -n +2 | awk \'{if ($5 == "idle") print $1,$3,$6}\'' ;
	let partitions = await sshhandler.execute_on_frontal(cmd);
	partitions = partitions.split("\n");
	let partition_list = [];
	partitions.forEach(elem => {
		if(elem != "") {
		console.log(`"${elem}"`);
		console.log(typeof(elem));
		const partition_fields = elem.split(" ");
		let maxtime_fields = partition_fields[1].split(':'); 
		// Remove the seconds from HH:MM:SS or DD-HH:MM:SS
		let maxtime = `${maxtime_fields[0]}:${maxtime_fields[1]}`;

		partition_list.push({
			name: partition_fields[0],
			maxtime: maxtime,
			nodes: partition_fields[2]
		});
			
	}});

	// Open the window to ask for the parameters of the session
	createNewSessionWindow();
	// newsessionwindow.webContents.openDevTools();

	// And send that to update the DOM
	newsessionwindow.webContents.once('did-finish-load', () => {
		console.log(`Sending ${partition_list}`);
		newsessionwindow.webContents.send("partition-list", partition_list);
	});
	newsessionwindow.show();
});

ipcMain.on("request-new-session", async (event, args) => {
	newsessionwindow.close();
	console.log(`New session requested : ${args}`);
	try {
		let cmd = "";
		let res_cmd;

		// Create the directory to store cscluster related things
		cmd = `mkdir -p ${logdirectory}`;
		logprogress(5, `Setup log dir`, cmd);
		await sshhandler.execute_on_frontal(cmd);

		// Kill a screen session with the default name if it exists
		// already
		cmd = `screen -S ${screen.get_screen_name()} -X kill 1> /dev/null`;
		logprogress(10, `Killing zombie screens`, cmd);
		await sshhandler.execute_on_frontal(cmd);

		// Create the screen session on the frontal node
		cmd = `screen -d -m -S ${screen.get_screen_name()} & echo $! > ${logdirectory}/screen_pid.log; sync`;
		logprogress(15, `Creating the screen session`, cmd);
		await sshhandler.execute_on_frontal(cmd);

		// Recover the PID of the created screen session
		cmd = `screen -ls | grep ${screen.get_screen_name()} | awk '{print $1}' | cut -d'.' -f1`;
		logprogress(20, `Getting the screen PID`, cmd);
		screen_pid = (await sshhandler.execute_on_frontal(cmd)).trim();
		console.log(`Got a screen session PID ${screen_pid}`);

		// Create the script to kill the screen session on slurm epilog
		screen_epilog = `/tmp/kill_screen_${screen_pid}`;
		cmd = `touch ${screen_epilog}`;
		logprogress(30, `Creating the epilog file`);
		await sshhandler.execute_on_frontal(cmd);

		cmd = `echo "#!/bin/bash" >> ${screen_epilog}`;
		await sshhandler.execute_on_frontal(cmd);

		cmd = `echo "# Kill the screen session" >> ${screen_epilog}`;
		await sshhandler.execute_on_frontal(cmd);
		cmd = `echo "kill ${screen_pid}" >> ${screen_epilog}`;
		await sshhandler.execute_on_frontal(cmd);

		cmd = `echo "# Remove the logfile" >> ${screen_epilog}`;
		await sshhandler.execute_on_frontal(cmd);
		cmd = `echo "rm -f ${logdirectory}/resa-${screen_pid}.log" >> ${screen_epilog}`;
		await sshhandler.execute_on_frontal(cmd);

		cmd = `echo "# Remove this file" >> ${screen_epilog}`;
		await sshhandler.execute_on_frontal(cmd);

		cmd = `echo "rm -f ${screen_epilog}" >> ${screen_epilog}`;
		await sshhandler.execute_on_frontal(cmd);

		// Make the kill script runnable
		cmd = `chmod u+x ${screen_epilog}`;
		await sshhandler.execute_on_frontal(cmd);

		// Book a node within the screen session
		let partition = args.partition;
		let walltime = args.walltime;
		let resa = args.reservation;
		let advanced = args.advanced;
		let minnodes = args.minnodes;
		let cpuspertask = args.cpuspertask;
		let qos = args.qos;

		let slurm_cmd = slurm_requests.get_slurm_cmd(args, screen_epilog);
		console.log(`slurm commande : ${slurm_cmd}`);

		cmd = `screen -S ${screen.get_screen_name()} -X stuff '${slurm_cmd}'`;
		logprogress(50, `Allocating a node with srun ${cmd}`);
		await sshhandler.execute_on_frontal(cmd);

		// Save the SLURM_JOBID in ~/.cscluster/resa-screen_pid.log
		// This will be effective only (and only if!) the srun is 
		// successfull otherwise the srun call is blocking :-)
		let resalogfile = `${logdirectory}/resa-${screen_pid}.log`;
		slurm_cmd = `'rm -f ${resalogfile}; sync^M'`
		cmd = `screen -S ${screen.get_screen_name()} -X stuff ${slurm_cmd}`;
		logprogress(60, `Recovering the jobid`);
		await sshhandler.execute_on_frontal(cmd);

		slurm_cmd = `'echo \\\$SLURM_JOBID > ${resalogfile}; sync^M'`
		cmd = `screen -S ${screen.get_screen_name()} -X stuff '\'${slurm_cmd}\''`;
		await sshhandler.execute_on_frontal(cmd);

		// And the SLURM_JOBID to rename the screen session
		// The following will wait until the slurm job is started
		// since otherwise the srun command is still blocking 
		// and the file in which we store the job id is not created !
		const jobid = await sshhandler.read_file(resalogfile, 20);
		if(jobid == '') {
			logprogress(70, `Failed to allocate '${jobid}'`);
			throw "srun failed";
		}
		logprogress(70, `Got an allocation jobid ${jobid}`);

		// Complete the epilog file to remove the log files that 
		// might be generated during the session
		cmd = `echo "rm -f ${logdirectory}/*-${jobid}*"`;
		await sshhandler.execute_on_frontal(cmd);

		// Rename the screen session
		const session_name = screen.get_screen_name(jobid);
		cmd = `screen -S ${screen.get_screen_name()} -X sessionname ${session_name}`;
		logprogress(80, `Renaming the screen session`);
		await sshhandler.execute_on_frontal(cmd);

     	// Check if the screen session is correctly created
		cmd=`screen -list | grep -q ${session_name}; echo $?`;
		logprogress(90, `Checking all is ok`);
		res_cmd = await sshhandler.execute_on_frontal(cmd);

		if(res_cmd !== '0')
			throw `The session ${session_name} was not found as expected`;
		
		// Update the list of sessions
		refresh_sessions();
		
		logprogress(100, `We are there, ready to work !`);
		console.log(`Session ${session_name} created`);

	}
	catch(error) {
		logfailure("New session creation failed", `Error while creating a new session ${error}`);
		//TODO clean up and remove the possibly generated files
	}
});

ipcMain.on("get-slurm-cmd", async (event, options) => {
	console.log(options);
	newsessionwindow.webContents.send("slurm-cmd", 
		{
			mode: options.mode,
			cmd: slurm_requests.get_slurm_cmd(options) 
		});
})

ipcMain.on("show_app", (event, arg) => {
	// When we show the apps, we create a x11 ssh connection to the first 
	// node. It will be possibly used by a launcher
	// That ssh connection is kept until we kill the job or disconnect
	sshhandler.connect_x11_node(arg.jobid, arg.firstnode).
		then(() => {
			// Only if the promise is succesfull do we display
			// the app window
			createAppWindow();
			// appwindow.webContents.openDevTools();

			// And send that to update the DOM
			appwindow.webContents.once('did-finish-load', () => {
				appwindow.webContents.send("jobinfo", arg);
			});
			appwindow.show();
		})
		.catch(error => {
			console.log(`Error when trying to setup the X11 connection to ${arg.first}`);
		});
});

ipcMain.on("kill", async (event, arg) => {
	//Kill the session
	const jobid = arg.jobid;

	logprogress(25, "Stopping your job");
	sshhandler.disconnect_x11_node(jobid)
		.then(() => {
			const cmd = `scancel ${jobid}`;
			logprogress(50, "Killing the slurm allocation");
			return sshhandler.execute_on_frontal(cmd);
		})
		.then(() => {
			const screen_name = screen.get_screen_name(jobid);
			cmd = `screen -S ${screen_name} -X kill`;
			logprogress(75, "Stopping your screen session");
			return sshhandler.execute_on_frontal(cmd);
		})
		.then(() => {
			return new Promise((resolve, reject) => {
				setTimeout(resolve, 3000);
			});
		})
		.then(() => {
			logprogress(100, "Refreshing the session list");
			return refresh_sessions();
		})
		.catch(error => {
			console.log(`Got an error when trying to kill ${error}`);
		});

	// And close the app window
	if(appwindow != null)
		appwindow.close();
});

ipcMain.on("startx", (event, arg) => {
	appwindow.close();
	const jobid = arg.jobid;
	const application = arg.app;
	console.log(`Running ${application}`);
	sshhandler.execute_x11_node(jobid, application);
});

// Note : 
// We need 1) to start vnc  2) to bind VNC, these are 2 buttons
// The buttons may be enabled only if there is some VNC running
// The allocation list should show if there is a port forward or not
ipcMain.on("startvnc", (event, arg) => {
	appwindow.close();
	const jobid = arg.jobid;
	// Check if VNC is already running
	logprogress(5, "Going to start VNC");
	vnc.check(jobid)
		.then((available) => {
			if(!available) {
				console.log("Starting VNC which was not");
				logprogress(25, "VNC started on remote");
				return vnc.start(jobid);
			}
			logprogress(25, "VNC was already started on remote");
		})
		.then(() => {
			console.log("Gettings the ports");
			logprogress(50, "Getting the remote VNC port");
			return vnc.get_ports(jobid);
		})
		.then((ports) => {
			// Get the first port and use it for port forwarding
			logprogress(50, `Got the VNC port ${ports[0]}`);
			return sshhandler.port_forward(jobid, ports[0]);
		})
		.then((srcport) => {
			sshhandler.register_nodes_prop(jobid, 'vnc_port', srcport);
			logprogress(75, `Server ready`);
		})
		.then(refresh_sessions)
		.then(() => {
			logprogress(100, "VNC done. Please start your viewer.");
		})
		.catch(error => {
			logfailure(`Running VNC failed: ${error}`, `Error while running VNC ${error}`);
		});
});

// Note : 
// We need 1) to check nomachine is running  2) to bind nomachine
ipcMain.on("startnomachine", (event, arg) => {
	appwindow.close();
	const jobid = arg.jobid;
	logprogress(5, "Going to start NoMachine");

	nomachine.check(jobid) 
		.then((available) => {
			if(!available) {
				logfailure("NoMachine is not running on the server");
				throw "nomachine not running";
			}
			logprogress(25, `NoMachine is running`);
		})
		.then(() => {
			logprogress(50, `Setting up the ssh tunnel`);
			// 4000 is the port on which nomachine is listening on the remote
			return sshhandler.port_forward(jobid, 4000);
		})
		.then((srcport) => {
			sshhandler.register_nodes_prop(jobid, 'nomachine_port', srcport);
			logprogress(75, `Server ready`);
		})
		.then(refresh_sessions)
		.then(() => {
			logprogress(100, "NoMachine done. Please start your viewer.");
		})
		.catch(error => {
			logfailure("Running NoMachine failed", `Error while running NoMachine ${error}`);
		});
})

ipcMain.on("start_app", async (event, arg) => {
	const platform = process.platform;
	let programs = {
		vnc: await vnc.find_vncviewer(),
		nxplayer: await nomachine.find_nomachine()
	};

	if(arg.application == 'vnc') {
		console.log('Running vnc');
		console.log(programs);
		if(programs.vnc == null)
			return;
		if(!(fs.existsSync(programs.vnc))) {
			logfailure(`Cannot find ${programs.vnc}. You will have to run VNC manually`);
			return;
		}

		const cmd = programs.vnc;
		const opts = [
			arg.params.hostport
		];
		spawn(cmd, opts);
	}
	else {
		if(programs.nxplayer == null)
			return;
		if(!(fs.existsSync(programs.nxplayer))) {
			logfailure(`Cannot find ${programs.nomachine}. You will have to run nxplayer manually`);
			return;
		}

		const cmd = programs.nxplayer;
		// Takes the template 
		const connectionTemplatepath = path.join(__dirname, 'connection.nxs');
		readFile(connectionTemplatepath, {encoding: 'utf-8'})
			.then((data) => {
				const user = arg.params.user;
				const port = arg.params.hostport.split(':')[1];
				// Write the config file 
				const connectionpath = path.join(app.getPath('userData'), `connection${port}.xs`);
				const outdata = data.replace("MYNOMACHINEPORT", port).replace("MYNOMACHINEUSER", user);
				fs.writeFileSync(connectionpath, outdata);
				console.log(`File ${connectionpath} generated`);
				// And starts it with nxplayer
				
				const opts = [
					'--session', connectionpath
				];
				spawn(cmd, opts);	
			})
	}
})

/*
 * Logging
 */

function logfailure(msg, consolemsg=null) {
	sendlog(msg);
	sendprogress(100, "failure");
	if(consolemsg != null) 
		console.log(consolemsg);
}

function logprogress(progress, msg, consolemsg=null) {
	sendlog(msg);
	sendprogress(progress, "success");
	if(consolemsg != null) 
		console.log(consolemsg);
	else
		console.log(msg);
}

function sendlog(log) {
	mainWindow.webContents.send("logger", log);	
}	
ipcMain.on("logger", (event, arg) => {
	sendlog(arg);
});

function sendprogress(progress, type) {
	mainWindow.webContents.send("progress", {progress:progress, type:type});	
}

ipcMain.on("progress", (event, arg) => {
	sendprogress(arg);	
});

ipcMain.on("req-app-version", (event, arg) => {
	event.sender.send("app-version", app.getVersion());
});

ipcMain.on("disconnect", (event, args) => {
	// Close the ssh connections
	sshhandler.disconnect()
		.then(() => {
			connection_status = "disconnected";
			mainWindow.webContents.send("connection-status", connection_status);
		})
		.catch(error => {
			console(`Got an error on disconnect ${error}`);
			connection_status = "disconnected";
			mainWindow.webContents.send("connection-status", connection_status);
		});
});

function createPassWindow() {
	passwindow = new BrowserWindow({
		width: 450,
		height: 350,
		parent: mainWindow,
		resizable: false,
		alwaysOnTop: true,
		closable: false,
		modal: true,
		show: false,
		webPreferences: {
			preload: path.join(__dirname, "preload.js")
		}
	});
	passwindow.setMenu(null);
	passwindow.loadURL(
		url.format({
			pathname: path.join(__dirname, 'password_query.html'),
			protocol: 'file',
			slashed: true
		})
	);

	passwindow.on('close', () => {
		passwindow = null;
		connection_status = "failed";
		logfailure("Operation canceled");
		console.log("closing passwindow");
		mainWindow.webContents.send("connection-status", connection_status);
	});
}

function request_password(longtext, question) {
	console.log(`Request password with ${longtext} ${question}`);

	createPassWindow();
	// passwindow.webContents.openDevTools();

	passwindow.webContents.once('did-finish-load', () => {
		passwindow.webContents.send('set-question', { 
			text: longtext,
			question: question
		});
	});

	passwindow.show();
	return new Promise((resolve, reject) => {
		ipcMain.on("password", (event, args) => {
			passwindow.hide();
			// We delete rather than passwindow.close() to distinguish
			// our closing vs manual closing by the user
			// If the user closes the window, we reactivate the login 
			// form otherwise we do not
			delete passwindow;
			resolve(args);	
		})
	});
}
sshhandler.set_password_asker(request_password);
