const { app } = require('electron');
const ssh2 = require('ssh2');
const { spawn } = require('child_process');
const { Socket, createServer, createConnection  } = require('net');
const fs = require('fs');
const { readFile } = require('fs/promises');
const readline = require("readline");
const path = require("path");

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});
rl.stdoutMuted = false;
rl._writeToOutput = function _writeToOutput(stringToWrite) {
	if (rl.stdoutMuted)
		rl.output.write("*");
	else
		rl.output.write(stringToWrite);
};

const default_keypath = path.join(app.getPath('userData'), 'dcekey');
const default_comment = 'DCE Key';
const default_keysize = 4096;
let ssh_frontal;
let ssh_gateway;
let ssh_nodes = {};
let keyparams;

// password_asker may be overwritten with other ways to ask 
// for a pass (e.g. GUI based)
let password_asker = console_password_asker;

function set_password_asker(myfun) {
	password_asker = myfun;
}

function console_password_asker(longtext, question) {
	// Build the promise so that the question is asked with clear stdout
	p = new Promise((resolve, reject) => {
		rl.write(longtext + "\n");
		rl.write(question + "\n");
		rl.stdoutMuted = true;
		rl.question("", (mypassphrase) => {
			rl.stdoutMuted = false;
			rl.write('\n');
			resolve(mypassphrase);
		});
	});
	return p;
}

/**
 * Function to generate a ssh key
 */
async function generateKey(privatekey_path, comment) {
	let keypassphrase = await password_asker("We are going to generate a SSH key for your future authentication. For this key, I need you define a password. This is a password you are free to define but you must remember it. Indeed, the next time you will start the application, the connection will ask you for that passphrase.", "Passphrase for your key (you must remember it!): ");

	return new Promise((resolve, reject) => {

		const cmd = 'ssh-keygen';
		const opts = [
			'-t', 'rsa', 
			'-b', '4096',
			'-C',  `"${comment}"`,
			'-f', privatekey_path,
			'-N', keypassphrase
		];

		const keygen = spawn(cmd, opts);
		keygen.on('exit', () => {
			console.log(`Key generated in ${privatekey_path}`);
			resolve({
				'keypath': privatekey_path, 
				'keypass': keypassphrase
			});
		});
		keygen.stdout.on('data', (data) => {
			console.log(`Keygen stdout : ${data}`);
			console.log(data);
		});
		keygen.stderr.on('data', (data) => {
			console.log(`Keygen stderr : ${data}`);
			reject(data);
		});
	});
};

/**
 * Function to post the ssh-key to the gateway
 */
async function postKey(privatekey_path,
	login,
	gateway, 
 	flogprogress) {
	// to post a key we need a one shot ssh connection
	// with password based auth (to be asked)
	// and then we need to append the content of the public key
	// to the ~/.ssh/authorized
	flogprogress(21, `Reading the ssh key ${privatekey_path}.pub` );
	let keycontent;
	return readFile(privatekey_path+".pub", {encoding: 'utf8'})
		.then((data) => {
			keycontent = data;
			flogprogress(22, 'Asking for the gateway password');
			cmd = "echo \"" + data.trim() + "\" >> ~/.ssh/authorized_keys";

			return password_asker(`For posting the ssh-key, I need you to type in the password for ${login}@${gateway} : `, 'Password :');
		})
		.then((sshpassword) => {

			let gatewayparams = {
				host: gateway,
				username: login,
				password: sshpassword,
				readyTimeout: 99999  // required on windows apparently : see https://github.com/mscdex/ssh2/issues/142
			};

			return new Promise((resolve, reject) => {
				const conn = new ssh2.Client();
				flogprogress(23, 'Connecting to the gateway for posting the key');
				conn.on('error', (error) => {
					console.log(error);
					reject("Unable to connect : invalid login and/or password");
				});
				conn.on('ready', () => {
					conn.exec(cmd, (err, stream) => {
						if(err) reject(err);
						flogprogress(24, 'Sending the key');
						stream
							.on('close', () => {
								flogprogress(25, 'Key sent !');
								conn.end();
								resolve();
							})
							.on('data', (data) => {
							})
							.stderr.on('data', (data) => {
								reject(data);
							});

					})
				}).connect(gatewayparams);
			});

		});
}

