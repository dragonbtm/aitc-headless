/*jslint node: true */
"use strict";
var headlessWallet = require('../start');
var eventBus = require('core/event_bus.js');
var assetUtils = require('./assetUtils.js');
var fs = require('fs');
var DivisibleAsset = require('core/divisible_asset.js');
headlessWallet.setupChatEventHandlers();

eventBus.on('headless_wallet_ready', function(){
	headlessWallet.readSingleAddress(function(address){
		setTimeout(function(){
			// 第一个参数设定新资产名称
			// 第二个参数来修改Token的总发行量。
			var asset = {
				assets_name: 'QQ',
				cap: 9000000000000,
				is_private: false,
				is_transferrable: true,
				auto_destroy: false,
				fixed_denominations: false,
				issued_by_definer_only: true,
				cosigned_by_definer: false,
				spender_attested: false,
			};
			DivisibleAsset.findeAssetUnitID(asset.assets_name);
			assetUtils.issueAsset(asset,address,writeTokenId);
		},3000);
	});
});

function writeTokenId(TokenId){
	var ajson = {TokenId:TokenId};
	fs.writeFile("./asset.json", JSON.stringify(ajson, null, '\t'), 'utf8', function(err){
		if (err)
			throw ("failed to write json");
	});
}

