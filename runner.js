const fs = require('fs');
const express = require('express');
const app = express();
const exec = require('child_process').exec;
const spawn = require('child_process').spawn;
const psTree = require('ps-tree');
const cors = require('cors');
const os = require('os');

app.use(cors());

const CROCOITE_PATH = `/root/crocoite`;

function readLog(){
	return fs.readFileSync(coordinator.running.logPath, 'utf8');
}

function runTask(url){
	return new Promise(resolve => {
		console.log("Job started : " + url);
		// extract hostname
		const url_p = new URL(url);
		let host = url_p.hostname;
	  
		// prepare dir
		let out_dir = CROCOITE_PATH + "/" + host + "_" + Date.now().toString();
		fs.mkdirSync(out_dir, { recursive: false }, (err) => {
		  if (err) throw err;
		});

		// update coordinator
		coordinator.running.seedUrl = url;
		coordinator.running.logPath = out_dir + '/out.log';
		coordinator.running.startTime = Date.now().toString();
		coordinator.isTaskPending = true;
		
		var cmdString = 'crocoite-recursive --policy prefix ' + url + ' ' + out_dir + ' > ' + out_dir + '/out.log';
		console.log(cmdString);
		var cmdOpts = {
		  cwd: `/root/crocoite`
		};
		childProcess = exec(cmdString, cmdOpts,  (error, stdout, stderr) => {
		  if (error) {
			console.error(`exec error: ${error}`);
			
			cleanCoordinator();
			
			resolve();
		  }
		  console.log(`stdout: ${stdout}`);
		  console.log(`stderr: ${stderr}`);
		  console.log("==== FINISHED ====");
		  
		  cleanCoordinator();
			
			// todo : report any error...
		  
		  resolve();
		});
	});
}

function testTask(url){
	return new Promise(resolve => {
		console.log("Job started : " + url);
		// extract hostname
		
		resolve();
	});
}

function killJob(){
	childProcess.kill();
}

let childProcess;
let coordinator = {
	isRunning: false,
	isTaskPending: false,
	isPaused: false,
	queue: [],
	running : {},
};

function cleanCoordinator(){
	// clean
	coordinator.isTaskPending = false;
	coordinator.running = {};
}

async function runJob(){
	while(coordinator.queue.length != 0){
		if(!coordinator.isPaused){
			coordinator.isRunning = true;
			let url = coordinator.queue.shift();
			
			//await task to finish
			await runTask(url);
			
			console.log("waiting before switching to new task...");
			await sleep(10000);
			

		} else {
			console.log("Coordinator is not runnable for now... retry later...");
			return;
		}
	}
	
	console.log("Job queue empty");
	coordinator.isRunning = false;	
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* mini server */
app.get('/', function (req, res) {
  res.json(coordinator);
})

app.get('/status/server', function (req, res) {
	console.log("getting server status");
	
	var o = {};
	o.cpu = os.cpus();
	o.totalmem = os.totalmem();
	o.freemem = os.freemem();
	o.hostname = os.hostname();

	res.json(o);
})

app.get('/status/pause', function (req, res) {
	console.log("pausing coordinator...");
	coordinator.isPaused = true;

	res.json(coordinator);
})

app.get('/status/resume', function (req, res) {
	console.log("resuming coordinator...");
	coordinator.isPaused = false;
	
	res.json(coordinator);
})

app.get('/run', function (req, res) {
	coordinator.isPaused = false;
	
	runJob();
	
	res.json(coordinator);
})

app.get('/kill', function (req, res) {
	psTree(childProcess.pid, function (err, children) {
		if(err){
			console.log(err);
			res.send(err);
		}
		
		res.send("killed");
	    spawn('kill', ['-9'].concat(children.map(function (p) { return p.PID })));
		
		cleanCoordinator();
	});
})

app.get('/current/raw', async function (req, res) {
	try {
		let d = readLog();
		res.send(d);
	  } catch (e) {
		console.log(e);
		res.send(e);
	}
})

app.get('/add/:url', async function (req, res) {
	try {
		console.log(req.params.url);
		//runTask(req.params.url);
		coordinator.queue.push(req.params.url);
		res.json(coordinator);
	  } catch (e) {
		//this will eventually be handled by your error handling middleware
		console.log(e);
		res.send(e);
	}
})

app.listen(3009, function () {
  console.log('Example app listening on port 3009!')
})