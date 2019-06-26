/*jslint node: true */


"use strict";
var headlessWallet = require('../start.js');
var conf = require('core/conf.js');
var eventBus = require('core/event_bus.js');
var db = require('core/db.js');
var mutex = require('core/mutex.js');
var storage = require('core/storage.js');
var constants = require('core/constants.js');
var validationUtils = require("core/validation_utils.js");
var wallet_id;

if (conf.bSingleAddress)
	throw Error('can`t run in single address mode');

function initRPC() {
	var composer = require('core/composer.js');
	var network = require('core/network.js');

	var rpc = require('json-rpc2');
	var walletDefinedByKeys = require('core/wallet_defined_by_keys.js');
	var Wallet = require('core/wallet.js');
	var balances = require('core/balances.js');

	var server = rpc.Server.$create({
		'websocket': true, // is true by default
		'headers': { // allow custom headers is empty by default
			'Access-Control-Allow-Origin': '*'
		}
	});


	/**
	 * 獲取交易結果
	 * Returns address balance(stable and pending).
	 * If address is invalid, then returns "invalid address".
	 * If your wallet doesn`t own the address, then returns "address not found".
	 * @param {String} address
	 * @return {"base":{"stable":{Integer},"pending":{Integer}}} balance
	 *
	 * If no address supplied, returns wallet balance(stable and pending).
	 * @return {"base":{"stable":{Integer},"pending":{Integer}}} balance
	 */
	server.expose('getbalance', function(args, opt, cb) {
		let start_time = Date.now();
		var address = args[0];
		if (address) {
			if (validationUtils.isValidAddress(address))
				db.query("SELECT COUNT(*) AS count FROM my_addresses WHERE address = ?", [address], function(rows) {
					if (rows[0].count)
						db.query(
							"SELECT asset, is_stable, SUM(amount) AS balance \n\
                            FROM outputs JOIN units USING(unit) \n\
                            WHERE is_spent=0 AND address=? AND sequence='good' AND asset IS NULL \n\
                            GROUP BY is_stable", [address],
							function(rows) {
								var balance = {
									base: {
										stable: 0,
										pending: 0
									}
								};
								for (var i = 0; i < rows.length; i++) {
									var row = rows[i];
									balance.base[row.is_stable ? 'stable' : 'pending'] = (row.balance / 1000000).toFixed(2);
								}
								cb(null, balance);
							}
						);
					else
						cb("address not found");
				});
			else
				cb("invalid address");
		}
		else
			Wallet.readBalance(wallet_id, function(balances) {
				console.log('getbalance took '+(Date.now()-start_time)+'ms');
				cb(null, balances);
			});
	});

	/**
	 * Send funds to address.
	 * If address is invalid, then returns "invalid address".
	 * @param {String} address
	 * @param {Integer} amount
	 * @return {String} status
	 */
	server.expose('sendtoaddress', function(args, opt, cb) {
		console.log('sendtoaddress '+JSON.stringify(args));
		let start_time = Date.now();
		var amount = args[1];
		var toAddress = args[0];
		if (amount && toAddress) {
			if (validationUtils.isValidAddress(toAddress)) {
				/*headlessWallet.sendPayment(null, amount, toAddress, "", null, function(err, unit) {
					console.log('sendtoaddress '+JSON.stringify(args)+' took '+(Date.now()-start_time)+'ms, unit='+unit+', err='+err);
					cb(err, err ? undefined : unit);
				});*/
				headlessWallet.issueChangeAddressAndSendPayment(null, amount, toAddress, null, function(err, unit) {
					console.log('sendtoaddress '+JSON.stringify(args)+' took '+(Date.now()-start_time)+'ms, unit='+unit+', err='+err);
					cb(err, err ? undefined : unit);
				});
			} else
				cb("invalid address");
		} else
			cb("wrong parameters");
	});

	/**
	 * Creates and returns new wallet address.
	 * @return {String} address
	 */
	server.expose('getnewaddress', function(args, opt, cb) {
		mutex.lock(['rpc_getnewaddress'], function(unlock){
			walletDefinedByKeys.issueNextAddress(wallet_id, 0, function(addressInfo) {
				unlock();
				cb(null, addressInfo.address);
			});
		});
	});

	/**
	 * Returns transaction list.
	 * If address is invalid, then returns "invalid address".
	 * @param {String} address or {since_mci: {Integer}, unit: {String}}
	 * @return [{"action":{'invalid','received','sent','moved'},"amount":{Integer},"my_address":{String},"arrPayerAddresses":[{String}],"confirmations":{0,1},"unit":{String},"fee":{Integer},"time":{String},"level":{Integer},"asset":{String}}] transactions
	 *
	 * If no address supplied, returns wallet transaction list.
	 * @return [{"action":{'invalid','received','sent','moved'},"amount":{Integer},"my_address":{String},"arrPayerAddresses":[{String}],"confirmations":{0,1},"unit":{String},"fee":{Integer},"time":{String},"level":{Integer},"asset":{String}}] transactions
	 */
	server.expose('listtransactions', function(args, opt, cb) {
		let limit = args[0];
		let start_time = Date.now();
		var opts = {wallet: wallet_id};
		opts.limit = limit || 200;

		Wallet.readTransactionHistory(opts, function(result) {
			console.log('listtransactions '+JSON.stringify(args)+' took '+(Date.now()-start_time)+'ms');
			cb(null, result);
		});

	});


	/**
	 * 發送交易
	 */
	server.expose('sendtransaction', function(args, opt, cb) {

		console.log('sendtransaction '+JSON.stringify(args));
		let start_time 	= Date.now();
		let createTime 	= args[0];
		let dealClass  	= args[1];
		let fromAddr	= args[2];
		let toAddr		= args[3];
		let totalAmount = parseFloat(args[4])*1000000;
		let descrption	= args[5];
		let trId		= args[6];

		let fchange	    = parseInt(args[7]);
		let findex		= parseInt(args[8]);
		let tchange		= parseInt(args[9]);
		let tindex		= parseInt(args[10]);


		let messages = [{
			app: "text",
			payload_location: "inline",
			payload_hash: require('core/object_hash.js').getBase64Hash(descrption),
			payload: descrption
		}];
		if(fromAddr === toAddr) {
			return cb("fromAddr can not be toAddr");
		}


		if (totalAmount && toAddr) {

			if (validationUtils.isValidAddress(toAddr) && validationUtils.isValidAddress(fromAddr)) {
				//验证地址
				db.query("SELECT COUNT(*) AS count FROM my_addresses WHERE address in (?,?)", [fromAddr, toAddr], function (rows) {
					if (rows[0].count == 2) {

						headlessWallet.sendPayment(null, totalAmount, toAddr, fromAddr, null, function(err, unit) {
							console.log('sendtransaction '+JSON.stringify(args)+' took '+(Date.now()-start_time)+'ms, unit='+unit+', err='+err);
							//TODO 更新數據庫 把hash插入mysql數據庫
							// if(!err)
							//     require('core/edu/eduService').updateTransactionHash(trId,unit);

							cb(err, err ? undefined : [createTime,fromAddr,unit,trId]);
						},messages);



					} else {
						walletDefinedByKeys.issueAddress(wallet_id, fchange, findex, function (addressInfo) {
							walletDefinedByKeys.issueAddress(wallet_id, tchange, tindex, function (arrinfo) {

								headlessWallet.sendPayment(null, totalAmount, toAddr, fromAddr, null, function(err, unit) {
									console.log('sendtransaction '+JSON.stringify(args)+' took '+(Date.now()-start_time)+'ms, unit='+unit+', err='+err);
									//TODO 更新數據庫 把hash插入mysql數據庫
									// if(!err)
									//     require('core/edu/eduService').updateTransactionHash(trId,unit);

									cb(err, err ? undefined : [createTime,fromAddr,unit,trId]);
								},messages);

							})
						});
					}
				});
			}
			else
				cb("invalid address");
		}
		else
			cb("wrong parameters");
	});




	/**
	 * 心跳检测
	 */
	server.expose('ping',function (args, opt, cb) {
		cb(null,"pong");
	});


	/**
	 * 查詢交易記錄
	 */
	server.expose('querytransactionstat', function(args, opt, cb) {
		let hash = args[0];

		let start_time = Date.now();
		// if (Array.isArray(args) && typeof args[0] === 'string') {
		//     var address = args[0];
		//     if (validationUtils.isValidAddress(address))
		//         Wallet.readTransactionHistory({address: address}, function(result) {
		//             cb(null, result);
		//         });
		//     else
		//         cb("invalid address");
		// }
		if(hash){
			var opts = {wallet: wallet_id};
			if (args.unit && validationUtils.isValidBase64(args.unit, constants.HASH_LENGTH))
				opts.unit = args.unit;
			else if (args.since_mci && validationUtils.isNonnegativeInteger(args.since_mci))
				opts.since_mci = args.since_mci;
			else
				opts.limit = 200;
			Wallet.readTransactionHistory(opts, function(result) {
				console.log('listtransactions '+JSON.stringify(args)+' took '+(Date.now()-start_time)+'ms');

				if(result.length = 2 && result[0].action !="invalid"){
					result = {hash:hash,result:1};
				}else {
					result = {hash:hash,result:2};
				}
				cb(null, result);

			});
		}else{
			cb("wrong parameters");
		}
	});


	/**
	 * 獲取創世地址
	 */
	server.expose('getaddress', function(args, opt, cb) {
		mutex.lock(['rpc_getnewaddress'], function(unlock){
			walletDefinedByKeys.issueAddress(wallet_id, 0, 0, function(addressInfo) {
				unlock();
				cb(null, addressInfo.address);
			});
		});
	});




	/**
	 * Returns information about the current state.
	 * @return { last_mci: {Integer}, last_stable_mci: {Integer}, count_unhandled: {Integer} }
	 */
	server.expose('getinfo', function(args, opt, cb) {
		var response = {};
		storage.readLastMainChainIndex(function(last_mci){
			response.last_mci = last_mci;
			storage.readLastStableMcIndex(db, function(last_stable_mci){
				response.last_stable_mci = last_stable_mci;
				db.query("SELECT COUNT(*) AS count_unhandled FROM unhandled_joints", function(rows){
					response.count_unhandled = rows[0].count_unhandled;
					cb(null, response);
				});
			});
		});
	});

	/**
	 * Validates address.
	 * @return {boolean} is_valid
	 */
	// alias for validateaddress
	server.expose('verifyaddress', function(args, opt, cb) {
		var address = args[0];
		cb(null, validationUtils.isValidAddress(address));
	});






	/**
	 * Returns wallet balance(stable and pending) without commissions earned from headers and witnessing.
	 *
	 * @return {"base":{"stable":{Integer},"pending":{Integer}}} balance
	 */
	server.expose('getmainbalance', function(args, opt, cb) {
		let start_time = Date.now();
		balances.readOutputsBalance(wallet_id, function(balances) {
			console.log('getmainbalance took '+(Date.now()-start_time)+'ms');
			cb(null, balances);
		});
	});

	/**
	 * Returns transaction list.
	 * If address is invalid, then returns "invalid address".
	 * @param {String} address or {since_mci: {Integer}, unit: {String}}
	 * @return [{"action":{'invalid','received','sent','moved'},"amount":{Integer},"my_address":{String},"arrPayerAddresses":[{String}],"confirmations":{0,1},"unit":{String},"fee":{Integer},"time":{String},"level":{Integer},"asset":{String}}] transactions
	 *
	 * If no address supplied, returns wallet transaction list.
	 * @return [{"action":{'invalid','received','sent','moved'},"amount":{Integer},"my_address":{String},"arrPayerAddresses":[{String}],"confirmations":{0,1},"unit":{String},"fee":{Integer},"time":{String},"level":{Integer},"asset":{String}}] transactions
	 */
	server.expose('listtallransactions', function(args, opt, cb) {
		let start_time = Date.now();
		if (Array.isArray(args) && typeof args[0] === 'string') {
			var address = args[0];
			if (validationUtils.isValidAddress(address))
				Wallet.readTransactionHistory({address: address}, function(result) {
					cb(null, result);
				});
			else
				cb("invalid address");
		}
		else{
			var opts = {wallet: wallet_id};
			if (args.unit && validationUtils.isValidBase64(args.unit, constants.HASH_LENGTH))
				opts.unit = args.unit;
			else if (args.since_mci && validationUtils.isNonnegativeInteger(args.since_mci))
				opts.since_mci = args.since_mci;
			else
				opts.limit = 200;
			Wallet.readTransactionHistory(opts, function(result) {
				console.log('listtransactions '+JSON.stringify(args)+' took '+(Date.now()-start_time)+'ms');
				cb(null, result);
			});
		}

	});


	headlessWallet.readSingleWallet(function(_wallet_id) {
		wallet_id = _wallet_id;
		// listen creates an HTTP server on localhost only
		var httpServer = server.listen(conf.rpcPort, conf.rpcInterface);
		httpServer.timeout = 900*1000;
	});
}

eventBus.on('headless_wallet_ready', initRPC);