/**
 * Check for the availability of a ssh key
 * and generates one if required
 * @return Promise{String}   Path to the private ssh key to be used by ssh2
 */
function checkforkey(privatekey_path=default_keypath) {
	console.log("Checking for the key");
	return fs.promises.access(privatekey_path)
		.then(() => {
			console.log('The key file exists!');
			return new Promise((resolve, reject) => {
				resolve(privatekey_path);
			});
		})
		.catch(err => {
			throw "Keyfile does not exist";
		});
};
	
function delete_keys(privatekey_path=default_keypath) {
	// For the GPUs
	const gpukey = privatekey_path + "gslurm";
	try {
		fs.unlinkSync(gpukey);
		fs.unlinkSync(gpukey+'.pub');
		console.log(`Suppressed ${gpukey}`);
	}
	catch(error) {
		console.log(`Got the error ${error}`);
	}
	// For the CPUs
	const cpukey = privatekey_path + "cslurm";
	try {
		fs.unlinkSync(cpukey);
		fs.unlinkSync(cpukey+'.pub');
		console.log(`Suppressed ${cpukey}`);
	}
	catch(error) {
		console.log(`Got the error ${error}`);
	}
}

/**
 * Establish the ssh connections and, on the way
 * checks or configures the ssh keys
 * Makes use of the password_asker function
 */
async function sshconnect(login, gateway,
	frontal,
	flogprogress,
	privatekey_path=default_keypath) {

	// ssh key handling
	// Checks for existing keys, 
	// otherwise, generates and posts one
	let valid_privatekey_path = privatekey_path+frontal;
	let key_passphrase;
	try {
		flogprogress(10, "Checking the private SSH key.");
		valid_privatekey_path = await checkforkey(valid_privatekey_path);
	}
	catch(err) {
		if(err == "Keyfile does not exist") {
			flogprogress(20, "Creating the private SSH key.");
			await generateKey(valid_privatekey_path, 
			default_comment+frontal)  // Generate
				.then(genparams => {
					key_passphrase = genparams.keypass;
					return postKey(genparams.keypath,
						login,
						gateway, flogprogress); // Post
				})
				.catch(err => {
					// If we have a failure, we must be removing the possibly
					// generated keys because they may not be present 
					// on the server
					console.log(`I'm removing the generated keys ${valid_privatekey_path} and ${valid_privatekey_path}.pub`);
					try {
						  fs.unlinkSync(valid_privatekey_path);
						  fs.unlinkSync(valid_privatekey_path+'.pub');
					} catch(err) {
						  console.error(err)
					}				
					throw err;
				});
		}
		else { // otherwise propagate the exception
			throw err;
		}
	}
	if(valid_privatekey_path == null) {
		throw "ssh-key step failed";
	}

	if(key_passphrase == null) {
		// We need to ask for the passphrase
		key_passphrase = await password_asker("We need to unlock you sshkey. Please provide the ssh-key passphrase you defined at the first connection.", "SSH-key passphrase : ");
	}

	flogprogress(30, "Reading the private SSH key.");

	let pkey = fs.readFileSync(valid_privatekey_path);
	let gatewayparams = {
		host: gateway,
		username: login,
		privateKey: pkey,
		passphrase: key_passphrase,
		readyTimeout: 99999 // required on windows apparently : see https://github.com/mscdex/ssh2/issues/142
	};
	let frontalparams = {
		sock: null,
		username: login,
		privateKey: pkey,
		passphrase: key_passphrase, 
	};

	// Store the keyparams, latter used to establish a connection
	// to the nodes
	keyparams = {
		username: login,
		privateKey: pkey,
		passphrase: key_passphrase, 
	};

	return new Promise((resolve, reject) => {
		ssh_gateway = new ssh2.Client();
		ssh_frontal = new ssh2.Client();

		module.exports.ssh_gateway = ssh_gateway;
		module.exports.ssh_frontal = ssh_frontal;
		flogprogress(40, "Connecting to the gateway...");
		ssh_gateway.on('error', (error) => {
			console.log(error);
			reject("Unable to connect : invalid login and/or password");
		});
		ssh_gateway.on('ready', () => {
			flogprogress(60, "Connected to the gateway.");
	
			ssh_gateway.forwardOut(
				'127.0.0.1', 0,  // Use 0 to the let the OS find the port
				frontal, 22, (err, stream) => {
					if(err){
						ssh_gateway.end();
						reject(err);
					}
					frontalparams.sock = stream;
					ssh_frontal.connect(frontalparams);
				});

			flogprogress(80, "Connecting to the frontal...");
		}).connect(gatewayparams);
	
		ssh_frontal.on('error', (error) => {
			console.log(error);
			reject("Unable to connect : invalid login and/or password");
		});
		ssh_frontal.on('ready', () => {
			flogprogress(100, "Connection done");
			resolve();
		});

	});
};

