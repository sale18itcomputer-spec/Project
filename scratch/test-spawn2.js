const {spawn} = require('child_process');
const url = "D:\\VMware\\Downloads\\macOS Ventura ISO for VM by techrechard.com.iso.torrent";
const moviesDir = "D:\\Download";
const cmdStr = `webtorrent "${url}" --out "${moviesDir}"`;
console.log(cmdStr);
const child = spawn(cmdStr, [], {stdio:'inherit', shell:true});
child.on('close', code => console.log('code:', code));
