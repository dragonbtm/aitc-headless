/*jslint node: true */
"use strict";
var headlessWallet = require('../start.js');
var eventBus = require('core/event_bus.js');

function onError(err){
	throw Error(err);
}

function createDivisibleAssetPayment(){
	var network = require('core/network.js');
	var divisibleAsset = require('core/divisible_asset.js');
	var walletGeneral = require('core/wallet_general.js');

	divisibleAsset.composeAndSaveDivisibleAssetPaymentJoint({
		asset: 'pXe/gOaoRIaFbM0mj8/02bTAZzWOA1YroSzNfusxQJU=',
		paying_addresses: ["GX4Q7EWK3GJYOIFRVOZZNS2E3RNWVN7X"],
		fee_paying_addresses: ["GX4Q7EWK3GJYOIFRVOZZNS2E3RNWVN7X"],
		change_address: "GX4Q7EWK3GJYOIFRVOZZNS2E3RNWVN7X",
		to_address: "GX4Q7EWK3GJYOIFRVOZZNS2E3RNWVN7X",
		amount: 5000,
		signer: headlessWallet.signer,
		callbacks: {
			ifError: onError,
			ifNotEnoughFunds: onError,
			ifOk: function(objJoint, arrChains){
				network.broadcastJoint(objJoint);
				if (arrChains){ // if the asset is private
					// send directly to the receiver
					network.sendPrivatePayment('ws://192.168.62.28:8286', arrChains);

					// or send to the receiver's device address through the receiver's hub
					//walletGeneral.sendPrivatePayments("0F7Z7DDVBDPTYJOY7S4P24CW6K23F6B7S", arrChains);
				}
			}
		}
	});
}

eventBus.on('headless_wallet_ready', createDivisibleAssetPayment);
