/*jslint node: true */
"use strict";

//exports.port = 6611;
//exports.myUrl = 'wss://mydomain.com/bb';
exports.bServeAsHub = false;
exports.bLight = false;

//手續費
exports.free = false;

exports.deviceName = 'Headless';
exports.storage = 'sqlite';

exports.database = {
	host:"localhost",
	name:"headless",
	user:"root",
	password:"root"
}


exports.WS_PROTOCOL = 'ws://';
// exports.hub = 'hub:10060';
exports.hub = '127.0.0.1:8286';

exports.passphrase = '';


// 应该发行新的找零地址 or 始终使用相同的静态地址
exports.bStaticChangeAddress = false;
// 钱包应该使用单个地址还是可以生成新地址
exports.bSingleAddress = false;



exports.permanent_pairing_secret = 'randomstring';
exports.control_addresses = ['DEVICE ALLOWED TO CHAT'];
exports.payout_address = 'WHERE THE MONEY CAN BE SENT TO';
exports.KEYS_FILENAME = 'keys.json';

// where logs are written to (absolute path).  Default is log.txt in app data directory
//exports.LOG_FILENAME = '/dev/null';

// consolidate unspent outputs when there are too many of them.  Value of 0 means do not try to consolidate
exports.MAX_UNSPENT_OUTPUTS = 0;
exports.CONSOLIDATION_INTERVAL = 3600*1000;

// this is for runnining RPC service only, see play/rpc_service.js
exports.rpcInterface = '127.0.0.1';
exports.rpcPort = '10085';


// exports.bizUrl="http://demo.chainfin.online:10036";


console.log('finished headless conf');