function register_nodes_prop(jobid, prop, value) {
	if(!(ssh_nodes.hasOwnProperty(jobid))) 
		ssh_nodes[jobid] = {
			conn: null,
			vnc_port: null
		};
	ssh_nodes[jobid][prop] = value;
	// console.log(ssh_nodes);
}

function get_job_props(jobid) {
	if(ssh_nodes.hasOwnProperty(jobid)) 
		return ssh_nodes[jobid];
	else 
		return null;
}

/**
 * ssh x11 connections to the compute nodes
 */
function connect_x11_node(jobid, node) {
	// Check if the client already exists
	if(ssh_nodes.hasOwnProperty(jobid)) {
		return new Promise((resolve, reject) => { resolve(); });
	}

	// Otherwise creates it
	let conn = new ssh2.Client();

	conn.on('x11', (info, accept, reject) => {
		const xserversock = new Socket();
		console.log('Got a x11 call');
		xserversock
			.on('connect', () => {
				const xclientsock = accept();
				console.log('x11 socket connected');
				xclientsock.pipe(xserversock).pipe(xclientsock);

			})
			.on('end', () => {
				console.log('x11 socket ended');
			});
		// connects to localhost:0.0
		//TODO: this is specific to Linux, 
		//and to the case X11 is connected via a Unix socket
		if(process.platform == 'linux') 
			xserversock.connect('/tmp/.X11-unix/X0');
		else
			xserversock.connect(6000, 'localhost');
	});

	let nodeparams = {
		sock: null,
		username: keyparams.username,
		privateKey: keyparams.privateKey,
		passphrase: keyparams.passphrase, 
	};
	return new Promise((resolve, reject) => {

		ssh_frontal.forwardOut(
			'127.0.0.1', 0,  // Use 0 to the let the OS find the port
			node, 22, (err, stream) => {
				if(err){
					reject(err);
				}
				console.log("Forwarding");
				nodeparams.sock = stream;
				// Connect to the node through the allocated stream
				conn.connect(nodeparams);
			});

		conn.on('ready', () => {
		// Register the client in the list of clients
		console.log("X11 connected");
			register_nodes_prop(jobid, "conn", conn);	
			resolve();	
		});
	});
}

function disconnect_x11_node(jobid) {
	return new Promise((resolve, reject) => {
		if(ssh_nodes.hasOwnProperty(jobid)) {
			ssh_nodes[jobid].conn.end();
			delete ssh_nodes[jobid];
		}
		resolve();
	});
}

function execute_x11_node(jobid, application) {
	if(ssh_nodes.hasOwnProperty(jobid)) {
		console.log("got the conn");
		const conn = ssh_nodes[jobid].conn;
		console.log("Running the app");
		conn.exec(application, {x11: true}, (err, stream) => {
			if(err) throw err;
		});
	}
	else
		console.log("No job id in my list");
}

/**
 * Closes the ssh connections 
 */
