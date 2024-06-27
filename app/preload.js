const {
	contextBridge,
	ipcRenderer

} = require('electron');

contextBridge.exposeInMainWorld(
	"api", {
		send: (channel, data) => {
			let validChannels = [
				"connect", "disconnect",
				"password","connection-status", "req-app-version",
				"refresh-sessions", "show-new-session", "request-new-session","get-slurm-cmd", "info", "kill", "startx", "show_app", "startvnc", "startnomachine", "startvscode", "start_app", "get_forwardport", "forwardport", "gateway-forkey"
			];
			if (validChannels.includes(channel)) 
				ipcRenderer.send(channel, data);
		},
		receive: (channel, func) => {
			let validChannels = ["connection-status", 
				"set-question", "app-version", "slurm-cmd",
				"refresh-sessions", "partition-list","jobinfo", "logger","progress", "get-gateway-forkey"
			];
			if(validChannels.includes(channel))
				ipcRenderer.on(channel, func);
		},
		progress: (values) => {
			ipcRenderer.send("progress", values);
		},
		log: (msg) => {
			ipcRenderer.send("logger", msg);
		}
	}
);
