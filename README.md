# DCEjs

<img src="https://github.com/jeremyfix/dcejs/blob/main/app/dce-coul.png?raw=true" width="170"><img src="https://github.com/jeremyfix/dcejs/blob/main/app/cs.png?raw=true" width="170">

Electron app to connect to the Data Center Enseignement clusters of CentraleSupélec - Metz

This app allows to get connected to either the GPU or CPU clusters and then to execute programs on it such as VNC (with port_forwarding). 

## Prerequisites

We need you to have `ssh-keygen` installed on your system. On Linux or MacOS, this should be already available. On Windows, you may need to [activate the OpenSSH extension](https://docs.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse).

On all the OS, you can check this works by ensuring you can execute the command `ssh-keygen` from a terminal.

If you want to use VNC, you should also install the [tigerVNC client](https://sourceforge.net/projects/tigervnc/files/). Some MacOS users reported issues when trying to run tigerVNC and were successfull using [realvnc](https://www.realvnc.com/fr/connect/download/viewer/macos/).

If you want to use NoMachine, you should also install the [NoMachine client](http://www.nomachine.com)

If you want to start X11 application, on Windows, you can install [XMing](https://sourceforge.net/projects/xming/).

If you want to start X11 application, on MacOS, you can install XQuartz. In addition, you must allow local network connections in the settings of XQuartz. Finally, you must run `xhost +` in a terminal before running a X11 application with dcejs.

## Installing

To install the app for your OS, please select the appropriate runnable from the releases on the [Release page](https://github.com/jeremyfix/dcejs/releases).

On Windows, you may need to "unlock the application" (in the properties of the exe file) to allow its execution.

On MacOS, you also need to enforce MacOS to open the app even if it claims that the "developer cannot be verified". This can be done by Ctrl clicking on the app for launching it.

On Linux, you need to install `libfuse2` and you need to add the execution permissions to the App image file which can be easily done by editing the properties of the app image file from the file explorer or by simply calling a `chmod +x ` on the app image file. 

## Running

If you just want to test and run the app and have a Node installation, you just need to

	cd app
	yarn
	yarn start

## Troubleshootings

### Minimum ssh-keygen passphrase length

On some windows platforms, users reported they need to provide a ssh-key passphrase containing at least 5 characters.

