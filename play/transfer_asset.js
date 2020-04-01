/*jslint node: true */
"use strict";
var headlessWallet = require('../start');
var eventBus = require('core/event_bus.js');
var assetUtils = require('./assetUtils.js');
headlessWallet.setupChatEventHandlers();
eventBus.on('headless_wallet_ready', function(){
	headlessWallet.readFirstAddress(function(address){
		setTimeout(function(){
			//第一个参数设置为自己发行的TokenID
			assetUtils.transfer('CY2ZV1rUphB7Wc4/ur5tewswLB76NBd8+mgQtmffQok=',address,'GX4Q7EWK3GJYOIFRVOZZNS2E3RNWVN7X',900000000);
		},3000);
	});
});
//is_transferrable
