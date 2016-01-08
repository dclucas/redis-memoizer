var redis = require('ioredis'),
	Promise = require('bluebird'),
	crypto = require('crypto');

module.exports = function() {
	var client = redis.createClient.apply(null, arguments);

	function hash(string) {
		return crypto.createHmac('sha1', 'memo').update(string).digest('hex');
	}

	function getKeyFromRedis(ns, key, done) {
		return client.get('memos:' + ns + ':' + key)
		.then(function(value) {
			return JSON.parse(value);
		});
	}

	function writeKeyToRedis(ns, key, value, ttl) {
		return client.setex('memos:' + ns + ':' + key, ttl, JSON.stringify(value));
	}

	function getTtl(ttl) {
		return (typeof ttl == 'function')? ttl: function() { return ttl || 120; };
	}
	
	return function memoize(fn, ttl) {
		var functionKey = hash(fn.toString()),
			inFlight = {},
			ttlfn = getTtl(ttl);

		return function() {
			var self = this,	// if 'this' is used in the function
				args = Array.prototype.slice.call(arguments),
				argsStringified = args.map(function(arg) { return JSON.stringify(arg); }).join(",");

			argsStringified = hash(argsStringified);
			return getKeyFromRedis(functionKey, argsStringified)
				.then(function(value) {
					if (value) {
						return value;
					} else if (inFlight[argsStringified]) {
						return inFlight[argsStringified];
					} else {
						return inFlight[argsStringified] = Promise
							.resolve(fn.apply(self, args))
							.then(function(res) {
								writeKeyToRedis(functionKey, argsStringified, res, ttlfn());
								return res;
							});
					}
				});
		};
	};
};