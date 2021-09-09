# DCEjs

<img src="https://github.com/jeremyfix/dcejs/blob/main/app/dce-coul.png?raw=true" width="170"><img src="https://github.com/jeremyfix/dcejs/blob/main/app/cs.png?raw=true" width="170">

Electron app to connect to the Data Center Enseignement clusters of CentraleSupélec - Metz

This app allows to get connected to either the GPU or CPU clusters and then to execute programs on it such as VNC (with port_forwarding). 

## Prerequisites

We need you to have `ssh-keygen` installed on your system. On Linux or MacOS, this should be already available. On Windows, you may need to [activate the OpenSSH extension](https://docs.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse).

On all the OS, you can check this works by ensuring you can execute the command `ssh-keygen` from a terminal.

If you want to use VNC, you should also install the [tigerVNC client](https://sourceforge.net/projects/tigervnc/files/).

If you want to use NoMachine, you should also install the [NoMachine client](http://www.nomachine.com)

## Installing

To install the app for your OS, please select the appropriate runnable from the releases on the [Release page](https://github.com/jeremyfix/dcejs/releases).

On Windows, you may need to "unlock the application" (in the properties of the exe file) to allow its execution.

On MacOS, you also need to enforce MacOS to open the app even if it claims that the "developer cannot be verified". This can be done by Ctrl clicking on the app for launching it.

## Running

If you just want to test and run the app and have a Node installation, you just need to

	cd app
	yarn
	yarn start

