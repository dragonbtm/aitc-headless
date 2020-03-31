"use strict";
var headlessWallet = require('../start');
var eventBus = require('core/event_bus.js');
var db = require('core/db.js');

function onError(err){
	throw Error(err);
}

/**
 * 查询某个地址中，特定token的余额
 * @param {*} assetId TokenId
 * @param {*} address 需要查询的钱包地址
 * @param {*} cb 	  callbacks
 */
function balanceOf(assetId,address,cb){
	db.query(
		"SELECT \n\
            SUM(amount) AS balance \n\
        FROM \n\
            outputs \n\
        WHERE \n\
            outputs.asset = ? \n\
            AND outputs.address = ? \n\
            AND outputs.is_spent = 0",
		[assetId,address],
		function(rows){
			var balance = rows[0].balance;
			cb(balance);
		})
}
/**
 * 	转账操作
 * @param {String} asset 		TokenId
 * @param {String} from_address 发送方钱包地址
 * @param {String} to_address 	接收方钱包地址
 * @param {Number} amount 		发送的Token的数量，必须为整型
 */
function transfer(asset,from_address,to_address,amount){
	var network = require('luxalpacore/network.js');
	var divisibleAsset = require('luxalpacore/divisible_asset.js');
	var walletGeneral = require('luxalpacore/wallet_general.js');
	divisibleAsset.composeAndSaveDivisibleAssetPaymentJoint({
		asset: asset,
		paying_addresses: [from_address],
		fee_paying_addresses: [from_address],
		change_address: from_address,
		to_address: to_address,
		amount: amount,
		signer: headlessWallet.signer,
		callbacks: {
			ifError: onError,
			ifNotEnoughFunds: onError,
			ifOk: function(objJoint, arrChains){
				network.broadcastJoint(objJoint);
			}
		}
	});
}

/**
 * 		发行Token
 * @param {JSON} asset 	   Token的属性
 * @param {String} address Token发行人的钱包地址
 * @param {} cb 		   回调函数
 */
function issueAsset(asset,address,cb){
	var composer = require('luxalpacore/composer.js');
	var network = require('luxalpacore/network.js');
	var callbacks = composer.getSavingCallbacks({
		ifNotEnoughFunds: onError,
		ifError: onError,
		ifOk: function(objJoint){
			network.broadcastJoint(objJoint);
			var json = JSON.parse(JSON.stringify(objJoint, null, '\t'));
			cb(json['unit']['unit']);
		}
	});
	composer.composeAssetDefinitionJoint(address, asset, headlessWallet.signer, callbacks);
}


/**
 * 查询当前地址发行的所有的Token
 * @param {*} address Token发行人的钱包地址
 * @param {*} cb 	  回调
 */
function listAsset(address,cb){
	db.query(
		"SELECT \n\
            assets.unit AS asset \n\
        FROM \n\
            assets \n\
            LEFT JOIN unit_authors ON assets.unit = unit_authors.unit \n\
        WHERE \n\
            unit_authors.address = ?",
		[address],
		function(rows){
			cb(rows)
		})
}

/**
 *  根据TokenId 查询Token的发行总量
 * @param {*} assetId   TokenId
 * @param {*} cb 		回调函数
 */
function totalSupply(assetId,cb){
	db.query(
		"SELECT \n\
            cap \n\
        FROM \n\
            assets \n\
        WHERE \n\
            assets.unit = ?",
		[asset],
		function(rows){
			var cap = rows[0].cap;
			cb(cap)
		})
}

exports.totalSupply = totalSupply
exports.issueAsset = issueAsset
exports.transfer = transfer
exports.balanceOf = balanceOf
exports.listAsset = listAsset