function disconnect() {

	return new Promise((resolve, reject) => {
		ssh_frontal.end();
		ssh_frontal = null;
		module.exports.ssh_frontal = null;
		ssh_gateway.end();
		ssh_gateway = null;
		module.exports.ssh_gateway = null;

		for(const [key, value] of Object.entries(ssh_nodes)) {
			value.conn.end();
		}
		ssh_nodes = {};

		resolve();
	});
}

async function execute_on_frontal(cmd) {
	return new Promise((resolve, reject) => {
		ssh_frontal.exec(cmd, (err, stream) => {
			if (err) reject(err);
			var buffer = "";
			stream
				.on('close', () => {
					resolve(buffer.trim());
				})
				.on('data', (data) =>{
					buffer += data;
				}).stderr.on('data', function (data) {
					// ssh_frontal.SSHConnection.end();
					reject(data);
				});
		});
	});
}

function sleep(duration) {
	return new Promise((resolve, reject) => {
		setTimeout(resolve, duration);
	});
}

function read_file(filepath, patience_max) {
	// patience_max in s.
	return new Promise(async (resolve, reject) => {
		let patience_cnt = 0;
		while(true) {
			// cmd = `sync && tail ${filepath} | true 2>/dev/null 1>&2 && if [ -f ${filepath} ]; then echo 0; else echo 1; fi`;
			// cmd = `sync && tail ${filepath}`;
			// Ugly hack to get the NFS filesystem in sync, we ask a ls -l !
			cmd = `ls -l \`dirname ${filepath}\` 1>/dev/null && sleep 1 && tail ${filepath}`;
			// cmd = `test -f ${filepath}; echo $?`;
			try {
				res_cmd = await execute_on_frontal(cmd);
				break;
			}
			catch(error) {
				console.log(`Error in readfile : ${error}`);
			}

			patience_cnt += 1;
			
			// If we exceed patience, it means that srun failed
			// and is still blocking, certainly meaning the resources
			// are not available
			if(patience_cnt > patience_max) {
				reject(`Failed to read the file ${filepath}`);
				return;
			}
			console.log(`[${patience_cnt}/${patience_max}] Command failed ${cmd}`);
			await sleep(1000);
		}
		cmd = `cat ${filepath}`;
		const res = await execute_on_frontal(cmd);
		resolve(res);
	});
}

function find_free_port_rec(start_port, max_port, resolve, reject) {
	if(start_port > max_port) 
		reject();

	const s = createConnection({port: start_port, host: 'localhost'})
		.on('connect', function() {
			console.log(`Port ${start_port} NOT free`);
			find_free_port_rec(start_port+1,max_port, resolve, reject); 
			s.end();
		})
		.on('error', err => {
			console.log(`Port ${start_port} free`);
			resolve(start_port);
		});
}
function find_free_port(start_port, max_port) {
	return new Promise((resolve, reject) => {
		find_free_port_rec(start_port, max_port, resolve, reject);
	});
}

function port_forward(jobid, dstport) {
	return find_free_port(dstport, dstport + 1000).then((srcport) => {
		console.log(`Found a free port ${srcport}`);
		return new Promise((resolve, reject) => { 
			createServer((socket) => {
				socket.on("error", (err) => {
					console.log(`Forward socket error : ${err}`);
				});
				const conn = ssh_nodes[jobid].conn;
				conn.forwardOut('localhost', srcport, 'localhost', dstport, 
					(error, stream) => {
						if(error)
							return reject(error);
						socket.pipe(stream);
						stream.pipe(socket);
					});

			})
				.listen(srcport, 'localhost', () => { return resolve(srcport); })
		});
	});
}

module.exports = {
	delete_keys,
	ssh_frontal,
	ssh_gateway,
	sshconnect,
	disconnect,
	set_password_asker,
	execute_on_frontal,
	connect_x11_node,
	disconnect_x11_node,
	execute_x11_node,
	read_file,
	port_forward,
	register_nodes_prop,
	get_job_props
};
